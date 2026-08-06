import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/require-role"
import { Prisma } from "@prisma/client"

const categoriaSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80),
  descricao: z.string().trim().max(300).optional().nullable(),
})

// GET /api/categorias?ativo=true&busca=eletrica
// Lista categorias disponíveis pra classificar materiais. Qualquer
// usuário autenticado pode ler (precisa pro dropdown do cadastro de material).
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const ativoParam = searchParams.get("ativo") // "true" | "false" | null (todas)
  const busca = searchParams.get("busca")?.trim()

  const where: Prisma.CategoriaWhereInput = {}

  if (ativoParam === "true") where.ativo = true
  if (ativoParam === "false") where.ativo = false

  if (busca) {
    where.nome = { contains: busca, mode: "insensitive" }
  }

  const categorias = await prisma.categoria.findMany({
    where,
    include: {
      _count: { select: { materiais: true } },
    },
    orderBy: { nome: "asc" },
  })

  return NextResponse.json({
    categorias: categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      descricao: c.descricao,
      ativo: c.ativo,
      createdAt: c.createdAt,
      totalMateriais: c._count.materiais,
    })),
  })
}

// POST /api/categorias
// Cria uma nova categoria. ADMIN, GESTOR, SUPERVISOR ou ALMOXARIFE.
export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = categoriaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const categoria = await prisma.categoria.create({
      data: {
        nome: parsed.data.nome,
        descricao: parsed.data.descricao || null,
      },
    })
    return NextResponse.json({ categoria }, { status: 201 })
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