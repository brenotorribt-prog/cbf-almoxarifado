import bcrypt from "bcryptjs"
import { prisma } from "../src/lib/prisma" // caminho relativo — alias "@/" não resolve automaticamente com tsx puro

const ADMIN_EMAIL = "admin@cbf.com.br"
const ADMIN_SENHA = "TrocarDepoisDoLogin123!"

async function main() {
  const senhaHash = await bcrypt.hash(ADMIN_SENHA, 10)

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: "Administrador",
      nome: "Administrador",
      sobrenome: "Sistema",
      email: ADMIN_EMAIL,
      password: senhaHash,
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