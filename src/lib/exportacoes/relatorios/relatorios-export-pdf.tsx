// src/lib/relatorios-export-pdf.tsx
//
// Gerador PDF do relatório detalhado de movimentações.
// Segue o padrão de src/lib/compras-export-pdf.tsx (@react-pdf/renderer,
// renderToBuffer dinâmico, Helvetica).
// Cabeçalho e rodapé seguem o padrão visual do ReciboAssinaturaPDF
// (logo no topo, logo + data de geração no rodapé fixo).

import { StyleSheet, View, Text, Document, Page, Image } from "@react-pdf/renderer"
import { pdfStyles } from "@/lib/pdf/pdf-utils"
import { carregarLogosPdf } from "@/lib/pdf/pdf-logos-server"
import {
  LABEL_TIPO_MOV,
  formatarDataSimples,
  formatarDataHoraExportacao,
  type EstoquePessoaRow,
  type MovimentacaoDetalhadaRow,
} from "./relatorios"

const styles = StyleSheet.create({
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
  // ===== Seção "Estoque por Pessoa" =====
  secaoTitulo: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 18,
    marginBottom: 2,
  },
  secaoDescricao: {
    fontSize: 7,
    color: "#666666",
    marginBottom: 6,
  },
  // Larguras das colunas da tabela por pessoa
  pPessoa: { width: "15%" },
  pSetor: { width: "12%" },
  pMaterial: { width: "23%" },
  pCodigo: { width: "10%" },
  pUnidade: { width: "6%" },
  pRetirado: { width: "9%", textAlign: "right" },
  pDevolvido: { width: "9%", textAlign: "right" },
  pConsumido: { width: "8%", textAlign: "right" },
  pSaldo: { width: "8%", textAlign: "right", fontWeight: "bold" },
})

interface PDFRelatorioProps {
  movimentacoes: MovimentacaoDetalhadaRow[]
  dataInicio: Date
  dataFim: Date
  filtros?: {
    categoriaNome?: string
    tipo?: string
    pessoa?: string
  }
  pessoas?: EstoquePessoaRow[]
  logoUrl?: string
  footerLogoUrl?: string
}

/** Formata quantidade removendo zeros à direita (2.5 -> "2,5" / 3 -> "3"). */
function fmtQtd(n: number): string {
  const arredondado = Number(n.toFixed(3))
  return String(arredondado).replace(".", ",")
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

export function PDFRelatorio({
  movimentacoes,
  dataInicio,
  dataFim,
  filtros = {},
  pessoas = [],
  logoUrl,
  footerLogoUrl,
}: PDFRelatorioProps) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* CABEÇALHO COM LOGO (padrão RecibAssinaturaPDF) */}
        <View style={pdfStyles.header}>
          {logoUrl && <Image src={logoUrl} style={pdfStyles.logo} />}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.title}>Relatório de Movimentações</Text>
            <Text style={pdfStyles.subtitle}>Sistema de Almoxarifado CBF</Text>
          </View>
        </View>

        <Text style={styles.subtitulo}>
          Período: {formatarDataSimples(dataInicio)} a {formatarDataSimples(dataFim)}
        </Text>

        <View style={styles.filtros}>
          <Text>
            {filtros.categoriaNome ? `Categoria: ${filtros.categoriaNome}  •  ` : ""}
            {filtros.tipo ? `Tipo: ${LABEL_TIPO_MOV[filtros.tipo] ?? filtros.tipo}  •  ` : ""}
            {filtros.pessoa ? `Pessoa: ${filtros.pessoa}  •  ` : ""}
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
          </>
        )}

        {/* ESTOQUE POR PESSOA */}
        {pessoas.length > 0 && (
          <>
            <Text style={styles.secaoTitulo}>Estoque por Pessoa</Text>
            <Text style={styles.secaoDescricao}>
              O que cada pessoa retirou no período, o que devolveu e o saldo em posse.
            </Text>

            <View style={styles.tabelaHeader} fixed>
              <Text style={[styles.headerTexto, styles.pPessoa]}>Pessoa</Text>
              <Text style={[styles.headerTexto, styles.pSetor]}>Setor / Função</Text>
              <Text style={[styles.headerTexto, styles.pMaterial]}>Material</Text>
              <Text style={[styles.headerTexto, styles.pCodigo]}>Código</Text>
              <Text style={[styles.headerTexto, styles.pUnidade]}>Un.</Text>
              <Text style={[styles.headerTexto, styles.pRetirado]}>Retirado</Text>
              <Text style={[styles.headerTexto, styles.pDevolvido]}>Devolvido</Text>
              <Text style={[styles.headerTexto, styles.pConsumido]}>Consumido</Text>
              <Text style={[styles.headerTexto, styles.pSaldo]}>Em posse</Text>
            </View>

            {pessoas.map((p) => (
              <View key={`${p.nome}-${p.materialId}`} style={styles.tabelaRow} wrap={false}>
                <Text style={[styles.celTexto, styles.pPessoa]}>{p.nome}</Text>
                <Text style={[styles.celTexto, styles.pSetor]}>
                  {[p.setor, p.funcao].filter(Boolean).join(" / ") || "—"}
                </Text>
                <Text style={[styles.celTexto, styles.pMaterial]}>{p.materialNome}</Text>
                <Text style={[styles.celTexto, styles.pCodigo]}>{p.codigoInterno}</Text>
                <Text style={[styles.celTexto, styles.pUnidade]}>{p.unidadeSigla}</Text>
                <Text style={[styles.celTexto, styles.pRetirado]}>{fmtQtd(p.retirado)}</Text>
                <Text style={[styles.celTexto, styles.pDevolvido]}>{fmtQtd(p.devolvido)}</Text>
                <Text style={[styles.celTexto, styles.pConsumido]}>{fmtQtd(p.consumido)}</Text>
                <Text style={[styles.celTexto, styles.pSaldo]}>{fmtQtd(p.saldo)}</Text>
              </View>
            ))}
          </>
        )}

        {/* RODAPÉ FIXO COM LOGO (padrão RecibAssinaturaPDF) */}
        <View style={pdfStyles.footer} fixed>
          {footerLogoUrl && <Image src={footerLogoUrl} style={pdfStyles.footerLogo} />}
          <Text style={pdfStyles.footerText}>
            Documento gerado em {formatarDataHoraExportacao(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function gerarPdfRelatorio(
  movimentacoes: MovimentacaoDetalhadaRow[],
  dataInicio: Date,
  dataFim: Date,
  filtros?: { categoriaNome?: string; tipo?: string; pessoa?: string },
  pessoas: EstoquePessoaRow[] = []
): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer")
  const { logoUrl, footerLogoUrl } = carregarLogosPdf()

  const pdf = (
    <PDFRelatorio
      movimentacoes={movimentacoes}
      dataInicio={dataInicio}
      dataFim={dataFim}
      filtros={filtros}
      pessoas={pessoas}
      logoUrl={logoUrl}
      footerLogoUrl={footerLogoUrl}
    />
  )
  const buffer = await renderToBuffer(pdf)
  return buffer
}

export default gerarPdfRelatorio