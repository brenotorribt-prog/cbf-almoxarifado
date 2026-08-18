import { NextResponse } from "next/server"
import { createClient } from "@/lib/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const usuario = await prisma.user.findUnique({ where: { id: user.id } })
  return usuario
}

export async function requireAuth() {
  const usuario = await getSessionUser()
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  return { user: usuario }
}

export async function requireRole(rolesPermitidas: Role[]) {
  const usuario = await getSessionUser()
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  if (!rolesPermitidas.includes(usuario.role)) {
    return NextResponse.json(
      { error: "Você não tem permissão para executar essa ação" },
      { status: 403 }
    )
  }
  return { user: usuario }
}

export async function requireAdmin() {
  return requireRole(["ADMIN"])
}