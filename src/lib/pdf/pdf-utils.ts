// lib/pdf-utils.ts
import { StyleSheet } from '@react-pdf/renderer'

// REMOVIDO: registro de fonte Inter (usando Helvetica padrão)

// Estilos compartilhados - CORRIGIDO e OTIMIZADO
export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 30,
    paddingBottom: 75, // ↑ de 30 pra 75 — reserva espaço suficiente pro rodapé fixo
                        // (logo ~24pt + borda + texto ~15pt não caber em cima do conteúdo normal)
    fontSize: 11,
    fontFamily: 'Helvetica', // Fonte padrão, sem necessidade de download
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    width: 120,
    height: 50,
    objectFit: 'contain',
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
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
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
    fontWeight: 'normal', // CORRIGIDO: 'medium' → 'normal'
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
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e5e7eb',
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
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#f3f4f6',
  },
  tableCell: {
    fontSize: 10,
    color: '#1f2937',
  },
  signature: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#e5e7eb',
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
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#1f2937',
    width: '100%',
    height: 20,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
    color: '#1f2937',
    textAlign: 'center',
  },
  // Nota de referência ao recibo físico assinado (substitui campo de assinatura
  // nos comprovantes — a assinatura fica só no recibo impresso e arquivado)
  notaRecibo: {
    marginTop: 16,
    marginBottom: 20, // ← adicionado: garante um respiro extra antes do fim do fluxo
    padding: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#bfdbfe',
    borderRadius: 4,
  },
  notaReciboTitulo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 3,
  },
  notaReciboTexto: {
    fontSize: 8,
    color: '#374151',
    lineHeight: 1.4,
  },
  // ========== NOVOS ESTILOS COMPACTOS ==========
  
  // Row mais compacto (menos padding vertical)
  rowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2, // antes era 4
  },
  
  // Section mais compacta (menos padding e margem)
  sectionCompact: {
    marginVertical: 4,
    padding: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  
  // Nota de recibo mais compacta
  notaReciboCompacta: {
    marginTop: 12,
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#bfdbfe',
    borderRadius: 4,
  },
  // ========== FIM NOVOS ESTILOS ==========
  
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#e5e7eb',
  },
  footerLogo: {
    width: 80,
    height: 24,
    objectFit: 'contain',
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