// src/components/relatorios/filtro-periodo.tsx
//
// Seletor de período da página de Relatórios.
// Presets: Hoje, Últimos 7/30 dias, Mês atual, Mês anterior e Personalizado.
// Padrão visual herdado dos PresetButton de src/components/compras/exportar-button.tsx,
// mas em barra visível (o período controla a página inteira, não só um download).

"use client"

import styled from "styled-components"
import { CalendarRange } from "lucide-react"

// =====================================================================
// TIPOS E HELPERS DE DATA (timezone-safe — nunca usar toISOString p/ datas locais)
// =====================================================================

export type PresetPeriodo =
  | "hoje"
  | "7dias"
  | "30dias"
  | "mesAtual"
  | "mesAnterior"
  | "personalizado"

export interface ValorPeriodo {
  preset: PresetPeriodo
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
}

/** Converte Date local para YYYY-MM-DD sem deslocamento de fuso. */
export function paraISO(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function hojeISO(): string {
  return paraISO(new Date())
}

/** Resolve as datas de um preset. Retorna null para "personalizado". */
export function resolverPreset(preset: PresetPeriodo): { dataInicio: string; dataFim: string } | null {
  const fim = hojeISO()

  if (preset === "hoje") return { dataInicio: fim, dataFim: fim }

  if (preset === "7dias" || preset === "30dias") {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - (preset === "7dias" ? 6 : 29))
    return { dataInicio: paraISO(inicio), dataFim: fim }
  }

  if (preset === "mesAtual") {
    const inicio = new Date()
    inicio.setDate(1)
    return { dataInicio: paraISO(inicio), dataFim: fim }
  }

  if (preset === "mesAnterior") {
    const inicio = new Date()
    inicio.setDate(1)
    inicio.setMonth(inicio.getMonth() - 1)
    const fimMesAnterior = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0)
    return { dataInicio: paraISO(inicio), dataFim: paraISO(fimMesAnterior) }
  }

  return null
}

export interface ValidacaoPeriodo {
  valido: boolean
  mensagem: string
}

/** Valida o intervalo selecionado (usado pela página para travar consultas). */
export function validarPeriodo(dataInicio: string, dataFim: string): ValidacaoPeriodo {
  const inicio = new Date(`${dataInicio}T00:00:00`)
  const fim = new Date(`${dataFim}T23:59:59`)

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    return { valido: false, mensagem: "Datas inválidas." }
  }
  if (inicio > fim) {
    return { valido: false, mensagem: "A data inicial não pode ser depois da final." }
  }
  return { valido: true, mensagem: "" }
}

// =====================================================================
// COMPONENTE
// =====================================================================

interface FiltroPeriodoProps {
  valor: ValorPeriodo
  onChange: (valor: ValorPeriodo) => void
}

const PRESETS: { valor: Exclude<PresetPeriodo, "personalizado">; label: string }[] = [
  { valor: "hoje", label: "Hoje" },
  { valor: "7dias", label: "Últimos 7 dias" },
  { valor: "30dias", label: "Últimos 30 dias" },
  { valor: "mesAtual", label: "Mês atual" },
  { valor: "mesAnterior", label: "Mês anterior" },
]

export default function FiltroPeriodo({ valor, onChange }: FiltroPeriodoProps) {
  function selecionarPreset(preset: Exclude<PresetPeriodo, "personalizado">) {
    const datas = resolverPreset(preset)
    if (!datas) return
    onChange({ preset, ...datas })
  }

  function alterarData(campo: "dataInicio" | "dataFim", novoValor: string) {
    onChange({
      preset: "personalizado",
      dataInicio: campo === "dataInicio" ? novoValor : valor.dataInicio,
      dataFim: campo === "dataFim" ? novoValor : valor.dataFim,
    })
  }

  const validacao = validarPeriodo(valor.dataInicio, valor.dataFim)

  return (
    <Wrapper>
      <Titulo>
        <CalendarRange size={13} />
        Período de análise
      </Titulo>

      <Presets>
        {PRESETS.map(({ valor: presetValor, label }) => (
          <PresetButton
            key={presetValor}
            type="button"
            $active={valor.preset === presetValor}
            onClick={() => selecionarPreset(presetValor)}
          >
            {label}
          </PresetButton>
        ))}
        <PresetButton
          type="button"
          $active={valor.preset === "personalizado"}
          onClick={() => onChange({ ...valor, preset: "personalizado" })}
        >
          Personalizado
        </PresetButton>
      </Presets>

      <DatasRow>
        <DateInput
          type="date"
          aria-label="Data inicial"
          value={valor.dataInicio}
          max={valor.dataFim}
          onChange={(e) => alterarData("dataInicio", e.target.value)}
        />
        <span className="ate">até</span>
        <DateInput
          type="date"
          aria-label="Data final"
          value={valor.dataFim}
          min={valor.dataInicio}
          onChange={(e) => alterarData("dataFim", e.target.value)}
        />
      </DatasRow>

      {!validacao.valido && <AvisoErro>{validacao.mensagem}</AvisoErro>}
    </Wrapper>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

// glassCardStyles replicado das demais páginas (padrão visual compartilhado
// do projeto — ver dashboard/page.tsx e compras/exportar-button.tsx)
const glassCardStyles = `
  background: rgba(3,7,18,0.82);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
`

const Wrapper = styled.div`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const Titulo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.text.muted};

  svg { flex-shrink: 0; }
`

const Presets = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`

const PresetButton = styled.button<{ $active: boolean }>`
  padding: 5px 12px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px solid ${({ theme, $active }) =>
    $active ? theme.colors.primary.vivid : theme.colors.surface.border};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary.vivid : theme.colors.text.secondary};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface.glass : "transparent")};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

const DatasRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};

  .ate {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
  }
`

const DateInput = styled.input`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-family: inherit;
  width: 160px;
  color-scheme: dark;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.vivid};
  }
`

const AvisoErro = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.error};
`
