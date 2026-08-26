"use client"

/**
 * /configuracoes — Credenciamento de acesso
 * ------------------------------------------------------------------
 * Primeira tela das rotas autenticadas do app. Define o padrão visual
 * (glassmorphism sobre o `theme.ts`) que as próximas páginas da sidebar
 * devem seguir: PageHeader com eyebrow/título, StatsGrid, Toolbar de
 * busca + filtros em abas, e cards em vidro fosco pra listas de registro.
 *
 * Fluxo: lista todos os usuários cadastrados (login via credentials),
 * permite aprovar (com opção de ajustar a role solicitada) ou rejeitar
 * (com motivo obrigatório) o acesso de quem está PENDENTE.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Search,
  Check,
  X,
  Clock3,
  RotateCcw,
  Inbox,
  ShieldCheck,
  ShieldX,
  Loader2,
  UserRound,
} from "lucide-react"
import { SecaoIdentidadeVisual } from "@/components/configuracoes/identidade-visual-section"

// =====================================================================
// TIPOS
// =====================================================================

type Role = "ADMIN" | "GESTOR" | "SUPERVISOR" | "ALMOXARIFE" | "SOLICITANTE"
type UserStatus = "PENDENTE" | "APROVADO" | "REJEITADO"

interface Usuario {
  id: string
  name: string
  email: string
  image: string | null
  role: Role
  status: UserStatus
  ativo: boolean
  setor: string | null
  cargo: string | null
  telefone: string | null
  createdAt: string
  dataAprovacao: string | null
  motivoRejeicao: string | null
  aprovadoPor: { id: string; name: string } | null
}

interface Resumo {
  total: number
  pendentes: number
  aprovados: number
  rejeitados: number
}

type TabKey = "TODOS" | UserStatus

// =====================================================================
// CONSTANTES
// =====================================================================

const ROLES: Role[] = ["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE", "SOLICITANTE"]

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  SUPERVISOR: "Supervisor",
  ALMOXARIFE: "Almoxarife",
  SOLICITANTE: "Solicitante",
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: theme.colors.primary.vivid,
  GESTOR: theme.colors.accent.green,
  SUPERVISOR: theme.colors.status.info,
  ALMOXARIFE: theme.colors.status.purple,
  SOLICITANTE: theme.colors.neutral[500],
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "TODOS", label: "Todos" },
  { key: "PENDENTE", label: "Pendentes" },
  { key: "APROVADO", label: "Aprovados" },
  { key: "REJEITADO", label: "Rejeitados" },
]

// =====================================================================
// HELPERS
// =====================================================================

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function corAvatar(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const paleta = theme.colors.avatarPalette
  return paleta[Math.abs(hash) % paleta.length]
}

// =====================================================================
// ANIMAÇÕES
// =====================================================================

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`

// =====================================================================
// LAYOUT BASE (padrão pra outras páginas reaproveitarem)
// =====================================================================

const PageWrapper = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.contentPadding};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[8]};
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

// Selo circular que ancora a seção visualmente — mesma família do
// "carimbo" usado nos cards abaixo, aqui só como marca de identidade
// da página em vez de veredito de aprovação.
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

  strong {
    color: ${({ theme }) => theme.colors.text.secondary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }
`

const Title = styled.h1`
  margin-top: 2px;
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
`

const Subtitle = styled.p`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  max-width: 46ch;
`

// =====================================================================
// GLASS CARD (base reutilizável)
// =====================================================================

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

// =====================================================================
// STATS
// =====================================================================

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
`

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

// =====================================================================
// TOOLBAR (busca + abas)
// =====================================================================

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-wrap: wrap;
`

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  ${glassCardStyles}
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  min-width: 260px;
  flex: 1;
  max-width: 360px;

  svg {
    color: ${({ theme }) => theme.colors.text.muted};
    flex-shrink: 0;
  }

  input {
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    width: 100%;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};

    &::placeholder {
      color: ${({ theme }) => theme.colors.text.muted};
    }
  }
`

const Tabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[1]};
`

const TabButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.text.primary : theme.colors.text.secondary};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.surface.sidebarActive : "transparent"};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.colors.surface.sidebarActive : theme.colors.surface.glass};
  }
`

// =====================================================================
// LISTA / CARD DE USUÁRIO
// =====================================================================

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const UserCard = styled.div<{ $index: number }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[4]};
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  animation: ${fadeInUp} 0.3s ease both;
  animation-delay: ${({ $index }) => Math.min($index, 8) * 40}ms;
  transition: box-shadow ${({ theme }) => theme.transitions.base};

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.cardHover};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
    justify-items: start;
  }
`

const Avatar = styled.div<{ $color: string }>`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.radii.full};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ $color }) => hexToRgba($color, 0.28)};
  border: 1px solid ${({ $color }) => hexToRgba($color, 0.5)};
  flex-shrink: 0;
`

const InfoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const NomeUsuario = styled.span`
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const EmailUsuario = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const MetaRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
  min-width: 160px;
`

const MetaText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`

const RoleBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $color }) => $color};
  background: ${({ $color }) => hexToRgba($color, 0.14)};
  border: 1px solid ${({ $color }) => hexToRgba($color, 0.3)};
`

// "Carimbo" — o elemento de assinatura da tela: um selo de aprovação/
// rejeição, como o de um crachá de credenciamento. Sutil, sem exagero
// de movimento — só o rótulo já carrega o peso de "decisão tomada".
const Carimbo = styled.div<{ $tone: "success" | "error" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 5px 12px;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1.5px dashed
    ${({ theme, $tone }) =>
      $tone === "success" ? theme.colors.status.success : theme.colors.status.error};
  color: ${({ theme, $tone }) =>
    $tone === "success" ? theme.colors.status.success : theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transform: rotate(-4deg);
  background: ${({ theme, $tone }) =>
    $tone === "success" ? theme.colors.status.successBg : theme.colors.status.errorBg};
`

const AguardandoTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.accent.yellow};

  svg {
    animation: ${pulse} 1.8s ease-in-out infinite;
  }
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`

const RoleSelect = styled.select`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;

  option {
    background: ${({ theme }) => theme.colors.surface.sidebar};
  }
`

const IconButton = styled.button<{ $variant: "approve" | "reject" | "ghost" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  white-space: nowrap;

  ${({ $variant, theme }) =>
    $variant === "approve" &&
    `
    background: ${theme.colors.status.success};
    color: ${theme.colors.neutral.white};
    &:hover:not(:disabled) { background: ${theme.colors.accent.greenDark}; }
  `}

  ${({ $variant, theme }) =>
    $variant === "reject" &&
    `
    background: transparent;
    color: ${theme.colors.status.error};
    border: 1px solid ${theme.colors.status.errorBorder};
    &:hover:not(:disabled) { background: ${theme.colors.status.errorBg}; }
  `}

  ${({ $variant, theme }) =>
    $variant === "ghost" &&
    `
    background: transparent;
    color: ${theme.colors.text.secondary};
    border: 1px solid ${theme.colors.surface.border};
    &:hover:not(:disabled) { background: ${theme.colors.surface.glass}; color: ${theme.colors.text.primary}; }
  `}

  svg.spin {
    animation: ${spin} 0.7s linear infinite;
  }
`

// =====================================================================
// ESTADOS (loading / empty)
// =====================================================================

const SkeletonRow = styled.div`
  ${glassCardStyles}
  height: 76px;
  animation: ${pulse} 1.4s ease-in-out infinite;
`

const EmptyState = styled.div`
  ${glassCardStyles}
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

// =====================================================================
// TOAST
// =====================================================================

const Toast = styled.div<{ $tone: "success" | "error" }>`
  position: fixed;
  top: ${({ theme }) => theme.spacing[6]};
  right: ${({ theme }) => theme.spacing[6]};
  z-index: ${({ theme }) => theme.zIndex.toast};
  ${glassCardStyles}
  border-color: ${({ theme, $tone }) =>
    $tone === "success" ? theme.colors.status.successBorder : theme.colors.status.errorBorder};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme, $tone }) =>
    $tone === "success" ? theme.colors.status.success : theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  animation: ${slideIn} 0.25s ease both;
`

// =====================================================================
// MODAL DE REJEIÇÃO
// =====================================================================

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
`

const ModalCard = styled.div`
  ${glassCardStyles}
  width: 100%;
  max-width: 440px;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  animation: ${slideIn} 0.2s ease both;
`

const Textarea = styled.textarea`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
  min-height: 96px;
  resize: vertical;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
`

// =====================================================================
// COMPONENTE
// =====================================================================

export default function ConfiguracoesPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [resumo, setResumo] = useState<Resumo>({ total: 0, pendentes: 0, aprovados: 0, rejeitados: 0 })
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [abaAtiva, setAbaAtiva] = useState<TabKey>("PENDENTE")
  const [rolesSelecionadas, setRolesSelecionadas] = useState<Record<string, Role>>({})
  const [processando, setProcessando] = useState<Record<string, boolean>>({})
  const [modalRejeicao, setModalRejeicao] = useState<{ id: string; nome: string } | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState("")
  const [toast, setToast] = useState<{ tone: "success" | "error"; texto: string } | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Papel do próprio usuário — a seção de identidade visual é ADMIN-only
  const [papelUsuario, setPapelUsuario] = useState<Role | null>(null)

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPapelUsuario(d?.usuario?.role ?? null))
      .catch(() => {})
  }, [])

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  const mostrarToast = useCallback((tone: "success" | "error", texto: string) => {
    setToast({ tone, texto })
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const carregarUsuarios = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (buscaDebounced) params.set("busca", buscaDebounced)
      const res = await fetch(`/api/admin/usuarios?${params.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar usuários")
      const data = await res.json()
      setUsuarios(data.usuarios)
      setResumo(data.resumo)
    } catch {
      mostrarToast("error", "Não foi possível carregar os usuários.")
    } finally {
      setCarregando(false)
    }
  }, [buscaDebounced, mostrarToast])

  useEffect(() => {
    carregarUsuarios()
  }, [carregarUsuarios])

  const usuariosFiltrados = useMemo(() => {
    if (abaAtiva === "TODOS") return usuarios
    return usuarios.filter((u) => u.status === abaAtiva)
  }, [usuarios, abaAtiva])

  const setProcessandoId = (id: string, valor: boolean) =>
    setProcessando((prev) => ({ ...prev, [id]: valor }))

  async function aprovar(usuario: Usuario) {
    setProcessandoId(usuario.id, true)
    try {
      const roleEscolhida = rolesSelecionadas[usuario.id] ?? usuario.role
      const res = await fetch(`/api/admin/usuarios/${usuario.id}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleEscolhida }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao aprovar")
      mostrarToast("success", `Acesso aprovado para ${usuario.name}.`)
      await carregarUsuarios()
    } catch (err) {
      mostrarToast("error", err instanceof Error ? err.message : "Erro ao aprovar acesso.")
    } finally {
      setProcessandoId(usuario.id, false)
    }
  }

  async function rejeitar() {
    if (!modalRejeicao) return
    if (motivoRejeicao.trim().length < 3) {
      mostrarToast("error", "Descreva o motivo da rejeição.")
      return
    }
    setProcessandoId(modalRejeicao.id, true)
    try {
      const res = await fetch(`/api/admin/usuarios/${modalRejeicao.id}/rejeitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoRejeicao.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao rejeitar")
      mostrarToast("success", `Acesso de ${modalRejeicao.nome} rejeitado.`)
      setModalRejeicao(null)
      setMotivoRejeicao("")
      await carregarUsuarios()
    } catch (err) {
      mostrarToast("error", err instanceof Error ? err.message : "Erro ao rejeitar acesso.")
    } finally {
      setProcessandoId(modalRejeicao.id, false)
    }
  }

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <ShieldCheck size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>Configurações</Breadcrumb>
            <Title>Credenciamento de acesso</Title>
            <Subtitle>
              Analise quem solicitou entrada no sistema e aprove ou rejeite com a role correta antes de liberar o login.
            </Subtitle>
          </div>
        </HeaderLeft>
      </HeaderRow>

      <StatsGrid>
        <StatCard $accent={theme.colors.primary.vivid}>
          <StatValue>{resumo.total}</StatValue>
          <StatLabel>Total de contas</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.accent.yellow}>
          <StatValue>{resumo.pendentes}</StatValue>
          <StatLabel>Aguardando análise</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.success}>
          <StatValue>{resumo.aprovados}</StatValue>
          <StatLabel>Aprovados</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.error}>
          <StatValue>{resumo.rejeitados}</StatValue>
          <StatLabel>Rejeitados</StatLabel>
        </StatCard>
      </StatsGrid>

      {papelUsuario === "ADMIN" && <SecaoIdentidadeVisual />}

      <Toolbar>
        <SearchBox>
          <Search size={16} />
          <input
            placeholder="Buscar por nome, e-mail ou setor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </SearchBox>

        <Tabs>
          {TABS.map((tab) => (
            <TabButton key={tab.key} $active={abaAtiva === tab.key} onClick={() => setAbaAtiva(tab.key)}>
              {tab.label}
            </TabButton>
          ))}
        </Tabs>
      </Toolbar>

      <List>
        {carregando &&
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}

        {!carregando && usuariosFiltrados.length === 0 && (
          <EmptyState>
            <Inbox size={32} />
            <span>
              {abaAtiva === "PENDENTE"
                ? "Nenhuma solicitação de acesso pendente no momento."
                : "Nenhum usuário encontrado para esse filtro."}
            </span>
          </EmptyState>
        )}

        {!carregando &&
          usuariosFiltrados.map((usuario, index) => (
            <UsuarioCard
              key={usuario.id}
              usuario={usuario}
              index={index}
              roleSelecionada={rolesSelecionadas[usuario.id] ?? usuario.role}
              onRoleChange={(role) =>
                setRolesSelecionadas((prev) => ({ ...prev, [usuario.id]: role }))
              }
              processando={!!processando[usuario.id]}
              onAprovar={() => aprovar(usuario)}
              onRejeitar={() => setModalRejeicao({ id: usuario.id, nome: usuario.name })}
              onReconsiderar={() => aprovar(usuario)}
            />
          ))}
      </List>

      {modalRejeicao && (
        <ModalOverlay onClick={() => !processando[modalRejeicao.id] && setModalRejeicao(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <div>
              <Title as="h2" style={{ fontSize: theme.typography.fontSize.xl, marginTop: 0 }}>
                Rejeitar acesso
              </Title>
              <Subtitle style={{ marginTop: 4 }}>
                {modalRejeicao.nome} será notificado com o motivo abaixo.
              </Subtitle>
            </div>
            <Textarea
              autoFocus
              placeholder="Ex: e-mail fora do domínio da confederação, role incompatível com o setor..."
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
            />
            <ModalActions>
              <IconButton
                $variant="ghost"
                disabled={processando[modalRejeicao.id]}
                onClick={() => {
                  setModalRejeicao(null)
                  setMotivoRejeicao("")
                }}
              >
                Cancelar
              </IconButton>
              <IconButton $variant="reject" disabled={processando[modalRejeicao.id]} onClick={rejeitar}>
                {processando[modalRejeicao.id] ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <ShieldX size={14} />
                )}
                Confirmar rejeição
              </IconButton>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {toast && (
        <Toast $tone={toast.tone}>
          {toast.tone === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.texto}
        </Toast>
      )}
    </PageWrapper>
  )
}

// =====================================================================
// CARD DE USUÁRIO (função local — mesmo arquivo, não exportada)
// =====================================================================

function UsuarioCard({
  usuario,
  index,
  roleSelecionada,
  onRoleChange,
  processando,
  onAprovar,
  onRejeitar,
  onReconsiderar,
}: {
  usuario: Usuario
  index: number
  roleSelecionada: Role
  onRoleChange: (role: Role) => void
  processando: boolean
  onAprovar: () => void
  onRejeitar: () => void
  onReconsiderar: () => void
}) {
  const dataRelativa = formatDistanceToNow(new Date(usuario.createdAt), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <UserCard $index={index}>
      <Avatar $color={corAvatar(usuario.id)}>
        {usuario.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={usuario.image}
            alt={usuario.name}
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          iniciais(usuario.name)
        )}
      </Avatar>

      <InfoBlock>
        <NomeUsuario>{usuario.name}</NomeUsuario>
        <EmailUsuario>{usuario.email}</EmailUsuario>
      </InfoBlock>

      <MetaRow>
        <RoleBadge $color={ROLE_COLORS[usuario.role]}>
          {usuario.status === "PENDENTE" ? "Solicitou: " : ""}
          {ROLE_LABELS[usuario.role]}
        </RoleBadge>
        {(usuario.setor || usuario.cargo) && (
          <MetaText>{[usuario.cargo, usuario.setor].filter(Boolean).join(" · ")}</MetaText>
        )}

        {usuario.status === "PENDENTE" && (
          <AguardandoTag>
            <Clock3 size={12} />
            Solicitado {dataRelativa}
          </AguardandoTag>
        )}
        {usuario.status === "APROVADO" && (
          <Carimbo $tone="success">
            <ShieldCheck size={12} />
            Aprovado
          </Carimbo>
        )}
        {usuario.status === "REJEITADO" && (
          <>
            <Carimbo $tone="error">
              <ShieldX size={12} />
              Rejeitado
            </Carimbo>
            {usuario.motivoRejeicao && <MetaText>&ldquo;{usuario.motivoRejeicao}&rdquo;</MetaText>}
          </>
        )}
      </MetaRow>

      <Actions>
        {usuario.status === "PENDENTE" && (
          <>
            <RoleSelect
              value={roleSelecionada}
              onChange={(e) => onRoleChange(e.target.value as Role)}
              disabled={processando}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </RoleSelect>
            <IconButton $variant="approve" onClick={onAprovar} disabled={processando}>
              {processando ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              Aprovar
            </IconButton>
            <IconButton $variant="reject" onClick={onRejeitar} disabled={processando}>
              <X size={14} />
              Rejeitar
            </IconButton>
          </>
        )}

        {usuario.status === "REJEITADO" && (
          <IconButton $variant="ghost" onClick={onReconsiderar} disabled={processando}>
            {processando ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
            Reconsiderar
          </IconButton>
        )}

        {usuario.status === "APROVADO" && (
          <MetaText style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <UserRound size={12} />
            {usuario.aprovadoPor ? `por ${usuario.aprovadoPor.name}` : ""}
          </MetaText>
        )}
      </Actions>
    </UserCard>
  )
}