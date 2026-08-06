/*
  Warnings:

  - A unique constraint covering the columns `[agendamentoId]` on the table `Solicitacao` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoAgendamento" AS ENUM ('RETIRADA', 'ENTREGA', 'INSTALACAO');

-- CreateEnum
CREATE TYPE "AgendamentoStatus" AS ENUM ('AGENDADO', 'CONFIRMADO', 'CANCELADO', 'REALIZADO');

-- CreateEnum
CREATE TYPE "NotificacaoTipo" AS ENUM ('SOLICITACAO_CRIADA', 'SOLICITACAO_APROVADA', 'SOLICITACAO_REJEITADA', 'SOLICITACAO_PREPARANDO', 'SOLICITACAO_PRONTA', 'SOLICITACAO_ENTREGUE', 'SOLICITACAO_CANCELADA', 'AGENDAMENTO_CONFIRMADO', 'EMPRESTIMO_ATRASADO', 'PEDIDO_COMPRA_ATUALIZADO', 'ALERTA_ESTOQUE_BAIXO', 'ALERTA_ESTOQUE_MAXIMO');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SOLICITANTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusSolicitacao" ADD VALUE 'RASCUNHO';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'EM_PREPARACAO';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'PRONTO';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'ENTREGUE';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'AGENDADA';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'EM_ANDAMENTO';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'FINALIZADA';

-- AlterEnum
ALTER TYPE "TipoSolicitacao" ADD VALUE 'TRANSFERENCIA';

-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "agendamentoId" TEXT,
ADD COLUMN     "anexos" JSONB,
ADD COLUMN     "dataDesejada" TIMESTAMP(3),
ADD COLUMN     "dataEntrega" TIMESTAMP(3),
ADD COLUMN     "dataFimPreparo" TIMESTAMP(3),
ADD COLUMN     "dataInicioPreparo" TIMESTAMP(3),
ADD COLUMN     "dataLimite" TIMESTAMP(3),
ADD COLUMN     "dataPreparo" TIMESTAMP(3),
ADD COLUMN     "dataPronto" TIMESTAMP(3),
ADD COLUMN     "historicoStatus" JSONB,
ADD COLUMN     "observacaoPreparo" TEXT,
ADD COLUMN     "observacoesInternas" TEXT,
ADD COLUMN     "preparadorId" TEXT,
ADD COLUMN     "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "setor" TEXT,
ADD COLUMN     "telefone" TEXT,
ALTER COLUMN "role" SET DEFAULT 'SOLICITANTE';

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "tipoAgendamento" "TipoAgendamento" NOT NULL DEFAULT 'RETIRADA',
    "dataAgendada" TIMESTAMP(3) NOT NULL,
    "dataConfirmada" TIMESTAMP(3),
    "dataCancelada" TIMESTAMP(3),
    "horarioInicio" TEXT,
    "horarioFim" TEXT,
    "localEntrega" TEXT,
    "observacoes" TEXT,
    "status" "AgendamentoStatus" NOT NULL DEFAULT 'AGENDADO',
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" "NotificacaoTipo" NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "dados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agendamento_solicitacaoId_key" ON "Agendamento"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Agendamento_dataAgendada_idx" ON "Agendamento"("dataAgendada");

-- CreateIndex
CREATE INDEX "Agendamento_status_idx" ON "Agendamento"("status");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_idx" ON "Notificacao"("usuarioId");

-- CreateIndex
CREATE INDEX "Notificacao_lida_idx" ON "Notificacao"("lida");

-- CreateIndex
CREATE INDEX "Notificacao_createdAt_idx" ON "Notificacao"("createdAt");

-- CreateIndex
CREATE INDEX "StatusHistory_entidade_entidadeId_idx" ON "StatusHistory"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "StatusHistory_createdAt_idx" ON "StatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Categoria_nome_idx" ON "Categoria"("nome");

-- CreateIndex
CREATE INDEX "Material_codigoInterno_idx" ON "Material"("codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitacao_agendamentoId_key" ON "Solicitacao"("agendamentoId");

-- CreateIndex
CREATE INDEX "Solicitacao_prioridade_idx" ON "Solicitacao"("prioridade");

-- CreateIndex
CREATE INDEX "Solicitacao_solicitanteId_idx" ON "Solicitacao"("solicitanteId");

-- CreateIndex
CREATE INDEX "Solicitacao_dataDesejada_idx" ON "Solicitacao"("dataDesejada");

-- CreateIndex
CREATE INDEX "UnidadeMedida_sigla_idx" ON "UnidadeMedida"("sigla");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
