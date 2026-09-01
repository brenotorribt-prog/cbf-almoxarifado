"use client"

// Cartão de "Credenciais de demonstração" exibido na tela de login APENAS no
// ambiente de demonstração (NEXT_PUBLIC_DEMO_ENABLED === "true"). As contas
// são 100% fictícias e a senha compartilhada vem do endpoint /api/demo/credenciais,
// que por sua vez só responde quando DEMO_ENV === "true".
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { KeyRound } from "lucide-react"

type Credencial = { role: string; nome: string; email: string }
type DadosDemo = { organizacao?: string; senhaCompartilhada?: string; usuarios: Credencial[] }

export default function DemoCredenciais() {
  const [dados, setDados] = useState<DadosDemo | null>(null)

  useEffect(() => {
    let ativo = true
    fetch("/api/demo/credenciais")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ativo && d) setDados(d)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  if (!dados || !dados.usuarios?.length) return null

  const card: CSSProperties = {
    width: "100%",
    maxWidth: 420,
    marginTop: 14,
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(3,7,18,0.66)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#e6ebf5",
    fontFamily: "inherit",
    fontSize: 13,
    lineHeight: 1.5,
  }
  const sub: CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
  }
  const cell: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "3px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  }
  const mono: CSSProperties = { fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
        <KeyRound size={13} style={{ color: "#a78bfa" }} />
        Credenciais de demonstração
      </div>
      <div style={sub}>{dados.organizacao ?? "Ambiente demo"}</div>
      <div style={{ ...sub, marginTop: 6 }}>
        Contas fictícias · isoladas da produção
      </div>
      <div style={{ marginTop: 10 }}>
        {dados.usuarios.map((u) => (
          <div key={u.email} style={cell}>
            <span>
              <strong>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</strong> · {u.nome}
            </span>
            <span style={mono}>{u.email}</span>
          </div>
        ))}
      </div>
      {dados.senhaCompartilhada && (
        <div style={{ marginTop: 10 }}>
          Senha compartilhada: <code style={mono}>{dados.senhaCompartilhada}</code>
        </div>
      )}
    </div>
  )
}