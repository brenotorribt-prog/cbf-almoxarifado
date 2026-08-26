-- Criação da configuração de identidade visual da organização (singleton).
-- Tabela nova: nenhuma coluna/registro existente é alterado. Campos nulos
-- significam "usar o valor do tema default" (fallback em /public/branding).
CREATE TABLE IF NOT EXISTS "configuracoes_visuais" (
    "id"                   TEXT       NOT NULL DEFAULT 'principal',
    "nomeOrganizacao"      TEXT,

    "corPrimaria"          TEXT,
    "corAccent"            TEXT,
    "corDestaque"          TEXT,
    "corBackground"        TEXT,
    "corSurface"           TEXT,
    "corSidebar"           TEXT,
    "corTextoPrimaria"     TEXT,
    "corTextoSecundaria"   TEXT,
    "corLink"              TEXT,

    "logoUrl"              TEXT,
    "loginBackgroundUrl"   TEXT,
    "sidebarBackgroundUrl" TEXT,

    "atualizadoPorId"      TEXT,
    "atualizadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracoes_visuais_pkey" PRIMARY KEY ("id")
);
