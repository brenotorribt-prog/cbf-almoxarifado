import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { PAPEIS_APROVACAO_SUPERIOR, statusInicialItem, calcularStatusAgregado } from "@/lib/requisicoes-helpers"
import { NotificacaoTipo, Prioridade, TipoSolicitacao } from "@prisma/client"

export const itemRequisicaoSchema = z.object({
  materialId: z.string().min(1),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  dataPrevistaDevolucao: z.coerce.date().optional().nullable(),
  observacao: z.string().trim().max(300).optional().nullable(),
})

export const criarRequisicaoBaseSchema = z.object({
  tipo: z.nativeEnum(TipoSolicitacao),
  prioridade: z.nativeEnum(Prioridade).default("MEDIA"),
  motivo: z.string().trim().max(500).optional().nullable(),
  // Prazo máximo aceitável pra atender o pedido.
  dataLimite: z.coerce.date().optional().nullable(),
  anexos: z.any().optional().nullable(),
  itens: z.array(itemRequisicaoSchema).min(1, "Inclua pelo menos um item na requisição"),
})

interface CriarRequisicaoParams {
  dados: z.infer<typeof criarRequisicaoBaseSchema>
  // Origem é decidida por QUEM CHAMA a função (a rota autenticada sempre
  // passa AUTENTICADO, a rota pública sempre passa PUBLICO) — não dá mais
  // pra inferir isso a partir de qual id de solicitante veio preenchido,
  // porque agora um staff autenticado também pode preencher
  // pessoaAtendidaId (lançando o pedido no lugar de quem pediu).
  origem: "AUTENTICADO" | "PUBLICO"
  solicitanteUserId?: string | null
  pessoaAtendidaId?: string | null
  // Preenchido só quando um staff (ALMOXARIFE+) lança em nome de outra
  // pessoa — é ele quem "digitou" o pedido, não quem pediu de fato.
  lancadoPorId?: string | null
}

export class ErroRequisicao extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function criarRequisicao({
  dados,
  origem,
  solicitanteUserId,
  pessoaAtendidaId,
  lancadoPorId,
}: CriarRequisicaoParams) {
  if (!solicitanteUserId && !pessoaAtendidaId) {
    throw new ErroRequisicao("Requisição precisa de um solicitante (usuário ou pessoa atendida)")
  }
  if (solicitanteUserId && pessoaAtendidaId) {
    throw new ErroRequisicao("Requisição não pode ter usuário logado E pessoa atendida ao mesmo tempo")
  }
  if (lancadoPorId && !pessoaAtendidaId) {
    throw new ErroRequisicao("Lançar em nome de outra pessoa só se aplica a pessoas atendidas, não a usuários logados")
  }

  if (pessoaAtendidaId) {
    const pessoa = await prisma.pessoaAtendida.findUnique({ where: { id: pessoaAtendidaId } })
    if (!pessoa) {
      throw new ErroRequisicao("Pessoa atendida não encontrada. Selecione um cadastro existente.", 404)
    }
  }

  // TRANSFERENCIA não faz sentido pelo formulário público (é fluxo interno
  // entre setores do almoxarifado) — trava aqui pra API pública nunca aceitar.
  if (origem === "PUBLICO" && dados.tipo === "TRANSFERENCIA") {
    throw new ErroRequisicao("Esse tipo de requisição não está disponível no formulário público")
  }

  if (dados.tipo === "EMPRESTIMO") {
    const semData = dados.itens.some((i) => !i.dataPrevistaDevolucao)
    if (semData) {
      throw new ErroRequisicao("Todo item de empréstimo precisa de uma data prevista de devolução")
    }
  }

  const materialIds = [...new Set(dados.itens.map((i) => i.materialId))]
  const materiais = await prisma.material.findMany({ where: { id: { in: materialIds } } })

  if (materiais.length !== materialIds.length) {
    throw new ErroRequisicao("Um ou mais materiais da requisição não foram encontrados", 404)
  }

  const materiaisInativos = materiais.filter((m) => m.situacao !== "ATIVO")
  if (materiaisInativos.length > 0) {
    throw new ErroRequisicao(
      `Material(is) inativo(s) não pode(m) ser solicitado(s): ${materiaisInativos.map((m) => m.nome).join(", ")}`,
      409
    )
  }

  const materiaisPorId = new Map(materiais.map((m) => [m.id, m]))

  const itensParaCriar = dados.itens.map((item) => {
    const material = materiaisPorId.get(item.materialId)!
    const requerAprovacaoSuperior = material.requerAprovacao
    return {
      materialId: item.materialId,
      quantidade: item.quantidade,
      observacao: item.observacao || null,
      dataPrevistaDevolucao: dados.tipo === "EMPRESTIMO" ? item.dataPrevistaDevolucao : null,
      requerAprovacaoSuperior,
      status: statusInicialItem(requerAprovacaoSuperior),
    }
  })

  const statusAgregado = calcularStatusAgregado(itensParaCriar.map((i) => i.status))

  const solicitacao = await prisma.$transaction(async (tx) => {
    const criada = await tx.solicitacao.create({
      data: {
        tipo: dados.tipo,
        origem,
        solicitanteUserId: solicitanteUserId || null,
        pessoaAtendidaId: pessoaAtendidaId || null,
        lancadoPorId: lancadoPorId || null,
        prioridade: dados.prioridade,
        motivo: dados.motivo || null,
        dataLimite: dados.dataLimite || null,
        anexos: dados.anexos ?? undefined,
        status: statusAgregado,
        itens: { create: itensParaCriar },
      },
      include: {
        itens: { include: { material: { select: { id: true, nome: true, codigoInterno: true } } } },
        solicitanteUser: { select: { id: true, name: true, setor: true, cargo: true } },
        pessoaAtendida: { select: { id: true, nome: true, setor: true, funcao: true } },
        lancadoPor: { select: { id: true, name: true } },
      },
    })

    // Alerta pra quem gerencia aprovação superior, se algum item já nasceu travado.
    const itensTravados = criada.itens.filter((i) => i.status === "AGUARDANDO_APROVACAO_SUPERIOR")
    if (itensTravados.length > 0) {
      const aprovadores = await tx.user.findMany({
        where: { role: { in: PAPEIS_APROVACAO_SUPERIOR }, ativo: true },
        select: { id: true },
      })
      if (aprovadores.length > 0) {
        await tx.notificacao.createMany({
          data: aprovadores.map((a) => ({
            usuarioId: a.id,
            titulo: "Requisição aguardando aprovação",
            mensagem: `Requisição #${criada.numero} tem ${itensTravados.length} item(ns) que exige(m) aprovação superior.`,
            tipo: "ITEM_REQUER_APROVACAO_SUPERIOR" as NotificacaoTipo,
            entidade: "Solicitacao",
            entidadeId: criada.id,
          })),
        })
      }
    }

    return criada
  })

  return solicitacao
}
