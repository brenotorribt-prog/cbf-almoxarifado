"use client"

/**
 * /compras — Pedidos de compra de materiais
 * ------------------------------------------------------------------
 * Lista virtualizada com scroll infinito real.
 * - Pedidos começam recolhidos
 * - Expandem ao passar o mouse
 * - Recolhem ao tirar o mouse (com pequeno debounce anti-flicker)
 * - Itens clicáveis com feedback visual
 * - "Todos os pedidos carregados" aparece apenas no final, sem sobreposição
 *
 * FIX: a altura de cada linha agora é MEDIDA DINAMICAMENTE pelo
 * @tanstack/react-virtual (measureElement), em vez de fixa em 90px.
 * Antes disso, ao expandir um pedido no hover, o conteúdo extra
 * "vazava" para fora da linha (que continuava com 90px de altura
 * reservada no virtualizador) e o próximo item — posicionado por cima
 * dele — roubava os eventos de mouse, causando abrir/fechar em loop.
 * Como consequência, a altura total da lista também ficava errada e
 * o rodapé "Todos os pedidos carregados" acabava sobreposto ao último
 * card. Com measureElement, o virtualizador reposiciona tudo abaixo
 * do card expandido corretamente, e getTotalSize() reflete a altura
 * real — resolvendo os dois problemas de uma vez.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useInfiniteQuery } from "@tanstack/react-query"
import { theme, hexToRgba } from "@/styles/theme"
import { createClient } from "@/lib/supabase/client"
import {
  ShoppingCart,
  Plus,
  Search,
  Inbox,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  UserRound,
  Building2,
  Briefcase,
  CalendarClock,
  X,
  Check,
  ChevronRight,
} from "lucide-react"
import CriarPedidoModal from "@/components/compras/modals/criar"
import AdicionarItemModal from "@/components/compras/modals/adicionar-item"
import ExportarComprasButton from "@/components/compras/exportar-button"

// =====================================================================
// TIPOS
// =====================================================================

type StatusPedido = "ABERTO" | "PARCIALMENTE_RECEBIDO" | "CONCLUIDO" | "CANCELADO"
type StatusItem = "EM_ESPERA" | "ORCANDO" | "APROVADO" | "AGUARDANDO_ENTREGA" | "RECEBIDO" | "CANCELADO"
type TipoItem = "MATERIAL_EXISTENTE" | "MATERIAL_NOVO"
type FiltroStatus = "TODOS" | StatusPedido
type PeriodoTipo = "HOJE" | "SETE_DIAS" | "MES" | "TUDO" | "PERSONALIZADO"

interface ItemPedido {
  id: string
  pedidoId: string
  tipo: TipoItem
  materialId: string | null
  material: {
    id: string
    nome: string
    codigoInterno: string
    descricao: string | null
    marca: string | null
    fabricante: string | null
    modelo: string | null
    fornecedor: string | null
    unidadeMedida: { sigla: string } | null
  } | null
  nomeMaterialNovo: string | null
  descricaoNovo: string | null
  unidadeSugerida: string | null
  marcaNovo: string | null
  fabricanteNovo: string | null
  modeloNovo: string | null
  fornecedorNovo: string | null
  quantidade: number
  quantidadeRecebida: number
  status: StatusItem
  observacao: string | null
  prazoMaximoNecessario: string | null
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

interface PageData {
  pedidos: Pedido[]
  nextCursor: number | null
  setoresDisponiveis: string[]
  resumo: {
    abertos: number
    parciais: number
    aguardandoEntrega: number
    orcando: number
  }
}

const PAPEIS_SEM_CRIAR = new Set(["SOLICITANTE"])

// =====================================================================
// CONFIG DE STATUS
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

const STATUS_ITEM_EDITAVEIS: StatusItem[] = ["EM_ESPERA", "ORCANDO", "APROVADO", "AGUARDANDO_ENTREGA", "CANCELADO"]

// =====================================================================
// CONSTANTES
// =====================================================================

const ALTURA_LINHA = 90 // usada apenas como estimativa inicial do virtualizador
const LIMIT = 40
const PAGINAS_PARA_MANTER = 3
const DELAY_RECOLHER_MS = 150 // debounce do mouseleave, evita flicker

// =====================================================================
// ANIMAÇÕES
// =====================================================================

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`

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

const ListContainer = styled.div`
  ${glassCardStyles}
  flex: 1;
  min-height: 420px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: ${({ theme }) => theme.spacing[2]};

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const RowsSizer = styled.div`
  position: relative;
  width: 100%;
`

// =====================================================================
// PEDIDO CARD - com hover expand
// =====================================================================

const PedidoCardWrapper = styled.div`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[4]};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  transition: border-color ${({ theme }) => theme.transitions.fast}, box-shadow ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.4)};
    box-shadow: ${({ theme }) => `0 4px 20px ${hexToRgba(theme.colors.primary.vivid, 0.1)}`};
  }
`

const PedidoTopo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`

const PedidoInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
`

const PedidoNumero = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

const SolicitanteNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
`

const SolicitanteSetor = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.full};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
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

const ExpandIcon = styled(ChevronRight)<{ $expandido: boolean }>`
  transition: transform ${({ theme }) => theme.transitions.fast};
  transform: ${({ $expandido }) => ($expandido ? "rotate(90deg)" : "rotate(0deg)")};
`

// =====================================================================
// ITENS - com feedback visual de clique
// =====================================================================

const ItensContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  margin-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
  animation: ${fadeIn} 0.2s ease both;
`

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) 100px 150px 170px 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  border: 1px solid transparent;
  position: relative;

  &:hover {
    background: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.06)};
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.2)};
    transform: translateX(4px);
  }

  &:active {
    transform: scale(0.99);
  }

  /* Indicador visual de que é clicável - pequena seta à direita */
  &::after {
    content: "›";
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 18px;
    color: ${({ theme }) => theme.colors.text.muted};
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transitions.fast};
  }

  &:hover::after {
    opacity: 0.6;
  }

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

const ItemDetalhesExpandido = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 10px 12px;
  margin-top: -4px;
  margin-bottom: 4px;
  border-radius: 8px;
  background: ${({ theme }) => hexToRgba(theme.colors.status.info, 0.06)};
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.status.info, 0.16)};
  font-size: 12px;
  animation: ${fadeIn} 0.2s ease both;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
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

const SkeletonCard = styled.div`
  ${glassCardStyles}
  height: 80px;
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

const FimLista = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.muted};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
  margin-top: ${({ theme }) => theme.spacing[2]};
  background: ${({ theme }) => theme.colors.surface.glass};
  border-radius: ${({ theme }) => theme.radii.md};
  position: relative;
  z-index: 1;
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
  animation: ${fadeIn} 0.2s ease both;
`

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

export default function ComprasPage() {
  const [role, setRole] = useState("")
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  // Buscar role do usuário com Supabase
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

  const podeCriar = !PAPEIS_SEM_CRIAR.has(role)

  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [setorFiltro, setSetorFiltro] = useState("")
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("TODOS")

  // Estado para controlar qual pedido está expandido (apenas 1 por vez)
  const [pedidoExpandidoId, setPedidoExpandidoId] = useState<string | null>(null)
  const [itensExpandidos, setItensExpandidos] = useState<Record<string, boolean>>({})
  const [itensSalvando, setItensSalvando] = useState<Record<string, boolean>>({})

  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("HOJE")
  const [dataInicioFiltro, setDataInicioFiltro] = useState(() => new Date().toISOString().slice(0, 10))
  const [dataFimFiltro, setDataFimFiltro] = useState(() => new Date().toISOString().slice(0, 10))

  const [toast, setToast] = useState<{ tone: "success" | "error"; texto: string } | null>(null)

  const [mostrarCriarPedido, setMostrarCriarPedido] = useState(false)
  const [pedidoParaAdicionarItem, setPedidoParaAdicionarItem] = useState<string | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)

  // Timeout do debounce de "recolher ao tirar o mouse" — evita que um
  // movimento rápido do cursor entre elementos internos feche e reabra
  // o card em sequência (flicker).
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current)
    }
  }, [])

  function selecionarPeriodo(tipo: PeriodoTipo) {
    setPeriodoTipo(tipo)
    if (tipo === "PERSONALIZADO" || tipo === "TUDO") return
    const fim = new Date().toISOString().slice(0, 10)
    const inicio = new Date()
    if (tipo === "SETE_DIAS") inicio.setDate(inicio.getDate() - 6)
    if (tipo === "MES") inicio.setDate(inicio.getDate() - 29)
    setDataInicioFiltro(tipo === "HOJE" ? fim : inicio.toISOString().slice(0, 10))
    setDataFimFiltro(fim)
  }

  function toggleItem(itemId: string) {
    setItensExpandidos((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // Hover do pedido - expande/recolhe
  function handleMouseEnter(pedidoId: string) {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
    setPedidoExpandidoId((atual) => (atual === pedidoId ? atual : pedidoId))
  }

  function handleMouseLeave() {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current)
    collapseTimeoutRef.current = setTimeout(() => {
      setPedidoExpandidoId(null)
      collapseTimeoutRef.current = null
    }, DELAY_RECOLHER_MS)
  }

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const fetchPage = async ({ pageParam }: { pageParam: number | null }): Promise<PageData> => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    if (pageParam !== null && pageParam !== undefined) {
      params.set("cursor", String(pageParam))
    }
    if (buscaDebounced) params.set("busca", buscaDebounced)
    if (setorFiltro) params.set("setor", setorFiltro)
    if (statusFiltro !== "TODOS") params.set("status", statusFiltro)
    if (periodoTipo !== "TUDO") {
      params.set("dataInicio", dataInicioFiltro)
      params.set("dataFim", dataFimFiltro)
    }

    const res = await fetch(`/api/compras?${params.toString()}`)
    if (!res.ok) throw new Error("Falha ao carregar pedidos")
    const data = await res.json()

    return {
      pedidos: data.pedidos ?? [],
      nextCursor: data.nextCursor ?? null,
      setoresDisponiveis: data.setoresDisponiveis ?? [],
      resumo: {
        abertos: data.resumo?.abertos ?? 0,
        parciais: data.resumo?.parciais ?? 0,
        aguardandoEntrega: data.resumo?.aguardandoEntrega ?? 0,
        orcando: data.resumo?.orcando ?? 0,
      },
    }
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["compras", buscaDebounced, setorFiltro, statusFiltro, periodoTipo, dataInicioFiltro, dataFimFiltro],
    queryFn: ({ pageParam }) => fetchPage({ pageParam: pageParam as number | null }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage: PageData) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 5,
    maxPages: PAGINAS_PARA_MANTER,
  })

  const todosPedidos = data?.pages?.flatMap((page) => page.pedidos) ?? []

  const ultimaPagina = data?.pages?.[data.pages.length - 1]
  const resumo = ultimaPagina?.resumo ?? {
    abertos: 0,
    parciais: 0,
    aguardandoEntrega: 0,
    orcando: 0,
  }

  const setoresDisponiveis = data?.pages?.[0]?.setoresDisponiveis ?? []

  const totalItems = todosPedidos.length
  const hasMore = hasNextPage

  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
    // Mede a altura real de cada linha renderizada (inclui o card
    // expandido no hover) e reposiciona as linhas seguintes de acordo.
    // Isso é o que corrige tanto o flicker do hover quanto a
    // sobreposição do rodapé "Todos os pedidos carregados".
    measureElement:
      typeof window !== "undefined"
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  })

  const itensVirtuais = virtualizer.getVirtualItems()

  useEffect(() => {
    const ultimo = itensVirtuais[itensVirtuais.length - 1]
    if (!ultimo) return
    if (ultimo.index >= totalItems - 20 && hasMore && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [itensVirtuais, totalItems, hasMore, isFetchingNextPage, fetchNextPage])

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

      setToast({ tone: "success", texto: "Status do item atualizado." })
      refetch()
    } catch (err) {
      setToast({ tone: "error", texto: err instanceof Error ? err.message : "Erro ao atualizar item." })
    } finally {
      setItensSalvando((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  // Se estiver carregando o usuário, mostrar loading
  if (isLoadingUser) {
    return (
      <PageWrapper>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '400px',
          color: theme.colors.text.muted
        }}>
          <RefreshCw size={24} style={{ animation: 'spin 0.7s linear infinite' }} />
          <span style={{ marginLeft: '12px' }}>Carregando...</span>
        </div>
      </PageWrapper>
    )
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
              Pedidos de compra de materiais centralizados por solicitante, setor e função.
            </Subtitle>
          </div>
        </HeaderLeft>

        <HeaderActions>
          <ExportarComprasButton
            busca={buscaDebounced}
            setor={setorFiltro}
            status={statusFiltro}
            onErro={(mensagem) => setToast({ tone: "error", texto: mensagem })}
          />
          {podeCriar && (
            <PrimaryButton onClick={() => setMostrarCriarPedido(true)}>
              <Plus size={16} />
              Novo pedido
            </PrimaryButton>
          )}
        </HeaderActions>
      </HeaderRow>

      <StatsGrid>
        <StatCard $accent={theme.colors.status.info}>
          <StatValue>{resumo.abertos}</StatValue>
          <StatLabel>Pedidos abertos</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.warning}>
          <StatValue>{resumo.parciais}</StatValue>
          <StatLabel>Parcialmente recebidos</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.info}>
          <StatValue>{resumo.orcando}</StatValue>
          <StatLabel>Itens orçando</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.warning}>
          <StatValue>{resumo.aguardandoEntrega}</StatValue>
          <StatLabel>Itens aguardando entrega</StatLabel>
        </StatCard>
      </StatsGrid>

      <Toolbar>
        <Tabs>
          <TabButton $active={periodoTipo === "HOJE"} onClick={() => selecionarPeriodo("HOJE")}>
            Hoje
          </TabButton>
          <TabButton $active={periodoTipo === "SETE_DIAS"} onClick={() => selecionarPeriodo("SETE_DIAS")}>
            7 dias
          </TabButton>
          <TabButton $active={periodoTipo === "MES"} onClick={() => selecionarPeriodo("MES")}>
            30 dias
          </TabButton>
          <TabButton $active={periodoTipo === "TUDO"} onClick={() => selecionarPeriodo("TUDO")}>
            Tudo
          </TabButton>
          <TabButton $active={periodoTipo === "PERSONALIZADO"} onClick={() => setPeriodoTipo("PERSONALIZADO")}>
            Personalizado
          </TabButton>
        </Tabs>

        {periodoTipo === "PERSONALIZADO" && (
          <>
            <input
              type="date"
              value={dataInicioFiltro}
              onChange={(e) => setDataInicioFiltro(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${theme.colors.surface.border}`,
                background: theme.colors.surface.glass,
                color: theme.colors.text.primary,
                fontSize: "14px",
              }}
            />
            <input
              type="date"
              value={dataFimFiltro}
              onChange={(e) => setDataFimFiltro(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${theme.colors.surface.border}`,
                background: theme.colors.surface.glass,
                color: theme.colors.text.primary,
                fontSize: "14px",
              }}
            />
          </>
        )}
      </Toolbar>

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

      <ListContainer ref={parentRef}>
        {isLoading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        )}

        {!isLoading && isError && (
          <ErrorState>
            <AlertTriangle size={32} />
            <span>{error instanceof Error ? error.message : "Erro ao carregar pedidos."}</span>
            <RetryButton onClick={() => refetch()}>
              <RefreshCw size={14} />
              Tentar novamente
            </RetryButton>
          </ErrorState>
        )}

        {!isLoading && !isError && totalItems === 0 && (
          <EmptyState>
            <Inbox size={32} />
            <span>Nenhum pedido de compra encontrado para esse filtro.</span>
          </EmptyState>
        )}

        {!isLoading && !isError && totalItems > 0 && (
          <>
            <RowsSizer style={{ height: virtualizer.getTotalSize() }}>
              {itensVirtuais.map((item) => {
                const pedido = todosPedidos[item.index]
                if (!pedido) return null
                const expandido = pedidoExpandidoId === pedido.id
                const configPedido = STATUS_PEDIDO_CONFIG[pedido.status]

                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${item.start}px)`,
                      padding: `0 ${theme.spacing[1]}`,
                    }}
                  >
                    <PedidoCardWrapper
                      onMouseEnter={() => handleMouseEnter(pedido.id)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <PedidoTopo>
                        <PedidoInfo>
                          <PedidoNumero>#{pedido.numero}</PedidoNumero>
                          <SolicitanteNome>{pedido.solicitanteNome}</SolicitanteNome>
                          <SolicitanteSetor>{pedido.solicitanteSetor}</SolicitanteSetor>
                          <span style={{ fontSize: "11px", color: theme.colors.text.muted }}>
                            {formatarData(pedido.createdAt)}
                          </span>
                        </PedidoInfo>

                        <PedidoAcoes>
                          <StatusBadge $cor={corDoStatus(configPedido.cor)}>
                            {configPedido.label}
                          </StatusBadge>
                          <ExpandIcon size={18} $expandido={expandido} />
                        </PedidoAcoes>
                      </PedidoTopo>

                      {expandido && (
                        <ItensContainer>
                          {pedido.itens.map((itemPedido) => {
                            const configItem = STATUS_ITEM_CONFIG[itemPedido.status]
                            const nomeExibido = itemPedido.material?.nome ?? itemPedido.nomeMaterialNovo ?? "—"
                            const salvandoEsteItem = itensSalvando[itemPedido.id]
                            const itemExpandido = itensExpandidos[itemPedido.id] ?? false

                            const descricao = itemPedido.material?.descricao ?? itemPedido.descricaoNovo
                            const unidade = itemPedido.material?.unidadeMedida?.sigla ?? itemPedido.unidadeSugerida
                            const marca = itemPedido.material?.marca ?? itemPedido.marcaNovo
                            const fabricante = itemPedido.material?.fabricante ?? itemPedido.fabricanteNovo
                            const modelo = itemPedido.material?.modelo ?? itemPedido.modeloNovo
                            const fornecedor = itemPedido.material?.fornecedor ?? itemPedido.fornecedorNovo

                            return (
                              <div key={itemPedido.id}>
                                <ItemRow onClick={() => toggleItem(itemPedido.id)}>
                                  <ItemNome>
                                    <ItemNomeTexto title={nomeExibido}>{nomeExibido}</ItemNomeTexto>
                                    {itemPedido.tipo === "MATERIAL_NOVO" && <ItemTag>Sem cadastro</ItemTag>}
                                  </ItemNome>

                                  <ItemQuantidade>
                                    {itemPedido.quantidade} {unidade ?? ""}
                                  </ItemQuantidade>

                                  <ItemStatusSelect
                                    value={itemPedido.status}
                                    disabled={salvandoEsteItem || itemPedido.status === "RECEBIDO"}
                                    $cor={corDoStatus(configItem.cor)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      alterarStatusItem(pedido.id, itemPedido.id, e.target.value as StatusItem)
                                    }
                                  >
                                    {STATUS_ITEM_EDITAVEIS.map((status) => (
                                      <option key={status} value={status}>
                                        {STATUS_ITEM_CONFIG[status].label}
                                      </option>
                                    ))}
                                    {itemPedido.status === "RECEBIDO" && (
                                      <option value="RECEBIDO">Recebido (via Movimentação)</option>
                                    )}
                                  </ItemStatusSelect>

                                  <ItemDataPrevista>
                                    <CalendarClock size={12} />
                                    {itemPedido.prazoMaximoNecessario
                                      ? `Necessário até: ${formatarData(itemPedido.prazoMaximoNecessario)}`
                                      : "Sem prazo definido"}
                                  </ItemDataPrevista>

                                  <ItemObservacao title={itemPedido.observacao ?? undefined}>
                                    {itemPedido.observacao ?? ""}
                                  </ItemObservacao>
                                </ItemRow>

                                {itemExpandido && (
                                  <ItemDetalhesExpandido>
                                    <div><strong>Descrição:</strong> {descricao || "—"}</div>
                                    <div><strong>Marca:</strong> {marca || "—"}</div>
                                    <div><strong>Fabricante:</strong> {fabricante || "—"}</div>
                                    <div><strong>Modelo:</strong> {modelo || "—"}</div>
                                    <div><strong>Fornecedor:</strong> {fornecedor || "—"}</div>
                                    {itemPedido.material?.codigoInterno && (
                                      <div><strong>Código interno:</strong> {itemPedido.material.codigoInterno}</div>
                                    )}
                                  </ItemDetalhesExpandido>
                                )}
                              </div>
                            )
                          })}

                          {pedido.status !== "CANCELADO" && pedido.status !== "CONCLUIDO" && (
                            <AdicionarItemButton onClick={() => setPedidoParaAdicionarItem(pedido.id)}>
                              <Plus size={13} />
                              Adicionar item a este pedido
                            </AdicionarItemButton>
                          )}
                        </ItensContainer>
                      )}
                    </PedidoCardWrapper>
                  </div>
                )
              })}
            </RowsSizer>

            {/* "Todos os pedidos carregados" - fora do RowsSizer.
                Agora que RowsSizer usa a altura MEDIDA (measureElement),
                getTotalSize() já contabiliza qualquer card expandido,
                então este rodapé nunca mais fica por baixo/sobreposto. */}
            {!hasNextPage && !isFetchingNextPage && !isError && totalItems > 0 && (
              <FimLista>✓ Todos os pedidos carregados ({totalItems})</FimLista>
            )}
          </>
        )}

        {isFetchingNextPage && (
          <CarregandoMais>
            <RefreshCw size={14} className="spin" />
            Carregando mais pedidos...
          </CarregandoMais>
        )}
      </ListContainer>

      {mostrarCriarPedido && (
        <CriarPedidoModal
          onClose={() => setMostrarCriarPedido(false)}
          onCriado={() => {
            setMostrarCriarPedido(false)
            refetch()
          }}
        />
      )}

      {pedidoParaAdicionarItem && (
        <AdicionarItemModal
          pedidoId={pedidoParaAdicionarItem}
          numeroPedido={todosPedidos.find((p) => p.id === pedidoParaAdicionarItem)?.numero ?? 0}
          onClose={() => setPedidoParaAdicionarItem(null)}
          onAdicionado={() => {
            setPedidoParaAdicionarItem(null)
            refetch()
          }}
        />
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