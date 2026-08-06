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