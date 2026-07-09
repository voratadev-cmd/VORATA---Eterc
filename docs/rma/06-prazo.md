# Aba: Prazo e Cronograma (RMA · 5.3.5)

> Donut decorrido × restante · 4 KPIs (Prazo Contratual, Decorrido, Tendência, Prorrogação Estimada) · curva de avanço físico contratado × real com marcadores e projeção · marcos contratuais · **Windows Analysis** (caminho crítico).

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"Vou estourar o prazo? Se sim, em quantos dias e por quê?"** Aba consolida o cronograma físico e identifica eventos específicos (janelas BM-a-BM) que impactaram o término — pilar do **Windows Analysis**, método clássico de pleito de prorrogação.

Quando `prorrogacaoDias > 0` é gatilho automático para **pleito de prorrogação contratual** (M5/M3.10).

---

## 2. Contexto de produto

- **Quando se abre**: tab "Prazo" — geralmente após perceber atraso em `Faturamento` (Curva S abaixo)
- **Decisão que embasa**:
  - "Os marcos contratuais estão sendo cumpridos?"
  - "Em qual janela BM-a-BM aconteceu o atraso?"
  - "De quem é a responsabilidade dos eventos do caminho crítico?"
- **Para onde alimenta**:
  - **M5 Finalização** — pleito formal de prorrogação
  - **M3.10 Gerador de Claim** — `windowsTotalDias` vira `prazoLabel` do pleito
  - **Aba Responsabilidade** — cruzamento dos `WindowsEvento.responsavel`
- **Conceitos importantes**:
  - **Windows Analysis** — método **AACE 52R-06**. Análise janela-a-janela do caminho crítico, atribuindo dias de atraso a eventos específicos com responsável conhecido
  - **Caminho crítico** — sequência de atividades cuja soma de durações define o prazo total. Atrasos nele = atrasos no contrato
  - **Marco contratual** — entrega intermediária com data prevista (M1, M2, M3, ...)
  - **Atraso físico em pp** (pontos percentuais) — diferença entre avanço previsto (%) e real (%) na data de corte
  - **Risco de novo atraso** — projeção qualitativa baseada em eventos correntes (não-resolvidos)

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.5: "Prazo decorrido × prazo restante (gauge donut) · Curva de avanço físico contratado × real · Marcos contratuais com status (cumprido/atraso/risco) · Windows Analysis — caminho crítico".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/prazo`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/prazo.tsx`](../../src/routes/_app/contracts/$contractId/rma/prazo.tsx)
- **CSS**: [`prazo.css`](../../src/routes/_app/contracts/$contractId/rma/prazo.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.prazo: PrazoBM`.

```
PrazoBM
├─ 4 KPIs do topo (KpisHero):
│   ├─ prazoContratualDias: number                // 540
│   ├─ inicioISO: string                          // "2024-11-15"
│   ├─ fimContratualISO: string                   // "2026-05-08"
│   ├─ decorridoDias: number                      // 184
│   ├─ decorridoPct: number                       // 34.0
│   ├─ restantesDias: number                      // 356
│   ├─ tendenciaTerminoISO: string                // "2027-02-03" (projeção atual)
│   ├─ tendenciaFarol: FarolLevel                 // cor do KPI 3
│   ├─ tendenciaNota: string                      // "+87d vs. contratual"
│   ├─ prorrogacaoDias: number                    // +87 (positivo = atraso projetado)
│   ├─ prorrogacaoFarol: FarolLevel               // cor do KPI 4
│   └─ prorrogacaoNota: string                    // inclui ★★★★★ — força do mérito
│
├─ Donut + indicadores (DonutCard, esquerda):
│   ├─ avancoFisicoRealPct: number                // 24.7 (%)
│   ├─ avancoFisicoRealNota: string               // "estimativa preliminar"
│   ├─ avancoFisicoPrevistoPct: number            // 38.5 (%)
│   ├─ avancoFisicoPrevistoNota: string           // "Curva S contratual"
│   ├─ atrasoFisicoPp: number                     // -13.8 (pontos percentuais)
│   ├─ riscoNovoAtrasoLabel: string               // "ALTO" / "MÉDIO" / "BAIXO"
│   ├─ riscoNovoAtrasoFarol: FarolLevel
│   ├─ riscoNovoAtrasoNota: string                // "3 eventos correntes não resolvidos"
│   └─ totalDiasProjecao: number                  // 627 (decorrido + restante + prorrogação)
│
├─ Curva de avanço físico (CurvaCard, full-width):
│   ├─ curva: AvancoFisicoPonto[]                 // série temporal por dia
│   │   ├─ dia: number                            // dia decorrido desde início
│   │   ├─ contratado: number                     // % acumulado contratado
│   │   ├─ real: number | null                    // % real (null em dias futuros)
│   │   └─ projecao: number | null                // tracejada a partir do BM corrente
│   └─ curvaMarcadores: Array<{                   // ReferenceLines verticais
│       dia: number,
│       label: string,                            // "BM-09", "prazo contratual", "tendência"
│       cor: "brand" | "danger" | "neutro"        // mapeada pra CSS var
│     }>
│
├─ Marcos contratuais (MarcosCard):
│   ├─ marcosCronograma: MarcoCronograma[]
│   │   ├─ id: string
│   │   ├─ titulo: string                         // "M3 · Conclusão da estrutura"
│   │   ├─ descricao: string                      // "previsto: mês 6 · 92% executado · risco no BM-10"
│   │   ├─ statusLabel: string                    // "CUMPRIDO" / "EM RISCO" / "+87 dias"
│   │   └─ statusFarol: FarolLevel
│   └─ marcosResumo: string                       // sub do header
│
├─ Windows Analysis (WindowsCard):
│   ├─ windowsEventos: WindowsEvento[]            // pode ser vazio → mostra empty state
│   │   ├─ id: string
│   │   ├─ janela: string                         // "BM-04 → BM-05"
│   │   ├─ evento: string                         // descrição do evento
│   │   ├─ deltaDias: number                      // sempre positivo (adiciona tempo)
│   │   └─ responsavel: "Contratante"|"Contratada"|"Compartilhado"|"Força maior"
│   ├─ windowsTotalDias: number                   // soma dos deltaDias
│   └─ windowsObservacao: string                  // texto da caixa rosa (com **negrito**)
│
└─ chatQuote: string                              // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

- `LineChart`, `Line`, `ReferenceLine`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`
- **Donut feito em SVG inline** (não usa PieChart) — `<circle>` com `strokeDasharray`

### 5.3 Componentes locais

| Função                   | Props                   | O que renderiza                                                     |
| ------------------------ | ----------------------- | ------------------------------------------------------------------- |
| `PrazoAba`               | (route)                 | Composição — 5 children + grid-top 2-col                            |
| `PrazoHeader`            | `bm`                    | Título + sub                                                        |
| `KpisHero`               | `prazo`                 | 4 KpiCards (Prazo Contratual · Decorrido · Tendência · Prorrogação) |
| `DonutCard`              | `prazo`                 | Donut SVG + lista 4 indicadores                                     |
| `Donut`                  | `pct, decorrido, total` | SVG donut com gradiente animado                                     |
| `CurvaCard`              | `prazo, bm`             | LineChart 3 séries + N marcadores + nota                            |
| `MarcosCard`             | `prazo`                 | `<ul>` de marcos com pill colorida                                  |
| `MarcoLinha`             | `marco`                 | 1 `<li>` por marco                                                  |
| `WindowsCard`            | `prazo`                 | Tabela ARIA ou empty state                                          |
| `WindowsLinha`           | `evento`                | 1 linha da tabela com responsavel colorido                          |
| `formatBRDate`, `fmtPct` | utilitários             | Formatação                                                          |
| `FormattedText`          | `text`                  | Parser inline `**bold**`                                            |

### Constantes

- `FAROL_COLOR` (padrão)
- `RESP_COLOR`: Contratante=danger, Contratada=warning, Compartilhado=info, "Força maior"=text-3 — usado na coluna `responsavel` do Windows

---

## 6. Binding componente ↔ dados

| Componente        | Campos consumidos                                                                                                                                 | Visualização                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `KpisHero` cell 1 | `prazo.prazoContratualDias`, `prazo.inicioISO`, `prazo.fimContratualISO`                                                                          | "540 dias" + "início DD/MM/YYYY · fim DD/MM/YYYY"   |
| `KpisHero` cell 2 | `prazo.decorridoDias`, `prazo.decorridoPct`, `prazo.restantesDias`                                                                                | "184 dias" + "34.0% · restam 356 dias"              |
| `KpisHero` cell 3 | `prazo.tendenciaTerminoISO`, `prazo.tendenciaFarol`, `prazo.tendenciaNota`                                                                        | Data formatada colorida + sub                       |
| `KpisHero` cell 4 | `prazo.prorrogacaoDias`, `prazo.prorrogacaoFarol`, `prazo.prorrogacaoNota`                                                                        | "+87 dias" colorido + sub com estrelas              |
| `Donut`           | `prazo.decorridoPct`, `prazo.decorridoDias`, `prazo.prazoContratualDias`                                                                          | SVG circular 160×160 com % central e fração         |
| `DonutCard` lista | `prazo.avancoFisico{Real,Previsto}Pct/Nota`, `prazo.atrasoFisicoPp`, `prazo.riscoNovoAtrasoLabel/Farol/Nota`                                      | 4 linhas com barra colorida + texto                 |
| `CurvaCard`       | `prazo.curva[]` (3 séries), `prazo.curvaMarcadores[]`, `prazo.decorridoDias`, `prazo.prazoContratualDias`, `prazo.totalDiasProjecao`, `bm.numero` | LineChart com ticks customizados e N ReferenceLines |
| `MarcosCard`      | `prazo.marcosCronograma[]`, `prazo.marcosResumo`                                                                                                  | Lista de cards com pill `statusLabel`               |
| `WindowsCard`     | `prazo.windowsEventos[]`, `prazo.windowsTotalDias`, `prazo.windowsObservacao`                                                                     | Tabela 4 cols ou empty state se 0 eventos           |

### Layout pai

```
main.prz-main
├─ PrazoHeader
├─ KpisHero (4-col)
├─ div.prz-grid-top (2-col)
│   ├─ DonutCard
│   └─ MarcosCard
├─ CurvaCard (full-width)
└─ WindowsCard (full-width)
```

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do BM
- **Donut feito em SVG manual** — `2 × π × r` (r=60) calcula circunference, `dash = (pct/100) × C`. Rotação `-90deg` pra começar do topo
- **`Donut` é arredondado** (`strokeLinecap="round"`) — sutileza visual
- **`CurvaCard`** usa **5 ticks customizados** no X-axis: `[0, decorrido, contrato×0.65, contratual, projeção]` — mostra marcos importantes do timeline
- **`curvaMarcadores`** mapeia `cor: "brand" | "danger" | "neutro"` → CSS var: brand→brand, danger→danger, neutro→text-3. Aplicado tanto na stroke quanto no label
- **`Real` da curva tem `dot={{ r: 3 }}`** e `connectNulls={false}` — para no último BM. **Projeção** tem `connectNulls={true}` — desenha contínua a partir do corte
- **`WindowsCard` tem branch `windowsEventos.length === 0`** — empty state mostra só a observação (sem tabela)
- **`prorrogacaoDias > 0 ? "+" : ""`** — sinal positivo explícito (negativos seriam atraso, mas o mock só tem positivos)

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão
- **Para onde os dados vão**:
  - **Visão Geral** consome `prazo.{decorridoDias, restantesDias, decorridoPct, prazoContratualDias}` (mini-donut)
  - **Indicadores** consome `bm.blocoPrazo` (resumo) + `bm.marcos` (versão resumida dos `marcosCronograma`)
  - **M3.10 Gerador de Claim** consome `windowsTotalDias` como `prazoLabel`
  - **M5 Finalização · Pleitos** usa Windows Analysis como base do pleito de prorrogação contratual
  - **Aba Responsabilidade** cruza com `WindowsEvento.responsavel` (qual lado causou cada janela de atraso)
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Fonte/método**: **Windows Analysis** segue **AACE 52R-06**. É o método mais aceito juridicamente para pleitos de prorrogação porque atribui dias específicos a eventos específicos com fundamentação documental
