import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { Role } from "@prisma/client"

const aprovarSchema = z.object({
  // Admin pode confirmar a role que o usuário solicitou, ou trocar
  // por outra antes de aprovar. Se não vier, mantém a role atual do registro.
  role: z.nativeEnum(Role).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const usuarioAdmin = guard // <-- MUDOU AQUI: session → usuarioAdmin

  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const parsed = aprovarSchema.safeParse(body)
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

  if (usuario.status === "APROVADO") {
    return NextResponse.json(
      { error: "Usuário já está aprovado" },
      { status: 409 }
    )
  }

  const usuarioAtualizado = await prisma.user.update({
    where: { id },
    data: {
      status: "APROVADO",
      ativo: true,
      role: parsed.data.role ?? usuario.role,
      aprovadoPorId: usuarioAdmin.id, // <-- MUDOU AQUI: session.user.id → usuarioAdmin.id
      dataAprovacao: new Date(),
      motivoRejeicao: null, // limpa caso tenha sido rejeitado antes e reconsiderado
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      ativo: true,
      dataAprovacao: true,
    },
  })

  // Registro em StatusHistory pra manter rastro de quem aprovou o quê
  await prisma.statusHistory.create({
    data: {
      entidade: "User",
      entidadeId: id,
      statusAnterior: usuario.status,
      statusNovo: "APROVADO",
      observacao: parsed.data.role && parsed.data.role !== usuario.role
        ? `Aprovado com role alterada de ${usuario.role} para ${parsed.data.role}`
        : "Acesso aprovado",
      usuarioId: usuarioAdmin.id, // <-- MUDOU AQUI: session.user.id → usuarioAdmin.id
    },
  })

  // Notifica o próprio usuário
  await prisma.notificacao.create({
    data: {
      usuarioId: id,
      titulo: "Acesso aprovado",
      mensagem: "Seu cadastro foi aprovado. Você já pode fazer login no sistema.",
      tipo: "ACESSO_APROVADO",
      entidade: "User",
      entidadeId: id,
    },
  })

  return NextResponse.json({ usuario: usuarioAtualizado })
}