// lib/pdf/gerar-recibo-cliente.tsx
"use client"

import type { ReciboAssinaturaProps } from "@/components/pdf/RecibAssinaturaPDF"

const LOGO_FALLBACK = "/branding/logo-default.png"

async function urlParaBase64(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

/** Logo da organização conforme a Identidade Visual (R2 ou fallback). */
async function resolverLogoUrl(): Promise<string> {
  try {
    const res = await fetch("/api/configuracoes/identidade-visual")
    if (!res.ok) return LOGO_FALLBACK
    const { config } = (await res.json()) as { config?: { logoUrl?: string | null } }
    return config?.logoUrl || LOGO_FALLBACK
  } catch {
    return LOGO_FALLBACK
  }
}

export async function gerarEAbrirRecibo(
  props: Omit<ReciboAssinaturaProps, "logoUrl" | "footerLogoUrl">
) {
  const [{ pdf }, { ReciboAssinaturaPDF }, logoUrl] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/RecibAssinaturaPDF"),
    resolverLogoUrl().then(urlParaBase64),
  ])

  // footerLogoUrl foi aposentado junto com o banner proprietário — o
  // componente trata a ausência com renderização condicional.
  const blob = await pdf(
    <ReciboAssinaturaPDF {...props} logoUrl={logoUrl} footerLogoUrl={undefined} />
  ).toBlob()

  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, "_blank")
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}