import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"

import StyledComponentsRegistry from "@/lib/registry"
import AppThemeProvider from "@/providers/ThemeProvider"
import QueryProvider from "@/providers/QueryProvider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: "CBF Almoxarifado",
  description: "Sistema interno de controle de estoque - CBF",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable}`}
      >
        <QueryProvider>
          <StyledComponentsRegistry>
            <AppThemeProvider>
              {children}
            </AppThemeProvider>
          </StyledComponentsRegistry>
        </QueryProvider>
      </body>
    </html>
  )
}