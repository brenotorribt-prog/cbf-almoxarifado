"use client"

import { useEffect, useRef, useState } from "react"
import styled, { keyframes } from "styled-components"
import { theme } from "@/styles/theme"
import { FileSpreadsheet, FileText, FileType, ChevronDown, Loader2, CalendarRange } from "lucide-react"

type Formato = "xlsx" | "pdf" | "csv"

interface ExportarComprasButtonProps {
  busca: string
  setor: string
  status: string
  onErro?: (mensagem: string) => void
}

const MAX_DIAS = 31

const FORMATOS: { valor: Formato; label: string; icon: typeof FileSpreadsheet }[] = [
  { valor: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { valor: "pdf", label: "PDF", icon: FileType },
  { valor: "csv", label: "CSV", icon: FileText },
]

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function diasEntre(inicio: string, fim: string) {
  const a = new Date(`${inicio}T00:00:00`)
  const b = new Date(`${fim}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

const spin = keyframes`to { transform: rotate(360deg); }`

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

const Wrapper = styled.div`
  position: relative;
`

const Botao = styled.button`
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
  &:disabled { opacity: 0.6; cursor: not-allowed; }
  svg.spin { animation: ${spin} 0.7s linear infinite; }
`

const Painel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[4]};
  width: 320px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const PainelTitulo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.text.muted};
`

const Presets = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`

const PresetButton = styled.button<{ $active: boolean }>`
  padding: 5px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary.vivid : theme.colors.surface.border)};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary.vivid : theme.colors.text.secondary)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface.glass : "transparent")};
`

const DatasRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing[2]};
`

const DateInput = styled.input`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  width: 100%;
`

const AvisoPeriodo = styled.span<{ $erro: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme, $erro }) => ($erro ? theme.colors.status.error : theme.colors.text.muted)};
`

const Divisor = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.surface.border};
`

const FormatosLista = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const OpcaoItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.sm};
  text-align: left;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};

  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.surface.sidebarActive}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
`

export default function ExportarComprasButton({ busca, setor, status, onErro }: ExportarComprasButtonProps) {
  const [aberto, setAberto] = useState(false)
  const [preset, setPreset] = useState<"hoje" | "7dias" | "mes" | "personalizado">("hoje")
  const [dataInicio, setDataInicio] = useState(hojeISO())
  const [dataFim, setDataFim] = useState(hojeISO())
  const [exportando, setExportando] = useState<Formato | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener("mousedown", handleClickFora)
    return () => document.removeEventListener("mousedown", handleClickFora)
  }, [])

  function aplicarPreset(novo: "hoje" | "7dias" | "mes") {
    setPreset(novo)
    const fim = hojeISO()
    const inicio = new Date()
    if (novo === "7dias") inicio.setDate(inicio.getDate() - 6)
    if (novo === "mes") inicio.setDate(inicio.getDate() - 29) // fica dentro do limite de 31
    setDataInicio(novo === "hoje" ? fim : inicio.toISOString().slice(0, 10))
    setDataFim(fim)
  }

  const dias = diasEntre(dataInicio, dataFim)
  const periodoInvalido = dias < 0 || dias > MAX_DIAS

  async function exportar(formato: Formato) {
    if (periodoInvalido) return
    setExportando(formato)
    try {
      const params = new URLSearchParams({ formato, dataInicio, dataFim })
      if (busca) params.set("busca", busca)
      if (setor) params.set("setor", setor)
      if (status !== "TODOS") params.set("status", status)

      const res = await fetch(`/api/compras/exportar?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Falha ao exportar pedidos.")
      }

      const blob = await res.blob()
      const nomeArquivo =
        res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? `pedidos-compra.${formato}`

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = nomeArquivo
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setAberto(false)
    } catch (err) {
      onErro?.(err instanceof Error ? err.message : "Erro ao exportar pedidos.")
    } finally {
      setExportando(null)
    }
  }

  return (
    <Wrapper ref={wrapperRef}>
      <Botao type="button" onClick={() => setAberto((v) => !v)} disabled={exportando !== null}>
        {exportando ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
        Exportar
        <ChevronDown size={14} />
      </Botao>

      {aberto && (
        <Painel>
          <PainelTitulo>
            <CalendarRange size={13} />
            Período (máx. {MAX_DIAS} dias)
          </PainelTitulo>

          <Presets>
            <PresetButton type="button" $active={preset === "hoje"} onClick={() => aplicarPreset("hoje")}>
              Hoje
            </PresetButton>
            <PresetButton type="button" $active={preset === "7dias"} onClick={() => aplicarPreset("7dias")}>
              Últimos 7 dias
            </PresetButton>
            <PresetButton type="button" $active={preset === "mes"} onClick={() => aplicarPreset("mes")}>
              Últimos 30 dias
            </PresetButton>
            <PresetButton
              type="button"
              $active={preset === "personalizado"}
              onClick={() => setPreset("personalizado")}
            >
              Personalizado
            </PresetButton>
          </Presets>

          <DatasRow>
            <DateInput
              type="date"
              value={dataInicio}
              max={dataFim}
              onChange={(e) => {
                setPreset("personalizado")
                setDataInicio(e.target.value)
              }}
            />
            <DateInput
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => {
                setPreset("personalizado")
                setDataFim(e.target.value)
              }}
            />
          </DatasRow>

          <AvisoPeriodo $erro={periodoInvalido}>
            {dias < 0
              ? "Data inicial não pode ser depois da final."
              : periodoInvalido
              ? `Período de ${dias} dias excede o limite de ${MAX_DIAS}.`
              : `${dias + 1} dia(s) selecionado(s).`}
          </AvisoPeriodo>

          <Divisor />

          <FormatosLista>
            {FORMATOS.map(({ valor, label, icon: Icon }) => (
              <OpcaoItem
                key={valor}
                type="button"
                disabled={exportando !== null || periodoInvalido}
                onClick={() => exportar(valor)}
              >
                <Icon size={14} />
                {label}
              </OpcaoItem>
            ))}
          </FormatosLista>
        </Painel>
      )}
    </Wrapper>
  )
}