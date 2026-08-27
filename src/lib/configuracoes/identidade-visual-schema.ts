import { z } from "zod"

// =====================================================================
// Validação da identidade visual — servidor é a autoridade final.
//
// Cores: APENAS #RRGGBB. Isso elimina por construção qualquer vetor de
// injeção de CSS (url(...), var(...), calc(...), expressões, nomes de
// função...) — o valor validado é concatenável com segurança no tema.
// URLs de imagem: caminho interno /branding/* ou URL http(s) pública do R2.
// =====================================================================

export const HEX_RE = /^#[0-9a-fA-F]{6}$/

export const hexColorNullable = z
  .string()
  .trim()
  .regex(HEX_RE, "Cor inválida — use o formato hexadecimal #RRGGBB")
  .nullable()

/**
 * Teto de caracteres do nome da organização. O nome é exibido como
 * `BrandName` na sidebar (e no login) — acima disso o layout corta o texto.
 * Fonte ÚNICA de verdade: o schema da API valida com este valor e o front
 * usa no `maxLength` do input e no contador (sem duplicar números mágicos).
 */
export const NOME_ORGANIZACAO_MAX = 11


export const nomeOrganizacaoSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da organização")
  .max(NOME_ORGANIZACAO_MAX, `Máximo de ${NOME_ORGANIZACAO_MAX} caracteres`)

/**
 * Aceita referências de imagem que a aplicação conhece:
 *  - "/branding/<arquivo>"        → asset neutro versionado no repo
 *  - "<R2_PUBLIC_URL>/branding/…", https(s)://… → objeto enviado pelo ADMIN
 * Bloqueia javascript:, data:, e qualquer outra scheme.
 */
export function isUrlImagemValida(valor: string): boolean {
  if (valor.startsWith("/branding/") && valor.length < 300) return true
  try {
    const u = new URL(valor)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

export const urlImagemNullable = z
  .string()
  .trim()
  .max(2048, "URL muito longa")
  .refine(isUrlImagemValida, {
    message: "URL deve ser um caminho /branding/ ou uma URL http(s) válida",
  })
  .nullable()

export const coresSchema = z
  .object({
    primary: hexColorNullable,
    accent: hexColorNullable,
    destaque: hexColorNullable,
    background: hexColorNullable,
    surface: hexColorNullable,
    sidebar: hexColorNullable,
    textPrimary: hexColorNullable,
    textSecondary: hexColorNullable,
    linkColor: hexColorNullable,
  })
  .partial()

export const identidadeVisualPatchSchema = z
  .object({
    nomeOrganizacao: nomeOrganizacaoSchema.nullable(),
    cores: coresSchema.nullable(),
    logoUrl: urlImagemNullable,
    loginBackgroundUrl: urlImagemNullable,
    sidebarBackgroundUrl: urlImagemNullable,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nenhum campo para atualizar",
  })

export type IdentidadeVisualPatchInput = z.infer<typeof identidadeVisualPatchSchema>

/**
 * Normaliza o patch já validado antes de persistir:
 *  - hex lowercase;
 *  - nome da organização vazio → null (fallback do tema default);
 * Não INVENTA campos: mantém apenas o que veio validado.
 */
export function normalizarIdentidadeVisual(
  patch: IdentidadeVisualPatchInput
): IdentidadeVisualPatchInput {
  const out: IdentidadeVisualPatchInput = { ...patch }

  if (out.cores) {
    out.cores = Object.fromEntries(
      Object.entries(out.cores).map(([chave, valor]) => [
        chave,
        typeof valor === "string" ? valor.toLowerCase() : valor,
      ])
    ) as IdentidadeVisualPatchInput["cores"]
  }

  if (typeof out.nomeOrganizacao === "string") {
    const nome = out.nomeOrganizacao.trim()
    out.nomeOrganizacao = nome.length > 0 ? nome : null
  }

  return out
}


// =====================================================================
// Validação de UPLOAD de imagem (logo/backgrounds) — mesmo espírito do
// fluxo existente de fotos de material: whitelist de MIME + teto de size.
// SVG fica FORA por ser vetor de XSS clássico quando servido/exibido.
// =====================================================================

export const IMAGEM_MIMES_ACEITOS = ["image/png", "image/jpeg", "image/webp"] as const
export const IMAGEM_TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024 // 5 MB

/** Retorna mensagem de erro ou null se o arquivo estiver válido. */
export function validarArquivoImagem(
  mimeType: string | null | undefined,
  tamanhoBytes: number
): string | null {
  if (!mimeType || !IMAGEM_MIMES_ACEITOS.includes(mimeType as (typeof IMAGEM_MIMES_ACEITOS)[number])) {
    return "Formato não suportado — use PNG, JPG ou WEBP"
  }
  if (tamanhoBytes <= 0) return "Arquivo vazio"
  if (tamanhoBytes > IMAGEM_TAMANHO_MAXIMO_BYTES) {
    return "Imagem muito grande (máximo de 5 MB)"
  }
  return null
}

/**
 * Proporção recomendada por tipo de asset. NÃO bloqueia o upload — só
 * alimenta o warning de UX ("imagem horizontal numa área vertical será
 * cortada"). O corte real continua sendo object-fit: cover no CSS.
 */
export type TipoAssetBranding = "logo" | "login" | "sidebar"

export function sugerirProporcao(tipo: TipoAssetBranding) {
  switch (tipo) {
    case "login":
      return { largura: 16, altura: 9, descricao: "horizontal 16:9 (ex.: 1920×1080)" }
    case "sidebar":
      return { largura: 2, altura: 3, descricao: "vertical 2:3 (ex.: 800×1200)" }
    default:
      return { largura: 1, altura: 1, descricao: "quadrada (ex.: 512×512)" }
  }
}
