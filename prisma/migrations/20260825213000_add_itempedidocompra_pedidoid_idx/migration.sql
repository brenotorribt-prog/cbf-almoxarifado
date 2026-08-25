-- Índice para a FK ItemPedidoCompra.pedidoId — usada nos JOINs do include
-- de itens (listagem/exportação de pedidos de compra), em
-- findFirst/findMany({ pedidoId }) e nos deletes em cascata.
CREATE INDEX "ItemPedidoCompra_pedidoId_idx" ON "ItemPedidoCompra"("pedidoId");
