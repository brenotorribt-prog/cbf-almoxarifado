// src/app/(app)/relatorios/page.tsx
//
// Página de Relatórios do Almoxarifado.
// Indicadores + gráficos de movimentações com filtros de período,
// categoria e tipo, e exportação em xlsx/csv/pdf.
//
// Arquitetura segue o padrão das demais páginas do sistema:
// - styled-components locais com o tema centralizado (@/styles/theme)
// - TanStack Query para cache/refetch dos dados
// - Estados de loading (skeleton), erro (retry) e vazio consistentes
// - Queries de agregação server-side em src/lib/relatorios.ts

"use client"

import { useMemo, useState } from "react"
import styled, { keyframes } from "styled-components"
import { useQuery } from "@tanstack/react-query"
import { theme, hexToRgba } from "@/styles/theme"
import {
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Inbox,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
} from "lucide-react"

import FiltroPeriodo, {
  validarPeriodo,
  type ValorPeriodo,
} from "@/components/relatorios/filtro-periodo"
import ExportarRelatorioButton from "@/components/relatorios/exportar-button"
import PessoasEstoque from "@/components/relatorios/pessoas-estoque"
import {
  GraficoEntradasSaidas,
  GraficoEvolucao,
  GraficoDistribuicaoTipos,
  GraficoTopMateriais,
  GraficoCategorias,
} from "@/components/relatorios/graficos"
import type {
  Granularidade,
  MaterialMovimentadoRow,
  CategoriaMovimentadaRow,
} from "@/lib/exportacoes/relatorios/relatorios"
import type { EstoquePessoaRow } from "@/lib/exportacoes/relatorios/relatorios-shared"

// =====================================================================
// TIPOS
// =====================================================================

interface RespostaRelatorio {
  periodo: {
    dataInicio: string
    dataFim: string
    granularidade: Granularidade
  }
  resumoPorTipo: Record<string, number>
  serie: {
    bucket: string
    entradas: number
    saidas: number
    ajustes: number
    descartes: number
    total: number
  }[]
  topMateriais: MaterialMovimentadoRow[]
  categorias: CategoriaMovimentadaRow[]
  estoqueAtual: {
    totalMateriais: number
    estoqueBaixo: number
    estoqueAlto: number
  }
  pessoas: EstoquePessoaRow[]
}

interface CategoriaOption {
  id: string
  nome: string
}

interface PessoaOption {
  id: string
  nome: string
}

type TipoFiltro = "ENTRADA" | "SAIDA" | "AJUSTE" | "DESCARTE" | "TODOS"

const LABEL_TIPO_FILTRO: Record<TipoFiltro, string> = {
  TODOS: "Todos os tipos",
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
  DESCARTE: "Descarte",
}

// =====================================================================
// HELPERS LOCAIS
// =====================================================================

/** Converte Date local para YYYY-MM-DD sem deslocamento de fuso. */
function paraISOLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

/** Período inicial da página: últimos 30 dias (mesmo default do preset). */
function resolverDatasIniciais(): { dataInicio: string; dataFim: string } {
  const fim = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 29)
  return { dataInicio: paraISOLocal(inicio), dataFim: paraISOLocal(fim) }
}

// =====================================================================
// COMPONENTE
// =====================================================================

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<ValorPeriodo>(() => ({
    preset: "30dias",
    ...resolverDatasIniciais(),
  }))
  const [categoriaId, setCategoriaId] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("TODOS")
  const [pessoaFiltro, setPessoaFiltro] = useState("")
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)

  const validacao = validarPeriodo(periodo.dataInicio, periodo.dataFim)

  // ---------------------------------------------------------------
  // Categorias para o filtro (cache longo — mudam raramente)
  // ---------------------------------------------------------------
  const categoriasQuery = useQuery({
    queryKey: ["categorias", "ativas"],
    queryFn: async (): Promise<CategoriaOption[]> => {
      const res = await fetch("/api/categorias?ativo=true")
      if (!res.ok) throw new Error("Falha ao carregar categorias")
      const data = await res.json()
      return data.categorias as CategoriaOption[]
    },
    staleTime: 1000 * 60 * 5,
  })

  // ---------------------------------------------------------------
  // Pessoas atendidas pro filtro (cadastro leve feito em Categorias)
  // ---------------------------------------------------------------
  const pessoasQuery = useQuery({
    queryKey: ["pessoas-atendidas", "filtro"],
    queryFn: async (): Promise<PessoaOption[]> => {
      const res = await fetch("/api/pessoas-atendidas")
      if (!res.ok) throw new Error("Falha ao carregar pessoas")
      const data = await res.json()
      return data.pessoas as PessoaOption[]
    },
    staleTime: 1000 * 60 * 5,
  })

  // ---------------------------------------------------------------
  // Dados agregados do relatório — um único request por combinação de filtros
  // ---------------------------------------------------------------
  const relatorioQuery = useQuery({
    queryKey: [
      "relatorios",
      periodo.dataInicio,
      periodo.dataFim,
      categoriaId,
      tipoFiltro,
      pessoaFiltro,
    ],
    queryFn: async (): Promise<RespostaRelatorio> => {
      const params = new URLSearchParams({
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      })
      if (categoriaId) params.set("categoriaId", categoriaId)
      if (tipoFiltro !== "TODOS") params.set("tipo", tipoFiltro)
      if (pessoaFiltro) params.set("pessoa", pessoaFiltro)

      const res = await fetch(`/api/relatorios?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Falha ao gerar o relatório")
      }
      return res.json()
    },
    enabled: validacao.valido,
    staleTime: 1000 * 60,
  })

  const dados = relatorioQuery.data ?? null
  const carregando = validacao.valido && relatorioQuery.isLoading
  const erro = validacao.valido ? relatorioQuery.error : null

  const totalMovimentacoes = dados
    ? Object.values(dados.resumoPorTipo).reduce((acc, n) => acc + n, 0)
    : 0

  // Query string compartilhada entre a exportação e os mesmos filtros da página
  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
    })
    if (categoriaId) params.set("categoriaId", categoriaId)
    if (tipoFiltro !== "TODOS") params.set("tipo", tipoFiltro)
    if (pessoaFiltro) params.set("pessoa", pessoaFiltro)
    return params.toString()
  }, [periodo.dataInicio, periodo.dataFim, categoriaId, tipoFiltro, pessoaFiltro])

  function recarregar() {
    relatorioQuery.refetch()
  }

  return (
    <PageWrapper>
      {/* ==================== CABEÇALHO ==================== */}
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <BarChart3 size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>Análise</Breadcrumb>
            <Title>Relatórios</Title>
            <Subtitle>
              Indicadores e gráficos de movimentação de materiais, com filtros de período e
              exportação.
            </Subtitle>
          </div>
        </HeaderLeft>

        <HeaderActions>
          <RefreshButton onClick={recarregar} title="Atualizar" disabled={carregando}>
            <RefreshCw size={16} className={carregando ? "spin" : undefined} />
          </RefreshButton>
          <ExportarRelatorioButton
            queryString={queryString}
            disabled={!validacao.valido || totalMovimentacoes === 0}
            onErro={setErroExportacao}
          />
        </HeaderActions>
      </HeaderRow>

      {erroExportacao && (
        <AvisoBarra $tipo="erro">
          <AlertTriangle size={16} />
          <span>{erroExportacao}</span>
          <FecharAviso type="button" onClick={() => setErroExportacao(null)}>
            Fechar
          </FecharAviso>
        </AvisoBarra>
      )}

      {/* ==================== FILTROS ==================== */}
      <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

      <Toolbar>
        <SelectFiltro
          aria-label="Filtrar por categoria"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {(categoriasQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </SelectFiltro>

        <SelectFiltro
          aria-label="Filtrar por tipo de movimentação"
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
        >
          {(Object.keys(LABEL_TIPO_FILTRO) as TipoFiltro[]).map((tipo) => (
            <option key={tipo} value={tipo}>
              {LABEL_TIPO_FILTRO[tipo]}
            </option>
          ))}
        </SelectFiltro>

        <SelectFiltro
          aria-label="Filtrar por pessoa"
          value={pessoaFiltro}
          onChange={(e) => setPessoaFiltro(e.target.value)}
        >
          <option value="">Todas as pessoas</option>
          {(pessoasQuery.data ?? []).map((p) => (
            <option key={p.id} value={p.nome}>
              {p.nome}
            </option>
          ))}
        </SelectFiltro>
      </Toolbar>

      {!validacao.valido && (
        <AvisoBarra $tipo="erro">
          <AlertTriangle size={16} />
          <span>{validacao.mensagem}</span>
        </AvisoBarra>
      )}

      {/* ==================== CONTEÚDO ==================== */}
      {carregando && <CarregandoSkeleton />}

      {!carregando && erro && (
        <ErrorState>
          <AlertTriangle size={32} />
          <span>{erro instanceof Error ? erro.message : "Não foi possível gerar o relatório."}</span>
          <RetryButton onClick={recarregar}>
            <RefreshCw size={14} />
            Tentar novamente
          </RetryButton>
        </ErrorState>
      )}

      {!carregando && !erro && dados && totalMovimentacoes === 0 && (
        <EmptyCard>
          <Inbox size={32} />
          <span>Nenhuma movimentação encontrada para o período e filtros selecionados.</span>
          <DicaVazio>Tente ampliar o período ou remover os filtros aplicados.</DicaVazio>
        </EmptyCard>
      )}

      {!carregando && !erro && dados && totalMovimentacoes > 0 && (
        <>
          {/* KPIs do período */}
          <StatsGrid>
            <StatCard $accent={theme.colors.primary.vivid}>
              <StatIconWrap $cor={theme.colors.primary.vivid}>
                <BarChart3 size={18} />
              </StatIconWrap>
              <StatValue>{totalMovimentacoes}</StatValue>
              <StatLabel>Movimentações no período</StatLabel>
            </StatCard>

            <StatCard $accent={theme.colors.status.success}>
              <StatIconWrap $cor={theme.colors.status.success}>
                <ArrowDownCircle size={18} />
              </StatIconWrap>
              <StatValue>{dados.resumoPorTipo.ENTRADA ?? 0}</StatValue>
              <StatLabel>Entradas</StatLabel>
            </StatCard>

            <StatCard $accent={theme.colors.status.error}>
              <StatIconWrap $cor={theme.colors.status.error}>
                <ArrowUpCircle size={18} />
              </StatIconWrap>
              <StatValue>{dados.resumoPorTipo.SAIDA ?? 0}</StatValue>
              <StatLabel>Saídas</StatLabel>
            </StatCard>

            <StatCard $accent={theme.colors.status.purple}>
              <StatIconWrap $cor={theme.colors.status.purple}>
                <SlidersHorizontal size={18} />
              </StatIconWrap>
              <StatValue>
                {(dados.resumoPorTipo.AJUSTE ?? 0) + (dados.resumoPorTipo.DESCARTE ?? 0)}
              </StatValue>
              <StatLabel>Ajustes e descartes</StatLabel>
            </StatCard>

            <StatCard $accent={theme.colors.status.warning}>
              <StatIconWrap $cor={theme.colors.status.warning}>
                <Package size={18} />
              </StatIconWrap>
              <StatValue>{dados.estoqueAtual.estoqueBaixo}</StatValue>
              <StatLabel>Materiais c/ estoque baixo</StatLabel>
              <StatHint>Snapshot atual do estoque</StatHint>
            </StatCard>
          </StatsGrid>

          {/* Gráficos */}
          <GraficosGrid>
            <GraficoLargo>
              <GraficoEntradasSaidas serie={dados.serie} granularidade={dados.periodo.granularidade} />
            </GraficoLargo>

            <GraficoLargo>
              <GraficoEvolucao serie={dados.serie} granularidade={dados.periodo.granularidade} />
            </GraficoLargo>

            <GraficoDistribuicaoTipos resumoPorTipo={dados.resumoPorTipo} />
            <GraficoTopMateriais materiais={dados.topMateriais} />

            <GraficoLargo>
              <GraficoCategorias categorias={dados.categorias} />
            </GraficoLargo>
          </GraficosGrid>

          {/* Estoque pessoal por pessoa (quem pegou o quê no período) */}
          {dados.pessoas.length > 0 && <PessoasEstoque pessoas={dados.pessoas} />}
        </>
      )}
    </PageWrapper>
  )
}

// =====================================================================
// SKELETON DE CARREGAMENTO
// =====================================================================

function CarregandoSkeleton() {
  return (
    <>
      <StatsGrid>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBox key={i} style={{ height: 110 }} />
        ))}
      </StatsGrid>
      <GraficosGrid>
        <GraficoLargo>
          <SkeletonBox style={{ height: 340 }} />
        </GraficoLargo>
        <GraficoLargo>
          <SkeletonBox style={{ height: 340 }} />
        </GraficoLargo>
        <SkeletonBox style={{ height: 360 }} />
        <SkeletonBox style={{ height: 360 }} />
        <GraficoLargo>
          <SkeletonBox style={{ height: 300 }} />
        </GraficoLargo>
      </GraficosGrid>
    </>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const spin = keyframes`to { transform: rotate(360deg); }`
const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

const PageWrapper = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.contentPadding};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
`

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-wrap: wrap;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
`

const HeaderBadge = styled.div`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${hexToRgba(theme.colors.primary.vivid, 0.12)};
  color: ${({ theme }) => theme.colors.primary.vivid};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`

const Breadcrumb = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-top: ${({ theme }) => theme.spacing[1]};
`

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing[1]};
  max-width: 520px;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.card};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.muted};
  cursor: pointer;
  flex-shrink: 0;
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) { color: ${({ theme }) => theme.colors.text.primary}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  .spin { animation: ${spin} 0.8s linear infinite; }
`

const AvisoBarra = styled.div<{ $tipo: "erro" }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${hexToRgba(theme.colors.status.error, 0.1)};
  border: 1px solid ${hexToRgba(theme.colors.status.error, 0.25)};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  svg { color: ${({ theme }) => theme.colors.status.error}; flex-shrink: 0; }
`

const FecharAviso = styled.button`
  margin-left: auto;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  cursor: pointer;

  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
`

const Toolbar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`

const SelectFiltro = styled.select`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-family: inherit;
  min-width: 200px;
  color-scheme: dark;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.vivid};
  }
`

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`

const StatCard = styled.div<{ $accent: string }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: ${({ $accent }) => $accent};
  }
`

const StatIconWrap = styled.div<{ $cor: string }>`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ $cor }) => hexToRgba($cor, 0.12)};
  color: ${({ $cor }) => $cor};
  display: flex;
  align-items: center;
  justify-content: center;
`

const StatValue = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: 1;
  font-variant-numeric: tabular-nums;
`

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const StatHint = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: ${({ theme }) => theme.spacing[1]};
`

const GraficosGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
  }
`

const GraficoLargo = styled.div`
  grid-column: 1 / -1;
`

const SkeletonBox = styled.div`
  border-radius: ${({ theme }) => theme.radii.lg};
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.surface.glass} 25%,
    rgba(255, 255, 255, 0.08) 50%,
    ${({ theme }) => theme.colors.surface.glass} 75%
  );
  background-size: 800px 100%;
  animation: ${shimmer} 1.4s linear infinite;
`

const ErrorState = styled.div`
  ${glassCardStyles}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[4]};
  min-height: 320px;
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
  padding: ${({ theme }) => theme.spacing[8]};

  svg { color: ${({ theme }) => theme.colors.status.error}; }
`

const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;

  &:hover { background: ${({ theme }) => theme.colors.surface.card}; }
`

const EmptyCard = styled.div`
  ${glassCardStyles}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[10]};
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
`

const DicaVazio = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.onDarkMuted};
`
