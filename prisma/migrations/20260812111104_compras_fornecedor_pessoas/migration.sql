/*
  Warnings:

  - You are about to drop the column `dataPrevistaEntrega` on the `ItemPedidoCompra` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ItemPedidoCompra" DROP COLUMN "dataPrevistaEntrega",
ADD COLUMN     "fabricanteNovo" TEXT,
ADD COLUMN     "fornecedorNovo" TEXT,
ADD COLUMN     "marcaNovo" TEXT,
ADD COLUMN     "modeloNovo" TEXT,
ADD COLUMN     "prazoMaximoNecessario" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "fornecedor" TEXT;

-- CreateTable
CREATE TABLE "PessoaAtendida" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PessoaAtendida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PessoaAtendida_nome_idx" ON "PessoaAtendida"("nome");

-- CreateIndex
CREATE INDEX "PessoaAtendida_setor_idx" ON "PessoaAtendida"("setor");
