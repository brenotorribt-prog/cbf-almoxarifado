// lib/pdf-utils.ts
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'

// Registra a fonte (opcional, mas recomendado para melhor aparência)
// Você pode usar fontes do Google ou deixar a padrão
Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2',
})

// Estilos compartilhados
export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 30,
    paddingBottom: 30,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: '1px solid #e5e7eb',
  },
  logo: {
    width: 120,
    height: 'auto',
  },
  headerText: {
    textAlign: 'right',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a67c1',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  section: {
    marginVertical: 8,
    padding: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    color: '#6b7280',
    width: '30%',
  },
  value: {
    fontSize: 10,
    color: '#1f2937',
    width: '70%',
    fontWeight: 'medium',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    paddingVertical: 4,
  },
  table: {
    marginVertical: 8,
    border: '1px solid #e5e7eb',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottom: '1px solid #e5e7eb',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #f3f4f6',
  },
  tableCell: {
    fontSize: 10,
    color: '#1f2937',
  },
  signature: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: '1px solid #e5e7eb',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  signatureBox: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  signatureLine: {
    borderBottom: '1px solid #1f2937',
    width: '100%',
    height: 20,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
    color: '#1f2937',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTop: '1px solid #e5e7eb',
  },
  footerLogo: {
    width: 80,
    height: 'auto',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  badgeSuccess: {
    backgroundColor: '#00B347',
  },
  badgeWarning: {
    backgroundColor: '#FFDC02',
    color: '#1f2937',
  },
  badgeError: {
    backgroundColor: '#E53935',
  },
  badgeInfo: {
    backgroundColor: '#3D7DFF',
  },
})