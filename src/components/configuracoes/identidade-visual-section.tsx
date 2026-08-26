"use client"

/**
 * Configurações → Identidade visual (visível SOMENTE para ADMIN).
 * Cores + nome da organização + uploads R2 para logo e backgrounds,
 * com previews realistas (login 16:9, sidebar vertical) e warnings de
 * proporção calculados no cliente antes do upload.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import styled from "styled-components"
import {
  Building2, Palette, Image as ImageIcon, Upload, Trash2, Save,
  Loader2, AlertTriangle, CheckCircle2,
} from "lucide-react"
import {
  validarArquivoImagem,
  sugerirProporcao,
  type TipoAssetBranding,
} from "@/lib/configuracoes/identidade-visual-schema"
import { hexToRgba } from "@/styles/theme"

const CAMPOS_COR = [
  { key: "primary", label: "Cor primária" },
  { key: "accent", label: "Cor secundária / accent" },
  { key: "destaque", label: "Cor de destaque" },
  { key: "background", label: "Background principal" },
  { key: "surface", label: "Superfícies / cards" },
  { key: "sidebar", label: "Sidebar" },
  { key: "textPrimary", label: "Texto principal" },
  { key: "textSecondary", label: "Texto secundário" },
  { key: "linkColor", label: "Links" },
] as const

type CampoCorKey = (typeof CAMPOS_COR)[number]["key"]
type CoresForm = Record<CampoCorKey, string>
const HEX_LOCAL = /^#[0-9a-fA-F]{6}$/

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

export function SecaoIdentidadeVisual() {
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState<TipoAssetBranding | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const [nome, setNome] = useState("")
  const [cores, setCores] = useState<CoresForm>(
    () => Object.fromEntries(CAMPOS_COR.map((c) => [c.key, ""])) as CoresForm
  )
  const [imagens, setImagens] = useState<ImagensForm>({ logoUrl: "", loginBackgroundUrl: "", sidebarBackgroundUrl: "" })
  const [avisos, setAvisos] = useState<Partial<Record<TipoAssetBranding, string>>>({})

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

  async function onSelecionarImagem(tipo: TipoAssetBranding, file: File | undefined) {
    if (!file) return
    const erro = validarArquivoImagem(file.type, file.size)
    if (erro) {
      setFeedback({ ok: false, msg: erro })
      return
    }

    // Warning de proporção (não bloqueia) calculado no cliente
    const urlObj = URL.createObjectURL(file)
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
      URL.revokeObjectURL(urlObj)
    }
    img.src = urlObj

    setEnviando(tipo)
    try {
      const fd = new FormData()
      fd.set("arquivo", file)
      fd.set("tipo", tipo)
      const res = await fetch("/api/configuracoes/identidade-visual/upload", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Falha no upload")
      setImagens((prev) => ({ ...prev, [`${tipo === "logo" ? "logoUrl" : tipo === "login" ? "loginBackgroundUrl" : "sidebarBackgroundUrl"}`]: data.url }))
      setFeedback({ ok: true, msg: "Imagem enviada. Clique em Salvar para aplicar." })
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Falha no upload" })
    } finally {
      setEnviando(null)
    }
  }
  async function salvar() {
    setSalvando(true)
    setFeedback(null)
    try {
      const body = {
        nomeOrganizacao: nome.trim() ? nome.trim() : null,
        cores: Object.fromEntries(
          CAMPOS_COR.map((c) => [c.key, HEX_LOCAL.test(cores[c.key]) ? cores[c.key] : null])
        ),
        logoUrl: imagens.logoUrl || null,
        loginBackgroundUrl: imagens.loginBackgroundUrl || null,
        sidebarBackgroundUrl: imagens.sidebarBackgroundUrl || null,
      }
      const res = await fetch("/api/configuracoes/identidade-visual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar")
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
          <NomeInput value={nome} maxLength={80} placeholder="Ex.: Minha Organização" onChange={(e) => setNome(e.target.value)} />

          <BlocoTitulo><Palette size={13} /> Cores</BlocoTitulo>
          <GridCores>
            {CAMPOS_COR.map((c) => (
              <LinhaCor key={c.key}>
                <CorSwatch $cor={valorDe(c.key)} />
                <LabelCor>{c.label}</LabelCor>
                <input type="color" value={HEX_LOCAL.test(valorDe(c.key)) ? valorDe(c.key) : "#000000"} onChange={(e) => setCores((p) => ({ ...p, [c.key]: e.target.value }))} />
                <HexInput value={cores[c.key]} placeholder="#RRGGBB" $invalido={!!cores[c.key] && !HEX_LOCAL.test(cores[c.key])} onChange={(e) => setCores((p) => ({ ...p, [c.key]: e.target.value.trim() }))} />
              </LinhaCor>
            ))}
          </GridCores>

          <PreviewMoldura>
            <PreviewBotao $bg={valorDe("primary")}>Botão primário</PreviewBotao>
            <PreviewCard $bg={valorDe("surface")} $t1={valorDe("textPrimary")} $t2={valorDe("textSecondary")}>
              <strong>Título do card</strong>
              <span>Texto secundário de exemplo dentro da superfície.</span>
              <em style={{ color: valorDe("linkColor") }}>link de exemplo</em>
            </PreviewCard>
            <PreviewSidebarMini $bg={valorDe("sidebar")}><span /><span /><span /></PreviewSidebarMini>
          </PreviewMoldura>

          <BlocoTitulo><ImageIcon size={13} /> Imagens da identidade</BlocoTitulo>
          <GridImagens>
            {CARDS_IMAGEM.map((ci) => {
              const campo = mapearCampoImagem(ci.tipo)
              return (
                <CardImagem key={ci.tipo}>
                  <CardImagemTitulo>{ci.titulo}</CardImagemTitulo>
                  <PreviewArea $tipo={ci.tipo}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL dinâmica (R2/branding) */}
                    {imagens[campo] ? <img src={imagens[campo]} alt={ci.titulo} /> : <SemImagem>Sem imagem configurada — o padrão neutro será usado</SemImagem>}
                  </PreviewArea>
                  {avisos[ci.tipo] && <AvisoProporcao><AlertTriangle size={12} /> {avisos[ci.tipo]}</AvisoProporcao>}
                  <Rec>{ci.rec}</Rec>
                  <BotoesImagem>
                    <BotaoPequeno>
                      {enviando === ci.tipo ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} Enviar
                      <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onSelecionarImagem(ci.tipo, e.target.files?.[0]); e.currentTarget.value = "" }} />
                    </BotaoPequeno>
                    <BotaoPequeno onClick={() => { setImagens((p) => ({ ...p, [campo]: "" })); setAvisos((a) => ({ ...a, [ci.tipo]: undefined })) }} $disabled={!imagens[campo]}>
                      <Trash2 size={13} /> Remover
                    </BotaoPequeno>
                  </BotoesImagem>
                </CardImagem>
              )
            })}
          </GridImagens>

          {feedback && <Feedback $ok={feedback.ok}>{feedback.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {feedback.msg}</Feedback>}

          <SalvarBtn onClick={salvar} disabled={salvando || carregando}>
            {salvando ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar identidade visual
          </SalvarBtn>
        </>
      )}
    </Wrapper>
  )
}

function mapearCampoImagem(t: TipoAssetBranding): keyof ImagensForm {
  if (t === "logo") return "logoUrl"
  if (t === "login") return "loginBackgroundUrl"
  return "sidebarBackgroundUrl"
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

const GridCores = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[4]};
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

const LabelCor = styled.span`
  flex: 1;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text.primary};
`

const HexInput = styled.input<{ $invalido?: boolean }>`
  width: 92px;
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

const PreviewCard = styled.div<{ $bg: string; $t1: string; $t2: string }>`
  flex: 1;
  min-width: 200px;
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${(p) => p.$bg};
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  strong { font-size: 0.86rem; color: ${(p) => p.$t1}; }
  span { font-size: 0.74rem; color: ${(p) => p.$t2}; }
  em { font-size: 0.76rem; font-style: normal; }
`

const PreviewSidebarMini = styled.div<{ $bg: string }>`
  width: 72px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${(p) => p.$bg};
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  font-size: 0.83rem;
  color: ${({ theme }) => theme.colors.text.primary};
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