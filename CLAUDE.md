# Plataforma de Administração Contratual IA — regras do projeto

> **INSTÂNCIA ETERC** — fork limpo do produto (09/jul/2026), sem dados de outras obras/clientes.
> Supabase próprio: substituir `rruhfhcvtlnuqmskxbpr` pelo ref real do projeto Eterc.

## Princípio fundamental · "Design e usabilidade são tudo"

**Esta é a regra mais importante do projeto.** Toda tela, todo componente, todo fluxo passa pelo crivo de: _é bonito, é fácil de usar, é uma experiência premium?_ Se a resposta não for "sim" nos três, refazer.

Concretamente, em **toda lista, painel, dashboard, formulário ou seção** com 5+ itens ou 3+ campos, considerar **antes de mais nada**:

1. **Busca / filtro** — Sempre que houver coleção (obras, arquivos, alertas, claims, pleitos, linhas de tabela...) cabe um campo de busca em destaque com ícone, debounce 250-300ms, clear button (`×`), placeholder com exemplos reais e feedback imediato no contador de resultados.
2. **Ordenação** — Toda coleção visível precisa de pelo menos uma opção de ordenação além da padrão (mais recente, A-Z, valor, prioridade do farol...). Default sensato + 2-3 alternativas via Segmented ou Select compact.
3. **Paginação** — Listas com 10+ itens ganham paginação client-side (8-12 itens por página). Navegação com setas + números, "Página X de Y", "Mostrando A-B de N" e estado de página preservado no scroll/URL quando relevante.
4. **Estados completos** — `loading` (Skeleton com forma do conteúdo final, nunca spinner genérico) · `empty inicial` (EmptyState framed com ação primária visível) · `empty filtrado` (estado distinto do empty inicial, com "Limpar busca" como ação) · `error` (mensagem clara + botão de retry).
5. **Transições e microinterações** — Hover refinado nos cards/linhas (border-color + lift sutil de 1-2px), focus rings visíveis em todos os controles interativos, animações de entrada via `var(--easing)`, respeitar `prefers-reduced-motion`.
6. **Responsivo desktop-first** — Quebras 1280 → 1100 → 880 → 720. Cards de 3-4 colunas viram 2 → 1. Filtros em pílulas viram dropdown em mobile. Footer/toolbar sticky pode virar fixo no bottom em 720.
7. **Tipografia tabular para números** — `font-variant-numeric: tabular-nums` em todo valor (R$, %, contadores, datas). Tokens-only para cor: `var(--text)` / `var(--text-2)` / `var(--text-3)` / `var(--text-4)` na hierarquia de hint.
8. **Microcopy intencional** — "X obra" vs "X obras" (plural correto), datas relativas quando possível ("há 2 horas"), placeholders com exemplo concreto ("Buscar por nome, contratante ou cidade…"), mensagens de erro que dizem o que fazer.

**Regra prática**: ao construir uma tela, perguntar "se essa tela tivesse 80 itens em vez de 3, ainda seria boa?" Se não, adicionar busca/filtro/ordenação/paginação **antes** de considerar a tela pronta.

A lista de obras (`/contracts`) é o **template canônico** desse padrão — qualquer tela de coleção futura deve replicar a estrutura: hero KPIs → toolbar (busca + ordenação) → grid responsivo → paginação.

---

## Infra & acesso · git, Supabase, deploy (REGRAS DURAS)

**Esta máquina tem múltiplas contas (vorata + viverdeia). As ferramentas default apontam pra conta ERRADA. Sempre usar os acessos da vorata abaixo. NÃO usar MCP neste projeto.**

### Git · GitHub da vorata via SSH (NUNCA HTTPS)

- Repo: `voratadev-cmd/VORATA---Eterc`.
- O credential helper HTTPS resolve pro usuário `Dev-viverdeia` (sem acesso → 403). O `git@github.com` puro usa uma **deploy key** read-only de outro repo (também 403).
- **Use sempre o host alias SSH `github-voratadev`** (configurado em `~/.ssh/config` com a key `~/.ssh/id_ed25519_voratadev`):
  ```
  git remote set-url origin git@github-voratadev:voratadev-cmd/VORATA---Eterc.git
  git push origin <branch>
  ```
- Confirmar a identidade certa: `ssh -T git@github-voratadev` → deve responder `Hi voratadev-cmd!`.
- Fluxo de PR/merge: push da branch via SSH → PR/merge no GitHub.

### Supabase · projeto da vorata

- Projeto: `rruhfhcvtlnuqmskxbpr` (`https://rruhfhcvtlnuqmskxbpr.supabase.co`), região **us-east-1**.
- **NÃO usar o MCP do Supabase** — falha de rede aqui (`net::ERR_FAILED`) e aponta pra conta errada.
- A Supabase CLI local está logada na conta **viverdeia** (não enxerga o projeto vorata) → `supabase link`/`db push --linked` falham.
- **Conexão que FUNCIONA daqui** = Session pooler IPv4 (a Direct `db.<ref>.supabase.co:5432` é IPv6-only, não conecta):
  ```
  postgresql://postgres.rruhfhcvtlnuqmskxbpr:<SENHA>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
  ```
  ⚠️ Prefixo é **`aws-1`** (não `aws-0`), porta **5432**, user **`postgres.<ref>`**.
- **Aplicar migration** (sem MCP, sem CLI link): runner em `worker/scripts/apply-migration.mjs` (usa `pg`, roda o `.sql` como transação única):
  ```
  cd worker && npm i pg --no-save
  SUPABASE_DB_URL='postgresql://postgres.rruhfhcvtlnuqmskxbpr:<SENHA>@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
    node scripts/apply-migration.mjs ../supabase/migrations/<arquivo>.sql
  ```
  Verificar com `worker/scripts/verify-migration.mjs`. Migrations são idempotentes (`if not exists`/`drop ... if exists`).
- **Regenerar `database.types.ts` após cada migration** (mesma env var, sem Docker/CLI):
  `node scripts/gen-database-types.mjs` (em `worker/`) → introspecta o schema e reescreve `src/lib/supabase/database.types.ts`; rodar `bunx prettier --write` no arquivo e `bunx tsc --noEmit` depois.
- A **senha do banco** o usuário pega/reseta em Settings → Database → Database password. Nunca commitar; é só passada na hora.
- Não vasculhar `.env`/keychain atrás de credenciais (o classifier bloqueia) — pedir ao usuário o método/valor quando faltar.

### Deploy · worker em DigitalOcean

- Worker de extração vive em `worker/` (sub-pacote, `package.json` próprio, Dockerfile multi-stage).
- DO App Platform puxa do GitHub (`branch` configurada) · **`source_dir: worker`** no spec (`worker/deploy.do.yml`).
- Secrets no painel DO (encrypted): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`. Nunca commitar.

### Regra geral

- **Sem MCP neste projeto** (git, supabase, qualquer coisa). Usar CLI/SSH/connection direta.
- Commit/push só quando o usuário pedir. Quando pedir push, já usar o remote SSH `github-voratadev`.

---

## Visão geral

**Produto**: Plataforma SaaS para administração contratual de obras de empreitada. Substitui o trabalho artesanal de consultorias por agentes de IA especializados operando 24/7 — diagnóstico contratual contínuo, quantificação automatizada de desequilíbrio econômico-financeiro, geração de RMA / claims / cartas / pareceres. Doc completo em [docs/01-system.md](docs/01-system.md) (síntese) e [docs/PRODUCT.md](docs/PRODUCT.md) (bruto).

**Stack**: TanStack Start, React 19, TypeScript estrito, Vite 7, Tailwind v4, **Yarn Classic v1** (gerenciador), **build SPA estático** (deploy em Vercel ou qualquer host de assets estáticos — `cloudflare: false`, `tanstackStart.spa.enabled: true`). Roteamento file-based em `src/routes/`. Idioma único: PT-BR. Desktop-first.

**Fase atual**: front-end 100% com mocks plausíveis. Backend (auth, DB, agentes IA, integrações) entra como fase final.

### Personas

- **Diretor / dono** de construtora — portfólio executivo (Dashboard)
- **Gerente de contrato** — operação diária (RMA, módulos do contrato)
- **Jurídico** — claims, arbitragem (Painel de Desequilíbrio, Gerador de Claim)

### Módulos e mapa de rotas

5 módulos + Dashboard + Configurações. A árvore reflete o diagrama de arquitetura (`docs/01-system.md`).

| URL                                                                                                   | Item                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/`                                                                                                   | **Dashboard** (portfólio)                                                                |
| `/contracts`                                                                                          | Lista de contratos                                                                       |
| `/contracts/$id`                                                                                      | **M2.1.1 Síntese do Contrato** (entry point)                                             |
| `/contracts/$id/pre/{revisao,bases,diagnostico,transpasse}`                                           | M1.1–M1.4 — Pré-Contrato                                                                 |
| `/contracts/$id/rma`                                                                                  | **M2.1.2 RMA Mensal** ⭐                                                                 |
| `/contracts/$id/{timeline,mapa,melhorias-doc,condutas,plano-acao,biblioteca}`                         | M2.1.3–M2.2 — Gestão Contratual                                                          |
| `/contracts/$id/desequilibrio/{indiretos,bdi,encargos,valor-agregado,insumos,pontuais,gerador-claim}` | M3.1, M3.2, M3.3, M3.4, M3.7, M3.8, M3.10 — Painel de Desequilíbrio (`gerador-claim` ⭐) |
| `/contracts/$id/checklist`                                                                            | M4 — Check-list da Obra (SASBY) · tela única com 8 setores                               |
| `/contracts/$id/finalizacao/{licoes,pleitos,judicial}`                                                | M5.1–M5.3 — Finalização                                                                  |
| `/settings`                                                                                           | Configurações                                                                            |
| `/design-system`                                                                                      | Showcase do DS (fora do app shell)                                                       |

⭐ = destaque visual na Sidebar (`key: true`).

**M2 Gestão Contratual** é "CORAÇÃO" — chip vermelha no item da Sidebar (`tag: "CORAÇÃO"`).

Total: 34 itens de menu, 32 rotas-stub criadas (todas com `PageHeader` + `EmptyState` aguardando implementação real).

### Vocabulário essencial

RMA · BM · BDI · MOD/MOI/EQP · RDO · RNC · Curva S · Valor Agregado (AACE 25R-03) · Total Cost · Measured Mile · Pleito/Claim · Nexo Causal · Windows Analysis · Take-off · Glosa · Singularidades · Contratante/Contratada · TAC · AACE · IBAPE · SINAPI · Orsafáscio · Jusbrasil.

Definições completas em [docs/01-system.md](docs/01-system.md#glossário).

### Sistema de Farol (padrão de todo indicador)

| Nível      | Tom DS    |
| ---------- | --------- |
| Conforme   | `success` |
| Observação | `info`    |
| Risco      | `warning` |
| Crítico    | `danger`  |

Use `<Badge tone="success|info|warning|danger">` para qualquer farol. Os 4 tons já cobrem 1:1.

---

## Design System (foundation)

A primeira fase materializou um **design system próprio**, extraído fielmente do protótipo "Life OS" (Claude Design). O DS define tokens, primitivos e padrões de construção. Toda tela do produto é montada usando este DS — sem reinventar componentes, sem hardcodar cores.

---

## Tokens — fonte da verdade

- Arquivo: [src/styles/tokens.css](src/styles/tokens.css)
- Carregado em [src/routes/\_\_root.tsx](src/routes/__root.tsx) via `<link>` **depois** do `styles.css`, então vence sobre os tokens shadcn (oklch) que ainda existem no scaffold.
- Reset base: [src/styles/base.css](src/styles/base.css).
- Dark mode usa o atributo `[data-theme="dark"]` no `<html>` (espelhando o Life OS). O `@custom-variant dark` no [src/styles.css](src/styles.css) está alinhado com isso, então `dark:` do Tailwind também responde a `[data-theme]`.

**Escalas disponíveis** (todas em `:root` + override em `[data-theme="dark"]`):

| Categoria          | Tokens                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Brand              | `--brand`, `--brand-600`, `--brand-700`, `--brand-100`, `--brand-50`                                                             |
| Ink (navy)         | `--ink`, `--ink-700`, `--ink-800`                                                                                                |
| Superfícies        | `--bg`, `--surface`, `--surface-2`, `--surface-3`                                                                                |
| Bordas             | `--border`, `--border-strong`                                                                                                    |
| Texto              | `--text`, `--text-2`, `--text-3`, `--text-4`                                                                                     |
| Semânticas (fg/bg) | `--success`/`--success-bg`, `--warning`/`--warning-bg`, `--danger`/`--danger-bg`, `--info`/`--info-bg`                           |
| Domínio (Vault)    | `--vault`, `--vault-bg`                                                                                                          |
| Tipografia         | `--font` (Manrope), `--font-mono` (JetBrains Mono), `--fs-12..40`, `--fw-regular/medium/semibold/bold`, `--lh-tight/snug/normal` |
| Spacing (base 4)   | `--s-1` (4px) … `--s-16` (64px)                                                                                                  |
| Radius             | `--r-sm` (8), `--r-md` (12), `--r-lg` (16), `--r-xl` (20), `--r-pill` (9999)                                                     |
| Sombras            | `--sh-sm`, `--sh-md`, `--sh-lg`, `--sh-pop`                                                                                      |
| Misc               | `--ring` (focus ring box-shadow), `--easing`                                                                                     |

**Bridge Tailwind**: o `@theme inline` em [src/styles.css](src/styles.css) expõe os tokens como utilities (`bg-brand`, `text-ink`, `text-text-3`, `bg-surface-2`, `font-sans`, etc.). Use utilities Tailwind quando for one-off; use componentes do DS quando o padrão se repete.

### Regra de ouro

**Nunca hardcodar cor, fonte, spacing, radius ou sombra**. Sempre referenciar via `var(--token)` (no CSS) ou utility Tailwind correspondente (no JSX). Se um valor não tem token, o token está faltando — adicione em `tokens.css` antes de usar.

---

## Componentes globais

- Pasta: [src/components/ds/](src/components/ds/)
- Padrão: cada componente vive em seu próprio diretório com `.tsx` + `.css` co-localizados.
- Barrel export: [src/components/ds/index.ts](src/components/ds/index.ts) — importe **sempre** do barrel:

```ts
import { Button, Card, KpiCard, List, ListItem, I } from "@/components/ds";
```

### Inventário atual

**Tier 1 — primitivos núcleo**
`Icon` + `I` (~60 ícones) · `Button` · `IconButton` (neutro, 3 variants × 3 sizes) · `Card` (+ `CardHeader`, `CardTitle`, `CardSub`, `CardLink`) · `Input` · `Textarea` · `Select` · `Toggle` · `Segmented` · `Badge` · `Tag` · `Avatar` · `Divider`

**Tier 2 — primitivos compostos**
`KpiCard` + `KpiRow` · `List` + `ListItem` · `DataTable` (header em grid + linhas hover, `align="right"` em valores) · `Menu` (+ `MenuItem`, `MenuSection`, `MenuDivider`, `MenuAnchor`) · `EmptyState` · `Skeleton` · `InfoCard` · `ProgressBar` · `ProgressRing` · `Tabs` · `FilterChip` · `Checkbox` · `FieldRow` · `PageHeader` · `TrendIndicator` · `DateCell` · `HeroCard` · `Modal` · `AddCard` (dashed "+ Adicionar", padrão ou compact)

**Tier 3 — layout & visualização**
`Grid` + `Col` (12 colunas, reflow ≤1100/≤720) · `Sparkline`

### Showcase

[`/design-system`](http://localhost:8080/design-system) — referência visual ao vivo com todas as variantes, tons e estados, mais um toggle claro/escuro. Use como **catálogo navegável** ao construir telas: se algo não está no showcase, ou compõe com primitivos existentes, ou propõe um novo primitivo (não inline-style).

---

## Como construir uma tela (a regra)

Receita padrão:

1. **Container da rota** — usa `padding: var(--s-6) var(--s-8)` (já refletido no shell padrão `.page`; em rotas standalone use `style={{padding:"var(--s-6) var(--s-8)"}}` ou um `<main className="page">`).
2. **Topo** — sempre `<PageHeader title subtitle actions />`.
3. **Layout** — `<Grid>` com `<Col span={1..12}>`. O grid já reflowa em 1100px e 720px. Para sequências verticais simples, dispense o Grid.
4. **Conteúdo em blocos** — `<Card>` com `<CardHeader><CardTitle/><CardLink/></CardHeader>` no topo, conteúdo dentro. Listas de itens repetitivos: `<List><ListItem ... /></List>`. Métricas no topo: `<KpiRow><KpiCard .../></KpiRow>`.
5. **Vazio / carregando** — `<EmptyState/>` ou `<Skeleton/>` para os respectivos estados.
6. **Ações** — `<Button variant size>`. Cor por intenção: `primary` (brand) para ação principal, `outline` para secundária, `ghost` para terciária, `danger` para destrutiva, `ink` para fundos escuros.

### Hierarquia visual

- Página: `--fs-28` bold (já dentro de `PageHeader`).
- Bloco/card: `--fs-15` semibold (já em `CardTitle`).
- Texto secundário: `var(--text-3)` em `--fs-12/13`.
- Números/valores: sempre `font-variant-numeric: tabular-nums` (já aplicado em `KpiCard`, `ListItem`, `DateCell`).

### Cor por intenção

- Sucesso/positivo → `--success` / `--success-bg`
- Aviso/atrasado → `--warning` / `--warning-bg`
- Erro/negativo → `--danger` / `--danger-bg`
- Informativo/neutro → `--info` / `--info-bg`
- Marca/ação → `--brand` / `--brand-50`
- Seguro/sigiloso → `--vault` / `--vault-bg`

### Spacing

Base 4. Use `--s-3` (12px) para gaps entre componentes pequenos, `--s-4` (16px) para gaps padrão, `--s-6` (24px) para separação de seções, `--s-8` (32px) para padding de página, `--s-10..16` apenas em empty states / hero verticalmente generoso.

### Responsivo

Os breakpoints já estão nos componentes:

- **1100px**: Grid e KpiRow reflowam para 2 colunas.
- **880px**: `FieldRow` empilha label/control.
- **720px**: tudo vira flex column.

Evite criar breakpoints novos sem necessidade — use os existentes.

### Theme

- Toggle: `document.documentElement.dataset.theme = "light" | "dark"`.
- O DS inteiro responde automaticamente via `[data-theme="dark"]` no `tokens.css`.
- Quando criar um componente novo, sempre confira o estado dark — alguns tons precisam de override (`[data-theme="dark"] .meu-comp { ... }`).

---

## Convenções de CSS

- Tokens-only. Nada de cor hex, nada de px hardcoded fora de detalhes geométricos (ex: 1px border, ícones específicos).
- CSS por componente, co-localizado: `Foo/Foo.tsx` importa `./Foo.css` no topo. Vite injeta no build.
- Classes globais, nomes curtos e semânticos (`.btn`, `.card`, `.lst-item`). Não usar CSS Modules — quebra a fidelidade ao Life OS e cria nomes hash dinâmicos sem ganho aqui.
- Estados via classes modificadoras: `.btn-primary`, `.btn-icon`, `.checkbox.checked`, `.toggle.on`. Não usar atributos `data-*` para estilizar a menos que faça sentido semântico (ex: `[data-theme]`).
- Animações: usar `var(--easing)` (curva única do DS).

---

## O que NÃO usar

- **`src/components/ui/`** — shadcn/ui legado do scaffold. Componentes não removidos para não complicar reverter, mas **não use no DS nem nas telas**. Se precisar de algo que não temos, crie no DS.
- **Classes utilitárias do Tailwind para cor/spacing quando há token equivalente** — prefira `var(--text-3)` a `text-zinc-500`, prefira `var(--s-4)` a `p-4`. Tailwind utilities são úteis para layout flex/grid one-off.
- **Inline-styles para padrões repetidos** — se você está repetindo `style={{...}}` em vários lugares, vire um componente do DS.
- **NUNCA barra/borda colorida de destaque em card — nem no topo, nem nos lados, nem embaixo** (decisão do usuário, jun/2026). Vetado: `border-top`, `border-left`, `border-right`, `border-bottom` coloridos (`var(--ink)`/`var(--brand)`/qualquer tom semântico) como "tarja" de KPI/farol/categoria. Esse é o visual genérico de "dashboard feito por IA" e está **banido**. Vale pra `.card`, `.alert-item`, `.analise-card`, `.ctr-card`, KPIs e qualquer card futuro. A única exceção é **citação/quote** (ex.: `.chat-panel-quote`, `.sintese-chatbox-quote`) — porque não é card.
- **Padrão canônico de KPI card** (substitui a tarja colorida) — **`/contracts/$id/desequilibrio/indiretos` é o exemplar**: ícone (lucide) dentro de um **chip** quadrado de canto arredondado (`var(--r-sm)`, fundo `var(--surface-2)`) no topo-esquerdo + rótulo ao lado → valor grande (`tabular-nums`) → sub discreto. Hover sobe 2px + borda escurece + `var(--sh-sm)`. **Card herói/ativo**: fundo brand bem leve + borda brand via `color-mix(in srgb, var(--brand) X%, var(--surface))` (adapta no dark sozinho) e chip tingido — **nunca** uma barra. Pra comunicar farol num card: `<Badge tone="...">` no header, label UPPERCASE colorida à direita, ou o chip/fundo tingido — jamais tarja de borda.
- **Ícones = `lucide-react`** (já instalado) nas telas novas — bonitos, consistentes (stroke 1.75–2, 24px viewBox, casa com o `Icon` do DS). **Nada de emoji como ícone de UI** (💰📐💸🔬 em label/título estão banidos). O `I`/`Icon` custom do DS continua válido onde já é usado; lucide é o default pro que falta e pra refino visual.

---

## Grafo do projeto · graphify

Grafo de conhecimento do repo (código + SQL + docs) em `graphify-out/` — **primeiro passo ao mapear relações/raio de impacto** (refazer tela, mudar read-model, rastrear quem consome um dado):

- `~/.venvs/graphify/bin/graphify query "<símbolo/pergunta>"` · `path "<A>" "<B>"` · `explain "<conceito>"`. Queries cirúrgicas ≫ amplas (BFS a partir de uma tela inunda com hubs `cn()`/`I`).
- Mapa visual: `graphify-out/graph.html` · resumo: `graphify-out/GRAPH_REPORT.md`.
- Após mudança de código relevante: `~/.venvs/graphify/bin/graphify update .` (AST-only, local, segundos, sem custo).
- Se `graphify-out/` não existir nesta máquina: `graphify extract . --backend claude-cli` reconstrói (docs via assinatura do Claude Code, sem API key).
- ⚠️ **LGPD**: o `.graphifyignore` exclui `docs/rma/documentos/`, `DOCUMENTOS REVISADOS/` e `fixtures/` (dado REAL de cliente) — **nunca remover essas linhas**; nenhum documento de cliente pode entrar no grafo.
- O grafo acelera contexto; as **regras** continuam soberanas em `docs/` + este arquivo (ele não substitui consulta a docs de produto).

## Dev

- **Pacote**: `bun` (instalado em `~/.bun/bin`). Se faltar no PATH: `export PATH="$HOME/.bun/bin:$PATH"`.
- **Servidor de dev**: `bun run dev` — porta 8080.
- **Build**: `bun run build` (TanStack Start → Cloudflare Workers via `wrangler.jsonc`).
- **Lint**: `bun run lint`.
- **Type-check**: `bunx tsc --noEmit`.
- **Showcase**: http://localhost:8080/design-system

---

## Roadmap (deferred para fases seguintes)

- **Shell de navegação**: `Sidebar`, `Topbar`, `CmdK` (compostos com dados de nav). O Life OS tem implementação completa em `/Users/mateusmilagre/.cache/lo-design/src/` se for útil portar.
- **Gráficos complexos**: `AreaChart`, `Donut`, `PatrimonyChart`, `BenchmarkBars`, `AllocationPie`. Quando o produto pedir, considerar Recharts (já está em `package.json`) ou portar fielmente do Life OS.
- **Componentes de calendário**: `MiniCalendar`, `MonthView`, `WeekView`, `DayView`.
- **Formatadores** (`fmtBRL`, datas, relativos): dependem do domínio — criar quando o projeto real estiver definido.

---

## Vocabulário canônico (PT-BR, sem traduções)

O produto é **PT-BR único, desktop-first, sem i18n**. Os termos abaixo são **canônicos**: aparecem literalmente em UI (labels, títulos, microcopy), código (nomes de tipos, funções, variáveis quando expostas), commits e PRs. Nada de traduções, abreviações novas, sinônimos, ou inglês onde tem termo PT-BR consolidado.

**Siglas técnico-contratuais (uppercase, sem ponto entre letras):**
`RMA` (Relatório Mensal de Acompanhamento) · `BM` (Boletim de Medição) · `BDI` (Bonificação e Despesas Indiretas) · `MOD` / `MOI` / `EQP` (Mão de Obra Direta / Indireta / Equipamentos) · `RDO` (Relatório Diário de Obra) · `RNC` (Relatório de Não Conformidade) · `TAC` (Termo de Aditamento Contratual) · `ESG`

**Métodos e conceitos (capitalização títulada quando virar label/título):**
`Curva S` · `Valor Agregado` (norma `AACE 25R-03`) · `Total Cost` · `Measured Mile` (Milha Aferida) · `Windows Analysis` · `Take-off` · `Nexo Causal` · `Pleito` · `Claim` · `Singularidades` · `Glosa` · `Frente de Serviço` · `Caminho Crítico` · `Cenário Tendente`

**Stakeholders e papéis:**
`Contratante` · `Contratada` · `Adm Contratual IA` (agente sênior) · `Diretor` · `Gerente de Contrato` · `Jurídico`

**Provedores e normas:**
`AACE` · `IBAPE` · `ABNT` · `SINAPI` · `Orsafáscio` · `Jusbrasil`

**Módulos:**
`Pré-Contrato` (M1) · `Gestão Contratual` (M2, "coração") · `Painel de Desequilíbrio` (M3) · `Check-list da Obra` (M4, "SASBY-EASAC") · `Finalização` (M5)

**Não usar:**

- "Pleito" ≠ "Reivindicação" / "Solicitação" — sempre **Pleito**
- "Claim" mantém-se em inglês quando se refere ao entregável (documento `.docx`)
- "Faturamento" ≠ "Receita" — sempre **Faturamento**
- "Obra" e "Contrato" são quase sinônimos no produto, mas: **Obra** é o objeto físico (canteiro, edifício), **Contrato** é o instrumento jurídico. Em UI agregada (lista, filtros, mapa), preferir **Obra**. Em telas de execução, preferir **Contrato**.

Glossário completo está em [docs/PRODUCT.md](docs/PRODUCT.md). Síntese em [docs/01-system.md](docs/01-system.md).

---

## Regra do Farol (todo indicador numérico)

O **Sistema de Farol** é a camada transversal mais importante do produto ([docs/08-camadas-transversais.md §9.3](docs/08-camadas-transversais.md)). **Regra dura**:

1. **Todo indicador numérico com tendência ganha farol** — faturamento, prazo, recursos, desequilíbrio, qualidade documental, satisfação contratual, etc.
2. Os **4 níveis são fixos** — `Conforme` · `Observação` · `Risco` · `Crítico`. Nada de adicionar "Atenção", "Alerta", "Médio" ou variantes.
3. **Cores vêm exclusivamente dos tokens semânticos do DS**:
   - Conforme → `--success` / `--success-bg`
   - Observação → `--info` / `--info-bg`
   - Risco → `--warning` / `--warning-bg`
   - Crítico → `--danger` / `--danger-bg`
4. **Nada de cor hex ou nome CSS solto** para farol. Sempre `var(--token)` ou `<Badge tone="...">`.
5. **Critérios numéricos são configuráveis por contrato** (futuro Settings). Em código mockado, definir constantes em `src/lib/mocks/contracts.ts` (`FAROL_THRESHOLDS_*`) — nunca espalhar magic numbers.
6. **Indicadores puramente informativos (sem desvio)** não recebem farol — usar `--text-2` neutro. Ex.: "Documentos processados: 14" não é farol; "Faturamento: 8,3% (-32%)" é farol.
7. **Padrão de UI para farol**:
   - Em badge: `<Badge tone="danger">Crítico</Badge>`
   - Em card: **NUNCA tarja de borda** (ver "O que NÃO usar") — use `<Badge tone>` no header, label UPPERCASE colorida à direita, ou fundo tingido via `color-mix(... var(--<tom>) X%, var(--surface))`
   - Em ponto/dot: 8px círculo
   - Em tabela: célula com Badge à direita
8. Use o helper `farolToBadge` e `farolLabel` de [src/lib/mocks/contracts.ts](src/lib/mocks/contracts.ts) — não duplicar mapas em outros lugares.

---

## Roadmap canônico

Ordem **oficial** de construção. Espelha [docs/PRODUCT.md §11](docs/PRODUCT.md) adaptada ao que já foi feito. **Mudar a ordem requer decisão explícita do usuário** — não re-priorizar tela a tela.

| #     | Bloco                                                                          | Estado    |
| ----- | ------------------------------------------------------------------------------ | --------- |
| 0     | Design System + App Shell (Sidebar+Topbar+ContractPicker)                      | ✅        |
| 1     | Dashboard `/`                                                                  | ✅        |
| 2     | Lista de Obras `/contracts`                                                    | ✅        |
| 3     | M1.1 Revisão Documental `/contracts/$id/pre/revisao`                           | ✅        |
| **4** | **M2.1.1 Síntese do Contrato** `/contracts/$id` (entry point)                  | → próximo |
| 5     | M2.1.2 RMA Mensal `/contracts/$id/rma` (maior bloco, 11 abas via `Tabs`)       |           |
| 6     | M3 Painel de Desequilíbrio + Gerador de Claim                                  |           |
| 7     | Agentes Setoriais (backend)                                                    |           |
| 8     | M4 Check-list (depende de #7)                                                  |           |
| 9     | M1.2-1.4 (Bases · Diagnóstico · Transpasse) + M5 (Lições · Pleitos · Judicial) |           |
| 10    | APIs (Jusbrasil · Orsafáscio · RDO digital · e-mail)                           |           |

**Notas sobre o roadmap:**

- O **RMA mensal (#5)** tem 11 abas paralelas no doc. A Sidebar atual lista vários itens dentro de "Gestão Contratual" — quando atacarmos o RMA, **muito provavelmente** RMA vira uma rota única com `Tabs` internas e a Sidebar fica só com Síntese · Timeline · Mapa · Melhorias · Condutas · Plano · Biblioteca em paralelo.
- **Gerador de Claim (3.10)** é o ápice do M3 — wizard de 4 etapas (Dossiê → Fundamentação → Quantificação → Geração `.docx`). Vai pedir um `Stepper` que ainda não existe no DS.
- **Chat com Adm Contratual IA** é camada transversal — entra como slot global no shell **antes** do backend de agentes, com respostas mockadas. Decisão de UI pendente (drawer lateral vs. botão flutuante).

---

## Documentação de produto

Tudo em `docs/`. Sempre consultar antes de propor mudanças funcionais:

- [docs/PRODUCT.md](docs/PRODUCT.md) — bruto do `.docx` v1.0 maio/2026
- [docs/01-system.md](docs/01-system.md) — overview + índice
- [docs/02-dashboard.md](docs/02-dashboard.md) — Dashboard
- [docs/03-m1-pre-contrato.md](docs/03-m1-pre-contrato.md) — Pré-Contrato
- [docs/04-m2-gestao-contratual.md](docs/04-m2-gestao-contratual.md) — Gestão Contratual (RMA)
- [docs/05-m3-desequilibrio.md](docs/05-m3-desequilibrio.md) — Painel de Desequilíbrio
- [docs/06-m4-checklist.md](docs/06-m4-checklist.md) — Check-list SASBY
- [docs/07-m5-finalizacao.md](docs/07-m5-finalizacao.md) — Finalização
- [docs/08-camadas-transversais.md](docs/08-camadas-transversais.md) — Agentes · Base · Farol · Chat
