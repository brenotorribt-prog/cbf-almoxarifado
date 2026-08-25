import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const aprovadorId = guard.user.id

  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id },
    include: { material: true },
  })

  if (!emprestimo) {
    return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
  }
  if (emprestimo.status !== "PENDENTE_APROVACAO") {
    return NextResponse.json({ error: "Esse empréstimo não está pendente de aprovação" }, { status: 409 })
  }

  const estoqueAnterior = Number(emprestimo.material.estoqueAtual)
  const quantidade = Number(emprestimo.quantidade)
  const estoqueNovo = estoqueAnterior - quantidade

  // Como nada foi reservado na criação, o estoque pode ter acabado entre
  // o pedido e a aprovação — checa de novo aqui.
  if (estoqueNovo < 0) {
    return NextResponse.json({ error: "Estoque insuficiente no momento da aprovação" }, { status: 409 })
  }

  const agora = new Date()

  const [, , atualizado] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        materialId: emprestimo.materialId,
        tipo: "SAIDA",
        quantidade,
        quantidadeAnterior: estoqueAnterior,
        quantidadeAtual: estoqueNovo,
        motivo: `Empréstimo aprovado para ${emprestimo.solicitanteNome}`,
        usuarioId: aprovadorId,
        emprestimoId: emprestimo.id,
      },
    }),
    prisma.material.update({
      where: { id: emprestimo.materialId },
      data: { estoqueAtual: estoqueNovo },
    }),
    prisma.emprestimo.update({
      where: { id: emprestimo.id },
      data: { status: "EMPRESTADO", aprovadorId, dataAprovacao: agora },
      include: { material: { select: { id: true, nome: true } } },
    }),
  ])

  return NextResponse.json({ emprestimo: { ...atualizado, quantidade: Number(atualizado.quantidade) } })
}