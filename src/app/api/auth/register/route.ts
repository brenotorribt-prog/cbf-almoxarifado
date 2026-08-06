// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { Prisma, Role } from "@prisma/client"

// Roles que podem ser solicitadas no auto-cadastro. ADMIN de propósito
// fica de fora — só é atribuído manualmente por outro admin ao aprovar.
const ROLES_SOLICITAVEIS = ["GESTOR", "SUPERVISOR", "ALMOXARIFE", "SOLICITANTE"] as const

const cadastroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(60),
  sobrenome: z.string().trim().min(1, "Informe o sobrenome").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  setor: z.string().trim().max(80).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(ROLES_SOLICITAVEIS, {
    error: "Nível de acesso inválido",
  }),
})

// POST /api/auth/register
// Rota pública. Cria o usuário como status PENDENTE / ativo false —
// só entra no sistema depois que um admin aprovar em /configuracoes.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const parsed = cadastroSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { nome, sobrenome, email, senha, setor, cargo, telefone, role } = parsed.data

  const existente = await prisma.user.findUnique({ where: { email } })
  if (existente) {
    return NextResponse.json(
      { error: "Já existe uma conta cadastrada com esse e-mail" },
      { status: 409 }
    )
  }

  const senhaHash = await bcrypt.hash(senha, 10)

  try {
    const usuario = await prisma.user.create({
      data: {
        nome,
        sobrenome,
        name: `${nome} ${sobrenome}`.trim(),
        email,
        password: senhaHash,
        setor: setor || null,
        cargo: cargo || null,
        telefone: telefone || null,
        role: role as Role,
        status: "PENDENTE",
        ativo: false,
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    })

    return NextResponse.json(
      {
        usuario,
        mensagem: "Cadastro enviado. Aguarde a aprovação de um administrador para poder entrar.",
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma conta cadastrada com esse e-mail" },
        { status: 409 }
      )
    }
    throw err
  }
}