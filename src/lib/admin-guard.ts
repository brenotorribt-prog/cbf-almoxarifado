import { NextResponse } from "next/server"
import { createClient } from "@/lib/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

/**
 * Garante que a sessão atual pertence a um usuário com uma das roles permitidas.
 * Retorna o usuário se autorizado, ou uma NextResponse de erro.
 *
 * Uso:
 *   const guard = await requireRole(["ADMIN", "GESTOR"])
 *   if (guard instanceof NextResponse) return guard
 *   const user = guard
 */
export async function requireRole(rolesPermitidas: Role[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const usuario = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true }
  })

  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  if (!rolesPermitidas.includes(usuario.role)) {
    return NextResponse.json(
      { error: "Você não tem permissão para executar essa ação" },
      { status: 403 }
    )
  }

  return usuario
}

// Atalho para ADMIN
export async function requireAdmin() {
  return requireRole(["ADMIN"])
}