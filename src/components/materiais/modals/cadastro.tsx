"use client"

/**
 * components/materiais/modals/cadastro.tsx
 * ------------------------------------------------------------------
 * Modal de cadastro de material. Categoria e Unidade de Medida são
 * buscadas aqui mesmo (endpoints leves, cacheáveis, e assim o modal
 * fica autossuficiente — não depende do estado da página que o abriu).
 *
 * Estoque (mínimo/ideal/máximo/atual) é OPCIONAL no cadastro: dá pra
 * já preencher tudo aqui, ou deixar em branco (nasce com 0) e ajustar
 * depois na edição.
 *
 * Foto passa por compressão client-side (canvas -> JPEG) antes de subir
 * pro R2, então o upload nunca carrega o arquivo original do celular.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  X,
  Check,
  Loader2,
  ImagePlus,
  ImageOff,
  Trash2,
  AlertTriangle,
  MapPin,
  Barcode,
  Scan,
  ShieldAlert,
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

interface Categoria {
  id: string
  nome: string
}

interface UnidadeMedida {
  id: string
  sigla: string
  nome: string
  tipo: "INTEIRA" | "FRACIONADA"
}

export interface MaterialCriado {
  id: string
  codigoInterno: string
  nome: string
  [key: string]: unknown
}

interface CadastroMaterialModalProps {
  onClose: () => void
  onCadastrado: (material: MaterialCriado) => void
}

// =====================================================================
// HELPERS
// =====================================================================

const MAX_DIMENSAO = 1600
const QUALIDADE_JPEG = 0.8
const TAMANHO_MAXIMO_ORIGINAL = 15 * 1024 * 1024 // 15MB antes de comprimir (sanity check)

function comprimirImagem(
  file: File,
  maxDimensao = MAX_DIMENSAO,
  qualidade = QUALIDADE_JPEG
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()

    leitor.onload = () => {
      const img = new Image()

      img.onload = () => {
        let { width, height } = img

        if (width > maxDimensao || height > maxDimensao) {
          const escala = maxDimensao / Math.max(width, height)
          width = Math.round(width * escala)
          height = Math.round(height * escala)
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem neste navegador."))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha ao comprimir a imagem."))
              return
            }
            resolve(blob)
          },
          "image/jpeg",
          qualidade
        )
      }

      img.onerror = () => reject(new Error("Não foi possível ler essa imagem."))
      img.src = leitor.result as string
    }

    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."))
    leitor.readAsDataURL(file)
  })
}

function formatarKB(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`
}

function numeroOuZero(valor: string): number {
  const n = Number(valor.replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// =====================================================================
// ANIMAÇÕES
// =====================================================================

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
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

const ModalCard = styled.div`
  ${glassCardStyles}
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
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
  max-width: 48ch;
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
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`

const Grid4 = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};

  @media (max-width: 560px) {
    grid-template-columns: repeat(2, 1fr);
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

  &::placeholder {
    color: ${theme.colors.text.muted};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const Input = styled.input`
  ${inputBaseStyles}
`

const Select = styled.select`
  ${inputBaseStyles}
  cursor: pointer;

  option {
    background: ${({ theme }) => theme.colors.surface.sidebar};
  }
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

// -------- upload de foto --------

const FotoUploadArea = styled.div<{ $temFoto: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
`

const FotoDropzone = styled.button`
  width: 140px;
  height: 100px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1.5px dashed ${({ theme }) => theme.colors.surface.border};
  background: ${({ theme }) => theme.colors.surface.glass};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.6)};
    color: ${({ theme }) => theme.colors.primary.vivid};
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const FotoInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const FotoNome = styled.span`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`

const FotoRemover = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${({ theme }) => theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  width: fit-content;

  &:hover {
    text-decoration: underline;
  }
`

const InputFileOculto = styled.input`
  display: none;
`

// -------- Switch de aprovação --------

const SwitchLinha = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[3]};
`

const Switch = styled.button<{ $on: boolean }>`
  width: 34px;
  height: 20px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme, $on }) => ($on ? theme.colors.status.warning : theme.colors.neutral[700])};
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

const SwitchTexto = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }

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

// =====================================================================
// COMPONENTE
// =====================================================================

export default function CadastroMaterialModal({ onClose, onCadastrado }: CadastroMaterialModalProps) {
  // listas de apoio (categoria / unidade de medida)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadeMedida[]>([])
  const [carregandoListas, setCarregandoListas] = useState(true)

  // campos obrigatórios
  const [nome, setNome] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [unidadeMedidaId, setUnidadeMedidaId] = useState("")

  // campos opcionais — texto
  const [descricao, setDescricao] = useState("")
  const [marca, setMarca] = useState("")
  const [fabricante, setFabricante] = useState("")
  const [modelo, setModelo] = useState("")
  const [numeroSerie, setNumeroSerie] = useState("")
  const [fornecedor, setFornecedor] = useState("")
  const [localizacaoFisica, setLocalizacaoFisica] = useState("")
  const [codigoBarras, setCodigoBarras] = useState("")
  const [qrCode, setQrCode] = useState("")

  // controle de aprovação
  const [requerAprovacao, setRequerAprovacao] = useState(false)

  // estoque — opcional no cadastro, ajustável depois
  const [estoqueMinimo, setEstoqueMinimo] = useState("")
  const [estoqueIdeal, setEstoqueIdeal] = useState("")
  const [estoqueMaximo, setEstoqueMaximo] = useState("")
  const [estoqueAtual, setEstoqueAtual] = useState("")

  // foto
  const [fotoArquivoOriginal, setFotoArquivoOriginal] = useState<File | null>(null)
  const [fotoBlobComprimido, setFotoBlobComprimido] = useState<Blob | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [comprimindoFoto, setComprimindoFoto] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)

  // envio
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})

  // Deriva a unidade selecionada
  const unidadeSelecionada = unidadesMedida.find((u) => u.id === unidadeMedidaId)
  const aceitaFracao = unidadeSelecionada?.tipo === "FRACIONADA"

  // ---------------------------------------------------------------
  // carregar categorias + unidades de medida
  // ---------------------------------------------------------------
  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregandoListas(true)
      try {
        const [resCategorias, resUnidades] = await Promise.all([
          fetch("/api/categorias?ativo=true"),
          fetch("/api/unidades-medida"),
        ])
        const dadosCategorias = await resCategorias.json()
        const dadosUnidades = await resUnidades.json()

        if (!ativo) return
        setCategorias(dadosCategorias.categorias ?? [])
        setUnidadesMedida(dadosUnidades.unidadesMedida ?? [])
      } catch {
        if (ativo) setErroGeral("Não foi possível carregar categorias / unidades de medida.")
      } finally {
        if (ativo) setCarregandoListas(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [])

  // limpa a URL de preview quando troca de foto ou desmonta
  useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
    }
  }, [fotoPreviewUrl])

  // ---------------------------------------------------------------
  // foto
  // ---------------------------------------------------------------
  const handleSelecionarFoto = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const arquivo = e.target.files?.[0]
      e.target.value = "" // permite selecionar o mesmo arquivo de novo depois
      if (!arquivo) return

      if (!arquivo.type.startsWith("image/")) {
        setErroGeral("Selecione um arquivo de imagem.")
        return
      }
      if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) {
        setErroGeral("Essa imagem é grande demais (máx. 15MB antes de comprimir).")
        return
      }

      setErroGeral(null)
      setComprimindoFoto(true)
      try {
        const blob = await comprimirImagem(arquivo)

        if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
        const novaUrl = URL.createObjectURL(blob)

        setFotoArquivoOriginal(arquivo)
        setFotoBlobComprimido(blob)
        setFotoPreviewUrl(novaUrl)
      } catch (err) {
        setErroGeral(err instanceof Error ? err.message : "Falha ao processar a imagem.")
      } finally {
        setComprimindoFoto(false)
      }
    },
    [fotoPreviewUrl]
  )

  function removerFoto() {
    if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
    setFotoArquivoOriginal(null)
    setFotoBlobComprimido(null)
    setFotoPreviewUrl(null)
  }

  // ---------------------------------------------------------------
  // validação client-side (espelha o essencial do zod do backend,
  // só pra dar feedback mais rápido sem esperar o round-trip)
  // ---------------------------------------------------------------
  function validar(): boolean {
    const erros: Record<string, string> = {}

    if (nome.trim().length < 2) erros.nome = "Informe um nome com pelo menos 2 caracteres."
    if (!categoriaId) erros.categoriaId = "Selecione uma categoria."
    if (!unidadeMedidaId) erros.unidadeMedidaId = "Selecione uma unidade de medida."

    const min = estoqueMinimo ? numeroOuZero(estoqueMinimo) : null
    const max = estoqueMaximo ? numeroOuZero(estoqueMaximo) : null
    if (min !== null && max !== null && max > 0 && min > max) {
      erros.estoqueMinimo = "Mínimo não pode ser maior que o máximo."
    }

    // Validação de unidade INTEIRA vs fracionada
    if (unidadeSelecionada && unidadeSelecionada.tipo === "INTEIRA") {
      const valores = [
        estoqueAtual ? numeroOuZero(estoqueAtual) : 0,
        estoqueMinimo ? numeroOuZero(estoqueMinimo) : 0,
        estoqueIdeal ? numeroOuZero(estoqueIdeal) : 0,
        estoqueMaximo ? numeroOuZero(estoqueMaximo) : 0,
      ]
      const temFracao = valores.some((v) => v % 1 !== 0)
      if (temFracao) {
        erros.estoqueAtual = `A unidade "${unidadeSelecionada.nome}" não aceita valores fracionados.`
      }
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
      let fotoUrl: string | null = null

      if (fotoBlobComprimido) {
        const formData = new FormData()
        formData.append("foto", fotoBlobComprimido, "foto.jpg")

        const resUpload = await fetch("/api/materiais/upload-foto", {
          method: "POST",
          body: formData,
        })
        const dadosUpload = await resUpload.json()
        if (!resUpload.ok) throw new Error(dadosUpload.error ?? "Falha ao enviar a foto.")
        fotoUrl = dadosUpload.url
      }

      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoriaId,
        unidadeMedidaId,
        requerAprovacao,
        marca: marca.trim() || null,
        fabricante: fabricante.trim() || null,
        modelo: modelo.trim() || null,
        numeroSerie: numeroSerie.trim() || null,
        fornecedor: fornecedor.trim() || null,
        localizacaoFisica: localizacaoFisica.trim() || null,
        codigoBarras: codigoBarras.trim() || null,
        qrCode: qrCode.trim() || null,
        fotoUrl,
        estoqueMinimo: estoqueMinimo ? numeroOuZero(estoqueMinimo) : 0,
        estoqueIdeal: estoqueIdeal ? numeroOuZero(estoqueIdeal) : 0,
        estoqueMaximo: estoqueMaximo ? numeroOuZero(estoqueMaximo) : 0,
        estoqueAtual: estoqueAtual ? numeroOuZero(estoqueAtual) : 0,
      }

      const res = await fetch("/api/materiais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error ?? "Erro ao cadastrar material.")

      onCadastrado(dados.material)
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao cadastrar material.")
    } finally {
      setSalvando(false)
    }
  }

  const bloqueado = salvando || carregandoListas

  return (
    <ModalOverlay onClick={() => !salvando && onClose()}>
      <ModalCard onClick={(e) => e.stopPropagation()} as="form" onSubmit={handleSubmit}>
        <ModalTopo>
          <div>
            <ModalTitle>Cadastrar material</ModalTitle>
            <ModalSubtitle>
              O código interno é gerado automaticamente. Estoque mínimo, ideal e máximo são
              opcionais aqui — se deixar em branco, entra como 0 e pode ser ajustado depois.
            </ModalSubtitle>
          </div>
          <FecharButton type="button" onClick={onClose} title="Fechar">
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        {erroGeral && (
          <AvisoGeral>
            <AlertTriangle size={16} />
            <span>{erroGeral}</span>
          </AvisoGeral>
        )}

        {/* ---------------- Identificação básica ---------------- */}
        <Secao>
          <SecaoTitulo>Identificação</SecaoTitulo>

          <FieldGroup>
            <Label htmlFor="nome">
              Nome <Obrigatorio>*</Obrigatorio>
            </Label>
            <Input
              id="nome"
              autoFocus
              placeholder="Ex: Furadeira de impacto 1/2&quot;"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={150}
              disabled={bloqueado}
            />
            {errosCampo.nome && <ErrorText>{errosCampo.nome}</ErrorText>}
          </FieldGroup>

          <Grid2>
            <FieldGroup>
              <Label htmlFor="categoria">
                Categoria <Obrigatorio>*</Obrigatorio>
              </Label>
              <Select
                id="categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                disabled={bloqueado}
              >
                <option value="">
                  {carregandoListas ? "Carregando..." : "Selecione..."}
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
              {errosCampo.categoriaId && <ErrorText>{errosCampo.categoriaId}</ErrorText>}
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="unidade">
                Unidade de medida <Obrigatorio>*</Obrigatorio>
              </Label>
              <Select
                id="unidade"
                value={unidadeMedidaId}
                onChange={(e) => setUnidadeMedidaId(e.target.value)}
                disabled={bloqueado}
              >
                <option value="">
                  {carregandoListas ? "Carregando..." : "Selecione..."}
                </option>
                {unidadesMedida.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.sigla})
                  </option>
                ))}
              </Select>
              {errosCampo.unidadeMedidaId && <ErrorText>{errosCampo.unidadeMedidaId}</ErrorText>}
            </FieldGroup>
          </Grid2>

          <FieldGroup>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhes adicionais sobre o item..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={500}
              disabled={bloqueado}
            />
          </FieldGroup>
        </Secao>

        {/* ---------------- Foto ---------------- */}
        <Secao>
          <SecaoTitulo>Foto</SecaoTitulo>

          <FotoUploadArea $temFoto={!!fotoPreviewUrl}>
            <FotoDropzone
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={comprimindoFoto || salvando}
            >
              {comprimindoFoto ? (
                <Loader2 size={20} className="spin" style={{ animation: "spin 0.7s linear infinite" }} />
              ) : fotoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoPreviewUrl} alt="Pré-visualização" />
              ) : (
                <>
                  <ImagePlus size={20} />
                  <span>Adicionar foto</span>
                </>
              )}
            </FotoDropzone>

            <InputFileOculto
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              onChange={handleSelecionarFoto}
            />

            {fotoPreviewUrl ? (
              <FotoInfo>
                <FotoNome>{fotoArquivoOriginal?.name}</FotoNome>
                <span>
                  Original: {fotoArquivoOriginal ? formatarKB(fotoArquivoOriginal.size) : "-"} →
                  {" "}Comprimida: {fotoBlobComprimido ? formatarKB(fotoBlobComprimido.size) : "-"}
                </span>
                <FotoRemover type="button" onClick={removerFoto}>
                  <Trash2 size={12} />
                  Remover foto
                </FotoRemover>
              </FotoInfo>
            ) : (
              <FotoInfo>
                <span>
                  <ImageOff size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />
                  Opcional. A imagem é redimensionada e comprimida automaticamente antes do envio.
                </span>
              </FotoInfo>
            )}
          </FotoUploadArea>
        </Secao>

        {/* ---------------- Controle de retirada ---------------- */}
        <Secao>
          <SecaoTitulo>
            <ShieldAlert size={14} />
            Controle de retirada
          </SecaoTitulo>
          <SwitchLinha>
            <SwitchTexto>
              <strong>Requer aprovação para sair</strong>
              <span>
                Empréstimo ou saída desse item vai precisar de aprovação de um
                supervisor antes de deixar o almoxarifado.
              </span>
            </SwitchTexto>
            <Switch
              $on={requerAprovacao}
              type="button"
              onClick={() => setRequerAprovacao((v) => !v)}
              disabled={bloqueado}
            />
          </SwitchLinha>
        </Secao>

        {/* ---------------- Especificações ---------------- */}
        <Secao>
          <SecaoTitulo>Especificações</SecaoTitulo>

          <Grid2>
            <FieldGroup>
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                maxLength={80}
                disabled={bloqueado}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="fabricante">Fabricante</Label>
              <Input
                id="fabricante"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                maxLength={80}
                disabled={bloqueado}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                maxLength={80}
                disabled={bloqueado}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="numeroSerie">Número de série</Label>
              <Input
                id="numeroSerie"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                maxLength={80}
                disabled={bloqueado}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input
                id="fornecedor"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                maxLength={100}
                disabled={bloqueado}
              />
            </FieldGroup>
          </Grid2>
        </Secao>

        {/* ---------------- Estoque (opcional) ---------------- */}
        <Secao>
          <SecaoTitulo>Estoque (opcional)</SecaoTitulo>

          <Grid4>
            <FieldGroup>
              <Label htmlFor="estoqueAtual">Atual</Label>
              <Input
                id="estoqueAtual"
                type="number"
                min={0}
                step={aceitaFracao ? "0.001" : "1"}
                placeholder="0"
                value={estoqueAtual}
                onChange={(e) => setEstoqueAtual(e.target.value)}
                disabled={bloqueado}
              />
              {errosCampo.estoqueAtual && <ErrorText>{errosCampo.estoqueAtual}</ErrorText>}
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="estoqueMinimo">Mínimo</Label>
              <Input
                id="estoqueMinimo"
                type="number"
                min={0}
                step={aceitaFracao ? "0.001" : "1"}
                placeholder="0"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                disabled={bloqueado}
              />
              {errosCampo.estoqueMinimo && <ErrorText>{errosCampo.estoqueMinimo}</ErrorText>}
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="estoqueIdeal">Ideal</Label>
              <Input
                id="estoqueIdeal"
                type="number"
                min={0}
                step={aceitaFracao ? "0.001" : "1"}
                placeholder="0"
                value={estoqueIdeal}
                onChange={(e) => setEstoqueIdeal(e.target.value)}
                disabled={bloqueado}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="estoqueMaximo">Máximo</Label>
              <Input
                id="estoqueMaximo"
                type="number"
                min={0}
                step={aceitaFracao ? "0.001" : "1"}
                placeholder="0"
                value={estoqueMaximo}
                onChange={(e) => setEstoqueMaximo(e.target.value)}
                disabled={bloqueado}
              />
            </FieldGroup>
          </Grid4>
        </Secao>

        {/* ---------------- Localização / identificação física ---------------- */}
        <Secao>
          <SecaoTitulo>Localização &amp; identificação</SecaoTitulo>

          <FieldGroup>
            <Label htmlFor="localizacao">
              <MapPin size={12} /> Localização física
            </Label>
            <Input
              id="localizacao"
              placeholder="Ex: Almoxarifado A — Prateleira 3"
              value={localizacaoFisica}
              onChange={(e) => setLocalizacaoFisica(e.target.value)}
              maxLength={150}
              disabled={bloqueado}
            />
          </FieldGroup>

          <Grid2>
            <FieldGroup>
              <Label htmlFor="codigoBarras">
                <Barcode size={12} /> Código de barras
              </Label>
              <Input
                id="codigoBarras"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                maxLength={80}
                disabled={bloqueado}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="qrCode">
                <Scan size={12} /> QR Code
              </Label>
              <Input
                id="qrCode"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                maxLength={80}
                disabled={bloqueado}
              />
            </FieldGroup>
          </Grid2>
        </Secao>

        <ModalActions>
          <ActionButton type="button" $variant="ghost" disabled={salvando} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" $variant="primary" disabled={bloqueado || comprimindoFoto}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            Cadastrar material
          </ActionButton>
        </ModalActions>
      </ModalCard>
    </ModalOverlay>
  )
}