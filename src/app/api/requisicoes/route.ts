import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-role"
import { criarRequisicao, criarRequisicaoBaseSchema, ErroRequisicao } from "@/lib/criar-requisicao"
import { podeGerenciarRequisicoes } from "@/lib/requisicoes-helpers"
import { Prioridade, Prisma, StatusSolicitacao, TipoSolicitacao } from "@prisma/client"

const LIMIT_PADRAO = 30
const LIMIT_MAXIMO = 100

// GET /api/requisicoes?status=&tipo=&prioridade=&busca=&cursor=&limit=
//
// SOLICITANTE só vê as próprias requisições. Os demais papéis de gestão
// veem tudo (é o mesmo corte de permissão usado nas outras rotas).
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard
  const usuario = guard.user

  const { searchParams } = new URL(request.url)

  const cursorParam = searchParams.get("cursor")
  const cursor = cursorParam ? Number(cursorParam) : null

  const limitParam = Number(searchParams.get("limit") ?? LIMIT_PADRAO)
  const limit = Math.min(Math.max(limitParam || LIMIT_PADRAO, 1), LIMIT_MAXIMO)

  const status = searchParams.get("status") as StatusSolicitacao | null
  const tipo = searchParams.get("tipo") as TipoSolicitacao | null
  const prioridade = searchParams.get("prioridade") as Prioridade | null
  const busca = searchParams.get("busca")?.trim()

  const where: Prisma.SolicitacaoWhereInput = {}

  if (!podeGerenciarRequisicoes(usuario.role)) {
    where.solicitanteUserId = usuario.id
  }

  if (status && Object.values(StatusSolicitacao).includes(status)) where.status = status
  if (tipo && Object.values(TipoSolicitacao).includes(tipo)) where.tipo = tipo
  if (prioridade && Object.values(Prioridade).includes(prioridade)) where.prioridade = prioridade

  if (busca) {
    const numeroBusca = Number(busca)
    where.OR = [
      ...(Number.isFinite(numeroBusca) ? [{ numero: numeroBusca }] : []),
      { solicitanteUser: { name: { contains: busca, mode: "insensitive" as const } } },
      { pessoaAtendida: { nome: { contains: busca, mode: "insensitive" as const } } },
      { itens: { some: { material: { nome: { contains: busca, mode: "insensitive" as const } } } } },
    ]
  }

  if (cursor !== null && !Number.isNaN(cursor)) {
    where.numero = { ...(typeof where.numero === "object" ? where.numero : {}), lt: cursor }
  }

  const requisicoes = await prisma.solicitacao.findMany({
    where,
    take: limit + 1,
    orderBy: { numero: "desc" },
    include: {
      solicitanteUser: { select: { id: true, name: true, setor: true, cargo: true } },
      pessoaAtendida: { select: { id: true, nome: true, setor: true, funcao: true } },
      lancadoPor: { select: { id: true, name: true } },
      itens: {
        select: {
          id: true,
          status: true,
          quantidade: true,
          requerAprovacaoSuperior: true,
          material: { select: { id: true, nome: true, codigoInterno: true } },
        },
      },
      agendamento: { select: { id: true, dataAgendada: true, status: true } },
    },
  })

  const temMais = requisicoes.length > limit
  const pagina = temMais ? requisicoes.slice(0, limit) : requisicoes
  const nextCursor = temMais ? pagina[pagina.length - 1].numero : null

  const [resumo] = await prisma.$queryRaw<
    { total: number; pendentes: number; aguardandoAprovacao: number; emAndamento: number; prontos: number }[]
  >(Prisma.sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'PENDENTE')::int as pendentes,
      COUNT(*) FILTER (WHERE status = 'AGUARDANDO_APROVACAO')::int as "aguardandoAprovacao",
      COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO')::int as "emAndamento",
      COUNT(*) FILTER (WHERE status = 'PRONTO')::int as prontos
    FROM "Solicitacao"
    ${!podeGerenciarRequisicoes(usuario.role) ? Prisma.sql`WHERE "solicitanteUserId" = ${usuario.id}` : Prisma.empty}
  `)

  return NextResponse.json({
    requisicoes: pagina.map(mapearRequisicaoResumo),
    nextCursor,
    resumo: resumo ?? { total: 0, pendentes: 0, aguardandoAprovacao: 0, emAndamento: 0, prontos: 0 },
  })
}

// POST /api/requisicoes — criação por usuário autenticado.
//
// Dois casos:
// 1) Qualquer role cria PRA SI MESMO (comportamento padrão).
// 2) ALMOXARIFE+ lança EM NOME de uma pessoa atendida — pedido recebido
//    por WhatsApp, e-mail, telefone etc. Nesse caso `pessoaAtendidaId`
//    vem no corpo e o dono real vira a pessoa, não quem está logado;
//    guardamos quem lançou em `lancadoPorId` só pra rastreabilidade.
const criarRequisicaoAutenticadaSchema = criarRequisicaoBaseSchema.extend({
  pessoaAtendidaId: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard
  const usuario = guard.user

  const body = await request.json().catch(() => ({}))
  const parsed = criarRequisicaoAutenticadaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const { pessoaAtendidaId, ...dados } = parsed.data

  if (pessoaAtendidaId && !podeGerenciarRequisicoes(usuario.role)) {
    return NextResponse.json(
      { error: "Você não tem permissão para lançar uma requisição em nome de outra pessoa" },
      { status: 403 }
    )
  }

  try {
    const solicitacao = await criarRequisicao({
      dados,
      origem: "AUTENTICADO",
      ...(pessoaAtendidaId
        ? { pessoaAtendidaId, lancadoPorId: usuario.id }
        : { solicitanteUserId: usuario.id }),
    })
    return NextResponse.json({ requisicao: mapearRequisicaoResumo(solicitacao) }, { status: 201 })
  } catch (err) {
    if (err instanceof ErroRequisicao) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}

// =====================================================================
// mapeamento
// =====================================================================

function mapearRequisicaoResumo(r: any) {
  return {
    id: r.id,
    numero: r.numero,
    tipo: r.tipo,
    origem: r.origem,
    status: r.status,
    prioridade: r.prioridade,
    motivo: r.motivo,
    dataLimite: r.dataLimite,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    solicitante: r.solicitanteUser
      ? { tipo: "USUARIO" as const, id: r.solicitanteUser.id, nome: r.solicitanteUser.name, setor: r.solicitanteUser.setor, funcao: r.solicitanteUser.cargo }
      : r.pessoaAtendida
      ? { tipo: "PESSOA_ATENDIDA" as const, id: r.pessoaAtendida.id, nome: r.pessoaAtendida.nome, setor: r.pessoaAtendida.setor, funcao: r.pessoaAtendida.funcao }
      : null,
    lancadoPor: r.lancadoPor ? { id: r.lancadoPor.id, nome: r.lancadoPor.name } : null,
    itens: r.itens.map((i: any) => ({
      id: i.id,
      status: i.status,
      quantidade: Number(i.quantidade),
      requerAprovacaoSuperior: i.requerAprovacaoSuperior,
      material: i.material,
    })),
    totalItens: r.itens.length,
    agendamento: r.agendamento ?? null,
  }
}

export type RequisicaoListada = ReturnType<typeof mapearRequisicaoResumo>
