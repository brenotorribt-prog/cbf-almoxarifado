// src/lib/relatorios.ts
//
// Camada de dados dos Relatórios do Almoxarifado.
// Centraliza tipos, validação de filtros e queries de agregação usadas
// tanto pela rota de leitura (/api/relatorios) quanto pela de exportação
// (/api/relatorios/exportar) — evita duplicação de SQL entre as duas.
//
// Segue o mesmo padrão de src/lib/compras-export.ts (busca de dados
// separada dos geradores de arquivo).

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { Prisma, TipoMovimentacao } from "@prisma/client"

// =====================================================================
// CONSTANTES
// =====================================================================

/** Amplitude máxima aceita para um relatório (1 ano). */
export const MAX_DIAS_RELATORIO = 366

/** Teto de linhas na exportação detalhada (proteção contra consultas gigantes). */
export const LIMITE_LINHAS_EXPORTACAO = 10000

// =====================================================================
// TIPOS
// =====================================================================

export type Granularidade = "hora" | "dia" | "semana" | "mes"

export interface FiltrosRelatorio {
  dataInicio: Date // início do dia (00:00:00)
  dataFim: Date // fim do dia (23:59:59.999)
  categoriaId?: string
  tipo?: TipoMovimentacao
}

export interface ResumoTipoRow {
  tipo: string
  total: number
}

export interface SerieTemporalPonto {
  bucket: string // ISO string do início do bucket
  entradas: number
  saidas: number
  ajustes: number
  descartes: number
  total: number
}

export interface MaterialMovimentadoRow {
  id: string
  nome: string
  codigoInterno: string
  unidadeSigla: string
  movimentacoes: number
  entradas: number
  saidas: number
}

export interface CategoriaMovimentadaRow {
  id: string
  nome: string
  movimentacoes: number
  entradas: number
  saidas: number
}

export interface EstoqueAtualResumo {
  totalMateriais: number
  estoqueBaixo: number
  estoqueAlto: number
}

export interface MovimentacaoDetalhadaRow {
  id: string
  tipo: string
  quantidade: number
  quantidadeAnterior: number
  quantidadeAtual: number
  motivo: string | null
  documentoReferencia: string | null
  solicitanteNome: string | null
  solicitanteSetor: string | null
  createdAt: Date
  materialNome: string
  codigoInterno: string
  unidadeSigla: string
  categoriaNome: string
  usuarioNome: string
}

// =====================================================================
// LABELS compartilhados entre página, exportações e PDFs
// =====================================================================

export const LABEL_TIPO_MOV: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
  DESCARTE: "Descarte",
}

// =====================================================================
// VALIDAÇÃO DE FILTROS (usada pelas duas rotas)
// =====================================================================

const filtrosSchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida"),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida"),
  categoriaId: z.string().trim().min(1).optional(),
  tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE", "DESCARTE"]).optional(),
})

export type ResultadoParseFiltros =
  | { ok: true; filtros: FiltrosRelatorio }
  | { ok: false; erro: string }

/**
 * Interpreta os query params das rotas de relatório.
 * Datas vêm como YYYY-MM-DD e são convertidas para o intervalo completo
 * do dia (início 00:00:00 / fim 23:59:59.999) — mesmo padrão da rota
 * de exportação de compras.
 */
export function parseFiltrosRelatorio(searchParams: URLSearchParams): ResultadoParseFiltros {
  const parsed = filtrosSchema.safeParse({
    dataInicio: searchParams.get("dataInicio") ?? undefined,
    dataFim: searchParams.get("dataFim") ?? undefined,
    categoriaId: searchParams.get("categoriaId")?.trim() || undefined,
    tipo: searchParams.get("tipo") || undefined,
  })

  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Filtros inválidos." }
  }

  const { dataInicio, dataFim, categoriaId, tipo } = parsed.data

  const inicio = new Date(`${dataInicio}T00:00:00.000`)
  const fim = new Date(`${dataFim}T23:59:59.999`)

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    return { ok: false, erro: "Datas inválidas." }
  }
  if (inicio > fim) {
    return { ok: false, erro: "A data inicial não pode ser depois da data final." }
  }

  const dias = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  if (dias > MAX_DIAS_RELATORIO) {
    return { ok: false, erro: `O período não pode exceder ${MAX_DIAS_RELATORIO} dias.` }
  }

  return { ok: true, filtros: { dataInicio: inicio, dataFim: fim, categoriaId, tipo } }
}

// =====================================================================
// GRANULARIDADE DA SÉRIE TEMPORAL
// =====================================================================

/**
 * Escolhe o bucket temporal conforme a amplitude do período:
 * até 1 dia -> hora; até ~2 meses -> dia; até ~6 meses -> semana;
 * acima disso -> mês. Mantém o número de pontos sempre legível.
 */
export function calcularGranularidade(dataInicio: Date, dataFim: Date): Granularidade {
  const dias = (dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)
  if (dias <= 1) return "hora"
  if (dias <= 62) return "dia"
  if (dias <= 180) return "semana"
  return "mes"
}

// Whitelist de expressões date_trunc — evita montar SQL dinâmico com
// valores externos (a granularidade nunca vem direto do cliente).
const TRUNC_POR_GRANULARIDADE: Record<Granularidade, Prisma.Sql> = {
  hora: Prisma.sql`date_trunc('hour', m."createdAt")`,
  dia: Prisma.sql`date_trunc('day', m."createdAt")`,
  semana: Prisma.sql`date_trunc('week', m."createdAt")`,
  mes: Prisma.sql`date_trunc('month', m."createdAt")`,
}

// =====================================================================
// CONDIÇÕES DE FILTRO COMPARTILHADAS
// =====================================================================

function condicoesBase(filtros: FiltrosRelatorio): Prisma.Sql[] {
  const condicoes: Prisma.Sql[] = [
    Prisma.sql`m."createdAt" >= ${filtros.dataInicio}`,
    Prisma.sql`m."createdAt" <= ${filtros.dataFim}`,
  ]
  if (filtros.categoriaId) {
    condicoes.push(Prisma.sql`mat."categoriaId" = ${filtros.categoriaId}`)
  }
  if (filtros.tipo) {
    condicoes.push(Prisma.sql`m.tipo = ${filtros.tipo}::"TipoMovimentacao"`)
  }
  return condicoes
}

function whereClause(filtros: FiltrosRelatorio): Prisma.Sql {
  return Prisma.sql`WHERE ${Prisma.join(condicoesBase(filtros), " AND ")}`
}

// =====================================================================
// QUERIES DE AGREGAÇÃO
// =====================================================================

/** Contagem de movimentações por tipo dentro do período/filtros. */
export async function buscarResumoPorTipo(
  filtros: FiltrosRelatorio
): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ tipo: string; total: number }[]>(Prisma.sql`
    SELECT m.tipo::text as tipo, COUNT(*)::int as total
    FROM "MovimentacaoEstoque" m
    JOIN "Material" mat ON mat.id = m."materialId"
    ${whereClause(filtros)}
    GROUP BY m.tipo
  `)

  const resumo: Record<string, number> = { ENTRADA: 0, SAIDA: 0, AJUSTE: 0, DESCARTE: 0 }
  for (const row of rows) resumo[row.tipo] = row.total
  return resumo
}

/** Série temporal de movimentações agrupada pela granularidade calculada. */
export async function buscarSerieTemporal(
  filtros: FiltrosRelatorio,
  granularidade: Granularidade
): Promise<SerieTemporalPonto[]> {
  const trunc = TRUNC_POR_GRANULARIDADE[granularidade]

  const rows = await prisma.$queryRaw<
    {
      bucket: Date
      entradas: number
      saidas: number
      ajustes: number
      descartes: number
      total: number
    }[]
  >(Prisma.sql`
    SELECT
      ${trunc} as bucket,
      COUNT(*) FILTER (WHERE m.tipo = 'ENTRADA')::int as entradas,
      COUNT(*) FILTER (WHERE m.tipo = 'SAIDA')::int as saidas,
      COUNT(*) FILTER (WHERE m.tipo = 'AJUSTE')::int as ajustes,
      COUNT(*) FILTER (WHERE m.tipo = 'DESCARTE')::int as descartes,
      COUNT(*)::int as total
    FROM "MovimentacaoEstoque" m
    JOIN "Material" mat ON mat.id = m."materialId"
    ${whereClause(filtros)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `)

  return rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    entradas: r.entradas,
    saidas: r.saidas,
    ajustes: r.ajustes,
    descartes: r.descartes,
    total: r.total,
  }))
}

/** Materiais mais movimentados no período (rankeados por nº de movimentações). */
export async function buscarTopMateriais(
  filtros: FiltrosRelatorio,
  limite = 8
): Promise<MaterialMovimentadoRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string
      nome: string
      codigoInterno: string
      unidadeSigla: string
      movimentacoes: number
      entradas: number
      saidas: number
    }[]
  >(Prisma.sql`
    SELECT
      mat.id, mat.nome, mat."codigoInterno", u.sigla as "unidadeSigla",
      COUNT(*)::int as movimentacoes,
      COUNT(*) FILTER (WHERE m.tipo = 'ENTRADA')::int as entradas,
      COUNT(*) FILTER (WHERE m.tipo = 'SAIDA')::int as saidas
    FROM "MovimentacaoEstoque" m
    JOIN "Material" mat ON mat.id = m."materialId"
    JOIN "UnidadeMedida" u ON u.id = mat."unidadeMedidaId"
    ${whereClause(filtros)}
    GROUP BY mat.id, mat.nome, mat."codigoInterno", u.sigla
    ORDER BY movimentacoes DESC, mat.nome ASC
    LIMIT ${limite}
  `)

  return rows
}

/** Categorias mais movimentadas no período. */
export async function buscarCategoriasMovimentadas(
  filtros: FiltrosRelatorio
): Promise<CategoriaMovimentadaRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string
      nome: string
      movimentacoes: number
      entradas: number
      saidas: number
    }[]
  >(Prisma.sql`
    SELECT
      c.id, c.nome,
      COUNT(*)::int as movimentacoes,
      COUNT(*) FILTER (WHERE m.tipo = 'ENTRADA')::int as entradas,
      COUNT(*) FILTER (WHERE m.tipo = 'SAIDA')::int as saidas
    FROM "MovimentacaoEstoque" m
    JOIN "Material" mat ON mat.id = m."materialId"
    JOIN "Categoria" c ON c.id = mat."categoriaId"
    ${whereClause(filtros)}
    GROUP BY c.id, c.nome
    ORDER BY movimentacoes DESC, c.nome ASC
  `)

  return rows
}

/** Snapshot atual do estoque (independe do período — usado nos KPIs). */
export async function buscarResumoEstoqueAtual(): Promise<EstoqueAtualResumo> {
  const [row] = await prisma.$queryRaw<{ totalMateriais: number; estoqueBaixo: number; estoqueAlto: number }[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE situacao = 'ATIVO')::int as "totalMateriais",
      COUNT(*) FILTER (WHERE situacao = 'ATIVO' AND "estoqueAtual" < "estoqueMinimo")::int as "estoqueBaixo",
      COUNT(*) FILTER (WHERE situacao = 'ATIVO' AND "estoqueAtual" > "estoqueMaximo")::int as "estoqueAlto"
    FROM "Material"
  `)

  return (
    row ?? {
      totalMateriais: 0,
      estoqueBaixo: 0,
      estoqueAlto: 0,
    }
  )
}

// =====================================================================
// DETALHAMENTO PARA EXPORTAÇÃO
// =====================================================================

/**
 * Lista detalhada das movimentações do período (uma linha por movimentação),
 * ordenada cronologicamente — base dos arquivos xlsx/csv/pdf.
 * Limitada a LIMITE_LINHAS_EXPORTACAO registros.
 */
export async function buscarMovimentacoesDetalhadas(
  filtros: FiltrosRelatorio
): Promise<MovimentacaoDetalhadaRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string
      tipo: string
      quantidade: string
      quantidadeAnterior: string
      quantidadeAtual: string
      motivo: string | null
      documentoReferencia: string | null
      solicitanteNome: string | null
      solicitanteSetor: string | null
      createdAt: Date
      materialNome: string
      codigoInterno: string
      unidadeSigla: string
      categoriaNome: string
      usuarioNome: string
    }[]
  >(Prisma.sql`
    SELECT
      m.id, m.tipo::text as tipo,
      m.quantidade::float8 as quantidade,
      m."quantidadeAnterior"::float8 as "quantidadeAnterior",
      m."quantidadeAtual"::float8 as "quantidadeAtual",
      m.motivo, m."documentoReferencia",
      m."solicitanteNome", m."solicitanteSetor",
      m."createdAt",
      mat.nome as "materialNome", mat."codigoInterno",
      u.sigla as "unidadeSigla",
      c.nome as "categoriaNome",
      usr.name as "usuarioNome"
    FROM "MovimentacaoEstoque" m
    JOIN "Material" mat ON mat.id = m."materialId"
    JOIN "UnidadeMedida" u ON u.id = mat."unidadeMedidaId"
    JOIN "Categoria" c ON c.id = mat."categoriaId"
    JOIN "User" usr ON usr.id = m."usuarioId"
    ${whereClause(filtros)}
    ORDER BY m."createdAt" ASC
    LIMIT ${LIMITE_LINHAS_EXPORTACAO + 1}
  `)

  return rows.slice(0, LIMITE_LINHAS_EXPORTACAO).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    quantidade: Number(r.quantidade),
    quantidadeAnterior: Number(r.quantidadeAnterior),
    quantidadeAtual: Number(r.quantidadeAtual),
    motivo: r.motivo,
    documentoReferencia: r.documentoReferencia,
    solicitanteNome: r.solicitanteNome,
    solicitanteSetor: r.solicitanteSetor,
    createdAt: r.createdAt,
    materialNome: r.materialNome,
    codigoInterno: r.codigoInterno,
    unidadeSigla: r.unidadeSigla,
    categoriaNome: r.categoriaNome,
    usuarioNome: r.usuarioNome,
  }))
}

// =====================================================================
// HELPERS DE ARQUIVO
// =====================================================================

export function nomeArquivoRelatorio(extensao: string): string {
  const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `relatorio-movimentacoes-${stamp}.${extensao}`
}

export function formatarDataSimples(data: Date | string | null): string {
  if (!data) return ""
  const d = typeof data === "string" ? new Date(data) : data
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatarDataHoraExportacao(data: Date | string): string {
  const d = typeof data === "string" ? new Date(data) : data
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}