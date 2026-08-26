import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth/require-role"
import { Prisma, TipoMovimentacao } from "@prisma/client"

const LIMIT_PADRAO = 30
const LIMIT_MAXIMO = 100

// GET /api/movimentacoes?materialId=xxx&tipo=ENTRADA&cursor=xxx&limit=30
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const materialId = searchParams.get("materialId")
  const tipo = searchParams.get("tipo") as TipoMovimentacao | null
  const cursor = searchParams.get("cursor")
  const limitParam = Number(searchParams.get("limit") ?? LIMIT_PADRAO)
  const limit = Math.min(Math.max(limitParam || LIMIT_PADRAO, 1), LIMIT_MAXIMO)

  // Contagem de movimentações de hoje + pagina — independentes, em paralelo.
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)

  const where: Prisma.MovimentacaoEstoqueWhereInput = {}
  if (materialId) where.materialId = materialId
  if (tipo && Object.values(TipoMovimentacao).includes(tipo)) where.tipo = tipo

  const [totalHoje, movimentacoes] = await Promise.all([
    prisma.movimentacaoEstoque.count({
      where: { createdAt: { gte: inicioHoje } },
    }),
    prisma.movimentacaoEstoque.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        material: { select: { id: true, nome: true, codigoInterno: true } },
        usuario: { select: { id: true, name: true } },
      },
    }),
  ])

  const temMais = movimentacoes.length > limit
  const pagina = temMais ? movimentacoes.slice(0, limit) : movimentacoes
  const nextCursor = temMais ? pagina[pagina.length - 1].id : null

  return NextResponse.json({
    movimentacoes: pagina.map((m) => ({
      ...m,
      quantidade: Number(m.quantidade),
      quantidadeAnterior: Number(m.quantidadeAnterior),
      quantidadeAtual: Number(m.quantidadeAtual),
    })),
    nextCursor,
    resumo: { totalHoje },
  })
}

// POST /api/movimentacoes
// Empréstimo e devolução têm rota própria (/api/emprestimos/*) porque
// carregam campos que essa tabela não tem (responsável, prazo, aprovação).
const movimentacaoSchema = z.object({
  materialId: z.string().min(1),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
  // ENTRADA/SAIDA: delta a somar/subtrair. AJUSTE: valor ABSOLUTO final.
  quantidade: z.coerce.number(),
  motivo: z.string().trim().min(1, "Motivo é obrigatório").max(300),
  documentoReferencia: z.string().trim().max(100).optional().nullable(),
  // Quem pediu/recebeu vem SEMPRE do cadastro leve (PessoaAtendida), via
  // autocomplete — não existe mais texto livre. Obrigatório na SAÍDA.
  // Nome/setor/função são absorvidos do cadastro no servidor (snapshot);
  // o payload nunca envia esses três campos.
  pessoaAtendidaId: z.string().trim().min(1).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const usuarioId = guard.user.id

  const body = await request.json().catch(() => ({}))
  const parsed = movimentacaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const dados = parsed.data

  // Pessoa do cadastro leve: SAÍDA exige; nos demais tipos é opcional
  // (ex.: devolução avulsa de alguém cadastrado). O snapshot
  // nome/setor/função sai SEMPRE do cadastro — nunca do payload.
  let pessoaAtendida: { id: string; nome: string; setor: string; funcao: string } | null = null
  if (dados.pessoaAtendidaId) {
    const encontrada = await prisma.pessoaAtendida.findUnique({
      where: { id: dados.pessoaAtendidaId },
      select: { id: true, nome: true, setor: true, funcao: true },
    })
    if (!encontrada) {
      return NextResponse.json(
        { error: "Pessoa atendida não encontrada. Selecione um cadastro existente." },
        { status: 400 }
      )
    }
    pessoaAtendida = encontrada
  }
  if (dados.tipo === "SAIDA" && !pessoaAtendida) {
    return NextResponse.json(
      { error: "Saídas exigem selecionar quem está recebendo o material (pessoa do cadastro de pessoas atendidas)." },
      { status: 400 }
    )
  }

  if (dados.tipo !== "AJUSTE" && dados.quantidade <= 0) {
    return NextResponse.json({ error: "Quantidade deve ser maior que zero" }, { status: 400 })
  }

  const material = await prisma.material.findUnique({
    where: { id: dados.materialId },
    include: { unidadeMedida: true },
  })
  if (!material) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  }

  if (material.unidadeMedida.tipo === "INTEIRA" && dados.quantidade % 1 !== 0) {
    return NextResponse.json(
      { error: `A unidade "${material.unidadeMedida.nome}" não aceita valores fracionados.` },
      { status: 400 }
    )
  }

  const estoqueAnterior = Number(material.estoqueAtual)
  let estoqueNovo: number

  if (dados.tipo === "ENTRADA") {
    estoqueNovo = estoqueAnterior + dados.quantidade
  } else if (dados.tipo === "SAIDA") {
    estoqueNovo = estoqueAnterior - dados.quantidade
    if (estoqueNovo < 0) {
      return NextResponse.json({ error: "Estoque insuficiente para essa saída" }, { status: 409 })
    }
  } else {
    estoqueNovo = dados.quantidade
    if (estoqueNovo < 0) {
      return NextResponse.json({ error: "Estoque ajustado não pode ser negativo" }, { status: 400 })
    }
  }

  // Pra AJUSTE, grava a diferença real (pode ser negativa) — mantém o
  // histórico legível em vez de mostrar o valor absoluto no campo `quantidade`.
  const deltaRegistrado = dados.tipo === "AJUSTE" ? estoqueNovo - estoqueAnterior : dados.quantidade

  const [movimentacao] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        materialId: material.id,
        tipo: dados.tipo as TipoMovimentacao,
        quantidade: deltaRegistrado,
        quantidadeAnterior: estoqueAnterior,
        quantidadeAtual: estoqueNovo,
        motivo: dados.motivo,
        documentoReferencia: dados.documentoReferencia || null,
        ...(pessoaAtendida
          ? {
              pessoaAtendidaId: pessoaAtendida.id,
              solicitanteNome: pessoaAtendida.nome,
              solicitanteSetor: pessoaAtendida.setor,
              solicitanteFuncao: pessoaAtendida.funcao,
            }
          : {}),
        usuarioId,
      },
    }),
    prisma.material.update({
      where: { id: material.id },
      data: { estoqueAtual: estoqueNovo },
    }),
  ])

  return NextResponse.json(
    {
      movimentacao: {
        ...movimentacao,
        quantidade: Number(movimentacao.quantidade),
        quantidadeAnterior: Number(movimentacao.quantidadeAnterior),
        quantidadeAtual: Number(movimentacao.quantidadeAtual),
      },
    },
    { status: 201 }
  )
}