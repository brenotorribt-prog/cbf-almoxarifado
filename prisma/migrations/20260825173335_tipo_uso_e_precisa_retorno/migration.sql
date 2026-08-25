-- CreateEnum
CREATE TYPE "TipoUsoMaterial" AS ENUM ('CONSUMIVEL', 'RETORNAVEL');

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "tipoUso" "TipoUsoMaterial" NOT NULL DEFAULT 'CONSUMIVEL';

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "precisaRetorno" BOOLEAN;

-- Backfill: saídas legadas com empréstimo vinculado são, por definição,
-- materiais que precisam voltar — marca pra manter o cálculo de posse coerente.
UPDATE "MovimentacaoEstoque"
SET "precisaRetorno" = TRUE
WHERE tipo = 'SAIDA' AND "emprestimoId" IS NOT NULL;

-- Índice pro cálculo de devoluções por origem (relatório por pessoa +
-- rota de devolução avulsa consultam esse vínculo).
CREATE INDEX "MovimentacaoEstoque_movimentacaoOrigemId_idx" ON "MovimentacaoEstoque"("movimentacaoOrigemId");
