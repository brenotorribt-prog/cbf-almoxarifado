# Capturas de tela (README)

Estas imagens são **placeholders** gerados para o repositório não quebrar
os links do README. O objetivo é substituí-las por **capturas reais** da demo
(já populada) antes de tornar o repositório público.

## Como capturar (primeira vez)

1. Popule o banco **demo**: `docs/DEPLOY_DEMO.md` (comandos `migrate deploy` +
   `npm run seed:demo`).
2. Rode a aplicação apontando para o banco demo (`npm run dev`) e entre com uma
   conta de demonstração (ex.: `admin@demo-almoxarifado.com`).
3. Navegue até cada tela abaixo com **dados fictícios** já carregados.

## Telas a capturar (por prioridade)

| # | Tela | Arquivo esperado |
|---|------|------------------|
| 1 | Dashboard (KPIs + alertas) | `dashboard.png` |
| 2 | Materiais / Estoque (lista com filtros e níveis) | `materiais.png` |
| 3 | Requisições (listagem com estados) | `requisicoes.png` |
| 4 | Detalhe de uma requisição (fluxo/status por item) | `requisicao-detalhe.png` |
| 5 | Movimentações (entradas/saídas/ajustes/descartes) | `movimentacoes.png` |
| 6 | Empréstimos (ativos, atrasados, devolvidos) | `emprestimos.png` |
| 7 | Relatórios (gráficos preenchidos) | `relatorios.png` |

## Padrões de imagem (para não deixar o repositório pesado)

- Resolução sugerida **1600×1000 px** (ou proporção ~16:10).
- Formato **PNG** (ou WebP), com captura da janela inteira (sem tela cheia de
  OS/ferramentas de dev).
- **Comprimir** (pngquant / Squoosh / export do navegador) para ficar abaixo de
  ~300 KB por arquivo.

## Checklist de privacidade

Antes de subir as capturas, confira que **não** aparece:

- credenciais, tokens ou URLs internas;
- e-mails/telefones reais (use somente os contatos fictícios da demo);
- nomes locais/endereços IP de infraestrutura;
- prompts ou URLs de debug do navegador.

Depois de gerar os PNG, apague os `.svg` correspondentes (ou mantenha-os fora do
commit) para o README referenciar os arquivos finais `*.png`.