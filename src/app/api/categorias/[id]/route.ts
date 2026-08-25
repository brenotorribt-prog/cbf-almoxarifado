import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"
import { Prisma } from "@prisma/client"

const atualizarSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80).optional(),
  descricao: z.string().trim().max(300).optional().nullable(),
  ativo: z.boolean().optional(),
})

// PATCH /api/categorias/[id]
// Edita nome/descrição ou ativa/inativa a categoria. ADMIN, GESTOR, SUPERVISOR ou ALMOXARIFE.
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

  const categoriaExistente = await prisma.categoria.findUnique({ where: { id } })
  if (!categoriaExistente) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 })
  }

  try {
    const categoria = await prisma.categoria.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json({ categoria })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma categoria com esse nome" },
        { status: 409 }
      )
    }
    throw err
  }
}

// DELETE /api/categorias/[id]
// Só permite excluir se não houver nenhum material vinculado a essa
// categoria — caso contrário, orienta a inativar em vez de excluir.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params

  const categoria = await prisma.categoria.findUnique({
    where: { id },
    include: { _count: { select: { materiais: true } } },
  })

  if (!categoria) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 })
  }

  if (categoria._count.materiais > 0) {
    return NextResponse.json(
      {
        error: `Essa categoria tem ${categoria._count.materiais} material(is) vinculado(s) e não pode ser excluída. Inative-a em vez de excluir.`,
      },
      { status: 409 }
    )
  }

  await prisma.categoria.delete({ where: { id } })

  return NextResponse.json({ sucesso: true })
}