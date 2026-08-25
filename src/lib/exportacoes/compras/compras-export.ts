// src/lib/compras-export.ts
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
// Teto de linhas compartilhado com a exportação de relatórios — protege
// contra consultas gigantes gerando arquivos fora de controle.
import { LIMITE_LINHAS_EXPORTACAO } from "@/lib/exportacoes/relatorios/relatorios"

export interface FiltrosExportacaoCompras {
  setor?: string
  status?: string
  busca?: string
  /** Início do período (inclusive) — filtrado NO BANCO via createdAt. */
  dataInicio?: Date
  /** Fim do período (inclusive) — filtrado NO BANCO via createdAt. */
  dataFim?: Date
}

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

export async function buscarPedidosParaExportacao(filtros: FiltrosExportacaoCompras) {
  const where: Prisma.PedidoCompraWhereInput = {}

  if (filtros.setor) {
    where.solicitanteSetor = { equals: filtros.setor, mode: "insensitive" }
  }
  if (filtros.status) {
    where.status = filtros.status as Prisma.EnumStatusPedidoCompraFilter["equals"]
  }
  if (filtros.busca) {
    where.OR = [
      { solicitanteNome: { contains: filtros.busca, mode: "insensitive" } },
      { itens: { some: { nomeMaterialNovo: { contains: filtros.busca, mode: "insensitive" } } } },
      { itens: { some: { material: { nome: { contains: filtros.busca, mode: "insensitive" } } } } },
    ]
  }
  // Período filtrado NO BANCO — antes isso era feito em memória depois de
  // carregar a tabela inteira.
  if (filtros.dataInicio || filtros.dataFim) {
    where.createdAt = {
      ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
      ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
    }
  }

  return prisma.pedidoCompra.findMany({
    where,
    take: LIMITE_LINHAS_EXPORTACAO,
    include: {
      area: { select: { nome: true } },
      itens: {
        include: {
          material: { select: MATERIAL_SELECT },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export type PedidoParaExportar = Awaited<ReturnType<typeof buscarPedidosParaExportacao>>[number]
type ItemParaExportar = PedidoParaExportar["itens"][number]

// Unifica "material já cadastrado" (dados vêm da relação) com "material
// sem cadastro" (dados foram digitados na mão no momento do pedido) —
// sem essa função cada gerador (xlsx/csv/pdf) tinha que replicar esse
// if/else, e foi exatamente aí que os campos ficaram faltando antes.
export function resolverDetalhesItem(item: ItemParaExportar) {
  const existente = item.tipo === "MATERIAL_EXISTENTE"
  return {
    nome: existente ? item.material?.nome ?? "—" : item.nomeMaterialNovo ?? "—",
    tipoLabel: existente ? "Cadastrado" : "Sem cadastro",
    codigoInterno: item.material?.codigoInterno ?? "",
    descricao: existente ? item.material?.descricao ?? "" : item.descricaoNovo ?? "",
    unidade: existente ? item.material?.unidadeMedida?.sigla ?? "" : item.unidadeSugerida ?? "",
    marca: existente ? item.material?.marca ?? "" : item.marcaNovo ?? "",
    fabricante: existente ? item.material?.fabricante ?? "" : item.fabricanteNovo ?? "",
    modelo: existente ? item.material?.modelo ?? "" : item.modeloNovo ?? "",
    fornecedor: existente ? item.material?.fornecedor ?? "" : item.fornecedorNovo ?? "",
  }
}

export const STATUS_PEDIDO_LABEL: Record<string, string> = {
  ABERTO: "Aberto",
  PARCIALMENTE_RECEBIDO: "Parcialmente recebido",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
}

export const STATUS_ITEM_LABEL: Record<string, string> = {
  EM_ESPERA: "Em espera",
  ORCANDO: "Orçando",
  APROVADO: "Aprovado",
  AGUARDANDO_ENTREGA: "Aguardando entrega",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
}

export function formatarDataSimples(data: Date | string | null): string {
  if (!data) return ""
  const d = typeof data === "string" ? new Date(data) : data
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function nomeArquivoExportacao(extensao: string): string {
  const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return `pedidos-compra-${stamp}.${extensao}`
}