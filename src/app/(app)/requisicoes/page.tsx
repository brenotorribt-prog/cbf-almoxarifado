"use client"

/**
 * /requisicoes — Central de requisições
 * ------------------------------------------------------------------
 * Lista os pedidos (SAIDA / EMPRESTIMO / TRANSFERENCIA), separados por
 * status agregado e prioridade. Clicar num card abre o detalhe (itens
 * individuais + ações). SOLICITANTE só vê as próprias requisições — a API
 * já filtra isso, aqui só escondemos o que não faz sentido pro papel.
 */

import { useState, useEffect, useCallback } from "react"
import styled, { keyframes } from "styled-components"
import { useInfiniteQuery } from "@tanstack/react-query"
import { theme, hexToRgba } from "@/styles/theme"
import { createClient } from "@/lib/client"
import {
  ClipboardList,
  Plus,
  Search,
  Loader2,
  Inbox,
  AlertTriangle,
  RefreshCw,
  Hash,
  Clock,
  UserRound,
  Users,
  ChevronDown,
  ArrowRightLeft,
  HandCoins,
  PackageMinus,
} from "lucide-react"
import NovaRequisicaoModal from "@/components/requisicoes/modals/nova-requisicao"
import RequisicaoDetalheModal from "@/components/requisicoes/modals/detalhes"

// =====================================================================
// TIPOS
// =====================================================================

type StatusSolicitacao = "PENDENTE" | "AGUARDANDO_APROVACAO" | "EM_ANDAMENTO" | "PRONTO" | "ENTREGUE" | "CANCELADA"
type TipoSolicitacao = "SAIDA" | "EMPRESTIMO" | "TRANSFERENCIA"
type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"
type StatusItem =
  | "PENDENTE"
  | "AGUARDANDO_APROVACAO_SUPERIOR"
  | "APROVADO"
  | "REJEITADO"
  | "EM_PREPARACAO"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO"

interface ItemResumo {
  id: string
  status: StatusItem
  quantidade: number
  requerAprovacaoSuperior: boolean
  material: { id: string; nome: string; codigoInterno: string }
}

interface Requisicao {
  id: string
  numero: number
  tipo: TipoSolicitacao
  origem: "AUTENTICADO" | "PUBLICO"
  status: StatusSolicitacao
  prioridade: Prioridade
  motivo: string | null
  dataLimite: string | null
  createdAt: string
  solicitante: { tipo: "USUARIO" | "PESSOA_ATENDIDA"; nome: string; setor: string | null; funcao: string | null } | null
  lancadoPor: { id: string; nome: string } | null
  itens: ItemResumo[]
  totalItens: number
}

interface Resumo {
  total: number
  pendentes: number
  aguardandoAprovacao: number
  emAndamento: number
  prontos: number
}

interface PageData {
  requisicoes: Requisicao[]
  nextCursor: number | null
  resumo: Resumo
}

type FiltroStatus = "TODOS" | StatusSolicitacao
const PAPEIS_GESTAO = new Set(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])

// =====================================================================
// HELPERS
// =====================================================================

const LABEL_STATUS: Record<StatusSolicitacao, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO_APROVACAO: "Aguard. aprovação",
  EM_ANDAMENTO: "Em andamento",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADA: "Cancelada",
}

const COR_STATUS: Record<StatusSolicitacao, string> = {
  PENDENTE: theme.colors.status.info,
  AGUARDANDO_APROVACAO: theme.colors.status.warning,
  EM_ANDAMENTO: theme.colors.status.purple,
  PRONTO: theme.colors.accent.green,
  ENTREGUE: theme.colors.status.success,
  CANCELADA: theme.colors.neutral[500],
}

const COR_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA: theme.colors.neutral[500],
  MEDIA: theme.colors.status.info,
  ALTA: theme.colors.status.warning,
  URGENTE: theme.colors.status.error,
}

const ICONE_TIPO: Record<TipoSolicitacao, React.ElementType> = {
  SAIDA: PackageMinus,
  EMPRESTIMO: HandCoins,
  TRANSFERENCIA: ArrowRightLeft,
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

const LIMIT = 30

export default function RequisicoesPage() {
  const [role, setRole] = useState("")
  const [userId, setUserId] = useState("")
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  useEffect(() => {
    async function getUserRole() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const res = await fetch("/api/perfil")
          if (res.ok) {
            const data = await res.json()
            setRole(data.usuario?.role || "")
            setUserId(data.usuario?.id || "")
          }
        }
      } catch (error) {
        console.error("Erro ao buscar perfil:", error)
      } finally {
        setIsLoadingUser(false)
      }
    }
    getUserRole()
  }, [])

  const gestor = PAPEIS_GESTAO.has(role)

  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [status, setStatus] = useState<FiltroStatus>("TODOS")
  const [tipo, setTipo] = useState<"TODOS" | TipoSolicitacao>("TODOS")
  const [prioridade, setPrioridade] = useState<"TODOS" | Prioridade>("TODOS")

  const [requisicaoAberta, setRequisicaoAberta] = useState<string | null>(null)
  const [mostrarNova, setMostrarNova] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  const fetchPage = async ({ pageParam }: { pageParam: number | null }): Promise<PageData> => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    if (pageParam !== null && pageParam !== undefined) params.set("cursor", String(pageParam))
    if (buscaDebounced) params.set("busca", buscaDebounced)
    if (status !== "TODOS") params.set("status", status)
    if (tipo !== "TODOS") params.set("tipo", tipo)
    if (prioridade !== "TODOS") params.set("prioridade", prioridade)

    const res = await fetch(`/api/requisicoes?${params.toString()}`)
    if (!res.ok) throw new Error("Falha ao carregar requisições")
    return res.json()
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useInfiniteQuery({
    queryKey: ["requisicoes", buscaDebounced, status, tipo, prioridade],
    queryFn: ({ pageParam }) => fetchPage({ pageParam: pageParam as number | null }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage: PageData) => lastPage.nextCursor,
    staleTime: 1000 * 30,
  })

  const todasRequisicoes = data?.pages?.flatMap((p) => p.requisicoes) ?? []
  const resumo = data?.pages?.[0]?.resumo ?? { total: 0, pendentes: 0, aguardandoAprovacao: 0, emAndamento: 0, prontos: 0 }

  const handleCriada = useCallback(() => {
    setMostrarNova(false)
    refetch()
  }, [refetch])

  const handleAtualizada = useCallback(() => {
    refetch()
  }, [refetch])

  if (isLoadingUser) {
    return (
      <PageWrapper>
        <CentroLoading>
          <Loader2 size={24} style={{ animation: "spin 0.7s linear infinite" }} />
          <span>Carregando...</span>
        </CentroLoading>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <ClipboardList size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>{gestor ? "Gestão" : "Minhas solicitações"}</Breadcrumb>
            <Title>Requisições</Title>
            <Subtitle>
              {gestor
                ? "Pedidos de saída, empréstimo e transferência de materiais, centralizados por prioridade e status."
                : "Acompanhe aqui suas solicitações de materiais."}
            </Subtitle>
          </div>
        </HeaderLeft>

        <PrimaryButton onClick={() => setMostrarNova(true)}>
          <Plus size={16} />
          Nova requisição
        </PrimaryButton>
      </HeaderRow>

      <StatsGrid>
        <StatCard $accent={theme.colors.status.info}>
          <StatValue>{resumo.total}</StatValue>
          <StatLabel>Total</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.warning} $clicavel onClick={() => setStatus("AGUARDANDO_APROVACAO")}>
          <StatValue>{resumo.aguardandoAprovacao}</StatValue>
          <StatLabel>Aguard. aprovação</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.purple} $clicavel onClick={() => setStatus("EM_ANDAMENTO")}>
          <StatValue>{resumo.emAndamento}</StatValue>
          <StatLabel>Em andamento</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.accent.green} $clicavel onClick={() => setStatus("PRONTO")}>
          <StatValue>{resumo.prontos}</StatValue>
          <StatLabel>Prontos</StatLabel>
        </StatCard>
      </StatsGrid>

      <Toolbar>
        <SearchBox>
          <Search size={16} />
          <input
            placeholder="Buscar por número, solicitante ou material..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </SearchBox>

        <FiltroSelect value={status} onChange={(e) => setStatus(e.target.value as FiltroStatus)}>
          <option value="TODOS">Status: todos</option>
          {Object.entries(LABEL_STATUS).map(([valor, label]) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </FiltroSelect>

        <FiltroSelect value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          <option value="TODOS">Tipo: todos</option>
          <option value="SAIDA">Saída</option>
          <option value="EMPRESTIMO">Empréstimo</option>
          <option value="TRANSFERENCIA">Transferência</option>
        </FiltroSelect>

        <FiltroSelect value={prioridade} onChange={(e) => setPrioridade(e.target.value as any)}>
          <option value="TODOS">Prioridade: todas</option>
          <option value="URGENTE">Urgente</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Média</option>
          <option value="BAIXA">Baixa</option>
        </FiltroSelect>
      </Toolbar>

      <ListaWrapper>
        {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {!isLoading && isError && (
          <ErrorState>
            <AlertTriangle size={32} />
            <span>Não foi possível carregar as requisições{error instanceof Error ? `: ${error.message}` : "."}</span>
            <RetryButton onClick={() => refetch()}>
              <RefreshCw size={14} />
              Tentar novamente
            </RetryButton>
          </ErrorState>
        )}

        {!isLoading && !isError && todasRequisicoes.length === 0 && (
          <EmptyState>
            <Inbox size={32} />
            <span>Nenhuma requisição encontrada pra esse filtro.</span>
          </EmptyState>
        )}

        {todasRequisicoes.map((r) => {
          const Icone = ICONE_TIPO[r.tipo]
          const itensPendentesAprovacao = r.itens.filter((i) => i.status === "AGUARDANDO_APROVACAO_SUPERIOR").length
          return (
            <Card key={r.id} onClick={() => setRequisicaoAberta(r.id)}>
              <CardTopo>
                <CardNumero>
                  <Hash size={12} />
                  {r.numero}
                </CardNumero>
                <StatusBadge $cor={COR_STATUS[r.status]}>{LABEL_STATUS[r.status]}</StatusBadge>
              </CardTopo>

              <CardCorpo>
                <TipoIconWrap $tipo={r.tipo}>
                  <Icone size={16} />
                </TipoIconWrap>
                <CardInfo>
                  <CardSolicitante>
                    <UserRound size={12} />
                    {r.solicitante?.nome ?? "—"}
                    {r.origem === "PUBLICO" && <OrigemTag>form. público</OrigemTag>}
                    {r.lancadoPor && <OrigemTag>lançado por {r.lancadoPor.nome.split(" ")[0]}</OrigemTag>}
                  </CardSolicitante>
                  <CardItensResumo>
                    {r.totalItens} {r.totalItens === 1 ? "item" : "itens"}
                    {itensPendentesAprovacao > 0 && (
                      <PendenteTag>
                        <AlertTriangle size={10} />
                        {itensPendentesAprovacao} aguardando aprovação
                      </PendenteTag>
                    )}
                  </CardItensResumo>
                </CardInfo>
              </CardCorpo>

              <CardRodape>
                <PrioridadeBadge $cor={COR_PRIORIDADE[r.prioridade]}>{r.prioridade}</PrioridadeBadge>
                <DataTag>
                  <Clock size={11} />
                  {formatarDataHora(r.createdAt)}
                </DataTag>
              </CardRodape>
            </Card>
          )
        })}

        {hasNextPage && (
          <CarregarMaisButton onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> : <ChevronDown size={14} />}
            Carregar mais
          </CarregarMaisButton>
        )}
      </ListaWrapper>

      {mostrarNova && (
        <NovaRequisicaoModal
          gestor={gestor}
          onClose={() => setMostrarNova(false)}
          onCriada={handleCriada}
        />
      )}

      {requisicaoAberta && (
        <RequisicaoDetalheModal
          requisicaoId={requisicaoAberta}
          role={role}
          userId={userId}
          onClose={() => setRequisicaoAberta(null)}
          onAtualizada={handleAtualizada}
        />
      )}
    </PageWrapper>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const spin = keyframes`to { transform: rotate(360deg); }`
const pulse = keyframes`0%, 100% { opacity: 1; } 50% { opacity: 0.35; }`

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
  gap: ${({ theme }) => theme.spacing[8]};
`

const CentroLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 400px;
  color: ${({ theme }) => theme.colors.text.muted};
`

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
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
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.16)};
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.35)};
  color: ${({ theme }) => theme.colors.primary.vivid};
`

const Breadcrumb = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text.muted};
`

const Title = styled.h1`
  margin-top: 2px;
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
`

const Subtitle = styled.p`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  max-width: 56ch;
  color: ${({ theme }) => theme.colors.text.secondary};
`

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.primary.vivid};
  color: ${({ theme }) => theme.colors.neutral.white};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  transition: background ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;

  &:hover { background: ${({ theme }) => theme.colors.primary.deep}; }
`

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const StatCard = styled.div<{ $accent: string; $clicavel?: boolean }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  position: relative;
  overflow: hidden;
  cursor: ${({ $clicavel }) => ($clicavel ? "pointer" : "default")};
  transition: transform ${({ theme }) => theme.transitions.fast};

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: ${({ $accent }) => $accent};
  }

  &:hover { transform: translateY(-1px); }
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

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  ${glassCardStyles}
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  min-width: 240px;
  flex: 1;
  max-width: 360px;

  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
  input {
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    width: 100%;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    &::placeholder { color: ${({ theme }) => theme.colors.text.muted}; }
  }
`

const FiltroSelect = styled.select`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
  flex-shrink: 0;
  option { background: ${({ theme }) => theme.colors.surface.sidebar}; }
`

const ListaWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
  align-content: start;
`

const Card = styled.button`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  text-align: left;
  transition: transform ${({ theme }) => theme.transitions.fast}, border-color ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.4)};
  }
`

const CardTopo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CardNumero = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

const StatusBadge = styled.span<{ $cor: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $cor }) => $cor};
  background: ${({ $cor }) => hexToRgba($cor, 0.14)};
  border: 1px solid ${({ $cor }) => hexToRgba($cor, 0.3)};
  white-space: nowrap;

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
`

const CardCorpo = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[3]};
`

const TipoIconWrap = styled.div<{ $tipo: TipoSolicitacao }>`
  width: 34px;
  height: 34px;
  border-radius: ${({ theme }) => theme.radii.md};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme, $tipo }) =>
    hexToRgba($tipo === "EMPRESTIMO" ? theme.colors.status.purple : $tipo === "TRANSFERENCIA" ? theme.colors.status.info : theme.colors.primary.vivid, 0.16)};
  color: ${({ theme, $tipo }) =>
    $tipo === "EMPRESTIMO" ? theme.colors.status.purple : $tipo === "TRANSFERENCIA" ? theme.colors.status.info : theme.colors.primary.vivid};
`

const CardInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const CardSolicitante = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  svg { flex-shrink: 0; color: ${({ theme }) => theme.colors.text.muted}; }
`

const OrigemTag = styled.span`
  font-size: 10px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.surface.glass};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
`

const CardItensResumo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const PendenteTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: ${({ theme }) => theme.colors.status.warning};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`

const CardRodape = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: ${({ theme }) => theme.spacing[2]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const PrioridadeBadge = styled.span<{ $cor: string }>`
  font-size: 10px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.full};
  color: ${({ $cor }) => $cor};
  background: ${({ $cor }) => hexToRgba($cor, 0.14)};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

const DataTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const SkeletonCard = styled.div`
  height: 128px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface.glass};
  animation: ${pulse} 1.4s ease-in-out infinite;
`

const EmptyState = styled.div`
  grid-column: 1 / -1;
  padding: ${({ theme }) => theme.spacing[10]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
`

const ErrorState = styled.div`
  grid-column: 1 / -1;
  padding: ${({ theme }) => theme.spacing[10]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.status.error};
  text-align: center;
`

const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; }
`

const CarregarMaisButton = styled.button`
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px dashed ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; }
  &:disabled { opacity: 0.6; cursor: default; }
`
