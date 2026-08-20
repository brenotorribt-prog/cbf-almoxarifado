import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/publico/pessoas-atendidas?busca=joao — SEM autenticação.
// Autocomplete do formulário público. Só devolve o mínimo necessário pra
// identificar a pessoa (nome/setor/função) — nada de dado sensível.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busca = searchParams.get("busca")?.trim()

  if (!busca || busca.length < 2) {
    return NextResponse.json({ pessoas: [] })
  }

  const pessoas = await prisma.pessoaAtendida.findMany({
    where: { nome: { contains: busca, mode: "insensitive" } },
    select: { id: true, nome: true, setor: true, funcao: true },
    orderBy: { nome: "asc" },
    take: 10,
  })

  return NextResponse.json({ pessoas })
}
