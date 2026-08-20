import { NotificacaoTipo, Role, StatusItemSolicitacao, StatusSolicitacao } from "@prisma/client"

// =====================================================================
// PERMISSÕES
// =====================================================================

// Quem pode ver a área de gestão de requisições (aprovar, preparar,
// entregar). SOLICITANTE fica de fora — ele só cria e acompanha as
// próprias requisições.
export const PAPEIS_GESTAO_REQUISICOES: Role[] = ["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"]

// Quem pode aprovar/rejeitar um item que está travado por exigir
// aprovação superior (Material.requerAprovacao = true).
export const PAPEIS_APROVACAO_SUPERIOR: Role[] = ["ADMIN", "GESTOR", "SUPERVISOR"]

export function podeGerenciarRequisicoes(role: Role): boolean {
  return PAPEIS_GESTAO_REQUISICOES.includes(role)
}

// =====================================================================
// MÁQUINA DE STATUS DO ITEM
// =====================================================================

export type AcaoItem =
  | "APROVAR"
  | "REJEITAR"
  | "INICIAR_PREPARO"
  | "MARCAR_PRONTO"
  | "ENTREGAR"
  | "CANCELAR"

export const ACOES_VALIDAS: AcaoItem[] = [
  "APROVAR",
  "REJEITAR",
  "INICIAR_PREPARO",
  "MARCAR_PRONTO",
  "ENTREGAR",
  "CANCELAR",
]

// De quais status o item PRECISA estar pra cada ação ser válida, e pra
// qual status ela leva.
export const TRANSICOES: Record<
  AcaoItem,
  { de: StatusItemSolicitacao[]; para: StatusItemSolicitacao }
> = {
  APROVAR: {
    de: ["PENDENTE", "AGUARDANDO_APROVACAO_SUPERIOR"],
    para: "APROVADO",
  },
  REJEITAR: {
    de: ["PENDENTE", "AGUARDANDO_APROVACAO_SUPERIOR"],
    para: "REJEITADO",
  },
  INICIAR_PREPARO: {
    de: ["APROVADO"],
    para: "EM_PREPARACAO",
  },
  MARCAR_PRONTO: {
    de: ["EM_PREPARACAO", "APROVADO"],
    para: "PRONTO",
  },
  ENTREGAR: {
    de: ["PRONTO", "APROVADO"],
    para: "ENTREGUE",
  },
  CANCELAR: {
    de: ["PENDENTE", "AGUARDANDO_APROVACAO_SUPERIOR", "APROVADO", "EM_PREPARACAO", "PRONTO"],
    para: "CANCELADO",
  },
}

export const ITENS_STATUS_TERMINAIS: StatusItemSolicitacao[] = ["ENTREGUE", "REJEITADO", "CANCELADO"]

export function statusInicialItem(requerAprovacaoSuperior: boolean): StatusItemSolicitacao {
  return requerAprovacaoSuperior ? "AGUARDANDO_APROVACAO_SUPERIOR" : "PENDENTE"
}

// Papéis que podem executar essa ação NESSE status específico do item.
// Aprovar/rejeitar um item travado por aprovação superior exige um nível
// maior do que aprovar um item comum.
export function papeisPermitidosParaAcao(
  acao: AcaoItem,
  statusAtualItem: StatusItemSolicitacao
): Role[] {
  if ((acao === "APROVAR" || acao === "REJEITAR") && statusAtualItem === "AGUARDANDO_APROVACAO_SUPERIOR") {
    return PAPEIS_APROVACAO_SUPERIOR
  }
  return PAPEIS_GESTAO_REQUISICOES
}

// =====================================================================
// STATUS AGREGADO DO CABEÇALHO
// =====================================================================

export function calcularStatusAgregado(statusItens: StatusItemSolicitacao[]): StatusSolicitacao {
  if (statusItens.length === 0) return "PENDENTE"

  const todosTerminais = statusItens.every((s) => ITENS_STATUS_TERMINAIS.includes(s))
  if (todosTerminais) {
    const algumEntregue = statusItens.some((s) => s === "ENTREGUE")
    return algumEntregue ? "ENTREGUE" : "CANCELADA"
  }

  const todosProntosOuFinalizados = statusItens.every((s) =>
    (["PRONTO", "ENTREGUE", "REJEITADO", "CANCELADO"] as StatusItemSolicitacao[]).includes(s)
  )
  if (todosProntosOuFinalizados) return "PRONTO"

  const algumAguardandoSuperior = statusItens.some((s) => s === "AGUARDANDO_APROVACAO_SUPERIOR")
  if (algumAguardandoSuperior) return "AGUARDANDO_APROVACAO"

  const todosPendentes = statusItens.every((s) => s === "PENDENTE")
  if (todosPendentes) return "PENDENTE"

  return "EM_ANDAMENTO"
}

// =====================================================================
// NOTIFICAÇÕES — mapeia a transição do cabeçalho pro tipo de notificação
// já existente no enum (reaproveitando o que a solicitação de compras /
// materiais já usa).
// =====================================================================

export function tipoNotificacaoParaStatus(status: StatusSolicitacao): NotificacaoTipo | null {
  switch (status) {
    case "AGUARDANDO_APROVACAO":
      return null // notificação específica de "requer aprovação superior" é disparada à parte
    case "EM_ANDAMENTO":
      return "SOLICITACAO_PREPARANDO"
    case "PRONTO":
      return "SOLICITACAO_PRONTA"
    case "ENTREGUE":
      return "SOLICITACAO_ENTREGUE"
    case "CANCELADA":
      return "SOLICITACAO_CANCELADA"
    default:
      return null
  }
}

// Data padrão de devolução quando o item é EMPRESTIMO e nem o item nem o
// corpo da ação informaram uma data — 7 dias corridos a partir de agora.
export function dataPrevistaDevolucaoPadrao(): Date {
  const data = new Date()
  data.setDate(data.getDate() + 7)
  return data
}
