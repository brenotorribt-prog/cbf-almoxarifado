import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"

const rejeitarSchema = z.object({
  motivoRejeicao: z.string().trim().min(3, "Informe o motivo da rejeição").max(300),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = rejeitarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const emprestimo = await prisma.emprestimo.findUnique({ where: { id } })
  if (!emprestimo) {
    return NextResponse.json({ error: "Empréstimo não encontrado" }, { status: 404 })
  }
  if (emprestimo.status !== "PENDENTE_APROVACAO") {
    return NextResponse.json({ error: "Esse empréstimo não está pendente de aprovação" }, { status: 409 })
  }

  // Nunca decrementou estoque (nasceu pendente sem reserva) — rejeitar é
  // só fechar o registro, sem movimentação nenhuma.
  const atualizado = await prisma.emprestimo.update({
    where: { id },
    data: {
      status: "REJEITADO",
      aprovadorId: guard.user.id,
      dataAprovacao: new Date(),
      motivoRejeicao: parsed.data.motivoRejeicao,
    },
  })

  return NextResponse.json({ emprestimo: { ...atualizado, quantidade: Number(atualizado.quantidade) } })
}