/*
  Warnings:

  - The values [APROVADA,REJEITADA,RASCUNHO,EM_PREPARACAO,AGENDADA,FINALIZADA] on the enum `StatusSolicitacao` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `solicitacaoId` on the `Emprestimo` table. All the data in the column will be lost.
  - You are about to drop the column `solicitacaoId` on the `MovimentacaoEstoque` table. All the data in the column will be lost.
  - You are about to drop the column `aprovadorId` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `dataAprovacao` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `dataEntrega` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `dataFimPreparo` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `dataInicioPreparo` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `dataPreparo` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `dataPronto` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `historicoStatus` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `materialId` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `observacaoAprovacao` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `observacaoPreparo` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `preparadorId` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `quantidade` on the `Solicitacao` table. All the data in the column will be lost.
  - You are about to drop the column `solicitanteId` on the `Solicitacao` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[itemSolicitacaoId]` on the table `Emprestimo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemSolicitacaoId]` on the table `MovimentacaoEstoque` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[numero]` on the table `Solicitacao` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusItemSolicitacao" AS ENUM ('PENDENTE', 'AGUARDANDO_APROVACAO_SUPERIOR', 'APROVADO', 'REJEITADO', 'EM_PREPARACAO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrigemSolicitacao" AS ENUM ('AUTENTICADO', 'PUBLICO');

-- AlterEnum
ALTER TYPE "NotificacaoTipo" ADD VALUE 'ITEM_REQUER_APROVACAO_SUPERIOR';

-- AlterEnum
BEGIN;
CREATE TYPE "StatusSolicitacao_new" AS ENUM ('PENDENTE', 'AGUARDANDO_APROVACAO', 'EM_ANDAMENTO', 'PRONTO', 'ENTREGUE', 'CANCELADA');
ALTER TABLE "public"."Solicitacao" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Solicitacao" ALTER COLUMN "status" TYPE "StatusSolicitacao_new" USING ("status"::text::"StatusSolicitacao_new");
ALTER TYPE "StatusSolicitacao" RENAME TO "StatusSolicitacao_old";
ALTER TYPE "StatusSolicitacao_new" RENAME TO "StatusSolicitacao";
DROP TYPE "public"."StatusSolicitacao_old";
ALTER TABLE "Solicitacao" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
COMMIT;

-- DropForeignKey
ALTER TABLE "Emprestimo" DROP CONSTRAINT "Emprestimo_solicitacaoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentacaoEstoque" DROP CONSTRAINT "MovimentacaoEstoque_solicitacaoId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitacao" DROP CONSTRAINT "Solicitacao_aprovadorId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitacao" DROP CONSTRAINT "Solicitacao_materialId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitacao" DROP CONSTRAINT "Solicitacao_preparadorId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitacao" DROP CONSTRAINT "Solicitacao_solicitanteId_fkey";

-- DropIndex
DROP INDEX "Emprestimo_solicitacaoId_key";

-- DropIndex
DROP INDEX "MovimentacaoEstoque_solicitacaoId_key";

-- DropIndex
DROP INDEX "Solicitacao_dataDesejada_idx";

-- DropIndex
DROP INDEX "Solicitacao_materialId_idx";

-- DropIndex
DROP INDEX "Solicitacao_solicitanteId_idx";

-- AlterTable
ALTER TABLE "Emprestimo" DROP COLUMN "solicitacaoId",
ADD COLUMN     "itemSolicitacaoId" TEXT;

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" DROP COLUMN "solicitacaoId",
ADD COLUMN     "itemSolicitacaoId" TEXT;

-- AlterTable
ALTER TABLE "Solicitacao" DROP COLUMN "aprovadorId",
DROP COLUMN "dataAprovacao",
DROP COLUMN "dataEntrega",
DROP COLUMN "dataFimPreparo",
DROP COLUMN "dataInicioPreparo",
DROP COLUMN "dataPreparo",
DROP COLUMN "dataPronto",
DROP COLUMN "historicoStatus",
DROP COLUMN "materialId",
DROP COLUMN "observacaoAprovacao",
DROP COLUMN "observacaoPreparo",
DROP COLUMN "preparadorId",
DROP COLUMN "quantidade",
DROP COLUMN "solicitanteId",
ADD COLUMN     "numero" SERIAL NOT NULL,
ADD COLUMN     "origem" "OrigemSolicitacao" NOT NULL DEFAULT 'AUTENTICADO',
ADD COLUMN     "pessoaAtendidaId" TEXT,
ADD COLUMN     "solicitanteUserId" TEXT;

-- CreateTable
CREATE TABLE "ItemSolicitacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "status" "StatusItemSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "requerAprovacaoSuperior" BOOLEAN NOT NULL DEFAULT false,
    "alteradoManualmente" BOOLEAN NOT NULL DEFAULT false,
    "aprovadorId" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "motivoRejeicao" TEXT,
    "preparadorId" TEXT,
    "dataInicioPreparo" TIMESTAMP(3),
    "dataFimPreparo" TIMESTAMP(3),
    "dataEntrega" TIMESTAMP(3),
    "entreguePorId" TEXT,
    "dataPrevistaDevolucao" TIMESTAMP(3),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemSolicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemSolicitacao_solicitacaoId_idx" ON "ItemSolicitacao"("solicitacaoId");

-- CreateIndex
CREATE INDEX "ItemSolicitacao_materialId_idx" ON "ItemSolicitacao"("materialId");

-- CreateIndex
CREATE INDEX "ItemSolicitacao_status_idx" ON "ItemSolicitacao"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Emprestimo_itemSolicitacaoId_key" ON "Emprestimo"("itemSolicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoEstoque_itemSolicitacaoId_key" ON "MovimentacaoEstoque"("itemSolicitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitacao_numero_key" ON "Solicitacao"("numero");

-- CreateIndex
CREATE INDEX "Solicitacao_origem_idx" ON "Solicitacao"("origem");

-- CreateIndex
CREATE INDEX "Solicitacao_solicitanteUserId_idx" ON "Solicitacao"("solicitanteUserId");

-- CreateIndex
CREATE INDEX "Solicitacao_pessoaAtendidaId_idx" ON "Solicitacao"("pessoaAtendidaId");

-- CreateIndex
CREATE INDEX "Solicitacao_numero_idx" ON "Solicitacao"("numero");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_itemSolicitacaoId_fkey" FOREIGN KEY ("itemSolicitacaoId") REFERENCES "ItemSolicitacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_solicitanteUserId_fkey" FOREIGN KEY ("solicitanteUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_pessoaAtendidaId_fkey" FOREIGN KEY ("pessoaAtendidaId") REFERENCES "PessoaAtendida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitacao" ADD CONSTRAINT "ItemSolicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitacao" ADD CONSTRAINT "ItemSolicitacao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitacao" ADD CONSTRAINT "ItemSolicitacao_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitacao" ADD CONSTRAINT "ItemSolicitacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSolicitacao" ADD CONSTRAINT "ItemSolicitacao_entreguePorId_fkey" FOREIGN KEY ("entreguePorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_itemSolicitacaoId_fkey" FOREIGN KEY ("itemSolicitacaoId") REFERENCES "ItemSolicitacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
