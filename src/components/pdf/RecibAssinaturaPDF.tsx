// components/pdf/RecibAssinaturaPDF.tsx
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles } from '@/lib/pdf-utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Image } from '@react-pdf/renderer'

export interface ItemRecibo {
  nome: string
  codigoInterno: string
  quantidade: number
  unidade: string
}

export interface ReciboAssinaturaProps {
  tipoDocumento: 'SAIDA' | 'EMPRESTIMO'
  data: Date
  solicitanteNome: string
  solicitanteSetor?: string | null
  solicitanteFuncao?: string | null
  itens: ItemRecibo[]
  motivo?: string | null
  dataPrevistaDevolucao?: Date | null
  logoUrl?: string
  footerLogoUrl?: string
}

export function ReciboAssinaturaPDF({
  tipoDocumento,
  data,
  solicitanteNome,
  solicitanteSetor,
  solicitanteFuncao,
  itens,
  motivo,
  dataPrevistaDevolucao,
  logoUrl,
  footerLogoUrl,
}: ReciboAssinaturaProps) {
  const titulo = tipoDocumento === 'SAIDA' ? 'RECIBO DE RETIRADA DE MATERIAL' : 'TERMO DE EMPRÉSTIMO DE MATERIAL'
  const dataFormatada = format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* CABEÇALHO COM LOGO */}
        <View style={pdfStyles.header}>
          {logoUrl && <Image src={logoUrl} style={pdfStyles.logo} />}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.title}>{titulo}</Text>
            <Text style={pdfStyles.subtitle}>Sistema de Almoxarifado CBF</Text>
          </View>
        </View>

        {/* AVISO DE PRÉVIA */}
        <View
          style={{
            backgroundColor: '#fef3c7',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#fcd34d',
            borderRadius: 4,
            padding: 8,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 8, color: '#92400e' }}>
            PRÉVIA PARA ASSINATURA — documento gerado antes da confirmação no sistema. Emitido em {dataFormatada}
          </Text>
        </View>

        {/* SOLICITANTE */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Dados do Solicitante</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Nome:</Text>
            <Text style={pdfStyles.value}>{solicitanteNome || '—'}</Text>
          </View>
          {solicitanteSetor && (
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Setor:</Text>
              <Text style={pdfStyles.value}>{solicitanteSetor}</Text>
            </View>
          )}
          {solicitanteFuncao && (
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Função:</Text>
              <Text style={pdfStyles.value}>{solicitanteFuncao}</Text>
            </View>
          )}
          {tipoDocumento === 'EMPRESTIMO' && dataPrevistaDevolucao && (
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Devolução prevista:</Text>
              <Text style={pdfStyles.value}>{format(dataPrevistaDevolucao, 'dd/MM/yyyy', { locale: ptBR })}</Text>
            </View>
          )}
        </View>

        {/* ITENS */}
        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeader}>
            <Text style={[pdfStyles.tableHeaderCell, { width: '46%' }]}>Material</Text>
            <Text style={[pdfStyles.tableHeaderCell, { width: '22%' }]}>Código</Text>
            <Text style={[pdfStyles.tableHeaderCell, { width: '16%', textAlign: 'right' }]}>Qtd.</Text>
            <Text style={[pdfStyles.tableHeaderCell, { width: '16%' }]}>Unidade</Text>
          </View>
          {itens.map((item, i) => (
            <View key={i} style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: '46%' }]}>{item.nome}</Text>
              <Text style={[pdfStyles.tableCell, { width: '22%' }]}>{item.codigoInterno}</Text>
              <Text style={[pdfStyles.tableCell, { width: '16%', textAlign: 'right' }]}>{item.quantidade}</Text>
              <Text style={[pdfStyles.tableCell, { width: '16%' }]}>{item.unidade}</Text>
            </View>
          ))}
        </View>

        {/* MOTIVO / OBSERVAÇÕES */}
        {motivo && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Motivo / Observações</Text>
            <Text style={pdfStyles.value}>{motivo}</Text>
          </View>
        )}

        {/* ASSINATURAS */}
        <View style={pdfStyles.signature}>
          <View style={pdfStyles.signatureRow}>
            <View style={pdfStyles.signatureBox}>
              <View style={pdfStyles.signatureLine} />
              <Text style={pdfStyles.signatureName}>Entregue por (Almoxarife)</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <View style={pdfStyles.signatureLine} />
              <Text style={pdfStyles.signatureName}>Recebido por ({solicitanteNome || 'Solicitante'})</Text>
            </View>
          </View>
        </View>

        {/* RODAPÉ */}
        <View style={pdfStyles.footer} fixed>
          {footerLogoUrl && <Image src={footerLogoUrl} style={pdfStyles.footerLogo} />}
          <Text style={pdfStyles.footerText}>Documento gerado em {dataFormatada}</Text>
        </View>
      </Page>
    </Document>
  )
}