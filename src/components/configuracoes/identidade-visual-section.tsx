"use client"

/**
 * Configurações → Identidade visual (visível SOMENTE para ADMIN).
 * Cores + nome da organização + uploads R2 para logo e backgrounds,
 * com previews FIÉIS ao resultado final (mesmas transformações do
 * resolveVisualTheme: scrim da sidebar, opacidade de superfície) e
 * warnings de proporção calculados no cliente antes do upload.
 *
 * Upload é ADIADO: selecionar um arquivo só gera preview local (blob URL)
 * e guarda o File em memória. O upload real pro R2 só acontece no clique
 * de "Salvar" — evita acumular assets órfãos no bucket quando o admin
 * troca de imagem várias vezes ou fecha a aba sem salvar.
 */

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import styled from "styled-components"
import {
  Building2, Palette, Image as ImageIcon, Upload, Trash2, Save,
  Loader2, AlertTriangle, CheckCircle2,
} from "lucide-react"
import {
  validarArquivoImagem,
  sugerirProporcao,
  NOME_ORGANIZACAO_MAX,
  type TipoAssetBranding,
} from "@/lib/configuracoes/identidade-visual-schema"
import { hexToRgba } from "@/styles/theme"
import { rgbaFromHex } from "@/styles/visual-identity"

const CAMPOS_COR = [
  { key: "primary", label: "Cor primária", dica: "Botões principais e destaques de ação" },
  { key: "accent", label: "Cor secundária / accent", dica: "Ícones ativos e barra lateral de seleção na sidebar" },
  { key: "destaque", label: "Cor de destaque", dica: "Badges, alertas e elementos de chamada visual" },
  { key: "background", label: "Background principal", dica: "Fundo geral das páginas do sistema" },
  { key: "surface", label: "Superfícies / cards", dica: "Fundo de cards e painéis (aplicado com leve transparência)" },
  { key: "sidebar", label: "Sidebar", dica: "Cor base da barra lateral (por trás da imagem de fundo)" },
  { key: "textPrimary", label: "Texto principal", dica: "Títulos e textos de maior ênfase" },
  { key: "textSecondary", label: "Texto secundário", dica: "Legendas, rótulos e textos de apoio" },
  { key: "linkColor", label: "Links", dica: "Cor de links e ações de texto clicáveis" },
] as const

type CampoCorKey = (typeof CAMPOS_COR)[number]["key"]
type CoresForm = Record<CampoCorKey, string>
const HEX_LOCAL = /^#[0-9a-fA-F]{6}$/

// Mesma transparência/derivação usada pelo resolver real (visual-identity.ts)
// para superfícies — mantido em um único lugar para não divergir do preview.
const SURFACE_CARD_ALPHA = 0.86

interface ImagemPendente {
  file: File
  previewUrl: string
}

interface ImagensForm {
  logoUrl: string
  loginBackgroundUrl: string
  sidebarBackgroundUrl: string
}

const CARDS_IMAGEM: Array<{
  tipo: TipoAssetBranding
  titulo: string
  rec: string
}> = [
  { tipo: "logo", titulo: "Logo da organização", rec: "Recomendado: quadrada (ex.: 512×512), fundo transparente" },
  { tipo: "login", titulo: "Background do Login e Registro", rec: "Recomendado: imagem horizontal 16:9 (ex.: 1920×1080). Outras proporções serão cortadas." },
  { tipo: "sidebar", titulo: "Background da Sidebar", rec: "Recomendado: imagem vertical (ex.: 800×1200). Imagens horizontais sofrerão cortes significativos." },
]

function mapearCampoImagem(t: TipoAssetBranding): keyof ImagensForm {
  if (t === "logo") return "logoUrl"
  if (t === "login") return "loginBackgroundUrl"
  return "sidebarBackgroundUrl"
}

export function SecaoIdentidadeVisual() {
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const [nome, setNome] = useState("")
  const [cores, setCores] = useState<CoresForm>(
    () => Object.fromEntries(CAMPOS_COR.map((c) => [c.key, ""])) as CoresForm
  )
  // Imagens já persistidas (vindas do backend / já salvas anteriormente).
  const [imagens, setImagens] = useState<ImagensForm>({ logoUrl: "", loginBackgroundUrl: "", sidebarBackgroundUrl: "" })
  // Imagens selecionadas agora, ainda NÃO enviadas pro R2 — só sobem no Salvar.
  const [pendentes, setPendentes] = useState<Partial<Record<TipoAssetBranding, ImagemPendente>>>({})
  const [avisos, setAvisos] = useState<Partial<Record<TipoAssetBranding, string>>>({})

  // Guarda todas as blob URLs já criadas nesta sessão, pra garantir que
  // TODAS sejam revogadas no unmount — mesmo as que nunca chegaram a
  // completar o onload (arquivo corrompido, por exemplo).
  const blobUrlsAtivas = useRef<Set<string>>(new Set())

  useEffect(() => {
    let ativo = true
    fetch("/api/configuracoes/identidade-visual")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!ativo || !d?.config) return
        setNome(d.config.nomeOrganizacao ?? "")
        setCores(
          Object.fromEntries(CAMPOS_COR.map((c) => [c.key, d.config.cores?.[c.key] ?? ""])) as CoresForm
        )
        setImagens({
          logoUrl: d.config.logoUrl ?? "",
          loginBackgroundUrl: d.config.loginBackgroundUrl ?? "",
          sidebarBackgroundUrl: d.config.sidebarBackgroundUrl ?? "",
        })
      })
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  // Revoga todas as blob URLs criadas quando o componente desmonta.
  useEffect(() => {
    const urls = blobUrlsAtivas.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  // Preview usa o valor digitado ou, na ausência, uma amostra neutra
  // (não o tema atual — evita acoplamento com chaves internas do Theme).
  const SWATCH_PADRAO: Record<CampoCorKey, string> = {
    primary: "#1D4ED8",
    accent: "#FFD700",
    destaque: "#16A34A",
    background: "#050A12",
    surface: "#0F1A2B",
    sidebar: "#0A1424",
    textPrimary: "#E5EDF8",
    textSecondary: "#8FA3BF",
    linkColor: "#6EA8FF",
  }
  const valorDe = (campo: CampoCorKey) =>
    (cores[campo] && HEX_LOCAL.test(cores[campo]) ? cores[campo] : "") || SWATCH_PADRAO[campo]

  function onSelecionarImagem(tipo: TipoAssetBranding, file: File | undefined) {
    if (!file) return
    const erro = validarArquivoImagem(file.type, file.size)
    if (erro) {
      setFeedback({ ok: false, msg: erro })
      return
    }

    // Preview local imediato — nada sobe pro servidor ainda.
    const previewUrl = URL.createObjectURL(file)
    blobUrlsAtivas.current.add(previewUrl)

    // Libera a blob URL anterior deste mesmo campo, se havia uma pendente.
    setPendentes((prev) => {
      const anterior = prev[tipo]
      if (anterior) {
        URL.revokeObjectURL(anterior.previewUrl)
        blobUrlsAtivas.current.delete(anterior.previewUrl)
      }
      return { ...prev, [tipo]: { file, previewUrl } }
    })

    // Warning de proporção (não bloqueia), calculado a partir do próprio preview.
    const img = new window.Image()
    img.onload = () => {
      const s = sugerirProporcao(tipo)
      const atual = img.width / img.height
      const ideal = s.largura / s.altura
      if (Math.abs(atual - ideal) / ideal > 0.25) {
        setAvisos((a) => ({ ...a, [tipo]: `Proporção ${img.width}×${img.height} difere bastante do ideal ${s.descricao}. A imagem será cortada (object-fit: cover).` }))
      } else {
        setAvisos((a) => ({ ...a, [tipo]: undefined }))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl)
      blobUrlsAtivas.current.delete(previewUrl)
      setPendentes((prev) => {
        const { [tipo]: _remover, ...resto } = prev
        return resto
      })
      setFeedback({ ok: false, msg: "Não foi possível ler essa imagem — o arquivo pode estar corrompido." })
    }
    img.src = previewUrl
  }

  function removerImagem(tipo: TipoAssetBranding) {
    const campo = mapearCampoImagem(tipo)
    setPendentes((prev) => {
      const p = prev[tipo]
      if (p) {
        URL.revokeObjectURL(p.previewUrl)
        blobUrlsAtivas.current.delete(p.previewUrl)
      }
      const { [tipo]: _remover, ...resto } = prev
      return resto
    })
    setImagens((prev) => ({ ...prev, [campo]: "" }))
    setAvisos((a) => ({ ...a, [tipo]: undefined }))
  }

  // URL efetiva pra exibir no preview: pendente (local) tem prioridade
  // sobre a já persistida, já que reflete a seleção mais recente do admin.
  function urlEfetiva(tipo: TipoAssetBranding): string {
    const pendente = pendentes[tipo]
    if (pendente) return pendente.previewUrl
    return imagens[mapearCampoImagem(tipo)]
  }

  async function enviarPendente(tipo: TipoAssetBranding): Promise<string> {
    const pendente = pendentes[tipo]
    if (!pendente) return imagens[mapearCampoImagem(tipo)]

    const fd = new FormData()
    fd.set("arquivo", pendente.file)
    fd.set("tipo", tipo)
    const res = await fetch("/api/configuracoes/identidade-visual/upload", { method: "POST", body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `Falha no upload de ${tipo}`)
    return data.url as string
  }

  async function salvar() {
    setFeedback(null)

    // Guarda client-side — a API revalida com o MESMO limite (ver
    // NOME_ORGANIZACAO_MAX no schema). Falha ANTES de subir imagens pro R2,
    // evitando uploads que seriam seguidos de um 400.
    if (nome.trim().length > NOME_ORGANIZACAO_MAX) {
      setFeedback({
        ok: false,
        msg: `O nome da organização deve ter no máximo ${NOME_ORGANIZACAO_MAX} caracteres.`,
      })
      return
    }

    setSalvando(true)
    try {
      // 1. Sobe só as imagens que de fato mudaram nesta sessão.
      const tiposPendentes = Object.keys(pendentes) as TipoAssetBranding[]
      const urlsFinais = { ...imagens }
      for (const tipo of tiposPendentes) {
        const url = await enviarPendente(tipo)
        urlsFinais[mapearCampoImagem(tipo)] = url
      }

      // 2. Salva a configuração completa com as URLs finais.
      const body = {
        nomeOrganizacao: nome.trim() ? nome.trim() : null,
        cores: Object.fromEntries(
          CAMPOS_COR.map((c) => [c.key, HEX_LOCAL.test(cores[c.key]) ? cores[c.key] : null])
        ),
        logoUrl: urlsFinais.logoUrl || null,
        loginBackgroundUrl: urlsFinais.loginBackgroundUrl || null,
        sidebarBackgroundUrl: urlsFinais.sidebarBackgroundUrl || null,
      }
      const res = await fetch("/api/configuracoes/identidade-visual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // A API devolve detalhes por campo (zod .flatten()) — prioriza a
        // mensagem específica (ex.: nome da organização acima do limite).
        const erroCampo: string | undefined = data.detalhes?.nomeOrganizacao?.[0]
        throw new Error(erroCampo ?? data.error ?? "Falha ao salvar")
      }

      // 3. Sucesso: limpa pendências locais (as blob URLs já foram trocadas
      // pelas URLs reais do R2) e atualiza o estado persistido.
      tiposPendentes.forEach((tipo) => {
        const p = pendentes[tipo]
        if (p) {
          URL.revokeObjectURL(p.previewUrl)
          blobUrlsAtivas.current.delete(p.previewUrl)
        }
      })
      setPendentes({})
      setImagens(urlsFinais)
      setFeedback({ ok: true, msg: "Identidade visual salva e aplicada na aplicação!" })
      router.refresh()
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Falha ao salvar" })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Wrapper>
      <SecaoHeader>
        <IconeSecao><Palette size={18} /></IconeSecao>
        <div>
          <TituloSecao>Identidade visual</TituloSecao>
          <SubSecao>Personalize nome, cores e imagens da organização. As mudanças valem para todo o sistema.</SubSecao>
        </div>
      </SecaoHeader>

      {carregando ? (
        <Carregando><Loader2 size={16} className="spin" /> Carregando configuração…</Carregando>
      ) : (
        <>
          <BlocoTitulo><Building2 size={13} /> Identidade da organização</BlocoTitulo>
          <CampoLabel htmlFor="nome-organizacao">Nome da organização</CampoLabel>
          <NomeRow>
            <NomeInput
              id="nome-organizacao"
              value={nome}
              maxLength={NOME_ORGANIZACAO_MAX}
              placeholder="Ex.: Minha Org"
              onChange={(e) => setNome(e.target.value)}
            />
            <ContadorCaracteres $excedido={nome.trim().length > NOME_ORGANIZACAO_MAX}>
              {nome.length}/{NOME_ORGANIZACAO_MAX}
            </ContadorCaracteres>
          </NomeRow>

          <BlocoTitulo><Palette size={13} /> Cores</BlocoTitulo>
          <GridCores>
            {CAMPOS_COR.map((c) => {
              const inputId = `cor-${c.key}`
              return (
                <LinhaCor key={c.key}>
                  <CorSwatch $cor={valorDe(c.key)} />
                  <TextoCor>
                    <CampoLabel htmlFor={inputId}>{c.label}</CampoLabel>
                    <DicaCor>{c.dica}</DicaCor>
                  </TextoCor>
                  <input
                    id={inputId}
                    type="color"
                    value={HEX_LOCAL.test(valorDe(c.key)) ? valorDe(c.key) : "#000000"}
                    onChange={(e) => setCores((p) => ({ ...p, [c.key]: e.target.value }))}
                  />
                  <HexInput
                    aria-label={`Código hexadecimal — ${c.label}`}
                    value={cores[c.key]}
                    placeholder="#RRGGBB"
                    $invalido={!!cores[c.key] && !HEX_LOCAL.test(cores[c.key])}
                    onChange={(e) => setCores((p) => ({ ...p, [c.key]: e.target.value.trim() }))}
                  />
                </LinhaCor>
              )
            })}
          </GridCores>

          {/* Preview fiel: reaproveita rgbaFromHex do resolver real
              (visual-identity.ts), então a transparência de superfície e o
              scrim da sidebar aqui são os MESMOS aplicados em produção —
              não uma aproximação da cor crua. */}
          <PreviewMoldura>
            <PreviewBotao $bg={valorDe("primary")}>Botão primário</PreviewBotao>
            <PreviewCard
              $bg={rgbaFromHex(valorDe("surface"), SURFACE_CARD_ALPHA)}
              $border={rgbaFromHex(valorDe("surface"), 0.55)}
              $t1={valorDe("textPrimary")}
              $t2={valorDe("textSecondary")}
            >
              <strong>Título do card</strong>
              <span>Texto secundário de exemplo dentro da superfície.</span>
              <em style={{ color: valorDe("linkColor") }}>link de exemplo</em>
            </PreviewCard>
            <PreviewSidebarMini $bg={valorDe("sidebar")}>
              <ScrimSidebarMini />
              <ConteudoSidebarMini>
                <span />
                <span />
              </ConteudoSidebarMini>
            </PreviewSidebarMini>
          </PreviewMoldura>
          <PreviewLegenda>
            Este preview aplica a mesma opacidade de superfície e o mesmo escurecimento da sidebar usados no sistema real.
          </PreviewLegenda>

          <BlocoTitulo><ImageIcon size={13} /> Imagens da identidade</BlocoTitulo>
          <GridImagens>
            {CARDS_IMAGEM.map((ci) => {
              const urlAtual = urlEfetiva(ci.tipo)
              const temPendencia = !!pendentes[ci.tipo]
              return (
                <CardImagem key={ci.tipo}>
                  <CardImagemTitulo>
                    {ci.titulo}
                    {temPendencia && <BadgePendente>não salvo</BadgePendente>}
                  </CardImagemTitulo>
                  <PreviewArea $tipo={ci.tipo}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL dinâmica (R2/branding/blob local) */}
                    {urlAtual ? <img src={urlAtual} alt={ci.titulo} /> : <SemImagem>Sem imagem configurada — o padrão neutro será usado</SemImagem>}
                  </PreviewArea>
                  {avisos[ci.tipo] && <AvisoProporcao><AlertTriangle size={12} /> {avisos[ci.tipo]}</AvisoProporcao>}
                  <Rec>{ci.rec}</Rec>
                  <BotoesImagem>
                    <BotaoPequeno>
                      <Upload size={13} /> {urlAtual ? "Trocar" : "Enviar"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(e) => {
                          onSelecionarImagem(ci.tipo, e.target.files?.[0])
                          e.currentTarget.value = ""
                        }}
                      />
                    </BotaoPequeno>
                    <BotaoPequeno as="button" type="button" onClick={() => removerImagem(ci.tipo)} $disabled={!urlAtual}>
                      <Trash2 size={13} /> Remover
                    </BotaoPequeno>
                  </BotoesImagem>
                </CardImagem>
              )
            })}
          </GridImagens>

          {feedback && <Feedback $ok={feedback.ok}>{feedback.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {feedback.msg}</Feedback>}

          <SalvarBtn onClick={salvar} disabled={salvando || carregando}>
            {salvando ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
            {salvando ? "Enviando imagens e salvando…" : "Salvar identidade visual"}
          </SalvarBtn>
        </>
      )}
    </Wrapper>
  )
}

// =====================================================================
// ESTILOS DA SEÇÃO
// =====================================================================

const Wrapper = styled.section`
  margin-top: ${({ theme }) => theme.spacing[6]};
  padding: ${({ theme }) => theme.spacing[5]};
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(10px);
`

const SecaoHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[5]};
`

const IconeSecao = styled.div`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.accent.yellow};
  background: ${({ theme }) => hexToRgba(theme.colors.accent.yellow, 0.14)};
`

const TituloSecao = styled.h2`
  font-size: 1.05rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
`

const SubSecao = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 2px 0 0;
`

const Carregando = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.85rem;
  padding: ${({ theme }) => theme.spacing[4]} 0;
`

const BlocoTitulo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: ${({ theme }) => theme.spacing[4]} 0 ${({ theme }) => theme.spacing[2]};
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.secondary};
`

const CampoLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: 4px;
`

const NomeInput = styled.input`
  width: 100%;
  max-width: 420px;
  padding: 9px 12px;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text.primary};
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: ${({ theme }) => theme.radii.sm};
  outline: none;
  &:focus { border-color: ${({ theme }) => theme.colors.primary.vivid}; }
`

/* Input + contador na mesma linha — o contador mostra o limite do nome
 * (NOME_ORGANIZACAO_MAX) que também é validado pela API. */
const NomeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  max-width: 420px;
`

const ContadorCaracteres = styled.span<{ $excedido: boolean }>`
  flex-shrink: 0;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: ${({ $excedido }) => ($excedido ? "#fbbf24" : "rgba(255, 255, 255, 0.45)")};
`

const GridCores = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
`

const LinhaCor = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`

const CorSwatch = styled.div<{ $cor: string }>`
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 6px;
  background: ${(p) => p.$cor};
  border: 1px solid rgba(255, 255, 255, 0.25);
`

const TextoCor = styled.div`
  flex: 1;
  min-width: 0;
`

const DicaCor = styled.p`
  margin: 1px 0 0;
  font-size: 0.68rem;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text.secondary};
  opacity: 0.75;
`

const HexInput = styled.input<{ $invalido?: boolean }>`
  width: 92px;
  flex-shrink: 0;
  padding: 6px 8px;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: 0.78rem;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text.primary};
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${(p) => (p.$invalido ? "#ef4444" : "rgba(255,255,255,0.12)")};
  border-radius: ${({ theme }) => theme.radii.sm};
  outline: none;
  &:focus { border-color: ${({ theme }) => theme.colors.primary.vivid}; }
`

const PreviewMoldura = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-top: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.12);
`

const PreviewLegenda = styled.p`
  margin: 6px 0 0;
  font-size: 0.68rem;
  color: ${({ theme }) => theme.colors.text.secondary};
  opacity: 0.7;
`

const PreviewBotao = styled.button<{ $bg: string }>`
  align-self: center;
  padding: 10px 18px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #fff;
  background: ${(p) => p.$bg};
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  cursor: default;
`

const PreviewCard = styled.div<{ $bg: string; $border: string; $t1: string; $t2: string }>`
  flex: 1;
  min-width: 200px;
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$border};
  display: flex;
  flex-direction: column;
  gap: 4px;
  strong { font-size: 0.86rem; color: ${(p) => p.$t1}; }
  span { font-size: 0.74rem; color: ${(p) => p.$t2}; }
  em { font-size: 0.76rem; font-style: normal; }
`

// Mesma composição da sidebar real (Aside, em Sidebar.tsx): cor base +
// scrim escuro por cima. Sem isso, o admin via a cor crua e a sidebar
// de verdade ficava sensivelmente mais escura do que o preview prometia.
const PreviewSidebarMini = styled.div<{ $bg: string }>`
  position: relative;
  width: 72px;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${(p) => p.$bg};
  border: 1px solid rgba(255, 255, 255, 0.1);
`

const ScrimSidebarMini = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(10, 22, 40, 0.6) 0%,
    rgba(10, 22, 40, 0.58) 50%,
    rgba(10, 22, 40, 0.68) 100%
  );
`

const ConteudoSidebarMini = styled.div`
  position: relative;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  span { display: block; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.35); }
  span:first-child { width: 60%; }
`

const GridImagens = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
`

const CardImagem = styled.div`
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const CardImagemTitulo = styled.strong`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.83rem;
  color: ${({ theme }) => theme.colors.text.primary};
`

const BadgePendente = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.radii.full};
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.14);
  border: 1px solid rgba(251, 191, 36, 0.35);
`

const PreviewArea = styled.div<{ $tipo: TipoAssetBranding }>`
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);

  /* Preview realista com a MESMA proporção/orientação do uso real */
  ${(p) =>
    p.$tipo === "logo"
      ? `aspect-ratio: 1 / 1;`
      : p.$tipo === "login"
        ? `aspect-ratio: 16 / 9;`
        : `height: 150px; width: 104px;`}

  img {
    width: 100%;
    height: 100%;
    object-fit: ${(p) => (p.$tipo === "logo" ? "contain" : "cover")};
    padding: ${(p) => (p.$tipo === "logo" ? "6px" : "0")};
  }
`

const SemImagem = styled.div`
  width: 100%;
  height: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing[2]};
  font-size: 0.68rem;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.text.secondary};
`

const AvisoProporcao = styled.div`
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.68rem;
  line-height: 1.35;
  color: #fbbf24;
  svg { flex-shrink: 0; margin-top: 1px; }
`

const Rec = styled.p`
  margin: 0;
  font-size: 0.68rem;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.text.secondary};
`

const BotoesImagem = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-top: auto;
`

const BotaoPequeno = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.primary};
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: ${({ theme }) => theme.radii.sm};
  cursor: pointer;
  &:hover { background: rgba(255, 255, 255, 0.12); }
  input { display: none; }
  ${(p) =>
    p.$disabled &&
    `
    opacity: 0.45;
    pointer-events: none;
  `}
`

const Feedback = styled.div<{ $ok: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: ${({ theme }) => theme.spacing[3]};
  padding: 10px 12px;
  font-size: 0.78rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  color: ${(p) => (p.$ok ? "#22c55e" : "#f87171")};
  background: ${(p) => (p.$ok ? "rgba(34,197,94,0.1)" : "rgba(248,113,113,0.1)")};
  border: 1px solid ${(p) => (p.$ok ? "rgba(34,197,94,0.3)" : "rgba(248,113,113,0.3)")};
`

const SalvarBtn = styled.button`
  margin-top: ${({ theme }) => theme.spacing[4]};
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-size: 0.88rem;
  font-weight: 700;
  color: #fff;
  background: ${({ theme }) => theme.colors.primary.vivid};
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  cursor: pointer;
  transition: filter 0.15s ease;
  &:hover:not(:disabled) { filter: brightness(1.12); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`