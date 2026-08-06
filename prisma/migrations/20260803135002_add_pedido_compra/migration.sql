-- CreateEnum
CREATE TYPE "TipoItemCompra" AS ENUM ('MATERIAL_EXISTENTE', 'MATERIAL_NOVO');

-- CreateEnum
CREATE TYPE "StatusItemCompra" AS ENUM ('PENDENTE', 'RECEBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusPedidoCompra" AS ENUM ('ABERTO', 'PARCIALMENTE_RECEBIDO', 'CONCLUIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "movimentacaoOrigemId" TEXT;

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "areaId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "status" "StatusPedidoCompra" NOT NULL DEFAULT 'ABERTO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedidoCompra" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "tipo" "TipoItemCompra" NOT NULL,
    "materialId" TEXT,
    "nomeMaterialNovo" TEXT,
    "descricaoNovo" TEXT,
    "unidadeSugerida" TEXT,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "quantidadeRecebida" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "status" "StatusItemCompra" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "dataRecebimento" TIMESTAMP(3),
    "recebidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemPedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoCompra_numero_key" ON "PedidoCompra"("numero");

-- CreateIndex
CREATE INDEX "PedidoCompra_status_idx" ON "PedidoCompra"("status");

-- CreateIndex
CREATE INDEX "PedidoCompra_areaId_idx" ON "PedidoCompra"("areaId");

-- CreateIndex
CREATE INDEX "ItemPedidoCompra_status_idx" ON "ItemPedidoCompra"("status");

-- CreateIndex
CREATE INDEX "ItemPedidoCompra_materialId_idx" ON "ItemPedidoCompra"("materialId");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_movimentacaoOrigemId_fkey" FOREIGN KEY ("movimentacaoOrigemId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoCompra" ADD CONSTRAINT "ItemPedidoCompra_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoCompra" ADD CONSTRAINT "ItemPedidoCompra_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoCompra" ADD CONSTRAINT "ItemPedidoCompra_recebidoPorId_fkey" FOREIGN KEY ("recebidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
