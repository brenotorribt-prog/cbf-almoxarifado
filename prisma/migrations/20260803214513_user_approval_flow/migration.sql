-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificacaoTipo" ADD VALUE 'ACESSO_APROVADO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'ACESSO_REJEITADO';
ALTER TYPE "NotificacaoTipo" ADD VALUE 'NOVO_CADASTRO_PENDENTE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aprovadoPorId" TEXT,
ADD COLUMN     "dataAprovacao" TIMESTAMP(3),
ADD COLUMN     "motivoRejeicao" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDENTE',
ALTER COLUMN "ativo" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_ativo_idx" ON "User"("ativo");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
