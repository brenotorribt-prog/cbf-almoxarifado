// src/app/api/compras/[id]/itens/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth/require-role"
import { Prisma } from "@prisma/client"

// Select do material para consistência com o resto da aplicação
const MATERIAL_SELECT = {
  id: true,
  nome: true,
  codigoInterno: true,
  descricao: true,
  marca: true,
  fabricante: true,
  modelo: true,
  fornecedor: true,
  unidadeMedida: { select: { sigla: true } },
} satisfies Prisma.MaterialSelect

const itemSchema = z
  .object({
    tipo: z.enum(["MATERIAL_EXISTENTE", "MATERIAL_NOVO"]),
    materialId: z.string().optional().nullable(),
    nomeMaterialNovo: z.string().trim().max(150).optional().nullable(),
    descricaoNovo: z.string().trim().max(500).optional().nullable(),
    unidadeSugerida: z.string().trim().max(30).optional().nullable(),
    marcaNovo: z.string().trim().max(80).optional().nullable(),
    fabricanteNovo: z.string().trim().max(80).optional().nullable(),
    modeloNovo: z.string().trim().max(80).optional().nullable(),
    fornecedorNovo: z.string().trim().max(100).optional().nullable(),
    quantidade: z.coerce.number().positive(),
    observacao: z.string().trim().max(300).optional().nullable(),
    prazoMaximoNecessario: z.string().datetime().optional().nullable(),
  })
  .superRefine((item, ctx) => {
    if (item.tipo === "MATERIAL_EXISTENTE" && !item.materialId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione o material", path: ["materialId"] })
    }
    if (item.tipo === "MATERIAL_NOVO" && !item.nomeMaterialNovo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o nome do material", path: ["nomeMaterialNovo"] })
    }
  })

// POST /api/compras/[id]/itens — "editar o pedido acrescentando item",
// como você descreveu: pedido de segunda ganha item novo na quarta.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = itemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const pedido = await prisma.pedidoCompra.findUnique({ where: { id } })
  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
  }
  if (pedido.status === "CANCELADO" || pedido.status === "CONCLUIDO") {
    return NextResponse.json(
      { error: `Não é possível adicionar item a um pedido ${pedido.status.toLowerCase()}.` },
      { status: 409 }
    )
  }

  const dados = parsed.data

  const item = await prisma.itemPedidoCompra.create({
    data: {
      pedidoId: id,
      tipo: dados.tipo,
      materialId: dados.tipo === "MATERIAL_EXISTENTE" ? dados.materialId : null,
      nomeMaterialNovo: dados.tipo === "MATERIAL_NOVO" ? dados.nomeMaterialNovo : null,
      descricaoNovo: dados.tipo === "MATERIAL_NOVO" ? dados.descricaoNovo || null : null,
      unidadeSugerida: dados.tipo === "MATERIAL_NOVO" ? dados.unidadeSugerida || null : null,
      marcaNovo: dados.tipo === "MATERIAL_NOVO" ? dados.marcaNovo || null : null,
      fabricanteNovo: dados.tipo === "MATERIAL_NOVO" ? dados.fabricanteNovo || null : null,
      modeloNovo: dados.tipo === "MATERIAL_NOVO" ? dados.modeloNovo || null : null,
      fornecedorNovo: dados.tipo === "MATERIAL_NOVO" ? dados.fornecedorNovo || null : null,
      quantidade: dados.quantidade,
      observacao: dados.observacao || null,
      prazoMaximoNecessario: dados.prazoMaximoNecessario ? new Date(dados.prazoMaximoNecessario) : null,
    },
    include: { 
      material: { 
        select: MATERIAL_SELECT
      } 
    },
  })

  // se o pedido estava CONCLUIDO isso já foi bloqueado acima; se estava
  // PARCIALMENTE_RECEBIDO, voltar pra ABERTO faz sentido (tem item novo
  // pendente de novo)
  if (pedido.status === "PARCIALMENTE_RECEBIDO") {
    await prisma.pedidoCompra.update({ 
      where: { id }, 
      data: { status: "ABERTO" } 
    })
  }

  return NextResponse.json(
    { 
      item: { 
        ...item, 
        quantidade: Number(item.quantidade), 
        quantidadeRecebida: Number(item.quantidadeRecebida) 
      } 
    },
    { status: 201 }
  )
}