"use client"

/**
 * /compras — Pedidos de compra de materiais
 * ------------------------------------------------------------------
 * Lista de pedidos (cada um com N itens, status independente por item).
 * Botões "Novo pedido", "Adicionar item" e "Exportar" já estão ligados
 * a states/handlers prontos — os modais em si (CriarPedidoModal,
 * AdicionarItemModal) e a exportação em Excel entram em componentes
 * separados numa próxima etapa. Enquanto isso, mudar status de um item
 * já funciona direto na lista (PATCH inline, sem precisar de modal).
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  ShoppingCart,
  Plus,
  Search,
  Inbox,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  UserRound,
  Building2,
  Briefcase,
  CalendarClock,
  Package,
  FileSpreadsheet,
  X,
  Check,
} from "lucide-react"

// TODO: componentes a construir em etapas separadas
// import CriarPedidoModal from "@/components/compras/modals/criar"
// import AdicionarItemModal from "@/components/compras/modals/adicionar-item"
// import ExportarComprasButton from "@/components/compras/exportar"

// =====================================================================
// TIPOS
// =====================================================================

type StatusPedido = "ABERTO" | "PARCIALMENTE_RECEBIDO" | "CONCLUIDO" | "CANCELADO"
type StatusItem = "EM_ESPERA" | "ORCANDO" | "APROVADO" | "AGUARDANDO_ENTREGA" | "RECEBIDO" | "CANCELADO"
type TipoItem = "MATERIAL_EXISTENTE" | "MATERIAL_NOVO"
type FiltroStatus = "TODOS" | StatusPedido

interface ItemPedido {
  id: string
  pedidoId: string
  tipo: TipoItem
  materialId: string | null
  material: { id: string; nome: string } | null
  nomeMaterialNovo: string | null
  descricaoNovo: string | null
  unidadeSugerida: string | null
  quantidade: number
  quantidadeRecebida: number
  status: StatusItem
  observacao: string | null
  dataPrevistaEntrega: string | null
  dataRecebimento: string | null
  createdAt: string
}

interface Pedido {
  id: string
  numero: number
  solicitanteNome: string
  solicitanteSetor: string
  solicitanteFuncao: string
  status: StatusPedido
  observacoes: string | null
  createdAt: string
  solicitante: { id: string; name: string }
  itens: ItemPedido[]
}

// =====================================================================
// CONFIG DE STATUS (label + cor)
// =====================================================================

const STATUS_ITEM_CONFIG: Record<StatusItem, { label: string; cor: keyof typeof theme.colors.status | "muted" }> = {
  EM_ESPERA: { label: "Em espera", cor: "muted" },
  ORCANDO: { label: "Orçando", cor: "info" },
  APROVADO: { label: "Aprovado", cor: "purple" },
  AGUARDANDO_ENTREGA: { label: "Aguardando entrega", cor: "warning" },
  RECEBIDO: { label: "Recebido", cor: "success" },
  CANCELADO: { label: "Cancelado", cor: "error" },
}

const STATUS_PEDIDO_CONFIG: Record<StatusPedido, { label: string; cor: keyof typeof theme.colors.status | "muted" }> = {
  ABERTO: { label: "Aberto", cor: "info" },
  PARCIALMENTE_RECEBIDO: { label: "Parcialmente recebido", cor: "warning" },
  CONCLUIDO: { label: "Concluído", cor: "success" },
  CANCELADO: { label: "Cancelado", cor: "error" },
}

function corDoStatus(cor: string): string {
  if (cor === "muted") return theme.colors.text.muted
  return (theme.colors.status as Record<string, string>)[cor] ?? theme.colors.text.muted
}

function formatarData(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// status de item que o usuário pode escolher manualmente. RECEBIDO fica
// de fora de propósito — só a futura tela de Movimentações pode setar
// isso, pra manter o vínculo com a entrada real em estoque.
const STATUS_ITEM_EDITAVEIS: StatusItem[] = ["EM_ESPERA", "ORCANDO", "APROVADO", "AGUARDANDO_ENTREGA", "CANCELADO"]

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

// =====================================================================
// LAYOUT
// =====================================================================

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
  background: ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.16)};
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.35)};
  color: ${({ theme }) => theme.colors.accent.yellow};
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
  max-width: 54ch;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
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

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface.glass};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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
// TOOLBAR
// =====================================================================

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
  max-width: 320px;

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
  flex-shrink: 0;
  flex-wrap: wrap;
`

const TabButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  white-space: nowrap;
  color: ${({ theme, $active }) => ($active ? theme.colors.text.primary : theme.colors.text.secondary)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface.sidebarActive : "transparent")};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.colors.surface.sidebarActive : theme.colors.surface.glass};
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

  option {
    background: ${({ theme }) => theme.colors.surface.sidebar};
  }
`

// =====================================================================
// LISTA DE PEDIDOS
// =====================================================================

const ListaPedidos = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`

const PedidoCard = styled.div<{ $index: number }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  animation: ${fadeInUp} 0.3s ease both;
  animation-delay: ${({ $index }) => Math.min($index, 10) * 40}ms;
`

const PedidoTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
  cursor: pointer;
`

const PedidoInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

const PedidoNumero = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

const SolicitanteLinha = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-wrap: wrap;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const SolicitanteDado = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: ${({ theme }) => theme.colors.text.secondary};

  svg {
    color: ${({ theme }) => theme.colors.text.muted};
    flex-shrink: 0;
  }

  strong {
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }
`

const PedidoAcoes = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`

const StatusBadge = styled.span<{ $cor: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
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

const ChevronButton = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text.muted};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`

// -------- itens do pedido --------

const ItensLista = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) 100px 150px 170px 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`

const ItemNome = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const ItemNomeTexto = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ItemTag = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.status.purple};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const ItemQuantidade = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-variant-numeric: tabular-nums;
`

const ItemStatusSelect = styled.select<{ $cor: string }>`
  ${glassCardStyles}
  background: ${({ $cor }) => hexToRgba($cor, 0.12)};
  border-color: ${({ $cor }) => hexToRgba($cor, 0.3)};
  color: ${({ $cor }) => $cor};
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;

  option {
    background: ${({ theme }) => theme.colors.surface.sidebar};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`

const ItemDataPrevista = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const ItemObservacao = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const AdicionarItemButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px dashed ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.5)};
    color: ${({ theme }) => theme.colors.primary.vivid};
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

// =====================================================================
// ESTADOS
// =====================================================================

const SkeletonCard = styled.div`
  ${glassCardStyles}
  height: 140px;
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

const ErrorState = styled.div`
  ${glassCardStyles}
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

  svg.spin {
    animation: ${spin} 0.7s linear infinite;
  }
`

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
  color: ${({ theme, $tone }) => ($tone === "success" ? theme.colors.status.success : theme.colors.status.error)};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

// =====================================================================
// COMPONENTE
// =====================================================================

export default function ComprasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [setorFiltro, setSetorFiltro] = useState("")
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("TODOS")

  const [pedidosExpandidos, setPedidosExpandidos] = useState<Record<string, boolean>>({})
  const [itensSalvando, setItensSalvando] = useState<Record<string, boolean>>({})

  const [toast, setToast] = useState<{ tone: "success" | "error"; texto: string } | null>(null)

  // states já prontos pros modais que entram na próxima etapa
  const [mostrarCriarPedido, setMostrarCriarPedido] = useState(false)
  const [pedidoParaAdicionarItem, setPedidoParaAdicionarItem] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const carregarPedidos = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const params = new URLSearchParams()
      if (buscaDebounced) params.set("busca", buscaDebounced)
      if (setorFiltro) params.set("setor", setorFiltro)
      if (statusFiltro !== "TODOS") params.set("status", statusFiltro)

      const res = await fetch(`/api/compras?${params.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar pedidos")
      const data = await res.json()
      setPedidos(data.pedidos ?? [])
      setSetoresDisponiveis(data.setoresDisponiveis ?? [])
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar pedidos.")
    } finally {
      setCarregando(false)
    }
  }, [buscaDebounced, setorFiltro, statusFiltro])

  useEffect(() => {
    carregarPedidos()
  }, [carregarPedidos])

  const stats = useMemo(() => {
    const abertos = pedidos.filter((p) => p.status === "ABERTO").length
    const parciais = pedidos.filter((p) => p.status === "PARCIALMENTE_RECEBIDO").length
    const todosItens = pedidos.flatMap((p) => p.itens)
    const aguardandoEntrega = todosItens.filter((i) => i.status === "AGUARDANDO_ENTREGA").length
    const orcando = todosItens.filter((i) => i.status === "ORCANDO").length
    return { abertos, parciais, aguardandoEntrega, orcando }
  }, [pedidos])

  function togglePedido(id: string) {
    setPedidosExpandidos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function alterarStatusItem(pedidoId: string, itemId: string, novoStatus: StatusItem) {
    setItensSalvando((prev) => ({ ...prev, [itemId]: true }))
    try {
      const res = await fetch(`/api/compras/${pedidoId}/itens/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar status do item")

      // atualiza local sem esperar refetch completo — resposta mais rápida
      setPedidos((prev) =>
        prev.map((p) =>
          p.id !== pedidoId
            ? p
            : { ...p, itens: p.itens.map((i) => (i.id === itemId ? { ...i, status: novoStatus } : i)) }
        )
      )
      setToast({ tone: "success", texto: "Status do item atualizado." })
      // status do pedido pode ter mudado no backend (recálculo automático)
      carregarPedidos()
    } catch (err) {
      setToast({ tone: "error", texto: err instanceof Error ? err.message : "Erro ao atualizar item." })
    } finally {
      setItensSalvando((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <ShoppingCart size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>Almoxarifado</Breadcrumb>
            <Title>Compras</Title>
            <Subtitle>
              Pedidos de compra de materiais centralizados por solicitante, setor e função. Baixa
              de estoque acontece só em Movimentações — aqui é o acompanhamento do processo de compra.
            </Subtitle>
          </div>
        </HeaderLeft>

        <HeaderActions>
          <SecondaryButton
            disabled
            title="Exportação em Excel — em breve"
            onClick={() => {
              /* TODO: <ExportarComprasButton /> — etapa separada */
            }}
          >
            <FileSpreadsheet size={16} />
            Exportar
          </SecondaryButton>
          <PrimaryButton onClick={() => setMostrarCriarPedido(true)}>
            <Plus size={16} />
            Novo pedido
          </PrimaryButton>
        </HeaderActions>
      </HeaderRow>

      <StatsGrid>
        <StatCard $accent={theme.colors.status.info}>
          <StatValue>{stats.abertos}</StatValue>
          <StatLabel>Pedidos abertos</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.warning}>
          <StatValue>{stats.parciais}</StatValue>
          <StatLabel>Parcialmente recebidos</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.info}>
          <StatValue>{stats.orcando}</StatValue>
          <StatLabel>Itens orçando</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.warning}>
          <StatValue>{stats.aguardandoEntrega}</StatValue>
          <StatLabel>Itens aguardando entrega</StatLabel>
        </StatCard>
      </StatsGrid>

      <Toolbar>
        <SearchBox>
          <Search size={16} />
          <input
            placeholder="Buscar por solicitante ou material..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </SearchBox>

        <Tabs>
          <TabButton $active={statusFiltro === "TODOS"} onClick={() => setStatusFiltro("TODOS")}>
            Todos
          </TabButton>
          <TabButton $active={statusFiltro === "ABERTO"} onClick={() => setStatusFiltro("ABERTO")}>
            Abertos
          </TabButton>
          <TabButton
            $active={statusFiltro === "PARCIALMENTE_RECEBIDO"}
            onClick={() => setStatusFiltro("PARCIALMENTE_RECEBIDO")}
          >
            Parciais
          </TabButton>
          <TabButton $active={statusFiltro === "CONCLUIDO"} onClick={() => setStatusFiltro("CONCLUIDO")}>
            Concluídos
          </TabButton>
          <TabButton $active={statusFiltro === "CANCELADO"} onClick={() => setStatusFiltro("CANCELADO")}>
            Cancelados
          </TabButton>
        </Tabs>

        <FiltroSelect value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)}>
          <option value="">Todos os setores</option>
          {setoresDisponiveis.map((setor) => (
            <option key={setor} value={setor}>
              {setor}
            </option>
          ))}
        </FiltroSelect>
      </Toolbar>

      {carregando && (
        <ListaPedidos>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ListaPedidos>
      )}

      {!carregando && erro && (
        <ErrorState>
          <AlertTriangle size={32} />
          <span>{erro}</span>
          <RetryButton onClick={carregarPedidos}>
            <RefreshCw size={14} />
            Tentar novamente
          </RetryButton>
        </ErrorState>
      )}

      {!carregando && !erro && pedidos.length === 0 && (
        <EmptyState>
          <Inbox size={32} />
          <span>Nenhum pedido de compra encontrado pra esse filtro.</span>
        </EmptyState>
      )}

      {!carregando && !erro && pedidos.length > 0 && (
        <ListaPedidos>
          {pedidos.map((pedido, index) => {
            const expandido = pedidosExpandidos[pedido.id] ?? true
            const configPedido = STATUS_PEDIDO_CONFIG[pedido.status]

            return (
              <PedidoCard key={pedido.id} $index={index}>
                <PedidoTopo onClick={() => togglePedido(pedido.id)}>
                  <PedidoInfo>
                    <PedidoNumero>Pedido #{pedido.numero}</PedidoNumero>
                    <SolicitanteLinha>
                      <SolicitanteDado>
                        <UserRound size={13} />
                        <strong>{pedido.solicitanteNome}</strong>
                      </SolicitanteDado>
                      <SolicitanteDado>
                        <Building2 size={13} />
                        {pedido.solicitanteSetor}
                      </SolicitanteDado>
                      <SolicitanteDado>
                        <Briefcase size={13} />
                        {pedido.solicitanteFuncao}
                      </SolicitanteDado>
                      <SolicitanteDado>
                        <CalendarClock size={13} />
                        {formatarData(pedido.createdAt)}
                      </SolicitanteDado>
                    </SolicitanteLinha>
                  </PedidoInfo>

                  <PedidoAcoes>
                    <StatusBadge $cor={corDoStatus(configPedido.cor)}>{configPedido.label}</StatusBadge>
                    <ChevronButton
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePedido(pedido.id)
                      }}
                    >
                      {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </ChevronButton>
                  </PedidoAcoes>
                </PedidoTopo>

                {expandido && (
                  <ItensLista>
                    {pedido.itens.map((item) => {
                      const configItem = STATUS_ITEM_CONFIG[item.status]
                      const nomeExibido = item.material?.nome ?? item.nomeMaterialNovo ?? "—"
                      const salvandoEsteItem = itensSalvando[item.id]

                      return (
                        <ItemRow key={item.id}>
                          <ItemNome>
                            <ItemNomeTexto title={nomeExibido}>{nomeExibido}</ItemNomeTexto>
                            {item.tipo === "MATERIAL_NOVO" && <ItemTag>Sem cadastro</ItemTag>}
                          </ItemNome>

                          <ItemQuantidade>
                            {item.quantidade} {item.unidadeSugerida ?? ""}
                          </ItemQuantidade>

                          <ItemStatusSelect
                            value={item.status}
                            disabled={salvandoEsteItem || item.status === "RECEBIDO"}
                            $cor={corDoStatus(configItem.cor)}
                            onChange={(e) =>
                              alterarStatusItem(pedido.id, item.id, e.target.value as StatusItem)
                            }
                          >
                            {STATUS_ITEM_EDITAVEIS.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_ITEM_CONFIG[status].label}
                              </option>
                            ))}
                            {item.status === "RECEBIDO" && (
                              <option value="RECEBIDO">Recebido (via Movimentação)</option>
                            )}
                          </ItemStatusSelect>

                          <ItemDataPrevista>
                            <CalendarClock size={12} />
                            {item.dataPrevistaEntrega
                              ? `Previsto: ${formatarData(item.dataPrevistaEntrega)}`
                              : "Sem previsão"}
                          </ItemDataPrevista>

                          <ItemObservacao title={item.observacao ?? undefined}>
                            {item.observacao ?? ""}
                          </ItemObservacao>
                        </ItemRow>
                      )
                    })}

                    {pedido.status !== "CANCELADO" && pedido.status !== "CONCLUIDO" && (
                      <AdicionarItemButton onClick={() => setPedidoParaAdicionarItem(pedido.id)}>
                        <Plus size={13} />
                        Adicionar item a este pedido
                      </AdicionarItemButton>
                    )}
                  </ItensLista>
                )}
              </PedidoCard>
            )
          })}
        </ListaPedidos>
      )}

      {/* TODO — próxima etapa:
      {mostrarCriarPedido && (
        <CriarPedidoModal
          onClose={() => setMostrarCriarPedido(false)}
          onCriado={() => { setMostrarCriarPedido(false); carregarPedidos() }}
        />
      )}
      {pedidoParaAdicionarItem && (
        <AdicionarItemModal
          pedidoId={pedidoParaAdicionarItem}
          onClose={() => setPedidoParaAdicionarItem(null)}
          onAdicionado={() => { setPedidoParaAdicionarItem(null); carregarPedidos() }}
        />
      )}
      */}

      {toast && (
        <Toast $tone={toast.tone}>
          {toast.tone === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.texto}
        </Toast>
      )}
    </PageWrapper>
  )
}