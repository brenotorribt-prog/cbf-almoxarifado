import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"

const atualizarSchema = z.object({
  nome: z.string().trim().min(2).max(100).optional(),
  setor: z.string().trim().min(2).max(100).optional(),
  funcao: z.string().trim().min(2).max(100).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = atualizarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const pessoa = await prisma.pessoaAtendida.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ pessoa })
}

// Sem restrição de "está em uso" — diferente de Categoria/Unidade, essa
// pessoa não é referenciada por FK em lugar nenhum (o pedido guarda
// nome/setor/função como texto solto), então excluir aqui não quebra
// nenhum pedido já criado.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  await prisma.pessoaAtendida.delete({ where: { id } })
  return NextResponse.json({ sucesso: true })
}