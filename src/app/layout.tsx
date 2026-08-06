import type { Metadata, Viewport } from "next"
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Almoxarifado",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
}

// Viewport fica separado do metadata — no Next 14+/15+/16, colocar
// themeColor dentro de `metadata` gera warning de build e é ignorado.
export const viewport: Viewport = {
  themeColor: "#0a67c1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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