import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/require-role"

// GET /api/pessoas-atendidas?busca=breno — autocomplete pro campo
// solicitante do pedido de compra.
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const busca = searchParams.get("busca")?.trim()

  const pessoas = await prisma.pessoaAtendida.findMany({
    where: busca ? { nome: { contains: busca, mode: "insensitive" } } : undefined,
    orderBy: { nome: "asc" },
    take: 15,
  })

  return NextResponse.json({ pessoas })
}

const pessoaSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100),
  setor: z.string().trim().min(2, "Setor muito curto").max(100),
  funcao: z.string().trim().min(2, "Função muito curta").max(100),
})

// POST /api/pessoas-atendidas — cadastro manual (tela /categorias) OU
// chamado internamente ao criar um pedido de compra com pessoa nova.
export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = pessoaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // evita duplicar a mesma pessoa se ela já existir com nome+setor+função
  // idênticos (comparação case-insensitive)
  const existente = await prisma.pessoaAtendida.findFirst({
    where: {
      nome: { equals: parsed.data.nome, mode: "insensitive" },
      setor: { equals: parsed.data.setor, mode: "insensitive" },
      funcao: { equals: parsed.data.funcao, mode: "insensitive" },
    },
  })
  if (existente) {
    return NextResponse.json({ pessoa: existente }, { status: 200 })
  }

  const pessoa = await prisma.pessoaAtendida.create({ data: parsed.data })
  return NextResponse.json({ pessoa }, { status: 201 })
}