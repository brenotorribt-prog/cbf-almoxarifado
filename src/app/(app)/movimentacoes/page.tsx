"use client"

/**
 * /movimentacoes — Extrato de estoque + empréstimos + aprovações
 * ------------------------------------------------------------------
 * Três abas sobre listas virtualizadas (mesmo padrão de /materiais):
 * - Histórico: MovimentacaoEstoque (entrada/saída/ajuste/descarte), read-only
 * - Empréstimos: Emprestimo, com ações de Devolver / Registrar descarte
 * - Aprovações: só ADMIN/GESTOR/SUPERVISOR — Aprovar / Rejeitar pendentes
 *
 * "Nova movimentação" e "Novo empréstimo" só abrem o state por enquanto —
 * os modais entram na próxima etapa.
 */

import { useState, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
import styled, { keyframes } from "styled-components"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { theme, hexToRgba } from "@/styles/theme"
import {
  ArrowLeftRight,
  Plus,
  HandCoins,
  Search,
  Loader2,
  Inbox,
  AlertTriangle,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  Trash2,
  Undo2,
  ShieldCheck,
  ShieldX,
  Clock,
  CheckCircle2,
  XCircle,
  PackageX,
  X,
  Hash,
} from "lucide-react"

import NovaMovimentacaoModal from "@/components/movimentacoes/modals/nova-movimentacao"
import NovoEmprestimoModal from "@/components/movimentacoes/modals/novo-emprestimo"

// =====================================================================
// TIPOS
// =====================================================================

type TipoMovimentacao = "ENTRADA" | "SAIDA" | "AJUSTE" | "DESCARTE"
type StatusEmprestimo =
  | "PENDENTE_APROVACAO"
  | "EMPRESTADO"
  | "DEVOLVIDO"
  | "ATRASADO"
  | "PERDIDO"
  | "REJEITADO"

interface MovimentacaoRow {
  id: string
  tipo: TipoMovimentacao
  quantidade: number
  quantidadeAnterior: number
  quantidadeAtual: number
  motivo: string | null
  documentoReferencia: string | null
  solicitanteNome: string | null
  solicitanteSetor: string | null
  createdAt: string
  material: { id: string; nome: string; codigoInterno: string }
  usuario: { id: string; name: string }
}

interface EmprestimoRow {
  id: string
  quantidade: number
  solicitanteNome: string
  solicitanteSetor: string | null
  solicitanteFuncao: string | null
  loteId: string | null
  dataRetirada: string
  dataPrevistaDevolucao: string
  dataDevolucao: string | null
  status: StatusEmprestimo
  observacoes: string | null
  motivoRejeicao: string | null
  material: {
    id: string
    nome: string
    codigoInterno: string
    fotoUrl: string | null
    unidadeMedida: { sigla: string }
  }
  responsavel: { id: string; name: string }
  aprovador: { id: string; name: string } | null
}

interface ResumoEmprestimos {
  ativos: number
  atrasados: number
  pendentesAprovacao: number
}

type AbaAtiva = "historico" | "emprestimos" | "aprovacoes"

type AcaoTipo = "devolver" | "descarte" | "aprovar" | "rejeitar"

interface AcaoPendente {
  tipo: AcaoTipo
  emprestimo: EmprestimoRow
}

// Papéis que podem aprovar/rejeitar empréstimos pendentes
const PAPEIS_APROVADORES = new Set(["ADMIN", "GESTOR", "SUPERVISOR"])

// =====================================================================
// HELPERS
// =====================================================================

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const TIPO_MOV_CONFIG: Record<TipoMovimentacao, { label: string; cor: string; Icon: typeof ArrowDownCircle }> = {
  ENTRADA: { label: "Entrada", cor: theme.colors.status.success, Icon: ArrowDownCircle },
  SAIDA: { label: "Saída", cor: theme.colors.status.error, Icon: ArrowUpCircle },
  AJUSTE: { label: "Ajuste", cor: theme.colors.status.info, Icon: SlidersHorizontal },
  DESCARTE: { label: "Descarte", cor: theme.colors.status.purple, Icon: Trash2 },
}

const STATUS_EMPRESTIMO_CONFIG: Record<StatusEmprestimo, { label: string; cor: string; bg: string; borda: string }> = {
  PENDENTE_APROVACAO: {
    label: "Pendente aprovação",
    cor: theme.colors.status.warning,
    bg: theme.colors.status.warningBg,
    borda: theme.colors.status.warningBorder,
  },
  EMPRESTADO: {
    label: "Emprestado",
    cor: theme.colors.status.info,
    bg: theme.colors.status.infoBg,
    borda: theme.colors.status.infoBorder,
  },
  DEVOLVIDO: {
    label: "Devolvido",
    cor: theme.colors.status.success,
    bg: theme.colors.status.successBg,
    borda: theme.colors.status.successBorder,
  },
  ATRASADO: {
    label: "Atrasado",
    cor: theme.colors.status.error,
    bg: theme.colors.status.errorBg,
    borda: theme.colors.status.errorBorder,
  },
  PERDIDO: {
    label: "Perdido/descartado",
    cor: theme.colors.status.purple,
    bg: theme.colors.status.purpleBg,
    borda: theme.colors.status.purpleBorder,
  },
  REJEITADO: {
    label: "Rejeitado",
    cor: theme.colors.text.muted,
    bg: theme.colors.surface.glass,
    borda: theme.colors.surface.border,
  },
}

// =====================================================================
// CONSTANTES
// =====================================================================

const ALTURA_LINHA = 60
const ALTURA_CABECALHO = 44
const LIMIT = 60

export default function MovimentacoesPage() {
  const { data: sessao } = useSession()
  const role = (sessao?.user as { role?: string } | undefined)?.role ?? ""
  const podeAprovar = PAPEIS_APROVADORES.has(role)

  const queryClient = useQueryClient()

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("historico")

  // filtros — histórico
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimentacao | "TODOS">("TODOS")

  // filtros — empréstimos
  const [statusFiltro, setStatusFiltro] = useState<StatusEmprestimo | "TODOS">("TODOS")

  // ações (devolver / descarte / aprovar / rejeitar)
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null)

  // TODO: modais reais entram na próxima etapa — por enquanto só preparamos o state
  const [mostrarNovaMovimentacao, setMostrarNovaMovimentacao] = useState(false)
  const [mostrarNovoEmprestimo, setMostrarNovoEmprestimo] = useState(false)

  // ---------------------------------------------------------------
  // HISTÓRICO — MovimentacaoEstoque
  // ---------------------------------------------------------------
  const parentRefHistorico = useRef<HTMLDivElement>(null)

  const fetchHistorico = async ({ pageParam }: { pageParam: string | null }) => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    if (pageParam) params.set("cursor", pageParam)
    if (tipoFiltro !== "TODOS") params.set("tipo", tipoFiltro)

    const res = await fetch(`/api/movimentacoes?${params.toString()}`)
    if (!res.ok) throw new Error("Falha ao carregar movimentações")
    return res.json() as Promise<{
      movimentacoes: MovimentacaoRow[]
      nextCursor: string | null
      resumo: { totalHoje: number }
    }>
  }

  const historicoQuery = useInfiniteQuery({
    queryKey: ["movimentacoes", tipoFiltro],
    queryFn: ({ pageParam }) => fetchHistorico({ pageParam: pageParam as string | null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 1000 * 60,
    enabled: abaAtiva === "historico",
  })

  const movimentacoes = historicoQuery.data?.pages?.flatMap((p) => p.movimentacoes) ?? []
  const totalHoje = historicoQuery.data?.pages?.[historicoQuery.data.pages.length - 1]?.resumo?.totalHoje ?? 0

  const virtualizerHistorico = useVirtualizer({
    count: movimentacoes.length,
    getScrollElement: () => parentRefHistorico.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
  })
  const itensHistorico = virtualizerHistorico.getVirtualItems()
  const ultimoHistorico = itensHistorico[itensHistorico.length - 1]
  if (
    ultimoHistorico &&
    ultimoHistorico.index >= movimentacoes.length - 15 &&
    historicoQuery.hasNextPage &&
    !historicoQuery.isFetchingNextPage
  ) {
    historicoQuery.fetchNextPage()
  }

  // ---------------------------------------------------------------
  // EMPRÉSTIMOS — Emprestimo
  // ---------------------------------------------------------------
  const parentRefEmprestimos = useRef<HTMLDivElement>(null)

  const fetchEmprestimos = async ({ pageParam }: { pageParam: string | null }) => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    if (pageParam) params.set("cursor", pageParam)
    if (statusFiltro !== "TODOS") params.set("status", statusFiltro)

    const res = await fetch(`/api/emprestimos?${params.toString()}`)
    if (!res.ok) throw new Error("Falha ao carregar empréstimos")
    return res.json() as Promise<{
      emprestimos: EmprestimoRow[]
      nextCursor: string | null
      resumo: ResumoEmprestimos
    }>
  }

  const emprestimosQuery = useInfiniteQuery({
    queryKey: ["emprestimos", statusFiltro],
    queryFn: ({ pageParam }) => fetchEmprestimos({ pageParam: pageParam as string | null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 1000 * 30,
    enabled: abaAtiva === "emprestimos",
  })

  const emprestimos = emprestimosQuery.data?.pages?.flatMap((p) => p.emprestimos) ?? []
  const resumoEmprestimos = emprestimosQuery.data?.pages?.[emprestimosQuery.data.pages.length - 1]?.resumo ?? {
    ativos: 0,
    atrasados: 0,
    pendentesAprovacao: 0,
  }

  const virtualizerEmprestimos = useVirtualizer({
    count: emprestimos.length,
    getScrollElement: () => parentRefEmprestimos.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
  })
  const itensEmprestimos = virtualizerEmprestimos.getVirtualItems()
  const ultimoEmprestimos = itensEmprestimos[itensEmprestimos.length - 1]
  if (
    ultimoEmprestimos &&
    ultimoEmprestimos.index >= emprestimos.length - 15 &&
    emprestimosQuery.hasNextPage &&
    !emprestimosQuery.isFetchingNextPage
  ) {
    emprestimosQuery.fetchNextPage()
  }

  // ---------------------------------------------------------------
  // APROVAÇÕES — Emprestimo com status PENDENTE_APROVACAO
  // ---------------------------------------------------------------
  const parentRefAprovacoes = useRef<HTMLDivElement>(null)

  const fetchAprovacoes = async ({ pageParam }: { pageParam: string | null }) => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("status", "PENDENTE_APROVACAO")
    if (pageParam) params.set("cursor", pageParam)

    const res = await fetch(`/api/emprestimos?${params.toString()}`)
    if (!res.ok) throw new Error("Falha ao carregar aprovações pendentes")
    return res.json() as Promise<{ emprestimos: EmprestimoRow[]; nextCursor: string | null }>
  }

  const aprovacoesQuery = useInfiniteQuery({
    queryKey: ["emprestimos", "pendentes-aprovacao"],
    queryFn: ({ pageParam }) => fetchAprovacoes({ pageParam: pageParam as string | null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 1000 * 15,
    enabled: abaAtiva === "aprovacoes" && podeAprovar,
  })

  const pendentesAprovacao = aprovacoesQuery.data?.pages?.flatMap((p) => p.emprestimos) ?? []

  const virtualizerAprovacoes = useVirtualizer({
    count: pendentesAprovacao.length,
    getScrollElement: () => parentRefAprovacoes.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
  })
  const itensAprovacoes = virtualizerAprovacoes.getVirtualItems()
  const ultimoAprovacoes = itensAprovacoes[itensAprovacoes.length - 1]
  if (
    ultimoAprovacoes &&
    ultimoAprovacoes.index >= pendentesAprovacao.length - 15 &&
    aprovacoesQuery.hasNextPage &&
    !aprovacoesQuery.isFetchingNextPage
  ) {
    aprovacoesQuery.fetchNextPage()
  }

  // ---------------------------------------------------------------
  // Ações: devolver / descarte / aprovar / rejeitar
  // ---------------------------------------------------------------
  function invalidarListas() {
    queryClient.invalidateQueries({ queryKey: ["emprestimos"] })
    queryClient.invalidateQueries({ queryKey: ["movimentacoes"] })
  }

  const totalPendentesParaBadge = resumoEmprestimos.pendentesAprovacao

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <ArrowLeftRight size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>Estoque</Breadcrumb>
            <Title>Movimentações</Title>
            <Subtitle>
              Extrato de entradas, saídas e ajustes, além do controle de empréstimos e aprovações.
            </Subtitle>
          </div>
        </HeaderLeft>

        <HeaderActions>
          <SecondaryButton onClick={() => setMostrarNovaMovimentacao(true)}>
            <Plus size={16} />
            Nova movimentação
          </SecondaryButton>
          <PrimaryButton onClick={() => setMostrarNovoEmprestimo(true)}>
            <HandCoins size={16} />
            Novo empréstimo
          </PrimaryButton>
        </HeaderActions>
      </HeaderRow>

      <StatsGrid>
        <StatCard $accent={theme.colors.status.info}>
          <StatValue>{resumoEmprestimos.ativos}</StatValue>
          <StatLabel>Empréstimos ativos</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.error}>
          <StatValue>{resumoEmprestimos.atrasados}</StatValue>
          <StatLabel>Atrasados</StatLabel>
        </StatCard>
        {podeAprovar && (
          <StatCard $accent={theme.colors.status.warning}>
            <StatValue>{resumoEmprestimos.pendentesAprovacao}</StatValue>
            <StatLabel>Aguardando aprovação</StatLabel>
          </StatCard>
        )}
        <StatCard $accent={theme.colors.primary.vivid}>
          <StatValue>{totalHoje}</StatValue>
          <StatLabel>Movimentações hoje</StatLabel>
        </StatCard>
      </StatsGrid>

      <Tabs>
        <TabButton $active={abaAtiva === "historico"} onClick={() => setAbaAtiva("historico")}>
          Histórico
        </TabButton>
        <TabButton $active={abaAtiva === "emprestimos"} onClick={() => setAbaAtiva("emprestimos")}>
          Empréstimos
        </TabButton>
        {podeAprovar && (
          <TabButton $active={abaAtiva === "aprovacoes"} onClick={() => setAbaAtiva("aprovacoes")}>
            Aprovações
            {totalPendentesParaBadge > 0 && <TabBadge>{totalPendentesParaBadge}</TabBadge>}
          </TabButton>
        )}
      </Tabs>

      {/* ==================== ABA: HISTÓRICO ==================== */}
      {abaAtiva === "historico" && (
        <>
          <Toolbar>
            <FiltroSelect value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}>
              <option value="TODOS">Todos os tipos</option>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
              <option value="AJUSTE">Ajuste</option>
              <option value="DESCARTE">Descarte</option>
            </FiltroSelect>
          </Toolbar>

          <ListContainer ref={parentRefHistorico}>
            {historicoQuery.isLoading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

            {!historicoQuery.isLoading && historicoQuery.isError && (
              <ErrorState>
                <AlertTriangle size={32} />
                <span>Não foi possível carregar as movimentações.</span>
                <RetryButton onClick={() => historicoQuery.refetch()}>
                  <RefreshCw size={14} />
                  Tentar novamente
                </RetryButton>
              </ErrorState>
            )}

            {!historicoQuery.isLoading && !historicoQuery.isError && movimentacoes.length === 0 && (
              <EmptyState>
                <Inbox size={32} />
                <span>Nenhuma movimentação encontrada.</span>
              </EmptyState>
            )}

            {!historicoQuery.isLoading && !historicoQuery.isError && movimentacoes.length > 0 && (
              <>
                <TableHeader style={{ height: ALTURA_CABECALHO }}>
                  <HeaderCell>Tipo</HeaderCell>
                  <HeaderCell>Material</HeaderCell>
                  <HeaderCell style={{ width: 110 }}>Quantidade</HeaderCell>
                  <HeaderCell>Motivo</HeaderCell>
                  <HeaderCell style={{ width: 150 }}>Quando / quem</HeaderCell>
                </TableHeader>

                <RowsSizer style={{ height: virtualizerHistorico.getTotalSize() }}>
                  {itensHistorico.map((item) => {
                    const mov = movimentacoes[item.index]
                    if (!mov) return null
                    const config = TIPO_MOV_CONFIG[mov.tipo]
                    const Icon = config.Icon

                    return (
                      <RowHistorico
                        key={mov.id}
                        style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                      >
                        <TipoBadge $cor={config.cor}>
                          <Icon size={13} />
                          {config.label}
                        </TipoBadge>

                        <RowInfo>
                          <RowNome>{mov.material.nome}</RowNome>
                          <RowMeta>
                            <Hash size={10} />
                            <RowCodigo>{mov.material.codigoInterno}</RowCodigo>
                          </RowMeta>
                        </RowInfo>

                        <QuantidadeTexto $tipo={mov.tipo}>
                          {mov.tipo === "SAIDA" || (mov.tipo === "AJUSTE" && mov.quantidade < 0) ? "" : "+"}
                          {mov.quantidade}
                        </QuantidadeTexto>

                        <MotivoWrapper>
                          <MotivoTexto title={mov.motivo ?? undefined}>{mov.motivo || "—"}</MotivoTexto>
                          {mov.solicitanteNome && (
                            <RowMeta style={{ marginTop: 2 }}>
                              {mov.solicitanteNome}
                              {mov.solicitanteSetor ? ` · ${mov.solicitanteSetor}` : ""}
                            </RowMeta>
                          )}
                        </MotivoWrapper>

                        <RowInfo>
                          <RowNome style={{ fontSize: theme.typography.fontSize.xs }}>{mov.usuario.name}</RowNome>
                          <RowMeta>{formatarDataHora(mov.createdAt)}</RowMeta>
                        </RowInfo>
                      </RowHistorico>
                    )
                  })}
                </RowsSizer>
              </>
            )}

            {historicoQuery.isFetchingNextPage && (
              <CarregandoMais>
                <Loader2 size={14} />
                Carregando mais...
              </CarregandoMais>
            )}
          </ListContainer>
        </>
      )}

      {/* ==================== ABA: EMPRÉSTIMOS ==================== */}
      {abaAtiva === "emprestimos" && (
        <>
          <Toolbar>
            <FiltroSelect value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)}>
              <option value="TODOS">Todos os status</option>
              <option value="PENDENTE_APROVACAO">Pendente aprovação</option>
              <option value="EMPRESTADO">Emprestado</option>
              <option value="ATRASADO">Atrasado</option>
              <option value="DEVOLVIDO">Devolvido</option>
              <option value="PERDIDO">Perdido/descartado</option>
              <option value="REJEITADO">Rejeitado</option>
            </FiltroSelect>
          </Toolbar>

          <ListContainer ref={parentRefEmprestimos}>
            {emprestimosQuery.isLoading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

            {!emprestimosQuery.isLoading && emprestimosQuery.isError && (
              <ErrorState>
                <AlertTriangle size={32} />
                <span>Não foi possível carregar os empréstimos.</span>
                <RetryButton onClick={() => emprestimosQuery.refetch()}>
                  <RefreshCw size={14} />
                  Tentar novamente
                </RetryButton>
              </ErrorState>
            )}

            {!emprestimosQuery.isLoading && !emprestimosQuery.isError && emprestimos.length === 0 && (
              <EmptyState>
                <Inbox size={32} />
                <span>Nenhum empréstimo encontrado pra esse filtro.</span>
              </EmptyState>
            )}

            {!emprestimosQuery.isLoading && !emprestimosQuery.isError && emprestimos.length > 0 && (
              <>
                <TableHeader style={{ height: ALTURA_CABECALHO }}>
                  <HeaderCell>Material</HeaderCell>
                  <HeaderCell>Emprestado para</HeaderCell>
                  <HeaderCell style={{ width: 110 }}>Devolução</HeaderCell>
                  <HeaderCell style={{ width: 150 }}>Status</HeaderCell>
                  <HeaderCell style={{ width: 130 }}>Ações</HeaderCell>
                </TableHeader>

                <RowsSizer style={{ height: virtualizerEmprestimos.getTotalSize() }}>
                  {itensEmprestimos.map((item) => {
                    const emp = emprestimos[item.index]
                    if (!emp) return null
                    const config = STATUS_EMPRESTIMO_CONFIG[emp.status]
                    const podeAgir = emp.status === "EMPRESTADO" || emp.status === "ATRASADO"

                    return (
                      <RowEmprestimo
                        key={emp.id}
                        style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                      >
                        <RowInfo>
                          <RowNome>{emp.material.nome}</RowNome>
                          <RowMeta>
                            <Hash size={10} />
                            <RowCodigo>{emp.material.codigoInterno}</RowCodigo>
                            <span>
                              · {emp.quantidade} {emp.material.unidadeMedida.sigla}
                            </span>
                          </RowMeta>
                        </RowInfo>

                        <RowInfo>
                          <RowNome style={{ fontSize: theme.typography.fontSize.sm }}>
                            {emp.solicitanteNome}
                          </RowNome>
                          <RowMeta>
                            {[emp.solicitanteSetor, emp.solicitanteFuncao].filter(Boolean).join(" · ") || "—"}
                          </RowMeta>
                        </RowInfo>

                        <DataTexto $vencido={emp.status === "ATRASADO"}>
                          {formatarData(emp.dataPrevistaDevolucao)}
                        </DataTexto>

                        <StatusBadge $cor={config.cor} $bg={config.bg} $borda={config.borda}>
                          {config.label}
                        </StatusBadge>

                        <AcoesLinha>
                          {podeAgir && (
                            <>
                              <AcaoIconButton
                                title="Registrar devolução"
                                $cor={theme.colors.status.success}
                                onClick={() => setAcaoPendente({ tipo: "devolver", emprestimo: emp })}
                              >
                                <Undo2 size={15} />
                              </AcaoIconButton>
                              <AcaoIconButton
                                title="Registrar descarte / perda"
                                $cor={theme.colors.status.error}
                                onClick={() => setAcaoPendente({ tipo: "descarte", emprestimo: emp })}
                              >
                                <PackageX size={15} />
                              </AcaoIconButton>
                            </>
                          )}
                        </AcoesLinha>
                      </RowEmprestimo>
                    )
                  })}
                </RowsSizer>
              </>
            )}

            {emprestimosQuery.isFetchingNextPage && (
              <CarregandoMais>
                <Loader2 size={14} />
                Carregando mais...
              </CarregandoMais>
            )}
          </ListContainer>
        </>
      )}

      {/* ==================== ABA: APROVAÇÕES ==================== */}
      {abaAtiva === "aprovacoes" && podeAprovar && (
        <>
          <ListContainer ref={parentRefAprovacoes}>
            {aprovacoesQuery.isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

            {!aprovacoesQuery.isLoading && aprovacoesQuery.isError && (
              <ErrorState>
                <AlertTriangle size={32} />
                <span>Não foi possível carregar as aprovações pendentes.</span>
                <RetryButton onClick={() => aprovacoesQuery.refetch()}>
                  <RefreshCw size={14} />
                  Tentar novamente
                </RetryButton>
              </ErrorState>
            )}

            {!aprovacoesQuery.isLoading && !aprovacoesQuery.isError && pendentesAprovacao.length === 0 && (
              <EmptyState>
                <ShieldCheck size={32} />
                <span>Nenhuma aprovação pendente no momento.</span>
              </EmptyState>
            )}

            {!aprovacoesQuery.isLoading && !aprovacoesQuery.isError && pendentesAprovacao.length > 0 && (
              <>
                <TableHeader style={{ height: ALTURA_CABECALHO }}>
                  <HeaderCell>Material</HeaderCell>
                  <HeaderCell>Solicitado para</HeaderCell>
                  <HeaderCell style={{ width: 150 }}>Pedido em</HeaderCell>
                  <HeaderCell style={{ width: 170 }}>Ações</HeaderCell>
                </TableHeader>

                <RowsSizer style={{ height: virtualizerAprovacoes.getTotalSize() }}>
                  {itensAprovacoes.map((item) => {
                    const emp = pendentesAprovacao[item.index]
                    if (!emp) return null

                    return (
                      <RowAprovacao
                        key={emp.id}
                        style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                      >
                        <RowInfo>
                          <RowNome>{emp.material.nome}</RowNome>
                          <RowMeta>
                            <Hash size={10} />
                            <RowCodigo>{emp.material.codigoInterno}</RowCodigo>
                            <span>
                              · {emp.quantidade} {emp.material.unidadeMedida.sigla}
                            </span>
                          </RowMeta>
                        </RowInfo>

                        <RowInfo>
                          <RowNome style={{ fontSize: theme.typography.fontSize.sm }}>
                            {emp.solicitanteNome}
                          </RowNome>
                          <RowMeta>
                            {[emp.solicitanteSetor, emp.solicitanteFuncao].filter(Boolean).join(" · ") || "—"}
                          </RowMeta>
                        </RowInfo>

                        <RowInfo>
                          <RowMeta>
                            <Clock size={11} />
                            {formatarDataHora(emp.dataRetirada)}
                          </RowMeta>
                          <RowMeta>por {emp.responsavel.name}</RowMeta>
                        </RowInfo>

                        <AcoesLinha>
                          <AcaoBotao
                            $variant="aprovar"
                            onClick={() => setAcaoPendente({ tipo: "aprovar", emprestimo: emp })}
                          >
                            <CheckCircle2 size={14} />
                            Aprovar
                          </AcaoBotao>
                          <AcaoBotao
                            $variant="rejeitar"
                            onClick={() => setAcaoPendente({ tipo: "rejeitar", emprestimo: emp })}
                          >
                            <XCircle size={14} />
                            Rejeitar
                          </AcaoBotao>
                        </AcoesLinha>
                      </RowAprovacao>
                    )
                  })}
                </RowsSizer>
              </>
            )}

            {aprovacoesQuery.isFetchingNextPage && (
              <CarregandoMais>
                <Loader2 size={14} />
                Carregando mais...
              </CarregandoMais>
            )}
          </ListContainer>
        </>
      )}

      {acaoPendente && (
        <AcaoModal
          acao={acaoPendente}
          onFechar={() => setAcaoPendente(null)}
          onConcluido={() => {
            setAcaoPendente(null)
            invalidarListas()
          }}
        />
      )}

      {mostrarNovaMovimentacao && (
        <NovaMovimentacaoModal
          onClose={() => setMostrarNovaMovimentacao(false)}
          onSalvo={() => {
            setMostrarNovaMovimentacao(false)
            queryClient.invalidateQueries({ queryKey: ["movimentacoes"] })
          }}
        />
      )}

      {mostrarNovoEmprestimo && (
        <NovoEmprestimoModal
          onClose={() => setMostrarNovoEmprestimo(false)}
          onSalvo={() => {
            setMostrarNovoEmprestimo(false)
            queryClient.invalidateQueries({ queryKey: ["emprestimos"] })
            queryClient.invalidateQueries({ queryKey: ["movimentacoes"] })
          }}
        />
      )}
    </PageWrapper>
  )
}

// =====================================================================
// MODAL DE AÇÃO (devolver / descarte / aprovar / rejeitar)
// =====================================================================

function AcaoModal({
  acao,
  onFechar,
  onConcluido,
}: {
  acao: AcaoPendente
  onFechar: () => void
  onConcluido: () => void
}) {
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const precisaMotivo = acao.tipo === "descarte" || acao.tipo === "rejeitar"

  const CONFIG: Record<AcaoTipo, { titulo: string; endpoint: string; corBotao: string; labelBotao: string }> = {
    devolver: {
      titulo: "Confirmar devolução",
      endpoint: `/api/emprestimos/${acao.emprestimo.id}/devolucao`,
      corBotao: theme.colors.status.success,
      labelBotao: "Confirmar devolução",
    },
    descarte: {
      titulo: "Registrar descarte / perda",
      endpoint: `/api/emprestimos/${acao.emprestimo.id}/descarte`,
      corBotao: theme.colors.status.error,
      labelBotao: "Confirmar descarte",
    },
    aprovar: {
      titulo: "Aprovar empréstimo",
      endpoint: `/api/emprestimos/${acao.emprestimo.id}/aprovar`,
      corBotao: theme.colors.status.success,
      labelBotao: "Confirmar aprovação",
    },
    rejeitar: {
      titulo: "Rejeitar empréstimo",
      endpoint: `/api/emprestimos/${acao.emprestimo.id}/rejeitar`,
      corBotao: theme.colors.status.error,
      labelBotao: "Confirmar rejeição",
    },
  }

  const config = CONFIG[acao.tipo]

  async function confirmar() {
    setErro(null)

    if (precisaMotivo && motivo.trim().length < 3) {
      setErro("Informe um motivo com pelo menos 3 caracteres.")
      return
    }

    setEnviando(true)
    try {
      const body =
        acao.tipo === "descarte"
          ? { motivo: motivo.trim() }
          : acao.tipo === "rejeitar"
          ? { motivoRejeicao: motivo.trim() }
          : undefined

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error ?? "Falha ao executar a ação.")

      onConcluido()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao executar a ação.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalOverlay onClick={() => !enviando && onFechar()}>
      <ModalCardAcao onClick={(e) => e.stopPropagation()}>
        <ModalTopo>
          <ModalTitleAcao>{config.titulo}</ModalTitleAcao>
          <FecharButton onClick={onFechar} disabled={enviando}>
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        <ResumoAcaoBox>
          <strong>{acao.emprestimo.material.nome}</strong>
          <span>
            {acao.emprestimo.quantidade} {acao.emprestimo.material.unidadeMedida.sigla} · para{" "}
            {acao.emprestimo.solicitanteNome}
          </span>
        </ResumoAcaoBox>

        {erro && (
          <AvisoErro>
            <AlertTriangle size={16} />
            <span>{erro}</span>
          </AvisoErro>
        )}

        {precisaMotivo && (
          <FieldGroup>
            <Label>
              {acao.tipo === "descarte" ? "Motivo do descarte/perda" : "Motivo da rejeição"}{" "}
              <Obrigatorio>*</Obrigatorio>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              disabled={enviando}
              autoFocus
              placeholder="Descreva o motivo..."
            />
          </FieldGroup>
        )}

        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={enviando} onClick={onFechar}>
            Cancelar
          </ActionButton>
          <ActionButton
            type="button"
            $variant="primary"
            $cor={config.corBotao}
            disabled={enviando}
            onClick={confirmar}
          >
            {enviando ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
            {config.labelBotao}
          </ActionButton>
        </ModalActions>
      </ModalCardAcao>
    </ModalOverlay>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const spin = keyframes`to { transform: rotate(360deg); }`
const pulse = keyframes`0%, 100% { opacity: 1; } 50% { opacity: 0.35; }`
const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`
const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
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
  gap: ${({ theme }) => theme.spacing[8]};
  height: 100%;
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

const HeaderActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
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

  &:hover {
    background: ${({ theme }) => theme.colors.primary.deep};
  }
`

const SecondaryButton = styled(PrimaryButton)`
  background: ${({ theme }) => theme.colors.accent.green};
  color: ${({ theme }) => theme.colors.neutral.white};
  border: none;

  &:hover {
    background: ${({ theme }) => theme.colors.accent.greenDark};
  }
`

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
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

const Tabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[1]};
  width: fit-content;
`

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  white-space: nowrap;
  color: ${({ theme, $active }) => ($active ? theme.colors.text.primary : theme.colors.text.secondary)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface.sidebarActive : "transparent")};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.surface.sidebarActive : theme.colors.surface.glass)};
  }
`

const TabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.status.warning};
  color: ${({ theme }) => theme.colors.surface.background};
  font-size: 10px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`

const FiltroSelect = styled.select`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;

  option {
    background: ${({ theme }) => theme.colors.surface.sidebar};
  }
`

const ListContainer = styled.div`
  ${glassCardStyles}
  flex: 1;
  min-height: 420px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 130px minmax(0, 1.4fr) minmax(0, 1.1fr) minmax(0, 1fr) 140px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: 0 ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => hexToRgba(theme.colors.surface.sidebar, 0.8)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
`

const HeaderCell = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const RowsSizer = styled.div`
  position: relative;
  width: 100%;
`

const RowBase = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: grid;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: 0 ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

const RowHistorico = styled(RowBase)`
  grid-template-columns: 130px minmax(0, 1.4fr) minmax(0, 1.1fr) minmax(0, 1fr) 140px;
`

const RowEmprestimo = styled(RowBase)`
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) 110px 150px 130px;
`

const RowAprovacao = styled(RowBase)`
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) 150px 170px;
`

const RowInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
`

const RowNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const RowCodigo = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

const TipoBadge = styled.span<{ $cor: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $cor }) => $cor};
  background: ${({ $cor }) => hexToRgba($cor, 0.14)};
  border: 1px solid ${({ $cor }) => hexToRgba($cor, 0.3)};
`

const QuantidadeTexto = styled.span<{ $tipo: TipoMovimentacao }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $tipo }) =>
    $tipo === "ENTRADA"
      ? theme.colors.status.success
      : $tipo === "SAIDA" || $tipo === "DESCARTE"
      ? theme.colors.status.error
      : theme.colors.text.secondary};
`

const MotivoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

const MotivoTexto = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const DataTexto = styled.span<{ $vencido?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $vencido }) => ($vencido ? theme.colors.status.error : theme.colors.text.secondary)};
  font-weight: ${({ theme, $vencido }) => ($vencido ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.regular)};
`

const StatusBadge = styled.span<{ $cor: string; $bg: string; $borda: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $cor }) => $cor};
  background: ${({ $bg }) => $bg};
  border: 1px solid ${({ $borda }) => $borda};
  white-space: nowrap;

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
`

const AcoesLinha = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`

const AcaoIconButton = styled.button<{ $cor: string }>`
  width: 30px;
  height: 30px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ $cor }) => $cor};
  background: ${({ $cor }) => hexToRgba($cor, 0.12)};
  border: 1px solid ${({ $cor }) => hexToRgba($cor, 0.3)};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $cor }) => hexToRgba($cor, 0.22)};
  }
`

const AcaoBotao = styled.button<{ $variant: "aprovar" | "rejeitar" }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};

  ${({ $variant, theme }) =>
    $variant === "aprovar"
      ? `
    color: ${theme.colors.status.success};
    background: ${theme.colors.status.successBg};
    border: 1px solid ${theme.colors.status.successBorder};
    &:hover { background: ${hexToRgba(theme.colors.status.success, 0.22)}; }
  `
      : `
    color: ${theme.colors.status.error};
    background: ${theme.colors.status.errorBg};
    border: 1px solid ${theme.colors.status.errorBorder};
    &:hover { background: ${hexToRgba(theme.colors.status.error, 0.22)}; }
  `}
`

const SkeletonRow = styled.div`
  height: 60px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  animation: ${pulse} 1.4s ease-in-out infinite;
`

const EmptyState = styled.div`
  padding: ${({ theme }) => theme.spacing[10]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;

  svg {
    opacity: 0.5;
  }
`

const ErrorState = styled.div`
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
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

const CarregandoMais = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};

  svg {
    animation: ${spin} 0.7s linear infinite;
  }
`

// Modal de ação
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.surface.overlay};
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${({ theme }) => theme.zIndex.modal};
  padding: ${({ theme }) => theme.spacing[4]};
  animation: ${fadeIn} 0.15s ease both;
`

const ModalCardAcao = styled.div`
  ${glassCardStyles}
  width: 100%;
  max-width: 440px;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  animation: ${slideIn} 0.2s ease both;
`

const ModalTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ModalTitleAcao = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`

const FecharButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text.secondary};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ResumoAcaoBox = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
  }
`

const AvisoErro = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.errorBg};
  border: 1px solid ${({ theme }) => theme.colors.status.errorBorder};
  color: ${({ theme }) => theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const Label = styled.label`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
`

const Obrigatorio = styled.span`
  color: ${({ theme }) => theme.colors.status.error};
`

const Textarea = styled.textarea`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  width: 100%;
  min-height: 80px;
  resize: vertical;

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.muted};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const ActionButton = styled.button<{ $variant: "primary" | "ghost"; $cor?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};

  ${({ $variant, $cor, theme }) =>
    $variant === "primary" &&
    `
    background: ${$cor ?? theme.colors.primary.vivid};
    color: ${theme.colors.neutral.white};
    &:hover:not(:disabled) { filter: brightness(0.9); }
  `}

  ${({ $variant, theme }) =>
    $variant === "ghost" &&
    `
    background: transparent;
    color: ${theme.colors.text.secondary};
    border: 1px solid ${theme.colors.surface.border};
    &:hover:not(:disabled) { background: ${theme.colors.surface.glass}; color: ${theme.colors.text.primary}; }
  `}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg.spin {
    animation: ${spin} 0.7s linear infinite;
  }
`