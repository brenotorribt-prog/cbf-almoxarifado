// components/pdf/EmprestimoPDF.tsx
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles } from '@/lib/pdf/pdf-utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface EmprestimoPDFProps {
  data: {
    id: string
    quantidade: number
    solicitanteNome: string
    solicitanteSetor: string | null
    solicitanteFuncao: string | null
    dataRetirada: string
    dataPrevistaDevolucao: string
    dataDevolucao: string | null
    status: string
    observacoes: string | null
    material: {
      nome: string
      codigoInterno: string
      unidadeMedida: { sigla: string }
    }
    responsavel: { name: string }
    aprovador: { name: string } | null
  }
  logoUrl?: string
  footerLogoUrl?: string
  isDevolucao?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE_APROVACAO: 'Pendente',
  EMPRESTADO: 'Emprestado',
  DEVOLVIDO: 'Devolvido',
  ATRASADO: 'Atrasado',
  PERDIDO: 'Perdido',
  REJEITADO: 'Rejeitado',
}

export function EmprestimoPDF({ data, logoUrl, footerLogoUrl, isDevolucao }: EmprestimoPDFProps) {
  const statusLabel = STATUS_LABEL[data.status] ?? data.status

  const formattedDate = format(new Date(data.dataRetirada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const dataRetiradaFormatada = format(new Date(data.dataRetirada), "dd/MM/yyyy", { locale: ptBR })
  const horaRetiradaFormatada = format(new Date(data.dataRetirada), "HH:mm", { locale: ptBR })
  const dataPrevistaFormatada = format(new Date(data.dataPrevistaDevolucao), "dd/MM/yyyy", { locale: ptBR })

  const title = isDevolucao ? 'COMPROVANTE DE DEVOLUÇÃO' : 'COMPROVANTE DE EMPRÉSTIMO'

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* CABEÇALHO COM LOGO */}
        <View style={pdfStyles.header}>
          {logoUrl && <Image src={logoUrl} style={pdfStyles.logo} />}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.title}>{title}</Text>
            <Text style={pdfStyles.subtitle}>Sistema de Almoxarifado CBF</Text>
          </View>
        </View>

        {/* INFORMAÇÕES DO DOCUMENTO - mais compacto */}
        <View style={pdfStyles.section}>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Documento:</Text>
            <Text style={pdfStyles.value}>{data.id}</Text>
          </View>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Retirada:</Text>
            <Text style={pdfStyles.value}>{dataRetiradaFormatada} {horaRetiradaFormatada}</Text>
          </View>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Status:</Text>
            <Text style={pdfStyles.value}>{statusLabel}</Text>
          </View>
        </View>

        {/* DADOS DO MATERIAL - mais compacto */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Material</Text>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Código:</Text>
            <Text style={pdfStyles.value}>{data.material.codigoInterno}</Text>
          </View>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Material:</Text>
            <Text style={pdfStyles.value}>{data.material.nome}</Text>
          </View>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Quantidade:</Text>
            <Text style={pdfStyles.value}>
              {data.quantidade} {data.material.unidadeMedida.sigla}
            </Text>
          </View>
        </View>

        {/* SOLICITANTE E PRAZO - condensados */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Solicitante</Text>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Nome:</Text>
            <Text style={pdfStyles.value}>
              {data.solicitanteNome}
              {data.solicitanteSetor && ` · ${data.solicitanteSetor}`}
              {data.solicitanteFuncao && ` (${data.solicitanteFuncao})`}
            </Text>
          </View>
          <View style={pdfStyles.rowCompact}>
            <Text style={pdfStyles.label}>Devolução:</Text>
            <Text style={pdfStyles.value}>
              {dataPrevistaFormatada}
              {data.dataDevolucao && ` (devolvido em ${format(new Date(data.dataDevolucao), "dd/MM/yyyy", { locale: ptBR })})`}
            </Text>
          </View>
        </View>

        {/* RESPONSÁVEL - condensado */}
        <View style={pdfStyles.sectionCompact}>
          <Text style={pdfStyles.sectionTitle}>Registrado por</Text>
          <Text style={pdfStyles.value}>
            {data.responsavel.name}
            {data.aprovador && ` · Aprovador: ${data.aprovador.name}`}
          </Text>
        </View>

        {/* OBSERVAÇÕES - opcional e compacto */}
        {data.observacoes && (
          <View style={pdfStyles.sectionCompact}>
            <Text style={pdfStyles.sectionTitle}>Observações</Text>
            <Text style={pdfStyles.value}>{data.observacoes}</Text>
          </View>
        )}

        {/* REFERÊNCIA AO RECIBO FÍSICO - versão mais compacta */}
        <View style={pdfStyles.notaReciboCompacta} wrap={false}>
          <Text style={pdfStyles.notaReciboTitulo}>📋 Comprovante digital</Text>
          <Text style={pdfStyles.notaReciboTexto}>
            {isDevolucao
              ? 'Registro digital da devolução. O comprovante físico assinado está arquivado.'
              : 'Registro digital do empréstimo. O termo físico assinado está arquivado.'}
          </Text>
        </View>

        {/* RODAPÉ COM LOGO */}
        <View style={pdfStyles.footer} fixed>
          {footerLogoUrl && <Image src={footerLogoUrl} style={pdfStyles.footerLogo} />}
          <Text style={pdfStyles.footerText}>Documento gerado em {formattedDate}</Text>
        </View>
      </Page>
    </Document>
  )
}