import {
  PedidoParaExportar,
  STATUS_PEDIDO_LABEL,
  STATUS_ITEM_LABEL,
  formatarDataSimples,
  resolverDetalhesItem,
} from "./compras-export"

const CABECALHO = [
  "Pedido", "Status do pedido", "Categoria do pedido", "Solicitante", "Setor", "Função",
  "Data do pedido", "Obs. do pedido", "Material", "Tipo", "Código interno", "Descrição",
  "Unidade", "Marca", "Fabricante", "Modelo", "Fornecedor", "Quantidade", "Qtd. recebida",
  "Status do item", "Prazo necessário", "Obs. do item",
]

function escaparCampo(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor)
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

function linhaCsv(campos: unknown[]): string {
  return campos.map(escaparCampo).join(";") + "\r\n"
}

export function gerarCsvPedidos(pedidos: PedidoParaExportar[]): string {
  let csv = "\uFEFF" + linhaCsv(CABECALHO)

  for (const pedido of pedidos) {
    const base = [
      pedido.numero,
      STATUS_PEDIDO_LABEL[pedido.status] ?? pedido.status,
      pedido.area?.nome ?? "",
      pedido.solicitanteNome,
      pedido.solicitanteSetor,
      pedido.solicitanteFuncao,
      formatarDataSimples(pedido.createdAt),
      pedido.observacoes ?? "",
    ]

    if (pedido.itens.length === 0) {
      csv += linhaCsv([...base, "— sem itens —", "", "", "", "", "", "", "", "", "", "", "", ""])
      continue
    }

    for (const item of pedido.itens) {
      const det = resolverDetalhesItem(item)
      csv += linhaCsv([
        ...base,
        det.nome,
        det.tipoLabel,
        det.codigoInterno,
        det.descricao,
        det.unidade,
        det.marca,
        det.fabricante,
        det.modelo,
        det.fornecedor,
        Number(item.quantidade),
        Number(item.quantidadeRecebida),
        STATUS_ITEM_LABEL[item.status] ?? item.status,
        item.prazoMaximoNecessario ? formatarDataSimples(item.prazoMaximoNecessario) : "",
        item.observacao ?? "",
      ])
    }
  }

  return csv
}