import { createClient } from "@supabase/supabase-js"
import { prisma } from "../src/lib/prisma"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = "admin@cbf.com.br"
const ADMIN_SENHA = "admin@2026"

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_SENHA,
    email_confirm: true,
  })
  if (error) throw error

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      id: data.user.id, // mesmo id do Supabase Auth — sem tabela de mapeamento
      name: "Administrador",
      nome: "Administrador",
      sobrenome: "Sistema",
      email: ADMIN_EMAIL,
      role: "ADMIN",
      ativo: true,
      status: "APROVADO",
      dataAprovacao: new Date(),
    },
  })

  console.log("Seed concluído.")
  console.log(`Admin: ${admin.email} (${admin.id})`)
}

main()
  .catch((err) => {
    console.error("Erro no seed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })