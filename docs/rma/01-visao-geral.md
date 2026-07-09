# Aba: Visão Geral (RMA · default)

> O **Geralzão executivo** do BM corrente. É a primeira tela que o usuário vê (redirecionada de `/rma`) — overview pesado em hero numérico, faróis dos blocos, mini-gráficos, síntese do contrato e atalhos para gerar entregáveis.

> Para o contexto compartilhado entre todas as abas (shell, `BmSnapshot` raiz, helpers, padrões), leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Em **1 olhada** o usuário precisa saber: **como meu contrato está agora?** A tela apresenta os 4 indicadores macro (Desequilíbrio, Faturamento, Prazo, Situação), o diagnóstico textual do agente IA do mês, faróis dos 5 blocos principais, gráficos resumidos de cada bloco e um resumo institucional do contrato. Tudo orientado pra responder rápido: "está tudo OK, ou preciso agir?"

É a tela de **abertura do RMA** — propósito é levar o gerente a decidir em que aba mergulhar (Faturamento? Recursos? Prazo?).

---

## 2. Contexto de produto

- **Quando se abre**: sempre que o usuário entra em qualquer URL `/rma` (sem aba especificada — redirect de `index.tsx` força `/rma/visao-geral`)
- **Decisão que embasa**: "Está tudo bem ou preciso mergulhar em alguma aba?"
- **Para onde alimenta**: nada — é tela consumidora. Mas o botão "Ver RMA completo" no hero é o convite pra ir pra `Indicadores e Farol` (visão tática)
- **Sobreposição com Indicadores**: ambas mostram diagnóstico + faróis dos blocos. Diferença: Visão Geral também tem síntese contratual + mini-gráficos + entregáveis; Indicadores aprofunda em curvas Lib×Cap×Aloc, marcos e responsabilidade
- **Regras de negócio**:
  - Cores dos blocos vêm de `FAROL_COLOR` baseado em `BlocoFarol.nivel`
  - Cell "Situação Geral" do hero usa classe condicional `vg-acao-${bm.situacao}` (estilo varia conforme o farol)
  - Hero: se `bm.desequilibrioMesAtual > 0` → mostra `▲ R$ X neste mês`; senão → "sem desequilíbrio acumulado"

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md): "RMA mensal — entregável mais importante do módulo".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/visao-geral` (default — `/rma` redireciona aqui)
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/visao-geral.tsx`](../../src/routes/_app/contracts/$contractId/rma/visao-geral.tsx)
- **CSS**: [`visao-geral.css`](../../src/routes/_app/contracts/$contractId/rma/visao-geral.css)
- **Loader**: padrão RMA (`getContract` + `getVisaoGeral`)
- **Search params**: `?bm=BM-XX` (preservado entre abas)

---

## 4. Modelo de dados — type-by-type completo

Esta aba consome o **`BmSnapshot` inteiro** (raiz) + o envelope `VisaoGeralData`. Não usa só uma sub-aba — usa fragmentos de várias (`faturamento.curvaS`, `recursos.porGrupo`, `prazo.decorridoDias`).

```
BmSnapshot                                        (campos raiz consumidos)
├─ numero: string                                 // "BM-09"
├─ desequilibrioAcumulado: number                 // R$ → hero cell 1
├─ desequilibrioMesAtual: number                  // condicional do sub
├─ desequilibrioPctValor: number                  // sub do hero cell 1
├─ faturamentoPct: number                         // hero cell 2 (valor)
├─ faturamentoContratadoPct: number               // hero cell 2 (sub)
├─ prazoDecorridoDias: number                     // hero cell 3
├─ situacao: FarolLevel                           // classe da cell 4 (vg-acao-X)
├─ situacaoLabel: string                          // texto da cell 4
├─ diagnostico: string                            // DiagnosticoCard (com **negrito**)
│
├─ blocoFaturamento: BlocoFarol                   // BlocoFarolGrid #1
├─ blocoRecursos: BlocoFarol                      // #2
├─ blocoProdutividade: BlocoFarol                 // #3
├─ blocoPrazo: BlocoFarol                         // #4
├─ blocoDesequilibrio: BlocoFarol                 // #5
│   (BlocoFarol = { valor, nivel, descricao, nota })
│
├─ faturamento.curvaS: CurvaSPonto[]              // MiniFaturamentoChart (mas só "contratado" + "real")
│   ├─ bm: string                                 // "BM-09"
│   ├─ contratado: number                         // R$ mi acumulado
│   ├─ real: number | null                        // null em BMs futuros
│   └─ projecao: number | null                    // ignorado nesta tela
├─ faturamento.desvioAcumuladoPct: number         // foot do mini-gráfico ("GAP X%")
│
├─ recursos.porGrupo: Record<"MOD"|"MOI"|"EQP", RecursosGrupo>
│   └─ .curvaAcumulada: RecursosCurvaAcumulada[]  // pega o ÚLTIMO ponto de cada grupo
│       ├─ bm: string
│       ├─ contratado: number                     // Hh acumulado
│       └─ real: number
│
├─ prazo.decorridoDias: number                    // MiniPrazoChart (pieslice)
├─ prazo.restantesDias: number                    // pieslice complementar
├─ prazo.decorridoPct: number                     // centro do donut
├─ prazo.prazoContratualDias: number              // sub do header do mini-gráfico
│
├─ ultimosEventos: EventoIA[]                     // UltimosEventosCard
│   ├─ id: string
│   ├─ nivel: FarolLevel                          // cor da pill (vg-evento-X)
│   ├─ titulo: string
│   └─ meta: string                               // "há 4h · Agente de Medição"
└─ (campos não consumidos aqui: blocoInsumos, todos os sub-types das 9 abas detalhadas
    além de faturamento/recursos/prazo, blocosContagem, aderencia, etc.)

VisaoGeralData                                    (envelope)
├─ prazoTotalDias: number                         // hero cell 3 (denominador)
├─ terminoPrevistoISO: string                     // hero cell 3 (sub)
├─ sinteseResumida: SinteseResumida               // SinteseResumidaCard (12 linhas)
│   ├─ cliente: string
│   ├─ modalidade: string
│   ├─ valorContratado: string                    // "R$ 70.664.981"
│   ├─ saldoFaturar: string                       // "R$ 26.553.180"
│   ├─ assinaturaISO: string                      // formatado fmtDate
│   ├─ terminoPrevistoISO: string
│   ├─ prazoLabel: string                         // "184 / 540 dias (34%)"
│   ├─ reajuste: string                           // "IPCA · anual"
│   ├─ gestorObra: string
│   ├─ admContratual: string
│   ├─ documentosIndexados: number                // sufixo "itens"
│   └─ tacsEmNegociacao: number                   // condicional → "N em negociação" / "nenhum em negociação"
│
└─ entregaveis: EntregavelAtalho[]                // EntregaveisCard (lista clicável)
    ├─ id: string
    ├─ label: string                              // "RMA · BM-09"
    ├─ acao: string                               // "Gerar" / "Atualizar"
    ├─ descricao: string                          // "consolidado mensal"
    └─ icon: "doc"|"note"|"tag"|"check"|"calendar"|"users"
```

---

## 5. Componentes

### 5.1 DS importado

- `I`, `type IconName` — de `@/components/ds` (ícones)

### 5.2 Recharts

- `LineChart`, `Line` — mini-gráfico de Faturamento (Curva S sem projeção)
- `BarChart`, `Bar` — mini-gráfico de Recursos (horizontal MOI/MOD/EQP)
- `PieChart`, `Pie`, `Cell` — donut do Prazo
- `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` (padrão)

### 5.3 Componentes locais

| Função                 | Props          | O que renderiza                                                                                                   |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `VisaoGeralAba`        | (route loader) | Composição principal — 7 children                                                                                 |
| `HeroStrip`            | `visao, bm`    | 4 cells horizontais: Desequilíbrio, Faturamento, Prazo Decorrido, Situação Geral                                  |
| `DiagnosticoCard`      | `bm`           | Tag "DIAGNÓSTICO · BM-XX" + parágrafo com `FormattedText`                                                         |
| `FormattedText`        | `text`         | Helper que parseia `**bold**` markdown inline → `<strong>`                                                        |
| `BlocoFarolGrid`       | `bm`           | 5 cards (Faturamento, Recursos, Produtividade, Prazo, Desequilíbrio) com ícone + nível + valor + descrição + nota |
| `BlocoGraficosGrid`    | `bm`           | Grid 5-col com 3 mini-charts + 2 slots vazios (alinha visualmente com 5 cards)                                    |
| `MiniFaturamentoChart` | `bm`           | LineChart 2 séries (contratado/real) + foot pill `GAP X%`                                                         |
| `MiniRecursosChart`    | `bm`           | BarChart horizontal (MOI/MOD/EQP) contratado vs real                                                              |
| `MiniPrazoChart`       | `bm`           | PieChart donut decorrido vs restante, % no centro                                                                 |
| `SinteseResumidaCard`  | `sintese`      | `<dl>` com 12 linhas (cliente, modalidade, valor, ...)                                                            |
| `SinteseRow`           | `label, value` | 1 par `<dt>/<dd>`                                                                                                 |
| `UltimosEventosCard`   | `eventos, bm`  | Lista de pills coloridos por farol (`vg-evento-<nivel>`)                                                          |
| `EntregaveisCard`      | `entregaveis`  | Lista de atalhos clicáveis para gerar/atualizar entregáveis                                                       |

---

## 6. Binding componente ↔ dados

| Componente                         | Campos consumidos                                                                                           | Visualização                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `HeroStrip` cell 1 (Desequilíbrio) | `bm.desequilibrioAcumulado`, `bm.desequilibrioMesAtual`, `bm.desequilibrioPctValor`                         | Valor BRL + sub condicional                 |
| `HeroStrip` cell 2 (Faturamento)   | `bm.faturamentoPct`, `bm.faturamentoContratadoPct`, `bm.numero`                                             | % + "contratado: X% no BM-09"               |
| `HeroStrip` cell 3 (Prazo)         | `bm.prazoDecorridoDias`, `visao.prazoTotalDias`, `visao.terminoPrevistoISO`                                 | "184 / 540 d" + term. previsto              |
| `HeroStrip` cell 4 (Situação)      | `bm.situacao` (classe), `bm.situacaoLabel`                                                                  | Card colorido + botão "Ver RMA completo"    |
| `DiagnosticoCard`                  | `bm.diagnostico`, `bm.numero`                                                                               | Tag + texto formatado (negrito)             |
| `BlocoFarolGrid`                   | 5x `bm.bloco<X>`                                                                                            | 5 cards: ícone+nível+título+valor+desc+nota |
| `MiniFaturamentoChart`             | `bm.faturamento.curvaS[]`, `bm.faturamento.desvioAcumuladoPct`                                              | LineChart 2 linhas + foot pills             |
| `MiniRecursosChart`                | `bm.recursos.porGrupo.{MOI,MOD,EQP}.curvaAcumulada` (último ponto de cada)                                  | BarChart horizontal                         |
| `MiniPrazoChart`                   | `bm.prazo.decorridoDias`, `bm.prazo.restantesDias`, `bm.prazo.decorridoPct`, `bm.prazo.prazoContratualDias` | PieChart donut + % central                  |
| `SinteseResumidaCard`              | `visao.sinteseResumida` (12 campos)                                                                         | `<dl>` em 2 colunas                         |
| `UltimosEventosCard`               | `bm.ultimosEventos[]`, `bm.numero`                                                                          | Lista de cards coloridos                    |
| `EntregaveisCard`                  | `visao.entregaveis[]`                                                                                       | Lista clicável de atalhos                   |

---

## 7. Lógica e regras

- **Sem `useState`** — tela 100% derivada do BM (controlada via URL `?bm=`)
- **Condicional do hero cell 1**:
  ```ts
  bm.desequilibrioMesAtual > 0
    ? `▲ ${formatBRL(...)} neste mês · ${pct}% do valor contratual`
    : "sem desequilíbrio acumulado até a data"
  ```
- **Cell "Situação Geral"** recebe classe `vg-acao-${bm.situacao}` — estilo CSS diferente para `critico|risco|observacao|conforme`
- **`MiniFaturamentoChart`** filtra propositalmente a projeção (só `contratado` + `real`) pra não poluir o mini
- **`MiniRecursosChart`** pega apenas o **último ponto** de cada grupo `curvaAcumulada` (snapshot no BM atual)
- **`MiniPrazoChart`** usa `Math.max(p.restantesDias, 0)` — evita slice negativa quando o prazo já estourou
- **`MiniRecursosChart`** itera explicitamente em `["MOI", "MOD", "EQP"]` (ordem fixa, diferente da ordem natural do alfabeto)
- **`FormattedText`** parseia inline markdown `**texto**` (split por regex `/(\*\*[^*]+\*\*)/g`) — sem dependência externa
- **`EVENTO_TONE`** mapeia FarolLevel → classe CSS (`vg-evento-critico`, etc.)
- **`BLOCO_ICONS`** mapeia key string → IconName: faturamento=wallet, recursos=users, produtividade=trending, prazo=clock, desequilibrio=trending

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**:
  - Loader carrega `getVisaoGeral(contractId)` (mesma origem de todas as abas RMA)
  - `bm = getBm(visao, search.bm)` resolve o BM ativo
  - Reusa fragmentos de 3 outras abas:
    - `bm.faturamento.*` → mini-gráfico (detalhe completo em [03-faturamento.md](03-faturamento.md))
    - `bm.recursos.*` → mini-gráfico (detalhe em [04-recursos.md](04-recursos.md))
    - `bm.prazo.*` → mini-donut (detalhe em [06-prazo.md](06-prazo.md))
- **Para onde os dados vão**: nada — tela só consome
- **Helpers usados**: `getContract` (de `contracts`), `getVisaoGeral`, `getBm` (de `obras`)
- **Relação com Indicadores e Farol**: sobreposição parcial — mesma origem de dados mas Indicadores aprofunda em curvas/marcos/responsabilidade; Visão Geral fica mais leve e inclui síntese contratual + entregáveis
- **Convite navegacional**: botão "Ver RMA completo" na cell 4 do hero → leva pra `Indicadores e Farol` (visão tática)
