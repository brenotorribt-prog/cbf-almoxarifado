// lib/gerar-recibo-cliente.tsx
"use client"

import type { ReciboAssinaturaProps } from "@/components/pdf/RecibAssinaturaPDF"

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

export async function gerarEAbrirRecibo(
  props: Omit<ReciboAssinaturaProps, "logoUrl" | "footerLogoUrl">
) {
  const [{ pdf }, { ReciboAssinaturaPDF }, logoUrl, footerLogoUrl] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/RecibAssinaturaPDF"),
    urlParaBase64("/CBFLO.png"),
    urlParaBase64("/CBFTEXT.png"),
  ])

  const blob = await pdf(
    <ReciboAssinaturaPDF {...props} logoUrl={logoUrl} footerLogoUrl={footerLogoUrl} />
  ).toBlob()

  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, "_blank")
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}