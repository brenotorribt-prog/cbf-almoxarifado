import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-role"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2"

// GET /api/perfil — dados do próprio usuário logado.
// A sessão JWT só carrega id/name/email/role/image; nome, sobrenome e
// telefone não estão lá, então o modal busca aqui ao abrir.
export async function GET() {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const usuario = await prisma.user.findUnique({
    where: { id: guard.user.id },
    select: {
      id: true,
      nome: true,
      sobrenome: true,
      email: true,
      telefone: true,
      cargo: true,
      setor: true,
      role: true,
      image: true,
    },
  })

  if (!usuario) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ usuario })
}

// PATCH /api/perfil — edição de dados cadastrais próprios (não senha,
// não email). `name` é recalculado a partir de nome+sobrenome pra manter
// consistência, já que o NextAuth usa esse campo em vários lugares.
const editarPerfilSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(60).optional(),
  sobrenome: z.string().trim().min(1, "Sobrenome muito curto").max(60).optional(),
  telefone: z.string().trim().max(20).optional().nullable(),
  // "" = remover avatar; url válida = trocar; undefined = não tocar
  avatarUrl: z.string().url().or(z.literal("")).optional(),
})

export async function PATCH(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = editarPerfilSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const dados = parsed.data

  const usuarioAtual = await prisma.user.findUnique({ where: { id: guard.user.id } })
  if (!usuarioAtual) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  }

  const novoNome = dados.nome ?? usuarioAtual.nome
  const novoSobrenome = dados.sobrenome ?? usuarioAtual.sobrenome

  const avatarAntigo = usuarioAtual.image
  const trocandoOuRemovendoAvatar =
    dados.avatarUrl !== undefined && dados.avatarUrl !== avatarAntigo

  const usuario = await prisma.user.update({
    where: { id: guard.user.id },
    data: {
      nome: novoNome,
      sobrenome: novoSobrenome,
      name: `${novoNome} ${novoSobrenome}`.trim(),
      telefone: dados.telefone === undefined ? undefined : dados.telefone || null,
      image: dados.avatarUrl === undefined ? undefined : dados.avatarUrl || null,
    },
    select: {
      id: true,
      nome: true,
      sobrenome: true,
      name: true,
      email: true,
      telefone: true,
      role: true,
      image: true,
    },
  })

  // limpeza best-effort do avatar antigo no R2 (não falha a request principal)
  if (trocandoOuRemovendoAvatar && avatarAntigo && avatarAntigo.startsWith(R2_PUBLIC_URL)) {
    const chaveAntiga = avatarAntigo.replace(`${R2_PUBLIC_URL}/`, "")
    r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: chaveAntiga })).catch((err) => {
      console.error("Falha ao remover avatar antigo do R2:", err)
    })
  }

  return NextResponse.json({ usuario })
}