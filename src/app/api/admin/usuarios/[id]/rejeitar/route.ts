import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"

const rejeitarSchema = z.object({
  motivo: z.string().min(3, "Informe o motivo da rejeição"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN"])
  if (guard instanceof NextResponse) return guard
  const usuarioAdmin = guard.user

  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const parsed = rejeitarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const usuario = await prisma.user.findUnique({ where: { id } })

  if (!usuario) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    )
  }

  if (usuario.status === "REJEITADO") {
    return NextResponse.json(
      { error: "Usuário já está rejeitado" },
      { status: 409 }
    )
  }

  // Não deixa rejeitar admin (proteção básica contra auto-sabotagem
  // ou erro de clique em cima de outro admin já aprovado)
  if (usuario.role === "ADMIN" && usuario.status === "APROVADO") {
    return NextResponse.json(
      { error: "Não é possível rejeitar um administrador já aprovado" },
      { status: 403 }
    )
  }

  const usuarioAtualizado = await prisma.user.update({
    where: { id },
    data: {
      status: "REJEITADO",
      ativo: false,
      motivoRejeicao: parsed.data.motivo,
      aprovadoPorId: usuarioAdmin.id, // <-- MUDOU AQUI: session.user.id → usuarioAdmin.id
      dataAprovacao: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      motivoRejeicao: true,
    },
  })

  await prisma.statusHistory.create({
    data: {
      entidade: "User",
      entidadeId: id,
      statusAnterior: usuario.status,
      statusNovo: "REJEITADO",
      observacao: parsed.data.motivo,
      usuarioId: usuarioAdmin.id, // <-- MUDOU AQUI: session.user.id → usuarioAdmin.id
    },
  })

  await prisma.notificacao.create({
    data: {
      usuarioId: id,
      titulo: "Acesso não aprovado",
      mensagem: `Seu cadastro não foi aprovado. Motivo: ${parsed.data.motivo}`,
      tipo: "ACESSO_REJEITADO",
      entidade: "User",
      entidadeId: id,
    },
  })

  return NextResponse.json({ usuario: usuarioAtualizado })
}