import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-role"

const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres"),
})

// PATCH /api/perfil/senha — exige a senha atual antes de trocar. Sem essa
// checagem, qualquer sessão aberta (ex: esquecida em outro dispositivo)
// conseguiria trocar a senha sem saber a antiga.
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

  const usuario = await prisma.user.findUnique({ where: { id: guard.user.id } })
  if (!usuario || !usuario.password) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  const senhaValida = await bcrypt.compare(senhaAtual, usuario.password)
  if (!senhaValida) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
  }

  const novoHash = await bcrypt.hash(novaSenha, 10)
  await prisma.user.update({
    where: { id: guard.user.id },
    data: { password: novoHash },
  })

  return NextResponse.json({ sucesso: true })
}