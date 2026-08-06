import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { Prisma, Role, UserStatus } from "@prisma/client"

// GET /api/admin/usuarios?status=PENDENTE&role=ALMOXARIFE&busca=joao
// Lista usuários cadastrados no sistema. Somente ADMIN.
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") // PENDENTE | APROVADO | REJEITADO
  const role = searchParams.get("role")
  const busca = searchParams.get("busca")?.trim()

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

  const usuarios = await prisma.user.findMany({
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
      // pendentes primeiro, pra ficar fácil ver quem precisa de ação
      { status: "asc" },
      { createdAt: "desc" },
    ],
  })

  const resumo = {
    total: usuarios.length,
    pendentes: usuarios.filter((u) => u.status === "PENDENTE").length,
    aprovados: usuarios.filter((u) => u.status === "APROVADO").length,
    rejeitados: usuarios.filter((u) => u.status === "REJEITADO").length,
  }

  return NextResponse.json({ usuarios, resumo })
}