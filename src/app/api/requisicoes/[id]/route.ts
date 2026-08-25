import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth/require-role"
import { podeGerenciarRequisicoes } from "@/lib/requisicoes/requisicoes-helpers"
import { Prioridade } from "@prisma/client"

// GET /api/requisicoes/[id] — detalhe completo, com itens e histórico.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard
  const usuario = guard.user

  const { id } = await params

  const requisicao = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      solicitanteUser: { select: { id: true, name: true, setor: true, cargo: true, telefone: true, email: true } },
      pessoaAtendida: { select: { id: true, nome: true, setor: true, funcao: true } },
      lancadoPor: { select: { id: true, name: true } },
      agendamento: true,
      itens: {
        include: {
          material: {
            select: { id: true, nome: true, codigoInterno: true, estoqueAtual: true, requerAprovacao: true, tipoUso: true, unidadeMedida: { select: { sigla: true } } },
          },
          aprovador: { select: { id: true, name: true } },
          preparador: { select: { id: true, name: true } },
          entreguePor: { select: { id: true, name: true } },
          movimentacao: { select: { id: true, tipo: true, createdAt: true } },
          emprestimo: { select: { id: true, status: true, dataPrevistaDevolucao: true, dataDevolucao: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!requisicao) {
    return NextResponse.json({ error: "Requisição não encontrada" }, { status: 404 })
  }

  if (!podeGerenciarRequisicoes(usuario.role) && requisicao.solicitanteUserId !== usuario.id) {
    return NextResponse.json({ error: "Você não tem permissão para ver essa requisição" }, { status: 403 })
  }

  const itemIds = requisicao.itens.map((i) => i.id)
  const historico = await prisma.statusHistory.findMany({
    where: {
      OR: [
        { entidade: "Solicitacao", entidadeId: requisicao.id },
        { entidade: "ItemSolicitacao", entidadeId: { in: itemIds } },
      ],
    },
    include: { usuario: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ requisicao: mapearDetalhe(requisicao), historico })
}

// PATCH /api/requisicoes/[id] — edição de campos simples do cabeçalho.
// Mudança de STATUS não passa por aqui — isso é responsabilidade da rota
// /api/requisicoes/[id]/acoes (é lá que os efeitos colaterais acontecem).
const atualizarSchema = z.object({
  prioridade: z.nativeEnum(Prioridade).optional(),
  motivo: z.string().trim().max(500).optional().nullable(),
  observacoesInternas: z.string().trim().max(1000).optional().nullable(),
  dataLimite: z.coerce.date().optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard
  const usuario = guard.user

  const { id } = await params

  const requisicaoExistente = await prisma.solicitacao.findUnique({ where: { id } })
  if (!requisicaoExistente) {
    return NextResponse.json({ error: "Requisição não encontrada" }, { status: 404 })
  }

  const dono = requisicaoExistente.solicitanteUserId === usuario.id
  const gestor = podeGerenciarRequisicoes(usuario.role)
  if (!dono && !gestor) {
    return NextResponse.json({ error: "Você não tem permissão para editar essa requisição" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = atualizarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, { status: 400 })
  }

  // observacoesInternas é só de quem gerencia — o dono da requisição (se
  // não for staff) não deveria escrever anotação interna do almoxarifado.
  const dados = { ...parsed.data }
  if (!gestor) delete dados.observacoesInternas

  const requisicao = await prisma.solicitacao.update({
    where: { id },
    data: dados,
  })

  return NextResponse.json({ requisicao })
}

// Mapper de borda: recebe o resultado de um include dinâmico do Prisma
// (shape variável por rota), tipá-lo integralmente custaria mais que o valor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearDetalhe(r: any) {
  return {
    id: r.id,
    numero: r.numero,
    tipo: r.tipo,
    origem: r.origem,
    status: r.status,
    prioridade: r.prioridade,
    motivo: r.motivo,
    observacoesInternas: r.observacoesInternas,
    dataLimite: r.dataLimite,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    solicitante: r.solicitanteUser
      ? { tipo: "USUARIO" as const, ...r.solicitanteUser, nome: r.solicitanteUser.name }
      : r.pessoaAtendida
      ? { tipo: "PESSOA_ATENDIDA" as const, ...r.pessoaAtendida }
      : null,
    lancadoPor: r.lancadoPor ? { id: r.lancadoPor.id, nome: r.lancadoPor.name } : null,
    agendamento: r.agendamento,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itens: r.itens.map((i: any) => ({
      id: i.id,
      status: i.status,
      quantidade: Number(i.quantidade),
      requerAprovacaoSuperior: i.requerAprovacaoSuperior,
      alteradoManualmente: i.alteradoManualmente,
      material: {
        ...i.material,
        estoqueAtual: Number(i.material.estoqueAtual),
      },
      aprovador: i.aprovador,
      dataAprovacao: i.dataAprovacao,
      motivoRejeicao: i.motivoRejeicao,
      preparador: i.preparador,
      dataInicioPreparo: i.dataInicioPreparo,
      dataFimPreparo: i.dataFimPreparo,
      entreguePor: i.entreguePor,
      dataEntrega: i.dataEntrega,
      dataPrevistaDevolucao: i.dataPrevistaDevolucao,
      observacao: i.observacao,
      movimentacao: i.movimentacao,
      emprestimo: i.emprestimo,
    })),
  }
}
