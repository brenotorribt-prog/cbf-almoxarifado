import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ROTAS_PUBLICAS = ["/", "/login", "/cadastro", "/solicitar"]
const ROTAS_REDIRECIONAM_LOGADO = ["/login", "/cadastro"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const logado = !!user
  const { pathname } = request.nextUrl

  const rotaPublica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  )
  const rotaRedirecionaLogado = ROTAS_REDIRECIONAM_LOGADO.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  )

  if (!logado && !rotaPublica) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (logado && rotaRedirecionaLogado) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (logado && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|assets|api).*)",
  ],
}