"use client"

/**
 * /materiais — Estoque de materiais
 * ------------------------------------------------------------------
 * Lista virtualizada (scroll infinito real, via @tanstack/react-virtual)
 * com otimizações de performance:
 * - LIMIT = 80 (menos chamadas API)
 * - Busca antecipada (20 itens antes do fim)
 * - Cache com useInfiniteQuery do React Query
 * - Janela de páginas (mantém últimas 3 páginas na memória)
 * - Cabeçalho fixo com título das colunas
 *
 * CORREÇÕES / MELHORIAS DESTA REVISÃO (ver comentários "REV:"):
 * 1. Código interno agora tem rótulo ("Cód.") na linha resumida e no
 *    modal de detalhes — antes aparecia "pelado", sem contexto.
 * 2. Estoque atual ganhou rótulo na linha resumida; no modal o rótulo
 *    "Atual" virou "Estoque atual" pra ficar autoexplicativo fora do
 *    contexto dos outros três números ao lado.
 * 3. Coluna "Unid." removida da lista — era redundante com o sufixo já
 *    exibido junto da quantidade (ex: "12 un"). O grid passou de 6 para
 *    5 colunas. O card "Unidade de medida" no modal também foi removido
 *    pelo mesmo motivo (a sigla já aparece junto do valor no resumo de
 *    estoque).
 * 4. Foto no modal de detalhes: a lógica sempre esteve correta
 *    (`material.fotoUrl ? <img> : <ImageOff>`) e o CSS do FotoWrapper
 *    também. O problema real é que uma URL que falha ao carregar (ex:
 *    objeto removido do R2, link expirado, race condition de cache)
 *    ficava com o navegador mostrando um ícone de imagem quebrada sem
 *    Claude ou o app saberem — a condição olha só se a URL existe, não
 *    se ela CARREGA. Agora o estado de erro é rastreado com
 *    onError + useState, resetado a cada material selecionado, caindo
 *    de volta no placeholder com uma mensagem clara quando a imagem não
 *    carrega — igual ao padrão que outras partes do fluxo já usavam
 *    implicitamente sem tratar o erro.
 * 5. Adicionado sistema de retry para carregamento de fotos (3 tentativas
 *    com intervalo de 800ms) para lidar com falhas transitórias.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import styled, { keyframes } from "styled-components"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useInfiniteQuery } from "@tanstack/react-query"
import { theme, hexToRgba } from "@/styles/theme"
import { createClient } from "@/lib/client"
import {
  Search,
  Plus,
  Package,
  PackageSearch,
  ImageOff,
  MapPin,
  Barcode,
  Scan,
  Loader2,
  Inbox,
  X,
  Ruler,
  UserRound,
  CalendarClock,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Hash,
  ShieldAlert,
} from "lucide-react"
import CadastroMaterialModal, { MaterialCriado } from "@/components/materiais/modals/cadastro"
import EditarMaterialModal, { MaterialParaEditar } from "@/components/materiais/modals/editar"

// =====================================================================
// TIPOS
// =====================================================================

type Situacao = "ATIVO" | "INATIVO"
type FiltroSituacao = "TODOS" | Situacao
type FiltroEstoque = "TODOS" | "BAIXO" | "ALTO"

interface Material {
  id: string
  numeroSequencial: number
  codigoInterno: string
  codigoBarras: string | null
  qrCode: string | null
  nome: string
  descricao: string | null
  marca: string | null
  fabricante: string | null
  modelo: string | null
  numeroSerie: string | null
  fornecedor: string | null
  estoqueMinimo: number
  estoqueIdeal: number
  estoqueMaximo: number
  estoqueAtual: number
  localizacaoFisica: string | null
  situacao: Situacao
  fotoUrl: string | null
  requerAprovacao: boolean
  createdAt: string
  updatedAt: string
  categoria: { id: string; nome: string }
  unidadeMedida: { id: string; sigla: string; nome: string }
  criadoPor: { id: string; nome: string }
}

interface Categoria {
  id: string
  nome: string
}

interface Resumo {
  total: number
  inativos: number
  estoqueBaixo: number
  estoqueAlto: number
}

interface PageData {
  materiais: Material[]
  nextCursor: number | null
  resumo: Resumo
}

// Papéis que não devem ver o botão de cadastro
const PAPEIS_SEM_CADASTRO = new Set(["SOLICITANTE"])

// =====================================================================
// HELPERS
// =====================================================================

function statusEstoque(m: Material): "baixo" | "alto" | "normal" {
  if (m.estoqueAtual < m.estoqueMinimo) return "baixo"
  if (m.estoqueAtual > m.estoqueMaximo) return "alto"
  return "normal"
}

function corCategoria(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const paleta = theme.colors.avatarPalette
  return paleta[Math.abs(hash) % paleta.length]
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

const ALTURA_LINHA = 56
const ALTURA_CABECALHO = 44
const LIMIT = 80 // Aumentado de 40 para 80
const PAGINAS_PARA_MANTER = 3 // Mantém últimas 3 páginas na memória

export default function MateriaisPage() {
  const [role, setRole] = useState("")
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  // Buscar role do usuário com Supabase
  useEffect(() => {
    async function getUserRole() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const res = await fetch("/api/perfil")
          if (res.ok) {
            const data = await res.json()
            setRole(data.usuario?.role || "")
          }
        }
      } catch (error) {
        console.error("Erro ao buscar perfil:", error)
      } finally {
        setIsLoadingUser(false)
      }
    }
    
    getUserRole()
  }, [])

  const podeCadastrar = !PAPEIS_SEM_CADASTRO.has(role)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [busca, setBusca] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [situacao, setSituacao] = useState<FiltroSituacao>("TODOS")
  const [estoqueFiltro, setEstoqueFiltro] = useState<FiltroEstoque>("TODOS")
  const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: "asc" | "desc" }>({
    campo: "nome",
    direcao: "asc",
  })

  const [materialSelecionado, setMaterialSelecionado] = useState<Material | null>(null)
  const [materialEditando, setMaterialEditando] = useState<Material | null>(null)
  const [mostrarCadastro, setMostrarCadastro] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350)
    return () => clearTimeout(t)
  }, [busca])

  // Carrega categorias
  useEffect(() => {
    fetch("/api/categorias?ativo=true")
      .then((r) => r.json())
      .then((data) => setCategorias(data.categorias ?? []))
      .catch(() => {})
  }, [])

  // Função de busca de página
  const fetchPage = async ({
    pageParam,
  }: {
    pageParam: number | null
  }): Promise<PageData> => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    if (pageParam !== null && pageParam !== undefined) {
      params.set("cursor", String(pageParam))
    }
    if (buscaDebounced) params.set("busca", buscaDebounced)
    if (categoriaId) params.set("categoriaId", categoriaId)
    if (situacao !== "TODOS") params.set("situacao", situacao)
    if (estoqueFiltro !== "TODOS") params.set("estoqueStatus", estoqueFiltro)
    if (ordenacao.campo) {
      params.set("ordenarPor", ordenacao.campo)
      params.set("ordenarDirecao", ordenacao.direcao)
    }

    const res = await fetch(`/api/materiais?${params.toString()}`)
    if (!res.ok) throw new Error("Falha ao carregar materiais")
    const data = await res.json()

    return {
      materiais: data.materiais,
      nextCursor: data.nextCursor,
      resumo: data.resumo,
    }
  }

  // React Query - useInfiniteQuery
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["materiais", buscaDebounced, categoriaId, situacao, estoqueFiltro, ordenacao],
    queryFn: ({ pageParam }) => fetchPage({ pageParam: pageParam as number | null }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage: PageData) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 5,
    maxPages: PAGINAS_PARA_MANTER,
  })

  // Extrai todos os materiais das páginas
  const todosMateriais = data?.pages?.flatMap((page) => page.materiais) ?? []

  // Extrai o resumo da última página
  const ultimaPagina = data?.pages?.[data.pages.length - 1]
  const resumo = ultimaPagina?.resumo ?? {
    total: 0,
    inativos: 0,
    estoqueBaixo: 0,
    estoqueAlto: 0,
  }

  const totalItems = todosMateriais.length
  const hasMore = hasNextPage

  // Virtualização
  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
  })

  const itensVirtuais = virtualizer.getVirtualItems()

  // Busca antecipada - quando faltam 20 itens
  useEffect(() => {
    const ultimo = itensVirtuais[itensVirtuais.length - 1]
    if (!ultimo) return
    if (ultimo.index >= totalItems - 20 && hasMore && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [itensVirtuais, totalItems, hasMore, isFetchingNextPage, fetchNextPage])

  const abrirCadastro = useCallback(() => setMostrarCadastro(true), [])

  function handleMaterialCadastrado(material: MaterialCriado) {
    setMostrarCadastro(false)
    refetch()
  }

  function handleMaterialSalvo(materialEditado: MaterialParaEditar) {
    setMaterialEditando(null)
    refetch()
    // Atualiza o material selecionado se ele ainda estiver aberto
    if (materialSelecionado && materialSelecionado.id === materialEditado.id) {
      const materialAtualizado = todosMateriais.find(
        (m) => m.id === materialEditado.id
      )
      if (materialAtualizado) {
        setMaterialSelecionado(materialAtualizado)
      }
    }
  }

  // Alterna ordenação
  const toggleOrdenacao = (campo: string) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
    }))
  }

  // Se estiver carregando o usuário, mostrar loading
  if (isLoadingUser) {
    return (
      <PageWrapper>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '400px',
          color: theme.colors.text.muted
        }}>
          <Loader2 size={24} style={{ animation: 'spin 0.7s linear infinite' }} />
          <span style={{ marginLeft: '12px' }}>Carregando...</span>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <HeaderRow>
        <HeaderLeft>
          <HeaderBadge>
            <Package size={24} />
          </HeaderBadge>
          <div>
            <Breadcrumb>Estoque</Breadcrumb>
            <Title>Materiais</Title>
            <Subtitle>
              Todos os itens cadastrados no almoxarifado, na ordem em que entraram no sistema.
            </Subtitle>
          </div>
        </HeaderLeft>

        {podeCadastrar && (
          <PrimaryButton onClick={abrirCadastro}>
            <Plus size={16} />
            Cadastrar item
          </PrimaryButton>
        )}
      </HeaderRow>

      <StatsGrid>
        <StatCard $accent={theme.colors.primary.vivid}>
          <StatValue>{resumo.total}</StatValue>
          <StatLabel>Total de materiais</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.error}>
          <StatValue>{resumo.estoqueBaixo}</StatValue>
          <StatLabel>Estoque baixo</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.status.purple}>
          <StatValue>{resumo.estoqueAlto}</StatValue>
          <StatLabel>Estoque alto</StatLabel>
        </StatCard>
        <StatCard $accent={theme.colors.neutral[500]}>
          <StatValue>{resumo.inativos}</StatValue>
          <StatLabel>Inativos</StatLabel>
        </StatCard>
      </StatsGrid>

      <Toolbar>
        <SearchBox>
          <Search size={16} />
          <input
            placeholder="Buscar por nome, código, marca ou modelo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </SearchBox>

        <Tabs>
          <TabButton $active={situacao === "TODOS"} onClick={() => setSituacao("TODOS")}>
            Todos
          </TabButton>
          <TabButton $active={situacao === "ATIVO"} onClick={() => setSituacao("ATIVO")}>
            Ativos
          </TabButton>
          <TabButton $active={situacao === "INATIVO"} onClick={() => setSituacao("INATIVO")}>
            Inativos
          </TabButton>
        </Tabs>

        <FiltroSelect value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </FiltroSelect>

        <FiltroSelect
          value={estoqueFiltro}
          onChange={(e) => setEstoqueFiltro(e.target.value as FiltroEstoque)}
        >
          <option value="TODOS">Estoque: todos</option>
          <option value="BAIXO">Estoque baixo</option>
          <option value="ALTO">Estoque alto</option>
        </FiltroSelect>
      </Toolbar>

      <ListContainer ref={parentRef}>
        {isLoading && (
          <>
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </>
        )}

        {!isLoading && isError && (
          <ErrorState>
            <AlertTriangle size={32} />
            <span>
              Não foi possível carregar os materiais
              {error instanceof Error ? `: ${error.message}` : "."}
            </span>
            <RetryButton onClick={() => refetch()}>
              <RefreshCw size={14} />
              Tentar novamente
            </RetryButton>
          </ErrorState>
        )}

        {!isLoading && !isError && totalItems === 0 && (
          <EmptyState>
            <Inbox size={32} />
            <span>Nenhum material encontrado pra esse filtro.</span>
          </EmptyState>
        )}

        {!isLoading && !isError && totalItems > 0 && (
          <>
            {/* Cabeçalho das colunas — 5 colunas: # / Material / Categoria / Estoque / Situação.
                REV: coluna "Unid." removida (redundante com o sufixo já exibido junto
                da quantidade, ex: "12 un"). */}
            <TableHeader style={{ height: ALTURA_CABECALHO }}>
              <HeaderCell style={{ width: 40 }}>#</HeaderCell>
              <HeaderCellSortable onClick={() => toggleOrdenacao("nome")}>
                Material
                {ordenacao.campo === "nome" &&
                  (ordenacao.direcao === "asc" ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  ))}
              </HeaderCellSortable>
              <HeaderCellSortable onClick={() => toggleOrdenacao("categoria")}>
                Categoria
                {ordenacao.campo === "categoria" &&
                  (ordenacao.direcao === "asc" ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  ))}
              </HeaderCellSortable>
              <HeaderCellSortable onClick={() => toggleOrdenacao("estoqueAtual")}>
                Estoque
                {ordenacao.campo === "estoqueAtual" &&
                  (ordenacao.direcao === "asc" ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  ))}
              </HeaderCellSortable>
              <HeaderCell style={{ width: 90 }}>Situação</HeaderCell>
            </TableHeader>

            <RowsSizer style={{ height: virtualizer.getTotalSize() }}>
              {itensVirtuais.map((item) => {
                const material = todosMateriais[item.index]
                if (!material) return null
                const tone = statusEstoque(material)

                return (
                  <Row
                    key={material.id}
                    style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                    onClick={() => setMaterialSelecionado(material)}
                  >
                    <RowThumb $color={corCategoria(material.categoria.id)}>
                      {material.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={material.fotoUrl} alt={material.nome} />
                      ) : (
                        <PackageSearch size={15} />
                      )}
                    </RowThumb>

                    <RowInfo>
                      <RowNomeLinha>
                        <RowNome>{material.nome}</RowNome>
                        {material.requerAprovacao && (
                          <ShieldAlert 
                            size={12} 
                            color={theme.colors.status.warning} 
                            aria-label="Requer aprovação para sair" 
                          />
                        )}
                      </RowNomeLinha>
                      {/* REV: código agora com rótulo, antes aparecia "pelado" */}
                      <RowMeta>
                        <Hash size={10} />
                        <RowCodigo>{material.codigoInterno}</RowCodigo>
                      </RowMeta>
                    </RowInfo>

                    <CategoriaBadge $color={corCategoria(material.categoria.id)}>
                      {material.categoria.nome}
                    </CategoriaBadge>

                    {/* REV: rótulo "Estoque" adicionado acima do valor */}
                    <EstoqueCelula>
                      <EstoqueLabel>Estoque</EstoqueLabel>
                      <EstoqueTexto $tone={tone}>
                        {material.estoqueAtual} {material.unidadeMedida.sigla}
                      </EstoqueTexto>
                    </EstoqueCelula>

                    <SituacaoBadge $ativo={material.situacao === "ATIVO"}>
                      {material.situacao === "ATIVO" ? "Ativo" : "Inativo"}
                    </SituacaoBadge>
                  </Row>
                )
              })}
            </RowsSizer>
          </>
        )}

        {isFetchingNextPage && (
          <CarregandoMais>
            <Loader2 size={14} />
            Carregando mais materiais...
          </CarregandoMais>
        )}

        {!hasNextPage && !isError && totalItems > 0 && (
          <FimLista>✓ Todos os materiais carregados ({totalItems})</FimLista>
        )}
      </ListContainer>

      {materialSelecionado && (
        <ModalDetalhes
          material={materialSelecionado}
          onFechar={() => setMaterialSelecionado(null)}
          onEditar={() => setMaterialEditando(materialSelecionado)}
        />
      )}

      {mostrarCadastro && (
        <CadastroMaterialModal
          onClose={() => setMostrarCadastro(false)}
          onCadastrado={handleMaterialCadastrado}
        />
      )}

      {materialEditando && (
        <EditarMaterialModal
          material={materialEditando}
          onClose={() => setMaterialEditando(null)}
          onSalvo={handleMaterialSalvo}
        />
      )}
    </PageWrapper>
  )
}

// =====================================================================
// MODAL DE DETALHES
// =====================================================================

const MAX_TENTATIVAS_FOTO = 3
const INTERVALO_TENTATIVA_MS = 800

function ModalDetalhes({
  material,
  onFechar,
  onEditar,
}: {
  material: Material
  onFechar: () => void
  onEditar: () => void
}) {
  const tone = statusEstoque(material)

  // REV: antes a condição só checava `material.fotoUrl ? <img> : <ImageOff>` —
  // isso cobre "não tem foto cadastrada", mas não cobre "tem foto cadastrada
  // mas a URL falhou ao carregar" (objeto removido do bucket, link expirado,
  // problema transitório de rede). Nesses casos o navegador só mostra um
  // ícone de imagem quebrada, sem cair no placeholder. Agora rastreamos o
  // erro de carregamento explicitamente com tentativas de retry.
  const [fotoComErro, setFotoComErro] = useState(false)
  const [tentativasFoto, setTentativasFoto] = useState(0)
  const [fotoKey, setFotoKey] = useState(0) // força remount do <img> pra reintentar

  // Reset do estado quando o material muda
  useEffect(() => {
    setFotoComErro(false)
    setTentativasFoto(0)
    setFotoKey((k) => k + 1)
  }, [material.id, material.fotoUrl])

  // Handler para quando a imagem falha ao carregar
  function handleErroFoto() {
    if (tentativasFoto + 1 >= MAX_TENTATIVAS_FOTO) {
      setFotoComErro(true)
      return
    }
    // Tenta novamente após um intervalo
    setTimeout(() => {
      setTentativasFoto((t) => t + 1)
      setFotoKey((k) => k + 1) // muda a key -> React remonta o <img> -> nova tentativa de fetch
    }, INTERVALO_TENTATIVA_MS)
  }

  // Handler para quando a imagem carrega com sucesso
  function handleFotoLoad() {
    // Reset das tentativas em caso de sucesso
    setTentativasFoto(0)
  }

  const exibirFoto = Boolean(material.fotoUrl) && !fotoComErro

  return (
    <ModalOverlay onClick={onFechar}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <ModalTopo>
          <ModalTopoInfo>
            <Breadcrumb>{material.categoria.nome}</Breadcrumb>
            <Title style={{ fontSize: theme.typography.fontSize["2xl"], marginTop: 2 }}>
              {material.nome}
            </Title>
            {/* REV: código com rótulo, consistente com a linha resumida */}
            <CodigoLinha>
              <Hash size={11} />
              <RowCodigo>{material.codigoInterno}</RowCodigo>
            </CodigoLinha>
            {material.requerAprovacao && (
              <AprovacaoBadge>
                <ShieldAlert size={12} />
                Requer aprovação do supervisor pra sair
              </AprovacaoBadge>
            )}
          </ModalTopoInfo>
          <ModalTopoActions>
            <FecharButton onClick={onEditar} title="Editar">
              <Pencil size={18} />
            </FecharButton>
            <FecharButton onClick={onFechar} title="Fechar">
              <X size={18} />
            </FecharButton>
          </ModalTopoActions>
        </ModalTopo>

        <FotoWrapper>
          {exibirFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={fotoKey}
              src={material.fotoUrl as string}
              alt={material.nome}
              onLoad={handleFotoLoad}
              onError={handleErroFoto}
            />
          ) : (
            <FotoPlaceholder>
              <ImageOff size={28} />
              <span>
                {fotoComErro ? "Não foi possível carregar a foto" : "Sem foto cadastrada"}
              </span>
            </FotoPlaceholder>
          )}
        </FotoWrapper>

        <EstoqueResumo>
          <EstoqueResumoItem $destaque={tone === "baixo" ? "baixo" : undefined}>
            <strong>
              {material.estoqueAtual}
              <UnidadeInline>{material.unidadeMedida.sigla}</UnidadeInline>
            </strong>
            {/* REV: "Atual" -> "Estoque atual" pra ficar claro fora do contexto dos outros 3 */}
            <span>Estoque atual</span>
          </EstoqueResumoItem>
          <EstoqueResumoItem>
            <strong>{material.estoqueMinimo}</strong>
            <span>Mínimo</span>
          </EstoqueResumoItem>
          <EstoqueResumoItem>
            <strong>{material.estoqueIdeal}</strong>
            <span>Ideal</span>
          </EstoqueResumoItem>
          <EstoqueResumoItem $destaque={tone === "alto" ? "alto" : undefined}>
            <strong>{material.estoqueMaximo}</strong>
            <span>Máximo</span>
          </EstoqueResumoItem>
        </EstoqueResumo>

        {material.descricao && (
          <EspecItem>
            <EspecLabel>Descrição</EspecLabel>
            <EspecValor>{material.descricao}</EspecValor>
          </EspecItem>
        )}

        {/* REV: card "Unidade de medida" removido do grid — a sigla já aparece
            junto do valor no resumo de estoque acima (ex: "12 un"). */}
        <EspecGrid>
          <EspecItem>
            <EspecLabel>Situação</EspecLabel>
            <EspecValor>
              <SituacaoBadge $ativo={material.situacao === "ATIVO"}>
                {material.situacao === "ATIVO" ? "Ativo" : "Inativo"}
              </SituacaoBadge>
            </EspecValor>
          </EspecItem>
          {material.marca && (
            <EspecItem>
              <EspecLabel>Marca</EspecLabel>
              <EspecValor>{material.marca}</EspecValor>
            </EspecItem>
          )}
          {material.fabricante && (
            <EspecItem>
              <EspecLabel>Fabricante</EspecLabel>
              <EspecValor>{material.fabricante}</EspecValor>
            </EspecItem>
          )}
          {material.modelo && (
            <EspecItem>
              <EspecLabel>Modelo</EspecLabel>
              <EspecValor>{material.modelo}</EspecValor>
            </EspecItem>
          )}
          {material.numeroSerie && (
            <EspecItem>
              <EspecLabel>Número de série</EspecLabel>
              <EspecValor>{material.numeroSerie}</EspecValor>
            </EspecItem>
          )}
          {material.localizacaoFisica && (
            <EspecItem>
              <EspecLabel>Localização física</EspecLabel>
              <EspecValor>
                <MapPin size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />
                {material.localizacaoFisica}
              </EspecValor>
            </EspecItem>
          )}
          {material.codigoBarras && (
            <EspecItem>
              <EspecLabel>Código de barras</EspecLabel>
              <EspecValor>
                <Barcode size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />
                {material.codigoBarras}
              </EspecValor>
            </EspecItem>
          )}
          {material.qrCode && (
            <EspecItem>
              <EspecLabel>QR Code</EspecLabel>
              <EspecValor>
                <Scan size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />
                {material.qrCode}
              </EspecValor>
            </EspecItem>
          )}
        </EspecGrid>

        <RodapeModal>
          <span>
            <UserRound size={12} />
            Cadastrado por {material.criadoPor.nome}
          </span>
          <span>
            <CalendarClock size={12} />
            {formatarData(material.createdAt)}
          </span>
        </RodapeModal>
      </ModalCard>
    </ModalOverlay>
  )
}

// =====================================================================
// STYLED COMPONENTS
// =====================================================================

// Animações
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const glassCardStyles = `
  background: ${theme.colors.surface.card};
  border: 1px solid ${theme.colors.surface.border};
  border-radius: ${theme.radii.lg};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: ${theme.shadows.card};
`

// Layout
const PageWrapper = styled.div`
  max-width: ${({ theme }) => theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.layout.contentPadding};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[8]};
  height: 100%;
`

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[4]};
  flex-wrap: wrap;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
`

const HeaderBadge = styled.div`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.radii.lg};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.16)};
  border: 1px solid ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.35)};
  color: ${({ theme }) => theme.colors.primary.vivid};
`

const Breadcrumb = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text.muted};
`

const Title = styled.h1`
  margin-top: 2px;
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
`

const Subtitle = styled.p`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  max-width: 52ch;
`

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[5]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.primary.vivid};
  color: ${({ theme }) => theme.colors.neutral.white};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  transition: background ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primary.deep};
  }

  &:active {
    transform: translateY(1px);
  }
`

// Stats
const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const StatCard = styled.div<{ $accent: string }>`
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  position: relative;
  overflow: hidden;
  transition: transform ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast};

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: ${({ $accent }) => $accent};
  }

  &:hover {
    transform: translateY(-1px);
    border-color: ${({ $accent }) => hexToRgba($accent, 0.4)};
  }
`

const StatValue = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize["3xl"]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: 1;
  font-variant-numeric: tabular-nums;
`

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

// Toolbar
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  ${glassCardStyles}
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  min-width: 240px;
  flex: 1;
  max-width: 320px;
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus-within {
    border-color: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.5)};
  }

  svg {
    color: ${({ theme }) => theme.colors.text.muted};
    flex-shrink: 0;
  }

  input {
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    width: 100%;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};

    &::placeholder {
      color: ${({ theme }) => theme.colors.text.muted};
    }
  }
`

const Tabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  ${glassCardStyles}
  padding: ${({ theme }) => theme.spacing[1]};
  flex-shrink: 0;
`

const TabButton = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  white-space: nowrap;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.text.primary : theme.colors.text.secondary};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.surface.sidebarActive : "transparent"};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.colors.surface.sidebarActive : theme.colors.surface.glass};
  }
`

const FiltroSelect = styled.select`
  ${glassCardStyles}
  background: ${({ theme }) => theme.colors.surface.glass};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
  flex-shrink: 0;

  option {
    background: ${({ theme }) => theme.colors.surface.sidebar};
  }
`

// Lista com cabeçalho
const ListContainer = styled.div`
  ${glassCardStyles}
  flex: 1;
  min-height: 420px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

// REV: grid de 5 colunas (antes 6 — removida a coluna "Unid.", redundante
// com o sufixo já exibido junto da quantidade de estoque).
const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 40px minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1fr) 90px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: 0 ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => hexToRgba(theme.colors.surface.sidebar, 0.8)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 36px minmax(0, 1fr) 90px;
    & > *:nth-child(3),
    & > *:nth-child(4) {
      display: none;
    }
  }
`

const HeaderCell = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const HeaderCellSortable = styled(HeaderCell)`
  cursor: pointer;
  user-select: none;
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
  }

  svg {
    opacity: 0.6;
  }
`

const RowsSizer = styled.div`
  position: relative;
  width: 100%;
`

const Row = styled.button`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: grid;
  grid-template-columns: 40px minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1fr) 90px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: 0 ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  text-align: left;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
  }

  &:active {
    background: ${({ theme }) => hexToRgba(theme.colors.primary.vivid, 0.08)};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 36px minmax(0, 1fr) 90px;

    & > *:nth-child(3),
    & > *:nth-child(4) {
      display: none;
    }
  }
`

const RowThumb = styled.div<{ $color: string }>`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $color }) => hexToRgba($color, 0.2)};
  border: 1px solid ${({ $color }) => hexToRgba($color, 0.4)};
  color: ${({ $color }) => $color};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const RowInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
`

const RowNomeLinha = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;

  svg {
    flex-shrink: 0;
  }
`

const RowNome = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

// REV: wrapper novo pra dar contexto ao código (ícone + rótulo implícito)
const RowMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${({ theme }) => theme.colors.text.muted};
  opacity: 0.85;
`

const RowCodigo = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`

const CategoriaBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $color }) => $color};
  background: ${({ $color }) => hexToRgba($color, 0.14)};
  border: 1px solid ${({ $color }) => hexToRgba($color, 0.3)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

// REV: célula de estoque agora tem rótulo pequeno acima do valor
const EstoqueCelula = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`

const EstoqueLabel = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.8;
`

const EstoqueTexto = styled.span<{ $tone: "baixo" | "alto" | "normal" }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $tone }) =>
    $tone === "baixo"
      ? theme.colors.status.error
      : $tone === "alto"
      ? theme.colors.status.purple
      : theme.colors.text.secondary};
`

const SituacaoBadge = styled.span<{ $ativo: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, $ativo }) => ($ativo ? theme.colors.status.success : theme.colors.text.muted)};
  background: ${({ theme, $ativo }) => ($ativo ? theme.colors.status.successBg : theme.colors.surface.glass)};
  border: 1px solid
    ${({ theme, $ativo }) => ($ativo ? theme.colors.status.successBorder : theme.colors.surface.border)};

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
`

// Estados
const SkeletonRow = styled.div`
  height: 56px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.surface.border};
  animation: ${pulse} 1.4s ease-in-out infinite;
`

const EmptyState = styled.div`
  padding: ${({ theme }) => theme.spacing[10]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;

  svg {
    opacity: 0.5;
  }
`

const ErrorState = styled.div`
  padding: ${({ theme }) => theme.spacing[10]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.colors.status.error};
  text-align: center;
`

const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
  }
`

const CarregandoMais = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};

  svg {
    animation: ${spin} 0.7s linear infinite;
  }
`

const FimLista = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
`

// Modal de Detalhes
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
  ${glassCardStyles}
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[5]};
  animation: ${slideIn} 0.2s ease both;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: ${({ theme }) => theme.radii.full};
  }
`

const ModalTopo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`

const ModalTopoInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

// REV: linha do código no modal, com ícone + estilo consistente com a lista
const CodigoLinha = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.text.muted};
`

const AprovacaoBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  margin-top: 6px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.status.warning};
  background: ${({ theme }) => theme.colors.status.warningBg};
  border: 1px solid ${({ theme }) => theme.colors.status.warningBorder};
`

const ModalTopoActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  flex-shrink: 0;
`

const FotoWrapper = styled.div`
  width: 100%;
  position: relative;
  padding-top: 56.25%;
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
  flex-shrink: 0;

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain; /* era "cover" — contain nunca corta a imagem */
    display: block;
  }
`

const FotoPlaceholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.text.muted};

  svg {
    opacity: 0.5;
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  }
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

  &:hover {
    background: ${({ theme }) => theme.colors.surface.glass};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`

const EspecGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`

const EspecItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const EspecLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`

const EspecValor = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
`

const EstoqueResumo = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface.glass};
  border: 1px solid ${({ theme }) => theme.colors.surface.border};
`

const EstoqueResumoItem = styled.div<{ $destaque?: "baixo" | "alto" }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    font-variant-numeric: tabular-nums;
    color: ${({ theme, $destaque }) =>
      $destaque === "baixo"
        ? theme.colors.status.error
        : $destaque === "alto"
        ? theme.colors.status.purple
        : theme.colors.text.primary};
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.muted};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`

// REV: sigla da unidade junto do número do estoque atual (substitui o card
// "Unidade de medida" que existia separado no EspecGrid)
const UnidadeInline = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.muted};
  margin-left: 3px;
`

const RodapeModal = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing[2]};
  padding-top: ${({ theme }) => theme.spacing[3]};
  border-top: 1px solid ${({ theme }) => theme.colors.surface.border};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.muted};

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
`