import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { criarRequisicao, criarRequisicaoBaseSchema, ErroRequisicao } from "@/lib/criar-requisicao"

// POST /api/publico/requisicoes — formulário público, SEM autenticação.
//
// A pessoa precisa já estar cadastrada em PessoaAtendida (feito pelo
// almoxarife em Categorias/Cadastros) — não aceitamos nome/setor/função em
// texto livre aqui pra não sujar os relatórios com duplicidade de nomes.
//
// ATENÇÃO: por ser uma rota pública sem auth, ela é candidata natural a
// rate limiting (o projeto já tem @upstash/redis como dependência — vale
// usar aqui antes de ir pra produção. Não implementado nesta entrega.)
const publicoSchema = criarRequisicaoBaseSchema.extend({
  pessoaAtendidaId: z.string().min(1, "Selecione seu cadastro na lista"),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const parsed = publicoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const { pessoaAtendidaId, ...dados } = parsed.data

  try {
    const solicitacao = await criarRequisicao({
      dados,
      origem: "PUBLICO",
      pessoaAtendidaId,
    })
    return NextResponse.json(
      { requisicao: { id: solicitacao.id, numero: solicitacao.numero, status: solicitacao.status } },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof ErroRequisicao) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
