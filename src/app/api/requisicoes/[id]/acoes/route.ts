import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"
import {
  ACOES_VALIDAS,
  AcaoItem,
  TRANSICOES,
  calcularStatusAgregado,
  dataPrevistaDevolucaoPadrao,
  PAPEIS_GESTAO_REQUISICOES,
  papeisPermitidosParaAcao,
  tipoNotificacaoParaStatus,
} from "@/lib/requisicoes/requisicoes-helpers"
import { NotificacaoTipo, Prisma, StatusItemSolicitacao } from "@prisma/client"

const acaoSchema = z.object({
  acao: z.enum(ACOES_VALIDAS as [AcaoItem, ...AcaoItem[]]),
  // Se vier vazio/omitido: ação em massa, aplica a todo item com
  // alteradoManualmente = false. Se vier preenchido: ação manual só
  // nesses itens, e eles passam a ficar marcados como alterados
  // manualmente (não entram mais em ações em massa futuras).
  itemIds: z.array(z.string()).optional(),
  motivoRejeicao: z.string().trim().max(500).optional(),
  dataPrevistaDevolucao: z.coerce.date().optional(),
  // Marcação por item usada na ENTREGA: esse material precisa voltar pro
  // almoxarifado? Omitido -> usa o padrão do cadastro do material
  // (tipoUso === RETORNAVEL). Marcado como true -> cria Empréstimo na
  // hora, mesmo que o pedido seja do tipo Saída.
  marcacoesEntrega: z
    .array(
      z.object({
        itemId: z.string(),
        precisaRetorno: z.boolean(),
      })
    )
    .optional(),
})

// POST /api/requisicoes/[id]/acoes
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(PAPEIS_GESTAO_REQUISICOES)
  if (guard instanceof NextResponse) return guard
  const usuario = guard.user

  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const parsed = acaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, { status: 400 })
  }
  const { acao, itemIds, motivoRejeicao, dataPrevistaDevolucao, marcacoesEntrega } = parsed.data

  if (acao === "REJEITAR" && !motivoRejeicao) {
    return NextResponse.json({ error: "Informe o motivo da rejeição" }, { status: 400 })
  }

  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      solicitanteUser: { select: { id: true, name: true, setor: true, cargo: true } },
      pessoaAtendida: { select: { id: true, nome: true, setor: true, funcao: true } },
      itens: {
        include: {
          // Select enxuto: só os campos que a máquina de ações usa
          // (nome pra mensagem, estoque/tipoUso pra entrega).
          material: {
            select: { nome: true, estoqueAtual: true, tipoUso: true },
          },
        },
      },
    },
  })

  if (!solicitacao) {
    return NextResponse.json({ error: "Requisição não encontrada" }, { status: 404 })
  }

  const acaoManual = Boolean(itemIds && itemIds.length > 0)
  const alvo = acaoManual
    ? solicitacao.itens.filter((i) => itemIds!.includes(i.id))
    : solicitacao.itens.filter((i) => !i.alteradoManualmente)

  if (acaoManual && alvo.length !== itemIds!.length) {
    return NextResponse.json({ error: "Um ou mais itens informados não pertencem a essa requisição" }, { status: 400 })
  }

  if (alvo.length === 0) {
    return NextResponse.json({ error: "Nenhum item elegível pra essa ação" }, { status: 400 })
  }

  const transicao = TRANSICOES[acao]
  const aplicados: string[] = []
  const ignorados: { itemId: string; material: string; motivo: string }[] = []

  const nomeSolicitante =
    solicitacao.solicitanteUser?.name ?? solicitacao.pessoaAtendida?.nome ?? "Não identificado"
  const setorSolicitante = solicitacao.solicitanteUser?.setor ?? solicitacao.pessoaAtendida?.setor ?? null
  const funcaoSolicitante = solicitacao.solicitanteUser?.cargo ?? solicitacao.pessoaAtendida?.funcao ?? null

  await prisma.$transaction(async (tx) => {
    for (const item of alvo) {
      // 1) o item precisa estar num status de origem válido pra essa ação
      if (!transicao.de.includes(item.status)) {
        ignorados.push({ itemId: item.id, material: item.material.nome, motivo: `status atual (${item.status}) não permite essa ação` })
        continue
      }

      // 2) o usuário precisa ter o papel necessário PRA ESSE status específico
      //    (item travado por aprovação superior exige SUPERVISOR+)
      const papeisNecessarios = papeisPermitidosParaAcao(acao, item.status)
      if (!papeisNecessarios.includes(usuario.role)) {
        ignorados.push({ itemId: item.id, material: item.material.nome, motivo: "requer aprovação de um nível superior" })
        continue
      }

      const dataBase: Prisma.ItemSolicitacaoUpdateInput = {
        status: transicao.para,
        ...(acaoManual ? { alteradoManualmente: true } : {}),
      }

      if (acao === "APROVAR") {
        dataBase.aprovador = { connect: { id: usuario.id } }
        dataBase.dataAprovacao = new Date()
      }

      if (acao === "REJEITAR") {
        dataBase.motivoRejeicao = motivoRejeicao
      }

      if (acao === "INICIAR_PREPARO") {
        dataBase.preparador = { connect: { id: usuario.id } }
        dataBase.dataInicioPreparo = new Date()
      }

      if (acao === "MARCAR_PRONTO") {
        dataBase.dataFimPreparo = new Date()
        if (!item.preparadorId) dataBase.preparador = { connect: { id: usuario.id } }
      }

      if (acao === "ENTREGAR") {
        const quantidade = Number(item.quantidade)
        const estoqueAnterior = Number(item.material.estoqueAtual)

        if (estoqueAnterior < quantidade) {
          ignorados.push({ itemId: item.id, material: item.material.nome, motivo: "estoque insuficiente" })
          continue
        }

        const estoqueNovo = estoqueAnterior - quantidade

        dataBase.dataEntrega = new Date()
        dataBase.entreguePor = { connect: { id: usuario.id } }

        // Precisa voltar? Override manual da entrega > padrão do cadastro
        // do material (tipoUso). Materiais retornáveis geram Empréstimo na
        // entrega — mesmo que o pedido seja do tipo Saída — e ficam "em
        // posse" da pessoa até a devolução. Consumíveis saem definitivos.
        const marcacao = marcacoesEntrega?.find((m) => m.itemId === item.id)
        const precisaRetorno =
          marcacao?.precisaRetorno ?? item.material.tipoUso === "RETORNAVEL"

        let emprestimoId: string | undefined

        if (precisaRetorno) {
          const emprestimo = await tx.emprestimo.create({
            data: {
              materialId: item.materialId,
              quantidade,
              solicitanteNome: nomeSolicitante,
              solicitanteSetor: setorSolicitante,
              solicitanteFuncao: funcaoSolicitante,
              dataPrevistaDevolucao:
                item.dataPrevistaDevolucao ?? dataPrevistaDevolucao ?? dataPrevistaDevolucaoPadrao(),
              status: "EMPRESTADO",
              responsavelId: usuario.id,
              itemSolicitacaoId: item.id,
            },
          })
          emprestimoId = emprestimo.id
        }

        await tx.movimentacaoEstoque.create({
          data: {
            materialId: item.materialId,
            tipo: "SAIDA",
            quantidade,
            quantidadeAnterior: estoqueAnterior,
            quantidadeAtual: estoqueNovo,
            motivo: emprestimoId
              ? `Empréstimo — requisição #${solicitacao.numero}`
              : `Requisição #${solicitacao.numero}`,
            solicitanteNome: nomeSolicitante,
            solicitanteSetor: setorSolicitante,
            solicitanteFuncao: funcaoSolicitante,
            usuarioId: usuario.id,
            itemSolicitacaoId: item.id,
            emprestimoId,
            precisaRetorno,
          },
        })

        await tx.material.update({
          where: { id: item.materialId },
          data: { estoqueAtual: estoqueNovo },
        })
      }

      await tx.itemSolicitacao.update({ where: { id: item.id }, data: dataBase })

      await tx.statusHistory.create({
        data: {
          entidade: "ItemSolicitacao",
          entidadeId: item.id,
          statusAnterior: item.status,
          statusNovo: transicao.para,
          observacao: acao === "REJEITAR" ? motivoRejeicao ?? null : null,
          usuarioId: usuario.id,
        },
      })

      aplicados.push(item.id)
    }

    if (aplicados.length === 0) return

    const todosItens = await tx.itemSolicitacao.findMany({ where: { solicitacaoId: solicitacao.id } })
    const statusAgregadoAnterior = solicitacao.status
    const statusAgregadoNovo = calcularStatusAgregado(todosItens.map((i) => i.status as StatusItemSolicitacao))

    if (statusAgregadoNovo !== statusAgregadoAnterior) {
      await tx.solicitacao.update({ where: { id: solicitacao.id }, data: { status: statusAgregadoNovo } })

      await tx.statusHistory.create({
        data: {
          entidade: "Solicitacao",
          entidadeId: solicitacao.id,
          statusAnterior: statusAgregadoAnterior,
          statusNovo: statusAgregadoNovo,
          usuarioId: usuario.id,
        },
      })

      const tipoNotif = tipoNotificacaoParaStatus(statusAgregadoNovo)
      if (tipoNotif && solicitacao.solicitanteUserId) {
        await tx.notificacao.create({
          data: {
            usuarioId: solicitacao.solicitanteUserId,
            titulo: `Requisição #${solicitacao.numero} atualizada`,
            mensagem: mensagemNotificacao(tipoNotif, solicitacao.numero),
            tipo: tipoNotif as NotificacaoTipo,
            entidade: "Solicitacao",
            entidadeId: solicitacao.id,
          },
        })
      }
    }
  })

  const requisicaoAtualizada = await prisma.solicitacao.findUnique({
    where: { id: solicitacao.id },
    include: { itens: { include: { material: { select: { id: true, nome: true, codigoInterno: true } } } } },
  })

  return NextResponse.json({
    requisicao: requisicaoAtualizada,
    aplicados: aplicados.length,
    ignorados,
  })
}

function mensagemNotificacao(tipo: NotificacaoTipo, numero: number): string {
  switch (tipo) {
    case "SOLICITACAO_PREPARANDO":
      return `Sua requisição #${numero} entrou em preparação.`
    case "SOLICITACAO_PRONTA":
      return `Sua requisição #${numero} está pronta para retirada/entrega.`
    case "SOLICITACAO_ENTREGUE":
      return `Sua requisição #${numero} foi entregue.`
    case "SOLICITACAO_CANCELADA":
      return `Sua requisição #${numero} foi cancelada.`
    default:
      return `Sua requisição #${numero} foi atualizada.`
  }
}
