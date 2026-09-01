// ============================================================================
// prisma/demo-seed.ts  (SEED EXCLUSIVO DA DEMO — NUNCA rodar em produção)
// ============================================================================
//
// Cria um banco demo populado com dados 100% FICTÍCIOS, isolado da operação
// real, para apresentação como portfólio.
//
// PROTEÇÕES:
//   - Só executa se process.env.DEMO_ENV === "true" (aborta caso contrário).
//   - NÃO carrega `.env.local` (a migração real que usa .env.local é outra
//     — o `prisma generate`/`migrate` vive no prisma.config.ts). Aqui quem
//     define o destino é o DATABASE_URL/DIRECT_URL do AMBIENTE.
//   - É idempotente: no início apaga os dados demo (ordem de FK) e recria.
//   - Credenciais vêm de variável de ambiente, nunca hardcoded.
//
// USO (ver docs/DEPLOY_DEMO.md):
//   $env:DEMO_ENV="true"
//   $env:DATABASE_URL="<postgres://... do banco DEMO>"      # poolada
//   $env:DIRECT_URL="<postgres://... do banco DEMO>"        # direta
//   $env:DEMO_PASSWORD="<senha compartilhada dos usuários demo>"
//   npm run seed:demo
// ============================================================================

import { createClient } from "@supabase/supabase-js"
import { prisma } from "../src/lib/prisma"
import {
  Prisma,
  Role,
  StatusMaterial,
  TipoMovimentacao,
  TipoSolicitacao,
  OrigemSolicitacao,
  StatusItemSolicitacao,
  Prioridade,
  TipoUnidade,
  TipoUsoMaterial,
  StatusEmprestimo,
  TipoItemCompra,
  StatusItemCompra,
  StatusPedidoCompra,
} from "@prisma/client"
import { gerarCodigoInterno } from "../src/lib/utils/codigo-interno"
import { calcularStatusAgregado } from "../src/lib/requisicoes/requisicoes-helpers"

// ---------------------------------------------------------------------------
// GUARDAS DE SEGURANÇA — aborte antes de qualquer escrita
// ---------------------------------------------------------------------------

if (process.env.DEMO_ENV !== "true") {
  console.error(
    "\n[seed-demo] ABORTADO: DEMO_ENV não é 'true'.\n" +
      "Este seed destrói e recria os dados do banco apontado por DATABASE_URL.\n" +
      "Defina DEMO_ENV=true apontando exclusivamente para o banco da DEMO.\n"
  )
  process.exit(1)
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? ""
const DEMO_PASSWORD_FALLBACK_LOG =
  !DEMO_PASSWORD
    ? "== AVISO: DEMO_PASSWORD não definida. As contas demo serão criadas com senha 'demo1234' (apenas ambiente local/portfólio). Defina DEMO_PASSWORD para personalizar. =="
    : ""

const USUARIOS_EMAIL_SUFIXO = "@demo-almoxarifado.com"

/** Gera o e-mail determinístico de uma conta demo a partir de um prefixo. */
function emailDemo(prefixo: string): string {
  return `${prefixo}${USUARIOS_EMAIL_SUFIXO}`
}

const everybodyPassword = DEMO_PASSWORD || "Demo@1234"

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[seed-demo] ABORTADO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para criar as contas demo no Supabase Auth."
  )
  process.exit(1)
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

type NovoDemoUser = {
  prefixo: string
  nome: string
  sobrenome: string
  role: Role
  setor: string
  cargo: string
}

// Usuários fictícios — NUNCA usar nomes/emails da operação real.
const USUARIOS_DEMO: NovoDemoUser[] = [
  { prefixo: "admin",        nome: "Carlos",     sobrenome: "Mendes",    role: "ADMIN",         setor: "Administração",   cargo: "Administrador do almoxarifado" },
  { prefixo: "gestor",       nome: "Marina",     sobrenome: "Oliveira",  role: "GESTOR",        setor: "Operações",       cargo: "Gerente de suprimentos" },
  { prefixo: "supervisor",   nome: "Rafael",     sobrenome: "Santos",    role: "SUPERVISOR",    setor: "Manutenção",      cargo: "Supervisor de manutenção predial" },
  { prefixo: "almoxarife1",  nome: "Juliana",    sobrenome: "Costa",     role: "ALMOXARIFE",    setor: "Almoxarifado",    cargo: "Almoxarife" },
  { prefixo: "almoxarife2",  nome: "Pedro",      sobrenome: "Almeida",   role: "ALMOXARIFE",    setor: "Almoxarifado",    cargo: "Almoxarife" },
  { prefixo: "solicitante1", nome: "Fernanda",   sobrenome: "Lima",      role: "SOLICITANTE",   setor: "Enfermaria",      cargo: "Enfermeira" },
  { prefixo: "solicitante2", nome: "Gustavo",    sobrenome: "Rocha",     role: "SOLICITANTE",   setor: "Copa",            cargo: "Cozinheiro" },
  { prefixo: "solicitante3", nome: "Beatriz",    sobrenome: "Nunes",     role: "SOLICITANTE",   setor: "Recepção",        cargo: "Recepcionista" },
]
// ---------------------------------------------------------------------------
// CADASTROS BASE FICTÍCIOS
// ---------------------------------------------------------------------------

type NovaCategoria = { nome: string; descricao: string }
const CATEGORIAS: NovaCategoria[] = [
  { nome: "Elétrica", descricao: "Materiais de instalação e manutenção elétrica" },
  { nome: "Hidráulica", descricao: "Tubos, conexões e peças para água/esgoto" },
  { nome: "Ferramentas", descricao: "Ferramentas manuais e elétricas de uso geral" },
  { nome: "EPIs", descricao: "Equipamentos de proteção individual" },
  { nome: "Manutenção predial", descricao: "Itens diversos para conservação do prédio" },
  { nome: "Limpeza", descricao: "Produtos e utensílios de higiene e limpeza" },
  { nome: "Informática", descricao: "Periféricos, cabos e insumos de TI" },
  { nome: "Materiais de consumo", descricao: "Material de escritório e consumo geral" },
]

type NovaUnidade = { sigla: string; nome: string; fracionada: boolean }
const UNIDADES: NovaUnidade[] = [
  { sigla: "UN",    nome: "Unidade",    fracionada: false },
  { sigla: "CX",    nome: "Caixa",      fracionada: false },
  { sigla: "RL",    nome: "Rolo",       fracionada: false },
  { sigla: "PAR",   nome: "Par",        fracionada: false },
  { sigla: "PCT",   nome: "Pacote",     fracionada: false },
  { sigla: "JGO",   nome: "Jogo",       fracionada: false },
  { sigla: "METRO", nome: "Metro",      fracionada: true },
  { sigla: "L",     nome: "Litro",      fracionada: true },
  { sigla: "KG",    nome: "Quilograma", fracionada: true },
]

type PessoaDemo = { nome: string; setor: string; funcao: string }
const PESSOAS_DEMO: PessoaDemo[] = [
  { nome: "Ana Souza",        setor: "Enfermaria",    funcao: "Técnica de enfermagem" },
  { nome: "Bruno Ferreira",   setor: "Manutenção",    funcao: "Eletricista" },
  { nome: "Clara Martins",    setor: "Copa",          funcao: "Cozinheira" },
  { nome: "Diego Barbosa",    setor: "Segurança",     funcao: "Vigilante" },
  { nome: "Elisa Ramos",      setor: "Recepção",      funcao: "Recepcionista" },
  { nome: "Felipe Cardoso",   setor: "Manutenção",    funcao: "Encanador" },
  { nome: "Gabriela Reis",    setor: "Administração", funcao: "Analista administrativa" },
  { nome: "Heitor Nunes",     setor: "Manutenção",    funcao: "Pintor" },
  { nome: "Isabela Fogaça",   setor: "Enfermaria",    funcao: "Enfermeira" },
  { nome: "João Barbosa",     setor: "Copa",          funcao: "Auxiliar de copa" },
  { nome: "Larissa Teixeira", setor: "Limpeza",       funcao: "Auxiliar de limpeza" },
  { nome: "Marcos Dias",      setor: "Manutenção",    funcao: "Marceneiro" },
]

// Zona de estoque desejada ao final — dá vida às telas (dashboard/relatórios).
type ZonaEstoque = "normal" | "baixo" | "critico" | "alto" | "zero"

type MaterialDemo = {
  nome: string
  categoria: string // nome da categoria
  unidade: string // sigla da unidade
  zona: ZonaEstoque
  retornavel: boolean
  estoqueMinimo: number
  estoqueIdeal: number
  estoqueMaximo: number
  marca?: string
  local?: string
  requerAprovacao?: boolean
  situacao?: StatusMaterial
}

// ≈ 56 materiais fictícios — nomes plausíveis de uma operação real.
const MATERIAIS_DEMO: MaterialDemo[] = [
  // Elétrica
  { nome: "Cabo Flexível 2,5mm²",          categoria: "Elétrica",  unidade: "METRO", zona: "normal", retornavel: false, estoqueMinimo: 50, estoqueIdeal: 240, estoqueMaximo: 360, local: "Prateleira E-1" },
  { nome: "Cabo Flexível 1,5mm²",          categoria: "Elétrica",  unidade: "METRO", zona: "normal", retornavel: false, estoqueMinimo: 40, estoqueIdeal: 180, estoqueMaximo: 300, local: "Prateleira E-1" },
  { nome: "Lâmpada LED 18W",                categoria: "Elétrica",  unidade: "UN",    zona: "baixo",   retornavel: false, estoqueMinimo: 12, estoqueIdeal: 40,  estoqueMaximo: 80,  local: "Prateleira E-2" },
  { nome: "Lâmpada Fluorescente 15W",       categoria: "Elétrica",  unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 20,  estoqueMaximo: 40,  local: "Prateleira E-2" },
  { nome: "Disjuntor Bipolar 20A",          categoria: "Elétrica",  unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 14,  estoqueMaximo: 24,  local: "Gaveta 3" },
  { nome: "Disjuntor Unipolar 16A",         categoria: "Elétrica",  unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 18,  estoqueMaximo: 30,  local: "Gaveta 3" },
  { nome: "Fita Isolante 20m",              categoria: "Elétrica",  unidade: "RL",    zona: "normal",  retornavel: false, estoqueMinimo: 10, estoqueIdeal: 30,  estoqueMaximo: 60,  local: "Prateleira E-3" },
  { nome: "Interruptor Simples 10A",        categoria: "Elétrica",  unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 22,  estoqueMaximo: 40,  local: "Gaveta 4" },
  { nome: "Tomada 2P+T 10A",                categoria: "Elétrica",  unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 20,  estoqueMaximo: 36,  local: "Gaveta 4" },
  { nome: "Redutor Eletrônico 40W",         categoria: "Elétrica",  unidade: "UN",    zona: "zero",    retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 10,  estoqueMaximo: 18,  local: "Prateleira E-2" },

  // Hidráulica
  { nome: "Tubo PVC 3/4\"",                 categoria: "Hidráulica", unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 20, estoqueMaximo: 40,  local: "Estante H-2" },
  { nome: "Registro de Gaveta 1/2\"",       categoria: "Hidráulica", unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12, estoqueMaximo: 24,  local: "Estante H-3" },
  { nome: "Torneira de Jardim",             categoria: "Hidráulica", unidade: "UN",    zona: "baixo",   retornavel: false, estoqueMinimo: 3,  estoqueIdeal: 10, estoqueMaximo: 18,  local: "Estante H-3" },
  { nome: "Fita Veda-Rosca 20m",            categoria: "Hidráulica", unidade: "RL",    zona: "normal",  retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 24, estoqueMaximo: 48,  local: "Prateleira H-1" },
  { nome: "Cano Flexível 1/2\"",            categoria: "Hidráulica", unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 16, estoqueMaximo: 30,  local: "Estante H-3" },
  { nome: "Sifão de Copo Branco",           categoria: "Hidráulica", unidade: "UN",    zona: "critico", retornavel: false, estoqueMinimo: 5,  estoqueIdeal: 14, estoqueMaximo: 24,  local: "Estante H-2" },
  { nome: "Adaptador Rosca 1/2\"×3/4\"",    categoria: "Hidráulica", unidade: "UN",    zona: "normal",  retornavel: false, estoqueMinimo: 10, estoqueIdeal: 26, estoqueMaximo: 50,  local: "Estante H-1" },
// Ferramentas (retornáveis — geram empréstimos)
  { nome: "Chave de Fenda Cruz 6x150",      categoria: "Ferramentas", unidade: "UN", zona: "normal", retornavel: true,  estoqueMinimo: 3,  estoqueIdeal: 8, estoqueMaximo: 14, local: "Painel F-1" },
  { nome: "Chave de Fenda Chata 6x150",     categoria: "Ferramentas", unidade: "UN", zona: "normal", retornavel: true,  estoqueMinimo: 3,  estoqueIdeal: 8, estoqueMaximo: 14, local: "Painel F-1" },
  { nome: "Alicate Universal 8\"",           categoria: "Ferramentas", unidade: "UN", zona: "normal", retornavel: true,  estoqueMinimo: 4,  estoqueIdeal: 10, estoqueMaximo: 16, local: "Painel F-2" },
  { nome: "Alicate de Corte 7\"",            categoria: "Ferramentas", unidade: "UN", zona: "normal", retornavel: true,  estoqueMinimo: 4,  estoqueIdeal: 10, estoqueMaximo: 16, local: "Painel F-2" },
  { nome: "Martelo de Unha 300g",            categoria: "Ferramentas", unidade: "UN", zona: "normal", retornavel: true,  estoqueMinimo: 2,  estoqueIdeal: 6, estoqueMaximo: 10, local: "Painel F-3" },
  { nome: "Parafusadeira 18V",               categoria: "Ferramentas", unidade: "UN", zona: "baixo",   retornavel: true,  estoqueMinimo: 2,  estoqueIdeal: 5, estoqueMaximo: 8,  local: "Armário ferramentas", requerAprovacao: true },

  // EPIs
  { nome: "Luva de Proteção NR6 (par)",      categoria: "EPIs", unidade: "PAR", zona: "normal",  retornavel: false, estoqueMinimo: 20, estoqueIdeal: 60, estoqueMaximo: 120, local: "Gaveta E-2" },
  { nome: "Óculos de Proteção",              categoria: "EPIs", unidade: "UN",  zona: "normal",  retornavel: false, estoqueMinimo: 10, estoqueIdeal: 30, estoqueMaximo: 60,  local: "Gaveta E-2" },
  { nome: "Luva Nitrílica NR6 (caixa)",      categoria: "EPIs", unidade: "CX",  zona: "normal",  retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 20, estoqueMaximo: 40,  local: "Gaveta E-2" },
  { nome: "Protetor Auricular Plug",         categoria: "EPIs", unidade: "PAR", zona: "alto",    retornavel: false, estoqueMinimo: 15, estoqueIdeal: 40, estoqueMaximo: 60,  local: "Gaveta E-2" },
  { nome: "Máscara PFF2 (pct)",              categoria: "EPIs", unidade: "PCT", zona: "critico",  retornavel: false, estoqueMinimo: 10, estoqueIdeal: 30, estoqueMaximo: 60,  local: "Gaveta E-2" },
  { nome: "Avental Impermeável",             categoria: "EPIs", unidade: "UN",  zona: "normal",  retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12, estoqueMaximo: 20,  local: "Gaveta E-3" },

  // Manutenção predial
  { nome: "Parafuso Máquina 5×30 (pct)",     categoria: "Manutenção predial", unidade: "PCT", zona: "normal", retornavel: false, estoqueMinimo: 10, estoqueIdeal: 30,  estoqueMaximo: 60, local: "Gaveta M-1" },
  { nome: "Bucha Nylon 6×30 (pct)",          categoria: "Manutenção predial", unidade: "PCT", zona: "normal", retornavel: false, estoqueMinimo: 10, estoqueIdeal: 28,  estoqueMaximo: 56, local: "Gaveta M-1" },
  { nome: "Pincel Laja 4\"",                 categoria: "Manutenção predial", unidade: "UN",  zona: "normal", retornavel: false, estoqueMinimo: 5,  estoqueIdeal: 14,  estoqueMaximo: 26, local: "Gaveta M-2" },
  { nome: "Rolo de Lã para Tinta 9\"",       categoria: "Manutenção predial", unidade: "UN",  zona: "normal", retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12,  estoqueMaximo: 22, local: "Gaveta M-2" },
  { nome: "Fechadura de Embutir",            categoria: "Manutenção predial", unidade: "UN",  zona: "baixo",  retornavel: false, estoqueMinimo: 2,  estoqueIdeal: 6,   estoqueMaximo: 10, local: "Gaveta M-3" },
  { nome: "Canos de Queda PVC 100mm",        categoria: "Manutenção predial", unidade: "UN",  zona: "critico",retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12,  estoqueMaximo: 20, local: "Estante M-1" },
// Limpeza
  { nome: "Detergente Neutro 5L",            categoria: "Limpeza", unidade: "L",   zona: "normal", retornavel: false, estoqueMinimo: 12, estoqueIdeal: 40, estoqueMaximo: 80,  local: "Estante L-1" },
  { nome: "Desinfetante 5L",                 categoria: "Limpeza", unidade: "L",   zona: "normal", retornavel: false, estoqueMinimo: 12, estoqueIdeal: 36, estoqueMaximo: 72,  local: "Estante L-1" },
  { nome: "Papel Toalha (pct 1.000)",        categoria: "Limpeza", unidade: "PCT", zona: "baixo", retornavel: false, estoqueMinimo: 5,  estoqueIdeal: 15, estoqueMaximo: 30,  local: "Estante L-2" },
  { nome: "Saco de Lixo 100L (pct 100)",     categoria: "Limpeza", unidade: "PCT", zona: "normal", retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 22, estoqueMaximo: 44,  local: "Estante L-2" },
  { nome: "Rodinho para Água",                categoria: "Limpeza", unidade: "UN",  zona: "alto",   retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 16, estoqueMaximo: 20,  local: "Estante L-3" },
  { nome: "Sabão em Pó 1kg",                 categoria: "Limpeza", unidade: "UN",  zona: "zero",   retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 24, estoqueMaximo: 48,  local: "Estante L-1" },

  // Informática
  { nome: "Teclado USB Padrão ABNT2",       categoria: "Informática", unidade: "UN", zona: "normal",  retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12, estoqueMaximo: 24, local: "Armário TI" },
  { nome: "Mouse USB Óptico",               categoria: "Informática", unidade: "UN", zona: "normal",  retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12, estoqueMaximo: 24, local: "Armário TI" },
  { nome: "Cabo HDMI 1,5m",                 categoria: "Informática", unidade: "UN", zona: "normal",  retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 10, estoqueMaximo: 20, local: "Caixa TI" },
  { nome: "Cabo de Rede Cat6 1m",           categoria: "Informática", unidade: "UN", zona: "normal",  retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 18, estoqueMaximo: 36, local: "Caixa TI" },
  { nome: "Toner Impressora (preto)",        categoria: "Informática", unidade: "UN", zona: "alto",    retornavel: false, estoqueMinimo: 2,  estoqueIdeal: 6,  estoqueMaximo: 8,  local: "Armário TI" },
  { nome: "Webcam USB 1080p",                categoria: "Informática", unidade: "UN", zona: "critico", retornavel: false, estoqueMinimo: 3,  estoqueIdeal: 8,  estoqueMaximo: 14, local: "Caixa TI" },

  // Materiais de consumo
  { nome: "Cartucho de Tinta (preto)",       categoria: "Materiais de consumo", unidade: "UN",  zona: "normal", retornavel: false, estoqueMinimo: 4,  estoqueIdeal: 12, estoqueMaximo: 24,  local: "Gaveta CG-1" },
  { nome: "Papel Sulfite A4 (resma)",        categoria: "Materiais de consumo", unidade: "UN",  zona: "normal", retornavel: false, estoqueMinimo: 20, estoqueIdeal: 60, estoqueMaximo: 120, local: "Prateleira CG-1" },
  { nome: "Caneta Azul (caixa)",            categoria: "Materiais de consumo", unidade: "CX",  zona: "normal", retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 15, estoqueMaximo: 30,  local: "Gaveta CG-2" },
  { nome: "Caneta Motoqueira (pct)",          categoria: "Materiais de consumo", unidade: "PCT", zona: "zero",    retornavel: false, estoqueMinimo: 8,  estoqueIdeal: 20, estoqueMaximo: 40,  local: "Gaveta CG-2" },
  { nome: "Clips de Aço 33mm (caixa)",       categoria: "Materiais de consumo", unidade: "CX",  zona: "normal", retornavel: false, estoqueMinimo: 6,  estoqueIdeal: 14, estoqueMaximo: 28,  local: "Gaveta CG-2" },
]

// ---------------------------------------------------------------------------
// HELPERS — geração determinística e coerente do histórico
// ---------------------------------------------------------------------------

/** PRNG determinístico (mulberry32) para dados estáveis entre execuções. */
function criarRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Arredonda conforme unidade inteira (int) ou fracionada (1 casa decimal). */
function arredondar(n: number, fracionada: boolean): number {
  return fracionada ? Math.round(n * 10) / 10 : Math.round(n)
}

/** Data subtraída de N dias. */
function subtrairDias(data: Date, dias: number): Date {
  const d = new Date(data)
  d.setDate(d.getDate() - dias)
  return d
}

type OpEstoque = {
  tipo: TipoMovimentacao
  quantidade: number
  data: Date
  motivo: string
  documentoReferencia?: string
  solicitanteNome?: string
  solicitanteSetor?: string
  solicitanteFuncao?: string
  pessoaAtendidaId?: string
}

const MOTIVOS_ENTRADA = [
  "Recebimento de pedido de compra",
  "Devolução de material",
  "Compra direta",
  "Reposição de estoque",
]
const MOTIVOS_SAIDA = [
  "Requisição de consumo",
  "Instalação/manutenção",
  "Uso em serviço",
  "Retirada para obra",
]
const MOTIVOS_DESCARTE = ["Validade vencida", "Item danificado", "Descarte de excedente"]

function alvoPorZona(m: MaterialDemo, fracionada: boolean, rng: () => number): number {
  const { estoqueMinimo, estoqueIdeal, estoqueMaximo, zona } = m
  switch (zona) {
    case "baixo":
      return arredondar(estoqueMinimo * (0.2 + rng() * 0.55), fracionada)
    case "critico":
      return arredondar(estoqueMinimo * rng() * 0.35, fracionada)
    case "alto":
      return arredondar(estoqueMaximo * (1.15 + rng() * 0.35), fracionada)
    case "zero":
      return 0
    default: {
      // normal → dentro da faixa, perto do ideal
      const lo = Math.min(estoqueIdeal, estoqueMaximo)
      const hi = Math.max(estoqueIdeal, estoqueMaximo)
      return arredondar((lo + hi) / 2 + (rng() * 2 - 1) * (hi - lo) * 0.3, fracionada)
    }
  }
}

/** Constrói o histórico de movimentações e o estoque final de UM material. */
function construirHistorico(
  m: MaterialDemo,
  fracionada: boolean,
  rng: () => number,
  agora: Date,
  pessoas: { nome: string; setor: string; funcao: string }[]
): { finalEstoque: number; ops: OpEstoque[] } {
  const ops: OpEstoque[] = []
  const diasJanela = 120
  const saldoInicial = arredondar(Math.max(m.estoqueIdeal * 0.5, 1), fracionada)
  let saldo = saldoInicial

  ops.push({
    tipo: "ENTRADA",
    quantidade: saldoInicial,
    data: subtrairDias(agora, diasJanela),
    motivo: "Apuração inicial de estoque",
    documentoReferencia: `INV-${agora.getFullYear()}-001`,
  })

  const eventos = 7 + Math.floor(m.estoqueIdeal > 30 ? rng() * 6 : rng() * 4) // 7..13
  for (let k = 1; k <= eventos; k++) {
    const avanco = (k + rng() * 0.6) / eventos
    const diasAtras = Math.floor(diasJanela * (1 - avanco))
    const dataEv = subtrairDias(agora, diasAtras)
    const rol = rng()

    if (rol < 0.5) {
      const qtd = arredondar(m.estoqueIdeal * (0.08 + rng() * 0.35), fracionada)
      saldo += qtd
      ops.push({
        tipo: "ENTRADA",
        quantidade: qtd,
        data: dataEv,
        motivo: MOTIVOS_ENTRADA[Math.floor(rng() * MOTIVOS_ENTRADA.length)],
        documentoReferencia: `NF-${2000 + Math.floor(rng() * 26)}-${String(k).padStart(4, "0")}`,
      })
    } else if (rol < 0.86) {
      const desejado = arredondar(m.estoqueIdeal * (0.05 + rng() * 0.2), fracionada)
      const qtd = Math.min(saldo, desejado)
      if (qtd > 0) {
        saldo -= qtd
        const p = pessoas[Math.floor(rng() * pessoas.length)]
        ops.push({
          tipo: "SAIDA",
          quantidade: qtd,
          data: dataEv,
          motivo: MOTIVOS_SAIDA[Math.floor(rng() * MOTIVOS_SAIDA.length)],
          solicitanteNome: p.nome,
          solicitanteSetor: p.setor,
          solicitanteFuncao: p.funcao,
        })
      }
    } else if (rol < 0.96) {
      const delta = arredondar((rng() * 2 - 1) * m.estoqueIdeal * 0.06, fracionada)
      const novo = arredondar(Math.max(0, saldo + delta), fracionada)
      if (novo !== saldo) {
        ops.push({
          tipo: "AJUSTE",
          quantidade: delta,
          data: dataEv,
          motivo: delta >= 0 ? "Correção de contagem" : "Ajuste por diferença de inventário",
        })
        saldo = novo
      }
    } else {
      const qtd = Math.min(saldo, arredondar(m.estoqueIdeal * (0.02 + rng() * 0.05), fracionada))
      if (qtd > 0) {
        saldo -= qtd
        ops.push({
          tipo: "DESCARTE",
          quantidade: qtd,
          data: dataEv,
          motivo: MOTIVOS_DESCARTE[Math.floor(rng() * MOTIVOS_DESCARTE.length)],
        })
      }
    }
  }

  // Empurra o saldo final para a "zona" desejada (baixo/crítico/alto/normal/zero)
  const alvo = alvoPorZona(m, fracionada, rng)
  const diferenca = arredondar(alvo - saldo, fracionada)
  if (diferenca > 0) {
    saldo = arredondar(saldo + diferenca, fracionada)
    ops.push({
      tipo: "ENTRADA",
      quantidade: diferenca,
      data: agora,
      motivo: "Reposição de estoque (planejamento)",
      documentoReferencia: `RES-${agora.getFullYear()}-${Math.floor(rng() * 9000) + 1000}`,
    })
  } else if (diferenca < 0) {
    const reduzir = Math.min(saldo, -diferenca)
    saldo = arredondar(saldo - reduzir, fracionada)
    ops.push({
      tipo: "SAIDA",
      quantidade: reduzir,
      data: agora,
      motivo: "Consumo/transferência (planejamento)",
      solicitanteNome: "Equipe de Manutenção",
      solicitanteSetor: "Manutenção",
      solicitanteFuncao: "Almoxarifado",
    })
  }

  return { finalEstoque: saldo, ops }
}

// ---------------------------------------------------------------------------
// RESET — apaga os dados da DEMO (ordem de FK) para o seed ser idempotente
// ---------------------------------------------------------------------------

async function limparBanco() {
  await prisma.$transaction([
    prisma.logAuditoria.deleteMany(),
    prisma.statusHistory.deleteMany(),
    prisma.notificacao.deleteMany(),
    prisma.agendamento.deleteMany(),
    prisma.itemPedidoCompra.deleteMany(),
    prisma.pedidoCompra.deleteMany(),
    prisma.emprestimo.deleteMany(),
    prisma.itemSolicitacao.deleteMany(),
    prisma.solicitacao.deleteMany(),
    prisma.movimentacaoEstoque.deleteMany(),
    prisma.pessoaAtendida.deleteMany(),
    prisma.material.deleteMany(),
    prisma.unidadeMedida.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.configuracaoVisual.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

/** Remove recria o usuário no Supabase Auth (email identificador do demo). */
async function recriarUsuarioSupabase(email: string, senha: string): Promise<string> {
  const { data: lista } = await supabaseAdmin.auth.admin.listUsers()
  const existente = lista.users.find((u) => u.email === email)
  if (existente) {
    await supabaseAdmin.auth.admin.deleteUser(existente.id)
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw new Error(`Falha ao criar ${email} no Supabase: ${error.message}`)
  return data.user.id
}

type UserCriado = NovoDemoUser & { id: string; email: string }

async function criarUsuarios(): Promise<Record<Role, UserCriado[]>> {
  const porRole: Record<Role, UserCriado[]> = {
    ADMIN: [],
    GESTOR: [],
    SUPERVISOR: [],
    ALMOXARIFE: [],
    SOLICITANTE: [],
  }

  for (const demoUser of USUARIOS_DEMO) {
    const email = emailDemo(demoUser.prefixo)
    const idSupabase = await recriarUsuarioSupabase(email, everybodyPassword)

    const userRow = await prisma.user.create({
      data: {
        id: idSupabase,
        name: `${demoUser.nome} ${demoUser.sobrenome}`,
        nome: demoUser.nome,
        sobrenome: demoUser.sobrenome,
        email,
        role: demoUser.role,
        ativo: true,
        status: "APROVADO",
        dataAprovacao: new Date(),
        setor: demoUser.setor,
        cargo: demoUser.cargo,
      },
    })

    const criado: UserCriado = { ...demoUser, id: userRow.id, email }
    porRole[demoUser.role].push(criado)
  }

  return porRole
}

async function main() {
  const agora = new Date()
  const rng = criarRng(20260726)

  if (DEMO_PASSWORD_FALLBACK_LOG) console.warn(DEMO_PASSWORD_FALLBACK_LOG)
  console.log("[seed-demo] DEMO_ENV=true. Destruindo e recriando os dados da DEMO (banco de DATABASE_URL).")

  // 1) Reset (idempotente)
  await limparBanco()

  // 2) Usuários
  const users = await criarUsuarios()
  const admin = users.ADMIN[0]
  const supervisor = users.SUPERVISOR[0]
  const almox1 = users.ALMOXARIFE[0]
  const almox2 = users.ALMOXARIFE[1]
  const solicitantes = users.SOLICITANTE
  console.log(`[seed-demo] Usuários criados: ${USUARIOS_DEMO.length} no Supabase Auth e espelhados no Prisma.`)

  // 3) Cadastros base
  const categoriaId: Record<string, string> = {}
  for (const c of CATEGORIAS) {
    const row = await prisma.categoria.create({ data: { nome: c.nome, descricao: c.descricao } })
    categoriaId[c.nome] = row.id
  }
  const unidadeMap: Record<string, { id: string; fracionada: boolean }> = {}
  for (const u of UNIDADES) {
    const row = await prisma.unidadeMedida.create({
      data: { sigla: u.sigla, nome: u.nome, tipo: u.fracionada ? TipoUnidade.FRACIONADA : TipoUnidade.INTEIRA },
    })
    unidadeMap[u.sigla] = { id: row.id, fracionada: u.fracionada }
  }
  const pessoaInfo = PESSOAS_DEMO.map((p) => ({ nome: p.nome, setor: p.setor, funcao: p.funcao }))
  const pessoaIdPorNome: Record<string, string> = {}
  for (const p of PESSOAS_DEMO) {
    const row = await prisma.pessoaAtendida.create({ data: { nome: p.nome, setor: p.setor, funcao: p.funcao } })
    pessoaIdPorNome[p.nome] = row.id
  }

  // 4) Materiais + histórico de movimentações (estoque montado pelo ledger)
  const materiaisId: string[] = []
  const movs: Prisma.MovimentacaoEstoqueCreateManyInput[] = []
  let totalOps = 0

  for (let i = 0; i < MATERIAIS_DEMO.length; i++) {
    const m = MATERIAIS_DEMO[i]
    const un = unidadeMap[m.unidade]
    const criado = await prisma.material.create({
      data: {
        codigoInterno: `TMP-DEMO-${i}`,
        nome: m.nome,
        descricao: `${m.nome} — item fictício para demonstração.`,
        categoriaId: categoriaId[m.categoria],
        unidadeMedidaId: un.id,
        estoqueMinimo: m.estoqueMinimo,
        estoqueIdeal: m.estoqueIdeal,
        estoqueMaximo: m.estoqueMaximo,
        estoqueAtual: 0,
        localizacaoFisica: m.local ?? null,
        situacao: m.situacao ?? "ATIVO",
        requerAprovacao: m.requerAprovacao ?? false,
        tipoUso: m.retornavel ? TipoUsoMaterial.RETORNAVEL : TipoUsoMaterial.CONSUMIVEL,
        marca: m.marca ?? null,
        criadoPorId: admin.id,
      },
    })

    const codigoInterno = gerarCodigoInterno(criado.numeroSequencial)
    await prisma.material.update({ where: { id: criado.id }, data: { codigoInterno } })
    materiaisId.push(criado.id)

    const hist = construirHistorico(m, un.fracionada, rng, agora, pessoaInfo)
    let saldoCorrente = 0
    for (const op of hist.ops) {
      const anterior = saldoCorrente
      if (op.tipo === "ENTRADA") saldoCorrente += op.quantidade
      else if (op.tipo === "SAIDA") saldoCorrente -= op.quantidade
      else if (op.tipo === "DESCARTE") saldoCorrente -= op.quantidade
      else saldoCorrente += op.quantidade // AJUSTE
      saldoCorrente = Math.round(saldoCorrente * 10) / 10

      movs.push({
        materialId: criado.id,
        tipo: op.tipo,
        quantidade: op.quantidade,
        quantidadeAnterior: anterior,
        quantidadeAtual: saldoCorrente,
        motivo: op.motivo,
        documentoReferencia: op.documentoReferencia ?? null,
        solicitanteNome: op.solicitanteNome ?? null,
        solicitanteSetor: op.solicitanteSetor ?? null,
        solicitanteFuncao: op.solicitanteFuncao ?? null,
        usuarioId: rng() > 0.5 ? almox1.id : almox2.id,
        createdAt: op.data,
      })
      totalOps++
    }

    // estoque final coerente com o ledger
    await prisma.material.update({ where: { id: criado.id }, data: { estoqueAtual: hist.finalEstoque } })
  }

  // Persiste as movimentações históricas em lotes
  for (let i = 0; i < movs.length; i += 500) {
    await prisma.movimentacaoEstoque.createMany({ data: movs.slice(i, i + 500), skipDuplicates: true })
  }
  console.log(`[seed-demo] ${MATERIAIS_DEMO.length} materiais · ${totalOps} movimentações históricas criadas.`)

  // 5) Requisições — fluxos em diferentes estados (itens com ciclo próprio)
  const idxPorNome: Record<string, number> = {}
  MATERIAIS_DEMO.forEach((m, i) => {
    idxPorNome[m.nome] = i
  })
  const matId = (nome: string) => materiaisId[idxPorNome[nome]]

  type ItemReq = { nome: string; qtd: number; status: StatusItemSolicitacao }
  type ReqSeed = {
    tipo: TipoSolicitacao
    origem: OrigemSolicitacao
    prioridade: Prioridade
    diasAtras: number
    dataLimite?: number
    motivo?: string
    solicitante?: string // prefixo do user (AUTENTICADO) ou nome da pessoa (PUBLICO)
    itens: ItemReq[]
  }

  // Campos extras do item conforme o status (aprovado/preparado/entregue).
  function camposParaStatusItem(status: StatusItemSolicitacao, createdAt: Date) {
    const d = (n: number) => {
      const x = new Date(createdAt)
      x.setDate(x.getDate() + n)
      return x
    }
    switch (status) {
      case "APROVADO":
        return { aprovadorId: supervisor.id, dataAprovacao: d(1) }
      case "EM_PREPARACAO":
        return { aprovadorId: supervisor.id, dataAprovacao: d(1), preparadorId: almox1.id, dataInicioPreparo: d(2) }
      case "PRONTO":
        return { aprovadorId: supervisor.id, dataAprovacao: d(1), preparadorId: almox1.id, dataInicioPreparo: d(2), dataFimPreparo: d(3) }
      case "ENTREGUE":
        return { aprovadorId: supervisor.id, dataAprovacao: d(1), preparadorId: almox1.id, dataInicioPreparo: d(2), dataFimPreparo: d(3), dataEntrega: d(4), entreguePorId: almox2.id }
      case "REJEITADO":
        return { aprovadorId: supervisor.id, dataAprovacao: d(1), motivoRejeicao: "Item indisponível até a próxima compra." }
      default:
        return {}
    }
  }

  const REQUISICOES: ReqSeed[] = [
    {
      tipo: "SAIDA", origem: "AUTENTICADO", prioridade: "MEDIA", diasAtras: 3, motivo: "Reposição do estoque da enfermaria.",
      solicitante: "solicitante1",
      itens: [
        { nome: "Luva Nitrílica NR6 (caixa)", qtd: 4, status: "PENDENTE" },
        { nome: "Detergente Neutro 5L", qtd: 3, status: "PENDENTE" },
      ],
    },
    {
      tipo: "SAIDA", origem: "AUTENTICADO", prioridade: "ALTA", diasAtras: 2, motivo: "Material sensível aguardando aprovação superior.",
      itens: [{ nome: "Parafusadeira 18V", qtd: 1, status: "AGUARDANDO_APROVACAO_SUPERIOR" }],
    },
    {
      tipo: "SAIDA", origem: "AUTENTICADO", prioridade: "MEDIA", diasAtras: 1,
      itens: [
        { nome: "Detergente Neutro 5L", qtd: 5, status: "APROVADO" },
        { nome: "Papel Toalha (pct 1.000)", qtd: 2, status: "EM_PREPARACAO" },
      ],
    },
    {
      tipo: "SAIDA", origem: "PUBLICO", prioridade: "BAIXA", diasAtras: 4, motivo: "Limpeza da copa.",
      solicitante: "Clara Martins",
      itens: [
        { nome: "Sabão em Pó 1kg", qtd: 2, status: "PRONTO" },
        { nome: "Saco de Lixo 100L (pct 100)", qtd: 3, status: "PRONTO" },
      ],
    },
    {
      tipo: "SAIDA", origem: "AUTENTICADO", prioridade: "ALTA", diasAtras: 18, motivo: "Manutenção da rede elétrica do bloco.",
      itens: [
        { nome: "Cabo Flexível 2,5mm²", qtd: 120, status: "ENTREGUE" },
        { nome: "Disjuntor Bipolar 20A", qtd: 6, status: "ENTREGUE" },
        { nome: "Fita Isolante 20m", qtd: 3, status: "ENTREGUE" },
      ],
    },
    {
      tipo: "SAIDA", origem: "AUTENTICADO", prioridade: "MEDIA", diasAtras: 11,
      itens: [
        { nome: "Lâmpada LED 18W", qtd: 30, status: "ENTREGUE" },
        { nome: "Interruptor Simples 10A", qtd: 8, status: "ENTREGUE" },
      ],
    },
    {
      tipo: "SAIDA", origem: "PUBLICO", prioridade: "ALTA", diasAtras: 7, motivo: "Emergencial — vazamento no vestiário.",
      itens: [
        { nome: "Fita Veda-Rosca 20m", qtd: 2, status: "ENTREGUE" },
        { nome: "Registro de Gaveta 1/2\"", qtd: 3, status: "ENTREGUE" },
      ],
    },
    {
      tipo: "SAIDA", origem: "AUTENTICADO", prioridade: "ALTA", diasAtras: 5,
      itens: [{ nome: "Toner Impressora (preto)", qtd: 1, status: "REJEITADO" }],
    },
    {
      tipo: "EMPRESTIMO", origem: "AUTENTICADO", prioridade: "ALTA", diasAtras: 6, motivo: "Emissão de material retornável para manutenção.",
      itens: [
        { nome: "Parafusadeira 18V", qtd: 1, status: "ENTREGUE" },
        { nome: "Alicate Universal 8\"", qtd: 1, status: "ENTREGUE" },
      ],
    },
  ]

  let reqCount = 0
  for (const r of REQUISICOES) {
    const createdAt = subtrairDias(agora, r.diasAtras)
    const itensData: Prisma.ItemSolicitacaoUncheckedCreateWithoutSolicitacaoInput[] = r.itens.map((it) => ({
      materialId: matId(it.nome),
      quantidade: it.qtd,
      status: it.status,
      requerAprovacaoSuperior: it.status === "AGUARDANDO_APROVACAO_SUPERIOR",
      ...camposParaStatusItem(it.status, createdAt),
    }))

    const statusAgregado = calcularStatusAgregado(itensData.map((i) => i.status as StatusItemSolicitacao))
    const eAutentico = r.origem === "AUTENTICADO"
    const solicitanteUser =
      eAutentico ? (solicitantes.find((s) => s.prefixo === r.solicitante) ?? solicitantes[0]) : null

    await prisma.solicitacao.create({
      data: {
        tipo: r.tipo,
        origem: r.origem,
        prioridade: r.prioridade,
        status: statusAgregado,
        motivo: r.motivo ?? null,
        dataLimite: null,
        createdAt,
        updatedAt: createdAt,
        solicitanteUserId: eAutentico ? (solicitanteUser?.id ?? null) : null,
        pessoaAtendidaId: eAutentico ? null : (r.solicitante ? (pessoaIdPorNome[r.solicitante] ?? null) : null),
        lancadoPorId: eAutentico ? null : almox1.id,
        itens: { create: itensData },
      },
    })
    reqCount++
  }
  console.log(`[seed-demo] ${reqCount} requisições criadas.`)

  // 6) Empréstimos — situações variadas (ativa, atrasada, devolvida, pendente)
  type EmprestimoSeed = {
    nome: string
    qtd: number
    status: StatusEmprestimo
    retiradaAtrasDias: number
    previstoAteDias: number
    devolvidoAtrasDias?: number
    aprovacaoNecessaria?: boolean
    pessoa: string
  }
  const EMPRESTIMOS: EmprestimoSeed[] = [
    { nome: "Alicate Universal 8\"", qtd: 1, status: "EMPRESTADO", retiradaAtrasDias: 2, previstoAteDias: 28, pessoa: "Bruno Ferreira" },
    { nome: "Chave de Fenda Cruz 6x150", qtd: 1, status: "EMPRESTADO", retiradaAtrasDias: 20, previstoAteDias: -3, pessoa: "Felipe Cardoso" }, // prazo estourado → atrasado
    { nome: "Martelo de Unha 300g", qtd: 1, status: "DEVOLVIDO", retiradaAtrasDias: 30, previstoAteDias: -5, devolvidoAtrasDias: -3, pessoa: "Diego Barbosa" },
    { nome: "Parafusadeira 18V", qtd: 1, status: "PENDENTE_APROVACAO", retiradaAtrasDias: 0, previstoAteDias: 20, aprovacaoNecessaria: true, pessoa: "Bruno Ferreira" },
    { nome: "Alicate de Corte 7\"", qtd: 1, status: "ATRASADO", retiradaAtrasDias: 25, previstoAteDias: -7, pessoa: "Heitor Nunes" },
  ]

  let emprestimoCount = 0
  for (const e of EMPRESTIMOS) {
    const funcionario = PESSOAS_DEMO.find((p) => p.nome === e.pessoa) ?? PESSOAS_DEMO[0]
    const dataRetirada = subtrairDias(agora, e.retiradaAtrasDias)
    const dataPrevista = subtrairDias(agora, e.previstoAteDias)
    const dataDevolucao = e.devolvidoAtrasDias !== undefined ? subtrairDias(agora, e.devolvidoAtrasDias) : null

    const empr = await prisma.emprestimo.create({
      data: {
        materialId: materiaisId[idxPorNome[e.nome]],
        quantidade: e.qtd,
        solicitanteNome: funcionario.nome,
        solicitanteSetor: funcionario.setor,
        solicitanteFuncao: funcionario.funcao,
        pessoaAtendidaId: pessoaIdPorNome[funcionario.nome] ?? null,
        dataRetirada,
        dataPrevistaDevolucao: dataPrevista,
        dataDevolucao,
        status: e.status,
        aprovacaoNecessaria: e.aprovacaoNecessaria ?? false,
        responsavelId: almox1.id,
        createdAt: dataRetirada,
      },
    })

    // Movimentação de saída (e devolução) para dar histórico ao empréstimo
    const saidaAtras = e.status === "PENDENTE_APROVACAO" ? null : dataRetirada
    if (saidaAtras) {
      await prisma.movimentacaoEstoque.create({
        data: {
          materialId: empr.materialId,
          tipo: "SAIDA",
          quantidade: e.qtd,
          quantidadeAnterior: 0,
          quantidadeAtual: 0,
          motivo: `Empréstimo para ${funcionario.nome}`,
          usuarioId: almox1.id,
          emprestimoId: empr.id,
          solicitanteNome: funcionario.nome,
          solicitanteSetor: funcionario.setor,
          solicitanteFuncao: funcionario.funcao,
          createdAt: dataRetirada,
        },
      })
      if (e.status === "DEVOLVIDO") {
        await prisma.movimentacaoEstoque.create({
          data: {
            materialId: empr.materialId,
            tipo: "ENTRADA",
            quantidade: e.qtd,
            quantidadeAnterior: 0,
            quantidadeAtual: 0,
            motivo: `Devolução de empréstimo de ${funcionario.nome}`,
            usuarioId: almox2.id,
            emprestimoId: empr.id,
            movimentacaoOrigemId: null,
            createdAt: dataDevolucao ?? dataRetirada,
          },
        })
      }
    }
    emprestimoCount++
  }
  console.log(`[seed-demo] ${emprestimoCount} empréstimos criados.`)

  // 7) Compras — pedidos em estados variados
  type PedidoSeed = {
    area: string
    obs?: string
    status: StatusPedidoCompra
    diasAtras: number
    itens: Array<{
      tipo: TipoItemCompra
      nomeNovo?: string
      materialNome?: string
      qtd: number
      recebida?: number
      status: StatusItemCompra
    }>
  }
  const PEDIDOS: PedidoSeed[] = [
    {
      area: "Elétrica", status: "ABERTO", diasAtras: 2,
      itens: [
        { tipo: "MATERIAL_NOVO", nomeNovo: "Tomada USB lateral 20W", qtd: 10, status: "EM_ESPERA" },
        { tipo: "MATERIAL_NOVO", nomeNovo: "Disjuntor DR 40A", qtd: 5, status: "EM_ESPERA" },
      ],
    },
    {
      area: "Hidráulica", status: "ABERTO", diasAtras: 4,
      itens: [
        { tipo: "MATERIAL_NOVO", nomeNovo: "Registro de gaveta 3/4\" bronze", qtd: 8, status: "ORCANDO" },
      ],
    },
    {
      area: "Elétrica", status: "ABERTO", diasAtras: 6,
      itens: [
        { tipo: "MATERIAL_EXISTENTE", materialNome: "Lâmpada LED 18W", qtd: 40, status: "APROVADO" },
        { tipo: "MATERIAL_EXISTENTE", materialNome: "Fita Isolante 20m", qtd: 15, status: "AGUARDANDO_ENTREGA" },
      ],
    },
    {
      area: "Limpeza", status: "PARCIALMENTE_RECEBIDO", diasAtras: 9, obs: "Recebimento parcial liberado no primeiro lote.",
      itens: [
        { tipo: "MATERIAL_EXISTENTE", materialNome: "Detergente Neutro 5L", qtd: 20, recebida: 12, status: "RECEBIDO" },
        { tipo: "MATERIAL_EXISTENTE", materialNome: "Papel Toalha (pct 1.000)", qtd: 8, status: "AGUARDANDO_ENTREGA" },
      ],
    },
    {
      area: "EPIs", status: "CONCLUIDO", diasAtras: 15,
      itens: [
        { tipo: "MATERIAL_EXISTENTE", materialNome: "Luva Nitrílica NR6 (caixa)", qtd: 15, recebida: 15, status: "RECEBIDO" },
        { tipo: "MATERIAL_NOVO", nomeNovo: "Capacete de segurança branco", qtd: 12, recebida: 12, status: "RECEBIDO" },
      ],
    },
  ]

  let pedidoCount = 0
  for (const p of PEDIDOS) {
    const itensInput: Prisma.ItemPedidoCompraUncheckedCreateWithoutPedidoInput[] = p.itens.map((it) => {
      const eExistente = it.tipo === "MATERIAL_EXISTENTE"
      const base = {
        tipo: it.tipo,
        quantidade: it.qtd,
        quantidadeRecebida: it.recebida ?? 0,
        status: it.status,
        ...(it.recebida !== undefined
          ? { dataRecebimento: subtrairDias(agora, Math.max(p.diasAtras - 2, 1)), recebidoPorId: almox1.id }
          : {}),
      }
      if (eExistente) {
        return { ...base, materialId: matId(it.materialNome ?? "") }
      }
      return { ...base, materialId: null, nomeMaterialNovo: it.nomeNovo ?? "", unidadeSugerida: "UN", marcaNovo: "", fabricanteNovo: "Fictício" }
    })

    const pedido = await prisma.pedidoCompra.create({
      data: {
        areaId: categoriaId[p.area],
        solicitanteId: admin.id,
        solicitanteNome: `${admin.nome} ${admin.sobrenome}`,
        solicitanteSetor: admin.setor ?? "Administração",
        solicitanteFuncao: admin.cargo ?? "Administrador do almoxarifado",
        status: p.status,
        observacoes: p.obs ?? null,
        createdAt: subtrairDias(agora, p.diasAtras),
        itens: { create: itensInput },
      },
      include: { itens: true },
    })

    // Entrada de estoque dos itens recebidos
    for (const it of pedido.itens) {
      if (it.status === "RECEBIDO" && it.materialId) {
        await prisma.movimentacaoEstoque.create({
          data: {
            materialId: it.materialId,
            tipo: "ENTRADA",
            quantidade: Number(it.quantidadeRecebida),
            quantidadeAnterior: 0,
            quantidadeAtual: 0,
            motivo: `Recebimento de pedido de compra #${pedido.numero}`,
            documentoReferencia: `NF-COMPRA-${pedido.numero}`,
            usuarioId: almox1.id,
            itemPedidoCompraId: it.id,
            createdAt: it.dataRecebimento ?? new Date(),
          },
        })
      }
    }
    pedidoCount++
  }
  console.log(`[seed-demo] ${pedidoCount} pedidos de compra criados.`)

  // 8) Notificações — poucas, coerentes com os alertas do sistema
  await prisma.notificacao.createMany({
    data: [
      {
        usuarioId: almox1.id,
        titulo: "Estoque baixo",
        mensagem: "Máscara PFF2 (pct) está abaixo do estoque mínimo. Considere uma reposição.",
        tipo: "ALERTA_ESTOQUE_BAIXO",
        entidade: "Material",
        entidadeId: materiaisId[idxPorNome["Máscara PFF2 (pct)"] ?? 0],
        lida: false,
        createdAt: subtrairDias(agora, 1),
      },
      {
        usuarioId: almox1.id,
        titulo: "Requisição aguardando preparo",
        mensagem: "Há requisições com itens aprovados esperando o início do preparo.",
        tipo: "SOLICITACAO_PREPARANDO",
        entidade: "Solicitacao",
        entidadeId: "demo-req",
        lida: false,
        createdAt: subtrairDias(agora, 2),
      },
      {
        usuarioId: admin.id,
        titulo: "Empréstimo atrasado",
        mensagem: "Há empréstimos com prazo de devolução vencido. Verifique a lista de empréstimos.",
        tipo: "EMPRESTIMO_ATRASADO",
        entidade: "Emprestimo",
        entidadeId: "demo-dev",
        lida: false,
        createdAt: subtrairDias(agora, 4),
      },
      {
        usuarioId: solicitantes[0].id,
        titulo: "Requisição entregue",
        mensagem: "Os itens da sua requisição foram entregues pelo almoxarifado.",
        tipo: "SOLICITACAO_ENTREGUE",
        entidade: "Solicitacao",
        entidadeId: "demo-entregue",
        lida: true,
        createdAt: subtrairDias(agora, 6),
      },
    ],
  })

  console.log("[seed-demo] Notificações criadas.")
  console.log("[seed-demo] Resumo:")
  console.log(`  - ${USUARIOS_DEMO.length} usuários · ${CATEGORIAS.length} categorias · ${MATERIAIS_DEMO.length} materiais`)
  console.log(`  - ${pessoaInfo.length} pessoas atendidas · ${reqCount} requisições · ${emprestimoCount} empréstimos · ${pedidoCount} pedidos de compra · ${totalOps} movimentações históricas`)
  console.log("  - Login: e-mails em @demo-almoxarifado.com com a senha configurada em DEMO_PASSWORD.")

  // Força a identidade visual neutra (sem logotipos da organização real):
  // nenhuma linha de ConfiguracaoVisual é criada → o tema usa o default
  // 'Almoxarifado' (ver src/styles/theme.ts) já neutro para portfólio.
}

main()
  .catch((err) => {
    console.error("[seed-demo] Erro:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })