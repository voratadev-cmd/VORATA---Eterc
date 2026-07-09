import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".tanstack",
      ".nitro",
      ".wrangler",
      ".claude",
      "agent", // subprojeto Python · sem JS/TS a lintar (e o venv tem .js perdidos)
      "**/venv",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Design system / context providers / shadcn componentes co-localizam componentes
    // com constantes, hooks, helpers e variantes cva por design.
    files: ["src/components/ui/**/*.{ts,tsx}", "src/components/ds/icons.tsx", "src/lib/theme.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  eslintPluginPrettier,
);
