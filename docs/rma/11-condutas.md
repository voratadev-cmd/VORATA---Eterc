# Aba: Condutas Sugeridas e Geração de Documentos (RMA · 5.3.10)

> Lista **aberta** de entregáveis sugeridos pela IA — cartas formais, take-offs, comentários em RDO/ata, análises de cláusula. Cada item vira documento com 1 clique. Histórico mensal dos docs gerados na coluna direita.

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"Quais documentos eu preciso gerar agora pra agir sobre os eventos do mês?"**

A aba **traduz diagnóstico em ação**. Cada conduta tem um botão que gera o documento real (carta, parecer, PPN, take-off, etc.) — o documento vai automaticamente pra Biblioteca após emitido. **Lista aberta**: a plataforma suporta entregáveis novos sem reprogramação (novos templates podem ser adicionados pela IA conforme aprende).

---

## 2. Contexto de produto

- **Quando se abre**: tab "Condutas" — geralmente após analisar Panorama (identificou eventos-chave) ou após dot vermelho em algum bloco
- **Decisão que embasa**: "Quais cartas/comunicações/análises emitir hoje?"
- **Para onde alimenta**: **Biblioteca** (todo doc emitido vira entrada lá) + caixa de entrada do destinatário (Contratante, jurídico interno, etc.)
- **Wrapper**: usa **`<CondutasView>`** compartilhada com `/contracts/$id/condutas` (rota top-level também na Sidebar)
- **Conceitos importantes**:
  - **Conduta** — ação sugerida pela IA (ex.: "Emitir CON-043 — Cobrança projeto P-23")
  - **Documento gerado** — emissão concreta de uma conduta (vira CARTA / ATA / PARECER / PPN / TAKE-OFF / MEMORANDO)
  - **PPN** — Pedido de Preço Novo (serviço extra-escopo)
  - **Take-off** — quantitativo automatizado a partir de novo projeto
  - **Lista aberta** — plataforma não fixa categorias; novas surgem conforme contexto
  - **Gerar em lote** — KPI 4 oferece gerar múltiplas condutas com 1 clique

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.10: "Take-off automatizado · Pedidos de preço novo · Cartas · Comentários em RDO/ata · Análises de cláusula contratual · Plano de Ação atualizado. **Lista aberta** — a plataforma precisa suportar entregáveis novos sem reprogramação".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/condutas`
- **Arquivo wrapper** (RMA): [`src/routes/_app/contracts/$contractId/rma/condutas.tsx`](../../src/routes/_app/contracts/$contractId/rma/condutas.tsx) — 29 linhas, só renderiza `<CondutasView>`
- **Arquivo componente** (compartilhado): [`src/components/pages/CondutasView.tsx`](../../src/components/pages/CondutasView.tsx)
- **CSS**: [`CondutasView.css`](../../src/components/pages/CondutasView.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`
- **Reuso**: também renderizado em `/contracts/$id/condutas` (rota top-level fora do RMA)

### Wrapper RMA

```ts
function CondutasAba() {
  const { visao } = Route.useLoaderData();
  const search = Route.useSearch();
  return <CondutasView visao={visao} bmId={search.bm} />;
}
```

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.condutas: CondutasBM`.

```
CondutasBM
├─ 3 KPIs informativos + 1 card de ação:
│   ├─ totalAcoes: number                         // 12 → "12 ações" no KPI 1
│   ├─ totalAcoesNota: string                     // "8 cartas · 2 análises · 2 outros"
│   ├─ prioridadesLabel: string                   // "3 urgentes"
│   ├─ prioridadesNota: string                    // "vencem em 5 dias"
│   ├─ docsGerados: number                        // 18
│   ├─ docsGeradosNota: string                    // "média 0.6/dia · pico em 22/05"
│   ├─ loteLabel: string                          // KPI 4 vermelho — "todas as 3 cartas"
│   └─ loteAcoes: number                          // 3 — quantidade que entra no lote
│
├─ prioridadesTexto: string                       // banner amarelo "PRIORIDADES DESTA SEMANA" (com **negrito**)
│
├─ Categorias de condutas (CategoriaCard):
│   └─ categorias: CondutaCategoria[]
│       ├─ id: string
│       ├─ iconKey: "note"|"pkg"|"doc"|"users"|"check"|"edit"
│       ├─ titulo: string                         // "Cartas e Notificações Formais"
│       ├─ sub: string                            // sub-texto curto
│       └─ itens: Conduta[]
│           ├─ id: string
│           ├─ prioridade: FarolLevel             // dot lateral
│           ├─ titulo: string
│           ├─ descricao: string                  // com **negrito** inline
│           ├─ acaoLabel: string                  // botão à direita: "Gerar carta", "Executar", "Gerar"
│           └─ badgeUrgente?: boolean             // tag UPPERCASE "URGENTE"
│
├─ Documentos gerados no mês (DocsGeradosCard):
│   ├─ documentosGerados: DocGerado[]
│   │   ├─ id: string
│   │   ├─ data: string                           // "13/05"
│   │   ├─ documento: string                      // nome
│   │   └─ tipo: DocTipoTag                       // "CARTA"|"ATA"|"PARECER"|"PPN"|"TAKE-OFF"|"MEMORANDO"
│   └─ totalNaBiblioteca: number                  // link "Ver na Biblioteca (N)"
│
├─ chatQuote: string                              // (legado — chat removido)
└─ chatSugestoes: Array<{ id, texto }>            // (legado — chat removido)
```

---

## 5. Componentes

### 5.1 DS importado

- `I`, `type IconName`

### 5.2 Recharts

**Nenhum** — tudo cards/tabelas.

### 5.3 Componentes locais (em CondutasView.tsx)

| Função            | Props                   | O que renderiza                                                         |
| ----------------- | ----------------------- | ----------------------------------------------------------------------- |
| `CondutasView`    | `visao, bmId?`          | Composição principal — wrapper compartilhado                            |
| `CondHeader`      | `bm`                    | Título + sub                                                            |
| `KpisRow`         | `c, bm`                 | 4 KPIs (3 dark/ink + 1 vermelho de ação)                                |
| `PrioridadesBox`  | `texto`                 | Banner amarelo                                                          |
| `CategoriaCard`   | `cat`                   | Section com header + lista de itens                                     |
| `CondutaItem`     | `c`                     | 1 item com dot + título + desc + badge urgente opcional + botão de ação |
| `DocsGeradosCard` | `docs, totalBiblioteca` | Tabela 3 cols + link "Ver na Biblioteca"                                |
| `FormattedText`   | `text`                  | Parser inline `**bold**`                                                |

### Constantes

- `FAROL_COLOR` (padrão — dot da prioridade da conduta)
- `DOC_TIPO_COLOR`: CARTA=danger, ATA=info, PARECER=brand, PPN=warning, TAKE-OFF=#1e6f4f, MEMORANDO=text-3 — cor do badge na tabela de docs

---

## 6. Binding componente ↔ dados

| Componente                    | Campos consumidos                                                                  | Visualização                         |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| `KpisRow` cell 1              | `c.totalAcoes`, `c.totalAcoesNota`, `bm.numero`                                    | Card ink — "12 ações"                |
| `KpisRow` cell 2              | `c.prioridadesLabel`, `c.prioridadesNota`                                          | Card ink — "3 urgentes"              |
| `KpisRow` cell 3              | `c.docsGerados`, `c.docsGeradosNota`                                               | Card ink — "18"                      |
| `KpisRow` cell 4              | `c.loteLabel`, `c.loteAcoes`                                                       | Card vermelho com botão "1 clique"   |
| `PrioridadesBox`              | `c.prioridadesTexto`                                                               | Aside amarelo                        |
| `CategoriaCard` (primeiras 2) | `c.categorias[0..1]` (Cartas + Take-offs presumivelmente)                          | Full-width — empilhado               |
| `CategoriaCard` (3+)          | `c.categorias.slice(2)`                                                            | Dentro de `cnd-col-esq` (grid 2-col) |
| `CategoriaCard`               | `cat.iconKey, cat.titulo, cat.sub, cat.itens.length`                               | Header + N itens                     |
| `CondutaItem`                 | `c.prioridade` (cor do dot), `c.titulo, c.descricao, c.acaoLabel, c.badgeUrgente?` | Item linha                           |
| `DocsGeradosCard`             | `c.documentosGerados[]`, `c.totalNaBiblioteca`                                     | Tabela 3 cols + link                 |

### Layout pai

```
main.cnd-main
├─ CondHeader
├─ KpisRow (4-col)
├─ PrioridadesBox (banner full-width)
├─ header (título "Condutas por Categoria")
├─ CategoriaCard × 2 (primeiras 2 full-width)
└─ div.cnd-grid (2-col)
    ├─ div.cnd-col-esq
    │   └─ CategoriaCard × N (resto)
    └─ div.cnd-col-dir
        └─ DocsGeradosCard
```

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do BM
- **`categorias.slice(0, 2)` + `categorias.slice(2)`** — primeiras 2 categorias (importantes: Cartas, Take-offs) ficam full-width; restantes empilham em coluna esquerda do grid
- **`I[cat.iconKey] ?? I.note`** — fallback se iconKey inválido
- **`cnd-kpi-ink`** (cards 1-3 escuros) vs **`cnd-kpi-acao`** (card 4 vermelho com botão) — destaque visual pra ação
- **`badgeUrgente`** opcional renderiza tag UPPERCASE "URGENTE" inline no título do item
- **`DOC_TIPO_COLOR[d.tipo]22`** — sufixo `22` (~13% opacidade) no background do badge da tabela. Texto fica com cor cheia
- **`href="#biblioteca"`** — anchor não funcional (Biblioteca é rota top-level `/contracts/$id/biblioteca`). Provavelmente substituir por `<Link>` no futuro
- **Empty state**: nenhum tratamento explícito — categorias vazias renderizam só header

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**:
  - Loader padrão
  - **Conceitualmente**: condutas sugeridas pela IA a partir do estado consolidado em **Panorama** (`nexoCausal` aponta eventos que viram cartas) + **Responsabilidade** (eventos críticos viram notificações)
- **Para onde os dados vão**:
  - **Biblioteca** (`/contracts/$id/biblioteca`) — todo doc emitido vira entrada lá
  - **Plano de Ação** — algumas condutas viram linhas no plano (delegadas a alguém com prazo)
- **Wrapper duplicado**: `condutas.tsx` (RMA) e `condutas.tsx` (top-level em `/contracts/$id/condutas`) usam o **mesmo `<CondutasView>`** — única diferença é o shell pai (RMA tem RmaTabs, top-level só tem o app shell)
- **Helpers usados**: `getBm` (Loaders padrão no wrapper)
- **Único componente RMA com `<DocsGeradosCard>`** — outras abas têm "documentos" mas em formato diferente (CurvasDocumento, RespEvento.docs, etc.)
