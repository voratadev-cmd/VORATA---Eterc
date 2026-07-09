# Aba: Faturamento (RMA · 5.3.2)

> A aba **mais usada do RMA**. Curva S contratado × realizado com gap visualizado, KPIs do desvio acumulado, análise por frente de serviço e tabela mês-a-mês. Tem o **único `useState`** desta aba: seletor "Todo faturamento" vs "Apenas serviços".

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"O contrato está faturando dentro do esperado?"** Se não — qual o desvio em R$ e %, em qual frente de serviço, e qual a tendência até o fim do contrato.

É o termômetro financeiro do RMA. Quando o desvio passa de -15% (crítico) ou a projeção (linha tracejada) cruza o prazo contratual, é gatilho automático pra `Gerador de Claim` no M3 (5.3.10).

---

## 2. Contexto de produto

- **Quando se abre**: usuário clica na tab "Faturamento" — ou direto via dot vermelho/amarelo na `RmaTabs`
- **Decisão que embasa**:
  - "Devo iniciar processo de pleito de reequilíbrio?"
  - "Em qual frente está o gargalo de faturamento?"
  - "A projeção atual passa do prazo contratual?" — se sim, sugere claim de prorrogação automático
- **Para onde alimenta**:
  - Banner amarelo "Alerta" linka pra Windows Analysis (aba Prazo)
  - Curva S e desvio acumulado alimentam M3 (Painel de Desequilíbrio)
- **Regras de negócio críticas**:
  - **Critérios de farol (configuráveis)** — definidos em [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.2:

    | Nível      | Desvio        |
    | ---------- | ------------- |
    | Conforme   | até −1%       |
    | Observação | −1% a −5%     |
    | Risco      | −5% a −15%    |
    | Crítico    | acima de −15% |

  - **`pctColor(pct)`** (helper interno da tabela mês-a-mês) usa thresholds **diferentes**: ≥95% success, ≥85% info, ≥75% warning, senão danger (cor por % de aderência mensal, não por desvio acumulado)
  - **Seletor de visão**: "Todo o faturamento" vs "Apenas serviços" — exclui mobilização/canteiro/manutenção. **Estado local** com `useState` (não muda mock — só visual no protótipo)
  - **Projeção tracejada** começa a partir do BM corrente (`real: null`, `projecao: number`)

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/faturamento`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/faturamento.tsx`](../../src/routes/_app/contracts/$contractId/rma/faturamento.tsx)
- **CSS**: [`faturamento.css`](../../src/routes/_app/contracts/$contractId/rma/faturamento.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.faturamento: FaturamentoBM`.

```
FaturamentoBM
├─ 5 KPIs do hero:
│   ├─ contratadoTotalLabel: string              // "R$ 70,7 mi"
│   ├─ contratadoTotalNota: string               // "valor total contratado · 18 BMs"
│   ├─ contratadoAcumuladoLabel: string          // "R$ 52,3 mi"
│   ├─ contratadoAcumuladoNota: string           // "até BM-09 (data corte 15/05)"
│   ├─ realAcumuladoLabel: string                // "R$ 44,1 mi"
│   ├─ realAcumuladoNota: string                 // "84,3% do contratado até BM-09"
│   ├─ desvioAcumuladoPct: number                // -15.7 (negativo = abaixo)
│   ├─ desvioFarol: FarolLevel                   // cor do KPI 4 (valor + dot)
│   ├─ desvioValorLabel: string                  // "−R$ 8,2 mi vs. contratado"
│   ├─ saldoFaturarLabel: string                 // "R$ 26,6 mi"
│   ├─ saldoFaturarPct: number                   // 37.6
│   └─ saldoFaturarBmsRestantes: number          // 9 → "9 BMs restantes"
│
├─ periodo: PeriodoFat | null                     // deck de projeção (3 cards abaixo do gráfico · _12)
│   ├─ ritmo3BmLabel: string                      // "R$ 5,73 mi" (média dos últimos 3 BMs)
│   ├─ projecaoTerminoMeses: number | null        // 107 → BM corrente + saldo ÷ ritmo → card "mês 107"
│   ├─ deltaProjecaoMeses: number | null          // +61 → projeção − prazo (baseline contratado)
│   └─ alertaProrrogacao: string | null           // banner só quando Δ > 0 (sem emoji · UI desenha o ícone)
│   // faturado/previsto/aderência do mês NÃO ficam aqui — o tooltip do gráfico os mostra por BM
│
├─ curvaS: CurvaSPonto[]                          // 18 pontos (BM-01..BM-18)
│   ├─ bm: string                                 // "BM-09"
│   ├─ contratado: number                         // R$ mi acumulado (sempre presente)
│   ├─ real: number | null                        // null em BMs futuros
│   └─ projecao: number | null                    // null em BMs passados, valor a partir do corrente
│
├─ alertaTexto: string                            // banner amarelo abaixo do gráfico (com **negrito**)
│                                                 // Ex.: "Projeção atual termina em **fev/2027** — 87d
│                                                 //       após o prazo contratual"
│
├─ analiseTextual: string                         // texto longo IA (com **negrito**)
│                                                 // editável (rótulo "EDITÁVEL" no card)
│
├─ frentes: FrenteServico[]                       // tabela por frente
│   ├─ id: string
│   ├─ nome: string                               // "Terraplenagem", "Estruturas", etc.
│   ├─ contratadoLabel: string                    // "R$ 2,40 mi" (já formatado)
│   ├─ realLabel: string                          // "R$ 1,92 mi"
│   ├─ pct: number                                // 80.0 → real / contratado
│   └─ farol: FarolLevel
├─ frentesObservacao: string                      // rodapé do card frentes (com **negrito**)
│
├─ bmHistorico: BmHistoricoFat[]                  // tabela mês-a-mês (linha por BM passado)
│   ├─ bm: string                                 // "BM-09"
│   ├─ previstoLabel: string                      // "R$ 5,82 mi"
│   ├─ realLabel: string                          // "R$ 4,71 mi"
│   ├─ pct: number                                // 80.9 → cor via pctColor()
│   └─ corrente?: boolean                         // destaca linha do BM corrente
│
├─ chatQuote: string                              // (legado — chat removido)
└─ chatSugestoes: Array<{ id, texto }>            // (legado — chat removido)
```

### Deck de projeção + tooltip rico (`periodo: PeriodoFat`) — rev5

A partir da rev5 (mockup BR-101 Macaé), o "período" se divide em dois lugares:

1. **Tooltip do gráfico (hover por BM)** — `CurvaTooltip` mostra, para o BM sob o cursor: **Previsto (mês)**, **Real (mês)**, **Prev. acum.**, **Real acum.**, **Aderência do mês** (`realMes ÷ previstoMes`) e **Desvio acumulado** (`realAcum ÷ prevAcum − 1`). Tudo derivado do ponto da `curvaS` — mês sem real medido → "—" (PENDENTE ≠ 0).
2. **Deck de 3 cards (`FarolCard size="sm"`) abaixo do gráfico** + banner de prorrogação:

| Card                | Métrica                | Tom                                                                |
| ------------------- | ---------------------- | ------------------------------------------------------------------ |
| RITMO MÉDIO · 3 BM  | `ritmo3BmLabel`        | neutro (velocidade observada, sem alvo)                            |
| PROJEÇÃO DE TÉRMINO | `projecaoTerminoMeses` | neutro → card lê "mês 107" (derivação do ritmo)                    |
| Δ PROJEÇÃO VS PRAZO | `deltaProjecaoMeses`   | cor **derivada do sinal** (token, NÃO um nível de farol fabricado) |

São **derivados da curva** (BMs executados), validados vs `_12` (ritmo 5,73M · projeção mês 107 · Δ +61). Render condicional: só monta quando `periodo != null` (obra sem curva normalizada não ganha deck fabricado).

**Regras de derivação (em `bridgeFaturamento.ts · buildPeriodo`):**

- **Ritmo** com 2 casas em milhões (`fmtMiExato`, auditável — o `formatBRLAbbreviated` dos KPIs abrevia ≥10 mi). Média dos últimos 3 meses realizados, **ignorando meses sem medição** (`projecaoRs` null); meses genuinamente ociosos (real = 0) **contam**. Antes (`?? 0`) o null virava 0 e diluía a média, inflando a projeção e o alerta.
- **Prazo** (para o Δ) = nº de meses com `contratadoRs != null` (horizonte do **baseline contratado**), **não** `serie.length` — que pode incluir cauda de projeção sem baseline.
- **Projeção** = BM corrente (meses decorridos) + saldo ÷ ritmo. **Δ** = projeção − prazo, arredondado a 1 casa; o **alerta de prorrogação** acende sobre esse mesmo valor arredondado (o card nunca lê "0 meses" sob o banner). Banner `--warning-bg`, nunca border-left colorido (vetado); gatilho do claim de reequilíbrio (M3 · §1).
- **Sem farol no deck**: aderência de **mês** é volátil (faturamento é lumpy) e não há régua oficial de período; classificá-la com a régua do desvio _acumulado_ casaria badge de uma métrica com número de outra. O **farol oficial de faturamento vive no KPI "Desvio Acumulado"** do hero; o risco de projeção fica na cor-derivada-do-sinal do Δ + o banner. _Follow-up_: se o produto definir uma régua de aderência de período (Settings · `FAROL_THRESHOLDS`), a aderência passa a recebê-la.

**Gráfico (rev5):** barras mensais em família AZUL (previsto claro, real escuro); acumulados em linhas — Prev. acum. cinza tracejado (referência), Real acum. sólido. Legenda termina com a dica "passe o mouse: aderência do mês + desvio acum.".

> **Pendente (decisão de dado):** o switcher "por disciplina / por frente" do gráfico (mockup rev5) exige **série mensal por disciplina/frente**, que ainda não é normalizada — a curva é consolidada e as frentes têm só contratado total (real pendente). Não é fabricado aqui: entra quando o dado mensal por disciplina existir.

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

- `LineChart`, `Line`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ReferenceLine`, `ResponsiveContainer`

### 5.3 Componentes locais

| Função               | Props                             | O que renderiza                                                   |
| -------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `FaturamentoAba`     | (route)                           | Composição — 6 children + grid 2-col                              |
| `FatHeader`          | `visaoTipo, onChangeVisao`        | Título + seletor "Todo/Apenas serviços" + botão "Exportar"        |
| `FatKpis`            | `fat, bm`                         | 5 KpiCards horizontais                                            |
| `FatKpi`             | `label, value, valueColor?, nota` | 1 card genérico (recebe `nota: ReactNode`)                        |
| `CurvaSCard`         | `fat, bm`                         | Header com legenda + LineChart 3 linhas + alerta amarelo          |
| `AnaliseTextualCard` | `texto`                           | Card com tag "EDITÁVEL" + texto formatado                         |
| `FormattedText`      | `text`                            | Parser inline `**bold**` (idêntico a outras abas)                 |
| `FrentesCard`        | `frentes, observacao`             | Tabela ARIA (4 cols + farol dot) + rodapé com observação          |
| `BmHistoricoCard`    | `historico`                       | Tabela ARIA (BM/Previsto/Real/%) — linha do BM corrente destacada |
| `pctColor`           | `pct`                             | Helper: 95+=success, 85+=info, 75+=warning, <75=danger            |

---

## 6. Binding componente ↔ dados

| Componente           | Campos consumidos                                                                                                                                                                                                | Visualização                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `FatHeader`          | `visaoTipo` (state local)                                                                                                                                                                                        | Select com 2 options ("Todo o faturamento (com canteiro/mobiliz./manut.)" / "Apenas serviços")                     |
| `FatKpis`            | `fat.{contratadoTotal,contratadoAcumulado,realAcumulado,saldoFaturar}*`, `fat.desvioAcumuladoPct`, `fat.desvioFarol`, `fat.desvioValorLabel`, `fat.saldoFaturarPct`, `fat.saldoFaturarBmsRestantes`, `bm.numero` | 5 KPIs. O 4º (Desvio) usa cor do farol no value e dot na nota                                                      |
| `CurvaSCard`         | `fat.curvaS[]` (3 séries: contratado/real/projecao), `bm.numero` (ReferenceLine "data de corte"), `fat.alertaTexto` (banner)                                                                                     | LineChart 320px alto: contratado (#2a5fb8 sólido), real (var(--danger) sólido), projecao (var(--danger) tracejada) |
| `AnaliseTextualCard` | `fat.analiseTextual`                                                                                                                                                                                             | Card com tag editável + texto formatado                                                                            |
| `FrentesCard`        | `fat.frentes[]`, `fat.frentesObservacao`                                                                                                                                                                         | Tabela 5 col + dot colorido + observação                                                                           |
| `BmHistoricoCard`    | `fat.bmHistorico[]`                                                                                                                                                                                              | Tabela 4 col — % com cor de `pctColor(pct)`; BM corrente em **bold**                                               |

### Layout pai

```
main.fat-main
├─ FatHeader (linha)
├─ FatKpis (5-col grid)
├─ CurvaSCard (full-width · barras mensais + tooltip rico por BM)
├─ FatProjecaoDeck (3-col grid + banner · só quando fat.periodo != null)
└─ div.fat-grid (2-col)
    ├─ div.fat-col-esq
    │   ├─ AnaliseTextualCard
    │   └─ FrentesCard
    └─ div.fat-col-dir
        └─ BmHistoricoCard
```

---

## 7. Lógica e regras

- **`useState<"todo" | "servicos">("todo")`** — único state nas abas RMA. Hoje só visual (não filtra dados de fato no mock — apenas troca a opção do `<select>`). Quando virar real, deve recalcular `curvaS`, `frentes`, KPIs com base em escopo de serviços puro
- **`ReferenceLine x={bm.numero}`** marca a "data de corte" no gráfico — divisória visual entre real (esquerda) e projeção (direita)
- **`connectNulls={false}` no Real, `connectNulls={true}` na Projeção** — Real para no último BM com dado; Projeção ignora nulls e desenha contínua a partir do BM corrente
- **`pctColor(pct)`** usa thresholds de aderência mensal (positivos), **diferentes** dos critérios de farol do desvio acumulado (negativos). Cuidado ao confundir
- **`Tooltip formatter`** customizado: valores formatados como "R$ X mi" com 2 casas decimais
- **`Cell "Desvio"`** sem `signo` explícito — o valor já vem negativo do mock
- **Alert banner linka pra `#windows`** (anchor) — provavelmente legado, anchor não existe na aba Faturamento

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão (`getVisaoGeral`)
- **Para onde os dados vão**:
  - **Visão Geral** consome `fat.curvaS` (mini-gráfico) e `fat.desvioAcumuladoPct` (GAP do foot)
  - **Indicadores** consome só `bm.blocoFaturamento` (resumo)
  - **M3 Gerador de Claim** (rota `/desequilibrio/gerador-claim`) usa Curva S + desvio para construir o pleito de reequilíbrio
- **Alerta cross-aba**: quando a `projecao` cruza o prazo contratual → banner amarelo sugere "Ver análise Windows" → aba Prazo
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Conceito chave – Curva S**: é a representação canônica do faturamento na engenharia. Eixo X = BMs, Y = acumulado em R$ milhões. A Curva S "ideal" tem formato de S (lenta no início — mobilização, acelera no meio, desacelera no fim — limpeza/entrega). Desvios persistentes em qualquer fase indicam problemas
