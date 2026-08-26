"use client"

/**
 * /solicitar — formulário público de requisição, SEM login.
 *
 * IMPORTANTE: pra essa rota ficar acessível é preciso adicionar "/solicitar"
 * em ROTAS_PUBLICAS no proxy.ts (middleware), senão o middleware redireciona
 * pra "/" antes mesmo de renderizar. Ver README-requisicoes.md.
 *
 * A pessoa precisa selecionar um cadastro já existente em PessoaAtendida
 * (autocomplete) — não aceitamos nome digitado livre, é essa a fonte única
 * de verdade que evita duplicidade de nomes nos relatórios.
 */

import { useState, useEffect, useRef } from "react"
import styled from "styled-components"
import { theme } from "@/styles/theme"
import { Search, Plus, Trash2, Loader2, CheckCircle2, PackageMinus, HandCoins, ShieldAlert } from "lucide-react"

type Tipo = "SAIDA" | "EMPRESTIMO"
type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

interface Pessoa {
  id: string
  nome: string
  setor: string
  funcao: string
}

interface MaterialBusca {
  id: string
  nome: string
  codigoInterno: string
  requerAprovacao: boolean
  unidadeMedida: { sigla: string }
  categoria: { nome: string }
}

interface ItemCarrinho {
  material: MaterialBusca
  quantidade: number
  dataPrevistaDevolucao: string
}

export default function SolicitarPage() {
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [buscaPessoa, setBuscaPessoa] = useState("")
  const [resultadosPessoa, setResultadosPessoa] = useState<Pessoa[]>([])
  const [buscandoPessoa, setBuscandoPessoa] = useState(false)

  const [tipo, setTipo] = useState<Tipo>("SAIDA")
  const [prioridade, setPrioridade] = useState<Prioridade>("MEDIA")
  const [motivo, setMotivo] = useState("")

  const [buscaMaterial, setBuscaMaterial] = useState("")
  const [resultadosMaterial, setResultadosMaterial] = useState<MaterialBusca[]>([])
  const [buscandoMaterial, setBuscandoMaterial] = useState(false)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<number | null>(null)

  const debouncePessoaRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceMaterialRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  }, [buscaPessoa])

  useEffect(() => {
    if (debounceMaterialRef.current) clearTimeout(debounceMaterialRef.current)
    if (buscaMaterial.trim().length < 2) {
      setResultadosMaterial([])
      return
    }
    debounceMaterialRef.current = setTimeout(async () => {
      setBuscandoMaterial(true)
      try {
        const res = await fetch(`/api/publico/materiais?busca=${encodeURIComponent(buscaMaterial.trim())}`)
        if (res.ok) setResultadosMaterial((await res.json()).materiais ?? [])
      } finally {
        setBuscandoMaterial(false)
      }
    }, 300)
  }, [buscaMaterial])

  function adicionarAoCarrinho(material: MaterialBusca) {
    if (carrinho.some((i) => i.material.id === material.id)) return
    setCarrinho((prev) => [...prev, { material, quantidade: 1, dataPrevistaDevolucao: "" }])
    setBuscaMaterial("")
    setResultadosMaterial([])
  }

  function removerDoCarrinho(materialId: string) {
    setCarrinho((prev) => prev.filter((i) => i.material.id !== materialId))
  }

  async function enviar() {
    setErro(null)

    if (!pessoa) {
      setErro("Selecione seu cadastro na lista de pessoas atendidas")
      return
    }
    if (carrinho.length === 0) {
      setErro("Adicione pelo menos um material")
      return
    }
    if (tipo === "EMPRESTIMO" && carrinho.some((i) => !i.dataPrevistaDevolucao)) {
      setErro("Informe a data prevista de devolução de todos os itens")
      return
    }

    setEnviando(true)
    try {
      const res = await fetch("/api/publico/requisicoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pessoaAtendidaId: pessoa.id,
          tipo,
          prioridade,
          motivo: motivo.trim() || undefined,
          itens: carrinho.map((i) => ({
            materialId: i.material.id,
            quantidade: i.quantidade,
            dataPrevistaDevolucao: tipo === "EMPRESTIMO" ? i.dataPrevistaDevolucao : undefined,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(data.error || "Não foi possível enviar a requisição")
        return
      }
      setSucesso(data.requisicao.numero)
    } catch {
      setErro("Erro de conexão ao enviar a requisição")
    } finally {
      setEnviando(false)
    }
  }

  if (sucesso !== null) {
    return (
      <Wrapper>
        <Card style={{ alignItems: "center", textAlign: "center", gap: 16 }}>
          <CheckCircle2 size={40} color={theme.colors.status.success} />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Requisição #{sucesso} enviada</h1>
          <p style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
            O almoxarifado vai avaliar seu pedido. Fale com o setor caso precise saber o andamento.
          </p>
          <BotaoPrimario onClick={() => window.location.reload()}>Nova solicitação</BotaoPrimario>
        </Card>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Card>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Solicitar material</h1>
        <p style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
          Formulário do almoxarifado. Se você ainda não tem cadastro, fale com o almoxarifado antes de continuar.
        </p>

        <Campo>
          <Label>Seu cadastro (nome)</Label>
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
                <input placeholder="Digite seu nome..." value={buscaPessoa} onChange={(e) => setBuscaPessoa(e.target.value)} />
                {buscandoPessoa && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
              </BuscaBox>
              {resultadosPessoa.length > 0 && (
                <ResultadosLista>
                  {resultadosPessoa.map((p) => (
                    <ResultadoItem key={p.id} onClick={() => setPessoa(p)}>
                      <div>
                        <div style={{ fontSize: 14 }}>{p.nome}</div>
                        <div style={{ fontSize: 12, color: theme.colors.text.muted }}>{p.setor} · {p.funcao}</div>
                      </div>
                    </ResultadoItem>
                  ))}
                </ResultadosLista>
              )}
              {buscaPessoa.trim().length >= 2 && !buscandoPessoa && resultadosPessoa.length === 0 && (
                <AvisoNaoEncontrado>
                  Nenhum cadastro encontrado com esse nome. Fale com o almoxarifado pra ser cadastrado antes de solicitar.
                </AvisoNaoEncontrado>
              )}
            </>
          )}
        </Campo>

        <TipoTabs>
          <TipoTab $ativo={tipo === "SAIDA"} onClick={() => setTipo("SAIDA")}>
            <PackageMinus size={14} /> Retirar material
          </TipoTab>
          <TipoTab $ativo={tipo === "EMPRESTIMO"} onClick={() => setTipo("EMPRESTIMO")}>
            <HandCoins size={14} /> Pegar emprestado
          </TipoTab>
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
        </Linha>

        <Campo>
          <Label>Motivo (opcional)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
        </Campo>

        <Campo>
          <Label>Buscar material</Label>
          <BuscaBox>
            <Search size={15} />
            <input placeholder="Nome do material..." value={buscaMaterial} onChange={(e) => setBuscaMaterial(e.target.value)} />
            {buscandoMaterial && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
          </BuscaBox>
          {resultadosMaterial.length > 0 && (
            <ResultadosLista>
              {resultadosMaterial.map((m) => (
                <ResultadoItem key={m.id} onClick={() => adicionarAoCarrinho(m)}>
                  <div>
                    <div style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                      {m.nome}
                      {m.requerAprovacao && <ShieldAlert size={11} color={theme.colors.status.warning} />}
                    </div>
                    <div style={{ fontSize: 12, color: theme.colors.text.muted }}>{m.categoria.nome}</div>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{item.material.nome}</div>
                </div>
                <QuantidadeInput
                  type="number"
                  min={0.001}
                  step="any"
                  value={item.quantidade}
                  onChange={(e) =>
                    setCarrinho((prev) =>
                      prev.map((i) => (i.material.id === item.material.id ? { ...i, quantidade: Number(e.target.value) } : i))
                    )
                  }
                />
                <span style={{ fontSize: 12, color: theme.colors.text.muted }}>{item.material.unidadeMedida.sigla}</span>
                {tipo === "EMPRESTIMO" && (
                  <Input
                    type="date"
                    value={item.dataPrevistaDevolucao}
                    onChange={(e) =>
                      setCarrinho((prev) =>
                        prev.map((i) => (i.material.id === item.material.id ? { ...i, dataPrevistaDevolucao: e.target.value } : i))
                      )
                    }
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

        <BotaoPrimario onClick={enviar} disabled={enviando} style={{ justifyContent: "center" }}>
          {enviando && <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />}
          Enviar solicitação
        </BotaoPrimario>
      </Card>
    </Wrapper>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => theme.colors.surface.background};
`

const Card = styled.div`
  width: 100%;
  max-width: 480px;
  background: ${({ theme }) => theme.colors.surface.card};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  backdrop-filter: blur(20px);
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.text.primary};
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
  max-height: 180px;
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
  svg { color: ${({ theme }) => theme.colors.primary.vivid}; flex-shrink: 0; }
`

const AvisoNaoEncontrado = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.status.warning};
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

const Select = styled.select`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  option { background: ${({ theme }) => theme.colors.surface.sidebar}; }
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

const Input = styled.input`
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
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

const QuantidadeInput = styled.input`
  width: 64px;
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

const BotaoPrimario = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.primary.vivid};
  color: ${({ theme }) => theme.colors.neutral.white};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  &:hover { background: ${({ theme }) => theme.colors.primary.deep}; }
  &:disabled { opacity: 0.6; cursor: default; }
`
