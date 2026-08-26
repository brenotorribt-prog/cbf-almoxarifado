import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/auth/require-role"
import {
  identidadeVisualPatchSchema,
  normalizarIdentidadeVisual,
} from "@/lib/configuracoes/identidade-visual-schema"
import {
  obterConfiguracaoVisual,
  salvarConfiguracaoVisual,
} from "@/lib/configuracoes/identidade-visual"

/**
 * GET /api/configuracoes/identidade-visual
 * Qualquer usuario autenticado pode LER (necessario para PDFs no cliente).
 * Escrita exclusiva de ADMIN.
 */
export async function GET() {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const config = await obterConfiguracaoVisual()
  return NextResponse.json({ config })
}

/**
 * PATCH /api/configuracoes/identidade-visual
 * Somente ADMIN. Validacao Zod rigorosa: apenas cores hex e URLs https ou
 * caminhos internos conhecidos — nenhum CSS/arbitrario e aceito.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 })
  }

  const parsed = identidadeVisualPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Normaliza vazio->null; nunca aceita CSS/arbitrario em nenhum campo
  const patch = normalizarIdentidadeVisual(parsed.data)

  const config = await salvarConfiguracaoVisual(patch, guard.user.id)
  if (!config) {
    return NextResponse.json(
      { error: "Nao foi possivel salvar a configuracao visual" },
      { status: 500 }
    )
  }

  return NextResponse.json({ config })
}