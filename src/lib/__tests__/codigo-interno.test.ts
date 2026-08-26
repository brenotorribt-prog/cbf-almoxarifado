import { describe, expect, it } from "vitest"
import { gerarCodigoInterno } from "../utils/codigo-interno"

describe("gerarCodigoInterno", () => {
  it("seq 1 → AAAA", () => {
    expect(gerarCodigoInterno(1)).toBe("AAAA")
  })

  it("seq 2 → AAAB", () => {
    expect(gerarCodigoInterno(2)).toBe("AAAB")
  })

  it("seq 26 → AAAZ", () => {
    expect(gerarCodigoInterno(26)).toBe("AAAZ")
  })

  it("seq 27 → AABA (faz rollover na última letra)", () => {
    expect(gerarCodigoInterno(27)).toBe("AABA")
  })

  it("seq 456976 → ZZZZ (maior cobertura sem colisão)", () => {
    expect(gerarCodigoInterno(456_976)).toBe("ZZZZ")
  })
})