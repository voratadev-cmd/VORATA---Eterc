# Aba: Produtividade (RMA · 5.3.4)

> Comparativo de **Hora-Homem (HH)** real × contratado × benchmark nacional × benchmark global. 3 indicadores preliminares de perda de produtividade. Gráfico de evolução com banda **Measured Mile** destacada. Frentes detalhadas em tabela.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"Cada hora-homem alocada está gerando o valor previsto?"** Quando HH Real custa mais do que HH Contratado (ou que os benchmarks de obras similares), há **perda de produtividade** — base de pleitos pelo método **Total Cost** (M3.5) ou **Measured Mile**.

A aba é **diagnóstica** — quantificação fina mora no M3. O sub do header é explícito: "quantificação fina mora no M3".

---

## 2. Contexto de produto

- **Quando se abre**: tab "Produtividade" — geralmente depois de identificar gap em `Recursos` (banner amarelo "indício de perda")
- **Decisão que embasa**:
  - "A perda é em relação ao contratado, ao benchmark, ou ambos?"
  - "É geral ou tem frente específica concentrando o problema?"
  - "Houve queda recente (últimas 12 semanas) que sinalize evento causador?"
- **Para onde alimenta**:
  - **M3.4 Valor Agregado (CPU)** — método AACE 25R-03
  - **M3.5 Total Cost** — diferencial Real − Contratado atribuído a causas externas
  - **Aba Curvas Lib×Cap×Aloc** — capacidade produtiva é insumo dela
- **Conceitos importantes**:
  - **HH** (Hora-Homem) — R$/Hh = quanto cada hora de mão de obra custa em média (custo total ÷ horas alocadas)
  - **Benchmark Nacional** — média de obras aeroportuárias no Brasil
  - **Benchmark Global** — AACE com paridade ajustada (Global ajustado por câmbio/contexto)
  - **Measured Mile** — período de **12 semanas** considerado "produtividade normal". Comparações com períodos impactados feitas em cima dessa baseline
  - **3 tipos de perda preliminares**: vs. Contratado (premissa) · vs. Benchmark (mercado) · Queda Recente (últimas 12 semanas)

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.4: "Comparativo HH real · HH contratado · benchmark nacional · benchmark global — herdado da v1".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/produtividade`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/produtividade.tsx`](../../src/routes/_app/contracts/$contractId/rma/produtividade.tsx)
- **CSS**: [`produtividade.css`](../../src/routes/_app/contracts/$contractId/rma/produtividade.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.produtividade: ProdutividadeBM`.

```
ProdutividadeBM
├─ comparativo: ComparativoHH                     // 4 KPIs do hero + BarChart
│   ├─ hhReal: number                             // 186 (R$/Hh)
│   ├─ hhContratado: number                       // 142
│   ├─ benchNacional: number                      // 155
│   └─ benchGlobal: number                        // 138
│
├─ 3 IndicadorPerda (cards entre KPIs e gráficos):
│   ├─ perdaVsContratado: IndicadorPerda          // "PERDA VS. CONTRATADO" · icon=trending
│   ├─ perdaVsBenchmark: IndicadorPerda           // "PERDA VS. BENCHMARK NACIONAL" · icon=filter
│   └─ quedaRecente: IndicadorPerda               // "QUEDA RECENTE · 12 SEMANAS" · icon=clock
│       (IndicadorPerda = {
│         pct: number,                            // ex.: +31.0 → cor + sinal
│         farol: FarolLevel,                      // cor do valor + classe do card
│         descricao: string,                      // "HH Real 31% acima do orçado..."
│         metodoNota: string                      // "indicador preliminar · método: total cost · ver M3.5"
│       })
│
├─ evolucao: EvolucaoHHPonto[]                    // LineChart BM a BM (3 séries)
│   ├─ bm: string                                 // "BM-09"
│   ├─ real: number                               // R$/Hh
│   ├─ contratado: number                         // R$/Hh
│   └─ benchNacional: number                      // R$/Hh
│
├─ measuredMileInicio: string                     // "BM-05" — início da ReferenceArea
├─ measuredMileFim: string                        // "BM-09" — fim (geralmente BM corrente)
├─ evolucaoObservacao: string                     // texto curto abaixo do gráfico
│
├─ analiseTextual: string                         // longo IA · editável · parágrafos por \n\n + **negrito**
│
├─ frentes: FrenteHH[]                            // tabela por frente
│   ├─ id: string
│   ├─ nome: string                               // "Terraplenagem", "Estruturas", etc.
│   ├─ hhReal: number                             // 195 (R$/Hh)
│   ├─ hhContratado: number                       // 138
│   ├─ desvioPct: number                          // +41.3 (positivo = pior)
│   └─ farol: FarolLevel
│
└─ chatQuote: string                              // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

- `BarChart`, `Bar`, `Cell` — comparativo (4 barras horizontais, cores fixas por categoria)
- `LineChart`, `Line`, `ReferenceArea`, `ReferenceLine` — evolução
- `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`

### 5.3 Componentes locais

| Função                    | Props               | O que renderiza                                                    |
| ------------------------- | ------------------- | ------------------------------------------------------------------ |
| `ProdutividadeAba`        | (route)             | Composição — 3 children + grid 2-col                               |
| `ProdHeader`              | `bm`                | Título + sub                                                       |
| `KpisHero`                | `prod, bm`          | 4 cards horizontais (HH Real destacado em vermelho)                |
| `formatHH`                | `v`                 | Helper: `R$ {v}/Hh`                                                |
| `IndicadoresPreliminares` | `prod`              | Grid 3 cards                                                       |
| `IndicadorCard`           | `icon, titulo, ind` | Card com cor por farol + tag UPPERCASE                             |
| `ComparativoCard`         | `prod, bm`          | BarChart horizontal 4 barras + ReferenceLine "premissa contratual" |
| `EvolucaoCard`            | `prod, bm`          | LineChart 3 séries + ReferenceArea "Measured Mile"                 |
| `AnaliseTextualCard`      | `texto`             | Card EDITÁVEL · parseia parágrafos por `\n\n`                      |
| `FormattedText`           | `text`              | Parser inline `**bold**`                                           |
| `FrentesCard`             | `frentes, bm`       | Tabela ARIA 5 cols com dot + sinal explícito no Δ                  |

### Constantes

- `FAROL_COLOR`, `FAROL_LABEL` (padrão)
- `COMP_COLOR` — cores **fixas** por categoria do comparativo:
  - hhReal: `var(--danger)` (vermelho)
  - hhContratado: `#9aaecb` (cinza)
  - benchNacional: `#2a5fb8` (azul)
  - benchGlobal: `#1e6f4f` (verde)

---

## 6. Binding componente ↔ dados

| Componente                | Campos consumidos                                                                                                                                                                    | Visualização                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KpisHero`                | `prod.comparativo.{hhReal, hhContratado, benchNacional, benchGlobal}`, `bm.numero` (label do KPI 1)                                                                                  | 4 KPIs · KPI 1 (Real) destaque vermelho · KPI 3/4 com classe específica `prod-kpi-bench-{nac,glob}`                                                                     |
| `IndicadoresPreliminares` | `prod.{perdaVsContratado, perdaVsBenchmark, quedaRecente}`                                                                                                                           | 3 cards (sinal `+`/sem prefixo no valor, cor por farol, classe `prod-ind-${farol}`)                                                                                     |
| `ComparativoCard`         | `prod.comparativo` (4 valores)                                                                                                                                                       | BarChart horizontal · 4 barras coloridas (uma por categoria) · ReferenceLine vertical em `hhContratado` ("premissa contratual") · label R$ X/Hh à direita de cada barra |
| `EvolucaoCard`            | `prod.evolucao[]` (3 séries: real/contratado/benchNacional), `prod.measuredMileInicio/Fim` (ReferenceArea), `bm.numero` (X-axis tick bold no BM corrente), `prod.evolucaoObservacao` | LineChart 240px com banda amarela "12 semanas · Measured Mile"                                                                                                          |
| `AnaliseTextualCard`      | `prod.analiseTextual` (multi-parágrafo)                                                                                                                                              | Card EDITÁVEL · 1 `<p>` por parágrafo (split `\n\n`)                                                                                                                    |
| `FrentesCard`             | `prod.frentes[]`, `bm.numero`                                                                                                                                                        | Tabela 5 cols com dot e sinal `+`/sem                                                                                                                                   |

### Layout pai

```
main.prod-main
├─ ProdHeader
├─ KpisHero (4-col)
├─ IndicadoresPreliminares (3-col)
└─ div.prod-grid (2-col)
    ├─ div.prod-col-esq
    │   ├─ ComparativoCard
    │   └─ EvolucaoCard
    └─ div.prod-col-dir
        ├─ AnaliseTextualCard
        └─ FrentesCard
```

---

## 7. Lógica e regras

- **Sem `useState`** — tela 100% derivada do BM
- **KPI 1 (HH Real)** tem classe `prod-kpi-real` — destaque visual (geralmente em vermelho)
- **`IndicadorCard`** tem classe `prod-ind-${ind.farol}` — borda/background varia por farol
- **`ComparativoCard`** usa `Cell` com cor fixa por categoria (não usa farol — palette `COMP_COLOR`)
- **ReferenceLine "premissa contratual"** posicionada em `hhContratado` — referência visual de "linha do nada"
- **`ReferenceArea` do Measured Mile** ocupa range BM-X a BM-Y com `fillOpacity: 0.6` — destaca período de referência
- **X-axis tick custom no LineChart**: fontWeight 700 quando `payload.value === bm.numero` — bold no BM corrente
- **`AnaliseTextualCard`** parseia `\n\n` em parágrafos — diferente da maioria das abas (que usa texto inline)
- **`tickFormatter` Y-axis**: `R$ X` (mas omite "/Hh" pra não poluir)
- **Frentes**: sinal `+` explícito no Δ (consistente com Recursos)

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão
- **Para onde os dados vão**:
  - **Indicadores** consome só `bm.blocoProdutividade` (resumo)
  - **M3.4 Valor Agregado** consome perdas + frentes pra cálculo CPU detalhado
  - **M3.5 Total Cost** consome `hhReal × horas` − `hhContratado × horas` como base do método
  - **Aba Curvas Lib×Cap×Aloc** — "Capacidade Produtiva" derivada desses HH (capacidade real da equipe alocada)
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Conceitos fundamentais**:
  - **HH** é a unidade canônica de produtividade — toda comparação se faz em R$/Hh
  - **Measured Mile** é o conceito-chave de pleitos de produtividade: define a baseline ideal pra comparar com período impactado. As 12 semanas do mock são convenção (alguns contratos usam 4, 8, 16)
  - **Distinção crítica**: perda de produtividade ≠ aumento de custo de insumos (aba Insumos). Esta aba foca em **Hh** (tempo de pessoas); insumos foca em **R$/unidade** de material
