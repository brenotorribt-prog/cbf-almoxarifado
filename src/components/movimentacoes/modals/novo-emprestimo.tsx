"use client"

/**
 * components/movimentacoes/modals/novo-emprestimo.tsx
 * ------------------------------------------------------------------
 * Empréstimo multi-item: uma única "leva" (mesmo solicitante/prazo),
 * N materiais adicionados isoladamente. Cada item vira um Emprestimo
 * independente na API (mesmo loteId quando > 1 item) — devolver um não
 * afeta o outro.
 *
 * Itens com requerAprovacao=true são sinalizados ANTES de submeter
 * (ShieldAlert na linha do item), e depois do POST o resultado é
 * exibido separado: o que já saiu do estoque vs o que ficou
 * PENDENTE_APROVACAO aguardando supervisor.
 */

import { useState, useEffect, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme } from "@/styles/theme"
import {
  X,
  Check,
  Loader2,
  Search,
  AlertTriangle,
  PackageSearch,
  ShieldAlert,
  Trash2,
  HandCoins,
  CheckCircle2,
  Clock,
  User,
  CalendarClock,
  Printer, // ← ADICIONADO
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

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

interface ItemEmprestimo {
  material: MaterialBusca
  quantidade: string
}

interface EmprestimoCriado {
  id: string
  status: string
  material: { id: string; nome: string }
  quantidade: number
}

interface NovoEmprestimoModalProps {
  onClose: () => void
  onSalvo: (emprestimoId?: string) => void
}

// =====================================================================
// HELPERS
// =====================================================================

function numeroOuNull(valor: string): number | null {
  if (valor.trim() === "") return null
  const n = Number(valor.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

function amanha(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
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
  max-width: 640px;
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
  max-width: 50ch;
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
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.text.muted};
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.surface.border};
  }
`

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
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
  display: flex;
  align-items: center;
  gap: 4px;
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
  min-height: 64px;
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
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  width: 100%;
  text-align: left;
  padding: ${({ theme }) => theme.spacing[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};

  &:last-child {
    border-bottom: none;
  }
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface.glass};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const BuscaItemInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const BuscaItemNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  display: flex;
  align-items: center;
  gap: 5px;
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

// -------- lista de itens montados --------

const ItensLista = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const ItemLinha = styled.div<{ $aprovacao: boolean }>`
  ${glassCardStyles}
  background: ${({ theme, $aprovacao }) => ($aprovacao ? theme.colors.status.warningBg : theme.colors.surface.glass)};
  border-color: ${({ theme, $aprovacao }) => ($aprovacao ? theme.colors.status.warningBorder : theme.colors.surface.border)};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
`

const ItemInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

const ItemNomeLinha = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;

  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.status.warning};
  }
`

const ItemNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ItemMeta = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const ItemAvisoAprovacao = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.warning};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`

const ItemQuantidadeInput = styled.input`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.card};
  width: 90px;
  padding: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: center;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.5;
  }
`

const ItemRemoverButton = styled.button`
  width: 30px;
  height: 30px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.status.error};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.status.errorBg};
  }
`

const ItensVazio = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing[5]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.muted};
  border: 1.5px dashed ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
`

// -------- resumo pós-submit --------

const ResumoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`

const ResumoGrupo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const ResumoGrupoTitulo = styled.div<{ $cor: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ $cor }) => $cor};
`

const ResumoItem = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  display: flex;
  align-items: center;
  justify-content: space-between;

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
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

const ActionButton = styled.button<{ $variant: "primary" | "ghost" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};

  ${({ $variant, theme }) =>
    $variant === "primary" &&
    `
    background: ${theme.colors.primary.vivid};
    color: ${theme.colors.neutral.white};
    &:hover:not(:disabled) { background: ${theme.colors.primary.deep}; }
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

// =====================================================================
// COMPONENTE
// =====================================================================

export default function NovoEmprestimoModal({ onClose, onSalvo }: NovoEmprestimoModalProps) {
  // busca de material
  const [termoBusca, setTermoBusca] = useState("")
  const [resultadosBusca, setResultadosBusca] = useState<MaterialBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const buscaWrapperRef = useRef<HTMLDivElement>(null)

  // itens montados
  const [itens, setItens] = useState<ItemEmprestimo[]>([])

  // dados do solicitante / prazo — quem recebe vem do cadastro leve
  const [termoBuscaPessoa, setTermoBuscaPessoa] = useState("")
  const [resultadosPessoas, setResultadosPessoas] = useState<PessoaBusca[]>([])
  const [buscandoPessoa, setBuscandoPessoa] = useState(false)
  const [dropdownPessoaAberto, setDropdownPessoaAberto] = useState(false)
  const buscaPessoaRef = useRef<HTMLDivElement>(null)
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaBusca | null>(null)
  const [dataPrevistaDevolucao, setDataPrevistaDevolucao] = useState(amanha())
  const [observacoes, setObservacoes] = useState("")

  // envio
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})

  // resultado pós-submit (tela de resumo)
  const [resultado, setResultado] = useState<EmprestimoCriado[] | null>(null)

  // ===== NOVO: state e handler para impressão =====
const [imprimindo, setImprimindo] = useState(false)

async function handleImprimirRecibo() {
  if (!validar()) return
  setImprimindo(true)
  try {
    const { gerarEAbrirRecibo } = await import("@/lib/pdf/gerar-recibo-cliente")
    await gerarEAbrirRecibo({
      tipoDocumento: "EMPRESTIMO",
      data: new Date(),
      solicitanteNome: pessoaSelecionada?.nome ?? "",
      solicitanteSetor: pessoaSelecionada?.setor ?? null,
      solicitanteFuncao: pessoaSelecionada?.funcao ?? null,
      itens: itens.map((i) => ({
        nome: i.material.nome,
        codigoInterno: i.material.codigoInterno,
        quantidade: numeroOuNull(i.quantidade) ?? 0,
        unidade: i.material.unidadeMedida.sigla,
      })),
      motivo: observacoes.trim() || null, // ✅ usa 'motivo' em vez de 'observacoes'
      dataPrevistaDevolucao: new Date(dataPrevistaDevolucao),
    })
  } finally {
    setImprimindo(false)
  }
}
// ===== FIM NOVO =====

  // ---------------------------------------------------------------
  // busca debounced (mesmo endpoint leve do modal de movimentação)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!termoBusca.trim() || termoBusca.trim().length < 2) return

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
  }, [termoBusca])

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

  function adicionarItem(material: MaterialBusca) {
    setItens((prev) => [...prev, { material, quantidade: "1" }])
    setTermoBusca("")
    setResultadosBusca([])
    setDropdownAberto(false)
    setErrosCampo({})
  }

  function removerItem(materialId: string) {
    setItens((prev) => prev.filter((i) => i.material.id !== materialId))
  }

  function atualizarQuantidade(materialId: string, valor: string) {
    setItens((prev) => prev.map((i) => (i.material.id === materialId ? { ...i, quantidade: valor } : i)))
  }

  const idsJaAdicionados = new Set(itens.map((i) => i.material.id))
  const qtdRequerAprovacao = itens.filter((i) => i.material.requerAprovacao).length

  // ---------------------------------------------------------------
  // validação
  // ---------------------------------------------------------------
  function validar(): boolean {
    const erros: Record<string, string> = {}

    if (itens.length === 0) erros.itens = "Adicione pelo menos um item."

    for (const item of itens) {
      const qtd = numeroOuNull(item.quantidade)
      const aceitaFracao = item.material.unidadeMedida.tipo === "FRACIONADA"

      if (qtd === null || qtd <= 0) {
        erros.itens = `Informe uma quantidade válida para "${item.material.nome}".`
        break
      }
      if (!aceitaFracao && qtd % 1 !== 0) {
        erros.itens = `A unidade de "${item.material.nome}" não aceita valores fracionados.`
        break
      }
      if (!item.material.requerAprovacao && qtd > item.material.estoqueAtual) {
        erros.itens = `Estoque insuficiente de "${item.material.nome}" (${item.material.estoqueAtual} disponível).`
        break
      }
    }

    if (!pessoaSelecionada) erros.pessoa = "Selecione quem vai receber (cadastro de pessoas atendidas)."

    if (!dataPrevistaDevolucao) {
      erros.dataPrevistaDevolucao = "Informe a data prevista de devolução."
    } else if (new Date(dataPrevistaDevolucao) <= new Date(new Date().toDateString())) {
      erros.dataPrevistaDevolucao = "A data deve ser no futuro."
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
    if (!validar()) return

    setSalvando(true)
    try {
      const payload = {
        itens: itens.map((i) => ({
          materialId: i.material.id,
          quantidade: numeroOuNull(i.quantidade),
        })),
        pessoaAtendidaId: pessoaSelecionada?.id ?? "",
        dataPrevistaDevolucao: new Date(dataPrevistaDevolucao).toISOString(),
        observacoes: observacoes.trim() || null,
      }

      const res = await fetch("/api/emprestimos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error ?? "Erro ao registrar empréstimo.")

      setResultado(dados.emprestimos)
      
      // Passa o ID do primeiro empréstimo criado para o callback
      if (dados.emprestimos && dados.emprestimos.length > 0) {
        onSalvo(dados.emprestimos[0].id)
      }
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao registrar empréstimo.")
    } finally {
      setSalvando(false)
    }
  }

  function finalizar() {
    onSalvo(resultado?.[0]?.id)
  }

  const bloqueado = salvando

  // =================================================================
  // TELA DE RESUMO (pós-submit)
  // =================================================================
  if (resultado) {
    const liberados = resultado.filter((e) => e.status === "EMPRESTADO")
    const pendentes = resultado.filter((e) => e.status === "PENDENTE_APROVACAO")

    return (
      <ModalOverlay onClick={finalizar}>
        <ModalCard as="div" onClick={(e) => e.stopPropagation()}>
          <ModalTopo>
            <div>
              <ModalTitle>Empréstimo registrado</ModalTitle>
              <ModalSubtitle>
                {resultado.length > 1
                  ? `${resultado.length} itens processados.`
                  : "Item processado."}
              </ModalSubtitle>
            </div>
            <FecharButton type="button" onClick={finalizar} title="Fechar">
              <X size={18} />
            </FecharButton>
          </ModalTopo>

          <ResumoWrapper>
            {liberados.length > 0 && (
              <ResumoGrupo>
                <ResumoGrupoTitulo $cor={theme.colors.status.success}>
                  <CheckCircle2 size={16} />
                  {liberados.length} {liberados.length === 1 ? "item liberado" : "itens liberados"} agora
                </ResumoGrupoTitulo>
                {liberados.map((e) => (
                  <ResumoItem key={e.id}>
                    {e.material.nome}
                    <span>
                      {e.quantidade} un.
                    </span>
                  </ResumoItem>
                ))}
              </ResumoGrupo>
            )}

            {pendentes.length > 0 && (
              <ResumoGrupo>
                <ResumoGrupoTitulo $cor={theme.colors.status.warning}>
                  <Clock size={16} />
                  {pendentes.length} {pendentes.length === 1 ? "item aguardando" : "itens aguardando"} aprovação
                </ResumoGrupoTitulo>
                {pendentes.map((e) => (
                  <ResumoItem key={e.id}>
                    {e.material.nome}
                    <span>{e.quantidade} un.</span>
                  </ResumoItem>
                ))}
              </ResumoGrupo>
            )}
          </ResumoWrapper>

          <ModalActions>
            <ActionButton type="button" $variant="primary" onClick={finalizar}>
              <Check size={14} />
              Concluir
            </ActionButton>
          </ModalActions>
        </ModalCard>
      </ModalOverlay>
    )
  }

  // =================================================================
  // FORMULÁRIO
  // =================================================================
  return (
    <ModalOverlay onClick={() => !salvando && onClose()}>
      <ModalCard onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <ModalTopo>
          <div>
            <ModalTitle>Novo empréstimo</ModalTitle>
            <ModalSubtitle>
              Adicione um ou mais itens pro mesmo solicitante. Itens marcados com{" "}
              <ShieldAlert size={11} style={{ display: "inline", verticalAlign: -1 }} /> aguardam aprovação do
              supervisor e não saem do estoque até serem aprovados.
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

        {/* ---------------- Itens ---------------- */}
        <Secao>
          <SecaoTitulo>Itens</SecaoTitulo>

          <BuscaWrapper ref={buscaWrapperRef}>
            <BuscaInputBox>
              <Search size={16} />
              <input
                placeholder="Buscar material pra adicionar..."
                value={termoBusca}
                onChange={(e) => {
                  setTermoBusca(e.target.value)
                  setDropdownAberto(true)
                  if (e.target.value.trim().length < 2) setResultadosBusca([])
                }}
                onFocus={() => setDropdownAberto(true)}
                disabled={bloqueado}
              />
              {buscando && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
            </BuscaInputBox>

            {dropdownAberto && termoBusca.trim() && (
              <BuscaDropdown>
                {resultadosBusca.length === 0 && !buscando ? (
                  <BuscaVazio>
                    <PackageSearch size={20} />
                    Nenhum material encontrado.
                  </BuscaVazio>
                ) : (
                  resultadosBusca.map((m) => {
                    const jaAdicionado = idsJaAdicionados.has(m.id)
                    return (
                      <BuscaItem
                        key={m.id}
                        type="button"
                        disabled={jaAdicionado}
                        onClick={() => !jaAdicionado && adicionarItem(m)}
                      >
                        <BuscaItemInfo>
                          <BuscaItemNome>
                            {m.nome}
                            {m.requerAprovacao && <ShieldAlert size={12} color={theme.colors.status.warning} />}
                          </BuscaItemNome>
                          <BuscaItemMeta>
                            {m.codigoInterno} · {m.estoqueAtual} {m.unidadeMedida.sigla} em estoque
                          </BuscaItemMeta>
                        </BuscaItemInfo>
                        {jaAdicionado && <ItemMeta>já adicionado</ItemMeta>}
                      </BuscaItem>
                    )
                  })
                )}
              </BuscaDropdown>
            )}
          </BuscaWrapper>

          {itens.length === 0 ? (
            <ItensVazio>Nenhum item adicionado ainda. Busque acima pra começar.</ItensVazio>
          ) : (
            <ItensLista>
              {itens.map((item) => (
                <ItemLinha key={item.material.id} $aprovacao={item.material.requerAprovacao}>
                  <ItemInfo>
                    <ItemNomeLinha>
                      <ItemNome>{item.material.nome}</ItemNome>
                      {item.material.requerAprovacao && <ShieldAlert size={13} />}
                    </ItemNomeLinha>
                    {item.material.requerAprovacao ? (
                      <ItemAvisoAprovacao>Vai para aprovação do supervisor</ItemAvisoAprovacao>
                    ) : (
                      <ItemMeta>
                        {item.material.codigoInterno} · {item.material.estoqueAtual} {item.material.unidadeMedida.sigla}{" "}
                        disponível
                      </ItemMeta>
                    )}
                  </ItemInfo>

                  <ItemQuantidadeInput
                    type="number"
                    min={0}
                    step={item.material.unidadeMedida.tipo === "FRACIONADA" ? "0.001" : "1"}
                    value={item.quantidade}
                    onChange={(e) => atualizarQuantidade(item.material.id, e.target.value)}
                    disabled={bloqueado}
                  />

                  <ItemRemoverButton type="button" onClick={() => removerItem(item.material.id)} disabled={bloqueado}>
                    <Trash2 size={14} />
                  </ItemRemoverButton>
                </ItemLinha>
              ))}
            </ItensLista>
          )}

          {errosCampo.itens && <ErrorText>{errosCampo.itens}</ErrorText>}

          {qtdRequerAprovacao > 0 && itens.length > qtdRequerAprovacao && (
            <ErrorText as="span" style={{ color: theme.colors.status.info }}>
              {itens.length - qtdRequerAprovacao} {itens.length - qtdRequerAprovacao === 1 ? "item sai" : "itens saem"}{" "}
              na hora, {qtdRequerAprovacao} aguarda{qtdRequerAprovacao === 1 ? "" : "m"} aprovação.
            </ErrorText>
          )}
        </Secao>

        {/* ---------------- Quem vai receber (cadastro leve) ---------------- */}
        <Secao>
          <SecaoTitulo>Quem vai receber</SecaoTitulo>

          <FieldGroup>
            <Label>
              <User size={12} /> Pessoa do cadastro <Obrigatorio>*</Obrigatorio>
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

        {/* ---------------- Prazo / observações ---------------- */}
        <Secao>
          <SecaoTitulo>Prazo</SecaoTitulo>

          <FieldGroup>
            <Label htmlFor="dataPrevistaDevolucao">
              <CalendarClock size={12} /> Devolução prevista <Obrigatorio>*</Obrigatorio>
            </Label>
            <Input
              id="dataPrevistaDevolucao"
              type="date"
              min={amanha()}
              value={dataPrevistaDevolucao}
              onChange={(e) => setDataPrevistaDevolucao(e.target.value)}
              disabled={bloqueado}
            />
            {errosCampo.dataPrevistaDevolucao && <ErrorText>{errosCampo.dataPrevistaDevolucao}</ErrorText>}
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Detalhes adicionais sobre o empréstimo..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
              disabled={bloqueado}
            />
          </FieldGroup>
        </Secao>

        {/* ===== ModalActions MODIFICADO ===== */}
        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={salvando} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton
            type="button"
            $variant="ghost"
            disabled={bloqueado || itens.length === 0 || imprimindo}
            onClick={handleImprimirRecibo}
          >
            {imprimindo ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
            Imprimir p/ assinatura
          </ActionButton>
          <ActionButton type="submit" $variant="primary" disabled={bloqueado || itens.length === 0}>
            {salvando ? <Loader2 size={14} className="spin" /> : <HandCoins size={14} />}
            Registrar empréstimo
          </ActionButton>
        </ModalActions>
        {/* ===== FIM MODALACTIONS ===== */}
      </ModalCard>
    </ModalOverlay>
  )
}