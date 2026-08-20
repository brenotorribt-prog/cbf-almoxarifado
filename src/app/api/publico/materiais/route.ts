import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/publico/materiais?busca=parafuso — SEM autenticação.
// Só materiais ATIVO, só os campos necessários pra montar o carrinho da
// requisição pública (nada de fornecedor, código de barras, etc).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const busca = searchParams.get("busca")?.trim()

  if (!busca || busca.length < 2) {
    return NextResponse.json({ materiais: [] })
  }

  const materiais = await prisma.material.findMany({
    where: {
      situacao: "ATIVO",
      OR: [
        { nome: { contains: busca, mode: "insensitive" } },
        { codigoInterno: { contains: busca, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      nome: true,
      codigoInterno: true,
      requerAprovacao: true,
      unidadeMedida: { select: { sigla: true } },
      categoria: { select: { nome: true } },
    },
    orderBy: { nome: "asc" },
    take: 15,
  })

  return NextResponse.json({ materiais })
}
