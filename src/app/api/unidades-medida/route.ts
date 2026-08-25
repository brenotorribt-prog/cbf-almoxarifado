import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth/require-role"
import { Prisma } from "@prisma/client"

const unidadeSchema = z.object({
  sigla: z.string().trim().min(1, "Sigla obrigatória").max(10),
  nome: z.string().trim().min(2, "Nome muito curto").max(60),
  tipo: z.enum(["INTEIRA", "FRACIONADA"]),
})

// GET /api/unidades-medida?busca=metro
// Qualquer autenticado pode ler — alimenta o dropdown do cadastro de material.
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const busca = searchParams.get("busca")?.trim()

  const unidadesMedida = await prisma.unidadeMedida.findMany({
    where: busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { sigla: { contains: busca, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { materiais: true } } },
    orderBy: { nome: "asc" },
  })

  return NextResponse.json({
    unidadesMedida: unidadesMedida.map((u) => ({
      id: u.id,
      sigla: u.sigla,
      nome: u.nome,
      tipo: u.tipo,
      createdAt: u.createdAt,
      totalMateriais: u._count.materiais,
    })),
  })
}

// POST /api/unidades-medida
export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = unidadeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const unidade = await prisma.unidadeMedida.create({ data: parsed.data })
    return NextResponse.json({ unidadeMedida: unidade }, { status: 201 })
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