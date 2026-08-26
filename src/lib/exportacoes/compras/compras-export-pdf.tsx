// src/lib/compras-export-pdf.ts
// Cabeçalho e rodapé seguem o padrão visual do ReciboAssinaturaPDF
// (logo no topo, logo + data de geração no rodapé fixo).
import { StyleSheet, View, Text, Document, Page, Font, Image } from "@react-pdf/renderer"
import { pdfStyles } from "@/lib/pdf/pdf-utils"
import { carregarLogosPdf } from "@/lib/pdf/pdf-logos-server"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { 
  resolverDetalhesItem, 
  STATUS_PEDIDO_LABEL, 
  STATUS_ITEM_LABEL, 
  formatarDataSimples,
  type PedidoParaExportar 
} from "./compras-export"

// =====================================================================
// CONFIGURAÇÃO DE FONTES
// =====================================================================

// Registrar fontes para melhor suporte a caracteres especiais
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
})

// =====================================================================
// ESTILOS
// =====================================================================

const styles = StyleSheet.create({
  subtitulo: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 16,
  },
  filtros: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  pedidoBox: {
    marginBottom: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    backgroundColor: "#fafafa",
  },
  pedidoTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  pedidoNumero: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  statusBadge: {
    fontSize: 8,
    fontWeight: "bold",
    padding: "2px 8px",
    borderRadius: 12,
    backgroundColor: "#e8f0fe",
    color: "#1a73e8",
  },
  solicitanteLinha: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 6,
    fontSize: 8,
    color: "#555555",
    flexWrap: "wrap",
  },
  tabelaHeader: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 4,
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
  // LARGURAS DAS COLUNAS (ajustadas conforme solicitado)
  colMaterial: { width: "26%" },
  colTipo: { width: "10%" },
  colMarcaFab: { width: "20%" },
  colQtd: { width: "8%", textAlign: "right" },
  colStatus: { width: "14%" },
  colPrazo: { width: "22%" },
  // Estilos adicionais
  vazio: {
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 8,
  },
  observacao: {
    fontSize: 7,
    color: "#666666",
    marginBottom: 4,
    fontStyle: "italic",
  },
  totalItems: {
    fontSize: 7,
    color: "#666666",
    marginTop: 4,
    textAlign: "right",
  },
})

// =====================================================================
// COMPONENTES
// =====================================================================

function PedidoSecao({ pedido }: { pedido: PedidoParaExportar }) {
  return (
    <View style={styles.pedidoBox} wrap={false}>
      {/* Cabeçalho do pedido */}
      <View style={styles.pedidoTopo}>
        <Text style={styles.pedidoNumero}>Pedido #{pedido.numero}</Text>
        <Text style={styles.statusBadge}>
          {STATUS_PEDIDO_LABEL[pedido.status] ?? pedido.status}
        </Text>
      </View>

      {/* Informações do solicitante */}
      <View style={styles.solicitanteLinha}>
        <Text>{pedido.solicitanteNome}</Text>
        <Text>• {pedido.solicitanteSetor}</Text>
        <Text>• {pedido.solicitanteFuncao}</Text>
        <Text>• {formatarDataSimples(pedido.createdAt)}</Text>
      </View>

      {/* Observações do pedido */}
      {pedido.observacoes && (
        <Text style={styles.observacao}>Obs.: {pedido.observacoes}</Text>
      )}

      {/* Cabeçalho da tabela de itens */}
      <View style={styles.tabelaHeader}>
        <Text style={[styles.headerTexto, styles.colMaterial]}>Material</Text>
        <Text style={[styles.headerTexto, styles.colTipo]}>Tipo</Text>
        <Text style={[styles.headerTexto, styles.colMarcaFab]}>Marca / Fabricante / Fornecedor</Text>
        <Text style={[styles.headerTexto, styles.colQtd]}>Qtd.</Text>
        <Text style={[styles.headerTexto, styles.colStatus]}>Status</Text>
        <Text style={[styles.headerTexto, styles.colPrazo]}>Prazo</Text>
      </View>

      {/* Lista de itens */}
      {pedido.itens.length === 0 && (
        <Text style={styles.vazio}>Sem itens neste pedido.</Text>
      )}

      {pedido.itens.map((item) => {
        const det = resolverDetalhesItem(item)
        const marcaFabFornecedor = [det.marca, det.fabricante, det.fornecedor]
          .filter(Boolean)
          .join(" / ") || "—"
        
        return (
          <View key={item.id} style={styles.tabelaRow}>
            <Text style={[styles.celTexto, styles.colMaterial]}>{det.nome}</Text>
            <Text style={[styles.celTexto, styles.colTipo]}>{det.tipoLabel}</Text>
            <Text style={[styles.celTexto, styles.colMarcaFab]}>
              {marcaFabFornecedor}
            </Text>
            <Text style={[styles.celTexto, styles.colQtd]}>
              {Number(item.quantidade)}
            </Text>
            <Text style={[styles.celTexto, styles.colStatus]}>
              {STATUS_ITEM_LABEL[item.status] ?? item.status}
            </Text>
            <Text style={[styles.celTexto, styles.colPrazo]}>
              {item.prazoMaximoNecessario 
                ? formatarDataSimples(item.prazoMaximoNecessario) 
                : "—"}
            </Text>
          </View>
        )
      })}

      {/* Total de itens */}
      <Text style={styles.totalItems}>
        Total: {pedido.itens.length} item{pedido.itens.length !== 1 ? "s" : ""}
      </Text>
    </View>
  )
}

// =====================================================================
// COMPONENTE PRINCIPAL DO PDF
// =====================================================================

interface PDFComprasProps {
  pedidos: PedidoParaExportar[]
  dataInicio: Date
  dataFim: Date
  filtros?: {
    setor?: string
    status?: string
    busca?: string
  }
  logoUrl?: string
  footerLogoUrl?: string
}

export function PDFCompras({
  pedidos,
  dataInicio,
  dataFim,
  filtros = {},
  logoUrl,
  footerLogoUrl,
}: PDFComprasProps) {
  const totalItens = pedidos.reduce((acc, p) => acc + p.itens.length, 0)
  
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* CABEÇALHO COM LOGO (padrão RecibAssinaturaPDF) */}
        <View style={pdfStyles.header}>
          {logoUrl && <Image src={logoUrl} style={pdfStyles.logo} />}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.title}>Relatório de Pedidos de Compra</Text>
            <Text style={pdfStyles.subtitle}>Sistema de Almoxarifado CBF</Text>
          </View>
        </View>

        <Text style={styles.subtitulo}>
          Período: {formatarDataSimples(dataInicio)} a {formatarDataSimples(dataFim)}
        </Text>
        
        {/* Filtros aplicados */}
        <View style={styles.filtros}>
          <Text>
            {filtros.setor ? `Setor: ${filtros.setor}  •  ` : ""}
            {filtros.status ? `Status: ${STATUS_PEDIDO_LABEL[filtros.status] ?? filtros.status}  •  ` : ""}
            {filtros.busca ? `Busca: "${filtros.busca}"  •  ` : ""}
            {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} • {totalItens} item{totalItens !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Lista de pedidos */}
        {pedidos.length === 0 ? (
          <Text style={styles.vazio}>Nenhum pedido encontrado para o período selecionado.</Text>
        ) : (
          pedidos.map((pedido) => (
            <PedidoSecao key={pedido.id} pedido={pedido} />
          ))
        )}

        {/* RODAPÉ FIXO COM LOGO (padrão RecibAssinaturaPDF) */}
        <View style={pdfStyles.footer} fixed>
          {footerLogoUrl && <Image src={footerLogoUrl} style={pdfStyles.footerLogo} />}
          <Text style={pdfStyles.footerText}>
            Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// =====================================================================
// FUNÇÃO PRINCIPAL DE GERAÇÃO DO PDF
// =====================================================================

export async function gerarPdfPedidos(
  pedidos: PedidoParaExportar[], 
  dataInicio: Date,
  dataFim: Date,
  filtros?: {
    setor?: string
    status?: string
    busca?: string
  }
) {
  const { renderToBuffer } = await import("@react-pdf/renderer")
  const { logoUrl, footerLogoUrl } = await carregarLogosPdf()

  const pdf = (
    <PDFCompras
      pedidos={pedidos}
      dataInicio={dataInicio}
      dataFim={dataFim}
      filtros={filtros}
      logoUrl={logoUrl}
      footerLogoUrl={footerLogoUrl}
    />
  )
  const buffer = await renderToBuffer(pdf)
  
  return buffer
}

export default gerarPdfPedidos