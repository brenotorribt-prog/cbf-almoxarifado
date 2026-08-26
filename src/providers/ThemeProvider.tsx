"use client"

import { useMemo } from "react"
import { ThemeProvider } from "styled-components"
import { resolveVisualTheme, type VisualIdentityConfig } from "@/styles/visual-identity"
import { GlobalStyles } from "@/styles/GlobalStyles"

interface Props {
  children: React.ReactNode
  /**
   * Identidade visual persistida, carregada uma vez no root layout
   * (server) e hidratada aqui. `null`/`undefined` = usa o tema default.
   * A resolução acontece ANTES da primeira pintura — sem flash de tema.
   */
  identidade?: VisualIdentityConfig | null
}

export default function AppThemeProvider({ children, identidade }: Props) {
  // Resolve default + configuração → Theme final UMA vez por mudança de
  // config. A shape do objeto é idêntica à do tema estático, então nenhum
  // componente consumidor precisa saber de onde o tema veio.
  const resolvedTheme = useMemo(() => resolveVisualTheme(identidade), [identidade])

  return (
    <ThemeProvider theme={resolvedTheme}>
      <GlobalStyles />
      {children}
    </ThemeProvider>
  )
}