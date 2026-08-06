import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/require-role"
import { Prisma } from "@prisma/client"
import { gerarCodigoInterno } from "@/lib/codigo-interno"
import { randomUUID } from "crypto"

const LIMIT_PADRAO = 30
const LIMIT_MAXIMO = 100

// GET /api/materiais?cursor=123&limit=30&categoriaId=xxx&situacao=ATIVO&estoqueStatus=BAIXO&busca=parafuso
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)

  const cursorParam = searchParams.get("cursor")
  const cursor = cursorParam ? Number(cursorParam) : null

  const limitParam = Number(searchParams.get("limit") ?? LIMIT_PADRAO)
  const limit = Math.min(Math.max(limitParam || LIMIT_PADRAO, 1), LIMIT_MAXIMO)

  const categoriaId = searchParams.get("categoriaId")
  const situacao = searchParams.get("situacao")
  const estoqueStatus = searchParams.get("estoqueStatus")
  const busca = searchParams.get("busca")?.trim()

  const condicoes: Prisma.Sql[] = []

  if (cursor !== null && !Number.isNaN(cursor)) {
    condicoes.push(Prisma.sql`m."numeroSequencial" > ${cursor}`)
  }
  if (categoriaId) {
    condicoes.push(Prisma.sql`m."categoriaId" = ${categoriaId}`)
  }
  if (situacao === "ATIVO" || situacao === "INATIVO") {
    condicoes.push(Prisma.sql`m.situacao = ${situacao}::"StatusMaterial"`)
  }
  if (estoqueStatus === "BAIXO") {
    condicoes.push(Prisma.sql`m."estoqueAtual" < m."estoqueMinimo"`)
  } else if (estoqueStatus === "ALTO") {
    condicoes.push(Prisma.sql`m."estoqueAtual" > m."estoqueMaximo"`)
  }
  if (busca) {
    const termo = `%${busca}%`
    condicoes.push(
      Prisma.sql`(m.nome ILIKE ${termo} OR m."codigoInterno" ILIKE ${termo} OR m.marca ILIKE ${termo} OR m.modelo ILIKE ${termo})`
    )
  }

  const where =
    condicoes.length > 0 ? Prisma.sql`WHERE ${Prisma.join(condicoes, " AND ")}` : Prisma.empty

  const linhas = await prisma.$queryRaw<RowMaterial[]>(Prisma.sql`
    SELECT
      m.id, m."numeroSequencial", m."codigoInterno", m."codigoBarras", m."qrCode",
      m.nome, m.descricao, m.marca, m.fabricante, m.modelo, m."numeroSerie",
      m."estoqueMinimo", m."estoqueIdeal", m."estoqueMaximo", m."estoqueAtual",
      m."localizacaoFisica", m.situacao, m."fotoUrl", m."requerAprovacao",
      m."createdAt", m."updatedAt",
      c.id as "categoriaId", c.nome as "categoriaNome",
      u.id as "unidadeMedidaId", u.sigla as "unidadeSigla", u.nome as "unidadeNome",
      cr.id as "criadoPorId", cr.name as "criadoPorNome"
    FROM "Material" m
    JOIN "Categoria" c ON c.id = m."categoriaId"
    JOIN "UnidadeMedida" u ON u.id = m."unidadeMedidaId"
    JOIN "User" cr ON cr.id = m."criadoPorId"
    ${where}
    ORDER BY m."numeroSequencial" ASC
    LIMIT ${limit + 1}
  `)

  const temMais = linhas.length > limit
  const pagina = temMais ? linhas.slice(0, limit) : linhas

  const materiais = pagina.map(mapearMaterial)
  const nextCursor = temMais ? pagina[pagina.length - 1].numeroSequencial : null

  const [resumo] = await prisma.$queryRaw<ResumoRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE situacao = 'INATIVO')::int as inativos,
      COUNT(*) FILTER (WHERE "estoqueAtual" < "estoqueMinimo")::int as "estoqueBaixo",
      COUNT(*) FILTER (WHERE "estoqueAtual" > "estoqueMaximo")::int as "estoqueAlto"
    FROM "Material"
  `)

  return NextResponse.json({
    materiais,
    nextCursor,
    resumo: {
      total: resumo?.total ?? 0,
      inativos: resumo?.inativos ?? 0,
      estoqueBaixo: resumo?.estoqueBaixo ?? 0,
      estoqueAlto: resumo?.estoqueAlto ?? 0,
    },
  })
}

// =====================================================================
// POST /api/materiais — cadastro de novo material
// =====================================================================

const criarMaterialSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome muito curto").max(150),
    descricao: z.string().trim().max(500).optional().nullable(),

    categoriaId: z.string().min(1, "Categoria é obrigatória"),
    unidadeMedidaId: z.string().min(1, "Unidade de medida é obrigatória"),

    requerAprovacao: z.boolean().default(false),

    marca: z.string().trim().max(80).optional().nullable(),
    fabricante: z.string().trim().max(80).optional().nullable(),
    modelo: z.string().trim().max(80).optional().nullable(),
    numeroSerie: z.string().trim().max(80).optional().nullable(),

    estoqueMinimo: z.coerce.number().min(0).default(0),
    estoqueIdeal: z.coerce.number().min(0).default(0),
    estoqueMaximo: z.coerce.number().min(0).default(0),
    estoqueAtual: z.coerce.number().min(0).default(0),

    localizacaoFisica: z.string().trim().max(150).optional().nullable(),
    codigoBarras: z.string().trim().max(80).optional().nullable(),
    qrCode: z.string().trim().max(80).optional().nullable(),

    fotoUrl: z.string().url().optional().nullable(),
  })
  .superRefine((dados, ctx) => {
    if (dados.estoqueMaximo > 0 && dados.estoqueMinimo > dados.estoqueMaximo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estoque mínimo não pode ser maior que o máximo",
        path: ["estoqueMinimo"],
      })
    }
  })

// ADMIN, GESTOR, SUPERVISOR e ALMOXARIFE podem cadastrar. SOLICITANTE não
// (mesmo papel que já é escondido do botão "Cadastrar item" no front).
export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const usuarioId = guard.user.id

  const body = await request.json().catch(() => ({}))
  const parsed = criarMaterialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const dados = parsed.data

  // =====================================================================
  // VALIDAÇÃO: unidade INTEIRA não aceita valores fracionados
  // =====================================================================

  const unidade = await prisma.unidadeMedida.findUnique({
    where: { id: dados.unidadeMedidaId }
  })

  if (!unidade) {
    return NextResponse.json(
      { error: "Unidade de medida não encontrada" },
      { status: 404 }
    )
  }

  if (unidade.tipo === "INTEIRA") {
    const valores = [
      dados.estoqueMinimo,
      dados.estoqueIdeal,
      dados.estoqueMaximo,
      dados.estoqueAtual
    ]
    const temFracao = valores.some((v) => v % 1 !== 0)
    if (temFracao) {
      return NextResponse.json(
        { error: `A unidade "${unidade.nome}" não aceita valores fracionados de estoque.` },
        { status: 400 }
      )
    }
  }

  // =====================================================================
  // FIM DA VALIDAÇÃO
  // =====================================================================

  try {
    const material = await prisma.$transaction(async (tx) => {
      // codigoInterno é @unique e não-nulo — usamos um placeholder só pra
      // satisfazer a constraint até sabermos o numeroSequencial real.
      const criado = await tx.material.create({
        data: {
          codigoInterno: `TMP-${randomUUID()}`,
          nome: dados.nome,
          descricao: dados.descricao || null,
          categoriaId: dados.categoriaId,
          unidadeMedidaId: dados.unidadeMedidaId,
          requerAprovacao: dados.requerAprovacao,
          marca: dados.marca || null,
          fabricante: dados.fabricante || null,
          modelo: dados.modelo || null,
          numeroSerie: dados.numeroSerie || null,
          estoqueMinimo: dados.estoqueMinimo,
          estoqueIdeal: dados.estoqueIdeal,
          estoqueMaximo: dados.estoqueMaximo,
          estoqueAtual: dados.estoqueAtual,
          localizacaoFisica: dados.localizacaoFisica || null,
          codigoBarras: dados.codigoBarras || null,
          qrCode: dados.qrCode || null,
          fotoUrl: dados.fotoUrl || null,
          criadoPorId: usuarioId,
        },
      })

      const codigoInterno = gerarCodigoInterno(criado.numeroSequencial)

      return tx.material.update({
        where: { id: criado.id },
        data: { codigoInterno },
        include: {
          categoria: { select: { id: true, nome: true } },
          unidadeMedida: { select: { id: true, sigla: true, nome: true } },
          criadoPor: { select: { id: true, name: true } },
        },
      })
    })

    return NextResponse.json(
      {
        material: {
          ...material,
          estoqueMinimo: Number(material.estoqueMinimo),
          estoqueIdeal: Number(material.estoqueIdeal),
          estoqueMaximo: Number(material.estoqueMaximo),
          estoqueAtual: Number(material.estoqueAtual),
        },
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const alvo = (err.meta?.target as string[] | undefined)?.join(", ")
      return NextResponse.json(
        { error: `Já existe um material com esse ${alvo ?? "valor único"}` },
        { status: 409 }
      )
    }
    throw err
  }
}

// =====================================================================
// tipos + mapeamento
// =====================================================================

interface RowMaterial {
  id: string
  numeroSequencial: number
  codigoInterno: string
  codigoBarras: string | null
  qrCode: string | null
  nome: string
  descricao: string | null
  marca: string | null
  fabricante: string | null
  modelo: string | null
  numeroSerie: string | null
  estoqueMinimo: string
  estoqueIdeal: string
  estoqueMaximo: string
  estoqueAtual: string
  localizacaoFisica: string | null
  situacao: "ATIVO" | "INATIVO"
  fotoUrl: string | null
  requerAprovacao: boolean
  createdAt: Date
  updatedAt: Date
  categoriaId: string
  categoriaNome: string
  unidadeMedidaId: string
  unidadeSigla: string
  unidadeNome: string
  criadoPorId: string
  criadoPorNome: string
}

interface ResumoRow {
  total: number
  inativos: number
  estoqueBaixo: number
  estoqueAlto: number
}

function mapearMaterial(row: RowMaterial) {
  return {
    id: row.id,
    numeroSequencial: row.numeroSequencial,
    codigoInterno: row.codigoInterno,
    codigoBarras: row.codigoBarras,
    qrCode: row.qrCode,
    nome: row.nome,
    descricao: row.descricao,
    marca: row.marca,
    fabricante: row.fabricante,
    modelo: row.modelo,
    numeroSerie: row.numeroSerie,
    estoqueMinimo: Number(row.estoqueMinimo),
    estoqueIdeal: Number(row.estoqueIdeal),
    estoqueMaximo: Number(row.estoqueMaximo),
    estoqueAtual: Number(row.estoqueAtual),
    localizacaoFisica: row.localizacaoFisica,
    situacao: row.situacao,
    fotoUrl: row.fotoUrl,
    requerAprovacao: row.requerAprovacao,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    categoria: { id: row.categoriaId, nome: row.categoriaNome },
    unidadeMedida: { id: row.unidadeMedidaId, sigla: row.unidadeSigla, nome: row.unidadeNome },
    criadoPor: { id: row.criadoPorId, nome: row.criadoPorNome },
  }
}

export type MaterialListado = ReturnType<typeof mapearMaterial>