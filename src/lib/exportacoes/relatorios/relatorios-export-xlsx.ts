// src/lib/relatorios-export-xlsx.ts
//
// Gerador Excel (.xlsx) do relatório detalhado de movimentações.
// Segue o padrão de src/lib/compras-export-xlsx.ts (exceljs, cabeçalho
// congelado, autofiltro).

import ExcelJS from "exceljs"
import {
  LABEL_TIPO_MOV,
  formatarDataHoraExportacao,
  type EstoquePessoaRow,
  type MovimentacaoDetalhadaRow,
} from "./relatorios"

export async function gerarExcelRelatorio(
  movimentacoes: MovimentacaoDetalhadaRow[],
  periodo: { dataInicio: Date; dataFim: Date },
  pessoas: EstoquePessoaRow[] = [],
  filtros?: { pessoa?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "CBF Almoxarifado"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Movimentações")

  sheet.columns = [
    { header: "Data/Hora", key: "data", width: 18 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Material", key: "material", width: 32 },
    { header: "Código interno", key: "codigo", width: 16 },
    { header: "Categoria", key: "categoria", width: 20 },
    { header: "Unidade", key: "unidade", width: 10 },
    { header: "Quantidade", key: "quantidade", width: 13 },
    { header: "Estoque anterior", key: "estoqueAnterior", width: 16 },
    { header: "Estoque após", key: "estoqueAtual", width: 14 },
    { header: "Motivo", key: "motivo", width: 34 },
    { header: "Doc. referência", key: "documento", width: 18 },
    { header: "Solicitante", key: "solicitante", width: 24 },
    { header: "Setor solicitante", key: "setor", width: 20 },
    { header: "Registrado por", key: "usuario", width: 22 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  for (const mov of movimentacoes) {
    sheet.addRow({
      data: formatarDataHoraExportacao(mov.createdAt),
      tipo: LABEL_TIPO_MOV[mov.tipo] ?? mov.tipo,
      material: mov.materialNome,
      codigo: mov.codigoInterno,
      categoria: mov.categoriaNome,
      unidade: mov.unidadeSigla,
      quantidade: mov.quantidade,
      estoqueAnterior: mov.quantidadeAnterior,
      estoqueAtual: mov.quantidadeAtual,
      motivo: mov.motivo ?? "",
      documento: mov.documentoReferencia ?? "",
      solicitante: mov.solicitanteNome ?? "",
      setor: mov.solicitanteSetor ?? "",
      usuario: mov.usuarioNome,
    })
  }

  sheet.autoFilter = { from: "A1", to: "N1" }

  // Aba de resumo — visão agregada por tipo no mesmo arquivo
  const resumoSheet = workbook.addWorksheet("Resumo")
  resumoSheet.columns = [
    { header: "Indicador", key: "indicador", width: 34 },
    { header: "Valor", key: "valor", width: 14 },
  ]
  resumoSheet.getRow(1).font = { bold: true }
  resumoSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }

  const totalGeral = movimentacoes.length
  const porTipo = (tipo: string) => movimentacoes.filter((m) => m.tipo === tipo).length

  resumoSheet.addRow({ indicador: "Período inicial", valor: formatarDataHoraExportacao(periodo.dataInicio) })
  resumoSheet.addRow({ indicador: "Período final", valor: formatarDataHoraExportacao(periodo.dataFim) })
  if (filtros?.pessoa) {
    resumoSheet.addRow({ indicador: "Pessoa filtrada", valor: filtros.pessoa })
  }
  resumoSheet.addRow({ indicador: "Total de movimentações", valor: totalGeral })
  resumoSheet.addRow({ indicador: "Entradas", valor: porTipo("ENTRADA") })
  resumoSheet.addRow({ indicador: "Saídas", valor: porTipo("SAIDA") })
  resumoSheet.addRow({ indicador: "Ajustes", valor: porTipo("AJUSTE") })
  resumoSheet.addRow({ indicador: "Descartes", valor: porTipo("DESCARTE") })

  // Aba "Por Pessoa" — estoque pessoal (quem pegou o quê no período)
  if (pessoas.length > 0) {
    const pessoasSheet = workbook.addWorksheet("Por Pessoa")
    pessoasSheet.columns = [
      { header: "Pessoa", key: "pessoa", width: 26 },
      { header: "Setor", key: "setor", width: 20 },
      { header: "Função", key: "funcao", width: 20 },
      { header: "Material", key: "material", width: 32 },
      { header: "Código interno", key: "codigo", width: 16 },
      { header: "Unidade", key: "unidade", width: 10 },
      { header: "Retirado", key: "retirado", width: 12 },
      { header: "Devolvido", key: "devolvido", width: 12 },
      { header: "Consumido", key: "consumido", width: 12 },
      { header: "Em posse", key: "saldo", width: 12 },
    ]

    const headerPessoas = pessoasSheet.getRow(1)
    headerPessoas.font = { bold: true }
    headerPessoas.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
    pessoasSheet.views = [{ state: "frozen", ySplit: 1 }]

    for (const p of pessoas) {
      pessoasSheet.addRow({
        pessoa: p.nome,
        setor: p.setor ?? "",
        funcao: p.funcao ?? "",
        material: p.materialNome,
        codigo: p.codigoInterno,
        unidade: p.unidadeSigla,
        retirado: p.retirado,
        devolvido: p.devolvido,
        consumido: p.consumido,
        saldo: p.saldo,
      })
    }

    pessoasSheet.autoFilter = { from: "A1", to: "J1" }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as ArrayBuffer)
}
