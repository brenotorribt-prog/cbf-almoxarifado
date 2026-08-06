import { auth } from "@/auth"
import { NextResponse } from "next/server"

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