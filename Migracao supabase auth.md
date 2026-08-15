# Migração: NextAuth (Auth.js v5 beta) → Supabase Auth

> Guia autocontido. Não depende de conversa anterior — todo o contexto necessário está aqui.
> Objetivo: eliminar o Credentials provider + bcryptjs e passar a autenticação para o Supabase Auth,
> mantendo o Postgres/Prisma como fonte de verdade dos dados de negócio.

## Contexto do projeto

- **Nome**: `cbf-almoxarifado` — sistema de gestão de almoxarifado (materiais, estoque, solicitações,
  empréstimos, pedidos de compra, aprovações).
- **Stack**: Next.js 16.2.12, React 19.2.4, TypeScript, Prisma 7.9.1 com `@prisma/adapter-pg` (driver
  adapter, obrigatório a partir do Prisma 7), banco Postgres hospedado no **Supabase** (Supavisor):
  porta **6543** para conexão pooled (`DATABASE_URL`, com `?pgbouncer=true` — **já confirmado presente**,
  não é bug), porta **5432** para conexão direta (`DIRECT_URL`, usada só pelo Prisma CLI em migrations).
- **Auth atual**: NextAuth v5 beta (`next-auth@5.0.0-beta.32`) só com **Credentials provider**
  (email + senha), hash via `bcryptjs`, estratégia de sessão **JWT** (não há `PrismaAdapter`
  configurado em `auth.ts`, apesar dos models `Account`/`Session`/`VerificationToken` existirem no
  schema — são resíduo do template padrão do NextAuth e **não são usados por nada**).
- **Roles**: enum `Role` no Prisma = `ADMIN | GESTOR | SUPERVISOR | ALMOXARIFE | SOLICITANTE`.
- **Usuários atuais**: só **2 usuários** no sistema. **Ok resetar senha/recriar direto no banco** —
  não precisa de estratégia de migração de hash zero-downtime.
- **Motivo da migração**: passamos um bom tempo depurando um bug onde, após trocar a senha pelo
  modal de perfil, o login com a nova senha falhava e só era resolvido com reset manual via script.
  Foi revisada **toda a cadeia de código** (`authorize()`, rota de troca de senha, rota de perfil,
  seed, modal, middleware, require-role) e **nenhum bug de aplicação foi encontrado** — tudo
  logicamente correto. A causa raiz nunca foi 100% confirmada (havia um script de diagnóstico pronto
  mas não chegou a rodar). Decisão: em vez de continuar caçando um possível bug do Auth.js beta,
  migrar para Supabase Auth, que elimina bcrypt/hash manual do fluxo inteiro.

## Páginas/rotas adicionais no escopo da migração

Além do que já está detalhado abaixo, **cadastro e login também precisam mudar** — não foram
esquecidos, só foram desenhados numa etapa posterior desta conversa:

- `src/app/cadastro/page.tsx` — **não precisa mudar nada**. Já é 100% desacoplado (só manda JSON pro
  `/api/auth/register`, não sabe nada de bcrypt/Prisma/Supabase).
- `src/app/api/auth/register/route.ts` — reescrever (seção 12 abaixo).
- `src/app/login/page.tsx` — reescrever o `handleSubmit` (seção 13 abaixo). Hoje usa
  `signIn("credentials", ...)` do `next-auth/react`.
- **Regra de negócio que precisa ser preservada**: o `authorize()` antigo bloqueava login de usuário
  com `ativo: false` (fluxo de aprovação: cadastro cria `status: "PENDENTE"` / `ativo: false`, só um
  admin aprovando libera o acesso). O Supabase Auth **não sabe nada sobre isso** — ele só valida
  email/senha. Essa checagem precisa ser replicada explicitamente depois do login (seção 13), senão
  qualquer cadastro novo consegue entrar no sistema sem aprovação.

## O que já foi descartado como causa (não perder tempo revisitando)

- Pooler/pgbouncer: `DATABASE_URL` já tem `?pgbouncer=true`. Não é isso.
- Cache de dev/hot-reload: bug ocorre em produção também. Não é isso.
- Sessão JWT "zumbi": usuário faz logout de verdade antes de testar. Não é isso.
- Case sensitivity de email: emails sempre minúsculos, digitados iguais. Não é isso.
- Triggers/functions no Postgres via SQL Editor do Supabase: verificado, **não existem** triggers na
  tabela `User`. Não é isso.
- Duplo hash, campo sobrescrito, `data: {...body}` sem allowlist: revisado nas rotas
  `/api/perfil` e `/api/perfil/senha` — ambas usam `data` explícito, sem spread. Não é isso.

## Pendência aberta (só relevante se a migração for adiada)

Ao rodar `npx prisma migrate status` foi necessário corrigir o `prisma.config.ts` (Prisma 7 exige
`datasource.url` explícito, separado do client em runtime). Também foi notado um erro de TypeScript:
`Module '"@prisma/client"' has no exported member 'Role'`, e o `schema.prisma` usa
`generator client { provider = "prisma-client-js" }`, que é o provider **antigo** (pré-Prisma 7; o
recomendado agora é `"prisma-client"`, embora isso tenha ressalvas com Turbopack no Next 16 — pesquisar
estado atual se for mexer nisso). **Isso ficou sem resolução — mas não impede a migração de auth**,
que é ortogonal a esse problema.

---

## Plano de migração

### 1. Variáveis de ambiente novas (pegar no dashboard do Supabase → Settings → API)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
# necessária só pro seed.ts (admin API) — NUNCA expor no client
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> Nomenclatura das chaves mudou ao longo de 2025/2026 (algumas contas mostram
> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em vez de `ANON_KEY`). Conferir o nome exato no dashboard
> antes de colar — os dois funcionam do mesmo jeito, é só nome.

**Status confirmado**: as 3 variáveis (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) **já estão configuradas na Vercel**, junto com `DATABASE_URL`/`DIRECT_URL`
que não mudam. Não falta nada pra começar — só puxar o `.env.local` completo no PC do trabalho.

`AUTH_SECRET` e `NEXTAUTH_URL` também estão lá, mas ficam **órfãs** depois da migração — podem
coexistir sem problema durante o processo, mas remover da Vercel no final (seção 13, passo 14).

### 2. Dependências (`package.json`)

Adicionar:
```
@supabase/ssr
```
(já existe `@supabase/supabase-js` no projeto — mantém, é usado pelo `@supabase/ssr` por baixo)

Remover:
```
next-auth
bcryptjs
@types/bcryptjs
```

### 3. Apagar

- `src/auth.ts`
- `src/auth.config.ts`
- `app/api/auth/[...nextauth]/route.ts`
- Qualquer arquivo de tipos customizados de sessão (ex: `next-auth.d.ts`, se existir)
- `proxy.ts` (raiz do projeto — vira `middleware.ts`, ver seção 5)

### 4. Mudar `prisma/schema.prisma`

Remover os models `Account`, `Session`, `VerificationToken` (não usados).

No `model User`:
- Remover o campo `password String?`
- Trocar `id String @id @default(cuid())` por `id String @id` (sem default — o id passa a ser o
  UUID atribuído pelo Supabase Auth, não gerado pelo Prisma)

Depois de editar, rodar `npx prisma migrate dev --name remove_nextauth_fields` (local, com acesso ao
banco) e revisar a migration gerada antes de aplicar em produção — como só tem 2 usuários, dá pra
recriar os registros manualmente se for mais simples que fazer `ALTER`.

### 5. Criar arquivos novos

**`lib/supabase/server.ts`**
```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorável em Server Components — o middleware cuida do refresh.
          }
        },
      },
    }
  )
}
```

**`lib/supabase/client.ts`**
```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`middleware.ts`** (raiz do projeto — substitui `proxy.ts`, mesma lógica de rotas
públicas/redirect que já existia)
```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ROTAS_PUBLICAS = ["/", "/login", "/cadastro"]
const ROTAS_REDIRECIONAM_LOGADO = ["/login", "/cadastro"]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
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
    const url = new URL("/", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
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
    "/((?!api|_next/static|_next/image|favicon.ico|assets|BGA.png|BGSB.png|cbflogo.png).*)",
  ],
}
```

### 6. Reescrever `lib/require-role.ts`

Troca `auth()` do NextAuth por `supabase.auth.getUser()`. A **role continua vindo do Prisma** — o
Supabase só confirma quem está logado, não sabe nada sobre roles do negócio.

```typescript
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const usuario = await prisma.user.findUnique({ where: { id: user.id } })
  return usuario
}

export async function requireAuth() {
  const usuario = await getSessionUser()
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  return { user: usuario }
}

export async function requireRole(rolesPermitidas: Role[]) {
  const usuario = await getSessionUser()
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  if (!rolesPermitidas.includes(usuario.role)) {
    return NextResponse.json(
      { error: "Você não tem permissão para executar essa ação" },
      { status: 403 }
    )
  }
  return { user: usuario }
}

export async function requireAdmin() {
  return requireRole(["ADMIN"])
}
```

> Atenção: o shape de retorno mudou de `session` (objeto NextAuth) para `{ user: usuario }` (registro
> Prisma direto). Todo lugar que faz `guard.user.id`, `guard.user.role` etc **continua funcionando
> igual** porque a shape `{ user: {...} }` foi mantida de propósito — só troca a origem dos dados.

### 7. Reescrever `app/api/perfil/senha/route.ts`

Some o `bcrypt.compare`/`bcrypt.hash` — o Supabase Auth cuida disso.

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/require-role"
import { createClient } from "@/lib/supabase/server"

const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres"),
})

export async function PATCH(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = trocarSenhaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { senhaAtual, novaSenha } = parsed.data
  const supabase = await createClient()

  // Revalida a senha atual tentando logar com ela (mesma garantia que o bcrypt.compare dava)
  const { error: erroSenhaAtual } = await supabase.auth.signInWithPassword({
    email: guard.user.email,
    password: senhaAtual,
  })
  if (erroSenhaAtual) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
  }

  const { error: erroUpdate } = await supabase.auth.updateUser({ password: novaSenha })
  if (erroUpdate) {
    return NextResponse.json({ error: "Erro ao trocar senha" }, { status: 500 })
  }

  return NextResponse.json({ sucesso: true })
}
```

### 8. `ModalPerfil.tsx`

O único trecho que precisa mudar é a atualização de sessão pós-troca:

```typescript
// antes:
const { update: atualizarSessao } = useSession()
...
await atualizarSessao({ name: ..., image: ... })

// depois:
import { useRouter } from "next/navigation"
const router = useRouter()
...
router.refresh() // Server Components releem os dados atualizados do Prisma direto
```

Os campos de senha (`senhaAtual`, `novaSenha`, `confirmarNovaSenha`) e a validação continuam
idênticos — só a API por trás mudou.

### 9. Reescrever `prisma/seed.ts`

```typescript
import { createClient } from "@supabase/supabase-js"
import { prisma } from "../src/lib/prisma"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = "admin@cbf.com.br"
const ADMIN_SENHA = "TrocarDepoisDoLogin123!"

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
```

### 10. Reescrever `src/app/api/auth/register/route.ts`

Troca `bcrypt.hash` + `prisma.user.create` direto por `supabase.auth.admin.createUser` (client com
**service role key**, não o público — não deve criar sessão automática pro usuário recém-cadastrado)
seguido do `prisma.user.create` de sempre, usando o `id` retornado pelo Supabase. Se o `prisma.user.create`
falhar depois do Supabase já ter criado o usuário, desfaz com `admin.deleteUser` pra não deixar
usuário órfão em `auth.users` sem registro de negócio correspondente.

```typescript
// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { prisma } from "@/lib/prisma"
import { Prisma, Role } from "@prisma/client"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ROLES_SOLICITAVEIS = ["GESTOR", "SUPERVISOR", "ALMOXARIFE", "SOLICITANTE"] as const

const cadastroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(60),
  sobrenome: z.string().trim().min(1, "Informe o sobrenome").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  setor: z.string().trim().max(80).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(ROLES_SOLICITAVEIS, { error: "Nível de acesso inválido" }),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const parsed = cadastroSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { nome, sobrenome, email, senha, setor, cargo, telefone, role } = parsed.data

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // ou false, se quiser exigir confirmação por e-mail
  })

  if (error) {
    return NextResponse.json(
      { error: "Já existe uma conta cadastrada com esse e-mail" },
      { status: 409 }
    )
  }

  try {
    const usuario = await prisma.user.create({
      data: {
        id: data.user.id, // mesmo id do Supabase Auth
        nome,
        sobrenome,
        name: `${nome} ${sobrenome}`.trim(),
        email,
        setor: setor || null,
        cargo: cargo || null,
        telefone: telefone || null,
        role: role as Role,
        status: "PENDENTE",
        ativo: false,
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    })

    return NextResponse.json(
      { usuario, mensagem: "Cadastro enviado. Aguarde a aprovação de um administrador." },
      { status: 201 }
    )
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma conta cadastrada com esse e-mail" }, { status: 409 })
    }
    throw err
  }
}
```

### 11. Criar `src/app/api/auth/verificar-acesso/route.ts` + reescrever `handleSubmit` do login

O `authorize()` antigo bloqueava login de quem não estava `ativo`/`APROVADO`. Como o
`supabase.auth.signInWithPassword` não sabe nada sobre essas colunas do Prisma, essa checagem vira
um passo explícito **logo depois** do login, numa rota nova:

```typescript
// src/app/api/auth/verificar-acesso/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const usuario = await prisma.user.findUnique({ where: { id: user.id } })
  if (!usuario || !usuario.ativo || usuario.status !== "APROVADO") {
    return NextResponse.json(
      { error: "Sua conta ainda não foi aprovada por um administrador" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true })
}
```

E no `src/app/login/page.tsx`, troca o `signIn("credentials", ...)` do `next-auth/react` por:

```typescript
// remove: import { signIn } from "next-auth/react"
import { createClient } from "@/lib/supabase/client"

async function handleSubmit(event: React.FormEvent) {
  event.preventDefault()
  setError(null)
  setLoading(true)

  const supabase = createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    setError("E-mail ou senha inválidos.")
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
    setLoading(false)
    return
  }

  // Replica a checagem de ativo/status que existia dentro do authorize() antigo
  const resAcesso = await fetch("/api/auth/verificar-acesso")
  if (!resAcesso.ok) {
    const dados = await resAcesso.json().catch(() => ({}))
    await supabase.auth.signOut()
    setError(dados.error ?? "Acesso não autorizado.")
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
    setLoading(false)
    return
  }

  setLoading(false)
  router.push(callbackUrl)
  router.refresh()
}
```

O resto do componente (`particles`, estilos, JSX do form) **não muda em nada**.

> Nota: essa checagem de `ativo`/`status` só roda uma vez, no momento do login — igual o
> comportamento antigo (o `authorize()` também só rodava na hora do login, não em toda navegação).
> Se no futuro for necessário revogar acesso de alguém que já está logado, isso precisa de uma
> checagem adicional em `require-role.ts`, que hoje não existe nem no fluxo antigo nem no novo.

### 12. Migrar os 2 usuários existentes

Como está tudo bem com resetar:

1. Anota email + role dos 2 usuários atuais (`SELECT email, role FROM "User"`).
2. Cria os 2 no Supabase Auth (dashboard → Authentication → Users → Add user, ou via
   `admin.createUser` num script avulso) com senha nova.
3. Roda um `UPDATE "User" SET id = '<uuid-gerado-pelo-supabase>' WHERE email = '...'` pra cada um
   (ou deleta e recria os registros com o novo id, se for mais simples dado o volume de FKs
   relacionados — com só 2 usuários e pouco histórico ligado a eles, `UPDATE` direto no `id` deve
   bastar, mas checar `onDelete`/cascatas nas FKs antes).

### 13. Ordem de execução recomendada

1. Criar `.env.local` com as 3 variáveis novas do Supabase.
2. Instalar `@supabase/ssr`, remover `next-auth`/`bcryptjs`.
3. Criar `lib/supabase/server.ts` e `lib/supabase/client.ts`.
4. Criar os 2 usuários no Supabase Auth + atualizar `id` deles no Postgres (seção 12).
5. Editar `schema.prisma` + rodar migration.
6. Criar `middleware.ts`, apagar `proxy.ts`.
7. Reescrever `require-role.ts`.
8. Reescrever `app/api/perfil/senha/route.ts`.
9. Editar `ModalPerfil.tsx`.
10. Reescrever `seed.ts`.
11. Reescrever `app/api/auth/register/route.ts` (seção 10).
12. Criar `app/api/auth/verificar-acesso/route.ts` e editar `handleSubmit` de `app/login/page.tsx`
    (seção 11) — **não esquecer**, é a checagem de `ativo`/`status` que substitui o bloqueio que
    existia dentro do `authorize()` antigo.
13. Apagar `auth.ts`, `auth.config.ts`, rota `[...nextauth]`, tipos customizados.
14. Testar: cadastro novo (deve ficar pendente, sem conseguir logar), aprovação manual do usuário
    pendente, login, troca de senha, logout, acesso a rota protegida, roles (`requireRole`).
15. Remover `AUTH_SECRET` e `NEXTAUTH_URL` das variáveis de ambiente na Vercel (órfãs, não usadas
    mais por nada depois que `auth.ts`/`auth.config.ts` forem apagados).