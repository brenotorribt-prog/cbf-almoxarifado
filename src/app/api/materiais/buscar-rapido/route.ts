import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth/require-role"

const LIMIT_PADRAO = 8
const LIMIT_MAXIMO = 15

// GET /api/materiais/buscar-rapido?q=parafuso&limit=8
// Autocomplete leve pra modais (nova movimentação, empréstimo). Só retorna
// materiais ATIVOS — não faz sentido lançar movimentação/empréstimo em
// item inativo. Sem resumo, sem cursor, sem $queryRaw — rota pensada pra
// responder rápido a cada tecla digitada.
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const termo = searchParams.get("q")?.trim()
  const limitParam = Number(searchParams.get("limit") ?? LIMIT_PADRAO)
  const limit = Math.min(Math.max(limitParam || LIMIT_PADRAO, 1), LIMIT_MAXIMO)

  if (!termo || termo.length < 2) {
    return NextResponse.json({ materiais: [] })
  }

  const materiais = await prisma.material.findMany({
    where: {
      situacao: "ATIVO",
      OR: [
        { nome: { contains: termo, mode: "insensitive" } },
        { codigoInterno: { contains: termo, mode: "insensitive" } },
        { marca: { contains: termo, mode: "insensitive" } },
        { modelo: { contains: termo, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      codigoInterno: true,
      estoqueAtual: true,
      requerAprovacao: true,
      unidadeMedida: { select: { id: true, sigla: true, nome: true, tipo: true } },
    },
  })

  return NextResponse.json({
    materiais: materiais.map((m) => ({
      ...m,
      estoqueAtual: Number(m.estoqueAtual),
    })),
  })
}