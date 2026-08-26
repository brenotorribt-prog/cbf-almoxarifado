-- Vincula movimentações de SAÍDA e empréstimos a uma pessoa do cadastro
-- leve (PessoaAtendida). Colunas opcionais no banco para preservar os
-- registros criados antes da regra; a exigência vale na API para novos
-- lançamentos. Os campos desnormalizados solicitante* seguem como
-- snapshot usado por listas, relatórios e PDFs — agora preenchidos
-- a partir do cadastro.

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "pessoaAtendidaId" TEXT;

-- AlterTable
ALTER TABLE "Emprestimo" ADD COLUMN     "pessoaAtendidaId" TEXT;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_pessoaAtendidaId_fkey" FOREIGN KEY ("pessoaAtendidaId") REFERENCES "PessoaAtendida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_pessoaAtendidaId_fkey" FOREIGN KEY ("pessoaAtendidaId") REFERENCES "PessoaAtendida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_pessoaAtendidaId_idx" ON "MovimentacaoEstoque"("pessoaAtendidaId");

-- CreateIndex
CREATE INDEX "Emprestimo_pessoaAtendidaId_idx" ON "Emprestimo"("pessoaAtendidaId");
