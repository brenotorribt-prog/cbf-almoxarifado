-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESTOR', 'SUPERVISOR', 'ALMOXARIFE');

-- CreateEnum
CREATE TYPE "StatusMaterial" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoSolicitacao" AS ENUM ('SAIDA', 'EMPRESTIMO');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusEmprestimo" AS ENUM ('EMPRESTADO', 'DEVOLVIDO', 'ATRASADO', 'PERDIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ALMOXARIFE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadeMedida" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnidadeMedida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "numeroSequencial" SERIAL NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "qrCode" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoriaId" TEXT NOT NULL,
    "unidadeMedidaId" TEXT NOT NULL,
    "marca" TEXT,
    "fabricante" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "estoqueMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estoqueIdeal" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estoqueMaximo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estoqueAtual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "localizacaoFisica" TEXT,
    "situacao" "StatusMaterial" NOT NULL DEFAULT 'ATIVO',
    "fotoUrl" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "quantidadeAnterior" DECIMAL(12,3) NOT NULL,
    "quantidadeAtual" DECIMAL(12,3) NOT NULL,
    "motivo" TEXT,
    "documentoReferencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "solicitacaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSolicitacao" NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "motivo" TEXT,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "solicitanteId" TEXT NOT NULL,
    "aprovadorId" TEXT,
    "observacaoAprovacao" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprestimo" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "solicitanteNome" TEXT NOT NULL,
    "solicitanteSetor" TEXT,
    "dataRetirada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPrevistaDevolucao" TIMESTAMP(3) NOT NULL,
    "dataDevolucao" TIMESTAMP(3),
    "status" "StatusEmprestimo" NOT NULL DEFAULT 'EMPRESTADO',
    "observacoes" TEXT,
    "responsavelId" TEXT NOT NULL,
    "solicitacaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeMedida_sigla_key" ON "UnidadeMedida"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Material_numeroSequencial_key" ON "Material"("numeroSequencial");

-- CreateIndex
CREATE UNIQUE INDEX "Material_codigoInterno_key" ON "Material"("codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "Material_codigoBarras_key" ON "Material"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "Material_qrCode_key" ON "Material"("qrCode");

-- CreateIndex
CREATE INDEX "Material_categoriaId_idx" ON "Material"("categoriaId");

-- CreateIndex
CREATE INDEX "Material_situacao_idx" ON "Material"("situacao");

-- CreateIndex
CREATE INDEX "Material_nome_idx" ON "Material"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoEstoque_solicitacaoId_key" ON "MovimentacaoEstoque"("solicitacaoId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_materialId_idx" ON "MovimentacaoEstoque"("materialId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_tipo_idx" ON "MovimentacaoEstoque"("tipo");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_createdAt_idx" ON "MovimentacaoEstoque"("createdAt");

-- CreateIndex
CREATE INDEX "Solicitacao_status_idx" ON "Solicitacao"("status");

-- CreateIndex
CREATE INDEX "Solicitacao_materialId_idx" ON "Solicitacao"("materialId");

-- CreateIndex
CREATE INDEX "Solicitacao_tipo_idx" ON "Solicitacao"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Emprestimo_solicitacaoId_key" ON "Emprestimo"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Emprestimo_status_idx" ON "Emprestimo"("status");

-- CreateIndex
CREATE INDEX "Emprestimo_materialId_idx" ON "Emprestimo"("materialId");

-- CreateIndex
CREATE INDEX "Emprestimo_dataPrevistaDevolucao_idx" ON "Emprestimo"("dataPrevistaDevolucao");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "LogAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_createdAt_idx" ON "LogAuditoria"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_unidadeMedidaId_fkey" FOREIGN KEY ("unidadeMedidaId") REFERENCES "UnidadeMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
