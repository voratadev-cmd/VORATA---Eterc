# Aba: Indicadores e Farol (RMA · 5.3.1)

> Visão **tática imediata** do contrato. Hero com 4 cells (Situação · Aderência · Força no Mérito · Ação Recomendada), diagnóstico textual longo, grid clicável dos 6 blocos de farol (links pras abas detalhadas), curvas Lib×Cap×Aloc resumidas + marcos, e análise de responsabilidade.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder em **5 segundos**: _"Onde está o problema, qual a próxima ação, e tenho como sustentar pleito?"_

É a **aba de entrada conceitual** do RMA — diferente de Visão Geral (executiva), Indicadores é **tática**: cada bloco vira link pra aba detalhada, e há blocos extras (curvas Lib×Cap, marcos, responsabilidade) que ajudam a decidir onde mergulhar.

---

## 2. Contexto de produto

- **Quando se abre**: usuário clica na tab "Indicadores e Farol" ou usa o botão "Ver RMA completo" da Visão Geral
- **Decisão que embasa**:
  - "Qual bloco está pior?" → clica direto na aba detalhada (cards de status são `<Link>`)
  - "Qual a próxima ação recomendada?" → Cell 4 do hero ("Ação Recomendada")
  - "Eu tenho base documental sólida pra plotar pleito?" → "Força no Mérito" (1-5 estrelas)
  - "De quem foi a culpa este mês?" → Análise de Responsabilidade (4 cards)
- **Para onde alimenta**: nada — é tela consumidora. Mas é o **hub navegacional** para todas as outras 10 abas
- **Regras de negócio importantes**:
  - **Aderência no mês** = `faturado_mes / previsto_mes`
  - **Força no Mérito** (1-5★) = avaliação subjetiva do agente IA da solidez documental + jurídica do contrato no BM atual
  - **Cards de blocos clicáveis**: cada um leva para a aba RMA correspondente (`faturamento` → `/rma/faturamento`, etc.)
  - O 6º bloco é "Desequilíbrio Acumulado" → leva pra `/desequilibrio` (rota top-level fora do RMA)

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.1: "Card de **situação geral** com diagnóstico textual do agente sênior · Status por bloco · acesso direto a cada aba detalhada".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/indicadores`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/indicadores.tsx`](../../src/routes/_app/contracts/$contractId/rma/indicadores.tsx)
- **CSS**: [`indicadores.css`](../../src/routes/_app/contracts/$contractId/rma/indicadores.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Esta aba não tem um type aninhado próprio — usa **campos diretos do `BmSnapshot`** definidos como "Campos da aba 5.3.1" no schema:

```
BmSnapshot                                        (campos consumidos)
├─ numero: string                                 // header (BM-XX)
├─ situacao: FarolLevel                           // hero cell 1 (cor)
├─ situacaoLabel: string                          // hero cell 1 (texto principal — antes do "·")
├─ diagnostico: string                            // DiagnosticoCard (com **negrito**)
├─ diagnosticoHora: string                        // "14:32" — tag do DiagnosticoCard
│
├─ Hero strip:
│   ├─ blocosContagem: { criticos, risco, observacao, conforme: number }
│   │                                             // hero cell 1 sub: "3 críticos · 4 risco · ..."
│   ├─ aderenciaMesPct: number                    // hero cell 2
│   ├─ forcaNoMerito: number                      // hero cell 3 (1-5 estrelas)
│   ├─ forcaNoMeritoNota: string                  // hero cell 3 (sub)
│   └─ acaoRecomendada: { titulo: string; cta: string }
│                                                 // hero cell 4 (título + label do botão)
│
├─ 6 blocos de farol (BlocoStatusGrid):
│   ├─ blocoFaturamento: BlocoFarol               // → link /rma/faturamento
│   ├─ blocoRecursos: BlocoFarol                  // → link /rma/recursos
│   ├─ blocoProdutividade: BlocoFarol             // → link /rma/produtividade
│   ├─ blocoPrazo: BlocoFarol                     // → link /rma/prazo
│   ├─ blocoInsumos: BlocoFarol                   // → link /rma/insumos
│   └─ blocoDesequilibrio: BlocoFarol             // → link /rma/desequilibrio (rota top-level)
│       (BlocoFarol = { valor, nivel, descricao, nota })
│
├─ curvas: { liberacaoPct, liberacaoNota, capacidadePct, capacidadeNota,
│            alocadoPct, alocadoNota, diagnostico: string }
│                                                 // CurvasCard (3 mini-cards + box amarelo)
│
├─ marcos: Array<{                                // MarcosCard (lista)
│     id, titulo, descricao,
│     statusLabel,                                // "CUMPRIDO" / "EM RISCO" / "+87d"
│     statusFarol: FarolLevel
│  }>
│
└─ responsabilidade: {                            // ResponsabilidadeCard (4 cards)
     contratante: { valor: string; pct: number; eventos: number },
     contratada:  { valor: string; pct: number; eventos: number },
     terceiro:    { valor: string; pct: number; eventos: number },
     forcaMaior:  { valor: string; pct: number; descricao: string }
                                                  // forcaMaior usa "descricao" em vez de "eventos"
  }
```

> **Nota**: campos `chatSugestoesIndicadores` continuam no type mas não são consumidos (chat removido).

---

## 5. Componentes

### 5.1 DS importado

- `I`, `type IconName`

### 5.2 Recharts

**Nenhum** — só cards/listas/grids.

### 5.3 Componentes locais

| Função                 | Props             | O que renderiza                                                                |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------ |
| `IndicadoresAba`       | (route)           | Composição principal — 5 children                                              |
| `HeroStrip`            | `bm`              | 4 cells horizontais: Situação · Aderência · Força no Mérito · Ação Recomendada |
| `Stars`                | `filled, total=5` | Helper visual ★★★☆☆                                                            |
| `DiagnosticoCard`      | `bm`              | Card branco (não dark) com tag + parágrafo formatado                           |
| `FormattedText`        | `text`            | Parser inline `**bold**`                                                       |
| `BlocoStatusGrid`      | `contract, bm`    | 6 `<Link>` cards (mais clicáveis que VG)                                       |
| `CurvasMarcosGrid`     | `bm`              | Wrapper grid 2-col (CurvasCard + MarcosCard)                                   |
| `CurvasCard`           | `bm`              | 3 mini-cards (Liberação/Capacidade/Alocado) + aside diagnóstico                |
| `MarcosCard`           | `bm`              | `<ul>` de marcos com pill colorida                                             |
| `ResponsabilidadeCard` | `bm`              | 4 cards (Contratante/Contratada/Terceiro/Força Maior)                          |

### Constantes

- `FAROL_COLOR`, `FAROL_LABEL` (padrão RMA)
- `BLOCO_ICONS`: faturamento=wallet, recursos=users, produtividade=trending, prazo=clock, **insumos=pkg**, desequilibrio=trending (1 a mais que Visão Geral)
- `MARCO_TONE`: FarolLevel → classe CSS (`ind-marco-critico`, etc.)

---

## 6. Binding componente ↔ dados

| Componente                       | Campos consumidos                                                            | Visualização                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `HeroStrip` cell 1               | `bm.situacaoLabel.split(" · ")[0]`, `bm.situacao` (cor), `bm.blocosContagem` | Texto colorido + sub "3 críticos · 4 risco · 1 obs · 0 conformes"                           |
| `HeroStrip` cell 2               | `bm.aderenciaMesPct`, `bm.numero`                                            | "78%" + "faturado vs. previsto · BM-09"                                                     |
| `HeroStrip` cell 3               | `bm.forcaNoMerito`, `bm.forcaNoMeritoNota`                                   | ★★★☆☆ + nota                                                                                |
| `HeroStrip` cell 4               | `bm.acaoRecomendada.titulo`, `.cta`, `bm.situacao` (classe)                  | Card colorido + botão com CTA                                                               |
| `DiagnosticoCard`                | `bm.diagnostico`, `bm.numero`, `bm.diagnosticoHora`                          | Tag "DIAGNÓSTICO · BM-09 · GERADO ÀS 14:32" + texto                                         |
| `BlocoStatusGrid` (cada card)    | `bm.bloco<X>` + `tab` (slug)                                                 | `<Link to="/contracts/$id/rma/<tab>">` com 5 linhas (ícone+título+nível, valor, desc, nota) |
| `CurvasCard` (3 mini-cards)      | `bm.curvas.{liberacao,capacidade,alocado}Pct/Nota`                           | Pct + nota por curva                                                                        |
| `CurvasCard` (aside diagnóstico) | `bm.curvas.diagnostico`                                                      | Box amarelo "**Diagnóstico:** ..."                                                          |
| `MarcosCard`                     | `bm.marcos[]`                                                                | Lista de marcos com pill `m.statusLabel` colorida por `m.statusFarol`                       |
| `ResponsabilidadeCard` (4 cards) | `bm.responsabilidade.{contratante,contratada,terceiro,forcaMaior}`           | Cards com label + valor + meta. Última usa `.descricao` em vez de `.eventos`                |

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do `bm`
- **`situacaoLabel.split(" · ")[0]`** — pega só a primeira parte (texto antes do bullet)
- **`BlocoStatusGrid` é o único elemento clicável**: cada card é `<Link to={href}>` onde `href = /contracts/${contract.id}/rma/${tab}`. Único caso onde o type lints com `as any` (destinos dinâmicos)
- **Cards de bloco têm classe condicional `ind-bloco-${nivel}`** — cores variam por farol no CSS
- **`Stars` é puro JSX** — não usa biblioteca, só `★` Unicode com classes `on`/sem
- **`MARCO_TONE`** mapeia FarolLevel → classe CSS individual (diferente de inline color)
- **`forcaMaior` no Responsabilidade** usa `descricao` em vez de `eventos` (assim definido no type — provavelmente porque força maior não conta como "evento atribuível")

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**: mesmo loader das outras abas (`getVisaoGeral`)
- **Para onde os dados vão**: nada — tela só consome
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Convite navegacional principal**: 6 cards de bloco linkam para 5 abas RMA + 1 rota top-level (`/desequilibrio`)
- **Conceito compartilhado**:
  - `bm.curvas` (resumo Lib×Cap×Aloc) **é resumo** do que mora detalhado em [08-curvas.md](08-curvas.md) (`bm.curvasAnalise` — type mais rico)
  - `bm.marcos` **é resumo** do que mora detalhado em [06-prazo.md](06-prazo.md) (`bm.prazo.marcosCronograma` — type idêntico, dados diferentes)
  - `bm.responsabilidade` **é resumo** do que mora detalhado em [09-responsabilidade.md](09-responsabilidade.md) (`bm.analiseResp` — type mais rico)
- **Sobreposição com Visão Geral**: ambas têm diagnóstico + faróis dos blocos. Diferenças aqui: blocos são links, hero tem força no mérito + ação recomendada, há curvas/marcos/responsabilidade extras
