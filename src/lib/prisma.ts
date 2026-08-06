import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"

// Evita recriar conexões a cada hot-reload do Next.js em dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL, // pooled, porta 6543
    max: 10,
    idleTimeoutMillis: 30_000,
    // Prisma 7 / driver adapter não tem timeout de conexão por padrão (era 5s no v6).
    // Setamos manualmente pra não deixar conexão perdida pendurada.
    connectionTimeoutMillis: 5_000,
  })

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.pgPool = pool
}