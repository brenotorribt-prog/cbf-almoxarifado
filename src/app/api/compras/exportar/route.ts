// src/app/api/compras/exportar/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/require-role"
import {
  buscarPedidosParaExportacao,
  nomeArquivoExportacao,
} from "@/lib/exportacoes/compras/compras-export"
import { gerarExcelPedidos } from "@/lib/exportacoes/compras/compras-export-xlsx"
import { gerarCsvPedidos } from "@/lib/exportacoes/compras/compras-export-csv"
import { gerarPdfPedidos } from "@/lib/exportacoes/compras/compras-export-pdf"

export const runtime = "nodejs"

const FORMATOS_VALIDOS = new Set(["xlsx", "csv", "pdf"])

// GET /api/compras/exportar?formato=xlsx&dataInicio=2026-08-01&dataFim=2026-08-13&setor=...&status=...&busca=...
export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const formato = searchParams.get("formato") ?? "xlsx"
  if (!FORMATOS_VALIDOS.has(formato)) {
    return NextResponse.json({ error: "Formato de exportação inválido." }, { status: 400 })
  }

  const dataInicioParam = searchParams.get("dataInicio")
  const dataFimParam = searchParams.get("dataFim")
  if (!dataInicioParam || !dataFimParam) {
    return NextResponse.json(
      { error: "Informe o período (dataInicio e dataFim) para exportar." },
      { status: 400 }
    )
  }

  // início do dia / fim do dia, no fuso do servidor — simples e suficiente
  // pro caso de uso (relatório de compras, não é preciso ao segundo)
  const dataInicio = new Date(`${dataInicioParam}T00:00:00.000`)
  const dataFim = new Date(`${dataFimParam}T23:59:59.999`)

  // Validação inline do período
  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
    return NextResponse.json({ error: "Datas inválidas." }, { status: 400 })
  }
  if (dataInicio > dataFim) {
    return NextResponse.json({ error: "Data inicial não pode ser depois da data final." }, { status: 400 })
  }

  const setor = searchParams.get("setor")?.trim() || undefined
  const status = searchParams.get("status") || undefined
  const busca = searchParams.get("busca")?.trim() || undefined

  // Busca pedidos com os filtros — o período é filtrado NO BANCO (WHERE
  // createdAt BETWEEN), sem carregar a tabela inteira pra filtrar em JS.
  const pedidos = await buscarPedidosParaExportacao({ setor, status, busca, dataInicio, dataFim })

  if (formato === "xlsx") {
    const buffer = await gerarExcelPedidos(pedidos)
    // Converte Buffer para Uint8Array para compatibilidade com NextResponse
    const uint8Array = new Uint8Array(buffer)
    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivoExportacao("xlsx")}"`,
      },
    })
  }

  if (formato === "csv") {
    const csv = gerarCsvPedidos(pedidos)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivoExportacao("csv")}"`,
      },
    })
  }

  // PDF
  const buffer = await gerarPdfPedidos(pedidos, dataInicio, dataFim, { setor, status, busca })
  // Converte Buffer para Uint8Array para compatibilidade com NextResponse
  const uint8Array = new Uint8Array(buffer)
  return new NextResponse(uint8Array, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivoExportacao("pdf")}"`,
    },
  })
}