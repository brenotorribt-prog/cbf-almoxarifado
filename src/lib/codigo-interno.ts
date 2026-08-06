// Gera um código de 4 letras (A-Z) a partir do numeroSequencial do material.
// Base 26: AAAA (seq=1) até ZZZZ (seq=456.976) — dá pra cobrir 456 mil
// itens sem precisar de loop de colisão nem sorteio aleatório, já que
// numeroSequencial é um autoincrement único do Postgres.
export function gerarCodigoInterno(numeroSequencial: number): string {
  const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let n = numeroSequencial - 1 // zero-based
  let codigo = ""

  for (let i = 0; i < 4; i++) {
    codigo = LETRAS[n % 26] + codigo
    n = Math.floor(n / 26)
  }

  return codigo
}