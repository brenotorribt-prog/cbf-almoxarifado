// src/lib/pdf-logos-server.ts
//
// Carrega os logos institucionais usados no padrão dos PDFs:
// - Cabeçalho: CBFLO.png
// - Rodapé:    CBFTEXT.png
//
// Lê os arquivos da pasta public/ e converte para Base64 (data URL),
// mesmo mecanismo já usado em src/app/api/pdf/route.ts. Centralizado aqui
// para que qualquer exportação de relatório em PDF gere o documento com
// o cabeçalho/rodapé padronizado.

import fs from "fs"
import path from "path"

function getImageBase64(filePath: string): string | null {
  try {
    const fullPath = path.join(process.cwd(), "public", filePath)
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Logo não encontrado: ${filePath}`)
      return null
    }

    const buffer = fs.readFileSync(fullPath)
    const ext = path.extname(filePath).substring(1) // png, jpg, etc
    return `data:image/${ext};base64,${buffer.toString("base64")}`
  } catch (error) {
    console.error(`❌ Erro ao ler logo ${filePath}:`, error)
    return null
  }
}

export interface LogosPdf {
  logoUrl?: string
  footerLogoUrl?: string
}

export function carregarLogosPdf(): LogosPdf {
  return {
    logoUrl: getImageBase64("CBFLO.png") ?? undefined,
    footerLogoUrl: getImageBase64("CBFTEXT.png") ?? undefined,
  }
}