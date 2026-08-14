// src/app/api/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// Importações dos componentes PDF
import { MovimentacaoPDF } from '@/components/pdf/MovimentacaoPDF'
import { EmprestimoPDF } from '@/components/pdf/EmprestimoPDF'

// Helper para obter a URL base da aplicação
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

// ✅ Função para converter imagem para Base64
function getImageBase64(filePath: string): string | null {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath)
    console.log(`🔍 Procurando imagem em: ${fullPath}`)
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ Imagem não encontrada: ${filePath}`)
      return null
    }
    
    const buffer = fs.readFileSync(fullPath)
    const base64 = buffer.toString('base64')
    const ext = path.extname(filePath).substring(1) // png, jpg, etc
    console.log(`✅ Imagem carregada: ${filePath} (${buffer.length} bytes)`)
    return `data:image/${ext};base64,${base64}`
  } catch (error) {
    console.error(`❌ Erro ao ler imagem ${filePath}:`, error)
    return null
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const tipo = searchParams.get('tipo')
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'ID é obrigatório' },
      { status: 400 }
    )
  }

  try {
    // ✅ Carrega as imagens em Base64
    const logoBase64 = getImageBase64('CBFLO.png')
    const footerLogoBase64 = getImageBase64('CBFTEXT.png')

    // ================================================================
    // MOVIMENTAÇÃO
    // ================================================================
    if (tipo === 'movimentacao') {
      const movimentacao = await prisma.movimentacaoEstoque.findUnique({
        where: { id },
        include: {
          material: {
            include: {
              unidadeMedida: true,
            },
          },
          usuario: true,
        },
      })

      if (!movimentacao) {
        return NextResponse.json(
          { error: 'Movimentação não encontrada' },
          { status: 404 }
        )
      }

      // Cria o componente PDF
      const pdfComponent = MovimentacaoPDF({
        data: {
          id: movimentacao.id,
          tipo: movimentacao.tipo,
          quantidade: Number(movimentacao.quantidade),
          quantidadeAnterior: Number(movimentacao.quantidadeAnterior),
          quantidadeAtual: Number(movimentacao.quantidadeAtual),
          motivo: movimentacao.motivo,
          documentoReferencia: movimentacao.documentoReferencia,
          solicitanteNome: movimentacao.solicitanteNome,
          solicitanteSetor: movimentacao.solicitanteSetor,
          createdAt: movimentacao.createdAt.toISOString(),
          material: {
            nome: movimentacao.material.nome,
            codigoInterno: movimentacao.material.codigoInterno,
            unidadeMedida: {
              sigla: movimentacao.material.unidadeMedida.sigla,
            },
          },
          usuario: {
            name: movimentacao.usuario.name,
          },
        },
        logoUrl: logoBase64 || undefined,
        footerLogoUrl: footerLogoBase64 || undefined,
      })

      const pdfBuffer = await renderToBuffer(pdfComponent)
      const pdfData = new Uint8Array(pdfBuffer)

      return new NextResponse(pdfData, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=movimentacao-${movimentacao.id}.pdf`,
        },
      })
    }

    // ================================================================
    // EMPRÉSTIMO
    // ================================================================
    if (tipo === 'emprestimo') {
      const emprestimo = await prisma.emprestimo.findUnique({
        where: { id },
        include: {
          material: {
            include: {
              unidadeMedida: true,
            },
          },
          responsavel: true,
          aprovador: true,
        },
      })

      if (!emprestimo) {
        return NextResponse.json(
          { error: 'Empréstimo não encontrado' },
          { status: 404 }
        )
      }

      const pdfComponent = EmprestimoPDF({
        data: {
          id: emprestimo.id,
          quantidade: Number(emprestimo.quantidade),
          solicitanteNome: emprestimo.solicitanteNome,
          solicitanteSetor: emprestimo.solicitanteSetor,
          solicitanteFuncao: emprestimo.solicitanteFuncao,
          dataRetirada: emprestimo.dataRetirada.toISOString(),
          dataPrevistaDevolucao: emprestimo.dataPrevistaDevolucao.toISOString(),
          dataDevolucao: emprestimo.dataDevolucao?.toISOString() || null,
          status: emprestimo.status,
          observacoes: emprestimo.observacoes,
          material: {
            nome: emprestimo.material.nome,
            codigoInterno: emprestimo.material.codigoInterno,
            unidadeMedida: {
              sigla: emprestimo.material.unidadeMedida.sigla,
            },
          },
          responsavel: {
            name: emprestimo.responsavel.name,
          },
          aprovador: emprestimo.aprovador ? {
            name: emprestimo.aprovador.name,
          } : null,
        },
        logoUrl: logoBase64 || undefined,
        footerLogoUrl: footerLogoBase64 || undefined,
      })

      const pdfBuffer = await renderToBuffer(pdfComponent)
      const pdfData = new Uint8Array(pdfBuffer)

      return new NextResponse(pdfData, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=emprestimo-${emprestimo.id}.pdf`,
        },
      })
    }

    return NextResponse.json(
      { error: 'Tipo inválido. Use "movimentacao" ou "emprestimo"' },
      { status: 400 }
    )

  } catch (error) {
    console.error('❌ Erro ao gerar PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar o PDF' },
      { status: 500 }
    )
  }
}