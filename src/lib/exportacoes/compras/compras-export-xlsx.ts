import ExcelJS from "exceljs"
import {
  PedidoParaExportar,
  STATUS_PEDIDO_LABEL,
  STATUS_ITEM_LABEL,
  formatarDataSimples,
  resolverDetalhesItem,
} from "./compras-export"

export async function gerarExcelPedidos(pedidos: PedidoParaExportar[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "CBF Almoxarifado"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Pedidos de Compra")

  sheet.columns = [
    { header: "Pedido", key: "numero", width: 10 },
    { header: "Status do pedido", key: "statusPedido", width: 22 },
    { header: "Categoria do pedido", key: "categoria", width: 18 },
    { header: "Solicitante", key: "solicitante", width: 26 },
    { header: "Setor", key: "setor", width: 18 },
    { header: "Função", key: "funcao", width: 18 },
    { header: "Data do pedido", key: "dataPedido", width: 14 },
    { header: "Obs. do pedido", key: "obsPedido", width: 30 },
    { header: "Material", key: "material", width: 30 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Código interno", key: "codigo", width: 14 },
    { header: "Descrição", key: "descricao", width: 30 },
    { header: "Unidade", key: "unidade", width: 10 },
    { header: "Marca", key: "marca", width: 16 },
    { header: "Fabricante", key: "fabricante", width: 16 },
    { header: "Modelo", key: "modelo", width: 16 },
    { header: "Fornecedor", key: "fornecedor", width: 20 },
    { header: "Quantidade", key: "quantidade", width: 12 },
    { header: "Qtd. recebida", key: "quantidadeRecebida", width: 13 },
    { header: "Status do item", key: "statusItem", width: 20 },
    { header: "Prazo necessário", key: "prazo", width: 16 },
    { header: "Obs. do item", key: "obsItem", width: 30 },
  ]

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  for (const pedido of pedidos) {
    const base = {
      numero: pedido.numero,
      statusPedido: STATUS_PEDIDO_LABEL[pedido.status] ?? pedido.status,
      categoria: pedido.area?.nome ?? "",
      solicitante: pedido.solicitanteNome,
      setor: pedido.solicitanteSetor,
      funcao: pedido.solicitanteFuncao,
      dataPedido: formatarDataSimples(pedido.createdAt),
      obsPedido: pedido.observacoes ?? "",
    }

    if (pedido.itens.length === 0) {
      sheet.addRow({ ...base, material: "— sem itens —" })
      continue
    }

    for (const item of pedido.itens) {
      const det = resolverDetalhesItem(item)
      sheet.addRow({
        ...base,
        material: det.nome,
        tipo: det.tipoLabel,
        codigo: det.codigoInterno,
        descricao: det.descricao,
        unidade: det.unidade,
        marca: det.marca,
        fabricante: det.fabricante,
        modelo: det.modelo,
        fornecedor: det.fornecedor,
        quantidade: Number(item.quantidade),
        quantidadeRecebida: Number(item.quantidadeRecebida),
        statusItem: STATUS_ITEM_LABEL[item.status] ?? item.status,
        prazo: item.prazoMaximoNecessario ? formatarDataSimples(item.prazoMaximoNecessario) : "",
        obsItem: item.observacao ?? "",
      })
    }
  }

  sheet.autoFilter = { from: "A1", to: "V1" }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as ArrayBuffer)
}