import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-role"
import { podeGerenciarRequisicoes } from "@/lib/requisicoes-helpers"
import { Prisma } from "@prisma/client"

export async function GET() {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const usuario = guard.user
  const gestor = podeGerenciarRequisicoes(usuario.role)

  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)

  // Sincroniza empréstimos atrasados (mesma lógica da rota de empréstimos)
  await prisma.emprestimo.updateMany({
    where: { status: "EMPRESTADO", dataPrevistaDevolucao: { lt: new Date() } },
    data: { status: "ATRASADO" },
  })

  const [
    materiaisResumo,
    requisicoesResumo,
    emprestados,
    atrasados,
    pendentesAprovacaoEmprestimo,
    totalMovimentacoesHoje,
    comprasResumo,
    categoriasTotal,
    materiaisEstoqueBaixo,
    requisicoesRecentes,
    movimentacoesRecentes,
    usuariosPendentes,
  ] = await Promise.all([
    prisma.$queryRaw<
      { total: number; inativos: number; estoqueBaixo: number; estoqueAlto: number }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE situacao = 'INATIVO')::int as inativos,
        COUNT(*) FILTER (WHERE "estoqueAtual" < "estoqueMinimo")::int as "estoqueBaixo",
        COUNT(*) FILTER (WHERE "estoqueAtual" > "estoqueMaximo")::int as "estoqueAlto"
      FROM "Material"
    `),

    prisma.$queryRaw<
      { total: number; pendentes: number; aguardandoAprovacao: number; emAndamento: number; prontos: number }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'PENDENTE')::int as pendentes,
        COUNT(*) FILTER (WHERE status = 'AGUARDANDO_APROVACAO')::int as "aguardandoAprovacao",
        COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO')::int as "emAndamento",
        COUNT(*) FILTER (WHERE status = 'PRONTO')::int as prontos
      FROM "Solicitacao"
      ${!gestor ? Prisma.sql`WHERE "solicitanteUserId" = ${usuario.id}` : Prisma.empty}
    `),

    prisma.emprestimo.count({ where: { status: "EMPRESTADO" } }),
    prisma.emprestimo.count({ where: { status: "ATRASADO" } }),
    prisma.emprestimo.count({ where: { status: "PENDENTE_APROVACAO" } }),

    prisma.movimentacaoEstoque.count({ where: { createdAt: { gte: inicioHoje } } }),

    prisma.$queryRaw<
      { abertos: number; parciais: number; orcando: number; aguardandoEntrega: number }[]
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM "PedidoCompra" WHERE status = 'ABERTO') as abertos,
        (SELECT COUNT(*)::int FROM "PedidoCompra" WHERE status = 'PARCIALMENTE_RECEBIDO') as parciais,
        (SELECT COUNT(*)::int FROM "ItemPedidoCompra" i
          JOIN "PedidoCompra" p ON p.id = i."pedidoId"
          WHERE i.status = 'ORCANDO' AND p.status NOT IN ('CONCLUIDO', 'CANCELADO')) as orcando,
        (SELECT COUNT(*)::int FROM "ItemPedidoCompra" i
          JOIN "PedidoCompra" p ON p.id = i."pedidoId"
          WHERE i.status = 'AGUARDANDO_ENTREGA' AND p.status NOT IN ('CONCLUIDO', 'CANCELADO')) as "aguardandoEntrega"
    `),

    prisma.categoria.count(),

    prisma.$queryRaw<
      {
        id: string
        nome: string
        codigoInterno: string
        estoqueAtual: number
        estoqueMinimo: number
        unidadeSigla: string
      }[]
    >(Prisma.sql`
      SELECT m.id, m.nome, m."codigoInterno",
        m."estoqueAtual"::float as "estoqueAtual",
        m."estoqueMinimo"::float as "estoqueMinimo",
        u.sigla as "unidadeSigla"
      FROM "Material" m
      JOIN "UnidadeMedida" u ON u.id = m."unidadeMedidaId"
      WHERE m.situacao = 'ATIVO' AND m."estoqueAtual" < m."estoqueMinimo"
      ORDER BY m."estoqueAtual" ASC
      LIMIT 5
    `),

    prisma.solicitacao.findMany({
      where: gestor
        ? { status: { in: ["PENDENTE", "AGUARDANDO_APROVACAO", "EM_ANDAMENTO", "PRONTO"] } }
        : {
            solicitanteUserId: usuario.id,
            status: { in: ["PENDENTE", "AGUARDANDO_APROVACAO", "EM_ANDAMENTO", "PRONTO"] },
          },
      select: {
        id: true,
        numero: true,
        tipo: true,
        status: true,
        prioridade: true,
        createdAt: true,
        solicitanteUser: { select: { name: true } },
        pessoaAtendida: { select: { nome: true } },
        _count: { select: { itens: true } },
      },
      orderBy: [{ prioridade: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),

    gestor
      ? prisma.movimentacaoEstoque.findMany({
          select: {
            id: true,
            tipo: true,
            quantidade: true,
            createdAt: true,
            material: { select: { nome: true, codigoInterno: true } },
            usuario: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),

    usuario.role === "ADMIN"
      ? prisma.user.count({ where: { status: "PENDENTE" } })
      : Promise.resolve(0),
  ])

  const materiais = materiaisResumo[0] ?? { total: 0, inativos: 0, estoqueBaixo: 0, estoqueAlto: 0 }
  const requisicoes = requisicoesResumo[0] ?? {
    total: 0,
    pendentes: 0,
    aguardandoAprovacao: 0,
    emAndamento: 0,
    prontos: 0,
  }
  const compras = comprasResumo[0] ?? { abertos: 0, parciais: 0, orcando: 0, aguardandoEntrega: 0 }

  const estoqueBaixo = materiaisEstoqueBaixo.map((m) => ({
    id: m.id,
    nome: m.nome,
    codigoInterno: m.codigoInterno,
    estoqueAtual: Number(m.estoqueAtual),
    estoqueMinimo: Number(m.estoqueMinimo),
    unidadeSigla: m.unidadeSigla,
  }))

  return NextResponse.json({
    usuario: { nome: usuario.name, role: usuario.role },
    materiais: {
      total: materiais.total,
      inativos: materiais.inativos,
      estoqueBaixo: materiais.estoqueBaixo,
      estoqueAlto: materiais.estoqueAlto,
    },
    requisicoes: {
      total: requisicoes.total,
      pendentes: requisicoes.pendentes,
      aguardandoAprovacao: requisicoes.aguardandoAprovacao,
      emAndamento: requisicoes.emAndamento,
      prontos: requisicoes.prontos,
    },
    emprestimos: {
      ativos: emprestados + atrasados,
      atrasados,
      pendentesAprovacao: pendentesAprovacaoEmprestimo,
    },
    movimentacoes: { totalHoje: totalMovimentacoesHoje },
    compras: {
      abertos: compras.abertos,
      parciais: compras.parciais,
      orcando: compras.orcando,
      aguardandoEntrega: compras.aguardandoEntrega,
    },
    cadastros: { categorias: categoriasTotal },
    admin: usuario.role === "ADMIN" ? { usuariosPendentes } : null,
    alertas: { materiaisEstoqueBaixo: estoqueBaixo },
    recentes: {
      requisicoes: requisicoesRecentes.map((r) => ({
        id: r.id,
        numero: r.numero,
        tipo: r.tipo,
        status: r.status,
        prioridade: r.prioridade,
        createdAt: r.createdAt,
        solicitante: r.solicitanteUser?.name ?? r.pessoaAtendida?.nome ?? "—",
        totalItens: r._count.itens,
      })),
      movimentacoes: movimentacoesRecentes.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        quantidade: Number(m.quantidade),
        createdAt: m.createdAt,
        material: m.material,
        usuario: m.usuario,
      })),
    },
  })
}
