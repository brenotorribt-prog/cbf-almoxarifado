import "dotenv/config";
import { defineConfig } from "prisma/config";

// carrega .env.local explicitamente, já que dotenv por padrão só lê .env
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // migrations precisam da conexão DIRETA (5432), não passa pelo pgbouncer
    url: process.env["DIRECT_URL"],
  },
});