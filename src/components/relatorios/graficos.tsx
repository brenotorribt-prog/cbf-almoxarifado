// src/components/relatorios/graficos.tsx
//
// Gráficos da página de Relatórios (recharts), estilizados com o tema do
// sistema. Cada componente é auto-contido: card de vidro + título + gráfico
// responsivo + estado vazio próprio.
//
// Cores por tipo seguem o padrão da página /movimentacoes:
//   ENTRADA -> success (verde) · SAIDA -> error (vermelho)
//   AJUSTE -> info (azul)      · DESCARTE -> purple

"use client"

import styled from "styled-components"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, Trash2 } from "lucide-react"
import { theme, hexToRgba } from "@/styles/theme"
import type {
  Granularidade,
  SerieTemporalPonto,
  MaterialMovimentadoRow,
  CategoriaMovimentadaRow,
} from "@/lib/exportacoes/relatorios/relatorios"

// =====================================================================
// CONFIGURAÇÃO VISUAL COMPARTILHADA
// =====================================================================

const COR_ENTRADA = theme.colors.status.success
const COR_SAIDA = theme.colors.status.error
const COR_AJUSTE = theme.colors.status.info
const COR_DESCARTE = theme.colors.status.purple
const COR_EIXO = theme.colors.text.muted
const COR_GRID = theme.colors.surface.border

const ALTURA_GRAFICO = 280

const tooltipStyles = {
  background: theme.colors.surface.sidebar,
  border: `1px solid ${theme.colors.surface.border}`,
  borderRadius: theme.radii.md,
  fontSize: theme.typography.fontSize.xs,
  padding: "8px 12px",
}

interface ItemTooltip {
  name?: string | number
  value?: number | string
  color?: string
}

/** Tooltip escuro no padrão do tema (substitui o branco default do recharts). */
function TooltipTema({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ItemTooltip[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyles}>
      <div style={{ color: theme.colors.text.primary, marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      {payload.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: theme.colors.text.secondary }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
          <span>{item.name}:</span>
          <strong style={{ color: theme.colors.text.primary }}>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

const eixoComum = {
  stroke: COR_EIXO,
  tick: { fill: COR_EIXO, fontSize: 11 },
  tickLine: false,
} as const

// =====================================================================
// CARD GENÉRICO DE GRÁFICO
// =====================================================================

interface CardGraficoProps {
  titulo: string
  icone: React.ReactNode
  vazio: boolean
  mensagemVazio: string
  children: React.ReactNode
}

function CardGrafico({ titulo, icone, vazio, mensagemVazio, children }: CardGraficoProps) {
  return (
    <CardWrapper>
      <CardHeader>
        <CardTitle>{icone}{titulo}</CardTitle>
      </CardHeader>
      <CardBody>
        {vazio ? <EmptyMessage>{mensagemVazio}</EmptyMessage> : children}
      </CardBody>
    </CardWrapper>
  )
}

// =====================================================================
// HELPERS DE FORMATAÇÃO DOS BUCKETS TEMPORAIS
// =====================================================================

function formatarBucket(iso: string, granularidade: Granularidade): string {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, "0")
  const mes = String(d.getMonth() + 1).padStart(2, "0")

  switch (granularidade) {
    case "hora":
      return `${dia}/${mes} ${String(d.getHours()).padStart(2, "0")}h`
    case "semana":
      return `sem. ${dia}/${mes}`
    case "mes":
      return `${mes}/${d.getFullYear()}`
    default:
      return `${dia}/${mes}`
  }
}

/** Reduz o número de ticks exibidos para períodos longos ficarem legíveis. */
function intervaloTicks(pontos: number): number {
  if (pontos <= 14) return 0
  if (pontos <= 31) return 2
  if (pontos <= 62) return 5
  return 10
}

// =====================================================================
// 1. ENTRADAS × SAÍDAS (barras agrupadas por bucket temporal)
// =====================================================================

export function GraficoEntradasSaidas({
  serie,
  granularidade,
}: {
  serie: SerieTemporalPonto[]
  granularidade: Granularidade
}) {
  const dados = serie.map((p) => ({
    ...p,
    label: formatarBucket(p.bucket, granularidade),
  }))
  const temDados = dados.some((d) => d.total > 0)

  return (
    <CardGrafico
      titulo={`Entradas × Saídas (${granularidade === "hora" ? "por hora" : granularidade === "semana" ? "por semana" : granularidade === "mes" ? "por mês" : "por dia"})`}
      icone={<ArrowDownCircle size={16} />}
      vazio={!temDados}
      mensagemVazio="Nenhuma entrada ou saída registrada neste período."
    >
      <ResponsiveContainer width="100%" height={ALTURA_GRAFICO}>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          <XAxis dataKey="label" interval={intervaloTicks(dados.length)} angle={dados.length > 20 ? -35 : 0} height={dados.length > 20 ? 52 : 30} textAnchor={dados.length > 20 ? "end" : "middle"} {...eixoComum} />
          <YAxis allowDecimals={false} {...eixoComum} />
          <Tooltip content={<TooltipTema />} cursor={{ fill: hexToRgba("#ffffff", 0.04) }} />
          <Legend wrapperStyle={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }} />
          <Bar name="Entradas" dataKey="entradas" fill={COR_ENTRADA} radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar name="Saídas" dataKey="saidas" fill={COR_SAIDA} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </CardGrafico>
  )
}

// =====================================================================
// 2. EVOLUÇÃO DO VOLUME TOTAL (área por bucket temporal)
// =====================================================================

export function GraficoEvolucao({
  serie,
  granularidade,
}: {
  serie: SerieTemporalPonto[]
  granularidade: Granularidade
}) {
  const dados = serie.map((p) => ({
    ...p,
    label: formatarBucket(p.bucket, granularidade),
  }))
  const temDados = dados.some((d) => d.total > 0)

  return (
    <CardGrafico
      titulo="Evolução das movimentações"
      icone={<SlidersHorizontal size={16} />}
      vazio={!temDados}
      mensagemVazio="Nenhuma movimentação registrada neste período."
    >
      <ResponsiveContainer width="100%" height={ALTURA_GRAFICO}>
        <AreaChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.colors.primary.vivid} stopOpacity={0.45} />
              <stop offset="100%" stopColor={theme.colors.primary.vivid} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          <XAxis dataKey="label" interval={intervaloTicks(dados.length)} {...eixoComum} />
          <YAxis allowDecimals={false} {...eixoComum} />
          <Tooltip content={<TooltipTema />} />
          <Area
            name="Movimentações"
            type="monotone"
            dataKey="total"
            stroke={theme.colors.primary.vivid}
            strokeWidth={2}
            fill="url(#gradTotal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </CardGrafico>
  )
}

// =====================================================================
// 3. DISTRIBUIÇÃO POR TIPO (donut)
// =====================================================================

const CORES_TIPO: Record<string, string> = {
  ENTRADA: COR_ENTRADA,
  SAIDA: COR_SAIDA,
  AJUSTE: COR_AJUSTE,
  DESCARTE: COR_DESCARTE,
}

const LABELS_TIPO: Record<string, string> = {
  ENTRADA: "Entradas",
  SAIDA: "Saídas",
  AJUSTE: "Ajustes",
  DESCARTE: "Descartes",
}

export function GraficoDistribuicaoTipos({ resumoPorTipo }: { resumoPorTipo: Record<string, number> }) {
  const dados = Object.entries(resumoPorTipo)
    .map(([tipo, total]) => ({ tipo, total, nome: LABELS_TIPO[tipo] ?? tipo }))
    .filter((d) => d.total > 0)

  const totalGeral = dados.reduce((acc, d) => acc + d.total, 0)

  return (
    <CardGrafico
      titulo="Distribuição por tipo"
      icone={<Trash2 size={16} />}
      vazio={totalGeral === 0}
      mensagemVazio="Nenhuma movimentação registrada neste período."
    >
      <ResponsiveContainer width="100%" height={ALTURA_GRAFICO}>
        <PieChart>
          <Pie
            data={dados}
            dataKey="total"
            nameKey="nome"
            cx="50%"
            cy="46%"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={3}
            strokeWidth={0}
          >
            {dados.map((d) => (
              <Cell key={d.tipo} fill={CORES_TIPO[d.tipo] ?? theme.colors.neutral[500]} />
            ))}
          </Pie>
          <Tooltip content={<TooltipTema />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(valor) => (
              <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}>
                {valor}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </CardGrafico>
  )
}

// =====================================================================
// 4. TOP MATERIAIS (barras horizontais)
// =====================================================================

export function GraficoTopMateriais({ materiais }: { materiais: MaterialMovimentadoRow[] }) {
  const temDados = materiais.length > 0

  return (
    <CardGrafico
      titulo="Materiais mais movimentados"
      icone={<ArrowUpCircle size={16} />}
      vazio={!temDados}
      mensagemVazio="Nenhum material movimentado neste período."
    >
      <ResponsiveContainer width="100%" height={Math.max(ALTURA_GRAFICO, materiais.length * 34)}>
        <BarChart data={materiais} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...eixoComum} />
          <YAxis
            type="category"
            dataKey="nome"
            width={150}
            tickFormatter={(nome: string) => (nome.length > 22 ? `${nome.slice(0, 21)}…` : nome)}
            {...eixoComum}
          />
          <Tooltip content={<TooltipTema />} cursor={{ fill: hexToRgba("#ffffff", 0.04) }} />
          <Bar name="Movimentações" dataKey="movimentacoes" fill={theme.colors.primary.vivid} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </CardGrafico>
  )
}

// =====================================================================
// 5. CATEGORIAS MAIS MOVIMENTADAS (barras horizontais empilhadas)
// =====================================================================

export function GraficoCategorias({ categorias }: { categorias: CategoriaMovimentadaRow[] }) {
  const temDados = categorias.length > 0

  return (
    <CardGrafico
      titulo="Categorias mais movimentadas"
      icone={<ArrowDownCircle size={16} />}
      vazio={!temDados}
      mensagemVazio="Nenhuma categoria movimentada neste período."
    >
      <ResponsiveContainer width="100%" height={Math.max(220, categorias.length * 40)}>
        <BarChart data={categorias} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...eixoComum} />
          <YAxis
            type="category"
            dataKey="nome"
            width={150}
            tickFormatter={(nome: string) => (nome.length > 22 ? `${nome.slice(0, 21)}…` : nome)}
            {...eixoComum}
          />
          <Tooltip content={<TooltipTema />} cursor={{ fill: hexToRgba("#ffffff", 0.04) }} />
          <Legend wrapperStyle={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }} />
          <Bar name="Entradas" dataKey="entradas" stackId="cat" fill={COR_ENTRADA} radius={[0, 0, 0, 0]} maxBarSize={18} />
          <Bar name="Saídas" dataKey="saidas" stackId="cat" fill={COR_SAIDA} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </CardGrafico>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

const CardWrapper = styled.div`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  min-width: 0;
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const CardTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};

  svg { color: ${({ theme }) => theme.colors.primary.vivid}; flex-shrink: 0; }
`

const CardBody = styled.div`
  min-width: 0;
`

const EmptyMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: ${ALTURA_GRAFICO}px;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
  padding: ${({ theme }) => theme.spacing[4]};
`