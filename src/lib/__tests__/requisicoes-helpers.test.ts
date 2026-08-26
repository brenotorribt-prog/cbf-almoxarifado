import { describe, expect, it } from "vitest"
import {
  PAPEIS_APROVACAO_SUPERIOR,
  PAPEIS_GESTAO_REQUISICOES,
  TRANSICOES,
  calcularStatusAgregado,
  dataPrevistaDevolucaoPadrao,
  papeisPermitidosParaAcao,
  podeGerenciarRequisicoes,
  statusInicialItem,
} from "../requisicoes/requisicoes-helpers"

describe("calcularStatusAgregado", () => {
  it("retorna PENDENTE quando o pedido não tem itens", () => {
    expect(calcularStatusAgregado([])).toBe("PENDENTE")
  })

  it("retorna PENDENTE quando todos os itens estão pendentes", () => {
    expect(calcularStatusAgregado(["PENDENTE", "PENDENTE"])).toBe("PENDENTE")
  })

  it("retorna AGUARDANDO_APROVACAO quando algum item aguarda aprovação superior", () => {
    expect(calcularStatusAgregado(["AGUARDANDO_APROVACAO_SUPERIOR", "PENDENTE"])).toBe(
      "AGUARDANDO_APROVACAO"
    )
  })

  it("retorna EM_ANDAMENTO quando há itens aprovados ou em preparação", () => {
    expect(calcularStatusAgregado(["APROVADO", "APROVADO"])).toBe("EM_ANDAMENTO")
    expect(calcularStatusAgregado(["EM_PREPARACAO", "APROVADO"])).toBe("EM_ANDAMENTO")
    expect(calcularStatusAgregado(["PENDENTE", "APROVADO"])).toBe("EM_ANDAMENTO")
  })

  it("retorna PRONTO quando todos os itens estão prontos ou finalizados", () => {
    expect(calcularStatusAgregado(["PRONTO", "PRONTO"])).toBe("PRONTO")
    expect(calcularStatusAgregado(["PRONTO", "ENTREGUE"])).toBe("PRONTO")
  })

  it("retorna ENTREGUE quando todos terminaram e pelo menos um foi entregue", () => {
    expect(calcularStatusAgregado(["ENTREGUE", "ENTREGUE"])).toBe("ENTREGUE")
    expect(calcularStatusAgregado(["ENTREGUE", "REJEITADO"])).toBe("ENTREGUE")
  })

  it("retorna CANCELADA quando todos os itens foram rejeitados ou cancelados", () => {
    expect(calcularStatusAgregado(["REJEITADO", "CANCELADO"])).toBe("CANCELADA")
  })
})

describe("statusInicialItem", () => {
  it("material que exige aprovação superior nasce AGUARDANDO_APROVACAO_SUPERIOR", () => {
    expect(statusInicialItem(true)).toBe("AGUARDANDO_APROVACAO_SUPERIOR")
  })

  it("material comum nasce PENDENTE", () => {
    expect(statusInicialItem(false)).toBe("PENDENTE")
  })
})

describe("papeisPermitidosParaAcao", () => {
  it("aprovar/rejeitar item sensível exige nível superior", () => {
    expect(papeisPermitidosParaAcao("APROVAR", "AGUARDANDO_APROVACAO_SUPERIOR")).toEqual(
      PAPEIS_APROVACAO_SUPERIOR
    )
    expect(papeisPermitidosParaAcao("REJEITAR", "AGUARDANDO_APROVACAO_SUPERIOR")).toEqual(
      PAPEIS_APROVACAO_SUPERIOR
    )
  })

  it("demais ações ficam com a equipe de gestão do almoxarifado", () => {
    expect(papeisPermitidosParaAcao("APROVAR", "PENDENTE")).toEqual(PAPEIS_GESTAO_REQUISICOES)
    expect(papeisPermitidosParaAcao("ENTREGAR", "PRONTO")).toEqual(PAPEIS_GESTAO_REQUISICOES)
    expect(papeisPermitidosParaAcao("INICIAR_PREPARO", "APROVADO")).toEqual(
      PAPEIS_GESTAO_REQUISICOES
    )
  })
})

describe("podeGerenciarRequisicoes", () => {
  it("SOLICITANTE não gerencia requisições", () => {
    expect(podeGerenciarRequisicoes("SOLICITANTE")).toBe(false)
  })

  it("equipe do almoxarifado gerencia requisições", () => {
    expect(podeGerenciarRequisicoes("ALMOXARIFE")).toBe(true)
    expect(podeGerenciarRequisicoes("SUPERVISOR")).toBe(true)
    expect(podeGerenciarRequisicoes("GESTOR")).toBe(true)
    expect(podeGerenciarRequisicoes("ADMIN")).toBe(true)
  })
})

describe("TRANSICOES — invariantes da máquina de estados", () => {
  it("toda ação tem ao menos um status de origem e um destino", () => {
    for (const transicao of Object.values(TRANSICOES)) {
      expect(transicao.de.length).toBeGreaterThan(0)
    }
  })

  it("nenhuma ação permite transição para o próprio status de origem", () => {
    for (const transicao of Object.values(TRANSICOES)) {
      expect(transicao.de).not.toContain(transicao.para)
    }
  })

  it("CANCELAR cobre todos os status pré-terminais", () => {
    const cancelar = TRANSICOES.CANCELAR
    expect(cancelar.para).toBe("CANCELADO")
    expect(cancelar.de).toEqual(
      expect.arrayContaining([
        "PENDENTE",
        "AGUARDANDO_APROVACAO_SUPERIOR",
        "APROVADO",
        "EM_PREPARACAO",
        "PRONTO",
      ])
    )
  })

  it("ENTREGAR só é válido a partir de PRONTO ou APROVADO e gera ENTREGUE", () => {
    const entregar = TRANSICOES.ENTREGAR
    expect(entregar.para).toBe("ENTREGUE")
    expect(entregar.de).toEqual(expect.arrayContaining(["PRONTO", "APROVADO"]))
  })
})

describe("dataPrevistaDevolucaoPadrao", () => {
  it("retorna uma data no futuro", () => {
    const data = dataPrevistaDevolucaoPadrao()
    expect(data.getTime()).toBeGreaterThan(Date.now())
  })
})