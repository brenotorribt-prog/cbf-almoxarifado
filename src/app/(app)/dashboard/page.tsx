"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  HandCoins,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronRight,
  Hash,
  UserRound,
  Settings,
  Tags,
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

interface DashboardData {
  usuario: { nome: string; role: string }
  materiais: { total: number; inativos: number; estoqueBaixo: number; estoqueAlto: number }
  requisicoes: {
    total: number
    pendentes: number
    aguardandoAprovacao: number
    emAndamento: number
    prontos: number
  }
  emprestimos: { ativos: number; atrasados: number; pendentesAprovacao: number }
  movimentacoes: { totalHoje: number }
  compras: { abertos: number; parciais: number; orcando: number; aguardandoEntrega: number }
  cadastros: { categorias: number }
  admin: { usuariosPendentes: number } | null
  alertas: {
    materiaisEstoqueBaixo: {
      id: string
      nome: string
      codigoInterno: string
      estoqueAtual: number
      estoqueMinimo: number
      unidadeSigla: string
    }[]
  }
  recentes: {
    requisicoes: {
      id: string
      numero: number
      tipo: string
      status: string
      prioridade: string
      createdAt: string
      solicitante: string
      totalItens: number
    }[]
    movimentacoes: {
      id: string
      tipo: string
      quantidade: number
      createdAt: string
      material: { nome: string; codigoInterno: string }
      usuario: { name: string }
    }[]
  }
}

const PAPEIS_GESTAO = new Set(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])

const LABEL_STATUS: Record<string, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO_APROVACAO: "Aguard. aprovação",
  EM_ANDAMENTO: "Em andamento",
  PRONTO: "Pronto",
}

const LABEL_TIPO_MOV: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
}

const COR_TIPO_MOV: Record<string, string> = {
  ENTRADA: theme.colors.accent.green,
  SAIDA: theme.colors.status.warning,
  AJUSTE: theme.colors.status.info,
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function saudacao(nome: string) {
  const hora = new Date().getHours()
  const prefixo = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"
  const primeiro = nome.split(" ")[0]
  return `${prefixo}, ${primeiro}`
}

// =====================================================================
// COMPONENTE
// =====================================================================

export default function DashboardPage() {
  const [dados, setDados] = useState<DashboardData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch("/api/dashboard")
      if (!res.ok) throw new Error("Falha ao carregar o dashboard")
      setDados(await res.json())
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const gestor = dados ? PAPEIS_GESTAO.has(dados.usuario.role) : false

  if (carregando) {
    return (
      <PageWrapper>
        <CentroLoading>
          <Loader2 size={24} className="spin" />
          Carregando visão geral...
        </CentroLoading>
      </PageWrapper>
    )
  }

  if (erro || !dados) {
    return (
      <PageWrapper>
        <ErrorState>
          <AlertTriangle size={32} />
          <span>{erro ?? "Não foi possível carregar o dashboard."}</span>
          <RetryButton onClick={carregar}>
            <RefreshCw size={14} />
            Tentar novamente
          </RetryButton>
        </ErrorState>
      </PageWrapper>
    )
  }

  const acoesPendentes =
    dados.requisicoes.aguardandoAprovacao +
    dados.emprestimos.pendentesAprovacao +
    (dados.admin?.usuariosPendentes ?? 0)

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <LayoutDashboard size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>Visão geral</Breadcrumb>
            <Title>{saudacao(dados.usuario.nome)}</Title>
            <Subtitle>
              Resumo consolidado de estoque, requisições, movimentações, empréstimos e compras.
            </Subtitle>
          </div>
        </HeaderLeft>
        <RefreshButton onClick={carregar} title="Atualizar">
          <RefreshCw size={16} />
        </RefreshButton>
      </HeaderRow>

      {acoesPendentes > 0 && (
        <AlertBanner>
          <AlertTriangle size={16} />
          <span>
            <strong>{acoesPendentes}</strong>{" "}
            {acoesPendentes === 1 ? "item precisa" : "itens precisam"} da sua atenção — aprovações
            pendentes ou estoque crítico.
          </span>
        </AlertBanner>
      )}

      {/* KPIs principais */}
      <StatsGrid $cols={gestor ? 5 : 3}>
        <StatCardLink href="/materiais" $accent={theme.colors.status.info}>
          <StatIconWrap $cor={theme.colors.status.info}>
            <Package size={18} />
          </StatIconWrap>
          <StatValue>{dados.materiais.total}</StatValue>
          <StatLabel>Materiais cadastrados</StatLabel>
          {dados.materiais.estoqueBaixo > 0 && (
            <StatHint $alerta>{dados.materiais.estoqueBaixo} com estoque baixo</StatHint>
          )}
        </StatCardLink>

        <StatCardLink href="/requisicoes" $accent={theme.colors.status.warning}>
          <StatIconWrap $cor={theme.colors.status.warning}>
            <ClipboardList size={18} />
          </StatIconWrap>
          <StatValue>{dados.requisicoes.emAndamento + dados.requisicoes.prontos}</StatValue>
          <StatLabel>{gestor ? "Requisições ativas" : "Minhas requisições ativas"}</StatLabel>
          {dados.requisicoes.aguardandoAprovacao > 0 && (
            <StatHint $alerta>{dados.requisicoes.aguardandoAprovacao} aguard. aprovação</StatHint>
          )}
        </StatCardLink>

        {gestor && (
          <StatCardLink href="/movimentacoes" $accent={theme.colors.accent.green}>
            <StatIconWrap $cor={theme.colors.accent.green}>
              <ArrowLeftRight size={18} />
            </StatIconWrap>
            <StatValue>{dados.movimentacoes.totalHoje}</StatValue>
            <StatLabel>Movimentações hoje</StatLabel>
          </StatCardLink>
        )}

        {gestor && (
          <StatCardLink href="/movimentacoes" $accent={theme.colors.status.purple}>
            <StatIconWrap $cor={theme.colors.status.purple}>
              <HandCoins size={18} />
            </StatIconWrap>
            <StatValue>{dados.emprestimos.ativos}</StatValue>
            <StatLabel>Empréstimos ativos</StatLabel>
            {dados.emprestimos.atrasados > 0 && (
              <StatHint $alerta>{dados.emprestimos.atrasados} atrasados</StatHint>
            )}
          </StatCardLink>
        )}

        {gestor && (
          <StatCardLink href="/compras" $accent={theme.colors.primary.vivid}>
            <StatIconWrap $cor={theme.colors.primary.vivid}>
              <ShoppingCart size={18} />
            </StatIconWrap>
            <StatValue>{dados.compras.abertos + dados.compras.parciais}</StatValue>
            <StatLabel>Pedidos de compra abertos</StatLabel>
            {dados.compras.orcando > 0 && (
              <StatHint>{dados.compras.orcando} itens orçando</StatHint>
            )}
          </StatCardLink>
        )}
      </StatsGrid>

      {/* Seções por módulo */}
      <SectionsGrid>
        {/* Materiais */}
        <SectionCard>
          <SectionHeader>
            <SectionTitle>
              <Package size={16} />
              Estoque
            </SectionTitle>
            <SectionLink href="/materiais">
              Ver todos <ChevronRight size={14} />
            </SectionLink>
          </SectionHeader>
          <MiniStats>
            <MiniStat>
              <MiniValue>{dados.materiais.total}</MiniValue>
              <MiniLabel>Total</MiniLabel>
            </MiniStat>
            <MiniStat $alerta={dados.materiais.estoqueBaixo > 0}>
              <MiniValue>{dados.materiais.estoqueBaixo}</MiniValue>
              <MiniLabel>Estoque baixo</MiniLabel>
            </MiniStat>
            <MiniStat>
              <MiniValue>{dados.materiais.estoqueAlto}</MiniValue>
              <MiniLabel>Estoque alto</MiniLabel>
            </MiniStat>
            <MiniStat>
              <MiniValue>{dados.cadastros.categorias}</MiniValue>
              <MiniLabel>Categorias</MiniLabel>
            </MiniStat>
          </MiniStats>
        </SectionCard>

        {/* Requisições */}
        <SectionCard>
          <SectionHeader>
            <SectionTitle>
              <ClipboardList size={16} />
              Requisições
            </SectionTitle>
            <SectionLink href="/requisicoes">
              Ver todas <ChevronRight size={14} />
            </SectionLink>
          </SectionHeader>
          <MiniStats>
            <MiniStat>
              <MiniValue>{dados.requisicoes.total}</MiniValue>
              <MiniLabel>Total</MiniLabel>
            </MiniStat>
            <MiniStat $alerta={dados.requisicoes.aguardandoAprovacao > 0}>
              <MiniValue>{dados.requisicoes.aguardandoAprovacao}</MiniValue>
              <MiniLabel>Aguard. aprovação</MiniLabel>
            </MiniStat>
            <MiniStat>
              <MiniValue>{dados.requisicoes.emAndamento}</MiniValue>
              <MiniLabel>Em andamento</MiniLabel>
            </MiniStat>
            <MiniStat>
              <MiniValue>{dados.requisicoes.prontos}</MiniValue>
              <MiniLabel>Prontos</MiniLabel>
            </MiniStat>
          </MiniStats>
        </SectionCard>

        {gestor && (
          <>
            {/* Movimentações + Empréstimos */}
            <SectionCard>
              <SectionHeader>
                <SectionTitle>
                  <ArrowLeftRight size={16} />
                  Movimentações & Empréstimos
                </SectionTitle>
                <SectionLink href="/movimentacoes">
                  Abrir <ChevronRight size={14} />
                </SectionLink>
              </SectionHeader>
              <MiniStats>
                <MiniStat>
                  <MiniValue>{dados.movimentacoes.totalHoje}</MiniValue>
                  <MiniLabel>Hoje</MiniLabel>
                </MiniStat>
                <MiniStat>
                  <MiniValue>{dados.emprestimos.ativos}</MiniValue>
                  <MiniLabel>Empréstimos ativos</MiniLabel>
                </MiniStat>
                <MiniStat $alerta={dados.emprestimos.atrasados > 0}>
                  <MiniValue>{dados.emprestimos.atrasados}</MiniValue>
                  <MiniLabel>Atrasados</MiniLabel>
                </MiniStat>
                <MiniStat $alerta={dados.emprestimos.pendentesAprovacao > 0}>
                  <MiniValue>{dados.emprestimos.pendentesAprovacao}</MiniValue>
                  <MiniLabel>Pend. aprovação</MiniLabel>
                </MiniStat>
              </MiniStats>
            </SectionCard>

            {/* Compras */}
            <SectionCard>
              <SectionHeader>
                <SectionTitle>
                  <ShoppingCart size={16} />
                  Compras
                </SectionTitle>
                <SectionLink href="/compras">
                  Ver pedidos <ChevronRight size={14} />
                </SectionLink>
              </SectionHeader>
              <MiniStats>
                <MiniStat>
                  <MiniValue>{dados.compras.abertos}</MiniValue>
                  <MiniLabel>Abertos</MiniLabel>
                </MiniStat>
                <MiniStat>
                  <MiniValue>{dados.compras.parciais}</MiniValue>
                  <MiniLabel>Parciais</MiniLabel>
                </MiniStat>
                <MiniStat>
                  <MiniValue>{dados.compras.orcando}</MiniValue>
                  <MiniLabel>Orçando</MiniLabel>
                </MiniStat>
                <MiniStat>
                  <MiniValue>{dados.compras.aguardandoEntrega}</MiniValue>
                  <MiniLabel>Aguard. entrega</MiniLabel>
                </MiniStat>
              </MiniStats>
            </SectionCard>
          </>
        )}

        {dados.admin && dados.admin.usuariosPendentes > 0 && (
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <Settings size={16} />
                Administração
              </SectionTitle>
              <SectionLink href="/configuracoes">
                Configurações <ChevronRight size={14} />
              </SectionLink>
            </SectionHeader>
            <MiniStats>
              <MiniStat $alerta>
                <MiniValue>{dados.admin.usuariosPendentes}</MiniValue>
                <MiniLabel>Usuários pendentes</MiniLabel>
              </MiniStat>
            </MiniStats>
          </SectionCard>
        )}
      </SectionsGrid>

      {/* Alertas e atividade recente */}
      <BottomGrid>
        {gestor && dados.alertas.materiaisEstoqueBaixo.length > 0 && (
          <ListCard>
            <ListHeader>
              <ListTitle>
                <AlertTriangle size={16} />
                Estoque crítico
              </ListTitle>
              <SectionLink href="/materiais?estoque=BAIXO">
                Ver todos <ChevronRight size={14} />
              </SectionLink>
            </ListHeader>
            <ListBody>
              {dados.alertas.materiaisEstoqueBaixo.map((m) => (
                <ListItem key={m.id}>
                  <ListItemMain>
                    <ListItemNome>{m.nome}</ListItemNome>
                    <ListItemMeta>{m.codigoInterno}</ListItemMeta>
                  </ListItemMain>
                  <EstoqueBadge $critico>
                    {m.estoqueAtual} / {m.estoqueMinimo} {m.unidadeSigla}
                  </EstoqueBadge>
                </ListItem>
              ))}
            </ListBody>
          </ListCard>
        )}

        {dados.recentes.requisicoes.length > 0 && (
          <ListCard>
            <ListHeader>
              <ListTitle>
                <ClipboardList size={16} />
                {gestor ? "Requisições em aberto" : "Suas requisições em aberto"}
              </ListTitle>
              <SectionLink href="/requisicoes">
                Ver todas <ChevronRight size={14} />
              </SectionLink>
            </ListHeader>
            <ListBody>
              {dados.recentes.requisicoes.map((r) => (
                <ListItem key={r.id} as={Link} href={`/requisicoes`}>
                  <ListItemMain>
                    <ListItemTopo>
                      <Hash size={11} />
                      {r.numero}
                      <StatusPill>{LABEL_STATUS[r.status] ?? r.status}</StatusPill>
                    </ListItemTopo>
                    <ListItemMeta>
                      <UserRound size={11} />
                      {r.solicitante} · {r.totalItens} {r.totalItens === 1 ? "item" : "itens"}
                    </ListItemMeta>
                  </ListItemMain>
                  <ListItemData>{formatarData(r.createdAt)}</ListItemData>
                </ListItem>
              ))}
            </ListBody>
          </ListCard>
        )}

        {gestor && dados.recentes.movimentacoes.length > 0 && (
          <ListCard>
            <ListHeader>
              <ListTitle>
                <ArrowLeftRight size={16} />
                Últimas movimentações
              </ListTitle>
              <SectionLink href="/movimentacoes">
                Ver histórico <ChevronRight size={14} />
              </SectionLink>
            </ListHeader>
            <ListBody>
              {dados.recentes.movimentacoes.map((m) => (
                <ListItem key={m.id}>
                  <ListItemMain>
                    <ListItemTopo>
                      <TipoPill $cor={COR_TIPO_MOV[m.tipo] ?? theme.colors.neutral[500]}>
                        {LABEL_TIPO_MOV[m.tipo] ?? m.tipo}
                      </TipoPill>
                      <span>{m.quantidade}</span>
                    </ListItemTopo>
                    <ListItemMeta>{m.material.nome}</ListItemMeta>
                  </ListItemMain>
                  <ListItemData>{formatarData(m.createdAt)}</ListItemData>
                </ListItem>
              ))}
            </ListBody>
          </ListCard>
        )}

        {gestor &&
          dados.alertas.materiaisEstoqueBaixo.length === 0 &&
          dados.recentes.requisicoes.length === 0 &&
          dados.recentes.movimentacoes.length === 0 && (
            <EmptyCard>
              <Tags size={32} />
              <span>Tudo em ordem — nenhum alerta ou atividade recente.</span>
            </EmptyCard>
          )}
      </BottomGrid>
    </PageWrapper>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const spin = keyframes`to { transform: rotate(360deg); }`

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

  .spin { animation: ${spin} 0.8s linear infinite; }
`

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[4]};
  min-height: 400px;
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
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

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[4]};
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

  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
`

const AlertBanner = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${hexToRgba(theme.colors.status.warning, 0.1)};
  border: 1px solid ${hexToRgba(theme.colors.status.warning, 0.25)};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  svg { color: ${theme.colors.status.warning}; flex-shrink: 0; }
`

const StatsGrid = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`

const StatCardLink = styled(Link)<{ $accent: string }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  position: relative;
  overflow: hidden;
  text-decoration: none;
  transition: transform ${({ theme }) => theme.transitions.fast};

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: ${({ $accent }) => $accent};
  }

  &:hover { transform: translateY(-2px); }
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

const StatHint = styled.span<{ $alerta?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ $alerta, theme }) =>
    $alerta ? theme.colors.status.warning : theme.colors.text.muted};
  margin-top: ${({ theme }) => theme.spacing[1]};
`

const SectionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`

const SectionCard = styled.div`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`

const SectionLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary.vivid};
  text-decoration: none;

  &:hover { text-decoration: underline; }
`

const MiniStats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const MiniStat = styled.div<{ $alerta?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ $alerta, theme }) =>
    $alerta ? hexToRgba(theme.colors.status.warning, 0.08) : theme.colors.surface.glass};
`

const MiniValue = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  font-variant-numeric: tabular-nums;
`

const MiniLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const BottomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
`

const ListCard = styled.div`
  ${glassCardStyles}
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => `${theme.spacing[4]} ${theme.spacing[5]}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const ListTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`

const ListBody = styled.div`
  display: flex;
  flex-direction: column;
`

const ListItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  text-decoration: none;
  color: inherit;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:last-child { border-bottom: none; }
  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; }
`

const ListItemMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const ListItemTopo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`

const ListItemNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ListItemMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const ListItemData = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
  flex-shrink: 0;
`

const EstoqueBadge = styled.span<{ $critico?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${hexToRgba(theme.colors.status.warning, 0.12)};
  color: ${({ theme }) => theme.colors.status.warning};
  white-space: nowrap;
  flex-shrink: 0;
`

const StatusPill = styled.span`
  font-size: 10px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.surface.glass};
  color: ${({ theme }) => theme.colors.text.muted};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`

const TipoPill = styled.span<{ $cor: string }>`
  font-size: 10px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ $cor }) => hexToRgba($cor, 0.12)};
  color: ${({ $cor }) => $cor};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`

const EmptyCard = styled.div`
  ${glassCardStyles}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[10]};
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
  grid-column: 1 / -1;
`
