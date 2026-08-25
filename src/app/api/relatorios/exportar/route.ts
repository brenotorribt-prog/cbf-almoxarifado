// src/app/api/relatorios/exportar/route.ts
//
// GET /api/relatorios/exportar?formato=xlsx|csv|pdf&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&categoriaId=xxx&tipo=ENTRADA
//
// Gera o arquivo do relatório detalhado de movimentações respeitando os
// mesmos filtros da página. Segue o padrão de /api/compras/exportar.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth/require-role"
import {
  parseFiltrosRelatorio,
  buscarMovimentacoesDetalhadas,
  buscarEstoquePorPessoa,
  nomeArquivoRelatorio,
} from "@/lib/exportacoes/relatorios/relatorios"
import { gerarExcelRelatorio } from "@/lib/exportacoes/relatorios/relatorios-export-xlsx"
import { gerarCsvRelatorio } from "@/lib/exportacoes/relatorios/relatorios-export-csv"
import { gerarPdfRelatorio } from "@/lib/exportacoes/relatorios/relatorios-export-pdf"

export const runtime = "nodejs"

const FORMATOS_VALIDOS = new Set(["xlsx", "csv", "pdf"])

export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const formato = searchParams.get("formato") ?? "xlsx"
  if (!FORMATOS_VALIDOS.has(formato)) {
    return NextResponse.json({ error: "Formato de exportação inválido." }, { status: 400 })
  }

  const parsed = parseFiltrosRelatorio(searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.erro }, { status: 400 })
  }
  const filtros = parsed.filtros

  // Nome da categoria (quando filtrada) para constar no PDF
  let categoriaNome: string | undefined
  if (filtros.categoriaId) {
    const categoria = await prisma.categoria.findUnique({
      where: { id: filtros.categoriaId },
      select: { nome: true },
    })
    categoriaNome = categoria?.nome
  }

  try {
    const [movimentacoes, pessoas] = await Promise.all([
      buscarMovimentacoesDetalhadas(filtros),
      buscarEstoquePorPessoa(filtros),
    ])

    if (movimentacoes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma movimentação encontrada para o período/filtros selecionados." },
        { status: 404 }
      )
    }

    if (formato === "xlsx") {
      const buffer = await gerarExcelRelatorio(
        movimentacoes,
        { dataInicio: filtros.dataInicio, dataFim: filtros.dataFim },
        pessoas,
        { pessoa: filtros.pessoa }
      )
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio("xlsx")}"`,
        },
      })
    }

    if (formato === "csv") {
      const csv = gerarCsvRelatorio(movimentacoes)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio("csv")}"`,
        },
      })
    }

    // PDF
    const buffer = await gerarPdfRelatorio(
      movimentacoes,
      filtros.dataInicio,
      filtros.dataFim,
      { categoriaNome, tipo: filtros.tipo, pessoa: filtros.pessoa },
      pessoas
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio("pdf")}"`,
      },
    })
  } catch (err) {
    console.error("Erro ao exportar relatório:", err)
    return NextResponse.json({ error: "Falha ao exportar o relatório." }, { status: 500 })
  }
}