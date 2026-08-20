/*
  Warnings:

  - You are about to drop the column `dataDesejada` on the `Solicitacao` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Solicitacao" DROP COLUMN "dataDesejada",
ADD COLUMN     "lancadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "Solicitacao_lancadoPorId_idx" ON "Solicitacao"("lancadoPorId");

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_lancadoPorId_fkey" FOREIGN KEY ("lancadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
