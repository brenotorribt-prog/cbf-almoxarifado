import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { prisma } from "@/lib/prisma"
import { Prisma, Role } from "@prisma/client"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ROLES_SOLICITAVEIS = ["GESTOR", "SUPERVISOR", "ALMOXARIFE", "SOLICITANTE"] as const

const cadastroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(60),
  sobrenome: z.string().trim().min(1, "Informe o sobrenome").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  setor: z.string().trim().max(80).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(ROLES_SOLICITAVEIS, { error: "Nível de acesso inválido" }),
})

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

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // ou false, se quiser exigir confirmação por e-mail
  })

  if (error) {
    return NextResponse.json(
      { error: "Já existe uma conta cadastrada com esse e-mail" },
      { status: 409 }
    )
  }

  try {
    const usuario = await prisma.user.create({
      data: {
        id: data.user.id, // mesmo id do Supabase Auth
        nome,
        sobrenome,
        name: `${nome} ${sobrenome}`.trim(),
        email,
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
      { usuario, mensagem: "Cadastro enviado. Aguarde a aprovação de um administrador." },
      { status: 201 }
    )
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma conta cadastrada com esse e-mail" }, { status: 409 })
    }
    throw err
  }
}