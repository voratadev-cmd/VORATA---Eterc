# Handoff — Refactor das telas do RMA (mockup → tela com o nosso Design System)

> Contexto pra uma sessão nova (outro worktree) pegar o trabalho de replicar as telas do RMA mensal.
> **Leia este doc + o `CLAUDE.md` antes de começar.** O `CLAUDE.md` tem as regras do projeto (DS, tokens,
> infra, git/Supabase). Este doc tem o **playbook específico do refactor das telas**.

## Objetivo

Replicar **cada tela do RMA mensal** a partir dos **mockups HTML** do idealizador, com o **nosso Design
System**, ligadas ao **dado REAL do banco** (obra BR-101 v45, já extraída e normalizada). Cada mockup é a
**especificação executável** da tela (deve ficar igual, mas com o nosso DS).

## Os mockups

Pasta: **`~/Documents/Voratta/Mockups_HTML_BR101_C_e_D (1)/`**
`C01_Sintese` · `C02_Indicadores_Farol` · **`C03_Faturamento` (✅ FEITO)** · `C04_Recursos` · `C05_Prazo` ·
`C06_Insumos` · `C07_Produtividade` · `C08_Aderencia_Curvas` · `C09_Chuvas` · `C10_Panorama` · `C11_Condutas` ·
`C12_Plano_Acao` · `C13_Timeline` · `C14_MapaObra` · … · `D00`–`D09` (Desequilíbrio).

Cada HTML tem: 1 bloco `<style>` (CSS) + body (estrutura) + `<script>` (dados embutidos + JS dos
comportamentos). **O blob gigante de uma linha geralmente é o Chart.js inline — ignore.** Os valores estão
corretos (pode haver pequenas divergências). É interativo: toggles, listas que expandem, selects, hover.

## O PLAYBOOK (padrão validado no C03)

1. **Renderize o mockup** (headless Chrome `--screenshot`) **e leia o source** (separe CSS/body/JS com um
   script Python; descarte o Chart.js).
2. **Analise a fundo**: regiões → CSS (mapeie cada cor/spacing pro **token do DS**) → JS (cada
   toggle/expand/select/hover) → **dados** (cruze cada valor com as tabelas `obra_*` do banco).
3. **Renderize a tela ATUAL** (dev server) e **compare** — várias telas já existem ~80%.
4. **Gap de dado?** → **resolver GENÉRICO** (casa por ESTRUTURA/título, **zero hardcode** de nome BR-101) +
   **gate** (Σ conserva a uma âncora; ex. PV) + **migration ADITIVA** + persist + wire em
   `workbook_motor.py` + **read-model** + hook. **Re-normalize o v45.**
5. **UI com o DS** (tokens + primitivos do barrel `@/components/ds`), batendo o comportamento do mockup.
6. **Verifique**: render (helper CDP pra interações) + compare ao mockup + golden tests + `tsc` + lint.

## Regras de ouro (NÃO violar)

- **PENDENTE ≠ 0**: nunca fabricar `0`/real onde a fonte não mediu → `NULL` + `"— a medir"`. (Ex.: real por
  local não medido → **não ratear** o real da disciplina entre os KMs — seria fabricar.)
- **Σ conserva**: todo resolver financeiro tem **gate** (Σ == PV `611.357.315` ou outra âncora). _Erro nos
  valores = milhões._
- **Genérico/multi-obra**: resolvers casam por estrutura/coluna, **nunca** nome fixo (`Trecho 01`, `KM 144`).
  "Várias obras/mês, parecidas mas não iguais."
- **Farol**: tokens `success/info/warning/danger` = `Conforme/Observação/Risco/Crítico`. No drill, Badge
  `"● Crítico"` (classe `.fat-d2-farol` com `text-transform:none` — o Badge é uppercase por padrão).
- **DS**: tokens-only (sem hex/px hardcoded). Sem `border-left` colorido em card pra farol.

## Infra (resumo — detalhes no CLAUDE.md)

- **Obra de teste**: BR-101 v45 · `contrato_id = fe288319-ff4f-4564-a459-139dfb021265` ·
  `arquivo_id = 6f511b40-2c64-4387-9cf5-480d03a6f80d` (v45 normalizado).
- **Banco** (senha o usuário passa — nunca commitar): Session pooler IPv4
  `postgresql://postgres.SUPABASE_REF_ETERC_AQUI:<SENHA>@aws-1-us-east-1.pooler.supabase.com:5432/postgres`.
  Query via `worker/` + `pg` (`npm i pg --no-save` se faltar). Migration: `worker/scripts/apply-migration.mjs`.
- **Re-normalizar o v45** após um resolver novo: setar o arquivo `status='verified', normalize_attempts=0` +
  `cd agent && PYTHONPATH=. ./venv/bin/python -m agents.normalizacao.job --once`.
- **Regen types** após migration: `cd worker && node scripts/gen-database-types.mjs` + `bunx prettier --write`.
- **Dev server**: `bun run dev --port <SUA_PORTA>` (use porta própria por worktree — t1=5180, t2=5181…).
  Front lê `.env.local` (copie pro worktree — é gitignored).
- **Render/screenshot p/ verificar**: headless Chrome `--screenshot` (estático) OU um helper CDP via `ws`
  (node) que **clica e tira screenshot** (pra validar expand/select/hover). Padrão: launch Chrome
  `--remote-debugging-port`, conecta via `ws`, `Page.navigate` → espera → `Runtime.evaluate` (clica) →
  `Page.captureScreenshot`. (No t1 ficou em `/tmp/cdp_render.mjs` e `/tmp/cdp_select.mjs` — recrie se preciso.)

## Estado atual (jun/2026)

- ✅ **C03 Faturamento — FEITO**: decks (Deck 1/2), Curva S (Recharts) **com select por disciplina/frente**,
  Resumo BM a BM, **drill bidirecional Disciplina × Frente** (expand, farol, aderência, macro-grupos,
  TOTAL), análise IA. Heatmap removido.
  - Backend novo (genérico, Σ=PV): `obra_faturamento_frente_macro` (17 frentes + macro) ·
    `obra_faturamento_disciplina_resumo` (15 disc + real + farol) · `obra_faturamento_serie_mes`
    (disc/frente × mês, previsto+real). + os já existentes (`frente_trecho`, `curvas`, `disciplina_mes`).
- 🔜 **Próximas**: escolha a tela (sugestão: C04 Recursos, C05 Prazo, ou C01 Síntese). Aplique o playbook.

## Arquivos-chave (C03 = referência de tudo)

- **Tela**: `src/routes/_app/contracts/$contractId/rma/faturamento.tsx` (+ `.css`).
- **Read-models**: `src/lib/supabase/faturamento*.ts` · **hooks**: `src/lib/hooks/useFaturamento*.ts`.
- **Backend**: `agent/agents/normalizacao/{resolvers,gate,persist,workbook_motor}.py` ·
  `supabase/migrations/2026061700000*_*.sql`.
- **Regras**: `CLAUDE.md` (DS/tokens/infra). **Produto**: `docs/` (consultar antes de mudar funcional).

## Coordenação entre os 2 worktrees (importante)

- Arquivos/git: **isolados** (worktrees ≠). Cada um na sua branch; merge na `main` no fim.
- **Banco Supabase é o MESMO** pros dois. Front só LÊ → ok. Mas **não rodem normalização/extração da mesma
  obra ao mesmo tempo** (é delete+insert por obra — atropela). Combine: **uma sessão por vez mexe no
  `obra_*` da BR-101**, ou usem obras diferentes.
- Dev server: **porta própria** por worktree.
