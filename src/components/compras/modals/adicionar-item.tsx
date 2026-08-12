"use client"

/**
 * components/compras/modals/adicionar-item.tsx
 * ------------------------------------------------------------------
 * Acrescenta um item a um pedido de compra já existente — o caso
 * "pedido de segunda ganha item novo na quarta". Mesmo formulário de
 * item do CriarPedidoModal, só que autocontido e postando direto em
 * /api/compras/{pedidoId}/itens.
 */

import { useState, useEffect, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import { X, Check, Loader2, AlertTriangle, Search, PackageSearch } from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

type TipoItem = "MATERIAL_EXISTENTE" | "MATERIAL_NOVO"

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

interface ItemCriado {
  id: string
  pedidoId: string
}

interface AdicionarItemModalProps {
  pedidoId: string
  numeroPedido: number
  onClose: () => void
  onAdicionado: (item: ItemCriado) => void
}

// =====================================================================
// HELPERS
// =====================================================================

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
  max-width: 620px;
  max-height: 90vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[5]};
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

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  @media (max-width: 480px) { grid-template-columns: 1fr; }
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

const TipoToggle = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  ${glassCardStyles}
  padding: 3px;
  width: fit-content;
`

const TipoToggleButton = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, $active }) => ($active ? theme.colors.text.primary : theme.colors.text.muted)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface.sidebarActive : "transparent")};
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

  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }

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

const MaterialDetalhesBox = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => hexToRgba(theme.colors.status.info, 0.08)};
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.status.info, 0.2)};

  @media (max-width: 480px) {
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
// SUBCOMPONENTE — autocomplete de material (mesmo padrão do CriarPedidoModal)
// =====================================================================

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
            onSelecionar(null)
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

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

export default function AdicionarItemModal({
  pedidoId,
  numeroPedido,
  onClose,
  onAdicionado,
}: AdicionarItemModalProps) {
  const [tipo, setTipo] = useState<TipoItem>("MATERIAL_EXISTENTE")

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [materialNomeExibido, setMaterialNomeExibido] = useState("")
  const [materialDetalhes, setMaterialDetalhes] = useState<MaterialBusca | null>(null)

  const [nomeMaterialNovo, setNomeMaterialNovo] = useState("")
  const [descricaoNovo, setDescricaoNovo] = useState("")
  const [unidadeSugerida, setUnidadeSugerida] = useState("")
  const [marcaNovo, setMarcaNovo] = useState("")
  const [fabricanteNovo, setFabricanteNovo] = useState("")
  const [modeloNovo, setModeloNovo] = useState("")
  const [fornecedorNovo, setFornecedorNovo] = useState("")

  const [quantidade, setQuantidade] = useState("")
  const [observacao, setObservacao] = useState("")
  const [prazoMaximoNecessario, setPrazoMaximoNecessario] = useState("")

  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})

  function validar(): boolean {
    const erros: Record<string, string> = {}

    if (tipo === "MATERIAL_EXISTENTE" && !materialId) {
      erros.material = "Selecione um material da lista."
    }
    if (tipo === "MATERIAL_NOVO" && nomeMaterialNovo.trim().length < 2) {
      erros.nomeNovo = "Informe o nome do material."
    }
    if (!numeroValido(quantidade)) {
      erros.quantidade = "Quantidade inválida."
    }

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
        tipo,
        materialId: tipo === "MATERIAL_EXISTENTE" ? materialId : null,
        nomeMaterialNovo: tipo === "MATERIAL_NOVO" ? nomeMaterialNovo.trim() : null,
        descricaoNovo: tipo === "MATERIAL_NOVO" ? descricaoNovo.trim() || null : null,
        unidadeSugerida: tipo === "MATERIAL_NOVO" ? unidadeSugerida.trim() || null : null,
        marcaNovo: tipo === "MATERIAL_NOVO" ? marcaNovo.trim() || null : null,
        fabricanteNovo: tipo === "MATERIAL_NOVO" ? fabricanteNovo.trim() || null : null,
        modeloNovo: tipo === "MATERIAL_NOVO" ? modeloNovo.trim() || null : null,
        fornecedorNovo: tipo === "MATERIAL_NOVO" ? fornecedorNovo.trim() || null : null,
        quantidade: numeroValido(quantidade),
        observacao: observacao.trim() || null,
        prazoMaximoNecessario: prazoMaximoNecessario
          ? new Date(prazoMaximoNecessario).toISOString()
          : null,
      }

      const res = await fetch(`/api/compras/${pedidoId}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar item.")

      onAdicionado(data.item)
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao adicionar item.")
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
            <ModalTitle>Adicionar item</ModalTitle>
            <ModalSubtitle>Pedido #{numeroPedido}</ModalSubtitle>
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

        <TipoToggle>
          <TipoToggleButton type="button" $active={tipo === "MATERIAL_EXISTENTE"} onClick={() => setTipo("MATERIAL_EXISTENTE")}>
            Cadastrado
          </TipoToggleButton>
          <TipoToggleButton type="button" $active={tipo === "MATERIAL_NOVO"} onClick={() => setTipo("MATERIAL_NOVO")}>
            Sem cadastro
          </TipoToggleButton>
        </TipoToggle>

        {tipo === "MATERIAL_EXISTENTE" ? (
          <>
            <FieldGroup>
              <Label>
                Material <Obrigatorio>*</Obrigatorio>
              </Label>
              <AutocompleteMaterial
                valorExibido={materialNomeExibido}
                disabled={bloqueado}
                onSelecionar={(material) => {
                  setMaterialId(material?.id ?? null)
                  setMaterialNomeExibido(material?.nome ?? materialNomeExibido)
                  setMaterialDetalhes(material)
                }}
              />
              {errosCampo.material && <ErrorText>{errosCampo.material}</ErrorText>}
            </FieldGroup>

            {materialDetalhes && (
              <MaterialDetalhesBox>
                <MaterialDetalheItem>
                  <span>Marca</span>
                  <strong>{materialDetalhes.marca ?? "—"}</strong>
                </MaterialDetalheItem>
                <MaterialDetalheItem>
                  <span>Fabricante</span>
                  <strong>{materialDetalhes.fabricante ?? "—"}</strong>
                </MaterialDetalheItem>
                <MaterialDetalheItem>
                  <span>Modelo</span>
                  <strong>{materialDetalhes.modelo ?? "—"}</strong>
                </MaterialDetalheItem>
                <MaterialDetalheItem>
                  <span>Fornecedor</span>
                  <strong>{materialDetalhes.fornecedor ?? "—"}</strong>
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
                  value={nomeMaterialNovo}
                  onChange={(e) => setNomeMaterialNovo(e.target.value)}
                  maxLength={150}
                  disabled={bloqueado}
                />
                {errosCampo.nomeNovo && <ErrorText>{errosCampo.nomeNovo}</ErrorText>}
              </FieldGroup>
              <FieldGroup>
                <Label>Unidade sugerida</Label>
                <Input
                  placeholder="Ex: un, m, cx..."
                  value={unidadeSugerida}
                  onChange={(e) => setUnidadeSugerida(e.target.value)}
                  maxLength={30}
                  disabled={bloqueado}
                />
              </FieldGroup>
            </Grid2>

            <Grid2>
              <FieldGroup>
                <Label>Marca</Label>
                <Input value={marcaNovo} onChange={(e) => setMarcaNovo(e.target.value)} maxLength={80} disabled={bloqueado} />
              </FieldGroup>
              <FieldGroup>
                <Label>Fabricante</Label>
                <Input value={fabricanteNovo} onChange={(e) => setFabricanteNovo(e.target.value)} maxLength={80} disabled={bloqueado} />
              </FieldGroup>
            </Grid2>
            <Grid2>
              <FieldGroup>
                <Label>Modelo</Label>
                <Input value={modeloNovo} onChange={(e) => setModeloNovo(e.target.value)} maxLength={80} disabled={bloqueado} />
              </FieldGroup>
              <FieldGroup>
                <Label>Fornecedor</Label>
                <Input value={fornecedorNovo} onChange={(e) => setFornecedorNovo(e.target.value)} maxLength={100} disabled={bloqueado} />
              </FieldGroup>
            </Grid2>

            <FieldGroup>
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes que ajudem o comprador a identificar o item certo..."
                value={descricaoNovo}
                onChange={(e) => setDescricaoNovo(e.target.value)}
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
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={bloqueado}
            />
            {errosCampo.quantidade && <ErrorText>{errosCampo.quantidade}</ErrorText>}
          </FieldGroup>
          <FieldGroup>
            <Label>Prazo máximo necessário</Label>
            <Input
              type="date"
              value={prazoMaximoNecessario}
              onChange={(e) => setPrazoMaximoNecessario(e.target.value)}
              disabled={bloqueado}
            />
          </FieldGroup>
          <FieldGroup>
            <Label>Observação</Label>
            <Input
              placeholder="Opcional"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={300}
              disabled={bloqueado}
            />
          </FieldGroup>
        </Grid3>

        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={salvando} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" $variant="primary" disabled={bloqueado}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            Adicionar item
          </ActionButton>
        </ModalActions>
      </ModalCard>
    </ModalOverlay>
  )
}