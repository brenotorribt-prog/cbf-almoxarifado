import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { requireAuth } from "@/lib/auth/require-role"
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/storage/r2"
import { randomUUID } from "crypto"

const TAMANHO_MAXIMO = 5 * 1024 * 1024 // 5MB — teto de segurança, mesmo raciocínio da foto de material
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"]

export async function POST(request: NextRequest) {
  const guard = await requireAuth()
  if (guard instanceof NextResponse) return guard

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get("avatar")

  if (!arquivo || !(arquivo instanceof File)) {
    return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 })
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json({ error: "Formato de imagem não suportado" }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 5MB)" }, { status: 400 })
  }

  const extensao =
    arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg"
  const chave = `avatars/${randomUUID()}.${extensao}`

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  await r2.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: chave, Body: buffer, ContentType: arquivo.type })
  )

  return NextResponse.json({ url: `${R2_PUBLIC_URL}/${chave}` })
}