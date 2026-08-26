import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // O projeto não usa React Compiler. A regra `react-hooks/set-state-in-effect`
    // (herdada da config do Next) gera falsos positivos no idioma clássico de
    // "buscar/dar debounce no mount" adotado na base. Desabilitada de forma
    // documentada, em vez de contornar com hacks.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      // Falso positivo com @tanstack/react-virtual: as listas virtualizadas
      // chamam hooks através de uma lib externa que o ESLint não reconhece
      // como React, apontando "biblioteca incompatível".
      "react-hooks/incompatible-library": "off",
      // Parâmetros/variaveis prefixados com `_` são intencionalmente
      // não usados (ex.: assinaturas de callback obrigatórias).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Documentos React PDF usam <Image> do @react-pdf/renderer, que não
    // suporta atributo alt — a regra de acessibilidade não se aplica aqui.
    files: [
      "src/components/pdf/**",
      "src/lib/exportacoes/compras/**",
      "src/lib/exportacoes/relatorios/**",
      "src/lib/pdf/**",
    ],
    rules: { "jsx-a11y/alt-text": "off" },
  },
  {
    // Avatares e logo carregados de URL dinâmica (R2) — <img> nativo com alt
    // é intencional aqui; next/image não se aplica ao avatar do usuário.
    files: ["src/components/layout/SideBar.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
