// src/lib/configuracoes/identidade-visual.ts (SERVER ONLY)
//
// Carrega a ConfiguracaoVisual singleton uma única vez POR REQUEST
// (dedup via react cache()) e devolve o VisualIdentityConfig bruto.
//
// Regras de resiliência (requisito do projeto):
//   - tabela sem registro       → null  → ThemeProvider usa o tema default;
//   - banco indisponível/erros  → null  → app NUNCA quebra por causa da
//     configuração visual (log do erro, render segue com fallback).

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import type { VisualIdentityConfig } from "@/styles/visual-identity"

export const obterIdentidadeVisual = cache(
  async (): Promise<VisualIdentityConfig | null> => {
    try {
      const row = await prisma.configuracaoVisual.findUnique({
        where: { id: "principal" },
      })
      if (!row) return null

      return {
        nomeOrganizacao: row.nomeOrganizacao,
        cores: {
          primary: row.corPrimaria,
          accent: row.corAccent,
          destaque: row.corDestaque,
          background: row.corBackground,
          surface: row.corSurface,
          sidebar: row.corSidebar,
          textPrimary: row.corTextoPrimaria,
          textSecondary: row.corTextoSecundaria,
          linkColor: row.corLink,
        },
        logoUrl: row.logoUrl,
        loginBackgroundUrl: row.loginBackgroundUrl,
        sidebarBackgroundUrl: row.sidebarBackgroundUrl,
      }
    } catch (error) {
      console.error("❌ Falha ao carregar identidade visual (usando tema default):", error)
      return null
    }
  }
)

/** Extrai a key R2 de uma URL do bucket (para deletar o objeto antigo). */
export function extrairKeyR2(url: string | null | undefined): string | null {
  if (!url) return null
  const base = process.env.R2_PUBLIC_URL
  if (base && url.startsWith(`${base}/`)) return url.slice(base.length + 1)
  return null
}

// =====================================================================
// ESCRITA — exclusiva de ADMIN (rota já valida com requireAdmin)
// =====================================================================

import type { Prisma } from "@prisma/client"
import type { IdentidadeVisualPatchInput } from "@/lib/configuracoes/identidade-visual-schema"
import { deletarArquivo } from "@/lib/storage/upload"

function mapearRow(row: {
  nomeOrganizacao: string | null
  corPrimaria: string | null
  corAccent: string | null
  corDestaque: string | null
  corBackground: string | null
  corSurface: string | null
  corSidebar: string | null
  corTextoPrimaria: string | null
  corTextoSecundaria: string | null
  corLink: string | null
  logoUrl: string | null
  loginBackgroundUrl: string | null
  sidebarBackgroundUrl: string | null
}): VisualIdentityConfig {
  return {
    nomeOrganizacao: row.nomeOrganizacao,
    cores: {
      primary: row.corPrimaria,
      accent: row.corAccent,
      destaque: row.corDestaque,
      background: row.corBackground,
      surface: row.corSurface,
      sidebar: row.corSidebar,
      textPrimary: row.corTextoPrimaria,
      textSecondary: row.corTextoSecundaria,
      linkColor: row.corLink,
    },
    logoUrl: row.logoUrl,
    loginBackgroundUrl: row.loginBackgroundUrl,
    sidebarBackgroundUrl: row.sidebarBackgroundUrl,
  }
}

export async function obterConfiguracaoVisual() {
  return obterIdentidadeVisual()
}

/**
 * Upsert da configuração singleton ("principal"). Só escreve campos
 * presentes no patch. Depois de persistir a NOVA referência, remove do
 * R2 — best-effort — o objeto antigo que foi substituído (nunca apaga
 * antes de garantir a gravação, e nunca toca em paths /branding/* locais).
 * Retorna o config re-mapeado ou null em caso de falha de banco.
 */
export async function salvarConfiguracaoVisual(
  patch: IdentidadeVisualPatchInput,
  atualizadoPorId?: string
): Promise<VisualIdentityConfig | null> {
  try {
    const anterior = await prisma.configuracaoVisual.findUnique({
      where: { id: "principal" },
    })

    // Mapeia patch → colunas, apenas chaves definidas
    // (shape plano de valores primitivos — servido para update e create,
    // evitando o union com *FieldOperationsInput do Prisma no spread do create)
    const dados: Record<string, string | null> = {}
    if (patch.nomeOrganizacao !== undefined) dados.nomeOrganizacao = patch.nomeOrganizacao
    if (patch.cores?.primary !== undefined) dados.corPrimaria = patch.cores.primary
    if (patch.cores?.accent !== undefined) dados.corAccent = patch.cores.accent
    if (patch.cores?.destaque !== undefined) dados.corDestaque = patch.cores.destaque
    if (patch.cores?.background !== undefined) dados.corBackground = patch.cores.background
    if (patch.cores?.surface !== undefined) dados.corSurface = patch.cores.surface
    if (patch.cores?.sidebar !== undefined) dados.corSidebar = patch.cores.sidebar
    if (patch.cores?.textPrimary !== undefined) dados.corTextoPrimaria = patch.cores.textPrimary
    if (patch.cores?.textSecondary !== undefined) dados.corTextoSecundaria = patch.cores.textSecondary
    if (patch.cores?.linkColor !== undefined) dados.corLink = patch.cores.linkColor
    if (patch.logoUrl !== undefined) dados.logoUrl = patch.logoUrl
    if (patch.loginBackgroundUrl !== undefined) dados.loginBackgroundUrl = patch.loginBackgroundUrl
    if (patch.sidebarBackgroundUrl !== undefined) dados.sidebarBackgroundUrl = patch.sidebarBackgroundUrl
    if (atualizadoPorId) dados.atualizadoPorId = atualizadoPorId

    const row = await prisma.configuracaoVisual.upsert({
      where: { id: "principal" },
      update: dados as Prisma.ConfiguracaoVisualUncheckedUpdateInput,
      create: {
        id: "principal",
        ...dados,
      } as Prisma.ConfiguracaoVisualUncheckedCreateInput,
    })

    // Limpeza best-effort dos objetos R2 substituídos
    for (const campo of ["logoUrl", "loginBackgroundUrl", "sidebarBackgroundUrl"] as const) {
      const antigo = anterior?.[campo] ?? null
      const novo = row[campo]
      if (antigo && novo && antigo !== novo) {
        const key = extrairKeyR2(antigo)
        if (key) deletarArquivo(key).catch(() => {})
      }
    }

    return mapearRow(row)
  } catch (error) {
    console.error("❌ Falha ao salvar identidade visual:", error)
    return null
  }
}

