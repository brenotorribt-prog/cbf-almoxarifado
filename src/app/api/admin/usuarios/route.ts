import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { Prisma, Role, UserStatus } from "@prisma/client"

// GET /api/admin/usuarios?status=PENDENTE&role=ALMOXARIFE&busca=joao&page=1&limit=20
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
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

  const [usuarios, total] = await Promise.all([
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
  ])

  const resumo = {
    total,
    pendentes: await prisma.user.count({ where: { ...where, status: "PENDENTE" } }),
    aprovados: await prisma.user.count({ where: { ...where, status: "APROVADO" } }),
    rejeitados: await prisma.user.count({ where: { ...where, status: "REJEITADO" } }),
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