import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/require-role"
import { Prisma } from "@prisma/client"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2"

// GET /api/materiais/[id] — ficha completa de um material
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { id } = await params

  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      categoria: { select: { id: true, nome: true } },
      unidadeMedida: { select: { id: true, sigla: true, nome: true, tipo: true } },
      criadoPor: { select: { id: true, name: true } },
    },
  })

  if (!material) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  }

  return NextResponse.json({
    material: {
      ...material,
      estoqueMinimo: Number(material.estoqueMinimo),
      estoqueIdeal: Number(material.estoqueIdeal),
      estoqueMaximo: Number(material.estoqueMaximo),
      estoqueAtual: Number(material.estoqueAtual),
    },
  })
}

// =====================================================================
// PATCH /api/materiais/[id] — edição de dados cadastrais
//
// NÃO edita estoqueAtual. Aumentar/diminuir quantidade em estoque passa
// pela rota de movimentações (a construir), que registra MovimentacaoEstoque
// com motivo e mantém o histórico. Mínimo/Ideal/Máximo são apenas limites
// de referência, não "estoque real", então são editáveis aqui sem
// problema de auditoria.
// =====================================================================

const editarMaterialSchema = z
  .object({
    nome: z.string().trim().min(2).max(150).optional(),
    descricao: z.string().trim().max(500).optional().nullable(),

    categoriaId: z.string().min(1).optional(),
    unidadeMedidaId: z.string().min(1).optional(),

    requerAprovacao: z.boolean().optional(),

    marca: z.string().trim().max(80).optional().nullable(),
    fabricante: z.string().trim().max(80).optional().nullable(),
    modelo: z.string().trim().max(80).optional().nullable(),
    numeroSerie: z.string().trim().max(80).optional().nullable(),

    estoqueMinimo: z.coerce.number().min(0).optional(),
    estoqueIdeal: z.coerce.number().min(0).optional(),
    estoqueMaximo: z.coerce.number().min(0).optional(),

    localizacaoFisica: z.string().trim().max(150).optional().nullable(),
    codigoBarras: z.string().trim().max(80).optional().nullable(),
    qrCode: z.string().trim().max(80).optional().nullable(),

    situacao: z.enum(["ATIVO", "INATIVO"]).optional(),

    // string vazia "" é usada pelo front pra dizer "remover a foto atual"
    fotoUrl: z.string().url().or(z.literal("")).optional().nullable(),
  })
  .superRefine((dados, ctx) => {
    if (
      dados.estoqueMaximo !== undefined &&
      dados.estoqueMinimo !== undefined &&
      dados.estoqueMaximo > 0 &&
      dados.estoqueMinimo > dados.estoqueMaximo
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Estoque mínimo não pode ser maior que o máximo",
        path: ["estoqueMinimo"],
      })
    }
  })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const parsed = editarMaterialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const dados = parsed.data

  const materialExistente = await prisma.material.findUnique({ where: { id } })
  if (!materialExistente) {
    return NextResponse.json({ error: "Material não encontrado" }, { status: 404 })
  }

  // valida fração vs unidade INTEIRA, considerando a unidade nova (se
  // estiver trocando) ou a atual do material.
  const unidadeIdParaValidar = dados.unidadeMedidaId ?? materialExistente.unidadeMedidaId
  const unidade = await prisma.unidadeMedida.findUnique({ where: { id: unidadeIdParaValidar } })
  if (!unidade) {
    return NextResponse.json({ error: "Unidade de medida não encontrada" }, { status: 404 })
  }

  if (unidade.tipo === "INTEIRA") {
    const valores = [dados.estoqueMinimo, dados.estoqueIdeal, dados.estoqueMaximo].filter(
      (v): v is number => v !== undefined
    )
    if (valores.some((v) => v % 1 !== 0)) {
      return NextResponse.json(
        { error: `A unidade "${unidade.nome}" não aceita valores fracionados de estoque.` },
        { status: 400 }
      )
    }
  }

  // fotoUrl === "" significa "remover foto atual"; undefined significa
  // "não tocar no campo"; url válida significa "trocar pra essa"
  const fotoAntiga = materialExistente.fotoUrl
  const removendoOuTrocandoFoto =
    dados.fotoUrl !== undefined && dados.fotoUrl !== fotoAntiga

  try {
    const material = await prisma.material.update({
      where: { id },
      data: {
        ...dados,
        fotoUrl: dados.fotoUrl === "" ? null : dados.fotoUrl,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        unidadeMedida: { select: { id: true, sigla: true, nome: true, tipo: true } },
        criadoPor: { select: { id: true, name: true } },
      },
    })

    // limpeza best-effort do objeto antigo no R2 — nunca falha a request
    // principal por conta disso, só loga se der problema.
    if (removendoOuTrocandoFoto && fotoAntiga && fotoAntiga.startsWith(R2_PUBLIC_URL)) {
      const chaveAntiga = fotoAntiga.replace(`${R2_PUBLIC_URL}/`, "")
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: chaveAntiga })).catch((err) => {
        console.error("Falha ao remover foto antiga do R2:", err)
      })
    }

    return NextResponse.json({
      material: {
        ...material,
        estoqueMinimo: Number(material.estoqueMinimo),
        estoqueIdeal: Number(material.estoqueIdeal),
        estoqueMaximo: Number(material.estoqueMaximo),
        estoqueAtual: Number(material.estoqueAtual),
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const alvo = (err.meta?.target as string[] | undefined)?.join(", ")
      return NextResponse.json(
        { error: `Já existe um material com esse ${alvo ?? "valor único"}` },
        { status: 409 }
      )
    }
    throw err
  }
}