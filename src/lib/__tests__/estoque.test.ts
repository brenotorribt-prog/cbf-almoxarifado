import { describe, expect, it } from "vitest"
import { calcularEstoqueNovo, validaUnidadeInteira } from "../estoque"

describe("calcularEstoqueNovo — ENTRADA", () => {
  it("soma a quantidade ao saldo e registra o delta positivo", () => {
    const r = calcularEstoqueNovo("ENTRADA", 10, 5)
    expect(r.ok).toBe(true)
    expect(r.estoqueNovo).toBe(15)
    expect(r.delta).toBe(5)
  })
})

describe("calcularEstoqueNovo — SAIDA", () => {
  it("subtrai a quantidade do saldo", () => {
    const r = calcularEstoqueNovo("SAIDA", 10, 3)
    expect(r.ok).toBe(true)
    expect(r.estoqueNovo).toBe(7)
    expect(r.delta).toBe(3)
  })

  it("bloqueia saída com saldo insuficiente", () => {
    const r = calcularEstoqueNovo("SAIDA", 10, 13)
    expect(r.ok).toBe(false)
    expect(r.erro).toBe("ESTOQUE_INSUFICIENTE")
  })

  it("permite zerar o saldo", () => {
    const r = calcularEstoqueNovo("SAIDA", 10, 10)
    expect(r.ok).toBe(true)
    expect(r.estoqueNovo).toBe(0)
  })
})

describe("calcularEstoqueNovo — AJUSTE", () => {
  it("define o valor absoluto final e registra o delta real (pode ser negativo)", () => {
    const r = calcularEstoqueNovo("AJUSTE", 10, 8)
    expect(r.ok).toBe(true)
    expect(r.estoqueNovo).toBe(8)
    expect(r.delta).toBe(-2)
  })

  it("bloqueia ajuste com valor negativo", () => {
    const r = calcularEstoqueNovo("AJUSTE", 10, -1)
    expect(r.ok).toBe(false)
    expect(r.erro).toBe("AJUSTE_NEGATIVO")
  })
})

describe("validaUnidadeInteira", () => {
  it("unidade inteira rejeita fração", () => {
    expect(validaUnidadeInteira("INTEIRA", 2.5)).toBe(false)
  })

  it("unidade inteira aceita número inteiro", () => {
    expect(validaUnidadeInteira("INTEIRA", 3)).toBe(true)
  })

  it("unidade fracionada aceita decimal", () => {
    expect(validaUnidadeInteira("FRACIONADA", 2.5)).toBe(true)
  })

  it("sem tipo de unidade informado assume exigência de inteiro", () => {
    expect(validaUnidadeInteira(undefined, 1.5)).toBe(false)
    expect(validaUnidadeInteira(undefined, 4)).toBe(true)
  })
})