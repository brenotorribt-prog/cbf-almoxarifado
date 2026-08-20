// components/pdf/EmprestimoPDF.tsx
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles } from '@/lib/pdf-utils'
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
  PENDENTE_APROVACAO: 'Pendente de Aprovação',
  EMPRESTADO: 'Emprestado',
  DEVOLVIDO: 'Devolvido',
  ATRASADO: 'Atrasado',
  PERDIDO: 'Perdido/Descartado',
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

        {/* INFORMAÇÕES DO DOCUMENTO */}
        <View style={pdfStyles.section}>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Nº do documento:</Text>
            <Text style={pdfStyles.value}>{data.id}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Data da retirada:</Text>
            <Text style={pdfStyles.value}>{dataRetiradaFormatada}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Horário da retirada:</Text>
            <Text style={pdfStyles.value}>{horaRetiradaFormatada}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Status:</Text>
            <Text style={pdfStyles.value}>{statusLabel}</Text>
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

        {/* SOLICITANTE */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Dados do Solicitante</Text>
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
          {data.solicitanteFuncao && (
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Função:</Text>
              <Text style={pdfStyles.value}>{data.solicitanteFuncao}</Text>
            </View>
          )}
        </View>

        {/* PRAZO DE DEVOLUÇÃO */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Prazo de Devolução</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Data prevista:</Text>
            <Text style={pdfStyles.value}>{dataPrevistaFormatada}</Text>
          </View>
          {data.dataDevolucao && (
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Data devolvida:</Text>
              <Text style={pdfStyles.value}>
                {format(new Date(data.dataDevolucao), "dd/MM/yyyy", { locale: ptBR })}
              </Text>
            </View>
          )}
        </View>

        {/* RESPONSÁVEL */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Responsável</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Almoxarife:</Text>
            <Text style={pdfStyles.value}>{data.responsavel.name}</Text>
          </View>
          {data.aprovador && (
            <View style={pdfStyles.row}>
              <Text style={pdfStyles.label}>Aprovador:</Text>
              <Text style={pdfStyles.value}>{data.aprovador.name}</Text>
            </View>
          )}
        </View>

        {/* OBSERVAÇÕES */}
        {data.observacoes && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Observações</Text>
            <Text style={pdfStyles.value}>{data.observacoes}</Text>
          </View>
        )}

        {/* REFERÊNCIA AO RECIBO FÍSICO — a assinatura fica no recibo impresso e arquivado,
            não neste comprovante digital */}
        <View style={pdfStyles.notaRecibo} wrap={false}>
          <Text style={pdfStyles.notaReciboTitulo}>Comprovante de lançamento no sistema</Text>
          <Text style={pdfStyles.notaReciboTexto}>
            {isDevolucao
              ? 'Este documento é apenas o registro digital da devolução. O comprovante físico com a assinatura foi impresso separadamente e arquivado no almoxarifado.'
              : 'Este documento é apenas o registro digital do empréstimo. O termo físico com a assinatura do retirante foi impresso separadamente e arquivado no almoxarifado.'}
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