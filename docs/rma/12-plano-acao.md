# Aba: Plano de Ação (RMA · 5.3.11)

> Tabela **5W2H simplificada** (o quê · por quê · quem · quando · onde · esforço · status) das ações abertas do BM. KPIs (Total · Concluídas · Em Andamento · Pendentes · Atrasadas · SLA Médio), barra de progresso multi-segmento, filtros por chip (Todas · Atrasadas · Esta Semana) + filtros por responsável e origem. Tabela com até dezenas de ações.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"O que precisa ser feito até quando, por quem? O que está atrasado?"**

É o **operacional do RMA**. Enquanto Condutas sugere "novos" entregáveis baseados em estado do contrato, Plano de Ação é a **lista persistente** de tudo que precisa ser feito — incluindo ações iniciadas em BMs anteriores e ainda não concluídas. Usa **`useState`** pesado (3 filtros independentes + chip de visão).

---

## 2. Contexto de produto

- **Quando se abre**: tab "Plano de Ação" — geralmente reunião semanal de acompanhamento
- **Decisão que embasa**:
  - "Quais ações estão atrasadas e precisam de escalada?"
  - "O que cada responsável tem na semana?"
  - "Qual a origem (Faturamento, Prazo, Reunião X) está gerando mais ação?"
- **Para onde alimenta**: nada direto — é tela operacional. Mas é o **lugar onde as condutas viram tarefas atribuídas**
- **Wrapper**: usa **`<PlanoAcaoView>`** compartilhada com `/contracts/$id/plano-acao` (rota top-level)
- **Conceitos importantes**:
  - **5W2H** — método de gestão: What (ação) · Why (justificativa) · Who (responsável) · When (quando) · Where (onde/canal) · How much (esforço). Aqui simplificado (sem "How" detalhado)
  - **SLA médio em dias** — tempo médio entre abertura e conclusão das ações
  - **Origem** — o que motivou cada ação: "Faturamento" / "Prazo" / "Reunião 30/05" / "Aviso M3"
  - **"Esta semana"** — pré-marcado no mock (`estaSemana?: boolean`) com base na data de corte do BM
  - **Status**: concluida / em-andamento / pendente / atrasada — cada uma com cor

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.11: "Documento estruturado. Para cada ponto de atenção: o quê · por quê · quem · quando · onde · esforço · status".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/plano-acao`
- **Arquivo wrapper** (RMA): [`src/routes/_app/contracts/$contractId/rma/plano-acao.tsx`](../../src/routes/_app/contracts/$contractId/rma/plano-acao.tsx) — 29 linhas, só renderiza `<PlanoAcaoView>`
- **Arquivo componente** (compartilhado): [`src/components/pages/PlanoAcaoView.tsx`](../../src/components/pages/PlanoAcaoView.tsx)
- **CSS**: [`PlanoAcaoView.css`](../../src/components/pages/PlanoAcaoView.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`
- **Reuso**: também renderizado em `/contracts/$id/plano-acao` (rota top-level fora do RMA)

### Wrapper RMA

```ts
function PlanoAcaoAba() {
  const { visao } = Route.useLoaderData();
  const search = Route.useSearch();
  return <PlanoAcaoView visao={visao} bmId={search.bm} />;
}
```

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.planoAcao: PlanoAcaoBM`.

```
PlanoAcaoBM
├─ 6 KPIs do topo (KpisRow):
│   ├─ totalAcoes: number                         // 42
│   ├─ totalAcoesNota: string                     // "18 abertas neste BM"
│   ├─ concluidasN: number                        // 18 → KPI verde
│   ├─ concluidasNota: string                     // "43% das totais"
│   ├─ emAndamentoN: number                       // 14 → KPI azul
│   ├─ emAndamentoNota: string
│   ├─ pendentesN: number                         // 7 → KPI amarelo
│   ├─ pendentesNota: string
│   ├─ atrasadasN: number                         // 3 → KPI vermelho
│   ├─ atrasadasNota: string
│   ├─ slaDiasMedio: number                       // 4.2 → KPI 6
│   └─ slaNota: string                            // "dentro do prazo (meta: 5)"
│
├─ Barra de progresso multi-segmento (ProgressoCard):
│   ├─ progressoPct: number                       // 42.9 (default = concluidasN / totalAcoes)
│   └─ progressoNota: string                      // "18 concluídas · 14 em andamento · 7 pendentes · 3 atrasadas"
│
├─ Filtros (FiltrosBar):
│   ├─ responsaveis: string[]                     // ["Eng. Marcos", "Eng. Carlos", "Eng. Ana", ...]
│   └─ origens: string[]                          // ["Faturamento", "Prazo", "Reunião 30/05", ...]
│
├─ Linhas da tabela (TabelaCard):
│   └─ linhas: AcaoLinha[]
│       ├─ id: string                             // "A-42"
│       ├─ acao: string                           // "Emitir CON-043 — Cobrança projeto P-23"
│       ├─ justificativa: string                  // "atraso de 30+ dias compromete BM-10"
│       ├─ responsavel: string                    // "Eng. Marcos Andrade"
│       ├─ quando: string                         // "27/05/2026" (DD/MM/YYYY)
│       ├─ onde: string                           // "Carta formal", "Plataforma", "Módulo 3"
│       ├─ esforco: string                        // "4h", "1d", "2h"
│       ├─ status: "concluida"|"em-andamento"|"pendente"|"atrasada"
│       ├─ origem: string                         // filtro
│       └─ estaSemana?: boolean                   // pré-marca pra filtro chip "Esta Semana"
│
├─ acoesAnteriores: number                        // footer da tabela: "+ N ações anteriores · ver histórico"
│
├─ chatQuote?: string                             // (legado — chat removido)
└─ chatSugestoes?: Array<{ id, texto }>           // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

**Nenhum** — barra de progresso feita com CSS, tabela é grid ARIA.

### 5.3 Componentes locais (em PlanoAcaoView.tsx)

| Função          | Props                                                                                                                      | O que renderiza                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `PlanoAcaoView` | `visao, bmId?`                                                                                                             | Composição principal — controla todos os filtros via `useState`          |
| `PaHeader`      | `bm`                                                                                                                       | Título + sub + 3 botões (Nova ação · Exportar Excel · Atualizar pela IA) |
| `KpisRow`       | `p`                                                                                                                        | 6 KpiCards com dot de status colorido                                    |
| `KpiCard`       | `label, valor, nota, dotColor?`                                                                                            | 1 card genérico                                                          |
| `ProgressoCard` | `p`                                                                                                                        | Barra horizontal com até 4 segmentos coloridos + legenda                 |
| `FiltrosBar`    | `chip, onChip, respFiltro, onResp, origemFiltro, onOrigem, countTodas, countAtrasadas, countSemana, responsaveis, origens` | 3 chips + 2 selects                                                      |
| `TabelaCard`    | `linhas, acoesAnteriores, totalLinhasMock`                                                                                 | Tabela ARIA + footer                                                     |
| (constantes)    | —                                                                                                                          | `STATUS_COLOR`, `STATUS_BG`, `STATUS_LABEL`: Record por status           |

### Constantes

- `STATUS_COLOR`: concluida=success, em-andamento=info, pendente=warning, atrasada=danger
- `STATUS_BG`: variantes claras (`var(--success-bg)`, etc.) — usadas em badges
- `STATUS_LABEL`: "CONCLUÍDA", "EM ANDAMENTO", "PENDENTE", "ATRASADA"

---

## 6. Binding componente ↔ dados

| Componente          | Campos consumidos                                                                                                                                                         | Visualização                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `PaHeader`          | `bm.numero` (no título)                                                                                                                                                   | "RMA · Plano de Ação · BM-09" + 3 botões                                                          |
| `KpisRow` (6 cards) | `p.{totalAcoes, totalAcoesNota, concluidasN, concluidasNota, emAndamentoN, emAndamentoNota, pendentesN, pendentesNota, atrasadasN, atrasadasNota, slaDiasMedio, slaNota}` | 6 KPIs · KPIs 2-5 com dot da cor do status                                                        |
| `ProgressoCard`     | `p.{concluidasN, emAndamentoN, pendentesN, atrasadasN, progressoPct, progressoNota}`                                                                                      | Barra horizontal multi-segmento + texto                                                           |
| `FiltrosBar`        | `chip` (state), `respFiltro` (state), `origemFiltro` (state), `countTodas/Atrasadas/Semana` (derivados), `responsaveis`/`origens` (de `p.*`)                              | 3 chips (Todas/Atrasadas/Esta Semana) com contador + 2 selects                                    |
| `TabelaCard`        | `linhasFiltradas` (computado via useMemo), `p.acoesAnteriores`, `p.linhas.length` (footer "X de Y")                                                                       | Tabela ARIA 8 cols (ID, Ação, Justificativa, Responsável, Quando, Onde, Esforço, Status) + footer |

### Layout pai

```
main.pa-main
├─ PaHeader
├─ KpisRow (6-col)
├─ ProgressoCard (full-width)
├─ FiltrosBar (linha de chips + selects)
└─ TabelaCard (full-width)
```

---

## 7. Lógica e regras

- **3 `useState`** independentes:
  - `chip: "todas" | "atrasadas" | "esta-semana"` — visão principal
  - `respFiltro: string` — responsável selecionado (vazio = todos)
  - `origemFiltro: string` — origem selecionada (vazio = todas)
- **`useMemo` para linhasFiltradas**:
  ```ts
  return p.linhas.filter((l) => {
    if (chip === "atrasadas" && l.status !== "atrasada") return false;
    if (chip === "esta-semana" && !l.estaSemana) return false;
    if (respFiltro && l.responsavel !== respFiltro) return false;
    if (origemFiltro && l.origem !== origemFiltro) return false;
    return true;
  });
  ```
- **Contadores dos chips**:
  - `countTodas = p.linhas.length`
  - `countAtrasadas = p.linhas.filter((l) => l.status === "atrasada").length`
  - `countSemana = p.linhas.filter((l) => l.estaSemana).length`
- **`STATUS_COLOR/BG/LABEL`** acessados por chave — coerência entre todas as referências
- **`ProgressoCard` mostra até 4 segmentos**:
  - `width: (concluidasN/total) × 100%` por status
  - Filtra `s.n > 0` (não renderiza segmento vazio)
  - `total = concluidasN + emAndamentoN + pendentesN + atrasadasN || 1` (evita divisão por zero)
- **`chatQuote?` e `chatSugestoes?`** opcionais nos types (defaults definidos eram `DEFAULT_CHAT_QUOTE` e `DEFAULT_CHAT_SUGESTOES`) — foram removidos junto com o chat

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**:
  - Loader padrão
  - **Conceitualmente**: ações criadas a partir de **Condutas** ("Gerar carta" no Condutas → cria linha de ação aqui), **Panorama** (eventos críticos viram ações), reuniões manuais
- **Para onde os dados vão**:
  - **Cliente externo** via export Excel (botão `Exportar Excel` do header)
  - **Auditoria** — registro persistente de tudo planejado/executado
- **Wrapper duplicado**: `plano-acao.tsx` (RMA) e `plano-acao.tsx` (top-level em `/contracts/$id/plano-acao`) usam o **mesmo `<PlanoAcaoView>`**
- **Helpers usados**: `getBm` (loaders padrão no wrapper)
- **Estado mais complexo** do RMA: 3 filtros independentes + chip de visão = 4 dimensões. Único componente com `useMemo` para performance
- **Pattern 5W2H**:
  - **What** → `acao`
  - **Why** → `justificativa`
  - **Who** → `responsavel`
  - **When** → `quando`
  - **Where** → `onde` (canal: carta, plataforma, módulo)
  - **How** → não capturado
  - **How much** → `esforco` (horas/dias)
