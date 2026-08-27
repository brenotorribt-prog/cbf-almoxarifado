import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { requireAdmin } from "@/lib/auth/require-role"
import { r2, R2_PUBLIC_URL } from "@/lib/storage/r2"
import { randomUUID } from "crypto"
import { validarArquivoImagem } from "@/lib/configuracoes/identidade-visual-schema"

// Upload de assets da identidade visual (logo/backgrounds).
// Mesmo padrao do fluxo de fotos de material: multipart direto,
// whitelist de MIME + teto de tamanho validados NO SERVIDOR.
const TIPOS = ["logo", "login", "sidebar"] as const

function extensaoDe(mime: string): string {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get("arquivo")
  const tipo = formData?.get("tipo")

  if (!arquivo || !(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 })
  }
  if (typeof tipo !== "string" || !TIPOS.includes(tipo as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "Tipo de asset invalido" }, { status: 400 })
  }

  const erroValidacao = validarArquivoImagem(arquivo.type, arquivo.size)
  if (erroValidacao) {
    return NextResponse.json({ error: erroValidacao }, { status: 400 })
  }

  const chave = `branding/${tipo}/${randomUUID()}.${extensaoDe(arquivo.type)}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: chave,
      Body: buffer,
      ContentType: arquivo.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return NextResponse.json({ url: `${R2_PUBLIC_URL}/${chave}`, key: chave })
}