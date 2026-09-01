import { NextResponse } from "next/server"

/**
 * GET /api/demo/credenciais
 *
 * NEVER em produção. Só responde quando DEMO_ENV === "true" (configurado
 * exclusivamente no ambiente de demonstração). Exibe no login as contas
 * fictícias (apenas os e-mails e a senha compartilhada da demo) para um
 * recrutador conseguir acessar rapidamente cada papel.
 *
 * Em qualquer outro ambiente retorna 404 — não vaza nada.
 */
export async function GET() {
  if (process.env.DEMO_ENV !== "true") {
    return NextResponse.json({ error: "Não disponível" }, { status: 404 })
  }

  const demoSenha = process.env.DEMO_PASSWORD ?? ""
  const dominio = "@demo-almoxarifado.com"

  const usuarios = [
    { role: "ADMIN",       nome: "Carlos Mendes",    email: `admin${dominio}` },
    { role: "GESTOR",      nome: "Marina Oliveira",  email: `gestor${dominio}` },
    { role: "SUPERVISOR",  nome: "Rafael Santos",    email: `supervisor${dominio}` },
    { role: "ALMOXARIFE",  nome: "Juliana Costa",    email: `almoxarife1${dominio}` },
    { role: "SOLICITANTE", nome: "Fernanda Lima",    email: `solicitante1${dominio}` },
    { role: "SOLICITANTE", nome: "Gustavo Rocha",    email: `solicitante2${dominio}` },
    { role: "SOLICITANTE", nome: "Beatriz Nunes",    email: `solicitante3${dominio}` },
  ]

  return NextResponse.json({
    organizacao: "Almoxarifado (demo)",
    senhaCompartilhada: demoSenha, // apenas ambiente demo
    usuarios,
  })
}