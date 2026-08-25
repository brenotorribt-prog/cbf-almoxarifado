// src/lib/relatorios-export-csv.ts
//
// Gerador CSV do relatório detalhado de movimentações.
// Segue o padrão de src/lib/compras-export-csv.ts (BOM UTF-8,
// separador ";", escape de aspas/quebras).

import {
  LABEL_TIPO_MOV,
  formatarDataHoraExportacao,
  type MovimentacaoDetalhadaRow,
} from "./relatorios"

const CABECALHO = [
  "Data/Hora", "Tipo", "Material", "Código interno", "Categoria", "Unidade",
  "Quantidade", "Estoque anterior", "Estoque após", "Motivo", "Doc. referência",
  "Solicitante", "Setor solicitante", "Registrado por",
]

function escaparCampo(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor)
  if (/[";\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

function linhaCsv(campos: unknown[]): string {
  return campos.map(escaparCampo).join(";") + "\r\n"
}

export function gerarCsvRelatorio(movimentacoes: MovimentacaoDetalhadaRow[]): string {
  let csv = "\uFEFF" + linhaCsv(CABECALHO)

  for (const mov of movimentacoes) {
    csv += linhaCsv([
      formatarDataHoraExportacao(mov.createdAt),
      LABEL_TIPO_MOV[mov.tipo] ?? mov.tipo,
      mov.materialNome,
      mov.codigoInterno,
      mov.categoriaNome,
      mov.unidadeSigla,
      mov.quantidade,
      mov.quantidadeAnterior,
      mov.quantidadeAtual,
      mov.motivo ?? "",
      mov.documentoReferencia ?? "",
      mov.solicitanteNome ?? "",
      mov.solicitanteSetor ?? "",
      mov.usuarioNome,
    ])
  }

  return csv
}