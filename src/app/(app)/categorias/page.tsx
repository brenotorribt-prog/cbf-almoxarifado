"use client"

/**
 * /categorias — Cadastro de categorias e unidades de medida
 * ------------------------------------------------------------------
 * Página unificada para gerenciar categorias e unidades de medida
 * utilizadas no cadastro de materiais. Abas para alternar entre as
 * duas visualizações.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Tags,
  Package,
  Check,
  X,
  Loader2,
  Inbox,
  AlertTriangle,
  Ruler,
  Hash,
  Droplets,
  UserRound,
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

type TipoUnidade = "INTEIRA" | "FRACIONADA"
type AbaAtiva = "categorias" | "unidades" | "pessoas"

interface Categoria {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  createdAt: string
  totalMateriais: number
}

interface UnidadeMedida {
  id: string
  sigla: string
  nome: string
  tipo: TipoUnidade
  createdAt: string
  totalMateriais: number
}

interface PessoaAtendida {
  id: string
  nome: string
  setor: string
  funcao: string
}

type FiltroAtivo = "todas" | "ativas" | "inativas"

// =====================================================================
// HELPERS
// =====================================================================

function corCategoria(id: string): string {
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
// LAYOUT BASE
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

const HeaderBadge = styled.div<{ $aba: AbaAtiva }>`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.radii.lg};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme, $aba }) =>
    hexToRgba(
      $aba === "unidades" ? theme.colors.status.info : 
      $aba === "pessoas" ? theme.colors.status.purple :
      theme.colors.accent.green,
      0.16
    )};
  border: 1px solid ${({ theme, $aba }) =>
    hexToRgba(
      $aba === "unidades" ? theme.colors.status.info : 
      $aba === "pessoas" ? theme.colors.status.purple :
      theme.colors.accent.green,
      0.35
    )};
  color: ${({ theme, $aba }) =>
    $aba === "unidades" ? theme.colors.status.info : 
    $aba === "pessoas" ? theme.colors.status.purple :
    theme.colors.accent.green};
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

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

const PrimaryButton = styled.button<{ $aba: AbaAtiva }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme, $aba }) =>
    $aba === "unidades" ? theme.colors.status.info : 
    $aba === "pessoas" ? theme.colors.status.purple :
    theme.colors.accent.green};
  color: ${({ theme }) => theme.colors.neutral.white};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  transition: background ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme, $aba }) =>
      $aba === "unidades"
        ? theme.colors.status.info
        : $aba === "pessoas"
        ? theme.colors.status.purple
        : theme.colors.accent.greenDark};
    filter: brightness(0.9);
  }
`

// =====================================================================
// ABAS
// =====================================================================

const AbasContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[1]};
  width: fit-content;
`

const AbaButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[6]}`};
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
// TOOLBAR
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
// GRID DE CATEGORIAS
// =====================================================================

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
`

const CategoriaCard = styled.div<{ $index: number; $inativa: boolean }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  animation: ${fadeInUp} 0.3s ease both;
  animation-delay: ${({ $index }) => Math.min($index, 10) * 35}ms;
  transition: box-shadow ${({ theme }) => theme.transitions.base};
  opacity: ${({ $inativa }) => ($inativa ? 0.55 : 1)};

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.cardHover};
  }
`

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const Swatch = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $color }) => hexToRgba($color, 0.22)};
  border: 1px solid ${({ $color }) => hexToRgba($color, 0.4)};
  color: ${({ $color }) => $color};
  flex-shrink: 0;
`

const CategoriaNome = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`

const CategoriaDescricao = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  flex: 1;
`

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[2]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const ContagemMateriais = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
`

const GhostIconButton = styled.button`
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text.muted};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface.glass};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  &.danger:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.status.errorBg};
    color: ${({ theme }) => theme.colors.status.error};
  }
`

// Switch de ativo/inativo
const Switch = styled.button<{ $on: boolean }>`
  width: 34px;
  height: 20px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme, $on }) =>
    $on ? theme.colors.status.success : theme.colors.neutral[700]};
  position: relative;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.transitions.fast};

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${({ $on }) => ($on ? "16px" : "2px")};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.neutral.white};
    transition: left ${({ theme }) => theme.transitions.fast};
  }
`

// =====================================================================
// GRID DE UNIDADES
// =====================================================================

const UnidadeCard = styled.div<{ $index: number }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  animation: ${fadeInUp} 0.3s ease both;
  animation-delay: ${({ $index }) => Math.min($index, 10) * 35}ms;
  transition: box-shadow ${({ theme }) => theme.transitions.base};

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.cardHover};
  }
`

const UnidadeSwatch = styled.div<{ $tipo: TipoUnidade }>`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ theme, $tipo }) =>
    hexToRgba($tipo === "FRACIONADA" ? theme.colors.status.purple : theme.colors.status.info, 0.2)};
  border: 1px solid
    ${({ theme, $tipo }) =>
      hexToRgba($tipo === "FRACIONADA" ? theme.colors.status.purple : theme.colors.status.info, 0.4)};
  color: ${({ theme, $tipo }) =>
    $tipo === "FRACIONADA" ? theme.colors.status.purple : theme.colors.status.info};
`

const TipoBadge = styled.span<{ $tipo: TipoUnidade }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, $tipo }) =>
    $tipo === "FRACIONADA" ? theme.colors.status.purple : theme.colors.status.info};
  background: ${({ theme, $tipo }) =>
    $tipo === "FRACIONADA" ? theme.colors.status.purpleBg : theme.colors.status.infoBg};
  border: 1px solid
    ${({ theme, $tipo }) =>
      $tipo === "FRACIONADA" ? theme.colors.status.purpleBorder : theme.colors.status.infoBorder};
`

const UnidadeNomeLinha = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
`

const UnidadeNome = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`

const UnidadeSigla = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

// =====================================================================
// ESTADOS (loading / empty)
// =====================================================================

const SkeletonCard = styled.div<{ $aba?: AbaAtiva }>`
  ${glassCardStyles}
  height: ${({ $aba }) => ($aba === "unidades" ? "120px" : "140px")};
  animation: ${pulse} 1.4s ease-in-out infinite;
`

const EmptyState = styled.div`
  ${glassCardStyles}
  grid-column: 1 / -1;
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
// MODAL (criar / editar)
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

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
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

const Input = styled.input`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const Textarea = styled.textarea`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
  min-height: 80px;
  resize: vertical;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const TipoOpcoes = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[2]};
`

const TipoOpcao = styled.button<{ $selecionado: boolean; $tipo: TipoUnidade }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[3]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  border-color: ${({ theme, $selecionado, $tipo }) =>
    $selecionado
      ? $tipo === "FRACIONADA"
        ? theme.colors.status.purpleBorder
        : theme.colors.status.infoBorder
      : theme.colors.surface.border};
  background: ${({ theme, $selecionado, $tipo }) =>
    $selecionado
      ? $tipo === "FRACIONADA"
        ? theme.colors.status.purpleBg
        : theme.colors.status.infoBg
      : theme.colors.surface.glass};
  color: ${({ theme, $selecionado, $tipo }) =>
    $selecionado
      ? $tipo === "FRACIONADA"
        ? theme.colors.status.purple
        : theme.colors.status.info
      : theme.colors.text.secondary};

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }
`

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.error};
`

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ActionButton = styled.button<{ $variant: "primary" | "danger" | "ghost" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};

  ${({ $variant, theme }) =>
    $variant === "primary" &&
    `
    background: ${theme.colors.accent.green};
    color: ${theme.colors.neutral.white};
    &:hover:not(:disabled) { background: ${theme.colors.accent.greenDark}; }
  `}

  ${({ $variant, theme }) =>
    $variant === "danger" &&
    `
    background: ${theme.colors.status.error};
    color: ${theme.colors.neutral.white};
    &:hover:not(:disabled) { background: #c62828; }
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

const AvisoExclusao = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.warningBg};
  border: 1px solid ${({ theme }) => theme.colors.status.warningBorder};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};

  svg {
    color: ${({ theme }) => theme.colors.accent.yellow};
    flex-shrink: 0;
    margin-top: 1px;
  }
`

// =====================================================================
// COMPONENTE
// =====================================================================

type ModalCategoria = { modo: "criar" } | { modo: "editar"; categoria: Categoria }
type ModalUnidade = { modo: "criar" } | { modo: "editar"; unidade: UnidadeMedida }
type ModalPessoa = { modo: "criar" } | { modo: "editar"; pessoa: PessoaAtendida }

export default function CategoriasPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("categorias")

  // Estado para categorias
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carregandoCategorias, setCarregandoCategorias] = useState(true)
  const [buscaCategorias, setBuscaCategorias] = useState("")
  const [buscaCategoriasDebounced, setBuscaCategoriasDebounced] = useState("")
  const [filtroCategorias, setFiltroCategorias] = useState<FiltroAtivo>("todas")

  // Estado para unidades
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [carregandoUnidades, setCarregandoUnidades] = useState(true)
  const [buscaUnidades, setBuscaUnidades] = useState("")
  const [buscaUnidadesDebounced, setBuscaUnidadesDebounced] = useState("")

  // Estado para pessoas
  const [pessoas, setPessoas] = useState<PessoaAtendida[]>([])
  const [carregandoPessoas, setCarregandoPessoas] = useState(true)
  const [buscaPessoas, setBuscaPessoas] = useState("")
  const [buscaPessoasDebounced, setBuscaPessoasDebounced] = useState("")

  // Modal categorias
  const [modalCategoria, setModalCategoria] = useState<ModalCategoria | null>(null)
  const [formCatNome, setFormCatNome] = useState("")
  const [formCatDescricao, setFormCatDescricao] = useState("")
  const [formCatErro, setFormCatErro] = useState<string | null>(null)
  const [salvandoCat, setSalvandoCat] = useState(false)
  const [modalExcluirCat, setModalExcluirCat] = useState<Categoria | null>(null)
  const [excluindoCat, setExcluindoCat] = useState(false)
  const [idsAlternando, setIdsAlternando] = useState<Record<string, boolean>>({})

  // Modal unidades
  const [modalUnidade, setModalUnidade] = useState<ModalUnidade | null>(null)
  const [formUniSigla, setFormUniSigla] = useState("")
  const [formUniNome, setFormUniNome] = useState("")
  const [formUniTipo, setFormUniTipo] = useState<TipoUnidade>("INTEIRA")
  const [formUniErro, setFormUniErro] = useState<string | null>(null)
  const [salvandoUni, setSalvandoUni] = useState(false)
  const [modalExcluirUni, setModalExcluirUni] = useState<UnidadeMedida | null>(null)
  const [excluindoUni, setExcluindoUni] = useState(false)

  // Modal pessoas
  const [modalPessoa, setModalPessoa] = useState<ModalPessoa | null>(null)
  const [formPessoaNome, setFormPessoaNome] = useState("")
  const [formPessoaSetor, setFormPessoaSetor] = useState("")
  const [formPessoaFuncao, setFormPessoaFuncao] = useState("")
  const [formPessoaErro, setFormPessoaErro] = useState<string | null>(null)
  const [salvandoPessoa, setSalvandoPessoa] = useState(false)
  const [modalExcluirPessoa, setModalExcluirPessoa] = useState<PessoaAtendida | null>(null)
  const [excluindoPessoa, setExcluindoPessoa] = useState(false)

  const [toast, setToast] = useState<{ tone: "success" | "error"; texto: string } | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounces
  useEffect(() => {
    const t = setTimeout(() => setBuscaCategoriasDebounced(buscaCategorias.trim()), 350)
    return () => clearTimeout(t)
  }, [buscaCategorias])

  useEffect(() => {
    const t = setTimeout(() => setBuscaUnidadesDebounced(buscaUnidades.trim()), 350)
    return () => clearTimeout(t)
  }, [buscaUnidades])

  useEffect(() => {
    const t = setTimeout(() => setBuscaPessoasDebounced(buscaPessoas.trim()), 350)
    return () => clearTimeout(t)
  }, [buscaPessoas])

  // Toast
  const mostrarToast = useCallback((tone: "success" | "error", texto: string) => {
    setToast({ tone, texto })
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(null), 4000)
  }, [])

  // =============================================================
  // CRUD CATEGORIAS
  // =============================================================

  const carregarCategorias = useCallback(async () => {
    setCarregandoCategorias(true)
    try {
      const params = new URLSearchParams()
      if (buscaCategoriasDebounced) params.set("busca", buscaCategoriasDebounced)
      const res = await fetch(`/api/categorias?${params.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar categorias")
      const data = await res.json()
      setCategorias(data.categorias)
    } catch {
      mostrarToast("error", "Não foi possível carregar as categorias.")
    } finally {
      setCarregandoCategorias(false)
    }
  }, [buscaCategoriasDebounced, mostrarToast])

  useEffect(() => {
    carregarCategorias()
  }, [carregarCategorias])

  const categoriasFiltradas = useMemo(() => {
    if (filtroCategorias === "ativas") return categorias.filter((c) => c.ativo)
    if (filtroCategorias === "inativas") return categorias.filter((c) => !c.ativo)
    return categorias
  }, [categorias, filtroCategorias])

  function abrirCriarCategoria() {
    setFormCatNome("")
    setFormCatDescricao("")
    setFormCatErro(null)
    setModalCategoria({ modo: "criar" })
  }

  function abrirEditarCategoria(categoria: Categoria) {
    setFormCatNome(categoria.nome)
    setFormCatDescricao(categoria.descricao ?? "")
    setFormCatErro(null)
    setModalCategoria({ modo: "editar", categoria })
  }

  async function salvarCategoria() {
    if (formCatNome.trim().length < 2) {
      setFormCatErro("Informe um nome com pelo menos 2 caracteres.")
      return
    }
    setSalvandoCat(true)
    setFormCatErro(null)
    try {
      const editando = modalCategoria?.modo === "editar"
      const url = editando ? `/api/categorias/${modalCategoria.categoria.id}` : "/api/categorias"
      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formCatNome.trim(),
          descricao: formCatDescricao.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar categoria")

      mostrarToast("success", editando ? "Categoria atualizada." : "Categoria criada.")
      setModalCategoria(null)
      await carregarCategorias()
    } catch (err) {
      setFormCatErro(err instanceof Error ? err.message : "Erro ao salvar categoria.")
    } finally {
      setSalvandoCat(false)
    }
  }

  async function alternarAtivo(categoria: Categoria) {
    setIdsAlternando((prev) => ({ ...prev, [categoria.id]: true }))
    try {
      const res = await fetch(`/api/categorias/${categoria.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !categoria.ativo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar categoria")
      setCategorias((prev) =>
        prev.map((c) => (c.id === categoria.id ? { ...c, ativo: !categoria.ativo } : c))
      )
    } catch (err) {
      mostrarToast("error", err instanceof Error ? err.message : "Erro ao atualizar categoria.")
    } finally {
      setIdsAlternando((prev) => ({ ...prev, [categoria.id]: false }))
    }
  }

  async function confirmarExclusaoCategoria() {
    if (!modalExcluirCat) return
    setExcluindoCat(true)
    try {
      const res = await fetch(`/api/categorias/${modalExcluirCat.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir categoria")
      mostrarToast("success", `Categoria "${modalExcluirCat.nome}" excluída.`)
      setModalExcluirCat(null)
      await carregarCategorias()
    } catch (err) {
      mostrarToast("error", err instanceof Error ? err.message : "Erro ao excluir categoria.")
    } finally {
      setExcluindoCat(false)
    }
  }

  // =============================================================
  // CRUD UNIDADES
  // =============================================================

  const carregarUnidades = useCallback(async () => {
    setCarregandoUnidades(true)
    try {
      const params = new URLSearchParams()
      if (buscaUnidadesDebounced) params.set("busca", buscaUnidadesDebounced)
      const res = await fetch(`/api/unidades-medida?${params.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar unidades")
      const data = await res.json()
      setUnidades(data.unidadesMedida)
    } catch {
      mostrarToast("error", "Não foi possível carregar as unidades de medida.")
    } finally {
      setCarregandoUnidades(false)
    }
  }, [buscaUnidadesDebounced, mostrarToast])

  useEffect(() => {
    carregarUnidades()
  }, [carregarUnidades])

  function abrirCriarUnidade() {
    setFormUniSigla("")
    setFormUniNome("")
    setFormUniTipo("INTEIRA")
    setFormUniErro(null)
    setModalUnidade({ modo: "criar" })
  }

  function abrirEditarUnidade(unidade: UnidadeMedida) {
    setFormUniSigla(unidade.sigla)
    setFormUniNome(unidade.nome)
    setFormUniTipo(unidade.tipo)
    setFormUniErro(null)
    setModalUnidade({ modo: "editar", unidade })
  }

  async function salvarUnidade() {
    if (formUniSigla.trim().length < 1) {
      setFormUniErro("Informe a sigla.")
      return
    }
    if (formUniNome.trim().length < 2) {
      setFormUniErro("Informe um nome com pelo menos 2 caracteres.")
      return
    }
    setSalvandoUni(true)
    setFormUniErro(null)
    try {
      const editando = modalUnidade?.modo === "editar"
      const url = editando ? `/api/unidades-medida/${modalUnidade.unidade.id}` : "/api/unidades-medida"
      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sigla: formUniSigla.trim(),
          nome: formUniNome.trim(),
          tipo: formUniTipo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar unidade")

      mostrarToast("success", editando ? "Unidade atualizada." : "Unidade criada.")
      setModalUnidade(null)
      await carregarUnidades()
    } catch (err) {
      setFormUniErro(err instanceof Error ? err.message : "Erro ao salvar unidade.")
    } finally {
      setSalvandoUni(false)
    }
  }

  async function confirmarExclusaoUnidade() {
    if (!modalExcluirUni) return
    setExcluindoUni(true)
    try {
      const res = await fetch(`/api/unidades-medida/${modalExcluirUni.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir unidade")
      mostrarToast("success", `Unidade "${modalExcluirUni.nome}" excluída.`)
      setModalExcluirUni(null)
      await carregarUnidades()
    } catch (err) {
      mostrarToast("error", err instanceof Error ? err.message : "Erro ao excluir unidade.")
    } finally {
      setExcluindoUni(false)
    }
  }

  // =============================================================
  // CRUD PESSOAS
  // =============================================================

  const carregarPessoas = useCallback(async () => {
    setCarregandoPessoas(true)
    try {
      const params = new URLSearchParams()
      if (buscaPessoasDebounced) params.set("busca", buscaPessoasDebounced)
      const res = await fetch(`/api/pessoas-atendidas?${params.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar pessoas")
      const data = await res.json()
      setPessoas(data.pessoas)
    } catch {
      mostrarToast("error", "Não foi possível carregar as pessoas atendidas.")
    } finally {
      setCarregandoPessoas(false)
    }
  }, [buscaPessoasDebounced, mostrarToast])

  useEffect(() => {
    carregarPessoas()
  }, [carregarPessoas])

  function abrirCriarPessoa() {
    setFormPessoaNome("")
    setFormPessoaSetor("")
    setFormPessoaFuncao("")
    setFormPessoaErro(null)
    setModalPessoa({ modo: "criar" })
  }

  function abrirEditarPessoa(pessoa: PessoaAtendida) {
    setFormPessoaNome(pessoa.nome)
    setFormPessoaSetor(pessoa.setor)
    setFormPessoaFuncao(pessoa.funcao)
    setFormPessoaErro(null)
    setModalPessoa({ modo: "editar", pessoa })
  }

  async function salvarPessoa() {
    if (formPessoaNome.trim().length < 2 || formPessoaSetor.trim().length < 2 || formPessoaFuncao.trim().length < 2) {
      setFormPessoaErro("Preencha nome, setor e função (mínimo 2 caracteres cada).")
      return
    }
    setSalvandoPessoa(true)
    setFormPessoaErro(null)
    try {
      const editando = modalPessoa?.modo === "editar"
      const url = editando ? `/api/pessoas-atendidas/${modalPessoa.pessoa.id}` : "/api/pessoas-atendidas"
      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formPessoaNome.trim(),
          setor: formPessoaSetor.trim(),
          funcao: formPessoaFuncao.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar pessoa")
      mostrarToast("success", editando ? "Pessoa atualizada." : "Pessoa cadastrada.")
      setModalPessoa(null)
      await carregarPessoas()
    } catch (err) {
      setFormPessoaErro(err instanceof Error ? err.message : "Erro ao salvar pessoa.")
    } finally {
      setSalvandoPessoa(false)
    }
  }

  async function confirmarExclusaoPessoa() {
    if (!modalExcluirPessoa) return
    setExcluindoPessoa(true)
    try {
      const res = await fetch(`/api/pessoas-atendidas/${modalExcluirPessoa.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erro ao excluir pessoa")
      mostrarToast("success", `"${modalExcluirPessoa.nome}" removido(a).`)
      setModalExcluirPessoa(null)
      await carregarPessoas()
    } catch (err) {
      mostrarToast("error", err instanceof Error ? err.message : "Erro ao excluir pessoa.")
    } finally {
      setExcluindoPessoa(false)
    }
  }

  // =============================================================
  // RENDER
  // =============================================================

  const carregando = abaAtiva === "categorias" 
    ? carregandoCategorias 
    : abaAtiva === "unidades" 
    ? carregandoUnidades 
    : carregandoPessoas

  const dados = abaAtiva === "categorias" 
    ? categoriasFiltradas 
    : abaAtiva === "unidades" 
    ? unidades 
    : pessoas

  const busca = abaAtiva === "categorias" 
    ? buscaCategorias 
    : abaAtiva === "unidades" 
    ? buscaUnidades 
    : buscaPessoas

  const setBusca = abaAtiva === "categorias" 
    ? setBuscaCategorias 
    : abaAtiva === "unidades" 
    ? setBuscaUnidades 
    : setBuscaPessoas

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge $aba={abaAtiva}>
            {abaAtiva === "categorias" ? <Tags size={24} /> : 
             abaAtiva === "unidades" ? <Ruler size={24} /> : 
             <UserRound size={24} />}
          </HeaderBadge>
          <div>
            <Breadcrumb>Materiais</Breadcrumb>
            <Title>
              {abaAtiva === "categorias" ? "Categorias" : 
               abaAtiva === "unidades" ? "Unidades" : 
               "Pessoas atendidas"}
            </Title>
            <Subtitle>
              {abaAtiva === "categorias" 
                ? "Gerencie as classificações usadas nos materiais do almoxarifado."
                : abaAtiva === "unidades"
                ? "Gerencie as unidades de medida usadas nos materiais do almoxarifado."
                : "Cadastro leve de pessoas atendidas para autocomplete nos pedidos de compra."}
            </Subtitle>
          </div>
        </HeaderLeft>

        <PrimaryButton 
          $aba={abaAtiva} 
          onClick={
            abaAtiva === "categorias" ? abrirCriarCategoria :
            abaAtiva === "unidades" ? abrirCriarUnidade :
            abrirCriarPessoa
          }
        >
          <Plus size={16} />
          {abaAtiva === "categorias" ? "Nova categoria" : 
           abaAtiva === "unidades" ? "Nova unidade" : 
           "Nova pessoa"}
        </PrimaryButton>
      </HeaderRow>

      <AbasContainer>
        <AbaButton $active={abaAtiva === "categorias"} onClick={() => setAbaAtiva("categorias")}>
          <Tags size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -1 }} />
          Categorias
        </AbaButton>
        <AbaButton $active={abaAtiva === "unidades"} onClick={() => setAbaAtiva("unidades")}>
          <Ruler size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -1 }} />
          Unidades
        </AbaButton>
        <AbaButton $active={abaAtiva === "pessoas"} onClick={() => setAbaAtiva("pessoas")}>
          <UserRound size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -1 }} />
          Pessoas
        </AbaButton>
      </AbasContainer>

      <Toolbar>
        <SearchBox>
          <Search size={16} />
          <input
            placeholder={
              abaAtiva === "categorias" ? "Buscar categoria..." : 
              abaAtiva === "unidades" ? "Buscar por nome ou sigla..." : 
              "Buscar pessoa, setor ou função..."
            }
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </SearchBox>

        {abaAtiva === "categorias" && (
          <Tabs>
            <TabButton $active={filtroCategorias === "todas"} onClick={() => setFiltroCategorias("todas")}>
              Todas
            </TabButton>
            <TabButton $active={filtroCategorias === "ativas"} onClick={() => setFiltroCategorias("ativas")}>
              Ativas
            </TabButton>
            <TabButton $active={filtroCategorias === "inativas"} onClick={() => setFiltroCategorias("inativas")}>
              Inativas
            </TabButton>
          </Tabs>
        )}
      </Toolbar>

      <Grid>
        {carregando && Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} $aba={abaAtiva} />
        ))}

        {!carregando && dados.length === 0 && (
          <EmptyState>
            <Inbox size={32} />
            <span>
              {busca
                ? `Nenhum(a) ${abaAtiva === "categorias" ? "categoria" : abaAtiva === "unidades" ? "unidade" : "pessoa"} encontrado(a) pra essa busca.`
                : abaAtiva === "categorias"
                ? "Nenhuma categoria cadastrada ainda. Crie a primeira pra liberar a classificação de materiais."
                : abaAtiva === "unidades"
                ? "Nenhuma unidade cadastrada ainda. Crie a primeira pra liberar o cadastro de materiais."
                : "Nenhuma pessoa cadastrada ainda. Crie a primeira pra usar nos pedidos de compra."}
            </span>
          </EmptyState>
        )}

        {!carregando &&
          abaAtiva === "categorias" &&
          categoriasFiltradas.map((categoria, index) => (
            <CategoriaCard key={categoria.id} $index={index} $inativa={!categoria.ativo}>
              <CardTop>
                <Swatch $color={corCategoria(categoria.id)}>
                  <Package size={18} />
                </Swatch>
                <Switch
                  $on={categoria.ativo}
                  disabled={idsAlternando[categoria.id]}
                  onClick={() => alternarAtivo(categoria)}
                  title={categoria.ativo ? "Ativa — clique pra inativar" : "Inativa — clique pra ativar"}
                />
              </CardTop>

              <div>
                <CategoriaNome>{categoria.nome}</CategoriaNome>
                <CategoriaDescricao>
                  {categoria.descricao || "Sem descrição."}
                </CategoriaDescricao>
              </div>

              <CardFooter>
                <ContagemMateriais>
                  <Package size={12} />
                  {categoria.totalMateriais} {categoria.totalMateriais === 1 ? "material" : "materiais"}
                </ContagemMateriais>
                <CardActions>
                  <GhostIconButton onClick={() => abrirEditarCategoria(categoria)} title="Editar">
                    <Pencil size={14} />
                  </GhostIconButton>
                  <GhostIconButton
                    className="danger"
                    onClick={() => setModalExcluirCat(categoria)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </GhostIconButton>
                </CardActions>
              </CardFooter>
            </CategoriaCard>
          ))}

        {!carregando &&
          abaAtiva === "unidades" &&
          unidades.map((unidade, index) => (
            <UnidadeCard key={unidade.id} $index={index}>
              <CardTop>
                <UnidadeSwatch $tipo={unidade.tipo}>
                  {unidade.tipo === "FRACIONADA" ? <Droplets size={18} /> : <Hash size={18} />}
                </UnidadeSwatch>
                <TipoBadge $tipo={unidade.tipo}>
                  {unidade.tipo === "FRACIONADA" ? "Fracionada" : "Inteira"}
                </TipoBadge>
              </CardTop>

              <div>
                <UnidadeNomeLinha>
                  <UnidadeNome>{unidade.nome}</UnidadeNome>
                  <UnidadeSigla>({unidade.sigla})</UnidadeSigla>
                </UnidadeNomeLinha>
              </div>

              <CardFooter>
                <ContagemMateriais>
                  <Package size={12} />
                  {unidade.totalMateriais} {unidade.totalMateriais === 1 ? "material" : "materiais"}
                </ContagemMateriais>
                <CardActions>
                  <GhostIconButton onClick={() => abrirEditarUnidade(unidade)} title="Editar">
                    <Pencil size={14} />
                  </GhostIconButton>
                  <GhostIconButton
                    className="danger"
                    onClick={() => setModalExcluirUni(unidade)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </GhostIconButton>
                </CardActions>
              </CardFooter>
            </UnidadeCard>
          ))}

        {!carregando &&
          abaAtiva === "pessoas" &&
          pessoas.map((pessoa, index) => (
            <CategoriaCard key={pessoa.id} $index={index} $inativa={false}>
              <CardTop>
                <Swatch $color={theme.colors.status.purple}>
                  <UserRound size={18} />
                </Swatch>
              </CardTop>
              <div>
                <CategoriaNome>{pessoa.nome}</CategoriaNome>
                <CategoriaDescricao>{pessoa.setor} — {pessoa.funcao}</CategoriaDescricao>
              </div>
              <CardFooter>
                <span />
                <CardActions>
                  <GhostIconButton onClick={() => abrirEditarPessoa(pessoa)} title="Editar">
                    <Pencil size={14} />
                  </GhostIconButton>
                  <GhostIconButton
                    className="danger"
                    onClick={() => setModalExcluirPessoa(pessoa)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </GhostIconButton>
                </CardActions>
              </CardFooter>
            </CategoriaCard>
          ))}
      </Grid>

      {/* ============================================================= */}
      {/* MODAL CATEGORIA */}
      {/* ============================================================= */}

      {modalCategoria && (
        <ModalOverlay onClick={() => !salvandoCat && setModalCategoria(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>
              {modalCategoria.modo === "criar" ? "Nova categoria" : "Editar categoria"}
            </ModalTitle>

            <FieldGroup>
              <Label htmlFor="nome-categoria">Nome</Label>
              <Input
                id="nome-categoria"
                autoFocus
                placeholder="Ex: Elétrica, Hidráulica, EPI..."
                value={formCatNome}
                onChange={(e) => setFormCatNome(e.target.value)}
                maxLength={80}
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="descricao-categoria">Descrição (opcional)</Label>
              <Textarea
                id="descricao-categoria"
                placeholder="O que costuma entrar nessa categoria..."
                value={formCatDescricao}
                onChange={(e) => setFormCatDescricao(e.target.value)}
                maxLength={300}
              />
            </FieldGroup>

            {formCatErro && <ErrorText>{formCatErro}</ErrorText>}

            <ModalActions>
              <ActionButton $variant="ghost" disabled={salvandoCat} onClick={() => setModalCategoria(null)}>
                Cancelar
              </ActionButton>
              <ActionButton $variant="primary" disabled={salvandoCat} onClick={salvarCategoria}>
                {salvandoCat ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                {modalCategoria.modo === "criar" ? "Criar categoria" : "Salvar alterações"}
              </ActionButton>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* MODAL EXCLUIR CATEGORIA */}
      {modalExcluirCat && (
        <ModalOverlay onClick={() => !excluindoCat && setModalExcluirCat(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Excluir categoria</ModalTitle>
            <Subtitle style={{ marginTop: 0 }}>
              Tem certeza que quer excluir <strong>{modalExcluirCat.nome}</strong>?
            </Subtitle>

            {modalExcluirCat.totalMateriais > 0 && (
              <AvisoExclusao>
                <AlertTriangle size={16} />
                <span>
                  Essa categoria tem {modalExcluirCat.totalMateriais} material(is) vinculado(s) e não
                  pode ser excluída. Feche esse modal e use o interruptor do card pra inativá-la
                  em vez de excluir.
                </span>
              </AvisoExclusao>
            )}

            <ModalActions>
              <ActionButton $variant="ghost" disabled={excluindoCat} onClick={() => setModalExcluirCat(null)}>
                Cancelar
              </ActionButton>
              <ActionButton
                $variant="danger"
                disabled={excluindoCat || modalExcluirCat.totalMateriais > 0}
                onClick={confirmarExclusaoCategoria}
              >
                {excluindoCat ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Excluir
              </ActionButton>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ============================================================= */}
      {/* MODAL UNIDADE */}
      {/* ============================================================= */}

      {modalUnidade && (
        <ModalOverlay onClick={() => !salvandoUni && setModalUnidade(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>
              {modalUnidade.modo === "criar" ? "Nova unidade" : "Editar unidade"}
            </ModalTitle>

            <FieldGroup>
              <Label htmlFor="nome-unidade">Nome</Label>
              <Input
                id="nome-unidade"
                autoFocus
                placeholder="Ex: Metro, Litro, Caixa..."
                value={formUniNome}
                onChange={(e) => setFormUniNome(e.target.value)}
                maxLength={60}
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="sigla-unidade">Sigla</Label>
              <Input
                id="sigla-unidade"
                placeholder="Ex: m, L, cx, un..."
                value={formUniSigla}
                onChange={(e) => setFormUniSigla(e.target.value)}
                maxLength={10}
              />
            </FieldGroup>

            <FieldGroup>
              <Label>Tipo de contagem</Label>
              <TipoOpcoes>
                <TipoOpcao
                  type="button"
                  $tipo="INTEIRA"
                  $selecionado={formUniTipo === "INTEIRA"}
                  onClick={() => setFormUniTipo("INTEIRA")}
                >
                  <Hash size={16} />
                  <strong>Inteira</strong>
                  <span>1, 2, 3...</span>
                </TipoOpcao>
                <TipoOpcao
                  type="button"
                  $tipo="FRACIONADA"
                  $selecionado={formUniTipo === "FRACIONADA"}
                  onClick={() => setFormUniTipo("FRACIONADA")}
                >
                  <Droplets size={16} />
                  <strong>Fracionada</strong>
                  <span>1,250 / 2,5...</span>
                </TipoOpcao>
              </TipoOpcoes>
            </FieldGroup>

            {formUniErro && <ErrorText>{formUniErro}</ErrorText>}

            <ModalActions>
              <ActionButton $variant="ghost" disabled={salvandoUni} onClick={() => setModalUnidade(null)}>
                Cancelar
              </ActionButton>
              <ActionButton $variant="primary" disabled={salvandoUni} onClick={salvarUnidade}>
                {salvandoUni ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                {modalUnidade.modo === "criar" ? "Criar unidade" : "Salvar alterações"}
              </ActionButton>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* MODAL EXCLUIR UNIDADE */}
      {modalExcluirUni && (
        <ModalOverlay onClick={() => !excluindoUni && setModalExcluirUni(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Excluir unidade</ModalTitle>
            <Subtitle style={{ marginTop: 0 }}>
              Tem certeza que quer excluir <strong>{modalExcluirUni.nome}</strong>?
            </Subtitle>

            {modalExcluirUni.totalMateriais > 0 && (
              <AvisoExclusao>
                <AlertTriangle size={16} />
                <span>
                  Essa unidade está em uso por {modalExcluirUni.totalMateriais} material(is) e não
                  pode ser excluída enquanto isso não mudar.
                </span>
              </AvisoExclusao>
            )}

            <ModalActions>
              <ActionButton $variant="ghost" disabled={excluindoUni} onClick={() => setModalExcluirUni(null)}>
                Cancelar
              </ActionButton>
              <ActionButton
                $variant="danger"
                disabled={excluindoUni || modalExcluirUni.totalMateriais > 0}
                onClick={confirmarExclusaoUnidade}
              >
                {excluindoUni ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Excluir
              </ActionButton>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ============================================================= */}
      {/* MODAL PESSOA */}
      {/* ============================================================= */}

      {modalPessoa && (
        <ModalOverlay onClick={() => !salvandoPessoa && setModalPessoa(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>
              {modalPessoa.modo === "criar" ? "Nova pessoa" : "Editar pessoa"}
            </ModalTitle>

            <FieldGroup>
              <Label htmlFor="nome-pessoa">Nome</Label>
              <Input
                id="nome-pessoa"
                autoFocus
                placeholder="Ex: João Silva"
                value={formPessoaNome}
                onChange={(e) => setFormPessoaNome(e.target.value)}
                maxLength={80}
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="setor-pessoa">Setor</Label>
              <Input
                id="setor-pessoa"
                placeholder="Ex: Manutenção, Produção, Logística..."
                value={formPessoaSetor}
                onChange={(e) => setFormPessoaSetor(e.target.value)}
                maxLength={80}
              />
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="funcao-pessoa">Função</Label>
              <Input
                id="funcao-pessoa"
                placeholder="Ex: Técnico, Supervisor, Operador..."
                value={formPessoaFuncao}
                onChange={(e) => setFormPessoaFuncao(e.target.value)}
                maxLength={80}
              />
            </FieldGroup>

            {formPessoaErro && <ErrorText>{formPessoaErro}</ErrorText>}

            <ModalActions>
              <ActionButton $variant="ghost" disabled={salvandoPessoa} onClick={() => setModalPessoa(null)}>
                Cancelar
              </ActionButton>
              <ActionButton $variant="primary" disabled={salvandoPessoa} onClick={salvarPessoa}>
                {salvandoPessoa ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                {modalPessoa.modo === "criar" ? "Criar pessoa" : "Salvar alterações"}
              </ActionButton>
            </ModalActions>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* MODAL EXCLUIR PESSOA */}
      {modalExcluirPessoa && (
        <ModalOverlay onClick={() => !excluindoPessoa && setModalExcluirPessoa(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Remover pessoa</ModalTitle>
            <Subtitle style={{ marginTop: 0 }}>
              Tem certeza que quer remover <strong>{modalExcluirPessoa.nome}</strong>?
            </Subtitle>

            <ModalActions>
              <ActionButton $variant="ghost" disabled={excluindoPessoa} onClick={() => setModalExcluirPessoa(null)}>
                Cancelar
              </ActionButton>
              <ActionButton
                $variant="danger"
                disabled={excluindoPessoa}
                onClick={confirmarExclusaoPessoa}
              >
                {excluindoPessoa ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Remover
              </ActionButton>
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