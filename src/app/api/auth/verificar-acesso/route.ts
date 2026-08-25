import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const usuario = await prisma.user.findUnique({ where: { id: user.id } })
  if (!usuario || !usuario.ativo || usuario.status !== "APROVADO") {
    return NextResponse.json(
      { error: "Sua conta ainda não foi aprovada por um administrador" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true })
}