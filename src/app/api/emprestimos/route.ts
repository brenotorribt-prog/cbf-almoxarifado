import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth/require-role"
import { calcularEstoqueNovo } from "@/lib/estoque"
import { Prisma, StatusEmprestimo, Role } from "@prisma/client"
import { randomUUID } from "crypto"

const LIMIT_PADRAO = 30
const LIMIT_MAXIMO = 100
const PAPEIS_APROVADORES = new Set<Role>(["ADMIN", "GESTOR", "SUPERVISOR"])

// Sincronização preguiçosa EMPRESTADO -> ATRASADO, com throttle em memória
// (máx. 1x por minuto por processo). Preserva a regra da lista refletir
// atrasos sem depender de cron, sem pagar um UPDATE a cada request.
const INTERVALO_SYNC_ATRASADOS_MS = 60_000
let syncAtrasadosEm = 0

async function sincronizarAtrasados(): Promise<void> {
  const agoraMs = Date.now()
  if (agoraMs - syncAtrasadosEm < INTERVALO_SYNC_ATRASADOS_MS) return
  syncAtrasadosEm = agoraMs

  await prisma.emprestimo.updateMany({
    where: { status: "EMPRESTADO", dataPrevistaDevolucao: { lt: new Date() } },
    data: { status: "ATRASADO" },
  })
}

// GET /api/emprestimos?status=EMPRESTADO&materialId=xxx&loteId=xxx&cursor=xxx&limit=30
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") as StatusEmprestimo | null
  const materialId = searchParams.get("materialId")
  const loteId = searchParams.get("loteId")
  const cursor = searchParams.get("cursor")
  const limitParam = Number(searchParams.get("limit") ?? LIMIT_PADRAO)
  const limit = Math.min(Math.max(limitParam || LIMIT_PADRAO, 1), LIMIT_MAXIMO)

  // Sincroniza EMPRESTADO -> ATRASADO de forma preguiçosa, sem depender
  // só do cron diário pra refletir a realidade na lista.
  await sincronizarAtrasados()

  const where: Prisma.EmprestimoWhereInput = {}
  if (status && Object.values(StatusEmprestimo).includes(status)) where.status = status
  if (materialId) where.materialId = materialId
  if (loteId) where.loteId = loteId

  // Contagens do resumo + página — independentes, em paralelo.
  const [emprestados, atrasados, pendentesAprovacao, emprestimos] = await Promise.all([
    prisma.emprestimo.count({ where: { status: "EMPRESTADO" } }),
    prisma.emprestimo.count({ where: { status: "ATRASADO" } }),
    prisma.emprestimo.count({ where: { status: "PENDENTE_APROVACAO" } }),
    prisma.emprestimo.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        material: {
          select: {
            id: true,
            nome: true,
            codigoInterno: true,
            fotoUrl: true,
            unidadeMedida: { select: { sigla: true } },
          },
        },
        responsavel: { select: { id: true, name: true } },
        aprovador: { select: { id: true, name: true } },
      },
    }),
  ])

  const temMais = emprestimos.length > limit
  const pagina = temMais ? emprestimos.slice(0, limit) : emprestimos
  const nextCursor = temMais ? pagina[pagina.length - 1].id : null

  return NextResponse.json({
    emprestimos: pagina.map((e) => ({ ...e, quantidade: Number(e.quantidade) })),
    nextCursor,
    resumo: { 
      ativos: emprestados + atrasados, 
      atrasados, 
      pendentesAprovacao 
    },
  })
}

// POST /api/emprestimos
const itemSchema = z.object({
  materialId: z.string().min(1),
  quantidade: z.coerce.number().positive(),
})

const criarEmprestimoSchema = z.object({
  itens: z.array(itemSchema).min(1, "Selecione ao menos um item"),
  // Quem recebe vem SEMPRE do cadastro leve (PessoaAtendida), via
  // autocomplete — sem texto livre. Nome/setor/função são absorvidos do
  // cadastro no servidor e gravados como snapshot no empréstimo.
  pessoaAtendidaId: z.string().trim().min(1, "Selecione quem vai receber (cadastro de pessoas atendidas)"),
  dataPrevistaDevolucao: z.coerce.date(),
  observacoes: z.string().trim().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const responsavelId = guard.user.id
  const lancadorEhAprovador = PAPEIS_APROVADORES.has(guard.user.role)

  const body = await request.json().catch(() => ({}))
  const parsed = criarEmprestimoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const dados = parsed.data

  // A pessoa precisa existir no cadastro leve — nome/setor/função são
  // absorvidos dela, nunca aceitos como texto livre do payload.
  const pessoaAtendida = await prisma.pessoaAtendida.findUnique({
    where: { id: dados.pessoaAtendidaId },
    select: { id: true, nome: true, setor: true, funcao: true },
  })
  if (!pessoaAtendida) {
    return NextResponse.json(
      { error: "Pessoa atendida não encontrada. Selecione um cadastro existente." },
      { status: 400 }
    )
  }

  if (dados.dataPrevistaDevolucao <= new Date()) {
    return NextResponse.json(
      { error: "Data prevista de devolução deve ser no futuro" },
      { status: 400 }
    )
  }

  const materialIds = dados.itens.map((i) => i.materialId)
  if (new Set(materialIds).size !== materialIds.length) {
    return NextResponse.json(
      { error: "Não é possível emprestar o mesmo material duas vezes na mesma requisição" },
      { status: 400 }
    )
  }

  const materiais = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    include: { unidadeMedida: true },
  })
  if (materiais.length !== materialIds.length) {
    return NextResponse.json({ error: "Um ou mais materiais não foram encontrados" }, { status: 404 })
  }

  const materiaisPorId = new Map(materiais.map((m) => [m.id, m]))

  for (const item of dados.itens) {
    const material = materiaisPorId.get(item.materialId)!
    if (material.situacao === "INATIVO") {
      return NextResponse.json(
        { error: `"${material.nome}" está inativo e não pode ser emprestado` },
        { status: 409 }
      )
    }
    if (material.unidadeMedida.tipo === "INTEIRA" && item.quantidade % 1 !== 0) {
      return NextResponse.json(
        { error: `A unidade de "${material.nome}" não aceita valores fracionados.` },
        { status: 400 }
      )
    }
    // Item pendente de aprovação não reserva estoque, então não bloqueia
    // por saldo aqui — a checagem real acontece na aprovação.
    const precisaAprovacao = material.requerAprovacao && !lancadorEhAprovador
    if (!precisaAprovacao && Number(material.estoqueAtual) < item.quantidade) {
      return NextResponse.json({ error: `Estoque insuficiente de "${material.nome}"` }, { status: 409 })
    }
  }

  const loteId = dados.itens.length > 1 ? randomUUID() : null
  const agora = new Date()

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const criados = []

      for (const item of dados.itens) {
        const material = materiaisPorId.get(item.materialId)!
        const precisaAprovacao = material.requerAprovacao && !lancadorEhAprovador

        if (precisaAprovacao) {
          const emprestimo = await tx.emprestimo.create({
            data: {
              materialId: material.id,
              quantidade: item.quantidade,
              pessoaAtendidaId: pessoaAtendida.id,
              solicitanteNome: pessoaAtendida.nome,
              solicitanteSetor: pessoaAtendida.setor,
              solicitanteFuncao: pessoaAtendida.funcao,
              loteId,
              dataPrevistaDevolucao: dados.dataPrevistaDevolucao,
              observacoes: dados.observacoes || null,
              status: "PENDENTE_APROVACAO",
              aprovacaoNecessaria: true,
              responsavelId,
            },
          })
          criados.push(emprestimo)
          continue
        }

        const calculo = calcularEstoqueNovo("SAIDA", Number(material.estoqueAtual), item.quantidade)
        if (!calculo.ok) {
          throw new Error(`ESTOQUE_INSUFICIENTE:${material.nome}`)
        }
        const estoqueAnterior = Number(material.estoqueAtual)
        const estoqueNovo = calculo.estoqueNovo!

        const emprestimo = await tx.emprestimo.create({
          data: {
            materialId: material.id,
            quantidade: item.quantidade,
            pessoaAtendidaId: pessoaAtendida.id,
            solicitanteNome: pessoaAtendida.nome,
            solicitanteSetor: pessoaAtendida.setor,
            solicitanteFuncao: pessoaAtendida.funcao,
            loteId,
            dataPrevistaDevolucao: dados.dataPrevistaDevolucao,
            observacoes: dados.observacoes || null,
            status: "EMPRESTADO",
            aprovacaoNecessaria: material.requerAprovacao,
            // se pulou aprovação por já ser supervisor+, registra a
            // auto-aprovação — mantém o histórico honesto
            ...(material.requerAprovacao ? { aprovadorId: responsavelId, dataAprovacao: agora } : {}),
            responsavelId,
          },
        })

        await tx.movimentacaoEstoque.create({
          data: {
            materialId: material.id,
            tipo: "SAIDA",
            quantidade: item.quantidade,
            quantidadeAnterior: estoqueAnterior,
            quantidadeAtual: estoqueNovo,
            motivo: `Empréstimo para ${pessoaAtendida.nome}`,
            pessoaAtendidaId: pessoaAtendida.id,
            usuarioId: responsavelId,
            emprestimoId: emprestimo.id,
          },
        })

        await tx.material.update({
          where: { id: material.id },
          data: { estoqueAtual: estoqueNovo },
        })

        criados.push(emprestimo)
      }

      return criados
    })

    return NextResponse.json(
      { emprestimos: resultado.map((e) => ({ ...e, quantidade: Number(e.quantidade) })), loteId },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("ESTOQUE_INSUFICIENTE:")) {
      const nomeMaterial = err.message.split(":")[1]
      return NextResponse.json({ error: `Estoque insuficiente de "${nomeMaterial}"` }, { status: 409 })
    }
    throw err
  }
}