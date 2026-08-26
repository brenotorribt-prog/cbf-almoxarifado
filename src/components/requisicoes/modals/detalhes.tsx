"use client"

/**
 * Modal de detalhe da requisição.
 * - Mostra o cabeçalho (solicitante, tipo, prioridade, datas).
 * - Lista os itens com status/ações INDIVIDUAIS.
 * - Barra de ação em massa aplica a ação a todo item elegível que não foi
 *   "alterado manualmente" (a API cuida dessa regra, aqui só refletimos o
 *   resultado — inclusive quais itens foram ignorados e por quê).
 * - Permissão fina (ex: item que precisa de aprovação superior) também é
 *   validada no servidor; aqui escondemos/desabilitamos botões só pra UX,
 *   nunca como única barreira de segurança.
 */

import { useState, useEffect, useCallback } from "react"
import styled, { keyframes } from "styled-components"
import { theme, hexToRgba } from "@/styles/theme"
import {
  X,
  Loader2,
  Check,
  XCircle,
  PackageCheck,
  PackageOpen,
  Truck,
  Ban,
  ShieldAlert,
  UserRound,
  Hash,
  Clock,
  CalendarClock,
} from "lucide-react"

// =====================================================================
// TIPOS
// =====================================================================

type StatusItem =
  | "PENDENTE"
  | "AGUARDANDO_APROVACAO_SUPERIOR"
  | "APROVADO"
  | "REJEITADO"
  | "EM_PREPARACAO"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO"

type Acao = "APROVAR" | "REJEITAR" | "INICIAR_PREPARO" | "MARCAR_PRONTO" | "ENTREGAR" | "CANCELAR"

interface Item {
  id: string
  status: StatusItem
  quantidade: number
  requerAprovacaoSuperior: boolean
  alteradoManualmente: boolean
  material: {
    id: string
    nome: string
    codigoInterno: string
    estoqueAtual: number
    tipoUso: "CONSUMIVEL" | "RETORNAVEL"
    unidadeMedida: { sigla: string }
  }
  aprovador: { id: string; name: string } | null
  motivoRejeicao: string | null
  preparador: { id: string; name: string } | null
  entreguePor: { id: string; name: string } | null
  dataPrevistaDevolucao: string | null
  observacao: string | null
  movimentacao: { id: string; tipo: string; createdAt: string } | null
  emprestimo: { id: string; status: string; dataPrevistaDevolucao: string; dataDevolucao: string | null } | null
}

interface Detalhe {
  id: string
  numero: number
  tipo: "SAIDA" | "EMPRESTIMO" | "TRANSFERENCIA"
  origem: "AUTENTICADO" | "PUBLICO"
  status: string
  prioridade: string
  motivo: string | null
  dataLimite: string | null
  createdAt: string
  solicitante: { tipo: string; nome: string; setor: string | null; funcao: string | null } | null
  lancadoPor: { id: string; nome: string } | null
  itens: Item[]
}

const PAPEIS_GESTAO = new Set(["ADMIN", "GESTOR", "SUPERVISOR", "ALMOXARIFE"])
const PAPEIS_APROVACAO_SUPERIOR = new Set(["ADMIN", "GESTOR", "SUPERVISOR"])

const LABEL_STATUS_ITEM: Record<StatusItem, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO_APROVACAO_SUPERIOR: "Aguard. aprovação superior",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  EM_PREPARACAO: "Em preparação",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
}

const COR_STATUS_ITEM: Record<StatusItem, string> = {
  PENDENTE: theme.colors.status.info,
  AGUARDANDO_APROVACAO_SUPERIOR: theme.colors.status.warning,
  APROVADO: theme.colors.accent.green,
  REJEITADO: theme.colors.status.error,
  EM_PREPARACAO: theme.colors.status.purple,
  PRONTO: theme.colors.accent.green,
  ENTREGUE: theme.colors.status.success,
  CANCELADO: theme.colors.neutral[500],
}

// Ações possíveis a partir de cada status (espelha TRANSICOES do backend
// só pra decidir quais botões mostrar).
const ACOES_POR_STATUS: Record<StatusItem, Acao[]> = {
  PENDENTE: ["APROVAR", "REJEITAR", "CANCELAR"],
  AGUARDANDO_APROVACAO_SUPERIOR: ["APROVAR", "REJEITAR", "CANCELAR"],
  APROVADO: ["INICIAR_PREPARO", "MARCAR_PRONTO", "ENTREGAR", "CANCELAR"],
  EM_PREPARACAO: ["MARCAR_PRONTO", "CANCELAR"],
  PRONTO: ["ENTREGAR", "CANCELAR"],
  REJEITADO: [],
  ENTREGUE: [],
  CANCELADO: [],
}

const LABEL_ACAO: Record<Acao, string> = {
  APROVAR: "Aprovar",
  REJEITAR: "Rejeitar",
  INICIAR_PREPARO: "Iniciar preparo",
  MARCAR_PRONTO: "Marcar pronto",
  ENTREGAR: "Entregar",
  CANCELAR: "Cancelar",
}

const ICONE_ACAO: Record<Acao, React.ElementType> = {
  APROVAR: Check,
  REJEITAR: XCircle,
  INICIAR_PREPARO: PackageOpen,
  MARCAR_PRONTO: PackageCheck,
  ENTREGAR: Truck,
  CANCELAR: Ban,
}

function usuarioPodeExecutar(acao: Acao, statusItem: StatusItem, role: string): boolean {
  if (!PAPEIS_GESTAO.has(role)) return false
  if ((acao === "APROVAR" || acao === "REJEITAR") && statusItem === "AGUARDANDO_APROVACAO_SUPERIOR") {
    return PAPEIS_APROVACAO_SUPERIOR.has(role)
  }
  return true
}

function formatarData(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// =====================================================================
// COMPONENTE
// =====================================================================

export default function RequisicaoDetalheModal({
  requisicaoId,
  role,
  onClose,
  onAtualizada,
}: {
  requisicaoId: string
  role: string
  userId: string
  onClose: () => void
  onAtualizada: () => void
}) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [processando, setProcessando] = useState<string | null>(null) // "item-<id>-<acao>" ou "massa-<acao>"
  const [rejeitandoItemId, setRejeitandoItemId] = useState<string | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState("")
  const [aviso, setAviso] = useState<string | null>(null)
  // Marcação "precisa voltar?" por item — default vem do cadastro do
  // material (tipoUso) e pode ser ajustado na hora da entrega.
  const [marcacoesRetorno, setMarcacoesRetorno] = useState<Record<string, boolean>>({})

  // Busca o detalhe na API e devolve já tipado (sem tocar em estado).
  const buscarDetalhe = useCallback(async (): Promise<Detalhe> => {
    const res = await fetch(`/api/requisicoes/${requisicaoId}`)
    if (!res.ok) throw new Error("Falha ao carregar requisição")
    const data = await res.json()
    return data.requisicao as Detalhe
  }, [requisicaoId])

  /** Aplica o detalhe recebido ao estado (detalhe + marcações padrão). */
  function aplicarDetalhe(detalheRecebido: Detalhe) {
    setDetalhe(detalheRecebido)
    const iniciais: Record<string, boolean> = {}
    for (const item of detalheRecebido.itens) {
      if (!item.movimentacao) {
        iniciais[item.id] = item.material.tipoUso === "RETORNAVEL"
      }
    }
    setMarcacoesRetorno(iniciais)
  }

  // Carregamento inicial — todos os setState acontecem após o await
  // (nunca sincronamente no corpo do effect).
  useEffect(() => {
    let cancelado = false
    buscarDetalhe()
      .then((d) => {
        if (!cancelado) aplicarDetalhe(d)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Erro desconhecido")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [buscarDetalhe])

  /** Recarrega após uma ação (sem spinner de tela cheia). */
  async function carregar() {
    try {
      aplicarDetalhe(await buscarDetalhe())
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido")
    }
  }

  const gestor = PAPEIS_GESTAO.has(role)

  async function executarAcao(
    acao: Acao,
    itemIds: string[] | undefined,
    motivo?: string,
    marcacoesEntrega?: { itemId: string; precisaRetorno: boolean }[]
  ) {
    const chave = itemIds && itemIds.length === 1 ? `item-${itemIds[0]}-${acao}` : `massa-${acao}`
    setProcessando(chave)
    setAviso(null)
    try {
      const res = await fetch(`/api/requisicoes/${requisicaoId}/acoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, itemIds, motivoRejeicao: motivo, marcacoesEntrega }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAviso(data.error || "Não foi possível executar a ação")
        return
      }
      if (data.ignorados?.length > 0) {
        const resumo = (data.ignorados as { material: string; motivo: string }[])
          .slice(0, 3)
          .map((i) => `${i.material} (${i.motivo})`)
          .join("; ")
        setAviso(`${data.ignorados.length} item(ns) ignorado(s): ${resumo}${data.ignorados.length > 3 ? "..." : ""}`)
      }
      await carregar()
      onAtualizada()
    } catch {
      setAviso("Erro de conexão ao executar a ação")
    } finally {
      setProcessando(null)
      setRejeitandoItemId(null)
      setMotivoRejeicao("")
    }
  }

  function iniciarRejeicao(itemId: string) {
    setRejeitandoItemId(itemId)
    setMotivoRejeicao("")
  }

  function confirmarRejeicao() {
    if (!motivoRejeicao.trim()) {
      setAviso("Informe o motivo da rejeição")
      return
    }
    executarAcao("REJEITAR", [rejeitandoItemId!], motivoRejeicao.trim())
  }

  function definirMarcacao(itemId: string, precisaRetorno: boolean) {
    setMarcacoesRetorno((prev) => ({ ...prev, [itemId]: precisaRetorno }))
  }

  /** Monta a lista de marcações pros itens informados (ou todos elegíveis). */
  function montarMarcacoes(itemIds?: string[]) {
    const alvo =
      itemIds ??
      (detalhe?.itens ?? [])
        .filter((i) => !i.alteradoManualmente && !i.movimentacao)
        .map((i) => i.id)
    return alvo.map((itemId) => ({ itemId, precisaRetorno: Boolean(marcacoesRetorno[itemId]) }))
  }

  // Ações em massa disponíveis: união do que pelo menos um item elegível
  // (não alterado manualmente, status compatível) permite.
  const itensElegiveisMassa = detalhe?.itens.filter((i) => !i.alteradoManualmente) ?? []
  const acoesEmMassaDisponiveis = new Set<Acao>()
  itensElegiveisMassa.forEach((i) => ACOES_POR_STATUS[i.status].forEach((a) => acoesEmMassaDisponiveis.add(a)))

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <ModalTopo>
          <div>
            <Breadcrumb>Requisição</Breadcrumb>
            <TituloLinha>
              <Hash size={18} />
              <TituloTexto>{detalhe ? detalhe.numero : "..."}</TituloTexto>
            </TituloLinha>
          </div>
          <FecharButton onClick={onClose}>
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        {carregando && (
          <CentroLoading>
            <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} />
            <span>Carregando...</span>
          </CentroLoading>
        )}

        {!carregando && erro && <ErroTexto>{erro}</ErroTexto>}

        {!carregando && detalhe && (
          <>
            <InfoGrid>
              <InfoItem>
                <InfoLabel>Solicitante</InfoLabel>
                <InfoValor>
                  <UserRound size={13} />
                  {detalhe.solicitante?.nome ?? "—"}
                  {detalhe.origem === "PUBLICO" && <OrigemTag>formulário público</OrigemTag>}
                </InfoValor>
              </InfoItem>
              <InfoItem>
                <InfoLabel>Setor / Função</InfoLabel>
                <InfoValor>{detalhe.solicitante?.setor ?? "—"} · {detalhe.solicitante?.funcao ?? "—"}</InfoValor>
              </InfoItem>
              <InfoItem>
                <InfoLabel>Tipo</InfoLabel>
                <InfoValor>{detalhe.tipo}</InfoValor>
              </InfoItem>
              <InfoItem>
                <InfoLabel>Prioridade</InfoLabel>
                <InfoValor>{detalhe.prioridade}</InfoValor>
              </InfoItem>
              {detalhe.dataLimite && (
                <InfoItem>
                  <InfoLabel>Prazo máximo</InfoLabel>
                  <InfoValor>
                    <CalendarClock size={13} />
                    {formatarData(detalhe.dataLimite)}
                  </InfoValor>
                </InfoItem>
              )}
              <InfoItem>
                <InfoLabel>Aberta em</InfoLabel>
                <InfoValor>
                  <Clock size={13} />
                  {formatarData(detalhe.createdAt)}
                </InfoValor>
              </InfoItem>
              {detalhe.lancadoPor && (
                <InfoItem>
                  <InfoLabel>Lançado por</InfoLabel>
                  <InfoValor>
                    <UserRound size={13} />
                    {detalhe.lancadoPor.nome}
                  </InfoValor>
                </InfoItem>
              )}
            </InfoGrid>

            {detalhe.motivo && (
              <InfoItem>
                <InfoLabel>Motivo</InfoLabel>
                <InfoValor>{detalhe.motivo}</InfoValor>
              </InfoItem>
            )}

            {aviso && <AvisoBox>{aviso}</AvisoBox>}

            {gestor && acoesEmMassaDisponiveis.size > 0 && (
              <MassaWrapper>
                <MassaLabel>Aplicar a todos os itens não alterados manualmente:</MassaLabel>
                <MassaBotoes>
                  {(["APROVAR", "INICIAR_PREPARO", "MARCAR_PRONTO", "ENTREGAR"] as Acao[])
                    .filter((a) => acoesEmMassaDisponiveis.has(a))
                    .map((acao) => {
                      const Icone = ICONE_ACAO[acao]
                      const chave = `massa-${acao}`
                      return (
                        <AcaoBotao
                          key={acao}
                          $tom="neutro"
                          disabled={processando === chave}
                          onClick={() =>
                            executarAcao(
                              acao,
                              undefined,
                              undefined,
                              acao === "ENTREGAR" ? montarMarcacoes() : undefined
                            )
                          }
                        >
                          {processando === chave ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Icone size={13} />}
                          {LABEL_ACAO[acao]}
                        </AcaoBotao>
                      )
                    })}
                </MassaBotoes>
              </MassaWrapper>
            )}

            <ItensLista>
              {detalhe.itens.map((item) => {
                const acoesDisponiveis = ACOES_POR_STATUS[item.status]
                return (
                  <ItemCard key={item.id}>
                    <ItemTopo>
                      <ItemNomeWrap>
                        <ItemNome>{item.material.nome}</ItemNome>
                        <ItemMeta>
                          {item.quantidade} {item.material.unidadeMedida.sigla} · {item.material.codigoInterno}
                          {item.requerAprovacaoSuperior && (
                            <ShieldAlert size={11} color={theme.colors.status.warning} aria-label="Requer aprovação superior" />
                          )}
                          {item.alteradoManualmente && <ManualTag>manual</ManualTag>}
                        </ItemMeta>
                      </ItemNomeWrap>
                      <StatusBadge $cor={COR_STATUS_ITEM[item.status]}>{LABEL_STATUS_ITEM[item.status]}</StatusBadge>
                    </ItemTopo>

                    {item.status === "REJEITADO" && item.motivoRejeicao && (
                      <MotivoRejeicaoTexto>Rejeitado: {item.motivoRejeicao}</MotivoRejeicaoTexto>
                    )}

                    {item.dataPrevistaDevolucao && (
                      <ItemMetaLinha>
                        <CalendarClock size={11} />
                        Devolução prevista: {formatarData(item.dataPrevistaDevolucao)}
                        {item.emprestimo && ` · empréstimo ${item.emprestimo.status.toLowerCase()}`}
                      </ItemMetaLinha>
                    )}

                    {/* Marcação de retorno — só faz sentido antes da entrega */}
                    {gestor &&
                      !item.movimentacao &&
                      ["APROVADO", "EM_PREPARACAO", "PRONTO"].includes(item.status) && (
                        <RetornoToggle>
                          <RetornoLabel>Precisa voltar pro almoxarifado?</RetornoLabel>
                          <RetornoOpcoes>
                            <RetornoOpcao
                              type="button"
                              $ativo={Boolean(marcacoesRetorno[item.id])}
                              onClick={() => definirMarcacao(item.id, true)}
                            >
                              Sim · vira empréstimo
                            </RetornoOpcao>
                            <RetornoOpcao
                              type="button"
                              $ativo={!marcacoesRetorno[item.id]}
                              onClick={() => definirMarcacao(item.id, false)}
                            >
                              Não · uso/consumo
                            </RetornoOpcao>
                          </RetornoOpcoes>
                        </RetornoToggle>
                      )}

                    {gestor && rejeitandoItemId === item.id && (
                      <RejeicaoForm>
                        <input
                          autoFocus
                          placeholder="Motivo da rejeição..."
                          value={motivoRejeicao}
                          onChange={(e) => setMotivoRejeicao(e.target.value)}
                        />
                        <AcaoBotao $tom="perigo" onClick={confirmarRejeicao} disabled={processando === `item-${item.id}-REJEITAR`}>
                          Confirmar
                        </AcaoBotao>
                        <AcaoBotao $tom="neutro" onClick={() => setRejeitandoItemId(null)}>
                          Cancelar
                        </AcaoBotao>
                      </RejeicaoForm>
                    )}

                    {gestor && acoesDisponiveis.length > 0 && rejeitandoItemId !== item.id && (
                      <ItemAcoes>
                        {acoesDisponiveis.map((acao) => {
                          const permitido = usuarioPodeExecutar(acao, item.status, role)
                          const Icone = ICONE_ACAO[acao]
                          const chave = `item-${item.id}-${acao}`
                          const tom: "positivo" | "perigo" | "neutro" =
                            acao === "REJEITAR" || acao === "CANCELAR" ? "perigo" : acao === "APROVAR" || acao === "ENTREGAR" ? "positivo" : "neutro"
                          return (
                            <AcaoBotao
                              key={acao}
                              $tom={tom}
                              disabled={!permitido || processando === chave}
                              title={!permitido ? "Requer aprovação de um nível superior" : undefined}
                              onClick={() => {
                                if (acao === "REJEITAR") iniciarRejeicao(item.id)
                                else if (acao === "ENTREGAR")
                                  executarAcao(acao, [item.id], undefined, [
                                    { itemId: item.id, precisaRetorno: Boolean(marcacoesRetorno[item.id]) },
                                  ])
                                else executarAcao(acao, [item.id])
                              }}
                            >
                              {processando === chave ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Icone size={13} />}
                              {LABEL_ACAO[acao]}
                            </AcaoBotao>
                          )
                        })}
                      </ItemAcoes>
                    )}
                  </ItemCard>
                )
              })}
            </ItensLista>
          </>
        )}
      </ModalCard>
    </ModalOverlay>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`
const slideIn = keyframes`from { opacity: 0; transform: translateY(-12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); }`

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.surface.overlay};
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${({ theme }) => theme.zIndex.modal};
  padding: ${({ theme }) => theme.spacing[4]};
  animation: ${fadeIn} 0.15s ease both;
`

const ModalCard = styled.div`
  background: ${({ theme }) => theme.colors.surface.card};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(20px);
  box-shadow: ${({ theme }) => theme.shadows.card};
  width: 100%;
  max-width: 680px;
  max-height: 88vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[5]};
  animation: ${slideIn} 0.2s ease both;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: ${({ theme }) => theme.radii.full}; }
`

const ModalTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`

const Breadcrumb = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`

const TituloLinha = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: ${({ theme }) => theme.colors.text.primary};
`

const TituloTexto = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize["2xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-variant-numeric: tabular-nums;
`

const FecharButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text.secondary};
  flex-shrink: 0;
  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; color: ${({ theme }) => theme.colors.text.primary}; }
`

const CentroLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: ${({ theme }) => theme.spacing[10]} 0;
  color: ${({ theme }) => theme.colors.text.muted};
`

const ErroTexto = styled.p`
  color: ${({ theme }) => theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
`

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const InfoLabel = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.text.muted};
`

const InfoValor = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  svg { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
`

const OrigemTag = styled.span`
  font-size: 10px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.surface.glass};
  color: ${({ theme }) => theme.colors.text.muted};
`

const AvisoBox = styled.div`
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.status.warningBg};
  border: 1px solid ${({ theme }) => theme.colors.status.warningBorder};
  color: ${({ theme }) => theme.colors.status.warning};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const MassaWrapper = styled.div`
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const MassaLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const MassaBotoes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing[2]};
`

const ItensLista = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ItemCard = styled.div`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const ItemTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ItemNomeWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const ItemNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const ItemMetaLinha = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const ManualTag = styled.span`
  font-size: 9px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => hexToRgba(theme.colors.status.purple, 0.16)};
  color: ${({ theme }) => theme.colors.status.purple};
  text-transform: uppercase;
`

const StatusBadge = styled.span<{ $cor: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $cor }) => $cor};
  background: ${({ $cor }) => hexToRgba($cor, 0.14)};
  border: 1px solid ${({ $cor }) => hexToRgba($cor, 0.3)};
  white-space: nowrap;
  flex-shrink: 0;
`

const MotivoRejeicaoTexto = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.error};
`

const ItemAcoes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing[2]};
`

const RetornoToggle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.06)};
  border: 1px dashed ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.35)};
`

const RetornoLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`

const RetornoOpcoes = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
`

const RetornoOpcao = styled.button<{ $ativo: boolean }>`
  padding: ${({ theme }) => `${theme.spacing[1]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px solid;
  cursor: pointer;
  white-space: nowrap;

  color: ${({ $ativo, theme }) =>
    $ativo ? theme.colors.primary.vivid : theme.colors.text.muted};
  background: ${({ $ativo, theme }) =>
    $ativo ? hexToRgba(theme.colors.primary.vivid, 0.14) : "transparent"};
  border-color: ${({ $ativo, theme }) =>
    $ativo ? hexToRgba(theme.colors.primary.vivid, 0.5) : theme.colors.surface.border};

  &:hover { opacity: 0.85; }
`

const RejeicaoForm = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};

  input {
    flex: 1;
    background: ${({ theme }) => theme.colors.surface.glass};
    border: 1px solid ${({ theme }) => theme.colors.surface.border};
    border-radius: ${({ theme }) => theme.radii.md};
    padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`

const AcaoBotao = styled.button<{ $tom: "positivo" | "perigo" | "neutro" }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: ${({ theme }) => `${theme.spacing[1]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px solid;
  white-space: nowrap;
  transition: opacity ${({ theme }) => theme.transitions.fast};

  color: ${({ theme, $tom }) =>
    $tom === "positivo" ? theme.colors.status.success : $tom === "perigo" ? theme.colors.status.error : theme.colors.text.secondary};
  background: ${({ theme, $tom }) =>
    $tom === "positivo" ? theme.colors.status.successBg : $tom === "perigo" ? theme.colors.status.errorBg : theme.colors.surface.glass};
  border-color: ${({ theme, $tom }) =>
    $tom === "positivo" ? theme.colors.status.successBorder : $tom === "perigo" ? theme.colors.status.errorBorder : theme.colors.surface.border};

  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.4; cursor: default; }
`
