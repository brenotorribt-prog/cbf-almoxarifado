import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/require-role"
import { createClient } from "@/lib/server"

const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres"),
})

export async function PATCH(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = trocarSenhaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { senhaAtual, novaSenha } = parsed.data
  const supabase = await createClient()

  // Revalida a senha atual tentando logar com ela (mesma garantia que o bcrypt.compare dava)
  const { error: erroSenhaAtual } = await supabase.auth.signInWithPassword({
    email: guard.user.email,
    password: senhaAtual,
  })
  if (erroSenhaAtual) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
  }

  const { error: erroUpdate } = await supabase.auth.updateUser({ password: novaSenha })
  if (erroUpdate) {
    return NextResponse.json({ error: "Erro ao trocar senha" }, { status: 500 })
  }

  return NextResponse.json({ sucesso: true })
}