-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'EMPRESTIMO_PENDENTE_APROVACAO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'EMPRESTIMO_APROVADO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'EMPRESTIMO_REJEITADO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusEmprestimo" ADD VALUE 'PENDENTE_APROVACAO';
ALTER TYPE "StatusEmprestimo" ADD VALUE 'REJEITADO';

-- AlterTable
ALTER TABLE "Emprestimo" ADD COLUMN     "aprovacaoNecessaria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aprovadorId" TEXT,
ADD COLUMN     "dataAprovacao" TIMESTAMP(3),
ADD COLUMN     "loteId" TEXT,
ADD COLUMN     "motivoRejeicao" TEXT,
ADD COLUMN     "solicitanteFuncao" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "requerAprovacao" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "emprestimoId" TEXT;

-- CreateIndex
CREATE INDEX "Emprestimo_loteId_idx" ON "Emprestimo"("loteId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_emprestimoId_idx" ON "MovimentacaoEstoque"("emprestimoId");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_emprestimoId_fkey" FOREIGN KEY ("emprestimoId") REFERENCES "Emprestimo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
