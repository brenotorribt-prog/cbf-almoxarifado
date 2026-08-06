import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
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

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.password || !user.ativo) return null

        const senhaValida = await bcrypt.compare(password, user.password)
        if (!senhaValida) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // Primeiro login - adiciona dados do usuário
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // Atualização manual via client - disparado pelo modal de perfil
      // Quando o client chama useSession().update({ name, image })
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
        session.user.role = token.role as never
        // O nome e imagem já são atualizados automaticamente do token
        // para session.user.name e session.user.image
      }
      return session
    },
  },
})