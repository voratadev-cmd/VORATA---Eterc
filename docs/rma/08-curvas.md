# Aba: Curvas Liberação × Capacidade Produtiva × Alocado (RMA · 5.3.7)

> **Análise diferencial** — 3 curvas sobrepostas + banda amarela do gap (potencial produtivo não realizado). Identifica se o gargalo é da **Contratante** (Liberação baixa) ou da **Contratada** (Capacidade baixa). Frentes detalhadas + documentos de sustentação para o pleito.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"De quem é a culpa do baixo avanço da obra?"** O método das 3 curvas é o **mais elegante para identificar tipo de gargalo** em obra de empreitada:

- **Liberação baixa** + Capacidade alta → Contratante não entrega frentes (projetos atrasados, áreas não desimpedidas)
- **Capacidade baixa** + Liberação alta → Contratada não consegue executar (problema interno: produtividade, recursos, gestão)
- **Ambas baixas** → cenário ambíguo, requer análise complementar
- **Alocado < Capacidade** → time não está sendo bem aproveitado (problema gerencial)

Quando há **gap visível** (Capacidade > Liberação), há **ociosidade indireta** — base do pleito M3.8.

---

## 2. Contexto de produto

- **Quando se abre**: tab "Curvas" — após perceber atraso em Faturamento ou Prazo, pra diagnosticar a **origem**
- **Decisão que embasa**: classificação **definitiva** do gargalo. Tudo que vem depois (Responsabilidade, Panorama, pleitos) parte daqui
- **Para onde alimenta**:
  - **Aba Responsabilidade** — confirma classificação dos eventos por responsável
  - **M3.8 Análises Pontuais · Ociosidade Indireta** — quantificação do gap × custo MOI
  - **M3.10 Gerador de Claim** — diagnóstico textual aqui vira fundamentação do pleito
- **Conceitos importantes**:
  - **Liberação** — % do escopo que está **pronto pra ser executado** (projeto recebido + frente desimpedida pela Contratante + licença OK)
  - **Capacidade Produtiva** — % do escopo que a **equipe alocada conseguiria produzir** com produtividade real (a equipe é grande/pequena/eficiente o bastante?)
  - **Alocado** — % do escopo que está **efetivamente em execução**
  - Sequência lógica: `min(Liberação, Capacidade) ≥ Alocado` — não consigo executar mais do que está liberado ou do que minha equipe aguenta
  - **Gap = Capacidade − Liberação** (positivo) → potencial produtivo da equipe **não realizado** por falta de liberação. **Ociosidade indireta**: a equipe está parada esperando frente

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.7: "Liberação — o que está liberado · Capacidade Produtiva — o que a equipe alocada consegue produzir · Alocado — o que está sendo efetivamente executado. **Diagnóstico**: se Liberação abaixo das outras → gargalo na **Contratante** (projetos atrasados). Se Capacidade abaixo → problema interno de produtividade".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/curvas`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/curvas.tsx`](../../src/routes/_app/contracts/$contractId/rma/curvas.tsx)
- **CSS**: [`curvas.css`](../../src/routes/_app/contracts/$contractId/rma/curvas.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.curvasAnalise: CurvasAnaliseBM`.

```
CurvasAnaliseBM
├─ 3 KPIs do topo (KpisHero):
│   ├─ liberacaoPct: number                       // 62 → KPI 1
│   ├─ liberacaoNota: string                      // "projetos executivos pendentes em 3 frentes"
│   ├─ liberacaoFarol: FarolLevel
│   ├─ capacidadePct: number                      // 78 → KPI 2
│   ├─ capacidadeNota: string
│   ├─ capacidadeFarol: FarolLevel
│   ├─ alocadoPct: number                         // 58 → KPI 3
│   ├─ alocadoNota: string
│   └─ alocadoFarol: FarolLevel
│
├─ Diagnóstico (banner colorido pelo tipo):
│   ├─ gargaloTipo: "contratante"|"contratada"|"compartilhado"|"ok"
│   ├─ diagnosticoTitulo: string                  // "GARGALO IDENTIFICADO NA CONTRATANTE"
│   ├─ diagnosticoTexto: string                   // longo · com **negrito**
│   └─ hipoteseAlternativa?: string               // opcional · "Hipótese alternativa descartada: ..."
│
├─ Evolução BM a BM (EvolucaoCard):
│   └─ evolucao: CurvasEvolucaoPonto[]            // série temporal das 3 curvas
│       ├─ bm: string                             // "BM-09"
│       ├─ liberacao: number                      // % acumulado
│       ├─ capacidade: number
│       └─ alocado: number
│
├─ Análise por frente (FrentesCard):
│   ├─ frentes: CurvasFrente[]
│   │   ├─ id: string
│   │   ├─ nome: string                           // "Terraplenagem", "Estruturas"
│   │   ├─ liberadoPct: number
│   │   ├─ capacidadePct: number
│   │   ├─ alocadoPct: number
│   │   ├─ gargaloLabel: string                   // "Contratante · projetos", "sem gargalo", "leve · interno"
│   │   └─ farol: FarolLevel
│   └─ frentesObservacao: string                  // box rosa abaixo da tabela
│
├─ Documentos de sustentação (DocsCard):
│   └─ documentos: CurvasDocumento[]
│       ├─ id: string
│       ├─ tipo: "carta"|"ata"|"rdo"|"lista"      // mapeado pra ícone via DOC_ICON
│       ├─ titulo: string                         // "CON-042/2025 — Cobrança do projeto P-23"
│       ├─ meta?: string                          // "de 15/09/2025" — opcional pra "lista mestra"
│       └─ descricao: string                      // 1-2 linhas
│
├─ chatQuote: string                              // (legado — chat removido)
└─ chatSugestoes: Array<{ id, texto }>            // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

- `ComposedChart` (combina Area + Line)
- `Area` (banda do gap — stacked) · `Line` (3 curvas)
- `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`

### 5.3 Componentes locais

| Função            | Props                                 | O que renderiza                                                                         |
| ----------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| `CurvasAba`       | (route)                               | Composição — 4 children + grid 2-col                                                    |
| `CurvasHeader`    | `bm`                                  | Título + sub                                                                            |
| `KpisHero`        | `c`                                   | 3 KpiCards com dot de cor por curva                                                     |
| `KpiCard`         | `label, value, nota, farol, dotColor` | Card individual com farol e dot                                                         |
| `DiagnosticoCard` | `c`                                   | Banner colorido (verde se "ok", vermelho senão) + texto + hipótese alternativa opcional |
| `EvolucaoCard`    | `c, bm`                               | ComposedChart com banda amarela + 3 linhas + pills laterais + nota condicional          |
| `FrentesCard`     | `c, bm`                               | Tabela ARIA 6 cols + observação                                                         |
| `FrenteLinha`     | `f`                                   | 1 linha (frente + 3 pcts + gargalo + farol dot)                                         |
| `DocsCard`        | `c`                                   | Lista de documentos                                                                     |
| `DocLinha`        | `d`                                   | 1 doc com ícone, título, meta opcional, descrição                                       |
| `FormattedText`   | `text`                                | Parser inline `**bold**`                                                                |

### Constantes

- `FAROL_COLOR` (padrão)
- `CURVE_COLOR`: liberacao=danger (vermelho), capacidade=#1e6f4f (verde), alocado=#2a5fb8 (azul)
- `DOC_ICON`: carta=note, ata=check, rdo=calendar, lista=doc

---

## 6. Binding componente ↔ dados

| Componente                      | Campos consumidos                                                                                                                             | Visualização                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `KpisHero` (3 cards)            | `c.{liberacao,capacidade,alocado}Pct/Nota/Farol` + dotColor de `CURVE_COLOR`                                                                  | 3 KPIs com dot colorido (matching com gráfico) + classe `cur-kpi-${farol}`                                                                   |
| `DiagnosticoCard`               | `c.gargaloTipo`, `c.diagnosticoTitulo`, `c.diagnosticoTexto`, `c.hipoteseAlternativa?`                                                        | Banner verde (ok) ou vermelho/amarelo (senão) — ícone check/flag muda                                                                        |
| `EvolucaoCard` (gráfico)        | `c.evolucao[]` mapeado para `{ liberacao, capacidade, alocado, libBase, gap }`. `libBase = liberacao`; `gap = max(0, capacidade − liberacao)` | ComposedChart: 2 Areas empilhadas (libBase invisível + gap amarelo) + 3 Lines (Capacidade verde, Liberação vermelha, Alocado azul tracejado) |
| `EvolucaoCard` (pills laterais) | `c.{capacidade,alocado,liberacao}Pct`                                                                                                         | 3 pills com nome+valor colorido por curva                                                                                                    |
| `EvolucaoCard` (nota)           | Calcula `c.capacidadePct - c.liberacaoPct > 2`                                                                                                | Mostra anotação "Gap = potencial produtivo não realizado · base do pleito M3.8" só se gap > 2pp                                              |
| `FrentesCard`                   | `c.frentes[]`, `c.frentesObservacao`                                                                                                          | Tabela 6 cols + box rosa                                                                                                                     |
| `DocsCard`                      | `c.documentos[]`, `c.gargaloTipo` (sub do header muda)                                                                                        | Lista de docs com ícone variável por `tipo`                                                                                                  |

### Layout pai

```
main.cur-main
├─ CurvasHeader
├─ KpisHero (3-col)
├─ DiagnosticoCard (banner full-width)
├─ EvolucaoCard (full-width — chart + nota)
└─ div.cur-grid (2-col)
    ├─ FrentesCard
    └─ div.cur-col-dir
        └─ DocsCard
```

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do BM
- **Banda do gap = stacked Area trick**: 2 Areas com mesmo `stackId="gapStack"`. A primeira (`libBase`) tem `fill="transparent"` — empurra a segunda pra cima. A segunda (`gap`) tem `fill="var(--warning-bg)"` — fica visível só na faixa entre Liberação e Capacidade
- **Cálculo do gap derivado**: `Math.max(0, capacidade - liberacao)` — nunca negativo
- **Tooltip filtra**: `if (name === "libBase" || name === "gap") return ["", ""]` — não mostra os dados sintéticos no hover (só as 3 curvas reais)
- **DiagnosticoCard** muda visual conforme `gargaloTipo === "ok"`:
  - Ícone: `I.check` (ok) ou `I.flag` (senão)
  - Classe: `cur-diag-ok` ou `cur-diag-critico`
- **Nota condicional** abaixo do gráfico só aparece se `gap > 2pp` — não polui quando alinhado
- **`DocsCard` sub header** depende do `gargaloTipo`: "Probatório do gargalo na Contratante" ou "Registros relacionados ao período"
- **`DOC_ICON` lookup**: usa `I[iconKey]` (acesso dinâmico) — chama como função porque `I.*` retorna `(props) => ReactNode`
- **Alocado tracejado** (`strokeDasharray="5 4"`, `dot={false}`) — visualmente diferente das 2 curvas teóricas

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão
- **Para onde os dados vão**:
  - **Indicadores** mostra resumo via `bm.curvas` (campo raiz do BmSnapshot — versão simplificada com apenas pcts + notas, sem evolução nem frentes)
  - **Aba Responsabilidade** — `gargaloTipo` aqui implica distribuição esperada de impacto por responsável
  - **M3.8 Ociosidade Indireta** — `gap × custo MOI × dias` = R$ ocioso
  - **M3.10 Gerador de Claim** — `diagnosticoTexto` vira fundamentação textual
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Conceito-chave do RMA**: esta é a aba que **transforma evidência em pleito sustentável**. Sem o diferencial das 3 curvas, o gerente "acha" de quem é a culpa; com ele, **prova**
