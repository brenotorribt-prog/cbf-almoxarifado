import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"
import { Prisma, Role, UserStatus } from "@prisma/client"

// GET /api/admin/usuarios?status=PENDENTE&role=ALMOXARIFE&busca=joao&page=1&limit=20
export async function GET(request: NextRequest) {
  const guard = await requireRole(["ADMIN"])
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const role = searchParams.get("role")
  const busca = searchParams.get("busca")?.trim()
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const skip = (page - 1) * limit

  const where: Prisma.UserWhereInput = {}

  if (status && Object.values(UserStatus).includes(status as UserStatus)) {
    where.status = status as UserStatus
  }

  if (role && Object.values(Role).includes(role as Role)) {
    where.role = role as Role
  }

  if (busca) {
    where.OR = [
      { name: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
      { setor: { contains: busca, mode: "insensitive" } },
    ]
  }

  // Página + total + contagem por status — tudo em paralelo. O resumo
  // substitui 3 counts sequenciais por um único groupBy, mantendo a mesma
  // semântica de filtro (o `where` de busca continua valendo; só o status
  // é liberado pra agrupar).
  const [usuarios, total, contagensPorStatus] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        ativo: true,
        setor: true,
        cargo: true,
        telefone: true,
        createdAt: true,
        dataAprovacao: true,
        motivoRejeicao: true,
        aprovadoPor: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { ...where, status: undefined },
    }),
  ])

  const totalPorStatus = new Map(contagensPorStatus.map((r) => [r.status, r._count._all]))

  const resumo = {
    total,
    pendentes: totalPorStatus.get("PENDENTE") ?? 0,
    aprovados: totalPorStatus.get("APROVADO") ?? 0,
    rejeitados: totalPorStatus.get("REJEITADO") ?? 0,
  }

  return NextResponse.json({ 
    usuarios, 
    resumo,
    paginacao: {
      pagina: page,
      limite: limit,
      total,
      totalPaginas: Math.ceil(total / limit),
    }
  })
}