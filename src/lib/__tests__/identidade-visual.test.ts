import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------
// Mocks de infraestrutura (prisma / auth) antes dos imports reais
// ---------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoVisual: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth/require-role", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
}))

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireAdmin } from "@/lib/auth/require-role"
import { obterIdentidadeVisual } from "@/lib/configuracoes/identidade-visual"
import { GET, PATCH } from "@/app/api/configuracoes/identidade-visual/route"
import {
  HEX_RE,
  hexColorNullable,
  identidadeVisualPatchSchema,
  validarArquivoImagem,
  sugerirProporcao,
  normalizarIdentidadeVisual,
  NOME_ORGANIZACAO_MAX,
} from "@/lib/configuracoes/identidade-visual-schema"
import {
  isHexColor,
  normalizeHex,
  shadeHex,
  rgbaFromHex,
  resolveVisualTheme,
} from "@/styles/visual-identity"
import { theme as defaultTheme } from "@/styles/theme"

const mockFindUnique = vi.mocked(prisma.configuracaoVisual.findUnique)
const mockUpsert = vi.mocked(prisma.configuracaoVisual.upsert)
const mockRequireAuth = vi.mocked(requireAuth)
const mockRequireAdmin = vi.mocked(requireAdmin)

beforeEach(() => {
  vi.clearAllMocks()
})

// =====================================================================
// VALIDAÇÃO DE CORES — o servidor é a autoridade final
// =====================================================================
describe("validação de cores", () => {
  it("aceita hexadecimal #RRGGBB", () => {
    expect(HEX_RE.test("#1D4ED8")).toBe(true)
    expect(hexColorNullable.safeParse("#1d4ed8").success).toBe(true)
    expect(hexColorNullable.safeParse(null).success).toBe(true)
  })

  it("rejeita CSS arbitrário, nomes, formatos curtos e injeção", () => {
    const invalidos = [
      "url(javascript:alert(1))",
      "<script>alert(1)</script>",
      "rgb(255,0,0)",
      "hsl(120,50%,50%)",
      "red",
      "#12345",
      "#GGHHII",
      "",
    ]
    for (const v of invalidos) {
      expect(hexColorNullable.safeParse(v).success).toBe(false)
    }
  })
})

// =====================================================================
// SCHEMA DO PATCH — payload real da seção Identidade Visual
// =====================================================================
describe("identidadeVisualPatchSchema", () => {
  const payloadValido = {
    nomeOrganizacao: "Minha Org",
    cores: {
      primary: "#009C3B",
      accent: null,
      destaque: null,
      background: "#0A1424",
      surface: null,
      sidebar: null,
      textPrimary: null,
      textSecondary: null,
      linkColor: null,
    },
    logoUrl: "https://exemplo.r2.dev/branding/abc.png",
    loginBackgroundUrl: null,
    sidebarBackgroundUrl: null,
  }

  it("aceita payload completo válido", () => {
    expect(identidadeVisualPatchSchema.safeParse(payloadValido).success).toBe(true)
  })

  it("aceita nome da organização exatamente no limite", () => {
    const r = identidadeVisualPatchSchema.safeParse({
      ...payloadValido,
      nomeOrganizacao: "a".repeat(NOME_ORGANIZACAO_MAX),
    })
    expect(r.success).toBe(true)
  })

  it("rejeita nome da organização acima do limite e aponta o campo", () => {
    const r = identidadeVisualPatchSchema.safeParse({
      ...payloadValido,
      nomeOrganizacao: "a".repeat(NOME_ORGANIZACAO_MAX + 1),
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.nomeOrganizacao).toBeDefined()
      expect(r.error.flatten().fieldErrors.nomeOrganizacao?.[0]).toMatch(/11/)
    }
  })

  it("rejeita patch vazio (nada para atualizar)", () => {
    expect(identidadeVisualPatchSchema.safeParse({}).success).toBe(false)
  })

  it("rejeita cor malformada e aponta o campo", () => {
    const r = identidadeVisualPatchSchema.safeParse({
      ...payloadValido,
      cores: { ...payloadValido.cores, primary: "verde" },
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.cores).toBeDefined()
  })

  it("rejeita URL de imagem com scheme perigoso", () => {
    const r = identidadeVisualPatchSchema.safeParse({
      ...payloadValido,
      logoUrl: "javascript:void(0)",
    })
    expect(r.success).toBe(false)
  })

  it("descarta campos desconhecidos", () => {
    const r = identidadeVisualPatchSchema.safeParse({
      ...payloadValido,
      injecao: "<img src=x onerror=alert(1)>",
    })
    expect(r.success).toBe(true)
    if (r.success) expect("injecao" in r.data).toBe(false)
  })

  it("normalizarIdentidadeVisual não inventa campos além do patch", () => {
    const r = normalizarIdentidadeVisual({ cores: { primary: "#112233" } })
    expect(Object.keys(r)).toEqual(["cores"])
    expect(Object.keys(r.cores ?? {})).toEqual(["primary"])
  })
})

// =====================================================================
// VALIDAÇÃO DE UPLOAD DE IMAGENS
// =====================================================================
describe("validarArquivoImagem", () => {
  it("aceita PNG/JPG/WEBP dentro do limite", () => {
    expect(validarArquivoImagem("image/png", 1024)).toBeNull()
    expect(validarArquivoImagem("image/jpeg", 1024)).toBeNull()
    expect(validarArquivoImagem("image/webp", 4 * 1024 * 1024)).toBeNull()
  })

  it("rejeita SVG por risco de XSS", () => {
    expect(validarArquivoImagem("image/svg+xml", 100)).toMatch(/formato/i)
  })

  it("rejeita HTML/executáveis/tipo ausente", () => {
    expect(validarArquivoImagem("text/html", 100)).toMatch(/formato/i)
    expect(validarArquivoImagem("application/octet-stream", 100)).toMatch(/formato/i)
    expect(validarArquivoImagem(null, 100)).toMatch(/formato/i)
  })

  it("rejeita arquivo vazio e acima do limite", () => {
    expect(validarArquivoImagem("image/png", 0)).toMatch(/vazio/i)
    expect(validarArquivoImagem("image/png", 5 * 1024 * 1024 + 1)).toMatch(/grande/i)
  })
})

// =====================================================================
// PROPORÇÕES RECOMENDADAS (warning de UX — não bloqueia upload)
// =====================================================================
describe("sugerirProporcao", () => {
  it("login recomenda horizontal 16:9", () => {
    const s = sugerirProporcao("login")
    expect(s.largura / s.altura).toBeCloseTo(16 / 9)
    expect(s.descricao).toContain("16:9")
  })

  it("sidebar recomenda vertical (portrait)", () => {
    const s = sugerirProporcao("sidebar")
    expect(s.altura).toBeGreaterThan(s.largura)
    expect(s.descricao).toMatch(/vertical/i)
  })

  it("logo recomenda quadrada", () => {
    const s = sugerirProporcao("logo")
    expect(s.largura).toBe(s.altura)
  })
})

// =====================================================================
// HELPERS DE COR DO RUNTIME
// =====================================================================
describe("helpers de cor", () => {
  it("isHexColor e normalizeHex", () => {
    expect(isHexColor("#AABBCC")).toBe(true)
    expect(isHexColor("#abc")).toBe(false) // só #RRGGBB
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc") // normaliza p/ minúsculas
  })

  it("shadeHex clareia/escurece de forma determinística", () => {
    expect(shadeHex("#000000", 0.5)).toBe("#808080")
    expect(shadeHex("#ffffff", -1)).toBe("#000000")
  })

  it("rgbaFromHex gera rgba válido respeitando alpha", () => {
    expect(rgbaFromHex("#3D7DFF", 0.5)).toBe("rgba(61, 125, 255, 0.5)")
    expect(rgbaFromHex("#FF0000", 0)).toBe("rgba(255, 0, 0, 0)") // transparente
  })
})

// =====================================================================
// RESOLUÇÃO DO TEMA FINAL — DEFAULT + CONFIG = THEME
// =====================================================================
describe("resolveVisualTheme", () => {
  it("sem configuração → retorna o tema default intacto", () => {
    expect(resolveVisualTheme(null)).toBe(defaultTheme)
    expect(resolveVisualTheme(undefined)).toBe(defaultTheme)
  })

  it("config parcial sobrescreve SÓ os tokens configuráveis", () => {
    const t = resolveVisualTheme({ cores: { primary: "#00FF00" } })

    // configurável trocou + derivados acompanharam
    // (vivid preserva o caso informado; deep usa o mesmo -0.45 do runtime)
    expect(t.colors.primary.vivid).toBe("#00FF00")
    expect(t.colors.primary.deep).toBe(shadeHex("#00FF00", -0.45))

    // estruturais preservados do default
    expect(t.spacing[4]).toBe(defaultTheme.spacing[4])
    expect(t.radii.lg).toBe(defaultTheme.radii.lg)
    expect(t.typography.fontFamily.sans).toBe(defaultTheme.typography.fontFamily.sans)
    expect(t.zIndex.modal).toBe(defaultTheme.zIndex.modal)
    expect(t.layout.sidebarWidth).toBe(defaultTheme.layout.sidebarWidth)
    expect(t.transitions.fast).toBe(defaultTheme.transitions.fast)
  })

  it("status semânticos NUNCA são configuráveis", () => {
    const branco = { primary: "#ffffff", accent: "#ffffff", destaque: "#ffffff" }
    const t = resolveVisualTheme({ cores: branco })
    expect(t.colors.status.success).toEqual(defaultTheme.colors.status.success)
    expect(t.colors.status.error).toEqual(defaultTheme.colors.status.error)
    expect(t.colors.status.warning).toEqual(defaultTheme.colors.status.warning)
    expect(t.colors.status.info).toEqual(defaultTheme.colors.status.info)
  })

  it("specialty e avatarPalette permanecem intactos", () => {
    const t = resolveVisualTheme({ cores: { primary: "#ff0000" } })
    expect(t.colors.specialty).toEqual(defaultTheme.colors.specialty)
    expect(t.colors.avatarPalette).toEqual(defaultTheme.colors.avatarPalette)
  })

  it("valores em branco/nulos caem no default", () => {
    const t = resolveVisualTheme({
      nomeOrganizacao: "   ",
      cores: { primary: null },
      logoUrl: null,
    })
    expect(t.colors.primary.vivid).toBe(defaultTheme.colors.primary.vivid)
    expect(t.colors.brand.nomeOrganizacao).toBe(
      defaultTheme.colors.brand.nomeOrganizacao
    )
  })
})

// =====================================================================
// CARREGAMENTO — config persistida, ausente ou banco indisponível
// =====================================================================
describe("obterIdentidadeVisual (server)", () => {
  it("sem registro → null (ThemeProvider usa default)", async () => {
    mockFindUnique.mockResolvedValue(null as never)
    await expect(obterIdentidadeVisual()).resolves.toBeNull()
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "principal" } })
  })

  it("banco indisponível → null e NUNCA lança", async () => {
    mockFindUnique.mockRejectedValue(new Error("connection refused"))
    await expect(obterIdentidadeVisual()).resolves.toBeNull()
  })

  it("registro parcial → mapeia colunas e o resto cai no default", async () => {
    mockFindUnique.mockResolvedValue({
      id: "principal",
      nomeOrganizacao: "Org Teste",
      corPrimaria: "#112233",
      corAccent: null,
      logoUrl: "/branding/logo-default.png",
    } as never)

    const config = await obterIdentidadeVisual()
    expect(config?.nomeOrganizacao).toBe("Org Teste")

    const t = resolveVisualTheme(config as never)
    expect(t.colors.primary.vivid).toBe("#112233")
    expect(t.colors.brand.logoUrl).toBe("/branding/logo-default.png")
    expect(t.colors.brand.sidebarBackgroundUrl).toContain("/branding/")
  })
})

// =====================================================================
// PERMISSÕES — somente ADMIN modifica; leitura exige autenticação
// =====================================================================
function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/configuracoes/identidade-visual", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

describe("GET /api/configuracoes/identidade-visual (permissões)", () => {
  it("bloqueia usuário não autenticado com 401", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: "Não autenticado" }, { status: 401 }) as never
    )
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("usuário autenticado lê a configuração (200, sem registro → null)", async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).config).toBeNull()
  })
})

describe("PATCH /api/configuracoes/identidade-visual (permissões)", () => {
  const payloadValido = { cores: { primary: "#112233" }, nomeOrganizacao: "Org" }

  it("bloqueia não-ADMIN (401/403) ANTES de tocar no banco", async () => {
    for (const status of [401, 403]) {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: "negado" }, { status }) as never
      )
      const res = await PATCH(patchRequest(payloadValido))
      expect(res.status).toBe(status)
      expect(mockUpsert).not.toHaveBeenCalled()
    }
  })

  it("ADMIN com payload inválido recebe erro sem gravar", async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } } as never)

    const res = await PATCH(patchRequest({ cores: { primary: "verde-falso" } }))
    expect([400, 422]).toContain(res.status)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("ADMIN com payload válido grava o singleton e retorna 2xx", async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } } as never)
    mockUpsert.mockResolvedValue({
      id: "principal",
      nomeOrganizacao: "Org",
      corPrimaria: "#112233",
    } as never)

    const res = await PATCH(patchRequest(payloadValido))
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(300)
    expect(mockUpsert).toHaveBeenCalledTimes(1)

    const call = mockUpsert.mock.calls[0][0] as {
      where?: { id?: string }
      create: Record<string, unknown>
    }
    if (call.where) expect(call.where.id).toBe("principal")
    expect(call.create.corPrimaria).toBe("#112233")
    expect(call.create.nomeOrganizacao).toBe("Org")
  })
})

