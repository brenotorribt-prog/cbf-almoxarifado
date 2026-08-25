import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "./r2"
import { randomUUID } from "crypto"

// pastas por contexto, facilita organização e limpeza futura
export type UploadContexto = "avatares" | "materiais" | "movimentacoes" | "pedidos-compra"

export async function gerarUploadPresignado(
  contexto: UploadContexto,
  nomeOriginal: string,
  contentType: string
) {
  const extensao = nomeOriginal.split(".").pop()
  const key = `${contexto}/${randomUUID()}.${extensao}`

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }) // 5 min

  return {
    uploadUrl, // pro client dar PUT aqui
    publicUrl: `${R2_PUBLIC_URL}/${key}`, // salvar isso no banco
    key,
  }
}

export async function deletarArquivo(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}