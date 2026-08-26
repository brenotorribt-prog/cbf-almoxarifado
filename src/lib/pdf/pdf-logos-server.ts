// src/lib/pdf/pdf-logos-server.ts
//
// Logos usados no cabeçalho dos PDFs gerados pelo sistema.
// ORIGEM DA IDENTIDADE (ordem de precedência):
//   1. Logo configurada pelo ADMIN na Identidade Visual (URL do R2 ou
//      caminho interno /branding/*)
//   2. Fallback neutro versionado: public/branding/logo-default.png
//
// Nenhum asset proprietário (CBFLO/CBFTEXT) é mais referenciado. O rodapé
// imageado foi removido — os componentes PDF tratam footerLogoUrl ausente
// com renderização condicional já existente.

import fs from "fs"
import path from "path"
import { obterIdentidadeVisual } from "@/lib/configuracoes/identidade-visual"

function getImageBase64(caminhoRelativoPublic: string): string | null {
  try {
    const fullPath = path.join(process.cwd(), "public", caminhoRelativoPublic)
    if (!fs.existsSync(fullPath)) return null

    const buffer = fs.readFileSync(fullPath)
    const ext = path.extname(caminhoRelativoPublic).substring(1) // png, jpg...
    return `data:image/${ext};base64,${buffer.toString("base64")}`
  } catch (error) {
    console.error("Erro ao ler imagem do branding:", error)
    return null
  }
}

async function baixarComoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/png"
    return `data:${mime};base64,${buffer.toString("base64")}`
  } catch {
    return null
  }
}

const LOGO_DEFAULT = "branding/logo-default.png"

export interface LogosPdf {
  logoUrl?: string
  footerLogoUrl?: string
}

/**
 * Resolve o logo para os PDFs conforme a identidade visual persistida.
 * Sempre assíncrono (pode baixar a logo do R2). Nunca lança: qualquer
 * falha degrada para o fallback neutro ou para logo ausente.
 */
export async function carregarLogosPdf(): Promise<LogosPdf> {
  try {
    const identidade = await obterIdentidadeVisual()
    const origem = identidade?.logoUrl?.trim() || null

    if (!origem) {
      return { logoUrl: getImageBase64(LOGO_DEFAULT) ?? undefined }
    }

    if (/^https?:\/\//i.test(origem)) {
      const baixada = await baixarComoDataUrl(origem)
      return { logoUrl: baixada ?? getImageBase64(LOGO_DEFAULT) ?? undefined }
    }

    // Caminho interno tipo "/branding/x.png"
    return { logoUrl: getImageBase64(origem.replace(/^\//, "")) ?? undefined }
  } catch {
    return { logoUrl: getImageBase64(LOGO_DEFAULT) ?? undefined }
  }
}