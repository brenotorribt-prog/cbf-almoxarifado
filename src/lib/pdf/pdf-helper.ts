// lib/pdf-helper.ts

/**
 * Baixa o PDF de uma movimentação ou empréstimo
 */
export async function downloadPDF(
  tipo: 'movimentacao' | 'emprestimo', 
  id: string, 
  filename?: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/pdf?tipo=${tipo}&id=${id}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao baixar o PDF')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `${tipo}-${id}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return true
  } catch (error) {
    console.error('Erro ao baixar PDF:', error)
    throw error
  }
}

/**
 * Abre o PDF em uma nova aba (visualização)
 */
export async function viewPDF(
  tipo: 'movimentacao' | 'emprestimo', 
  id: string
): Promise<void> {
  try {
    const response = await fetch(`/api/pdf?tipo=${tipo}&id=${id}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao gerar o PDF')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    console.error('Erro ao abrir PDF:', error)
    throw error
  }
}