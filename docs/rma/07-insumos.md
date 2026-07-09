# Aba: Insumos (RMA · 5.3.6)

> Variação de preço de **insumos relevantes** vs. **índice contratual de reajuste**. KPIs (insumos monitorados, índice contratual, desvio médio ponderado, desequilíbrio paramétrico), gráfico de evolução de 5 índices (IPCA, INCC, SINAPI, cimento, aço), tabela detalhada e fórmula paramétrica sugerida.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"Os preços dos insumos relevantes subiram mais do que o índice de reajuste do contrato? Quanto isso vale em R$?"** Quando o real superou o reajuste contratual, há **desequilíbrio paramétrico** — quantificação fina detalhada no **M3.7 Análise de Preço de Insumos**.

A aba é diagnóstica/visual — fórmula paramétrica sugerida vira input pro pleito.

---

## 2. Contexto de produto

- **Quando se abre**: tab "Insumos" — geralmente quando o dot está amarelo/vermelho (sinaliza desequilíbrio paramétrico relevante)
- **Decisão que embasa**:
  - "Quais insumos relevantes do orçamento subiram mais do que o índice contratual?"
  - "Vale a pena pleitear reequilíbrio paramétrico? Qual fórmula usar?"
- **Para onde alimenta**:
  - **M3.7 Análise de Preço de Insumos** — cálculo fino do desequilíbrio
  - **M3.10 Gerador de Claim** — fórmula paramétrica vira anexo do pleito
- **Conceitos importantes**:
  - **Índice contratual** — geralmente **IPCA** (anual). Algumas obras usam INCC, IGP-M ou índice setorial específico
  - **Índices alternativos**:
    - **INCC** — Índice Nacional da Construção Civil (FGV)
    - **SINAPI** — Sistema Nacional de Pesquisa de Custos da Construção (Caixa/IBGE)
    - **Insumos específicos** — cimento, aço CA-50, etc. (índices setoriais)
  - **Base 100 = assinatura** — todos os índices normalizados pra mesma base na data de assinatura. Quem subiu mais, está mais alto
  - **Desvio em pp** (pontos percentuais) — diferença entre índice real e contratual
  - **Desequilíbrio paramétrico** — R$ que a Contratada gastou a mais por insumos terem subido acima do reajuste

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.6: "Variação de preços de insumos relevantes · Gráficos comparativos: índice contratual vs. índices reais (INCC, SINAPI, setoriais) · Cálculo do desequilíbrio decorrente → M3.7".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/insumos`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/insumos.tsx`](../../src/routes/_app/contracts/$contractId/rma/insumos.tsx)
- **CSS**: [`insumos.css`](../../src/routes/_app/contracts/$contractId/rma/insumos.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.insumos: InsumosBM`. Também depende de `bm.prazo.inicioISO` (data base da assinatura).

```
InsumosBM
├─ 4 KPIs do topo:
│   ├─ insumosMonitorados: number                 // 18
│   ├─ insumosMonitoradosNota: string             // "82% do valor do orçamento"
│   ├─ indiceContratualLabel: string              // "IPCA"
│   ├─ indiceContratualNota: string               // "reajuste anual · próximo: nov/2025"
│   ├─ desvioMedioPp: number                      // +4.2 (pontos percentuais)
│   ├─ desvioMedioFarol: FarolLevel
│   ├─ desvioMedioNota: string                    // "ponderado por valor"
│   ├─ desequilibrioParametricoLabel: string      // "R$ 1,68 mi"
│   ├─ desequilibrioFarol: FarolLevel
│   └─ desequilibrioNota: string                  // "preliminar · ver M3.7"
│
├─ Gráfico de evolução dos índices (EvolucaoCard):
│   ├─ evolucaoIndices: IndicePonto[]             // série temporal base 100
│   │   ├─ periodo: string                        // "mai/25", "jul/25", ...
│   │   ├─ ipca: number                           // 100.0 → 104.3 (cresce)
│   │   ├─ incc: number
│   │   ├─ sinapi: number
│   │   ├─ cimento: number
│   │   └─ aco: number
│   ├─ variacaoFinal: {                           // labels finais à direita do gráfico
│   │     ipca: number,                           // +4.3 (%)
│   │     incc: number,
│   │     sinapi: number,
│   │     cimento: number,
│   │     aco: number
│   │   }
│   ├─ evolucaoBmLabel: string                    // "BM09" — exibido no canto
│   └─ gapTexto: string                           // banner amarelo abaixo do gráfico (com **negrito**)
│
├─ Tabela de insumos (InsumosTabelaCard):
│   ├─ insumosRelevantes: InsumoLinha[]           // tabela detalhada
│   │   ├─ id: string
│   │   ├─ insumo: string                         // "Cimento CP-II Z-32"
│   │   ├─ unidade: string                        // "kg", "m³", "L"
│   │   ├─ qtdeComprada: string                   // "245.000" (já formatado)
│   │   ├─ precoOrcadoLabel: string               // "R$ 0,52/kg" — orçado + IPCA contratual
│   │   ├─ precoRealLabel: string                 // "R$ 0,68/kg" — médio efetivo pago
│   │   ├─ variacaoPct: number                    // +30.8 (positivo = mais caro)
│   │   ├─ deltaRsLabel: string                   // "R$ +392k" — impacto financeiro
│   │   └─ farol: FarolLevel
│   └─ desequilibrioAcumuladoLabel: string        // footer da tabela: "R$ 1,68 mi (preliminar)"
│
├─ Análise textual (AnaliseCard):
│   └─ analiseTextual: string                     // longo IA · parágrafos por \n\n + **negrito**
│
├─ Fórmula paramétrica (FormulaCard):
│   ├─ formulaTexto: string                       // exibido em `<pre>` (multilinha)
│   └─ formulaNota: string                        // sub
│
└─ chatQuote: string                              // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

- `LineChart`, `Line`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`

### 5.3 Componentes locais

| Função                          | Props        | O que renderiza                                                   |
| ------------------------------- | ------------ | ----------------------------------------------------------------- |
| `InsumosAba`                    | (route)      | Composição — 4 children + grid 2-col                              |
| `InsHeader`                     | `bm`         | Título + sub explicando que quantificação mora no M3              |
| `KpisHero`                      | `ins`        | 4 KpiCards (Insumos · Índice · Desvio · Desequilíbrio)            |
| `EvolucaoCard`                  | `ins, bm`    | LineChart 5 séries + legenda à esquerda + labels finais à direita |
| `FinalLabel`                    | `pct, color` | Label final à direita do gráfico (% colorido por índice)          |
| `InsumosTabelaCard`             | `ins`        | Tabela ARIA 8 cols + footer "desequilíbrio acumulado"             |
| `InsLinha`                      | `linha`      | 1 linha de insumo                                                 |
| `AnaliseCard`                   | `texto`      | Card com tag + parágrafos (split `\n\n`)                          |
| `FormulaCard`                   | `ins`        | `<pre>` da fórmula + nota                                         |
| `formatBRDate`, `FormattedText` | utilitários  | Helpers                                                           |

### Constantes

- `FAROL_COLOR` (padrão)
- `INDICE_COLOR`: ipca=ink, incc=#2a5fb8 (azul), sinapi=#1e6f4f (verde), cimento=danger (vermelho), aco=#e8a317 (amarelo)

---

## 6. Binding componente ↔ dados

| Componente                     | Campos consumidos                                                                                                                             | Visualização                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `KpisHero`                     | `ins.{insumosMonitorados, indiceContratualLabel, desvioMedioPp, desvioMedioFarol, desequilibrioParametricoLabel, desequilibrioFarol}` + notas | 4 KPIs · KPIs 3 e 4 com cor por farol e classe `ins-kpi-${farol}`                                           |
| `EvolucaoCard` (gráfico)       | `ins.evolucaoIndices[]` (5 séries), `ins.indiceContratualLabel` (legenda)                                                                     | LineChart 320px com 5 linhas coloridas (cimento e aço tendem a estourar) · Y domain calculado dinamicamente |
| `EvolucaoCard` (labels finais) | `ins.variacaoFinal.{ipca, incc, sinapi, cimento, aco}`, `ins.evolucaoBmLabel`                                                                 | Stack vertical de % coloridos à direita                                                                     |
| `EvolucaoCard` (banner)        | `ins.gapTexto`                                                                                                                                | Aside amarelo abaixo do gráfico                                                                             |
| `InsumosTabelaCard`            | `ins.insumosRelevantes[]`, `ins.desequilibrioAcumuladoLabel`, `ins.indiceContratualLabel` (no cabeçalho da col)                               | Tabela 8 cols + linha footer                                                                                |
| `AnaliseCard`                  | `ins.analiseTextual`                                                                                                                          | Card com tag + N parágrafos                                                                                 |
| `FormulaCard`                  | `ins.formulaTexto`, `ins.formulaNota`                                                                                                         | `<pre>` da fórmula                                                                                          |

### Layout pai

```
main.ins-main
├─ InsHeader
├─ KpisHero (4-col)
├─ EvolucaoCard (full-width — chart + labels + banner)
└─ div.ins-grid (2-col)
    ├─ InsumosTabelaCard
    └─ div.ins-col-dir
        ├─ AnaliseCard
        └─ FormulaCard
```

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do BM
- **Y domain dinâmico**: `[98, Math.ceil(max(cimento, aco) / 5) * 5]` — escala se adapta à máxima dos insumos voláteis
- **Ordem das séries no LineChart é importante** — cimento e aço são plotados **primeiro** (camada de baixo). IPCA por último (vence visualmente) — destaca o "referencial contratual"
- **`FinalLabel` é renderizado fora do `ResponsiveContainer`** — labels customizadas posicionadas à direita do gráfico (fora do canvas Recharts)
- **`AnaliseCard`** parseia `\n\n` em parágrafos (como Produtividade)
- **`FormulaCard` usa `<pre>`** — preserva quebras de linha da fórmula matemática
- **Sinal `+` explícito** na variação % (positivos = preço subiu)
- **`indiceContratualLabel` aparece em 3 lugares**: KPI 2, legenda do gráfico, header da col "Preço orçado" da tabela. Coerência total

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão. Lê `bm.prazo.inicioISO` para mostrar "base 100 = assinatura (DD/MM/YYYY)" no header do EvolucaoCard
- **Para onde os dados vão**:
  - **Indicadores** consome só `bm.blocoInsumos` (resumo)
  - **M3.7 Análise de Preço de Insumos** consome `insumosRelevantes` + `variacaoFinal` para quantificação fina
  - **M3.10 Gerador de Claim** usa `formulaTexto` como fórmula paramétrica do pleito
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Não tem dependência cruzada** — única aba relativamente "isolada" (não cruza com Faturamento/Recursos/Prazo)
