// lib/require-role.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

/**
 * Garante que a sessão atual pertence a um usuário autenticado.
 * Use isoladamente quando a rota só precisa checar login (ex: GET de leitura).
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  return session
}

/**
 * Garante que a sessão atual pertence a um usuário com uma das roles
 * permitidas. Retorna a sessão se autorizado, ou uma NextResponse de
 * erro pronta pra devolver direto na rota.
 *
 * Uso:
 *   const guard = await requireRole(["ADMIN", "GESTOR"])
 *   if (guard instanceof NextResponse) return guard
 *   const session = guard
 */
export async function requireRole(rolesPermitidas: Role[]) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  if (!rolesPermitidas.includes(session.user.role)) {
    return NextResponse.json(
      { error: "Você não tem permissão para executar essa ação" },
      { status: 403 }
    )
  }

  return session
}

/**
 * Garante que a sessão atual pertence a um usuário com role ADMIN.
 * Retorna a sessão se autorizado, ou uma NextResponse de erro pronta
 * pra ser devolvida direto na rota (return early pattern).
 *
 * Uso:
 *   const guard = await requireAdmin()
 *   if (guard instanceof NextResponse) return guard
 *   const session = guard
 */
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito a administradores" },
      { status: 403 }
    )
  }

  return session
}