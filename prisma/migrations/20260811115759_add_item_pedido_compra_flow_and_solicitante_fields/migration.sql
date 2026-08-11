/*
  Warnings:

  - The values [PENDENTE] on the enum `StatusItemCompra` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[itemPedidoCompraId]` on the table `MovimentacaoEstoque` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `solicitanteFuncao` to the `PedidoCompra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solicitanteNome` to the `PedidoCompra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solicitanteSetor` to the `PedidoCompra` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusItemCompra_new" AS ENUM ('EM_ESPERA', 'ORCANDO', 'APROVADO', 'AGUARDANDO_ENTREGA', 'RECEBIDO', 'CANCELADO');
ALTER TABLE "public"."ItemPedidoCompra" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ItemPedidoCompra" ALTER COLUMN "status" TYPE "StatusItemCompra_new" USING ("status"::text::"StatusItemCompra_new");
ALTER TYPE "StatusItemCompra" RENAME TO "StatusItemCompra_old";
ALTER TYPE "StatusItemCompra_new" RENAME TO "StatusItemCompra";
DROP TYPE "public"."StatusItemCompra_old";
ALTER TABLE "ItemPedidoCompra" ALTER COLUMN "status" SET DEFAULT 'EM_ESPERA';
COMMIT;

-- DropForeignKey
ALTER TABLE "PedidoCompra" DROP CONSTRAINT "PedidoCompra_areaId_fkey";

-- AlterTable
ALTER TABLE "ItemPedidoCompra" ADD COLUMN     "dataPrevistaEntrega" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'EM_ESPERA';

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "itemPedidoCompraId" TEXT;

-- AlterTable
ALTER TABLE "PedidoCompra" ADD COLUMN     "solicitanteFuncao" TEXT NOT NULL,
ADD COLUMN     "solicitanteNome" TEXT NOT NULL,
ADD COLUMN     "solicitanteSetor" TEXT NOT NULL,
ALTER COLUMN "areaId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoEstoque_itemPedidoCompraId_key" ON "MovimentacaoEstoque"("itemPedidoCompraId");

-- CreateIndex
CREATE INDEX "PedidoCompra_solicitanteSetor_idx" ON "PedidoCompra"("solicitanteSetor");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_itemPedidoCompraId_fkey" FOREIGN KEY ("itemPedidoCompraId") REFERENCES "ItemPedidoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
