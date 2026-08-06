"use client"

import { ThemeProvider } from "styled-components"
import { theme } from "@/styles/theme"
import { GlobalStyles } from "@/styles/GlobalStyles"

interface Props {
  children: React.ReactNode
}

export default function AppThemeProvider({ children }: Props) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {children}
    </ThemeProvider>
  )
}