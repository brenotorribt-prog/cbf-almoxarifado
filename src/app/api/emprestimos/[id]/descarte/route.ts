import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"

const descarteSchema = z.object({
  motivo: z.string().trim().min(3, "Informe o motivo do descarte/perda").max(300),
})

// Fecha a conta de um item que NÃO vai voltar. Não mexe em estoqueAtual
// de novo — o item já saiu do estoque quando o empréstimo foi criado.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const usuarioId = guard.user.id

  const body = await request.json().catch(() => ({}))
  const parsed = descarteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id },
    include: { material: true },
  })

  if (!emprestimo) {
    return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
  }
  if (emprestimo.status !== "EMPRESTADO" && emprestimo.status !== "ATRASADO") {
    return NextResponse.json({ error: "Esse empréstimo não está em aberto" }, { status: 409 })
  }

  const estoqueAtual = Number(emprestimo.material.estoqueAtual)

  const [, atualizado] = await prisma.$transaction([
    prisma.movimentacaoEstoque.create({
      data: {
        materialId: emprestimo.materialId,
        tipo: "DESCARTE",
        quantidade: Number(emprestimo.quantidade),
        quantidadeAnterior: estoqueAtual,
        quantidadeAtual: estoqueAtual, // não muda — item já estava fora
        motivo: parsed.data.motivo,
        usuarioId,
        emprestimoId: emprestimo.id,
      },
    }),
    prisma.emprestimo.update({
      where: { id: emprestimo.id },
      data: { status: "PERDIDO", observacoes: parsed.data.motivo },
      include: { material: { select: { id: true, nome: true } } },
    }),
  ])

  return NextResponse.json({ emprestimo: { ...atualizado, quantidade: Number(atualizado.quantidade) } })
}