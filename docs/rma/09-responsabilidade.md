# Aba: Análise de Responsabilidade (RMA · 5.3.8)

> Classifica eventos negativos do BM por **responsável**: Contratante · Contratada · Terceiro · Força Maior. Distribuição visual em barra empilhada, matriz detalhada de eventos com fundamentação documental e quantificação por tipo de impacto. **Base obrigatória para todo pleito** — sem ela, não há nexo causal.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"De quem é a responsabilidade dos eventos negativos deste BM? E quanto cada lado custou em R$?"**

Sem essa classificação, não é possível atribuir nexo causal — princípio jurídico que liga **fato → responsável → impacto financeiro**. A aba existe pra que cada R$ de desequilíbrio tenha um responsável identificado e fundamentado documentalmente.

---

## 2. Contexto de produto

- **Quando se abre**: tab "Responsabilidade" — depois de identificar gargalo nas Curvas Lib×Cap×Aloc
- **Decisão que embasa**:
  - "Em quais eventos especificamente vou plotar o pleito?"
  - "A Contratante tem fundamentação documental suficiente em cada evento?"
  - "Há eventos cruzados (Compartilhado) que enfraquecem o pleito?"
- **Para onde alimenta**:
  - **Aba Panorama** — `nexoCausal` (5 eventos-chave) é a versão final dos eventos consolidados aqui
  - **M3 Painel de Desequilíbrio** — quantificação por tipo (perda de produtividade, indireto improdutivo, etc.)
  - **M3.10 Gerador de Claim** — `eventos[]` viram linhas do dossiê probatório do claim
- **Conceitos importantes**:
  - **Nexo causal** — fundamento jurídico do pleito: cada R$ pedido precisa estar vinculado a evento + responsável + documento
  - **4 responsáveis** (mutuamente excludentes por evento):
    - **Contratante** — quem pediu a obra (atrasos de projeto, áreas não desimpedidas, descumprimentos contratuais)
    - **Contratada** — quem executa (problemas internos de gestão, retrabalho próprio)
    - **Terceiro** — fornecedor externo, concessionária, vizinho
    - **Força Maior** — chuva atípica, decreto governamental, pandemia
  - **Tipo de impacto** — categoria do dano: perda de produtividade, indireto improdutivo, custo extra, prazo
  - **`forcaMaior.pct + contratante.pct + contratada.pct + terceiro.pct ≤ 100%`** — não-classificados ficam fora da barra

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.8: "Classificação dos eventos negativos por responsável · Matriz eventos × responsabilidade · Quantificação dos impactos por responsável · Fundamentação documental por classificação. **Base para pleitos**. Sem ela, não há como provar nexo causal".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/responsabilidade`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/responsabilidade.tsx`](../../src/routes/_app/contracts/$contractId/rma/responsabilidade.tsx)
- **CSS**: [`responsabilidade.css`](../../src/routes/_app/contracts/$contractId/rma/responsabilidade.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.analiseResp: AnaliseRespBM`.

```
AnaliseRespBM
├─ 4 KPIs do topo (KpisHero — mesma estrutura por responsável):
│   ├─ contratante: { valorLabel: string,        // "R$ 7,2 mi"
│   │                 pct: number,                // 64.0
│   │                 eventos: number,            // 7 → "7 eventos"
│   │                 nota: string }              // "projetos · áreas · descumprimento"
│   ├─ contratada: { valorLabel, pct, eventos, nota }
│   ├─ terceiro: { valorLabel, pct, eventos, nota }
│   └─ forcaMaior: { valorLabel, pct, eventos, nota }
│
├─ distribuicaoObs: string                        // caixa rosa abaixo da barra empilhada (com **negrito**)
│
├─ Matriz de eventos (MatrizCard):
│   ├─ eventos: RespEvento[]                      // tabela detalhada (pode ser vazia)
│   │   ├─ id: string                             // "E-12", "E-15"
│   │   ├─ evento: string                         // descrição curta
│   │   ├─ dataLabel: string                      // "15/09/25", "jan/26", "04/08/25"
│   │   ├─ impactoLabel: string                   // "R$ 3.420k", "R$ 1,84 mi" (formatado)
│   │   ├─ responsavel: ResponsavelTipo           // tag colorida na tabela
│   │   └─ docs: number                           // quantidade de documentos probatórios
│   ├─ eventosTotal: number                       // total no header (>= eventos.length)
│   └─ eventosMenoresRestantes: number            // footer "+ N eventos menores"
│
├─ interpretacao: string                          // texto IA · parágrafos por \n\n + **negrito**
│
├─ Quantificação por tipo (QuantTipoCard):
│   ├─ tiposImpacto: RespTipoImpacto[]            // lista de categorias
│   │   ├─ id: string
│   │   ├─ categoria: string                      // "Perda de produtividade", "Indireto improdutivo"
│   │   ├─ descricao: string                      // "descontinuidade de frentes · retrabalho"
│   │   ├─ valorLabel: string                     // "R$ 3,8 mi"
│   │   └─ farol: FarolLevel                      // cor da barra + valor
│   └─ totalConsolidadoLabel: string              // sub do header
│
└─ chatQuote: string                              // (legado — chat removido)
```

`ResponsavelTipo = "contratante" | "contratada" | "terceiro" | "forcaMaior"`

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

**Nenhum** — barra empilhada feita com `<div>` + flex (CSS puro).

### 5.3 Componentes locais

| Função                | Props                       | O que renderiza                                                 |
| --------------------- | --------------------------- | --------------------------------------------------------------- |
| `ResponsabilidadeAba` | (route)                     | Composição — 3 children + grid 2-col                            |
| `RespHeader`          | `bm`                        | Título + sub                                                    |
| `KpisHero`            | `a`                         | 4 KpiCards                                                      |
| `RespKpi`             | `label, valor, nota, color` | 1 KPI com `borderTopColor` na cor do responsável                |
| `DistribuicaoCard`    | `a, bm`                     | Barra empilhada horizontal CSS + box rosa (ou empty state)      |
| `MatrizCard`          | `a, bm`                     | Tabela ARIA ou empty state                                      |
| `EventoLinha`         | `e`                         | 1 linha da tabela com pill do responsável + col docs            |
| `InterpretacaoCard`   | `texto`                     | Card com tag + parágrafos                                       |
| `QuantTipoCard`       | `a`                         | Lista de tipos de impacto                                       |
| `TipoImpactoLinha`    | `t`                         | Item com barra lateral colorida + categoria + descrição + valor |
| `FormattedText`       | `text`                      | Parser inline `**bold**`                                        |

### Constantes

- `FAROL_COLOR` (padrão)
- `RESP_COLOR`: contratante=danger, contratada=warning, terceiro=info, forcaMaior=text-3 (cinza)
- `RESP_LABEL`: pills curtas — "CONTRATANTE", "CONTRATADA", "TERCEIRO", "F. MAIOR"
- `RESP_LABEL_LONG`: usado nos `title` de hover da barra empilhada — "FORÇA MAIOR" completo

---

## 6. Binding componente ↔ dados

| Componente                 | Campos consumidos                                                                      | Visualização                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `KpisHero` (4 cards)       | `a.{contratante, contratada, terceiro, forcaMaior}.{valorLabel, nota}` + `RESP_COLOR`  | 4 KPIs · `borderTopColor` + label + valor coloridos pelo responsável                                                    |
| `DistribuicaoCard` (barra) | `a.{contratante, forcaMaior, contratada, terceiro}.pct` (ordem específica de plotagem) | Barra horizontal CSS — segmentos com `width: ${pct}%` e `background: RESP_COLOR[key]`. Tooltip = `RESP_LABEL_LONG · X%` |
| `DistribuicaoCard` (empty) | `total === 0`                                                                          | "Sem eventos negativos no período · cenário limpo"                                                                      |
| `DistribuicaoCard` (obs)   | `a.distribuicaoObs`                                                                    | Aside rosa                                                                                                              |
| `MatrizCard` (header)      | `a.eventosTotal`                                                                       | "N eventos negativos identificados · ordenação por impacto"                                                             |
| `EventoLinha`              | `e.id, e.evento, e.dataLabel, e.impactoLabel, e.responsavel, e.docs`                   | Linha com pill colorida e contador "1 doc"/"N docs"                                                                     |
| `MatrizCard` (footer)      | `a.eventosMenoresRestantes > 0`                                                        | "+ N eventos menores · ver listagem completa"                                                                           |
| `MatrizCard` (empty)       | `a.eventos.length === 0`                                                               | "Nenhum evento negativo identificado no período" com ícone check                                                        |
| `InterpretacaoCard`        | `a.interpretacao`                                                                      | Card com tag "INTERPRETAÇÃO · ADM CONTRATUAL IA" + parágrafos                                                           |
| `QuantTipoCard`            | `a.tiposImpacto[]`, `a.totalConsolidadoLabel`                                          | Lista de items com barra lateral colorida + valor à direita                                                             |

### Layout pai

```
main.rsp-main
├─ RespHeader
├─ KpisHero (4-col)
├─ DistribuicaoCard (full-width)
└─ div.rsp-grid (2-col)
    ├─ MatrizCard
    └─ div.rsp-col-dir
        ├─ InterpretacaoCard
        └─ QuantTipoCard
```

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do BM
- **Barra empilhada via CSS, não Recharts** — cada segmento é `<div>` com `width` em % e `background` da cor do responsável. Decisão de design: barra horizontal não justifica overhead de Recharts
- **Ordem de plotagem dos segmentos**: Contratante → Força Maior → Contratada → Terceiro (definida em código). Não é a ordem visual de "pior pra melhor" — é a ordem do array hardcoded
- **`segments.filter(s => s.pct > 0)`** — só plota responsáveis com %
- **Empty state em 2 lugares**:
  - `DistribuicaoCard`: quando `total === 0` (soma das %) — texto neutro
  - `MatrizCard`: quando `eventos.length === 0` — ícone check + texto verde
- **`InterpretacaoCard`** parseia `\n\n` em parágrafos
- **Cor inline + classe inline**: `EventoLinha` usa `color: RESP_COLOR[e.responsavel]` no impacto e pill com `background: ${color}22` (22 = ~13% opacidade hex)
- **Plural "doc"/"docs"** correto: `e.docs === 1 ? "doc" : "docs"`

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: loader padrão
- **Para onde os dados vão**:
  - **Indicadores** consome resumo via `bm.responsabilidade` (campo raiz, mesma estrutura mas valores curtos sem nota detalhada)
  - **Aba Panorama** — `nexoCausal` consolida os 5 eventos mais relevantes desta aba em formato pronto pra pleito
  - **M3 Painel de Desequilíbrio** — quantificação por tipo alimenta os métodos (M3.1 indiretos, M3.4 valor agregado, M3.5 total cost, M3.7 insumos)
  - **M3.10 Gerador de Claim** — `eventos[]` viram linhas do dossiê probatório
  - **Aba Curvas Lib×Cap×Aloc** — `gargaloTipo` daquela aba implica distribuição esperada aqui (Contratante alta na barra = consistente)
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Princípio jurídico fundamental**: **toda quantia pedida em pleito precisa ter responsável identificado e documento probatório**. Sem isso, vira "pedido pessimista" — perde no contraditório. Esta aba existe pra produzir essa cadeia de evidências
