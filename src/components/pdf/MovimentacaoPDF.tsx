// components/pdf/MovimentacaoPDF.tsx
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles } from '@/lib/pdf-utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MovimentacaoPDFProps {
  data: {
    id: string
    tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'DESCARTE'
    quantidade: number
    quantidadeAnterior: number
    quantidadeAtual: number
    motivo: string | null
    documentoReferencia: string | null
    solicitanteNome: string | null
    solicitanteSetor: string | null
    createdAt: string
    material: {
      nome: string
      codigoInterno: string
      unidadeMedida: { sigla: string }
    }
    usuario: { name: string }
  }
  logoUrl?: string
  footerLogoUrl?: string
}

export function MovimentacaoPDF({ data, logoUrl, footerLogoUrl }: MovimentacaoPDFProps) {
  const tipoLabel = {
    ENTRADA: 'Entrada',
    SAIDA: 'Saída',
    AJUSTE: 'Ajuste',
    DESCARTE: 'Descarte',
  }[data.tipo]

  const tipoColor = {
    ENTRADA: pdfStyles.badgeSuccess,
    SAIDA: pdfStyles.badgeError,
    AJUSTE: pdfStyles.badgeInfo,
    DESCARTE: pdfStyles.badgeWarning,
  }[data.tipo]

  const formattedDate = format(new Date(data.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const dataFormatada = format(new Date(data.createdAt), "dd/MM/yyyy", { locale: ptBR })
  const horaFormatada = format(new Date(data.createdAt), "HH:mm", { locale: ptBR })

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* CABEÇALHO COM LOGO */}
        <View style={pdfStyles.header}>
          {logoUrl && (
            <Image src={logoUrl} style={pdfStyles.logo} />
          )}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.title}>COMPROVANTE DE MOVIMENTAÇÃO</Text>
            <Text style={pdfStyles.subtitle}>Sistema de Almoxarifado CBF</Text>
          </View>
        </View>

        {/* INFORMAÇÕES DO DOCUMENTO */}
        <View style={pdfStyles.section}>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Nº do documento:</Text>
            <Text style={pdfStyles.value}>{data.id}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Data:</Text>
            <Text style={pdfStyles.value}>{dataFormatada}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Horário:</Text>
            <Text style={pdfStyles.value}>{horaFormatada}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Tipo:</Text>
            <Text style={[pdfStyles.value, { color: data.tipo === 'ENTRADA' ? '#00B347' : data.tipo === 'SAIDA' ? '#E53935' : '#3D7DFF' }]}>
              {tipoLabel}
            </Text>
          </View>
        </View>

        {/* DADOS DO MATERIAL */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Dados do Material</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Código:</Text>
            <Text style={pdfStyles.value}>{data.material.codigoInterno}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Material:</Text>
            <Text style={pdfStyles.value}>{data.material.nome}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Quantidade:</Text>
            <Text style={pdfStyles.value}>
              {data.quantidade} {data.material.unidadeMedida.sigla}
            </Text>
          </View>
        </View>

        {/* CONTROLE DE ESTOQUE */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Controle de Estoque</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Estoque anterior:</Text>
            <Text style={pdfStyles.value}>
              {data.quantidadeAnterior} {data.material.unidadeMedida.sigla}
            </Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Estoque atual:</Text>
            <Text style={pdfStyles.value}>
              {data.quantidadeAtual} {data.material.unidadeMedida.sigla}
            </Text>
          </View>
        </View>

        {/* MOTIVO E DOCUMENTO DE REFERÊNCIA */}
        {(data.motivo || data.documentoReferencia) && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Informações Adicionais</Text>
            {data.motivo && (
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Motivo:</Text>
                <Text style={pdfStyles.value}>{data.motivo}</Text>
              </View>
            )}
            {data.documentoReferencia && (
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Documento:</Text>
                <Text style={pdfStyles.value}>{data.documentoReferencia}</Text>
              </View>
            )}
          </View>
        )}

        {/* SOLICITANTE */}
        {data.solicitanteNome && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Solicitante</Text>
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Nome:</Text>
              <Text style={pdfStyles.value}>{data.solicitanteNome}</Text>
            </View>
            {data.solicitanteSetor && (
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Setor:</Text>
                <Text style={pdfStyles.value}>{data.solicitanteSetor}</Text>
              </View>
            )}
          </View>
        )}

        {/* RESPONSÁVEL PELO REGISTRO */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Responsável pelo Registro</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Nome:</Text>
            <Text style={pdfStyles.value}>{data.usuario.name}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Data/Hora:</Text>
            <Text style={pdfStyles.value}>{formattedDate}</Text>
          </View>
        </View>

        {/* ASSINATURAS */}
        <View style={pdfStyles.signature}>
          <View style={pdfStyles.signatureRow}>
            <View style={pdfStyles.signatureBox}>
              <Text style={pdfStyles.signatureLabel}>___________________________________</Text>
              <Text style={pdfStyles.signatureName}>Assinatura do Retirante</Text>
            </View>
            <View style={pdfStyles.signatureBox}>
              <Text style={pdfStyles.signatureLabel}>___________________________________</Text>
              <Text style={pdfStyles.signatureName}>Assinatura do Almoxarife</Text>
            </View>
          </View>
        </View>

        {/* RODAPÉ COM LOGO */}
        <View style={pdfStyles.footer} fixed>
          {footerLogoUrl && (
            <Image src={footerLogoUrl} style={pdfStyles.footerLogo} />
          )}
          <Text style={pdfStyles.footerText}>
            Documento gerado em {formattedDate}
          </Text>
        </View>
      </Page>
    </Document>
  )
}