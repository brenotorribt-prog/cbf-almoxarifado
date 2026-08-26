// =====================================================================
// CÁLCULO DE ESTOQUE (regra crítica de negócio)
// =====================================================================
//
// Funções puras que centralizam a matemática de saldo usada pelas rotas
// de movimentação, empréstimo e entrega de requisição. Extraídas para
// permitir teste unitário sem banco de dados e garantir que a regra é a
// mesma em todos os pontos de escrita de estoque.

export type TipoMovimentacaoCalculo = "ENTRADA" | "SAIDA" | "AJUSTE"

export interface ResultadoCalculoEstoque {
  ok: boolean
  /** Saldo final após a operação — presente quando `ok === true`. */
  estoqueNovo?: number
  /**
   * Valor a gravar no campo `quantidade` do registro de movimentação:
   * o delta real (pode ser negativo) em AJUSTE, ou a quantidade
   * lançada em ENTRADA/SAIDA. Presente quando `ok === true`.
   */
  delta?: number
  erro?: "ESTOQUE_INSUFICIENTE" | "AJUSTE_NEGATIVO"
}

/**
 * Calcula o saldo novo e o delta a registrar.
 * - ENTRADA: soma a quantidade ao saldo.
 * - SAIDA: subtrai a quantidade; bloqueia saldo negativo.
 * - AJUSTE: a quantidade é o VALOR ABSOLUTO final (não um delta);
 *   bloqueia valor negativo.
 */
export function calcularEstoqueNovo(
  tipo: TipoMovimentacaoCalculo,
  estoqueAtual: number,
  quantidade: number
): ResultadoCalculoEstoque {
  if (tipo === "ENTRADA") {
    return { ok: true, estoqueNovo: estoqueAtual + quantidade, delta: quantidade }
  }

  if (tipo === "SAIDA") {
    const estoqueNovo = estoqueAtual - quantidade
    if (estoqueNovo < 0) {
      return { ok: false, erro: "ESTOQUE_INSUFICIENTE" }
    }
    return { ok: true, estoqueNovo, delta: quantidade }
  }

  // AJUSTE — valor absoluto final contado fisicamente.
  if (quantidade < 0) {
    return { ok: false, erro: "AJUSTE_NEGATIVO" }
  }
  return { ok: true, estoqueNovo: quantidade, delta: quantidade - estoqueAtual }
}

/**
 * Valida se a quantidade respeita o tipo da unidade de medida:
 * unidades inteiras rejeitam frações; fracionadas aceitam decimais.
 */
export function validaUnidadeInteira(
  tipoUnidade: string | undefined,
  quantidade: number
): boolean {
  if (tipoUnidade === "FRACIONADA") return true
  return Number.isInteger(quantidade)
}