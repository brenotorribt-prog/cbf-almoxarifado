// proxy.ts

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

// Roda em Node.js runtime (não Edge) porque auth.ts usa Prisma + bcryptjs
// dentro do Credentials provider — isso não roda no Edge runtime padrão.
export const runtime = "nodejs"

// Rotas que NÃO precisam de autenticação
const ROTAS_PUBLICAS = ["/", "/login", "/cadastro"]

// Rotas que são públicas mas redirecionam para o dashboard se logado
const ROTAS_REDIRECIONAM_LOGADO = ["/login", "/cadastro"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await auth()
  const logado = !!session?.user

  // Verifica se a rota atual é pública
  const rotaPublica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  )

  // Verifica se a rota redireciona logados
  const rotaRedirecionaLogado = ROTAS_REDIRECIONAM_LOGADO.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  )

  // ================================================================
  // 1. NÃO LOGADO tentando acessar rota protegida
  // ================================================================
  if (!logado && !rotaPublica) {
    const url = new URL("/", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  // ================================================================
  // 2. LOGADO tentando acessar página de login/cadastro
  // ================================================================
  if (logado && rotaRedirecionaLogado) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // ================================================================
  // 3. LOGADO na HOME (/) - redireciona para dashboard
  // ================================================================
  if (logado && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // ================================================================
  // 4. NÃO LOGADO na HOME (/) - deixa a landing page
  // ================================================================
  // (cai no return NextResponse.next() abaixo)

  // ================================================================
  // 5. Qualquer outra situação - segue normal
  // ================================================================
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all request paths except:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon)
    // - api (API routes)
    // - assets (public assets)
    "/((?!api|_next/static|_next/image|favicon.ico|assets|BGA.png|BGSB.png|cbflogo.png).*)",
  ],
}