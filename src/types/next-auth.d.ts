// src/types/next-auth.d.ts
import { Role } from "@prisma/client"

declare module "next-auth" {
  interface User {
    role: Role
  }
  
  interface Session {
    user: User & {
      id: string
    }
  }

  interface JWT {
    id: string
    role: Role
  }
}