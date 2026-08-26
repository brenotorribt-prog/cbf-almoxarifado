"use client"

/**
 * components/movimentacoes/modals/nova-movimentacao.tsx
 * ------------------------------------------------------------------
 * Modal de lançamento de ENTRADA / SAÍDA / AJUSTE em /api/movimentacoes.
 *
 * Busca de material é um autocomplete debounced (a lista pode ter
 * centenas de itens, não dá pra carregar tudo num <select>). Depois de
 * selecionado, mostra o estoque atual e simula o resultado da operação
 * antes de confirmar — evita "clicar e descobrir depois" que deu 409.
 *
 * AJUSTE funciona diferente de ENTRADA/SAÍDA: o campo quantidade aqui
 * representa o valor final contado fisicamente, não um delta. O texto
 * de ajuda troca dinamicamente pra deixar isso claro.
 */

import { useState, useEffect, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  X,
  Check,
  Loader2,
  Search,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  PackageSearch,
  Info,
  User,
  Printer, // ← adicionado
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

type Tipo = "ENTRADA" | "SAIDA" | "AJUSTE"

interface MaterialBusca {
  id: string
  nome: string
  codigoInterno: string
  estoqueAtual: number
  requerAprovacao: boolean
  unidadeMedida: { id: string; sigla: string; nome: string; tipo?: "INTEIRA" | "FRACIONADA" }
}

interface PessoaBusca {
  id: string
  nome: string
  setor: string
  funcao: string
}

interface NovaMovimentacaoModalProps {
  onClose: () => void
  onSalvo: (movimentacaoId?: string) => void
}

// =====================================================================
// HELPERS
// =====================================================================

function numeroOuNull(valor: string): number | null {
  if (valor.trim() === "") return null
  const n = Number(valor.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

const TIPO_CONFIG: Record<Tipo, { label: string; cor: string; Icon: typeof ArrowDownCircle; descricao: string }> = {
  ENTRADA: {
    label: "Entrada",
    cor: theme.colors.status.success,
    Icon: ArrowDownCircle,
    descricao: "Soma ao estoque atual (reposição, compra recebida, devolução avulsa).",
  },
  SAIDA: {
    label: "Saída",
    cor: theme.colors.status.error,
    Icon: ArrowUpCircle,
    descricao: "Subtrai do estoque atual (consumo direto, sem devolução prevista).",
  },
  AJUSTE: {
    label: "Ajuste",
    cor: theme.colors.status.info,
    Icon: SlidersHorizontal,
    descricao: "Define o valor final contado fisicamente — corrige divergência de inventário.",
  },
}

// =====================================================================
// ANIMAÇÕES / LAYOUT (mesmo padrão dos outros modais)
// =====================================================================

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`
const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`
const spin = keyframes`to { transform: rotate(360deg); }`

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

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

const ModalCard = styled.form`
  ${glassCardStyles}
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[5]};
  animation: ${slideIn} 0.2s ease both;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const ModalTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
`

const ModalSubtitle = styled.p`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.muted};
  max-width: 46ch;
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

const Secao = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const SecaoTitulo = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};

  svg {
    opacity: 0.6;
  }
`

const Obrigatorio = styled.span`
  color: ${({ theme }) => theme.colors.status.error};
`

const inputBaseStyles = `
  ${glassCardStyles}
  background: ${theme.colors.surface.glass};
  padding: ${theme.spacing[3]};
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.fontSize.sm};
  width: 100%;

  &::placeholder { color: ${theme.colors.text.muted}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`

const Input = styled.input`
  ${inputBaseStyles}
`

const Textarea = styled.textarea`
  ${inputBaseStyles}
  min-height: 72px;
  resize: vertical;
`

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.error};
`

const AvisoGeral = styled.div`
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

// -------- busca de material --------

const BuscaWrapper = styled.div`
  position: relative;
`

const BuscaInputBox = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};

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

const BuscaDropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.sidebar};
  max-height: 240px;
  overflow-y: auto;
  z-index: 20;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const BuscaItem = styled.button`
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: ${({ theme }) => theme.spacing[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

const BuscaItemNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`

const BuscaItemMeta = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

const BuscaVazio = styled.div`
  padding: ${({ theme }) => theme.spacing[4]};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.muted};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};

  svg {
    opacity: 0.5;
  }
`

const MaterialSelecionadoBox = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const MaterialSelecionadoInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
  }
`

const TrocarMaterialButton = styled.button`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary.vivid};
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    text-decoration: underline;
  }
`

// -------- tipo (segmented control) --------

const TipoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing[2]};
`

const TipoOpcao = styled.button<{ $ativo: boolean; $cor: string }>`
  ${glassCardStyles}
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: ${({ theme }) => theme.spacing[3]};
  background: ${({ $ativo, $cor, theme }) => ($ativo ? hexToRgba($cor, 0.14) : theme.colors.surface.glass)};
  border-color: ${({ $ativo, $cor, theme }) => ($ativo ? hexToRgba($cor, 0.5) : theme.colors.surface.border)};
  color: ${({ $ativo, $cor, theme }) => ($ativo ? $cor : theme.colors.text.secondary)};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ $cor }) => hexToRgba($cor, 0.5)};
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`

const TipoDescricao = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

// -------- simulação do resultado --------

const SimulacaoBox = styled.div<{ $cor: string }>`
  ${glassCardStyles}
  background: ${({ $cor }) => hexToRgba($cor, 0.08)};
  border-color: ${({ $cor }) => hexToRgba($cor, 0.25)};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[3]};
  font-variant-numeric: tabular-nums;
`

const SimulacaoValor = styled.span<{ $muted?: boolean; $cor?: string }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme, $muted, $cor }) => ($muted ? theme.colors.text.muted : $cor ?? theme.colors.text.primary)};
`

const AvisoInfo = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.infoBg};
  border: 1px solid ${({ theme }) => theme.colors.status.infoBorder};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};

  svg {
    color: ${({ theme }) => theme.colors.status.info};
    flex-shrink: 0;
    margin-top: 1px;
  }
`

// -------- pessoa selecionada / busca de pessoas --------

const PessoaSelecionadaBox = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const PessoaSelecionadaInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
  }
`

const TrocarPessoaButton = styled.button`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary.vivid};
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    text-decoration: underline;
  }
`

// -------- rodapé --------

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

// =====================================================================
// COMPONENTE
// =====================================================================

export default function NovaMovimentacaoModal({ onClose, onSalvo }: NovaMovimentacaoModalProps) {
  // busca de material
  const [termoBusca, setTermoBusca] = useState("")
  const [resultadosBusca, setResultadosBusca] = useState<MaterialBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const buscaWrapperRef = useRef<HTMLDivElement>(null)

  const [materialSelecionado, setMaterialSelecionado] = useState<MaterialBusca | null>(null)

  // campos do formulário
  const [tipo, setTipo] = useState<Tipo>("ENTRADA")
  const [quantidade, setQuantidade] = useState("")
  const [motivo, setMotivo] = useState("")
  const [documentoReferencia, setDocumentoReferencia] = useState("")

  // pessoa do cadastro leve — autocomplete obrigatório na saída
  const [termoBuscaPessoa, setTermoBuscaPessoa] = useState("")
  const [resultadosPessoas, setResultadosPessoas] = useState<PessoaBusca[]>([])
  const [buscandoPessoa, setBuscandoPessoa] = useState(false)
  const [dropdownPessoaAberto, setDropdownPessoaAberto] = useState(false)
  const buscaPessoaRef = useRef<HTMLDivElement>(null)
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaBusca | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})
  
  // ===== NOVO: state e handler para impressão =====
  const [imprimindo, setImprimindo] = useState(false)

  async function handleImprimirRecibo() {
    if (!validar() || !materialSelecionado || quantidadeNumerica === null) return
    setImprimindo(true)
    try {
      const { gerarEAbrirRecibo } = await import("@/lib/pdf/gerar-recibo-cliente")
      await gerarEAbrirRecibo({
        tipoDocumento: "SAIDA",
        data: new Date(),
        solicitanteNome: pessoaSelecionada?.nome ?? "Não informado",
        solicitanteSetor: pessoaSelecionada?.setor ?? null,
        solicitanteFuncao: pessoaSelecionada?.funcao ?? null,
        itens: [
          {
            nome: materialSelecionado.nome,
            codigoInterno: materialSelecionado.codigoInterno,
            quantidade: quantidadeNumerica,
            unidade: materialSelecionado.unidadeMedida.sigla,
          },
        ],
        motivo: motivo.trim() || null,
      })
    } finally {
      setImprimindo(false)
    }
  }
  // ===== FIM NOVO =====

  // ---------------------------------------------------------------
  // busca debounced
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!termoBusca.trim() || termoBusca.trim().length < 2 || materialSelecionado) return

    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const params = new URLSearchParams()
        params.set("q", termoBusca.trim())
        params.set("limit", "8")
        const res = await fetch(`/api/materiais/buscar-rapido?${params.toString()}`)
        const dados = await res.json()
        setResultadosBusca(dados.materiais ?? [])
      } catch {
        setResultadosBusca([])
      } finally {
        setBuscando(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [termoBusca, materialSelecionado])

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (buscaWrapperRef.current && !buscaWrapperRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickFora)
    return () => document.removeEventListener("mousedown", handleClickFora)
  }, [])

  // ---------------------------------------------------------------
  // busca debounced de pessoas atendidas (cadastro leve)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!termoBuscaPessoa.trim() || termoBuscaPessoa.trim().length < 2 || pessoaSelecionada) return

    const t = setTimeout(async () => {
      setBuscandoPessoa(true)
      try {
        const params = new URLSearchParams()
        params.set("busca", termoBuscaPessoa.trim())
        const res = await fetch(`/api/pessoas-atendidas?${params.toString()}`)
        const dados = await res.json()
        setResultadosPessoas(dados.pessoas ?? [])
      } catch {
        setResultadosPessoas([])
      } finally {
        setBuscandoPessoa(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [termoBuscaPessoa, pessoaSelecionada])

  // fecha o dropdown de pessoas ao clicar fora
  useEffect(() => {
    function handleClickForaPessoa(e: MouseEvent) {
      if (buscaPessoaRef.current && !buscaPessoaRef.current.contains(e.target as Node)) {
        setDropdownPessoaAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickForaPessoa)
    return () => document.removeEventListener("mousedown", handleClickForaPessoa)
  }, [])

  function selecionarPessoa(pessoa: PessoaBusca) {
    setPessoaSelecionada(pessoa)
    setTermoBuscaPessoa("")
    setResultadosPessoas([])
    setDropdownPessoaAberto(false)
    setErrosCampo((prev) => Object.fromEntries(Object.entries(prev).filter(([campo]) => campo !== "pessoa")))
  }

  function trocarPessoa() {
    setPessoaSelecionada(null)
    setTermoBuscaPessoa("")
  }

  function selecionarMaterial(material: MaterialBusca) {
    setMaterialSelecionado(material)
    setTermoBusca("")
    setResultadosBusca([])
    setDropdownAberto(false)
    setQuantidade("")
    setErrosCampo({})
  }

  function trocarMaterial() {
    setMaterialSelecionado(null)
    setQuantidade("")
  }

  // ---------------------------------------------------------------
  // simulação do resultado
  // ---------------------------------------------------------------
  const aceitaFracao = materialSelecionado?.unidadeMedida.tipo === "FRACIONADA"
  const quantidadeNumerica = numeroOuNull(quantidade)

  const estoqueSimulado = (() => {
    if (!materialSelecionado || quantidadeNumerica === null) return null
    if (tipo === "ENTRADA") return materialSelecionado.estoqueAtual + quantidadeNumerica
    if (tipo === "SAIDA") return materialSelecionado.estoqueAtual - quantidadeNumerica
    return quantidadeNumerica // AJUSTE: valor absoluto
  })()

  // ---------------------------------------------------------------
  // validação
  // ---------------------------------------------------------------
  function validar(): boolean {
    const erros: Record<string, string> = {}

    if (!materialSelecionado) erros.material = "Selecione um material."
    if (quantidadeNumerica === null || (tipo !== "AJUSTE" && quantidadeNumerica <= 0)) {
      erros.quantidade = tipo === "AJUSTE" ? "Informe o valor contado." : "Informe uma quantidade maior que zero."
    }
    if (motivo.trim().length < 1) erros.motivo = "Motivo é obrigatório."

    if (tipo === "SAIDA" && !pessoaSelecionada) {
      erros.pessoa = "Saídas exigem selecionar quem está recebendo o material (cadastro de pessoas atendidas)."
    }

    if (materialSelecionado && quantidadeNumerica !== null && !aceitaFracao && quantidadeNumerica % 1 !== 0) {
      erros.quantidade = `A unidade "${materialSelecionado.unidadeMedida.nome}" não aceita valores fracionados.`
    }

    if (tipo === "SAIDA" && materialSelecionado && quantidadeNumerica !== null) {
      if (quantidadeNumerica > materialSelecionado.estoqueAtual) {
        erros.quantidade = "Quantidade maior que o estoque disponível."
      }
    }

    if (estoqueSimulado !== null && estoqueSimulado < 0) {
      erros.quantidade = "O resultado não pode ser negativo."
    }

    setErrosCampo(erros)
    return Object.keys(erros).length === 0
  }

  // ---------------------------------------------------------------
  // submit
  // ---------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErroGeral(null)
    if (!validar() || !materialSelecionado || quantidadeNumerica === null) return

    setSalvando(true)
    try {
      const res = await fetch("/api/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: materialSelecionado.id,
          tipo,
          quantidade: quantidadeNumerica,
          motivo: motivo.trim(),
          documentoReferencia: documentoReferencia.trim() || null,
          pessoaAtendidaId: pessoaSelecionada?.id ?? null,
        }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error ?? "Erro ao registrar movimentação.")

      // Passa o ID da movimentação criada para o callback
      onSalvo(dados.id)
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao registrar movimentação.")
    } finally {
      setSalvando(false)
    }
  }

  const config = TIPO_CONFIG[tipo]
  const bloqueado = salvando

  return (
    <ModalOverlay onClick={() => !salvando && onClose()}>
      <ModalCard onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <ModalTopo>
          <div>
            <ModalTitle>Nova movimentação</ModalTitle>
            <ModalSubtitle>
              Registra entrada, saída direta ou ajuste de inventário. Empréstimos têm fluxo próprio.
            </ModalSubtitle>
          </div>
          <FecharButton type="button" onClick={onClose} disabled={salvando} title="Fechar">
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        {erroGeral && (
          <AvisoGeral>
            <AlertTriangle size={16} />
            <span>{erroGeral}</span>
          </AvisoGeral>
        )}

        {/* ---------------- Material ---------------- */}
        <Secao>
          <FieldGroup>
            <Label>
              Material <Obrigatorio>*</Obrigatorio>
            </Label>

            {materialSelecionado ? (
              <MaterialSelecionadoBox>
                <MaterialSelecionadoInfo>
                  <strong>{materialSelecionado.nome}</strong>
                  <span>
                    {materialSelecionado.codigoInterno} · {materialSelecionado.estoqueAtual}{" "}
                    {materialSelecionado.unidadeMedida.sigla} em estoque
                  </span>
                </MaterialSelecionadoInfo>
                <TrocarMaterialButton type="button" onClick={trocarMaterial} disabled={bloqueado}>
                  Trocar
                </TrocarMaterialButton>
              </MaterialSelecionadoBox>
            ) : (
              <BuscaWrapper ref={buscaWrapperRef}>
                <BuscaInputBox>
                  <Search size={16} />
                  <input
                    placeholder="Buscar por nome, código ou marca..."
                    value={termoBusca}
                    onChange={(e) => {
                      setTermoBusca(e.target.value)
                      setDropdownAberto(true)
                      if (e.target.value.trim().length < 2) setResultadosBusca([])
                    }}
                    onFocus={() => setDropdownAberto(true)}
                    disabled={bloqueado}
                    autoFocus
                  />
                  {buscando && <Loader2 size={14} className="spin" style={{ animation: "spin 0.7s linear infinite" }} />}
                </BuscaInputBox>

                {dropdownAberto && termoBusca.trim() && (
                  <BuscaDropdown>
                    {resultadosBusca.length === 0 && !buscando ? (
                      <BuscaVazio>
                        <PackageSearch size={20} />
                        Nenhum material encontrado.
                      </BuscaVazio>
                    ) : (
                      resultadosBusca.map((m) => (
                        <BuscaItem key={m.id} type="button" onClick={() => selecionarMaterial(m)}>
                          <BuscaItemNome>{m.nome}</BuscaItemNome>
                          <BuscaItemMeta>
                            {m.codigoInterno} · {m.estoqueAtual} {m.unidadeMedida.sigla} em estoque
                          </BuscaItemMeta>
                        </BuscaItem>
                      ))
                    )}
                  </BuscaDropdown>
                )}
              </BuscaWrapper>
            )}
            {errosCampo.material && <ErrorText>{errosCampo.material}</ErrorText>}
          </FieldGroup>
        </Secao>

        {/* ---------------- Tipo ---------------- */}
        <Secao>
          <FieldGroup>
            <Label>
              Tipo <Obrigatorio>*</Obrigatorio>
            </Label>
            <TipoGrid>
              {(Object.keys(TIPO_CONFIG) as Tipo[]).map((t) => {
                const c = TIPO_CONFIG[t]
                const Icon = c.Icon
                return (
                  <TipoOpcao
                    key={t}
                    type="button"
                    $ativo={tipo === t}
                    $cor={c.cor}
                    onClick={() => setTipo(t)}
                    disabled={bloqueado}
                  >
                    <Icon size={18} />
                    <span>{c.label}</span>
                  </TipoOpcao>
                )
              })}
            </TipoGrid>
            <TipoDescricao>{config.descricao}</TipoDescricao>
          </FieldGroup>
        </Secao>

        {/* ---------------- Quantidade ---------------- */}
        <Secao>
          <FieldGroup>
            <Label htmlFor="quantidade">
              {tipo === "AJUSTE" ? "Valor contado (total final)" : "Quantidade"} <Obrigatorio>*</Obrigatorio>
            </Label>
            <Input
              id="quantidade"
              type="number"
              min={0}
              step={aceitaFracao ? "0.001" : "1"}
              placeholder="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={bloqueado || !materialSelecionado}
            />
            {errosCampo.quantidade && <ErrorText>{errosCampo.quantidade}</ErrorText>}
          </FieldGroup>

          {materialSelecionado && estoqueSimulado !== null && !errosCampo.quantidade && (
            <SimulacaoBox $cor={config.cor}>
              <SimulacaoValor $muted>
                {materialSelecionado.estoqueAtual} {materialSelecionado.unidadeMedida.sigla}
              </SimulacaoValor>
              <span style={{ color: theme.colors.text.muted }}>→</span>
              <SimulacaoValor $cor={config.cor}>
                {estoqueSimulado} {materialSelecionado.unidadeMedida.sigla}
              </SimulacaoValor>
            </SimulacaoBox>
          )}
        </Secao>

        {/* ---------------- Motivo / documento ---------------- */}
        <Secao>
          <FieldGroup>
            <Label htmlFor="motivo">
              Motivo <Obrigatorio>*</Obrigatorio>
            </Label>
            <Textarea
              id="motivo"
              placeholder={
                tipo === "AJUSTE"
                  ? "Ex: Divergência encontrada na contagem mensal de inventário"
                  : tipo === "ENTRADA"
                  ? "Ex: Reposição — nota fiscal 12345"
                  : "Ex: Consumo pelo setor de manutenção"
              }
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              disabled={bloqueado}
            />
            {errosCampo.motivo && <ErrorText>{errosCampo.motivo}</ErrorText>}
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="documento">Documento de referência (opcional)</Label>
            <Input
              id="documento"
              placeholder="Ex: NF 12345, OS 987..."
              value={documentoReferencia}
              onChange={(e) => setDocumentoReferencia(e.target.value)}
              maxLength={100}
              disabled={bloqueado}
            />
          </FieldGroup>
        </Secao>

        {/* ---------------- Pessoa atendida (cadastro leve) ---------------- */}
        <Secao>
          <SecaoTitulo>Pessoa atendida</SecaoTitulo>
          <TipoDescricao style={{ marginTop: -4 }}>
            {tipo === "SAIDA"
              ? "Obrigatório: selecione no cadastro quem está recebendo o material."
              : tipo === "ENTRADA"
              ? "Opcional: preencha se for devolução avulsa de alguém cadastrado."
              : "Normalmente não se aplica a ajustes de inventário."}
          </TipoDescricao>

          <FieldGroup>
            <Label>
              <User size={12} /> Pessoa do cadastro
              {tipo === "SAIDA" && <Obrigatorio>*</Obrigatorio>}
            </Label>

            {pessoaSelecionada ? (
              <PessoaSelecionadaBox>
                <PessoaSelecionadaInfo>
                  <strong>{pessoaSelecionada.nome}</strong>
                  <span>
                    {pessoaSelecionada.setor} · {pessoaSelecionada.funcao}
                  </span>
                </PessoaSelecionadaInfo>
                <TrocarPessoaButton type="button" onClick={trocarPessoa} disabled={bloqueado}>
                  Trocar
                </TrocarPessoaButton>
              </PessoaSelecionadaBox>
            ) : (
              <BuscaWrapper ref={buscaPessoaRef}>
                <BuscaInputBox>
                  <Search size={16} />
                  <input
                    placeholder="Buscar pessoa cadastrada por nome..."
                    value={termoBuscaPessoa}
                    onChange={(e) => {
                      setTermoBuscaPessoa(e.target.value)
                      setDropdownPessoaAberto(true)
                      if (e.target.value.trim().length < 2) setResultadosPessoas([])
                    }}
                    onFocus={() => setDropdownPessoaAberto(true)}
                    disabled={bloqueado}
                  />
                  {buscandoPessoa && (
                    <Loader2 size={14} className="spin" style={{ animation: "spin 0.7s linear infinite" }} />
                  )}
                </BuscaInputBox>

                {dropdownPessoaAberto && termoBuscaPessoa.trim() && (
                  <BuscaDropdown>
                    {resultadosPessoas.length === 0 && !buscandoPessoa ? (
                      <BuscaVazio>
                        <User size={20} />
                        Nenhuma pessoa encontrada — cadastre em Categorias › Pessoas atendidas.
                      </BuscaVazio>
                    ) : (
                      resultadosPessoas.map((p) => (
                        <BuscaItem key={p.id} type="button" onClick={() => selecionarPessoa(p)}>
                          <BuscaItemNome>{p.nome}</BuscaItemNome>
                          <BuscaItemMeta>
                            {p.setor} · {p.funcao}
                          </BuscaItemMeta>
                        </BuscaItem>
                      ))
                    )}
                  </BuscaDropdown>
                )}
              </BuscaWrapper>
            )}
            {errosCampo.pessoa && <ErrorText>{errosCampo.pessoa}</ErrorText>}
          </FieldGroup>
        </Secao>

        {tipo === "AJUSTE" && (
          <AvisoInfo>
            <Info size={14} />
            <span>
              O ajuste substitui o estoque atual pelo valor informado — não soma nem subtrai. Use quando a
              contagem física divergir do sistema.
            </span>
          </AvisoInfo>
        )}

        {/* ===== ModalActions MODIFICADO ===== */}
        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={salvando} onClick={onClose}>
            Cancelar
          </ActionButton>
          {tipo === "SAIDA" && (
            <ActionButton
              type="button"
              $variant="ghost"
              disabled={bloqueado || !materialSelecionado || imprimindo}
              onClick={handleImprimirRecibo}
            >
              {imprimindo ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
              Imprimir p/ assinatura
            </ActionButton>
          )}
          <ActionButton type="submit" $variant="primary" $cor={config.cor} disabled={bloqueado}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            Registrar {config.label.toLowerCase()}
          </ActionButton>
        </ModalActions>
        {/* ===== FIM MODALACTIONS ===== */}
      </ModalCard>
    </ModalOverlay>
  )
}