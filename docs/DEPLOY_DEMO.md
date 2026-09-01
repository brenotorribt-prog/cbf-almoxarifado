# Deploy e configuração do ambiente DEMO (portfólio)

Este guia documenta como publicar uma instância **totalmente isolada** da
produção, com dados fictícios, para apresentação como portfólio.

> ⚠️ **Regra de ouro:** a demo NUNCA usa o banco, as credenciais ou os dados da
> operação real. Tudo aqui é um ambiente separado.

---

## 1. Isolamento entre PRODUÇÃO e DEMO

```
PRODUÇÃO   DATABASE_URL / DIRECT_URL -> banco de produção (NUNCA tocar)
DEMO       DATABASE_URL / DIRECT_URL -> banco exclusivo da demo (criado abaixo)
       NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE -> projeto Supabase da demo
       SUPABASE_/R2_* -> bucket R2 da demo (opcional)
```

O seed demo é protegido por uma **guarda de segurança**:

- `prisma/demo-seed.ts` **aborta** se `DEMO_ENV !== "true"`;
- o script **`npm run seed:demo` NÃO carrega `.env.local`** (diferente do seed
  de produção `npm run seed`), então ele só escreve no banco indicado pelo
  `DATABASE_URL`/`DIRECT_URL` do ambiente em que roda.

---

## 2. Recursos (uma única vez)

**Banco (Supabase ou Postgres)** — crie um banco dedicado para a demo:
- `DATABASE_URL` — conexão **pool** (porta 6543);
- `DIRECT_URL` — conexão **direta** (porta 5432), usada pelas migrações.

**Supabase Auth (projeto da demo)** — em *Project Settings → API*:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Storage R2 (opcional)** — a demo usa identidade neutra/sem fotos, então o R2 é
opcional para navegar. Se quiser testar upload, crie um bucket demo e copie
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_PUBLIC_URL`.

---

## 3. Variáveis de ambiente (demo)

Crie um arquivo de variáveis para a demo — **fora do Git** (`.env*` é ignorado):

```env
# Banco (DEMO — não é o de produção!)
DATABASE_URL="postgresql://<usuario>:<senha>@<host>:6543/postgres"  # pool (aplicação)
DIRECT_URL="postgresql://<usuario>:<senha>@<host>:5432/postgres"      # direta (migrações)

# Supabase Auth da demo
NEXT_PUBLIC_SUPABASE_URL="https://demo.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role>"

# Sinais da demo (segurança)
DEMO_ENV="true"                     # habilita o seed demo e o endpoint de credenciais
DEMO_PASSWORD="Demo@1234"           # senha compartilhada das contas fictícias
NEXT_PUBLIC_DEMO_ENABLED="true"     # mostra o cartão "Credenciais de demonstração" no login
NEXT_PUBLIC_APP_URL="<url-do-deploy-demo>"

# Storage R2 (opcional)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""

# Upstash (opcional — nenhuma rota depende hoje)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

> **Importante:** nunca rode a demo com o `DATABASE_URL` da produção. A guarda
> `DEMO_ENV=true` ajuda, mas quem decide o destino é o URL do banco.

## 4. Rodar o seed demo (localmente)

```bash
# PowerShell — exporta só as variáveis do ambiente demo:
$env:DEMO_ENV="true"
$env:DATABASE_URL="postgresql://<usuario>:<senha>@<host>:6543/postgres"
$env:DIRECT_URL="postgresql://<usuario>:<senha>@<host>:5432/postgres"
$env:NEXT_PUBLIC_SUPABASE_URL="https://demo.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role>"
$env:DEMO_PASSWORD="Demo@1234"

# Aplica as migrações no banco DEMO (usa DIRECT_URL)
npx prisma migrate deploy

# Popula a DEMO (idempotente: limpa e recria os dados fictícios)
npm run seed:demo
```

Para bash/zsh troque `$env:VAR="..."` por `export VAR="..."`.

> Atalho ainda mais seguro: `dotenv -e .env.demo.local -- npx prisma migrate deploy`
> e `dotenv -e .env.demo.local -- npm run seed:demo` (o arquivo `.env.demo.local`
> só existe no ambiente da demo).

---

## 5. Contas da demo (criadas pelo seed)

| Papel | Nome | E-mail |
|---|---|---|
| ADMIN | Carlos Mendes | `admin@demo-almoxarifado.com` |
| GESTOR | Marina Oliveira | `gestor@demo-almoxarifado.com` |
| SUPERVISOR | Rafael Santos | `supervisor@demo-almoxarifado.com` |
| ALMOXARIFE | Juliana Costa | `almoxarife1@demo-almoxarifado.com` |
| ALMOXARIFE | Pedro Almeida | `almoxarife2@demo-almoxarifado.com` |
| SOLICITANTE | Fernanda Lima | `solicitante1@demo-almoxarifado.com` |
| SOLICITANTE | Gustavo Rocha | `solicitante2@demo-almoxarifado.com` |
| SOLICITANTE | Beatriz Nunes | `solicitante3@demo-almoxarifado.com` |

Todos usam a **mesma senha** (valor de `DEMO_PASSWORD`). Os usuários são criados
no Supabase com e-mail confirmado, `ativo: true` e `status: APROVADO`.

---

## 6. Build e start (igual à produção)

```bash
npm ci
npx prisma migrate deploy
npm run build   # roda prisma generate + next build
npm start
```

### Vercel (sugerido)

1. Importe o repositório e configure o projeto da demo.
2. Nas variáveis do projeto, adicione as do **item 3** (do ambiente demo).
3. Build: `npm run build` · Start: `npm run start`.
4. **Não rode o `seed:demo` no deploy da Vercel**: rode uma única vez de
   local/CI após o primeiro deploy, para não resetar os dados a cada push.

---

## 7. Por que a demo não afeta a produção?

- **Banco separado**: todos os comandos usam o `DATABASE_URL`/`DIRECT_URL` demo;
- **Guarda `DEMO_ENV`**: `demo-seed` aborta sem esse sinal; o endpoint
  `/api/demo/credenciais` retorna 404 fora da demo e o cartão de login só
  aparece com `NEXT_PUBLIC_DEMO_ENABLED=true`;
- **Dados 100% fictícios** (categorias, materiais, pessoas, requisições,
  empréstimos, compras e notificações fabricadas);
- **Identidade neutra**: nenhuma `ConfiguracaoVisual` é criada — o tema usa o
  default "Almoxarifado" (sem logos da organização).
- Nenhuma migration é alterada e nenhum código de produção é modificado para a demo.