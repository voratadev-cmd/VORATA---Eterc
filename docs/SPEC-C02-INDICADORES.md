# Spec — C02 Indicadores e Farol (análise pronta · só falta o build)

> Continuação do refactor das telas RMA. **Leia antes:** `docs/HANDOFF-TELAS-RMA.md` (playbook + regras +
> infra). Este doc tem a análise JÁ FEITA do C02 — comece pelo build, não re-analise o mockup.
> Mockup: `~/Documents/Voratta/Mockups_HTML_BR101_C_e_D (1)/C02_Indicadores_Farol_BR101.html`

## Veredicto: é REBUILD (não alinhamento)

A tela atual `src/routes/_app/contracts/$contractId/rma/indicadores.tsx` (560 linhas) tem design
DIFERENTE do mockup (HeroStrip "Parcial" + stars + BlocoStatusGrid + tab Marcos). O mockup C02 é um
**dashboard-farol de consolidação**. Rebuild a `indicadores.tsx` pra bater o mockup.

## Estrutura do mockup (de cima pra baixo)

1. **Banner ⚠ ATENÇÃO** (consolidado = pior bloco): "Nenhum bloco em Risco ou Crítico. Faturamento e
   prazo levemente abaixo do previsto (−2,5 p.p.)… Monitorar."
2. **Sec "Indicadores por bloco — valor + farol"** → 4 cards:
   - 📊 **Faturamento** `2,1%` (Observação) · "R$ 12,88 mi de R$ 611,36 mi · desvio −2,5 p.p."
   - ⏱️ **Prazo** `6,5%` (Observação) · "decorrido · 91 de 1.398 dias · desvio −2,5 p.p."
   - 👷 **Recursos** mini-lista MOD `1,7%` / MOI `7,3%` / EQP `2,6%` (Conforme) · "alocado vs contrato · −0,4 p.p."
   - 📦 **Insumos** "Dentro do índice" (Conforme) · "32 monitorados · desvio médio −1,4% · índice IPCA"
   - **Nota da régua** (farol por DESVIO em p.p. do contrato, real−previsto): **Conforme ≥ −1 · Observação
     −3 a −1 · Risco −8 a −3 · Crítico < −8**. Consolidado (pior bloco) = ● Atenção.
3. **Sec "Painéis"** → 3 painéis lado a lado:
   - **Curva de Faturamento**: mini ComposedChart (previsto×real) + `curvaInfo` (BM3 · real/previsto mês ·
     aderência · acum · GAP −2,5 p.p.). Reusa o dado da curva do Faturamento.
   - **Alocação de Recursos**: por categoria (MOD/MOI/EQP) 3 barras horizontais — Contr. total (cinza) /
     Contr. até BM (laranja) / Real (azul) + valor + legenda. Mockup: MOD 7109/84/123 · MOI 2654/274/194 ·
     EQP 4352/133/112.
   - **Prazo**: donut SVG (ou `ProgressRing`) "91 dias decorridos" (6,5%) + linhas (decorrido 6,5%/91d ·
     restante 93,5%/1.307d) + tabela (avanço físico 0,5%/1,6% · financeiro 2,1%/4,6% · atraso 1,1 p.p.) +
     box projeção (47,0 meses · +1,0 mês vs 46).
4. **Bloco "Análise de Insumos / Materiais"**: pill Conforme + 4 cards (32 monitorados · R$ 78,64 mi ·
   −1,4% · R$ 114.655) + tabela Curva ABC (material · classe · % do total · preço orçado · preço real) +
   nota (IPCA cláusula 6.2; preços reais não lançados → gap zero, Conforme).
   Mockup linhas: CBUQ (A · 33,9% · R$180/—) · Óleo diesel (A · 21,2% · R$5,90/R$6,02) · Concreto FCK20
   (A · 9,8% · R$510/—) · Aço CA-50 (B · 5,9% · R$6,04/—).
5. **Análise IA** (badge IA + "✎ editar" — afordância morta, OMITIR como no C03; texto fica "Pendente"
   no v45, sem geração de IA salva).

## Dados — TODOS no banco (confirmado p/ BR-101 fe288319-…)

| Parte                            | Read-model / hook                                                                                                | Verificado                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Faturamento valor/desvio + curva | `useFaturamentoBm` (`totalExecutadoPct` 2,11% · `desvioAcumuladoPct` · `curvaS`)                                 | ✓                                                                                                               |
| Recursos MOD/MOI/EQP             | `useRecursos` → `obra_recursos_meses` (Σ por categoria)                                                          | MOD 7109/123 · MOI 7340/194 · EQP 4352/112 ✓ (MOI total diverge do mockup 2654 — checar se é "até BM" vs total) |
| Insumos ABC                      | `useInsumos`/`useInsumosView` → `obra_insumos`                                                                   | classe A=4 · B=6 · C=22 (32) ✓                                                                                  |
| Prazo                            | `usePrazoBm`/`usePrazoCalc` + `useCronograma` + `usePrazoMarcos`                                                 | marcos 24 ✓ · dias decorridos 91/1.398 → derivar de data-corte vs início+prazo (checar se já vem)               |
| Farol consolidado por bloco      | `useIndicadoresView` (bridge) já expõe `blocoFaturamento/Prazo/Recursos/Insumos` {valor, nivel, descricao, nota} | reusar p/ o farol; mas a régua DESVIO-p.p. do mockup é própria — computar                                       |

**Atenção ao farol:** o C02 usa farol por **desvio em p.p. do contrato** (régua acima), DIFERENTE do C03
(aderência 90/85/70). Não reusar a régua do C03. Pode reusar o `nivel` da bridge se ela já usar desvio-p.p.,
senão computar a régua aqui (helper).

## Plano de build (tasks #6-9 no board, se persistirem)

1. **Consolidação** — helper que, dos 4 hooks de módulo, computa por bloco {valor, desvio p.p., farol pela
   régua} + o consolidado (pior bloco) p/ o banner. PENDENTE≠0 (insumos sem preço real → Conforme honesto,
   gap zero; não fabricar).
2. **Banner ⚠ + 4 cards** (valor + pill farol + footer + nota régua). Recursos = mini-lista MOD/MOI/EQP.
3. **3 painéis**: mini-curva (Recharts, reusa `curvaS`) · barras Recursos (3 por categoria) · donut Prazo
   (`ProgressRing` do DS ou SVG) + tabela + box.
4. **Insumos ABC** (4 cards + tabela) + **Análise IA** (pendente honesto) + render CDP + comparar pixel + tsc/lint.

## Regras (do handoff, reforço)

- Tokens-only DS · farol `Badge tone=success/info/warning/danger` (Conforme/Observação/Risco/Crítico).
- PENDENTE ≠ 0 (preços reais não lançados → "—"/gap zero, não 0 fabricado).
- Sem hardcode de BR-101 — tudo dos read-models.
- Render: headless Chrome `--screenshot` (estático) ou helper CDP (interações). Crop com PIL p/ ver detalhe.
  ⚠ a sessão t2 mexeu em `/tmp/cdp_render.mjs` (aponta pro node_modules dela) — recrie o seu no worktree certo.
