import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/require-role"
import { Prisma } from "@prisma/client"

// GET /api/compras?setor=Manutenção&status=ABERTO&busca=fio
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const setor = searchParams.get("setor")?.trim()
  const status = searchParams.get("status") // ABERTO | PARCIALMENTE_RECEBIDO | CONCLUIDO | CANCELADO
  const busca = searchParams.get("busca")?.trim()

  const where: Prisma.PedidoCompraWhereInput = {}
  if (setor) where.solicitanteSetor = { equals: setor, mode: "insensitive" }
  if (status) where.status = status as Prisma.EnumStatusPedidoCompraFilter["equals"]
  if (busca) {
    where.OR = [
      { solicitanteNome: { contains: busca, mode: "insensitive" } },
      { itens: { some: { nomeMaterialNovo: { contains: busca, mode: "insensitive" } } } },
      { itens: { some: { material: { nome: { contains: busca, mode: "insensitive" } } } } },
    ]
  }

  const pedidos = await prisma.pedidoCompra.findMany({
    where,
    include: {
      solicitante: { select: { id: true, name: true } },
      itens: {
        include: { material: { select: { id: true, nome: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    pedidos: pedidos.map(mapearPedido),
    // lista de setores distintos, pra popular o filtro sem precisar de outra rota
    setoresDisponiveis: [...new Set(pedidos.map((p) => p.solicitanteSetor))].sort(),
  })
}

// POST /api/compras — cria pedido já com o primeiro item
const itemSchema = z
  .object({
    tipo: z.enum(["MATERIAL_EXISTENTE", "MATERIAL_NOVO"]),
    materialId: z.string().optional().nullable(),
    nomeMaterialNovo: z.string().trim().max(150).optional().nullable(),
    descricaoNovo: z.string().trim().max(500).optional().nullable(),
    unidadeSugerida: z.string().trim().max(30).optional().nullable(),
    quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
    observacao: z.string().trim().max(300).optional().nullable(),
    dataPrevistaEntrega: z.string().datetime().optional().nullable(),
  })
  .superRefine((item, ctx) => {
    if (item.tipo === "MATERIAL_EXISTENTE" && !item.materialId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione o material", path: ["materialId"] })
    }
    if (item.tipo === "MATERIAL_NOVO" && !item.nomeMaterialNovo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o nome do material", path: ["nomeMaterialNovo"] })
    }
  })

const criarPedidoSchema = z.object({
  areaId: z.string().optional().nullable(),
  solicitanteNome: z.string().trim().min(2, "Nome muito curto").max(100),
  solicitanteSetor: z.string().trim().min(2, "Setor muito curto").max(100),
  solicitanteFuncao: z.string().trim().min(2, "Função muito curta").max(100),
  observacoes: z.string().trim().max(500).optional().nullable(),
  itens: z.array(itemSchema).min(1, "O pedido precisa de pelo menos um item"),
})

export async function POST(request: NextRequest) {
  const guard = await requireRole(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
  if (guard instanceof NextResponse) return guard

  const body = await request.json().catch(() => ({}))
  const parsed = criarPedidoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const dados = parsed.data

  const pedido = await prisma.pedidoCompra.create({
    data: {
      areaId: dados.areaId || null,
      solicitanteId: guard.user.id,
      solicitanteNome: dados.solicitanteNome,
      solicitanteSetor: dados.solicitanteSetor,
      solicitanteFuncao: dados.solicitanteFuncao,
      observacoes: dados.observacoes || null,
      itens: {
        create: dados.itens.map((item) => ({
          tipo: item.tipo,
          materialId: item.tipo === "MATERIAL_EXISTENTE" ? item.materialId : null,
          nomeMaterialNovo: item.tipo === "MATERIAL_NOVO" ? item.nomeMaterialNovo : null,
          descricaoNovo: item.tipo === "MATERIAL_NOVO" ? item.descricaoNovo || null : null,
          unidadeSugerida: item.tipo === "MATERIAL_NOVO" ? item.unidadeSugerida || null : null,
          quantidade: item.quantidade,
          observacao: item.observacao || null,
          dataPrevistaEntrega: item.dataPrevistaEntrega ? new Date(item.dataPrevistaEntrega) : null,
        })),
      },
    },
    include: {
      solicitante: { select: { id: true, name: true } },
      itens: { include: { material: { select: { id: true, nome: true } } } },
    },
  })

  return NextResponse.json({ pedido: mapearPedido(pedido) }, { status: 201 })
}

// =====================================================================
type PedidoComRelacoes = Prisma.PedidoCompraGetPayload<{
  include: {
    solicitante: { select: { id: true; name: true } }
    itens: { include: { material: { select: { id: true; nome: true } } } }
  }
}>

function mapearPedido(pedido: PedidoComRelacoes) {
  return {
    ...pedido,
    itens: pedido.itens.map((item) => ({
      ...item,
      quantidade: Number(item.quantidade),
      quantidadeRecebida: Number(item.quantidadeRecebida),
    })),
  }
}