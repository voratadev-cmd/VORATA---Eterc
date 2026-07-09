# Aba: Panorama do Contrato (RMA · 5.3.9)

> Visão **consolidada** do mês em 3 aspectos (técnico · econômico · físico) + 4 sub-KPIs técnicos + **Matriz de Impactos** (eventos × 5 categorias) + **Matriz de Nexo Causal** (5 eventos-chave em formato pronto pra pleito: fato → doc → cláusula → hipótese → quantificação).

> Para o contexto compartilhado entre todas as abas, leia primeiro [`00-overview.md`](00-overview.md).

---

## 1. Objetivo

Responder: **"Qual a fotografia consolidada do mês em termos técnicos, econômicos e físicos? E quais 5 eventos sustentam pleito agora?"**

É a **aba final do RMA pré-pleito** — consolidação dos diagnósticos das outras abas em formato apresentável pra cliente, jurídico ou diretoria. **Matriz de Nexo Causal** aqui é literalmente o template que vira anexo do claim.

---

## 2. Contexto de produto

- **Quando se abre**: tab "Panorama" — fim da jornada analítica do BM, antes de gerar Condutas
- **Decisão que embasa**:
  - "Como apresentar a situação do mês pra cliente/diretor em 1 página?"
  - "Quais 5 eventos têm fundamentação documental mais forte (★★★★★)?"
  - "Qual o impacto cruzado dos eventos por categoria (prazo/custo/qualidade/segurança/escopo)?"
- **Para onde alimenta**:
  - **M3.10 Gerador de Claim** — `nexoCausal[]` vira a estrutura do **dossiê probatório**
  - **Aba Condutas** — eventos críticos aqui sugerem cartas/notificações
  - **Dashboard de portfólio** (rota top-level) — `aspecto` farois agregam por contrato
- **Conceitos importantes**:
  - **3 aspectos do contrato**:
    - **Técnico** — engenharia (projetos, RDOs, RNCs, segurança)
    - **Econômico** — financeiro (faturamento, custos, desequilíbrio)
    - **Físico** — execução (avanço, marcos, frentes)
  - **Matriz de Impactos** — 1 evento × 5 categorias. Quase nunca todas preenchidas (eventos costumam afetar 2-3 categorias)
  - **Matriz de Nexo Causal** — 5 colunas que **são exatamente** o template jurídico:
    1. **Fato** — o que aconteceu
    2. **Documento** — o que comprova
    3. **Embasamento** — qual cláusula contratual / norma aplicável
    4. **Hipótese** — o que pretende-se postular
    5. **Quantificação** — quanto vale em R$ (preliminar)
  - **Decisão de design**: cards SEM border-top colorida (declarado em comentário do arquivo). Farol comunicado por **tag UPPERCASE** no header + **dot/pill** dentro das células

Trecho de [`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.9: "Visão consolidada do mês em 3 aspectos · Matriz de Impactos · Matriz de Nexo Causal — fato → documento que comprova → embasamento contratual → hipótese de desequilíbrio → quantificação".

---

## 3. Rota e arquivo

- **Rota**: `/contracts/$id/rma/panorama`
- **Arquivo**: [`src/routes/_app/contracts/$contractId/rma/panorama.tsx`](../../src/routes/_app/contracts/$contractId/rma/panorama.tsx)
- **CSS**: [`panorama.css`](../../src/routes/_app/contracts/$contractId/rma/panorama.css)
- **Loader**: padrão RMA
- **Search params**: `?bm=BM-XX`

---

## 4. Modelo de dados — type-by-type completo

Type raiz: `bm.panorama: PanoramaBM`.

```
PanoramaBM
├─ 3 aspectos (AspectosCards):
│   ├─ aspectoTecnico: PanoramaAspecto
│   ├─ aspectoEconomico: PanoramaAspecto
│   └─ aspectoFisico: PanoramaAspecto
│       (PanoramaAspecto = {
│         titulo: string,                          // "ASPECTO TÉCNICO"
│         farol: FarolLevel,
│         farolLabel: string,                      // UPPERCASE — "RISCO", "CRÍTICO"
│         texto: string,                           // 1 parágrafo (com **negrito**)
│         proximaAcao: string                      // ex.: "cobrança formal projetos atrasados"
│       })
│
├─ Detalhamento técnico (SubKpisCard — só usa este, não tem econômico/físico):
│   └─ tecnicoSubKpis: PanoramaSubKpi[]            // sempre 4 (Projetos, RDOs, RNCs, Segurança)
│       ├─ id: string
│       ├─ label: string                           // UPPERCASE — "PROJETOS", "RDOs", "RNCs", "SEGURANÇA"
│       ├─ valor: string                           // "12 atrasos", "98% completo"
│       ├─ nota: string                            // descrição curta
│       └─ farol: FarolLevel                       // dot na label
│
├─ Matriz de Impactos (MatrizImpactosCard):
│   └─ matrizImpactos: MatrizImpactoLinha[]
│       ├─ id: string
│       ├─ evento: string
│       ├─ prazo: ImpactoNivel                    // FarolLevel | null (null = "—" sem impacto)
│       ├─ custo: ImpactoNivel
│       ├─ qualidade: ImpactoNivel
│       ├─ seguranca: ImpactoNivel
│       └─ escopo: ImpactoNivel
│
└─ Matriz de Nexo Causal (NexoCausalCard):
    ├─ nexoCausal: NexoCausalLinha[]              // 5 eventos-chave (template jurídico)
    │   ├─ id: string
    │   ├─ fato: string                           // o que aconteceu
    │   ├─ documentos: string                     // lista textual (com bullets · separados)
    │   ├─ embasamento: string                    // cláusula contratual / norma
    │   ├─ hipotese: string                       // o que se pretende postular
    │   ├─ quantifLabel: string                   // "R$ 3,42 mi"
    │   └─ forcaMerito: number                    // 1-5 (renderiza estrelas)
    └─ nexoResumo: string                         // faixa inferior — "ADM Contratual IA: estes N eventos somam ..."
```

`ImpactoCategoria = "prazo" | "custo" | "qualidade" | "seguranca" | "escopo"`
`ImpactoNivel = FarolLevel | null`

---

## 5. Componentes

### 5.1 DS importado

- `I`

### 5.2 Recharts

**Nenhum** — tudo cards/tabelas.

### 5.3 Componentes locais

| Função               | Props                | O que renderiza                                                           |
| -------------------- | -------------------- | ------------------------------------------------------------------------- |
| `PanoramaAba`        | (route)              | Composição — 4 children sem grid                                          |
| `PanHeader`          | `bm`                 | Título + sub                                                              |
| `AspectosCards`      | `p`                  | Grid 3-col com 3 AspectoCard (técnico/econômico/físico)                   |
| `AspectoCard`        | `a, icon`            | Card sem border colorida + tag UPPERCASE no header + texto + próxima ação |
| `SubKpisCard`        | `kpis`               | Card com 4 sub-KPIs em grid                                               |
| `SubKpi`             | `k`                  | KPI com dot + label + valor + nota                                        |
| `MatrizImpactosCard` | `linhas, bm`         | Tabela ou empty state + Legenda                                           |
| `ImpactoCell`        | `nivel`              | Dot colorido ou "—" se null                                               |
| `Legenda`            | —                    | 4 dots de farol + indicador "— sem impacto"                               |
| `NexoCausalCard`     | `linhas, resumo, bm` | Tabela 6 cols ou empty state + aside resumo                               |
| `NexoLinha`          | `l`                  | 1 linha com Stars na última col                                           |
| `Stars`              | `n`                  | 5 estrelas, n preenchidas                                                 |
| `FormattedText`      | `text`               | Parser inline `**bold**`                                                  |

### Constantes

- `FAROL_COLOR`, `FAROL_LABEL` (padrão)
- `CATEGORIAS`: array fixo das 5 categorias da Matriz de Impactos (chave + label)

---

## 6. Binding componente ↔ dados

| Componente                    | Campos consumidos                                                                | Visualização                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `AspectosCards` (3 cards)     | `p.aspecto{Tecnico, Economico, Fisico}`                                          | 3 cards com ícone diferente (settings/wallet/pkg)                             |
| `AspectoCard`                 | `a.titulo, a.farol, a.farolLabel, a.texto, a.proximaAcao`, `icon`                | Card com tag UPPERCASE colorida + texto formatado + linha "próx. ação: ..."   |
| `SubKpisCard`                 | `p.tecnicoSubKpis[]` (sempre 4)                                                  | Card com header "Aspecto Técnico · Detalhamento" + grid 4 sub-KPIs            |
| `SubKpi`                      | `k.label, k.valor, k.nota, k.farol`                                              | Item com dot colorido na label                                                |
| `MatrizImpactosCard` (header) | `bm.numero`                                                                      | "Matriz de Impactos · BM-09"                                                  |
| `MatrizImpactosCard` (tabela) | `linhas[]` mapeado por categoria de `CATEGORIAS`                                 | Tabela 6 cols: evento + 5 categorias (Prazo/Custo/Qualidade/Segurança/Escopo) |
| `ImpactoCell`                 | `linha[categoria]`                                                               | Dot colorido ou "—"                                                           |
| `Legenda`                     | —                                                                                | 4 dots (Crítico/Risco/Observação/Conforme) + "— sem impacto"                  |
| `NexoCausalCard` (header)     | `linhas.length`, `bm.numero`                                                     | "Matriz de Nexo Causal · N eventos-chave do BM-09"                            |
| `NexoLinha`                   | `l.fato, l.documentos, l.embasamento, l.hipotese, l.quantifLabel, l.forcaMerito` | 6 cols: 4 textos + valor à direita + estrelas                                 |
| `Stars`                       | `l.forcaMerito`                                                                  | 5 estrelas, `n` preenchidas (★★★★☆)                                           |
| `NexoCausalCard` (resumo)     | `nexoResumo`                                                                     | Aside abaixo da tabela com texto IA                                           |

### Layout pai

```
main.pan-main
├─ PanHeader
├─ AspectosCards (3-col)
├─ SubKpisCard (full-width — só técnico)
├─ MatrizImpactosCard (full-width)
└─ NexoCausalCard (full-width)
```

> **Nota**: sem grid 2-col aqui. Tudo full-width empilhado verticalmente.

---

## 7. Lógica e regras

- **Sem `useState`** — 100% derivado do BM
- **Comentário explícito no arquivo**: "cards SEM border-top ou border-left colorida (decisão do user). Farol é comunicado por: tag UPPERCASE colorida + dot/pill"
- **Ícones por aspecto** (não vêm do mock — hardcoded em `AspectosCards`):
  - Técnico: `I.settings`
  - Econômico: `I.wallet`
  - Físico: `I.pkg`
- **Sub-KPIs sempre 4** — convenção. Mock sempre traz Projetos / RDOs / RNCs / Segurança (mas type não força — é `PanoramaSubKpi[]`)
- **`ImpactoCell` com null → "—"** — visualmente leve, mostra que ausência não é erro
- **`Stars` com `title`** acessível — `Força no mérito ${n}/5`
- **Empty state em 2 lugares**: `MatrizImpactosCard` e `NexoCausalCard` quando arrays vazios — ícone check + texto positivo
- **`CATEGORIAS` array fixo** define ORDEM das colunas e LABELS (não usa o key do type direto)

---

## 8. Dependências e relações com outras abas

- **De onde vêm os dados**:
  - Loader padrão
  - **Conceitualmente** consolida `analiseResp.eventos` (aba Responsabilidade) + `prazo.windowsEventos` (aba Prazo) + dados do M3 (cada nexo tem `quantifLabel` preliminar). No mock os dados são pré-calculados — mas em produção será derivado
- **Para onde os dados vão**:
  - **M3.10 Gerador de Claim** consome `nexoCausal[]` literalmente como estrutura do dossiê probatório (mesmas 5 colunas)
  - **Aba Condutas** sugere ações pra eventos com `forcaMerito >= 4` (5+ estrelas geralmente)
  - **Dashboard** (rota top-level) agrega `aspecto{Tecnico,Economico,Fisico}.farol` por contrato pra visão de portfólio
- **Helpers usados**: `getContract`, `getVisaoGeral`, `getBm`
- **Importância estratégica**: esta aba é onde o **agente IA agrega tudo num formato apresentável**. Visão Geral / Indicadores são para gerente; Panorama é para **stakeholders externos** (cliente, jurídico, diretor)
