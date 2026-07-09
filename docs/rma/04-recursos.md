# Aba: Recursos · MOD/MOI/EQP (RMA · 5.3.3)

> Alocação de **Mão de Obra Direta**, **Indireta** e **Equipamentos**. Tem `Segmented` que troca entre os 3 grupos. KPIs, comparativo mensal (barras), curva acumulada e tabela cruzada (6 linhas). Banner amarelo sinaliza "indício de perda de produtividade" quando recursos > faturamento.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"Estou usando mais recurso do que o contrato previa? Se sim, em qual categoria?"** O cruzamento com `Faturamento` (banner amarelo) sinaliza **perda de produtividade** — base para pleitos de Total Cost e Measured Mile (calculados detalhadamente no M3.4 / M3.5).

---

## 2. Contexto de produto

- **Quando se abre**: tab "Recursos" ou dot vermelho/amarelo de Recursos na RmaTabs
- **Decisão que embasa**:
  - "Tenho equipe demais alocada vs. o previsto?"
  - "É MOD (mão direta), MOI (indireta — engenheiros, mestres) ou EQP (equipamentos)?"
  - "Há indício de perda de produtividade?" (banner amarelo aparece quando real ≫ contratado, mas faturamento não acompanha)
- **Para onde alimenta**:
  - **M3.4 Valor Agregado (CPU)** — cálculo da perda de produtividade
  - **M3.5 Total Cost** — método clássico de quantificação de overrun
  - **Aba Produtividade** (5.3.4) — HH detalhado por frente
- **Conceitos importantes**:
  - **MOD** (Mão de Obra Direta) — Hh de produção: pedreiros, ajudantes, operadores
  - **MOI** (Mão de Obra Indireta) — Hh administrativa: engenheiros, mestres, técnicos, encarregados, segurança do trabalho
  - **EQP** (Equipamentos) — unidades × mês de cada equipamento alocado
  - **Unidade muda por grupo**: MOD/MOI usam `Hh` (Hora-Homem), EQP usa `unid.×mês`
  - **Measured Mile** — período de referência para identificar produtividade "normal" — base de comparação para períodos impactados

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/recursos`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/recursos.tsx`](../../src/routes/_app/contracts/$contractId/rma/recursos.tsx)
- **CSS**: [`recursos.css`](../../src/routes/_app/contracts/$contractId/rma/recursos.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`
- **Estado local**: `useState<RecursosTipo>("MOD")` — controla qual grupo (MOD/MOI/EQP) exibir

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.recursos: RecursosBM`.

```
RecursosBM
├─ porGrupo: Record<"MOD" | "MOI" | "EQP", RecursosGrupo>
│   └─ RecursosGrupo (mesmo shape para os 3 grupos)
│       ├─ label: string                          // "MOD" / "MOI" / "Equipamentos"
│       ├─ unidade: string                        // "Hh" / "Hh" / "unid.×mês"
│       │
│       ├─ 5 KPIs do topo:
│       ├─ contratadoTotalLabel: string           // "138.450 Hh"
│       ├─ contratadoTotalNota: string            // "histograma contratual M1"
│       ├─ previstoAteBmLabel: string             // "78.420 Hh"
│       ├─ previstoAteBmNota: string              // "56,6% até BM-09"
│       ├─ realAlocadoLabel: string               // "92.180 Hh"
│       ├─ realAlocadoNota: string                // "117,5% do previsto"
│       ├─ desvioPct: number                      // +18 → KPI 4 (positivo = acima)
│       ├─ desvioFarol: FarolLevel                // cor do KPI 4
│       ├─ desvioNotaLabel: string                // "+13.760 Hh excedentes"
│       ├─ custoRealLabel: string                 // "R$ 8,4 mi"
│       ├─ custoNotaLabel: string                 // "média R$ 91,1/Hh · M3.4 detalha"
│       │
│       ├─ barrasMensais: RecursosBarraMensal[]   // BarChart Contratada × Alocada
│       │   ├─ bm: string                         // "BM-01"
│       │   ├─ contratado: number                 // valor mensal previsto
│       │   ├─ real: number                       // valor mensal real
│       │   └─ corrente?: boolean                 // marca BM atual (não usado no render atual)
│       ├─ barrasObservacao: string               // texto sob o BarChart (com **negrito**)
│       │
│       ├─ curvaAcumulada: RecursosCurvaAcumulada[]  // LineChart Trajetória
│       │   ├─ bm: string                         // "BM-09"
│       │   ├─ contratado: number                 // acumulado contratual
│       │   └─ real: number                       // acumulado real
│       │
│       ├─ curvaUltimoRealLabel: string           // pill direita do header da curva acumulada
│       └─ curvaUltimoContratadoLabel: string     // pill direita complementar
│
├─ analiseCruzada: string                         // banner amarelo "INDÍCIO DE PERDA DE PRODUTIVIDADE"
│                                                 // (texto com **negrito**)
│
├─ resumoCruzado: RecursosResumoLinha[]           // tabela 6 linhas (MOD/MOI/EQP × Hh/R$)
│   ├─ id: string
│   ├─ grupo: string                              // "MOD · Hh", "MOI · R$", etc.
│   ├─ contratadoLabel: string                    // "138.450 Hh" ou "R$ 16,8 mi"
│   ├─ realLabel: string                          // "92.180 Hh"
│   ├─ desvioPct: number                          // +18.0 → cor + sinal
│   └─ farol: FarolLevel                          // dot na col Grupo + cor do %
├─ resumoObservacao: string                       // box rosa abaixo da tabela (com **negrito**)
│
├─ chatQuote: string                              // (legado — chat removido)
└─ chatSugestoes: Array<{ id, texto }>            // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`
- `Segmented<RecursosTipo>` (switch MOD/MOI/EQP)

### 5.2 Recharts

- `BarChart`, `Bar`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`
- `LineChart`, `Line`, `ReferenceLine`

### 5.3 Componentes locais

| Função               | Props                             | O que renderiza                                                                      |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `RecursosAba`        | (route)                           | Composição — 4 children + grid 2-col                                                 |
| `RecHeader`          | `tipo, onChangeTipo, bm`          | Título + `Segmented` (MOD/MOI/Equipamentos) + botão Exportar                         |
| `RecKpis`            | `grupo, bm, tipo`                 | 5 KpiCards (Contratada Total · Prevista até BM · Real Alocada · Desvio · Custo Real) |
| `RecKpi`             | `label, value, valueColor?, nota` | 1 KPI genérico                                                                       |
| `tipoLabel`          | `t`                               | Helper: "MOD"/"MOI"/"EQP"                                                            |
| `RecAnaliseCruzada`  | `texto`                           | Banner amarelo de aviso                                                              |
| `BarrasMensaisCard`  | `grupo, bm, tipo`                 | BarChart agrupado (Contratada cinza × Alocada vermelha)                              |
| `CurvaAcumuladaCard` | `grupo, bm, tipo`                 | LineChart 2 séries (Previsto/Real) + ReferenceLine "corte"                           |
| `ResumoCruzadoCard`  | `resumo, observacao`              | Tabela ARIA 6 linhas com dot + farol no desvio                                       |
| `FormattedText`      | `text`                            | Parser inline `**bold**`                                                             |

---

## 6. Binding componente ↔ dados

| Componente           | Campos consumidos                                                                                                                                                            | Visualização                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `RecHeader`          | `tipo` (state local), `bm.numero`                                                                                                                                            | Título "Recursos · MOD/MOI/Equipamentos · BM-09" + `<Segmented>` |
| `RecKpis`            | `grupo.contratadoTotal*`, `grupo.previstoAteBm*`, `grupo.realAlocado*`, `grupo.desvio{Pct,Farol,NotaLabel}`, `grupo.custo{Real,Nota}Label`, `bm.numero` (label do KPI 2 e 3) | 5 KPIs — Desvio com cor + dot                                    |
| `RecAnaliseCruzada`  | `recursos.analiseCruzada`                                                                                                                                                    | Aside amarelo com ícone bandeira                                 |
| `BarrasMensaisCard`  | `grupo.barrasMensais[]` (cada item com bm/contratado/real), `grupo.unidade` (tooltip), `grupo.barrasObservacao`                                                              | BarChart agrupado + legenda + observação                         |
| `CurvaAcumuladaCard` | `grupo.curvaAcumulada[]`, `grupo.unidade`, `grupo.curvaUltimoRealLabel`, `grupo.curvaUltimoContratadoLabel`, `bm.numero` (ReferenceLine)                                     | LineChart com pills no header                                    |
| `ResumoCruzadoCard`  | `recursos.resumoCruzado[]`, `recursos.resumoObservacao`                                                                                                                      | Tabela ARIA 4 col + box rosa                                     |

### Layout pai

```
main.rec-main
├─ RecHeader (title + Segmented + Export)
├─ RecKpis (5-col grid)
├─ RecAnaliseCruzada (full-width banner)
└─ div.rec-grid (2-col)
    ├─ div.rec-col-esq
    │   ├─ BarrasMensaisCard
    │   └─ CurvaAcumuladaCard
    └─ div.rec-col-dir
        └─ ResumoCruzadoCard
```

---

## 7. Lógica e regras

- **`useState<RecursosTipo>("MOD")`** — único state. Quando muda, `grupo = recursos.porGrupo[tipo]` muda → todos os KPIs/gráficos recalculam
- **Sinal explícito no desvio**: `${desvioPct >= 0 ? "+" : ""}${desvioPct}%` — diferente do Faturamento (desvio quase sempre negativo)
- **`tipoLabel`** retorna "MOD"/"MOI"/"EQP" (não usa o `grupo.label` que tem "Equipamentos") — convenção: KPI labels usam código curto, header usa nome longo
- **`BarChart` agrupado** (não empilhado) — barras lado-a-lado de Contratada (cinza) e Alocada (vermelha)
- **`CurvaAcumuladaCard` tem `dot={{ r: 3 }}` no Real** — único caso na suíte RMA. Real é destacado com pontos para enfatizar trajetória mensal
- **`ResumoCruzadoCard` mostra 6 linhas fixas** — sempre 3 grupos × 2 unidades (Hh + R$). Independente do `tipo` selecionado no Segmented (visão consolidada)
- **`barrasObservacao` e `resumoObservacao`** vêm formatados com `**bold**` inline

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão
- **Para onde os dados vão**:
  - **Visão Geral** consome `recursos.porGrupo.{MOI,MOD,EQP}.curvaAcumulada` (último ponto de cada) — mini-gráfico horizontal
  - **Indicadores** consome só `bm.blocoRecursos` (resumo)
  - **M3.4 Valor Agregado** consome o cálculo de perda do `analiseCruzada` (banner amarelo aqui é só sinal — quantificação fina lá)
  - **M3.5 Total Cost** consome `custoRealLabel` + `previstoAteBmLabel`
  - **Aba Produtividade (5.3.4)** detalha HH por frente, complementando a visão por grupo desta aba
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Sinal de alerta cross-aba**: `analiseCruzada` é um banner amarelo que aparece quando **recursos > faturamento** (real >> previsto + faturamento abaixo) — sinaliza pra ir investigar Produtividade e M3.4
