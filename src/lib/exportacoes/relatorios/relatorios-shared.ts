// src/lib/relatorios-shared.ts
//
// Tipos e helpers PUROS dos Relatórios compartilhados entre cliente e
// servidor. NÃO importa prisma nem módulos de Node — pode ser incluído
// no bundle do cliente sem problema (o módulo pesado com as queries é
// o src/lib/relatorios.ts, que reexporta tudo daqui).

/**
 * Uma linha por (pessoa × material) com o que a pessoa retirou no período,
 * separando consumo definitivo de material retornável:
 *
 * - retirado:  tudo que saiu pra pessoa
 * - consumido: saídas marcadas como uso definitivo (precisaRetorno = false,
 *              ou materiais CONSUMIVEL) — não voltam, não ficam "em posse"
 * - devolvido: entradas de devolução atribuídas à pessoa (via empréstimo
 *              ou via devolução avulsa vinculada à saída original)
 * - saldo:     EM POSSE = (retirado - consumido) - devolvido
 */
export interface EstoquePessoaRow {
  nome: string
  setor: string | null
  funcao: string | null
  materialId: string
  materialNome: string
  codigoInterno: string
  unidadeSigla: string
  retirado: number
  devolvido: number
  consumido: number
  /** (retirado - consumido) - devolvido = quantidade em posse da pessoa */
  saldo: number
}

/** Agrupamento por pessoa dos rows acima — usado na UI e nos exports. */
export interface PessoaEstoqueAgrupada {
  nome: string
  setor: string | null
  funcao: string | null
  itens: EstoquePessoaRow[]
  totalRetirado: number
  totalDevolvido: number
  totalConsumido: number
  totalSaldo: number
}

/**
 * Agrupa os rows (pessoa × material) por pessoa, somando totais.
 * Chave de agrupamento normalizada (nome+setor+função em minúsculas)
 * pra evitar duplicidade de blocos por diferença de caixa/trim.
 */
export function agruparEstoquePorPessoa(rows: EstoquePessoaRow[]): PessoaEstoqueAgrupada[] {
  const mapa = new Map<string, PessoaEstoqueAgrupada>()

  for (const row of rows) {
    const chave = `${row.nome.trim().toLowerCase()}|${(row.setor ?? "").trim().toLowerCase()}|${(row.funcao ?? "").trim().toLowerCase()}`

    let grupo = mapa.get(chave)
    if (!grupo) {
      grupo = {
        nome: row.nome,
        setor: row.setor,
        funcao: row.funcao,
        itens: [],
        totalRetirado: 0,
        totalDevolvido: 0,
        totalConsumido: 0,
        totalSaldo: 0,
      }
      mapa.set(chave, grupo)
    }

    grupo.itens.push(row)
    grupo.totalRetirado += row.retirado
    grupo.totalDevolvido += row.devolvido
    grupo.totalConsumido += row.consumido
    grupo.totalSaldo += row.saldo
  }

  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}