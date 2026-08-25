// src/app/api/relatorios/route.ts
//
// GET /api/relatorios?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&categoriaId=xxx&tipo=ENTRADA
//
// Retorna em UM único request todos os dados agregados da página de
// Relatórios: resumo por tipo, série temporal, top materiais, categorias
// movimentadas e snapshot do estoque atual. As queries vivem em
// src/lib/relatorios.ts para serem reaproveitadas pela exportação.

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/require-role"
import {
  parseFiltrosRelatorio,
  calcularGranularidade,
  buscarResumoPorTipo,
  buscarSerieTemporal,
  buscarTopMateriais,
  buscarCategoriasMovimentadas,
  buscarResumoEstoqueAtual,
} from "@/lib/relatorios"

export async function GET(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(request.url)
  const parsed = parseFiltrosRelatorio(searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.erro }, { status: 400 })
  }

  const filtros = parsed.filtros
  const granularidade = calcularGranularidade(filtros.dataInicio, filtros.dataFim)

  try {
    const [resumoPorTipo, serie, topMateriais, categorias, estoqueAtual] = await Promise.all([
      buscarResumoPorTipo(filtros),
      buscarSerieTemporal(filtros, granularidade),
      buscarTopMateriais(filtros),
      buscarCategoriasMovimentadas(filtros),
      buscarResumoEstoqueAtual(),
    ])

    return NextResponse.json({
      periodo: {
        dataInicio: filtros.dataInicio.toISOString(),
        dataFim: filtros.dataFim.toISOString(),
        granularidade,
      },
      filtrosAplicados: {
        categoriaId: filtros.categoriaId ?? null,
        tipo: filtros.tipo ?? null,
      },
      resumoPorTipo,
      serie,
      topMateriais,
      categorias,
      estoqueAtual,
    })
  } catch (err) {
    console.error("Erro ao gerar relatório:", err)
    return NextResponse.json({ error: "Falha ao gerar o relatório." }, { status: 500 })
  }
}