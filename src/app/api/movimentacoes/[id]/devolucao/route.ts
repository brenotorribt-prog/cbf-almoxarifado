// src/app/api/movimentacoes/[id]/devolucao/route.ts
//
// POST /api/movimentacoes/[id]/devolucao  body: { quantidade?: number }
//
// Devolução AVULSA de sobrante: a pessoa pegou um material marcado como
// consumo (ou sem empréstimo vinculado), não usou (total ou parcialmente)
// e devolve pro almoxarifado.
//
// Cria uma ENTRADA vinculada à SAÍDA original via movimentacaoOrigemId
// (mesmo vínculo usado pela devolução de empréstimo), devolve o estoque e
// copia os dados do solicitante da saída original pra manter o rastro por
// pessoa nos relatórios.
//
// Quando a saída tem empréstimo EM ABERTO, rejeita e manda usar a rota
// própria de devolução de empréstimo (/api/emprestimos/[id]/devolucao),
// que é sempre total e atualiza o status do empréstimo.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"

const bodySchema = z.object({
  quantidade: z.coerce.number().positive().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard
  const usuarioId = guard.user.id

  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 })
  }

  const saida = await prisma.movimentacaoEstoque.findUnique({
    where: { id },
    include: {
      material: true,
      emprestimo: true,
      devolucoes: { where: { tipo: "ENTRADA" } },
    },
  })

  if (!saida) {
    return NextResponse.json({ error: "Movimentação não encontrada" }, { status: 404 })
  }

  if (saida.tipo !== "SAIDA") {
    return NextResponse.json(
      { error: "Só é possível registrar devolução sobre uma saída." },
      { status: 400 }
    )
  }

  if (!saida.solicitanteNome) {
    return NextResponse.json(
      { error: "Essa saída não tem solicitante identificado — nada a devolver." },
      { status: 400 }
    )
  }

  // Empréstimo em aberto? A devolução dele é TOTAL e passa pela rota
  // própria (que também fecha o status do empréstimo).
  if (
    saida.emprestimo &&
    (saida.emprestimo.status === "EMPRESTADO" || saida.emprestimo.status === "ATRASADO")
  ) {
    return NextResponse.json(
      {
        error:
          "Essa saída tem um empréstimo em aberto. Use a devolução de empréstimo para devolvê-la.",
        emprestimoId: saida.emprestimo.id,
      },
      { status: 409 }
    )
  }

  // Já devolvido = soma das ENTRADAS vinculadas a esta saída como origem
  // (cobre tanto devolução de empréstimo quanto devoluções avulsas anteriores).
  const jaDevolvido = saida.devolucoes.reduce((acc, d) => acc + Number(d.quantidade), 0)
  const quantidadeOriginal = Number(saida.quantidade)
  const restante = quantidadeOriginal - jaDevolvido

  if (restante <= 0) {
    return NextResponse.json(
      { error: "Essa saída já foi totalmente devolvida." },
      { status: 409 }
    )
  }

  const quantidade = parsed.data.quantidade ?? restante
  if (quantidade > restante) {
    return NextResponse.json(
      { error: `Quantidade excede o restante a devolver (${restante}).` },
      { status: 400 }
    )
  }

  const estoqueAnterior = Number(saida.material.estoqueAtual)
  const estoqueNovo = estoqueAnterior + quantidade

  const [devolucaoCriada] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        materialId: saida.materialId,
        tipo: "ENTRADA",
        quantidade,
        quantidadeAnterior: estoqueAnterior,
        quantidadeAtual: estoqueNovo,
        motivo: `Devolução de ${saida.solicitanteNome} — material não utilizado`,
        // Copia o solicitante da saída original: mantém o rastro por pessoa
        // no relatório de estoque pessoal mesmo sem join adicional.
        solicitanteNome: saida.solicitanteNome,
        solicitanteSetor: saida.solicitanteSetor,
        solicitanteFuncao: saida.solicitanteFuncao,
        usuarioId,
        movimentacaoOrigemId: saida.id,
      },
    }),
    prisma.material.update({
      where: { id: saida.materialId },
      data: { estoqueAtual: estoqueNovo },
    }),
  ])

  return NextResponse.json({
    devolucao: { ...devolucaoCriada, quantidade: Number(devolucaoCriada.quantidade) },
    restanteNaSaida: restante - quantidade,
  })
}