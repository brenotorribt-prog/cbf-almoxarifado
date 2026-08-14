// src/app/api/compras/[id]/itens/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/require-role"
import { Prisma } from "@prisma/client"

// Select do material para consistência
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

const atualizarItemSchema = z.object({
  status: z.enum(["EM_ESPERA", "ORCANDO", "APROVADO", "AGUARDANDO_ENTREGA", "CANCELADO"]).optional(),
  // RECEBIDO não entra aqui de propósito — só a rota de Movimentações
  // (a construir) deve poder marcar como RECEBIDO, pra manter o vínculo
  // com o registro de entrada em estoque.
  prazoMaximoNecessario: z.string().datetime().optional().nullable(),
  observacao: z.string().trim().max(300).optional().nullable(),
  quantidade: z.coerce.number().positive().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const { id, itemId } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = atualizarItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const itemExistente = await prisma.itemPedidoCompra.findFirst({ 
    where: { id: itemId, pedidoId: id } 
  })
  if (!itemExistente) {
    return NextResponse.json({ error: "Item não encontrado neste pedido" }, { status: 404 })
  }

  const dados = parsed.data
  
  // Prepara os dados para atualização
  const updateData: any = {}
  
  if (dados.status !== undefined) {
    updateData.status = dados.status
  }
  
  if (dados.prazoMaximoNecessario !== undefined) {
    updateData.prazoMaximoNecessario = dados.prazoMaximoNecessario 
      ? new Date(dados.prazoMaximoNecessario) 
      : null
  }
  
  if (dados.observacao !== undefined) {
    updateData.observacao = dados.observacao || null
  }
  
  if (dados.quantidade !== undefined) {
    updateData.quantidade = dados.quantidade
  }

  const item = await prisma.itemPedidoCompra.update({
    where: { id: itemId },
    data: updateData,
    include: {
      material: {
        select: MATERIAL_SELECT
      }
    }
  })

  // recalcula status do pedido a partir dos itens (fica sempre coerente,
  // sem precisar disparar isso manualmente em cada lugar que mexe em item)
  await recalcularStatusPedido(id)

  return NextResponse.json({
    item: { 
      ...item, 
      quantidade: Number(item.quantidade), 
      quantidadeRecebida: Number(item.quantidadeRecebida) 
    },
  })
}

async function recalcularStatusPedido(pedidoId: string) {
  const itens = await prisma.itemPedidoCompra.findMany({ 
    where: { pedidoId } 
  })
  
  const naoCancelados = itens.filter((i) => i.status !== "CANCELADO")

  if (naoCancelados.length === 0) {
    await prisma.pedidoCompra.update({ 
      where: { id: pedidoId }, 
      data: { status: "CANCELADO" } 
    })
    return
  }

  const todosRecebidos = naoCancelados.every((i) => i.status === "RECEBIDO")
  const algumRecebido = naoCancelados.some((i) => i.status === "RECEBIDO")

  const novoStatus = todosRecebidos 
    ? "CONCLUIDO" 
    : algumRecebido 
    ? "PARCIALMENTE_RECEBIDO" 
    : "ABERTO"

  await prisma.pedidoCompra.update({ 
    where: { id: pedidoId }, 
    data: { status: novoStatus } 
  })
}