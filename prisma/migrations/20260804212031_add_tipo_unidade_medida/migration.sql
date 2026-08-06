-- CreateEnum
CREATE TYPE "TipoUnidade" AS ENUM ('INTEIRA', 'FRACIONADA');

-- AlterTable
ALTER TABLE "UnidadeMedida" ADD COLUMN     "tipo" "TipoUnidade" NOT NULL DEFAULT 'INTEIRA';
