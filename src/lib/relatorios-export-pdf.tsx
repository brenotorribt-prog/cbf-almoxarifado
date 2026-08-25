// src/lib/relatorios-export-pdf.tsx
//
// Gerador PDF do relatório detalhado de movimentações.
// Segue o padrão de src/lib/compras-export-pdf.tsx (@react-pdf/renderer,
// renderToBuffer dinâmico, Helvetica).

import { StyleSheet, View, Text, Document, Page } from "@react-pdf/renderer"
import {
  LABEL_TIPO_MOV,
  formatarDataSimples,
  formatarDataHoraExportacao,
  type MovimentacaoDetalhadaRow,
} from "./relatorios"

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    backgroundColor: "#ffffff",
  },
  titulo: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1a1a1a",
  },
  subtitulo: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 12,
  },
  filtros: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  resumoBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  resumoItem: {
    flexGrow: 1,
    minWidth: "22%",
    padding: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    backgroundColor: "#fafafa",
  },
  resumoValor: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  resumoLabel: {
    fontSize: 7,
    color: "#666666",
    textTransform: "uppercase",
    marginTop: 2,
  },
  tabelaHeader: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  headerTexto: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#333333",
    textTransform: "uppercase",
  },
  tabelaRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
  },
  celTexto: {
    fontSize: 7,
    color: "#333333",
  },
  colData: { width: "13%" },
  colTipo: { width: "9%" },
  colMaterial: { width: "24%" },
  colCategoria: { width: "13%" },
  colQtd: { width: "9%", textAlign: "right" },
  colMotivo: { width: "20%" },
  colUsuario: { width: "12%" },
  vazio: {
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 8,
  },
  rodape: {
    fontSize: 7,
    color: "#666666",
    marginTop: 8,
    textAlign: "right",
  },
})

interface PDFRelatorioProps {
  movimentacoes: MovimentacaoDetalhadaRow[]
  dataInicio: Date
  dataFim: Date
  filtros?: {
    categoriaNome?: string
    tipo?: string
  }
}

function ResumoKpis({ movimentacoes }: { movimentacoes: MovimentacaoDetalhadaRow[] }) {
  const porTipo = (tipo: string) => movimentacoes.filter((m) => m.tipo === tipo).length

  const itens = [
    { label: "Total", valor: String(movimentacoes.length) },
    { label: "Entradas", valor: String(porTipo("ENTRADA")) },
    { label: "Saídas", valor: String(porTipo("SAIDA")) },
    { label: "Ajustes", valor: String(porTipo("AJUSTE")) },
    { label: "Descartes", valor: String(porTipo("DESCARTE")) },
  ]

  return (
    <View style={styles.resumoBox}>
      {itens.map((item) => (
        <View key={item.label} style={styles.resumoItem}>
          <Text style={styles.resumoValor}>{item.valor}</Text>
          <Text style={styles.resumoLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

export function PDFRelatorio({ movimentacoes, dataInicio, dataFim, filtros = {} }: PDFRelatorioProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>Relatório de Movimentações</Text>
        <Text style={styles.subtitulo}>
          Período: {formatarDataSimples(dataInicio)} a {formatarDataSimples(dataFim)}
        </Text>

        <View style={styles.filtros}>
          <Text>
            {filtros.categoriaNome ? `Categoria: ${filtros.categoriaNome}  •  ` : ""}
            {filtros.tipo ? `Tipo: ${LABEL_TIPO_MOV[filtros.tipo] ?? filtros.tipo}  •  ` : ""}
            {movimentacoes.length} movimentaç{movimentacoes.length !== 1 ? "ões" : "ão"} no período
          </Text>
        </View>

        <ResumoKpis movimentacoes={movimentacoes} />

        {movimentacoes.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma movimentação encontrada para o período selecionado.</Text>
        ) : (
          <>
            <View style={styles.tabelaHeader} fixed>
              <Text style={[styles.headerTexto, styles.colData]}>Data/Hora</Text>
              <Text style={[styles.headerTexto, styles.colTipo]}>Tipo</Text>
              <Text style={[styles.headerTexto, styles.colMaterial]}>Material</Text>
              <Text style={[styles.headerTexto, styles.colCategoria]}>Categoria</Text>
              <Text style={[styles.headerTexto, styles.colQtd]}>Qtd.</Text>
              <Text style={[styles.headerTexto, styles.colMotivo]}>Motivo</Text>
              <Text style={[styles.headerTexto, styles.colUsuario]}>Registrado por</Text>
            </View>

            {movimentacoes.map((mov) => (
              <View key={mov.id} style={styles.tabelaRow} wrap={false}>
                <Text style={[styles.celTexto, styles.colData]}>
                  {formatarDataHoraExportacao(mov.createdAt)}
                </Text>
                <Text style={[styles.celTexto, styles.colTipo]}>
                  {LABEL_TIPO_MOV[mov.tipo] ?? mov.tipo}
                </Text>
                <Text style={[styles.celTexto, styles.colMaterial]}>
                  {mov.materialNome} ({mov.codigoInterno})
                </Text>
                <Text style={[styles.celTexto, styles.colCategoria]}>{mov.categoriaNome}</Text>
                <Text style={[styles.celTexto, styles.colQtd]}>
                  {mov.quantidade} {mov.unidadeSigla}
                </Text>
                <Text style={[styles.celTexto, styles.colMotivo]}>{mov.motivo ?? "—"}</Text>
                <Text style={[styles.celTexto, styles.colUsuario]}>{mov.usuarioNome}</Text>
              </View>
            ))}

            <Text style={styles.rodape}>
              Relatório gerado em {formatarDataHoraExportacao(new Date())}
            </Text>
          </>
        )}
      </Page>
    </Document>
  )
}

export async function gerarPdfRelatorio(
  movimentacoes: MovimentacaoDetalhadaRow[],
  dataInicio: Date,
  dataFim: Date,
  filtros?: { categoriaNome?: string; tipo?: string }
): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer")

  const pdf = (
    <PDFRelatorio
      movimentacoes={movimentacoes}
      dataInicio={dataInicio}
      dataFim={dataFim}
      filtros={filtros}
    />
  )
  const buffer = await renderToBuffer(pdf)
  return buffer
}

export default gerarPdfRelatorio