import { NextRequest, NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'

// Importações dos componentes PDF
import { MovimentacaoPDF } from '@/components/pdf/MovimentacaoPDF'
import { EmprestimoPDF } from '@/components/pdf/EmprestimoPDF'

// Função para converter ReadableStream para Buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
    }
  }

  return Buffer.concat(chunks as any[])
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
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
    const baseUrl = getBaseUrl()
    const logoUrl = `${baseUrl}/CBFLO.png`
    const footerLogoUrl = `${baseUrl}/CBFTEXT.png`

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
        logoUrl: logoUrl,
        footerLogoUrl: footerLogoUrl,
      })

      const stream = await renderToStream(pdfComponent)
      const pdfBuffer = await streamToBuffer(stream)

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=movimentacao-${movimentacao.id}.pdf`,
        },
      })
    }

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
        logoUrl: logoUrl,
        footerLogoUrl: footerLogoUrl,
      })

      const stream = await renderToStream(pdfComponent)
      const pdfBuffer = await streamToBuffer(stream)

      return new NextResponse(new Uint8Array(pdfBuffer), {
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
    console.error('Erro ao gerar PDF:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar o PDF' },
      { status: 500 }
    )
  }
}