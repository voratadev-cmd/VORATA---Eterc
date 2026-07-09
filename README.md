# Plataforma de Administração Contratual IA

Plataforma SaaS para **administração contratual de obras de empreitada**. Substitui o trabalho artesanal de consultorias por agentes de IA especializados operando 24/7 — diagnóstico contratual contínuo, quantificação automatizada de desequilíbrio econômico-financeiro, geração de RMA / claims / cartas / pareceres.

> **Fase atual:** front-end 100% com mocks plausíveis. Backend (auth, DB, agentes IA, integrações) entra como fase final.

Documentação completa do produto em [docs/01-system.md](docs/01-system.md) (síntese) e [docs/PRODUCT.md](docs/PRODUCT.md) (bruto). Regras de projeto para Claude Code em [CLAUDE.md](CLAUDE.md).

## Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) v1 + [TanStack Router](https://tanstack.com/router) (file-based) + [TanStack Query](https://tanstack.com/query)
- **UI:** React 19, Tailwind CSS v4, design system próprio em [src/components/ds/](src/components/ds/) + [shadcn/ui](https://ui.shadcn.com) (Radix-based)
- **Forms:** react-hook-form + zod
- **Mapas:** d3-geo
- **Bundler:** Vite 7
- **Build:** SPA estático com prerender — sem Workers, sem SSR runtime (`cloudflare: false` em [vite.config.ts](vite.config.ts))
- **Deploy alvo:** Vercel (config em [vercel.json](vercel.json)) — também funciona em Netlify, Cloudflare Pages, ou qualquer host de assets estáticos
- **Package manager:** Yarn Classic v1 (`packageManager: yarn@1.22.22`)
- **Node:** `>=20` (preferido `24` — ver [.nvmrc](.nvmrc))
- **Idioma:** PT-BR · **Layout:** desktop-first

## Módulos

5 módulos + Dashboard + Configurações (detalhes em [CLAUDE.md](CLAUDE.md#módulos-e-mapa-de-rotas)):

| Módulo                              | Descrição                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| **Dashboard**                       | Portfólio executivo (para diretor/dono)                                              |
| **M1 – Pré-Contrato**               | Revisão, bases, diagnóstico, transpasse                                              |
| **M2 – Gestão Contratual** ❤️       | **RMA Mensal** ⭐, timeline, mapa, condutas, plano de ação, biblioteca               |
| **M3 – Painel de Desequilíbrio**    | Indiretos, BDI, encargos, valor agregado, insumos, pontuais, **Gerador de Claim** ⭐ |
| **M4 – Check-list da Obra (SASBY)** | Tela única com 8 setores                                                             |
| **M5 – Finalização**                | Lições aprendidas, pleitos, judicial                                                 |

⭐ = destaque na sidebar. ❤️ = "CORAÇÃO" da plataforma.

## Começando

```bash
# Instalar dependências (Yarn Classic v1)
yarn install

# Servidor de desenvolvimento (HMR)
yarn dev

# Build de produção (SPA estático em dist/client/)
yarn build

# Preview local do build
yarn preview
```

## Scripts

| Comando          | O que faz                                    |
| ---------------- | -------------------------------------------- |
| `yarn dev`       | Servidor de desenvolvimento com HMR          |
| `yarn build`     | Build SPA estático (saída em `dist/client/`) |
| `yarn build:dev` | Build em modo desenvolvimento                |
| `yarn preview`   | Serve o build localmente                     |
| `yarn lint`      | ESLint + Prettier check em todos os arquivos |
| `yarn typecheck` | `tsc --noEmit`                               |
| `yarn format`    | Auto-format com Prettier                     |

## Estrutura

```
src/
├── routes/                    # Rotas file-based do TanStack Router
│   ├── __root.tsx             # Layout raiz + 404 + ErrorBoundary + ThemeProvider
│   ├── _app.tsx               # Layout do app (sidebar + topbar)
│   ├── _app/
│   │   ├── index.tsx          # Dashboard
│   │   ├── contracts/         # Lista + páginas de contrato (M1..M5)
│   │   └── settings.tsx
│   └── design-system.tsx      # Showcase do DS (fora do app shell)
│
├── components/
│   ├── ds/                    # ⭐ Design System próprio (Avatar, Button, Card, DataTable, Modal, Sidebar, Topbar, KpiCard, etc.)
│   ├── pages/                 # Views shared (CondutasView, PlanoAcaoView, ContabilShared, etc.)
│   ├── ui/                    # shadcn/ui (primitivos Radix — usados pelo DS)
│   ├── TimelineChart/         # Componente standalone
│   └── RmaTabs.tsx            # Tabs do módulo RMA
│
├── styles.css                 # Tailwind v4 + @theme inline
├── styles/
│   ├── tokens.css             # Tokens do DS (brand, ink, surfaces, etc.) — vence sobre shadcn
│   ├── base.css               # Reset base
│   └── patterns.css           # Padrões reutilizáveis
│
├── lib/
│   ├── theme.tsx              # ThemeProvider (dark mode via [data-theme="dark"])
│   ├── mocks/                 # Dados mock (obras, contratos)
│   ├── utils.ts               # cn() helper
│   ├── error-page.ts          # HTML de fallback SSR
│   └── error-capture.ts       # Recuperação de stacks engolidas
│
├── hooks/                     # Custom hooks (use-mobile)
├── server.ts                  # Entry SSR (mantido para compatibilidade)
├── start.ts                   # TanStack Start instance
├── router.tsx                 # Configuração do Router + QueryClient
├── routeTree.gen.ts           # Gerado automaticamente — NÃO editar
└── env.d.ts                   # Tipagem de import.meta.env
```

### Como adicionar uma rota

Crie um arquivo em `src/routes/` (ou subpasta). Exemplo, `src/routes/_app/about.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/about")({
  component: About,
});

function About() {
  return <div>About</div>;
}
```

O `routeTree.gen.ts` é regenerado automaticamente pelo plugin do Vite.

## Variáveis de ambiente

- **Client-side** (expostas no bundle): copie [.env.example](.env.example) para `.env.local` e prefixe com `VITE_`.

## Deploy

### Vercel (recomendado)

Config em [vercel.json](vercel.json). Output em `dist/client/` com fallback SPA pra `_shell.html`.

```bash
yarn build        # gera dist/client/
# Push pra branch conectada à Vercel → deploy automático
```

### Outros hosts estáticos

Qualquer um (Netlify, Cloudflare Pages, S3+CloudFront, etc.) — basta servir `dist/client/` e configurar fallback SPA pra `_shell.html`.

## Qualidade

- **Prettier:** `printWidth: 100`, double quotes, trailing commas
- **ESLint:** TypeScript + React Hooks + React Refresh + Prettier, com overrides pra `src/components/ui/` (shadcn)
- **Pre-commit (Husky + lint-staged):** roda ESLint --fix + Prettier nos arquivos staged + `yarn typecheck`
- **CI (GitHub Actions):** roda `lint` + `typecheck` + `build` em cada PR/push para `main` — config em [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Sistema de Farol (padrão de indicadores)

| Nível      | Tom DS    |
| ---------- | --------- |
| Conforme   | `success` |
| Observação | `info`    |
| Risco      | `warning` |
| Crítico    | `danger`  |

Use `<Badge tone="success|info|warning|danger">` para qualquer farol.
