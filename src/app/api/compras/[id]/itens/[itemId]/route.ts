import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/require-role"

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

  const itemExistente = await prisma.itemPedidoCompra.findFirst({ where: { id: itemId, pedidoId: id } })
  if (!itemExistente) {
    return NextResponse.json({ error: "Item não encontrado neste pedido" }, { status: 404 })
  }

  const dados = parsed.data
  const item = await prisma.itemPedidoCompra.update({
    where: { id: itemId },
    data: {
      status: dados.status,
      prazoMaximoNecessario:
        dados.prazoMaximoNecessario === undefined
          ? undefined
          : dados.prazoMaximoNecessario
          ? new Date(dados.prazoMaximoNecessario)
          : null,
      observacao: dados.observacao === undefined ? undefined : dados.observacao || null,
      quantidade: dados.quantidade,
    },
  })

  // recalcula status do pedido a partir dos itens (fica sempre coerente,
  // sem precisar disparar isso manualmente em cada lugar que mexe em item)
  await recalcularStatusPedido(id)

  return NextResponse.json({
    item: { ...item, quantidade: Number(item.quantidade), quantidadeRecebida: Number(item.quantidadeRecebida) },
  })
}

async function recalcularStatusPedido(pedidoId: string) {
  const itens = await prisma.itemPedidoCompra.findMany({ where: { pedidoId } })
  const naoCancelados = itens.filter((i) => i.status !== "CANCELADO")

  if (naoCancelados.length === 0) {
    await prisma.pedidoCompra.update({ where: { id: pedidoId }, data: { status: "CANCELADO" } })
    return
  }

  const todosRecebidos = naoCancelados.every((i) => i.status === "RECEBIDO")
  const algumRecebido = naoCancelados.some((i) => i.status === "RECEBIDO")

  const novoStatus = todosRecebidos ? "CONCLUIDO" : algumRecebido ? "PARCIALMENTE_RECEBIDO" : "ABERTO"

  await prisma.pedidoCompra.update({ where: { id: pedidoId }, data: { status: novoStatus } })
}