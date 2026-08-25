// src/components/relatorios/exportar-button.tsx
//
// Botão de exportação do relatório (xlsx/csv/pdf).
// O período e os filtros vêm da página — o dropdown só escolhe o formato.
// Fluxo de download idêntico ao de src/components/compras/exportar-button.tsx.

"use client"

import { useEffect, useRef, useState } from "react"
import styled, { keyframes } from "styled-components"
import { theme } from "@/styles/theme"
import { FileSpreadsheet, FileText, FileType, ChevronDown, Loader2 } from "lucide-react"

type Formato = "xlsx" | "pdf" | "csv"

interface ExportarRelatorioButtonProps {
  /** Query params já montados pela página (dataInicio, dataFim, categoriaId, tipo). */
  queryString: string
  disabled?: boolean
  onErro?: (mensagem: string) => void
}

const FORMATOS: { valor: Formato; label: string; icon: typeof FileSpreadsheet }[] = [
  { valor: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { valor: "pdf", label: "PDF", icon: FileType },
  { valor: "csv", label: "CSV", icon: FileText },
]

const spin = keyframes`to { transform: rotate(360deg); }`

export default function ExportarRelatorioButton({
  queryString,
  disabled = false,
  onErro,
}: ExportarRelatorioButtonProps) {
  const [aberto, setAberto] = useState(false)
  const [exportando, setExportando] = useState<Formato | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener("mousedown", handleClickFora)
    return () => document.removeEventListener("mousedown", handleClickFora)
  }, [])

  async function exportar(formato: Formato) {
    setExportando(formato)
    try {
      const res = await fetch(`/api/relatorios/exportar?formato=${formato}&${queryString}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Falha ao exportar o relatório.")
      }

      const blob = await res.blob()
      const nomeArquivo =
        res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
        `relatorio-movimentacoes.${formato}`

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
      onErro?.(err instanceof Error ? err.message : "Erro ao exportar o relatório.")
    } finally {
      setExportando(null)
    }
  }

  return (
    <Wrapper ref={wrapperRef}>
      <Botao
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={disabled || exportando !== null}
      >
        {exportando ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
        Exportar
        <ChevronDown size={14} />
      </Botao>

      {aberto && (
        <Painel>
          <FormatosLista>
            {FORMATOS.map(({ valor, label, icon: Icon }) => (
              <OpcaoItem
                key={valor}
                type="button"
                disabled={exportando !== null || disabled}
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
  padding: ${({ theme }) => theme.spacing[3]};
  width: 200px;
  z-index: 30;
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
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.sm};
  text-align: left;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};

  &:hover:not(:disabled) { background: ${({ theme }) => theme.colors.surface.sidebarActive}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
`