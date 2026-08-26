import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google"

import StyledComponentsRegistry from "@/lib/registry"
import AppThemeProvider from "@/providers/ThemeProvider"
import QueryProvider from "@/providers/QueryProvider"
import { obterIdentidadeVisual } from "@/lib/configuracoes/identidade-visual"

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

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
})

// Metadados refletem a identidade configurada pelo ADMIN (nome da
// organização). Icons/favicon permanecem assets neutros estáticos.
export async function generateMetadata(): Promise<Metadata> {
  const identidade = await obterIdentidadeVisual()
  const nome = identidade?.nomeOrganizacao?.trim() || "Almoxarifado"

  return {
    title: `${nome} · Sistema de Almoxarifado`,
    description:
      "Sistema interno de controle de estoque, empréstimos, requisições e movimentações.",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: nome,
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
}

// Identidade visual é resolvida POR REQUEST no layout (query dedup via
// react cache). Sem isto, as páginas seriam prerenderizadas estáticas e o
// tema ficaria congelado no build — salvar nova identidade exigiria deploy.
export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  themeColor: "#050a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // UMA query por request (dedup via react cache), tolerante a falha:
  // se a tabela ainda não existir ou o banco cair, renderiza tema default.
  const identidade = await obterIdentidadeVisual()

  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
        <QueryProvider>
          <StyledComponentsRegistry>
            <AppThemeProvider identidade={identidade}>
              {children}
            </AppThemeProvider>
          </StyledComponentsRegistry>
        </QueryProvider>
      </body>
    </html>
  )
}