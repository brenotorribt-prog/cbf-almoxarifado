"use client"

/**
 * Modal de criação de requisição — usuário autenticado.
 * Fluxo: escolhe tipo -> busca materiais (reaproveita /api/materiais) ->
 * monta um carrinho com quantidade (e data prevista de devolução, se
 * EMPRESTIMO) -> envia tudo de uma vez pra POST /api/requisicoes.
 */

import { useState, useEffect, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { theme } from "@/styles/theme"
import { X, Search, Plus, Trash2, Loader2, ShieldAlert, PackageMinus, HandCoins, ArrowRightLeft, UserRound, Users } from "lucide-react"

type Tipo = "SAIDA" | "EMPRESTIMO" | "TRANSFERENCIA"
type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

interface MaterialBusca {
  id: string
  nome: string
  codigoInterno: string
  requerAprovacao: boolean
  estoqueAtual: number
  unidadeMedida: { sigla: string }
}

interface Pessoa {
  id: string
  nome: string
  setor: string
  funcao: string
}

interface ItemCarrinho {
  material: MaterialBusca
  quantidade: number
  dataPrevistaDevolucao: string
}

export default function NovaRequisicaoModal({
  gestor,
  onClose,
  onCriada,
}: {
  gestor: boolean
  onClose: () => void
  onCriada: () => void
}) {
  const [tipo, setTipo] = useState<Tipo>("SAIDA")
  const [prioridade, setPrioridade] = useState<Prioridade>("MEDIA")
  const [motivo, setMotivo] = useState("")
  const [dataLimite, setDataLimite] = useState("")

  // Só pra quem gerencia requisições: lançar o pedido em nome de uma
  // pessoa atendida (recebido por WhatsApp, e-mail, telefone etc.) em vez
  // de criar pra si mesmo.
  const [emNomeDeOutro, setEmNomeDeOutro] = useState(false)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [buscaPessoa, setBuscaPessoa] = useState("")
  const [resultadosPessoa, setResultadosPessoa] = useState<Pessoa[]>([])
  const [buscandoPessoa, setBuscandoPessoa] = useState(false)
  const debouncePessoaRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debouncePessoaRef.current) clearTimeout(debouncePessoaRef.current)
    if (buscaPessoa.trim().length < 2) {
      setResultadosPessoa([])
      return
    }
    debouncePessoaRef.current = setTimeout(async () => {
      setBuscandoPessoa(true)
      try {
        const res = await fetch(`/api/publico/pessoas-atendidas?busca=${encodeURIComponent(buscaPessoa.trim())}`)
        if (res.ok) setResultadosPessoa((await res.json()).pessoas ?? [])
      } finally {
        setBuscandoPessoa(false)
      }
    }, 300)
    return () => {
      if (debouncePessoaRef.current) clearTimeout(debouncePessoaRef.current)
    }
  }, [buscaPessoa])

  const [busca, setBusca] = useState("")
  const [resultados, setResultados] = useState<MaterialBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (busca.trim().length < 2) {
      setResultados([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const params = new URLSearchParams({ busca: busca.trim(), situacao: "ATIVO", limit: "10" })
        const res = await fetch(`/api/materiais?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setResultados(data.materiais ?? [])
        }
      } catch {
        // silencioso — busca não é crítica o bastante pra travar a UI
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busca])

  function adicionarAoCarrinho(material: MaterialBusca) {
    if (carrinho.some((i) => i.material.id === material.id)) return
    setCarrinho((prev) => [...prev, { material, quantidade: 1, dataPrevistaDevolucao: "" }])
    setBusca("")
    setResultados([])
  }

  function removerDoCarrinho(materialId: string) {
    setCarrinho((prev) => prev.filter((i) => i.material.id !== materialId))
  }

  function atualizarQuantidade(materialId: string, quantidade: number) {
    setCarrinho((prev) => prev.map((i) => (i.material.id === materialId ? { ...i, quantidade } : i)))
  }

  function atualizarDataDevolucao(materialId: string, data: string) {
    setCarrinho((prev) => prev.map((i) => (i.material.id === materialId ? { ...i, dataPrevistaDevolucao: data } : i)))
  }

  async function enviar() {
    setErro(null)

    if (emNomeDeOutro && !pessoa) {
      setErro("Selecione a pessoa em nome de quem você está lançando o pedido")
      return
    }
    if (carrinho.length === 0) {
      setErro("Adicione pelo menos um material à requisição")
      return
    }
    if (carrinho.some((i) => i.quantidade <= 0)) {
      setErro("Quantidade precisa ser maior que zero em todos os itens")
      return
    }
    if (tipo === "EMPRESTIMO" && carrinho.some((i) => !i.dataPrevistaDevolucao)) {
      setErro("Informe a data prevista de devolução de todos os itens de empréstimo")
      return
    }

    setEnviando(true)
    try {
      const res = await fetch("/api/requisicoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          prioridade,
          motivo: motivo.trim() || undefined,
          dataLimite: dataLimite || undefined,
          ...(emNomeDeOutro && pessoa ? { pessoaAtendidaId: pessoa.id } : {}),
          itens: carrinho.map((i) => ({
            materialId: i.material.id,
            quantidade: i.quantidade,
            dataPrevistaDevolucao: tipo === "EMPRESTIMO" ? i.dataPrevistaDevolucao : undefined,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(data.error || "Não foi possível criar a requisição")
        return
      }
      onCriada()
    } catch {
      setErro("Erro de conexão ao criar a requisição")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <ModalTopo>
          <Titulo>Nova requisição</Titulo>
          <FecharButton onClick={onClose}>
            <X size={18} />
          </FecharButton>
        </ModalTopo>

        {gestor && (
          <Campo>
            <Label>Lançar pedido</Label>
            <TipoTabs>
              <TipoTab $ativo={!emNomeDeOutro} onClick={() => { setEmNomeDeOutro(false); setPessoa(null) }}>
                <UserRound size={14} /> Pra mim
              </TipoTab>
              <TipoTab $ativo={emNomeDeOutro} onClick={() => setEmNomeDeOutro(true)}>
                <Users size={14} /> Em nome de outra pessoa
              </TipoTab>
            </TipoTabs>
          </Campo>
        )}

        {emNomeDeOutro && (
          <Campo>
            <Label>Pessoa que pediu (recebido por WhatsApp, e-mail etc.)</Label>
            {pessoa ? (
              <PessoaSelecionada>
                <div>
                  <strong>{pessoa.nome}</strong>
                  <span> — {pessoa.setor} · {pessoa.funcao}</span>
                </div>
                <TrocarButton onClick={() => setPessoa(null)}>trocar</TrocarButton>
              </PessoaSelecionada>
            ) : (
              <>
                <BuscaBox>
                  <Search size={15} />
                  <input placeholder="Buscar pessoa cadastrada..." value={buscaPessoa} onChange={(e) => setBuscaPessoa(e.target.value)} />
                  {buscandoPessoa && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
                </BuscaBox>
                {resultadosPessoa.length > 0 && (
                  <ResultadosLista>
                    {resultadosPessoa.map((p) => (
                      <ResultadoItem key={p.id} onClick={() => { setPessoa(p); setBuscaPessoa(""); setResultadosPessoa([]) }}>
                        <div>
                          <ResultadoNome>{p.nome}</ResultadoNome>
                          <ResultadoMeta>{p.setor} · {p.funcao}</ResultadoMeta>
                        </div>
                      </ResultadoItem>
                    ))}
                  </ResultadosLista>
                )}
                {buscaPessoa.trim().length >= 2 && !buscandoPessoa && resultadosPessoa.length === 0 && (
                  <AvisoTexto>Ninguém encontrado com esse nome. Cadastre a pessoa antes de lançar o pedido.</AvisoTexto>
                )}
              </>
            )}
          </Campo>
        )}

        <TipoTabs>
          <TipoTab $ativo={tipo === "SAIDA"} onClick={() => setTipo("SAIDA")}>
            <PackageMinus size={14} /> Saída
          </TipoTab>
          <TipoTab $ativo={tipo === "EMPRESTIMO"} onClick={() => setTipo("EMPRESTIMO")}>
            <HandCoins size={14} /> Empréstimo
          </TipoTab>
          {gestor && (
            <TipoTab $ativo={tipo === "TRANSFERENCIA"} onClick={() => setTipo("TRANSFERENCIA")}>
              <ArrowRightLeft size={14} /> Transferência
            </TipoTab>
          )}
        </TipoTabs>

        <Linha>
          <Campo style={{ flex: 1 }}>
            <Label>Prioridade</Label>
            <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </Select>
          </Campo>
          <Campo style={{ flex: 1 }}>
            <Label>Prazo máximo (opcional)</Label>
            <Input type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)} />
          </Campo>
        </Linha>

        <Campo>
          <Label>Motivo (opcional)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Pra que esses materiais serão usados..." />
        </Campo>

        <Campo>
          <Label>Buscar material</Label>
          <BuscaBox>
            <Search size={15} />
            <input placeholder="Nome ou código do material..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            {buscando && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
          </BuscaBox>
          {resultados.length > 0 && (
            <ResultadosLista>
              {resultados.map((m) => (
                <ResultadoItem key={m.id} onClick={() => adicionarAoCarrinho(m)}>
                  <div>
                    <ResultadoNome>{m.nome}</ResultadoNome>
                    <ResultadoMeta>
                      {m.codigoInterno} · estoque: {m.estoqueAtual} {m.unidadeMedida.sigla}
                      {m.requerAprovacao && <ShieldAlert size={11} color={theme.colors.status.warning} />}
                    </ResultadoMeta>
                  </div>
                  <Plus size={14} />
                </ResultadoItem>
              ))}
            </ResultadosLista>
          )}
        </Campo>

        {carrinho.length > 0 && (
          <Carrinho>
            {carrinho.map((item) => (
              <CarrinhoItem key={item.material.id}>
                <CarrinhoInfo>
                  <CarrinhoNome>
                    {item.material.nome}
                    {item.material.requerAprovacao && <ShieldAlert size={12} color={theme.colors.status.warning} />}
                  </CarrinhoNome>
                  <CarrinhoMeta>{item.material.codigoInterno}</CarrinhoMeta>
                </CarrinhoInfo>
                <QuantidadeInput
                  type="number"
                  min={0.001}
                  step="any"
                  value={item.quantidade}
                  onChange={(e) => atualizarQuantidade(item.material.id, Number(e.target.value))}
                />
                <span style={{ fontSize: 12, color: theme.colors.text.muted }}>{item.material.unidadeMedida.sigla}</span>
                {tipo === "EMPRESTIMO" && (
                  <Input
                    type="date"
                    value={item.dataPrevistaDevolucao}
                    onChange={(e) => atualizarDataDevolucao(item.material.id, e.target.value)}
                    style={{ width: 140 }}
                  />
                )}
                <RemoverButton onClick={() => removerDoCarrinho(item.material.id)}>
                  <Trash2 size={14} />
                </RemoverButton>
              </CarrinhoItem>
            ))}
          </Carrinho>
        )}

        {erro && <ErroTexto>{erro}</ErroTexto>}

        <Rodape>
          <BotaoSecundario onClick={onClose}>Cancelar</BotaoSecundario>
          <BotaoPrimario onClick={enviar} disabled={enviando}>
            {enviando && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
            Enviar requisição
          </BotaoPrimario>
        </Rodape>
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
  max-width: 560px;
  max-height: 88vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  animation: ${slideIn} 0.2s ease both;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: ${({ theme }) => theme.radii.full}; }
`

const ModalTopo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const Titulo = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`

const FecharButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text.secondary};
  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; color: ${({ theme }) => theme.colors.text.primary}; }
`

const TipoTabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing[1]};
`

const TipoTab = styled.button<{ $ativo: boolean }>`
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, $ativo }) => ($ativo ? theme.colors.text.primary : theme.colors.text.secondary)};
  background: ${({ theme, $ativo }) => ($ativo ? theme.colors.surface.sidebarActive : "transparent")};
`

const Linha = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
`

const Campo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const Label = styled.label`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  option { background: ${({ theme }) => theme.colors.surface.sidebar}; }
`

const Input = styled.input`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const Textarea = styled.textarea`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  resize: vertical;
`

const BuscaBox = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};

  svg:first-child { color: ${({ theme }) => theme.colors.text.muted}; flex-shrink: 0; }
  input {
    flex: 1;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    &::placeholder { color: ${({ theme }) => theme.colors.text.muted}; }
  }
`

const ResultadosLista = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
`

const ResultadoItem = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  text-align: left;
  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; }
  svg:last-child { color: ${({ theme }) => theme.colors.primary.vivid}; flex-shrink: 0; }
`

const ResultadoNome = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
`

const ResultadoMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const PessoaSelecionada = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.status.successBg};
  border: 1px solid ${({ theme }) => theme.colors.status.successBorder};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  span { color: ${({ theme }) => theme.colors.text.muted}; }
`

const TrocarButton = styled.button`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary.vivid};
  text-decoration: underline;
  flex-shrink: 0;
`

const AvisoTexto = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.warning};
`

const Carrinho = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`

const CarrinhoItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
`

const CarrinhoInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`

const CarrinhoNome = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const CarrinhoMeta = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
`

const QuantidadeInput = styled.input`
  width: 70px;
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 4px 8px;
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: right;
`

const RemoverButton = styled.button`
  color: ${({ theme }) => theme.colors.status.error};
  flex-shrink: 0;
  &:hover { opacity: 0.7; }
`

const ErroTexto = styled.p`
  color: ${({ theme }) => theme.colors.status.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`

const Rodape = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
  padding-top: ${({ theme }) => theme.spacing[2]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const BotaoSecundario = styled.button`
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  &:hover { background: ${({ theme }) => theme.colors.surface.glass}; }
`

const BotaoPrimario = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.primary.vivid};
  color: ${({ theme }) => theme.colors.neutral.white};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  &:hover { background: ${({ theme }) => theme.colors.primary.deep}; }
  &:disabled { opacity: 0.6; cursor: default; }
`
