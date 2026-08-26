import { describe, expect, it } from "vitest"
import { formatarTelefone } from "../utils/telefone-mask"

describe("formatarTelefone", () => {
  it("formata 11 dígitos no padrão (00) 0 0000-0000", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 9 8765-4321")
  })

  it("ignora caracteres não numéricos", () => {
    expect(formatarTelefone(" (11) 98765-4321 x")).toBe("(11) 9 8765-4321")
  })

  it("corta além de 11 dígitos", () => {
    expect(formatarTelefone("119876543212345")).toBe("(11) 9 8765-4321")
  })

  it("formata progressivamente durante a digitação", () => {
    expect(formatarTelefone("")).toBe("")
    expect(formatarTelefone("11")).toBe("(11) ")
    expect(formatarTelefone("119")).toBe("(11) 9")
  })
})