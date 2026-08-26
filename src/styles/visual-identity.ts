// src/styles/visual-identity.ts
//
// Camada de resolução entre a IDENTIDADE VISUAL persistida (VisualIdentity)
// e o Theme FINAL consumido pelos componentes. Client-safe (sem imports de
// servidor/prisma) para rodar tanto no processo SSR quanto no client, sem
// hydration mismatch.
//
// Conceito:
//   defaultTheme (src/styles/theme.ts)
//      +
//   visualIdentity (opcional, vinda do banco)
//      =
//   resolvedTheme (mesma shape de Theme — componentes NÃO mudam)
//
// É OBRIGATÓRIO preservar:
//  - colors.status.*        (semânticas — sucesso/erro/aviso/info)
//  - colors.specialty       (fallback de marca por especialidade)
//  - colors.avatarPalette   (distinção de avatar)
//  - typography, spacing, radii, shadows, transitions, zIndex, ... (estruturais)

// ---------------------------------------------------------------
// Tipos compartilhados (client-safe)
// ---------------------------------------------------------------
export interface VisualColorsConfig {
  primary?: string | null
  accent?: string | null
  destaque?: string | null
  background?: string | null
  surface?: string | null
  sidebar?: string | null
  textPrimary?: string | null
  textSecondary?: string | null
  linkColor?: string | null
}

export interface VisualIdentityConfig {
  nomeOrganizacao?: string | null
  cores?: VisualColorsConfig | null
  logoUrl?: string | null
  loginBackgroundUrl?: string | null
  sidebarBackgroundUrl?: string | null
}

import { theme as defaultTheme } from "./theme"
import type { Theme } from "./theme"

// ---------------------------------------------------------------
// Helpers de cor (determinísticos, puros — testáveis)
// ---------------------------------------------------------------

const HEX_RE = /^#([0-9a-fA-F]{6})$/

/** Valida se é um hex de 6 dígitos. */
export function isHexColor(valor: string | null | undefined): valor is string {
  return typeof valor === "string" && HEX_RE.test(valor.trim())
}

/** Normaliza para #rrggbb (aceita #RGB curto). */
export function normalizeHex(valor: string): string {
  let v = valor.trim()
  if (/^#([0-9a-fA-F]{3})$/.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  }
  return v.toLowerCase()
}

/**
 * Escurece/clareia um hex (percent -1..1). percent<0 escurece, >0 clareia.
 * Determinístico e puro — usado pra derivar tokens de marca (deep/light)
 * sem depender de lib externa.
 */
export function shadeHex(hex: string, percent: number): string {
  let v = hex.replace("#", "")
  if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2]
  const r = parseInt(v.substring(0, 2), 16)
  const g = parseInt(v.substring(2, 4), 16)
  const b = parseInt(v.substring(4, 6), 16)
  const alvo = percent < 0 ? 0 : 255
  const p = Math.min(1, Math.abs(percent))
  const nr = Math.round((alvo - r) * p + r)
  const ng = Math.round((alvo - g) * p + g)
  const nb = Math.round((alvo - b) * p + b)
  return `#${((nr << 16) | (ng << 8) | nb).toString(16).padStart(6, "0")}`
}

/** Converte hex #rrggbb em rgba com alpha. */
export function rgbaFromHex(hex: string, alpha: number): string {
  let v = hex.replace("#", "")
  if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2]
  const r = parseInt(v.substring(0, 2), 16)
  const g = parseInt(v.substring(2, 4), 16)
  const b = parseInt(v.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ---------------------------------------------------------------
// Resolução do tema final
// ---------------------------------------------------------------
export function resolveVisualTheme(config: VisualIdentityConfig | null | undefined): Theme {
  // Sem configuração persistida → default puro.
  if (!config) return defaultTheme as Theme

  const c = config.cores ?? {}
  const primaria = c.primary && isHexColor(c.primary) ? c.primary.trim() : null
  const accent = (c.accent && isHexColor(c.accent) ? c.accent.trim() : null) ?? primaria
  const destaque = c.destaque && isHexColor(c.destaque) ? c.destaque.trim() : ""
  const background = c.background && isHexColor(c.background) ? c.background.trim() : ""
  const surfaceC = c.surface && isHexColor(c.surface) ? c.surface.trim() : ""
  const sidebar = c.sidebar && isHexColor(c.sidebar) ? c.sidebar.trim() : ""
  const textP = c.textPrimary && isHexColor(c.textPrimary) ? c.textPrimary.trim() : ""
  const textS = c.textSecondary && isHexColor(c.textSecondary) ? c.textSecondary.trim() : ""
  const link = c.linkColor && isHexColor(c.linkColor) ? c.linkColor.trim() : ""

  const colors = defaultTheme.colors
  const resolved = {
    ...defaultTheme,
    colors: {
      ...colors,
      brand: {
        nomeOrganizacao: config.nomeOrganizacao?.trim() || defaultTheme.colors.brand.nomeOrganizacao,
        logoUrl: config.logoUrl?.trim() || defaultTheme.colors.brand.logoUrl,
        loginBackgroundUrl:
          config.loginBackgroundUrl?.trim() || defaultTheme.colors.brand.loginBackgroundUrl,
        sidebarBackgroundUrl:
          config.sidebarBackgroundUrl?.trim() || defaultTheme.colors.brand.sidebarBackgroundUrl,
      },
      primary: primaria
        ? {
            deep: shadeHex(primaria, -0.45),
            vivid: primaria,
            light: shadeHex(primaria, 0.82),
            lightHover: shadeHex(primaria, 0.7),
          }
        : colors.primary,
      accent: {
        yellow: destaque || colors.accent.yellow,
        yellowDark: destaque ? shadeHex(destaque, -0.45) : colors.accent.yellowDark,
        green: accent || colors.accent.green,
        greenDark: accent ? shadeHex(accent, -0.45) : colors.accent.greenDark,
      },
      surface: {
        ...colors.surface,
        background: background || colors.surface.background,
        card: surfaceC ? rgbaFromHex(surfaceC, 0.86) : colors.surface.card,
        border: surfaceC ? rgbaFromHex(surfaceC, 0.55) : colors.surface.border,
        sidebar: sidebar || colors.surface.sidebar,
        sidebarActive: sidebar ? shadeHex(sidebar, 0.28) : colors.surface.sidebarActive,
        header: sidebar || colors.surface.header,
      },
      text: {
        ...colors.text,
        primary: textP || colors.text.primary,
        secondary: textS || colors.text.secondary,
        onDark: textP || colors.text.onDark,
        link: link || colors.text.link,
        linkHover: link ? shadeHex(link, 0.45) : colors.text.linkHover,
      },
    },
  }
  return resolved as Theme
}
