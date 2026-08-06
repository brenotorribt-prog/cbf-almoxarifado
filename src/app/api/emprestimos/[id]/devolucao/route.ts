import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/require-role"

// Devolução é sempre total — o controle por item já resolve "devolver só
// uma parte" (cada material tem seu próprio Emprestimo isolado).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const usuarioId = guard.user.id

  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id },
    include: {
      material: true,
      movimentacoes: { where: { tipo: "SAIDA" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!emprestimo) {
    return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
  }
  if (emprestimo.status !== "EMPRESTADO" && emprestimo.status !== "ATRASADO") {
    return NextResponse.json({ error: "Esse empréstimo não está em aberto pra devolução" }, { status: 409 })
  }

  const estoqueAnterior = Number(emprestimo.material.estoqueAtual)
  const quantidade = Number(emprestimo.quantidade)
  const estoqueNovo = estoqueAnterior + quantidade
  const agora = new Date()
  const movimentacaoSaida = emprestimo.movimentacoes[0] ?? null

  const [, , atualizado] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        materialId: emprestimo.materialId,
        tipo: "ENTRADA",
        quantidade,
        quantidadeAnterior: estoqueAnterior,
        quantidadeAtual: estoqueNovo,
        motivo: `Devolução de empréstimo de ${emprestimo.solicitanteNome}`,
        usuarioId,
        emprestimoId: emprestimo.id,
        movimentacaoOrigemId: movimentacaoSaida?.id ?? null,
      },
    }),
    prisma.material.update({
      where: { id: emprestimo.materialId },
      data: { estoqueAtual: estoqueNovo },
    }),
    prisma.emprestimo.update({
      where: { id: emprestimo.id },
      data: { status: "DEVOLVIDO", dataDevolucao: agora },
      include: { material: { select: { id: true, nome: true } } },
    }),
  ])

  return NextResponse.json({ emprestimo: { ...atualizado, quantidade: Number(atualizado.quantidade) } })
}