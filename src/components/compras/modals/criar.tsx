"use client"

/**
 * components/compras/modals/criar.tsx
 * ------------------------------------------------------------------
 * Cria um pedido de compra com um ou mais itens de uma vez. Solicitante
 * é texto livre (nome/setor/função — sem vínculo com User, por decisão).
 * Cada item pode ser material já cadastrado (autocomplete contra
 * /api/materiais) ou material sem cadastro (nome/descrição/unidade
 * digitados na mão).
 */

import { useState, useEffect, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  X,
  Check,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  PackageSearch,
  UserRound,
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

type TipoItem = "MATERIAL_EXISTENTE" | "MATERIAL_NOVO"

interface Categoria {
  id: string
  nome: string
}

interface MaterialBusca {
  id: string
  nome: string
  codigoInterno: string
  marca: string | null
  fabricante: string | null
  modelo: string | null
  fornecedor: string | null
  unidadeMedida: { sigla: string }
}

interface PessoaBusca {
  id: string
  nome: string
  setor: string
  funcao: string
}

interface ItemForm {
  chaveLocal: string // só pro React key / manipulação local, não vai pro backend
  tipo: TipoItem
  materialId: string | null
  materialNomeExibido: string // pro autocomplete mostrar o nome selecionado
  materialDetalhes: MaterialBusca | null // NOVO — guarda o material selecionado pra exibir marca/fabricante/etc.
  nomeMaterialNovo: string
  descricaoNovo: string
  unidadeSugerida: string
  marcaNovo: string // NOVO
  fabricanteNovo: string // NOVO
  modeloNovo: string // NOVO
  fornecedorNovo: string // NOVO
  quantidade: string
  observacao: string
  prazoMaximoNecessario: string // RENOMEADO de dataPrevistaEntrega
}

interface PedidoCriado {
  id: string
  numero: number
}

interface CriarPedidoModalProps {
  onClose: () => void
  onCriado: (pedido: PedidoCriado) => void
}

// =====================================================================
// HELPERS
// =====================================================================

function novoItemVazio(): ItemForm {
  return {
    chaveLocal: crypto.randomUUID(),
    tipo: "MATERIAL_EXISTENTE",
    materialId: null,
    materialNomeExibido: "",
    materialDetalhes: null,
    nomeMaterialNovo: "",
    descricaoNovo: "",
    unidadeSugerida: "",
    marcaNovo: "",
    fabricanteNovo: "",
    modeloNovo: "",
    fornecedorNovo: "",
    quantidade: "",
    observacao: "",
    prazoMaximoNecessario: "",
  }
}

function numeroValido(valor: string): number | null {
  const n = Number(valor.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

// =====================================================================
// ANIMAÇÕES / LAYOUT
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
  max-width: 850px;
  max-height: 90vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
  animation: ${slideIn} 0.2s ease both;

  &::-webkit-scrollbar { width: 6px; }
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
  max-width: 54ch;
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

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  @media (max-width: 560px) { grid-template-columns: 1fr; }
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

const Input = styled.input`${inputBaseStyles}`
const Textarea = styled.textarea`${inputBaseStyles} min-height: 64px; resize: vertical;`
const Select = styled.select`
  ${inputBaseStyles}
  cursor: pointer;
  option { background: ${({ theme }) => theme.colors.surface.sidebar}; }
`

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.error};
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

  svg { flex-shrink: 0; margin-top: 1px; }
`

// -------- itens --------

const ItensWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ItemCard = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ItemCardTopo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[2]};
`

const ItemNumero = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`

const TipoToggle = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  ${glassCardStyles}
  padding: 3px;
`

const TipoToggleButton = styled.button<{ $active: boolean }>`
  padding: 5px 12px;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, $active }) => ($active ? theme.colors.text.primary : theme.colors.text.muted)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface.sidebarActive : "transparent")};
`

const RemoverItemButton = styled.button`
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text.muted};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.status.errorBg};
    color: ${({ theme }) => theme.colors.status.error};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`

// NOVO — caixa de detalhes do material selecionado
const MaterialDetalhesBox = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => hexToRgba(theme.colors.status.info, 0.08)};
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.status.info, 0.2)};

  @media (max-width: 560px) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const MaterialDetalheItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  span {
    font-size: 10px;
    color: ${({ theme }) => theme.colors.text.muted};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }
`

// -------- autocomplete de material --------

const AutocompleteWrapper = styled.div`
  position: relative;
`

const AutocompleteInputBox = styled.div`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};

  svg {
    color: ${({ theme }) => theme.colors.text.muted};
    flex-shrink: 0;
  }

  input {
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    width: 100%;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};

    &::placeholder { color: ${({ theme }) => theme.colors.text.muted}; }
  }
`

const AutocompleteDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  ${glassCardStyles}
  max-height: 220px;
  overflow-y: auto;
  z-index: 20;
  padding: 4px;
`

const AutocompleteItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.radii.sm};
  text-align: left;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &:hover { background: ${({ theme }) => theme.colors.surface.sidebarActive}; }

  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
`

const AutocompleteItemCodigo = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  margin-left: auto;
`

const AutocompleteVazio = styled.div`
  padding: ${({ theme }) => theme.spacing[3]};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

// -------- autocomplete de pessoa (NOVO) --------

function AutocompletePessoa({
  valor,
  onSelecionar,
  disabled,
}: {
  valor: string
  onSelecionar: (pessoa: PessoaBusca) => void
  disabled: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [resultados, setResultados] = useState<PessoaBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickFora)
    return () => document.removeEventListener("mousedown", handleClickFora)
  }, [])

  useEffect(() => {
    if (!aberto || valor.trim().length < 2) {
      setResultados([])
      return
    }
    let ativo = true
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const params = new URLSearchParams({ busca: valor.trim() })
        const res = await fetch(`/api/pessoas-atendidas?${params.toString()}`)
        const data = await res.json()
        if (ativo) setResultados(data.pessoas ?? [])
      } catch {
        if (ativo) setResultados([])
      } finally {
        if (ativo) setBuscando(false)
      }
    }, 300)
    return () => {
      ativo = false
      clearTimeout(t)
    }
  }, [valor, aberto])

  // só mostra dropdown se tiver resultado — deixa de exibir "nenhum
  // encontrado" aqui, porque digitar nome novo é um caminho válido
  // (a pessoa é cadastrada automaticamente ao criar o pedido)
  const mostrarDropdown = aberto && valor.trim().length >= 2 && (buscando || resultados.length > 0)

  return (
    <AutocompleteWrapper ref={wrapperRef}>
      <AutocompleteInputBox>
        <Search size={14} />
        <input
          placeholder="Digite o nome — sugere quem já foi atendido antes"
          value={valor}
          disabled={disabled}
          onFocus={() => setAberto(true)}
          onChange={(e) => onSelecionar({ id: "", nome: e.target.value, setor: "", funcao: "" })}
        />
      </AutocompleteInputBox>

      {mostrarDropdown && (
        <AutocompleteDropdown>
          {buscando && <AutocompleteVazio>Buscando...</AutocompleteVazio>}
          {!buscando &&
            resultados.map((pessoa) => (
              <AutocompleteItem
                key={pessoa.id}
                type="button"
                onClick={() => {
                  onSelecionar(pessoa)
                  setAberto(false)
                }}
              >
                <UserRound size={14} />
                {pessoa.nome}
                <AutocompleteItemCodigo>
                  {pessoa.setor} · {pessoa.funcao}
                </AutocompleteItemCodigo>
              </AutocompleteItem>
            ))}
        </AutocompleteDropdown>
      )}
    </AutocompleteWrapper>
  )
}

// -------- autocomplete de material (já existente, com tipo atualizado) --------

function AutocompleteMaterial({
  valorExibido,
  onSelecionar,
  disabled,
}: {
  valorExibido: string
  onSelecionar: (material: MaterialBusca | null) => void
  disabled: boolean
}) {
  const [texto, setTexto] = useState(valorExibido)
  const [aberto, setAberto] = useState(false)
  const [resultados, setResultados] = useState<MaterialBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => setTexto(valorExibido), [valorExibido])

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickFora)
    return () => document.removeEventListener("mousedown", handleClickFora)
  }, [])

  useEffect(() => {
    if (!aberto || texto.trim().length < 2) {
      setResultados([])
      return
    }
    let ativo = true
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const params = new URLSearchParams({ busca: texto.trim(), limit: "8" })
        const res = await fetch(`/api/materiais?${params.toString()}`)
        const data = await res.json()
        if (ativo) setResultados(data.materiais ?? [])
      } catch {
        if (ativo) setResultados([])
      } finally {
        if (ativo) setBuscando(false)
      }
    }, 300)
    return () => {
      ativo = false
      clearTimeout(t)
    }
  }, [texto, aberto])

  return (
    <AutocompleteWrapper ref={wrapperRef}>
      <AutocompleteInputBox>
        <Search size={14} />
        <input
          placeholder="Buscar material cadastrado..."
          value={texto}
          disabled={disabled}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTexto(e.target.value)
            setAberto(true)
            onSelecionar(null) // desmarca seleção anterior enquanto digita algo novo
          }}
        />
      </AutocompleteInputBox>

      {aberto && texto.trim().length >= 2 && (
        <AutocompleteDropdown>
          {buscando && <AutocompleteVazio>Buscando...</AutocompleteVazio>}
          {!buscando && resultados.length === 0 && (
            <AutocompleteVazio>Nenhum material encontrado.</AutocompleteVazio>
          )}
          {!buscando &&
            resultados.map((material) => (
              <AutocompleteItem
                key={material.id}
                type="button"
                onClick={() => {
                  setTexto(material.nome)
                  setAberto(false)
                  onSelecionar(material)
                }}
              >
                <PackageSearch size={14} />
                {material.nome}
                <AutocompleteItemCodigo>{material.codigoInterno}</AutocompleteItemCodigo>
              </AutocompleteItem>
            ))}
        </AutocompleteDropdown>
      )}
    </AutocompleteWrapper>
  )
}

// -------- botões --------

const AdicionarItemButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px dashed ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.5)};
    color: ${({ theme }) => theme.colors.primary.vivid};
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

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

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  svg.spin { animation: ${spin} 0.7s linear infinite; }
`

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

export default function CriarPedidoModal({ onClose, onCriado }: CriarPedidoModalProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carregandoCategorias, setCarregandoCategorias] = useState(true)

  const [areaId, setAreaId] = useState("")
  const [solicitanteNome, setSolicitanteNome] = useState("")
  const [solicitanteSetor, setSolicitanteSetor] = useState("")
  const [solicitanteFuncao, setSolicitanteFuncao] = useState("")
  const [observacoes, setObservacoes] = useState("")

  const [itens, setItens] = useState<ItemForm[]>([novoItemVazio()])

  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregandoCategorias(true)
      try {
        const res = await fetch("/api/categorias?ativo=true")
        const data = await res.json()
        if (ativo) setCategorias(data.categorias ?? [])
      } catch {
        // categoria é opcional — falha em carregar não bloqueia o resto do form
      } finally {
        if (ativo) setCarregandoCategorias(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  function atualizarItem(chaveLocal: string, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((item) => (item.chaveLocal === chaveLocal ? { ...item, ...patch } : item)))
  }

  function adicionarItem() {
    setItens((prev) => [...prev, novoItemVazio()])
  }

  function removerItem(chaveLocal: string) {
    setItens((prev) => (prev.length > 1 ? prev.filter((item) => item.chaveLocal !== chaveLocal) : prev))
  }

  function validar(): boolean {
    const erros: Record<string, string> = {}

    if (solicitanteNome.trim().length < 2) erros.solicitanteNome = "Informe o nome."
    if (solicitanteSetor.trim().length < 2) erros.solicitanteSetor = "Informe o setor."
    if (solicitanteFuncao.trim().length < 2) erros.solicitanteFuncao = "Informe a função."

    itens.forEach((item, index) => {
      const prefixo = `item-${index}`
      if (item.tipo === "MATERIAL_EXISTENTE" && !item.materialId) {
        erros[`${prefixo}-material`] = "Selecione um material da lista."
      }
      if (item.tipo === "MATERIAL_NOVO" && item.nomeMaterialNovo.trim().length < 2) {
        erros[`${prefixo}-nomeNovo`] = "Informe o nome do material."
      }
      if (!numeroValido(item.quantidade)) {
        erros[`${prefixo}-quantidade`] = "Quantidade inválida."
      }
    })

    setErrosCampo(erros)
    return Object.keys(erros).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErroGeral(null)
    if (!validar()) return

    setSalvando(true)
    try {
      const payload = {
        areaId: areaId || null,
        solicitanteNome: solicitanteNome.trim(),
        solicitanteSetor: solicitanteSetor.trim(),
        solicitanteFuncao: solicitanteFuncao.trim(),
        observacoes: observacoes.trim() || null,
        itens: itens.map((item) => ({
          tipo: item.tipo,
          materialId: item.tipo === "MATERIAL_EXISTENTE" ? item.materialId : null,
          nomeMaterialNovo: item.tipo === "MATERIAL_NOVO" ? item.nomeMaterialNovo.trim() : null,
          descricaoNovo: item.tipo === "MATERIAL_NOVO" ? item.descricaoNovo.trim() || null : null,
          unidadeSugerida: item.tipo === "MATERIAL_NOVO" ? item.unidadeSugerida.trim() || null : null,
          marcaNovo: item.tipo === "MATERIAL_NOVO" ? item.marcaNovo.trim() || null : null,
          fabricanteNovo: item.tipo === "MATERIAL_NOVO" ? item.fabricanteNovo.trim() || null : null,
          modeloNovo: item.tipo === "MATERIAL_NOVO" ? item.modeloNovo.trim() || null : null,
          fornecedorNovo: item.tipo === "MATERIAL_NOVO" ? item.fornecedorNovo.trim() || null : null,
          quantidade: numeroValido(item.quantidade),
          observacao: item.observacao.trim() || null,
          prazoMaximoNecessario: item.prazoMaximoNecessario
            ? new Date(item.prazoMaximoNecessario).toISOString()
            : null,
        })),
      }

      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar pedido.")

      onCriado(data.pedido)
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao criar pedido.")
    } finally {
      setSalvando(false)
    }
  }

  const bloqueado = salvando

  return (
    <ModalOverlay onClick={() => !salvando && onClose()}>
      <ModalCard onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <ModalTopo>
          <div>
            <ModalTitle>Novo pedido de compra</ModalTitle>
            <ModalSubtitle>
              Registre quem pediu e o que precisa comprar. Dá pra acrescentar mais itens neste
              mesmo pedido depois, sem precisar criar um novo.
            </ModalSubtitle>
          </div>
          <FecharButton type="button" onClick={onClose} title="Fechar">
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        {erroGeral && (
          <AvisoErro>
            <AlertTriangle size={16} />
            <span>{erroGeral}</span>
          </AvisoErro>
        )}

        <Secao>
          <SecaoTitulo>Solicitante</SecaoTitulo>

          <FieldGroup>
            <Label>
              Nome <Obrigatorio>*</Obrigatorio>
            </Label>
            <AutocompletePessoa
              valor={solicitanteNome}
              disabled={bloqueado}
              onSelecionar={(pessoa) => {
                setSolicitanteNome(pessoa.nome)
                if (pessoa.id) {
                  // selecionou da lista — preenche setor/função automaticamente
                  setSolicitanteSetor(pessoa.setor)
                  setSolicitanteFuncao(pessoa.funcao)
                }
              }}
            />
            {errosCampo.solicitanteNome && <ErrorText>{errosCampo.solicitanteNome}</ErrorText>}
          </FieldGroup>

          <Grid2>
            <FieldGroup>
              <Label htmlFor="solicitanteSetor">
                Setor <Obrigatorio>*</Obrigatorio>
              </Label>
              <Input
                id="solicitanteSetor"
                placeholder="Ex: Manutenção"
                value={solicitanteSetor}
                onChange={(e) => setSolicitanteSetor(e.target.value)}
                maxLength={100}
                disabled={bloqueado}
              />
              {errosCampo.solicitanteSetor && <ErrorText>{errosCampo.solicitanteSetor}</ErrorText>}
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="solicitanteFuncao">
                Função <Obrigatorio>*</Obrigatorio>
              </Label>
              <Input
                id="solicitanteFuncao"
                placeholder="Ex: Técnico Elétrico"
                value={solicitanteFuncao}
                onChange={(e) => setSolicitanteFuncao(e.target.value)}
                maxLength={100}
                disabled={bloqueado}
              />
              {errosCampo.solicitanteFuncao && <ErrorText>{errosCampo.solicitanteFuncao}</ErrorText>}
            </FieldGroup>
          </Grid2>
        </Secao>

        <Secao>
          <SecaoTitulo>Categoria do pedido (opcional)</SecaoTitulo>

          <Grid2>
            <FieldGroup>
              <Label htmlFor="area">Categoria do pedido (opcional)</Label>
              <Select id="area" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={bloqueado}>
                <option value="">{carregandoCategorias ? "Carregando..." : "Sem categoria"}</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </Grid2>

          <FieldGroup>
            <Label htmlFor="observacoes">Observações do pedido (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Qualquer contexto adicional sobre o pedido..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
              disabled={bloqueado}
            />
          </FieldGroup>
        </Secao>

        <Secao>
          <SecaoTitulo>Itens do pedido</SecaoTitulo>

          <ItensWrapper>
            {itens.map((item, index) => {
              const prefixo = `item-${index}`
              return (
                <ItemCard key={item.chaveLocal}>
                  <ItemCardTopo>
                    <ItemNumero>Item {index + 1}</ItemNumero>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <TipoToggle>
                        <TipoToggleButton
                          type="button"
                          $active={item.tipo === "MATERIAL_EXISTENTE"}
                          onClick={() => atualizarItem(item.chaveLocal, { tipo: "MATERIAL_EXISTENTE" })}
                        >
                          Cadastrado
                        </TipoToggleButton>
                        <TipoToggleButton
                          type="button"
                          $active={item.tipo === "MATERIAL_NOVO"}
                          onClick={() => atualizarItem(item.chaveLocal, { tipo: "MATERIAL_NOVO" })}
                        >
                          Sem cadastro
                        </TipoToggleButton>
                      </TipoToggle>

                      <RemoverItemButton
                        type="button"
                        disabled={itens.length <= 1 || bloqueado}
                        onClick={() => removerItem(item.chaveLocal)}
                        title="Remover item"
                      >
                        <Trash2 size={14} />
                      </RemoverItemButton>
                    </div>
                  </ItemCardTopo>

                  {item.tipo === "MATERIAL_EXISTENTE" ? (
                    <>
                      <FieldGroup>
                        <Label>
                          Material <Obrigatorio>*</Obrigatorio>
                        </Label>
                        <AutocompleteMaterial
                          valorExibido={item.materialNomeExibido}
                          disabled={bloqueado}
                          onSelecionar={(material) =>
                            atualizarItem(item.chaveLocal, {
                              materialId: material?.id ?? null,
                              materialNomeExibido: material?.nome ?? item.materialNomeExibido,
                              materialDetalhes: material,
                            })
                          }
                        />
                        {errosCampo[`${prefixo}-material`] && (
                          <ErrorText>{errosCampo[`${prefixo}-material`]}</ErrorText>
                        )}
                      </FieldGroup>

                      {item.materialDetalhes && (
                        <MaterialDetalhesBox>
                          <MaterialDetalheItem>
                            <span>Marca</span>
                            <strong>{item.materialDetalhes.marca ?? "—"}</strong>
                          </MaterialDetalheItem>
                          <MaterialDetalheItem>
                            <span>Fabricante</span>
                            <strong>{item.materialDetalhes.fabricante ?? "—"}</strong>
                          </MaterialDetalheItem>
                          <MaterialDetalheItem>
                            <span>Modelo</span>
                            <strong>{item.materialDetalhes.modelo ?? "—"}</strong>
                          </MaterialDetalheItem>
                          <MaterialDetalheItem>
                            <span>Fornecedor</span>
                            <strong>{item.materialDetalhes.fornecedor ?? "—"}</strong>
                          </MaterialDetalheItem>
                        </MaterialDetalhesBox>
                      )}
                    </>
                  ) : (
                    <>
                      <Grid2>
                        <FieldGroup>
                          <Label>
                            Nome do material <Obrigatorio>*</Obrigatorio>
                          </Label>
                          <Input
                            placeholder="Ex: Disjuntor bipolar 40A"
                            value={item.nomeMaterialNovo}
                            onChange={(e) => atualizarItem(item.chaveLocal, { nomeMaterialNovo: e.target.value })}
                            maxLength={150}
                            disabled={bloqueado}
                          />
                          {errosCampo[`${prefixo}-nomeNovo`] && (
                            <ErrorText>{errosCampo[`${prefixo}-nomeNovo`]}</ErrorText>
                          )}
                        </FieldGroup>
                        <FieldGroup>
                          <Label>Unidade sugerida</Label>
                          <Input
                            placeholder="Ex: un, m, cx..."
                            value={item.unidadeSugerida}
                            onChange={(e) => atualizarItem(item.chaveLocal, { unidadeSugerida: e.target.value })}
                            maxLength={30}
                            disabled={bloqueado}
                          />
                        </FieldGroup>
                      </Grid2>

                      {/* NOVO — mesmos campos que o cadastro de Material já tem */}
                      <Grid2>
                        <FieldGroup>
                          <Label>Marca</Label>
                          <Input
                            value={item.marcaNovo}
                            onChange={(e) => atualizarItem(item.chaveLocal, { marcaNovo: e.target.value })}
                            maxLength={80}
                            disabled={bloqueado}
                          />
                        </FieldGroup>
                        <FieldGroup>
                          <Label>Fabricante</Label>
                          <Input
                            value={item.fabricanteNovo}
                            onChange={(e) => atualizarItem(item.chaveLocal, { fabricanteNovo: e.target.value })}
                            maxLength={80}
                            disabled={bloqueado}
                          />
                        </FieldGroup>
                      </Grid2>
                      <Grid2>
                        <FieldGroup>
                          <Label>Modelo</Label>
                          <Input
                            value={item.modeloNovo}
                            onChange={(e) => atualizarItem(item.chaveLocal, { modeloNovo: e.target.value })}
                            maxLength={80}
                            disabled={bloqueado}
                          />
                        </FieldGroup>
                        <FieldGroup>
                          <Label>Fornecedor</Label>
                          <Input
                            value={item.fornecedorNovo}
                            onChange={(e) => atualizarItem(item.chaveLocal, { fornecedorNovo: e.target.value })}
                            maxLength={100}
                            disabled={bloqueado}
                          />
                        </FieldGroup>
                      </Grid2>

                      <FieldGroup>
                        <Label>Descrição (opcional)</Label>
                        <Textarea
                          placeholder="Detalhes que ajudem o comprador a identificar o item certo..."
                          value={item.descricaoNovo}
                          onChange={(e) => atualizarItem(item.chaveLocal, { descricaoNovo: e.target.value })}
                          maxLength={500}
                          disabled={bloqueado}
                        />
                      </FieldGroup>
                    </>
                  )}

                  <Grid3>
                    <FieldGroup>
                      <Label>
                        Quantidade <Obrigatorio>*</Obrigatorio>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0"
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(item.chaveLocal, { quantidade: e.target.value })}
                        disabled={bloqueado}
                      />
                      {errosCampo[`${prefixo}-quantidade`] && (
                        <ErrorText>{errosCampo[`${prefixo}-quantidade`]}</ErrorText>
                      )}
                    </FieldGroup>
                    <FieldGroup>
                      <Label>Prazo máximo necessário</Label>
                      <Input
                        type="date"
                        value={item.prazoMaximoNecessario}
                        onChange={(e) => atualizarItem(item.chaveLocal, { prazoMaximoNecessario: e.target.value })}
                        disabled={bloqueado}
                      />
                    </FieldGroup>
                    <FieldGroup>
                      <Label>Observação do item</Label>
                      <Input
                        placeholder="Opcional"
                        value={item.observacao}
                        onChange={(e) => atualizarItem(item.chaveLocal, { observacao: e.target.value })}
                        maxLength={300}
                        disabled={bloqueado}
                      />
                    </FieldGroup>
                  </Grid3>
                </ItemCard>
              )
            })}

            <AdicionarItemButton type="button" onClick={adicionarItem} disabled={bloqueado}>
              <Plus size={14} />
              Adicionar outro item
            </AdicionarItemButton>
          </ItensWrapper>
        </Secao>

        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={salvando} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" $variant="primary" disabled={bloqueado}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            Criar pedido
          </ActionButton>
        </ModalActions>
      </ModalCard>
    </ModalOverlay>
  )
}