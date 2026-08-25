import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"
import { Prisma } from "@prisma/client"

const atualizarSchema = z.object({
  sigla: z.string().trim().min(1).max(10).optional(),
  nome: z.string().trim().min(2).max(60).optional(),
  tipo: z.enum(["INTEIRA", "FRACIONADA"]).optional(),
})

// PATCH /api/unidades-medida/[id]
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

  const existente = await prisma.unidadeMedida.findUnique({ where: { id } })
  if (!existente) {
    return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 })
  }

  try {
    const unidade = await prisma.unidadeMedida.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ unidadeMedida: unidade })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma unidade com essa sigla" },
        { status: 409 }
      )
    }
    throw err
  }
}

// DELETE /api/unidades-medida/[id]
// Sem soft-disable: unidade só sai do sistema se ninguém a estiver usando.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params

  const unidade = await prisma.unidadeMedida.findUnique({
    where: { id },
    include: { _count: { select: { materiais: true } } },
  })
  if (!unidade) {
    return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 })
  }
  if (unidade._count.materiais > 0) {
    return NextResponse.json(
      {
        error: `Essa unidade está em uso por ${unidade._count.materiais} material(is) e não pode ser excluída.`,
      },
      { status: 409 }
    )
  }

  await prisma.unidadeMedida.delete({ where: { id } })
  return NextResponse.json({ sucesso: true })
}