// proxy.ts

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

// Roda em Node.js runtime (não Edge) porque auth.ts usa Prisma + bcryptjs
// dentro do Credentials provider — isso não roda no Edge runtime padrão.
export const runtime = "nodejs"

const ROTAS_PUBLICAS = ["/login"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await auth()
  const logado = !!session?.user

  const rotaPublica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  )

  // não logado tentando acessar rota protegida -> manda pro login,
  // guardando pra onde ele queria ir originalmente
  if (!logado && !rotaPublica) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // já logado tentando acessar /login -> manda pra home
  if (logado && rotaPublica) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}