// src/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Para NextAuth v5, os tipos são diferentes
// Não use declare module para next-auth/jwt

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        try {
          const user = await prisma.user.findUnique({ where: { email } })
          
          if (!user || !user.password || !user.ativo) {
            console.log("Usuário não encontrado, sem senha ou inativo:", email)
            return null
          }

          const senhaValida = await bcrypt.compare(password, user.password)
          if (!senhaValida) {
            console.log("Senha inválida para:", email)
            return null
          }

          console.log("Login bem-sucedido para:", email)

          // Para NextAuth v5, retorne o objeto diretamente
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as Role,
            image: user.image,
          }
        } catch (error) {
          console.error("Erro na autenticação:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role as Role
      }
      
      if (trigger === "update" && session) {
        if (typeof session.name === "string") {
          token.name = session.name
        }
        if (typeof session.image === "string" || session.image === null) {
          token.picture = session.image
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
})