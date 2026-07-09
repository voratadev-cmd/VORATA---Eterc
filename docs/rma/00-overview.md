# RMA — Visão geral

> Documentação técnica do módulo RMA (Relatório Mensal de Acompanhamento) — M2.1.2 do produto. Este arquivo cobre o contexto compartilhado por todas as 12 abas. Cada aba tem seu próprio doc detalhado nos arquivos `01-` a `12-` desta pasta.

---

## 1. O que é o RMA

**RMA** = Relatório Mensal de Acompanhamento. É o **entregável mensal** da administração contratual de uma obra — onde o gerente de contrato passa a **maior parte do tempo** durante a execução. Substitui o trabalho artesanal de consultorias (planilhas Excel + Word + PowerPoint) por uma plataforma viva, alimentada por agentes de IA especializados.

### Quem usa

- **Gerente de contrato** — operação diária (jornada principal)
- **Jurídico** — quando construindo pleitos / arbitragem
- **Diretor / dono** — leitura agregada (também via Dashboard)

### Jornada típica

1. Abre `Visão Geral` ou `Indicadores e Farol` → vê faróis dos 6 blocos do BM atual
2. Algum farol vermelho/amarelo? Mergulha na aba específica (Faturamento, Recursos, Prazo, etc.)
3. Identificou desvio → vai `Curvas Lib×Cap×Aloc` pra diagnosticar se gargalo é da **Contratante** (Liberação baixa) ou **Contratada** (Capacidade baixa)
4. Confirma classificação em `Responsabilidade` (tem evidência documental?)
5. Consolida em `Panorama` → matriz de nexo causal pronta pra virar pleito (alimenta M3)
6. Aciona `Condutas` → gera a carta/notificação/PPN
7. Atualiza `Plano de Ação` com nova ação 5W2H

### Vocabulário essencial

| Termo                | Definição                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BM**               | Boletim de Medição. Snapshot mensal do contrato. Numerados BM-01, BM-02… até o fim contratual                                                      |
| **Curva S**          | Gráfico acumulado de faturamento contratado × realizado ao longo dos BMs                                                                           |
| **Windows Analysis** | Análise janela-a-janela (BM-a-BM) dos eventos que impactaram o cronograma                                                                          |
| **Measured Mile**    | Período de referência de produtividade "ideal" usado pra comparar com períodos impactados                                                          |
| **Total Cost**       | Método de cálculo de perda de produtividade (custo total real − custo total previsto, atribuído a causas externas)                                 |
| **Pleito / Claim**   | Pedido formal de reequilíbrio/aditivo (prazo/preço) endereçado à Contratante                                                                       |
| **Nexo Causal**      | Cadeia que liga **fato → documento que comprova → cláusula contratual → hipótese de desequilíbrio → quantificação**. Sem ela, não há pleito viável |
| **MOD / MOI / EQP**  | Mão de Obra Direta / Indireta / Equipamentos                                                                                                       |
| **HH**               | Hora-Homem (unidade de medida de produtividade)                                                                                                    |
| **RDO**              | Relatório Diário de Obra                                                                                                                           |
| **TAC**              | Termo de Aditamento Contratual                                                                                                                     |

Referência completa: [`docs/01-system.md`](../01-system.md#glossário) e [`CLAUDE.md`](../../CLAUDE.md#vocabulário-essencial).

---

## 2. Shell e roteamento

### 2.1 Layout pai

**Arquivo**: [`src/routes/_app/contracts/$contractId/rma.tsx`](../../src/routes/_app/contracts/$contractId/rma.tsx)

O TanStack Router file-based usa convenção: um arquivo `rma.tsx` ao lado da pasta `rma/` vira automaticamente o **layout pai** das rotas dentro de `rma/`. Renderiza:

```tsx
<>
  <Breadcrumb contract={contract} />                       // Dashboard > Gestão Contratual > <contrato> > RMA
  <PageHeader
    title={`RMA · ${contract.nome}`}
    subtitle={`Contrato ${visao.contratoNumero} · ${bm.numero} · semana ${bm.semana} · data de corte ${fmtDate(bm.dataCorteISO)}`}
    actions={<BmSeletor visao={visao} bm={bm} />}          // dropdowns Ano + Mês à direita
  />
  <RmaTabs contractId={contract.id} bm={bm} search={{ bm: search.bm }} />
  <Outlet />                                               // renderiza a aba ativa
</>
```

- **Loader pai**: `getContract(contractId)` + `getVisaoGeral(contractId)`, throw `notFound()` se faltar
- **validateSearch**: `{ bm?: string }`
- **head**: `<title>` dinâmico com `contract.nome`

### 2.2 BmSeletor

Componente **inline** definido em [`rma.tsx:111-171`](../../src/routes/_app/contracts/$contractId/rma.tsx). 2 dropdowns nativos (Ano + Mês):

- Lista de anos: `listAnosBms(visao)` — Set único dos `bm.ano`, ordenado desc
- Lista de meses: `listMesesBms(visao, bm.ano)` — meses (1-12) que têm BM no ano
- Ao trocar Ano: pega lista de meses do novo ano, mantém mês se existir senão pega o último disponível
- Ao trocar Mês: `getBmByAnoMes(visao, ano, mes)` → `navigate({ to: ".", search: prev => ({ ...prev, bm: alvo.numero }), replace: true })`
- Badge indicador:
  - `bm.numero === visao.bmCorrente` → "corrente" (✓ verde)
  - senão → "histórico" (relógio cinza)

### 2.3 RmaTabs

**Arquivo**: [`src/components/RmaTabs.tsx`](../../src/components/RmaTabs.tsx)

Navegação horizontal com **12 abas**. Cada `<Link>` aponta pra `/contracts/<id>/rma/<tab-id>?bm=<numero>` — preservando o BM ativo entre as abas. Algumas têm **dot colorido** derivado do farol do bloco correspondente:

| Tab id             | Label               | Dot vem de                    |
| ------------------ | ------------------- | ----------------------------- |
| `visao-geral`      | Visão Geral         | —                             |
| `indicadores`      | Indicadores e Farol | `bm.situacao`                 |
| `faturamento`      | Faturamento         | `bm.blocoFaturamento.nivel`   |
| `recursos`         | Recursos            | `bm.blocoRecursos.nivel`      |
| `produtividade`    | Produtividade       | `bm.blocoProdutividade.nivel` |
| `prazo`            | Prazo               | `bm.blocoPrazo.nivel`         |
| `insumos`          | Insumos             | `bm.blocoInsumos.nivel`       |
| `curvas`           | Curvas Lib×Cap×Aloc | —                             |
| `responsabilidade` | Responsabilidade    | —                             |
| `panorama`         | Panorama            | —                             |
| `condutas`         | Condutas            | —                             |
| `plano-acao`       | Plano de Ação       | —                             |

### 2.4 Index redirect

**Arquivo**: [`src/routes/_app/contracts/$contractId/rma/index.tsx`](../../src/routes/_app/contracts/$contractId/rma/index.tsx)

`beforeLoad` lança `redirect({ to: "/contracts/$contractId/rma/visao-geral" })` preservando o search `?bm=`. Resultado: `/contracts/<id>/rma/` sempre vira `/contracts/<id>/rma/visao-geral`.

---

## 3. Modelo de dados global

### 3.1 `BmSnapshot` (campos raiz — não pertencem a nenhuma aba isolada)

Definido em [`src/lib/mocks/obras/types.ts:442`](../../src/lib/mocks/obras/types.ts). Campos consumidos por **múltiplas** abas:

```
BmSnapshot
├─ numero: string                              // "BM-09"
├─ ano: number                                 // 2026
├─ mes: number                                 // 1-12
├─ semana: number                              // semana acumulada do contrato
├─ dataCorteISO: string                        // "2026-05-15"
├─ desequilibrioAcumulado: number              // R$
├─ desequilibrioMesAtual: number               // R$ do mês
├─ desequilibrioPctValor: number               // % sobre contratual
├─ faturamentoPct: number                      // % faturado total
├─ faturamentoContratadoPct: number            // % contratado da janela
├─ prazoDecorridoDias: number
├─ situacao: FarolLevel                        // farol geral do BM
├─ situacaoLabel: string                       // "RISCO · 4 blocos em alerta"
├─ diagnostico: string                         // texto longo da IA (1 parágrafo)
├─ diagnosticoHora: string                     // "14:32" (quando IA gerou)
├─ chatRodapeQuote: string                     // (legado — chat removido)
│
├─ Blocos de farol (6 — alimentam dots da RmaTabs e cards das abas Visão Geral / Indicadores):
│   ├─ blocoFaturamento: BlocoFarol
│   ├─ blocoRecursos: BlocoFarol
│   ├─ blocoProdutividade: BlocoFarol
│   ├─ blocoPrazo: BlocoFarol
│   ├─ blocoInsumos: BlocoFarol
│   └─ blocoDesequilibrio: BlocoFarol
│
├─ ultimosEventos: EventoIA[]                  // alertas pontuais da IA
│
├─ Campos da aba "Indicadores e Farol" (5.3.1):
│   ├─ blocosContagem: { criticos, risco, observacao, conforme: number }
│   ├─ aderenciaMesPct: number                 // faturado vs previsto do mês
│   ├─ forcaNoMerito: number                   // 1-5 estrelas
│   ├─ forcaNoMeritoNota: string
│   ├─ acaoRecomendada: { titulo: string; cta: string }
│   ├─ curvas: { liberacaoPct/Nota, capacidadePct/Nota, alocadoPct/Nota, diagnostico }
│   ├─ marcos: Array<{ id, titulo, descricao, statusLabel, statusFarol }>
│   ├─ responsabilidade: { contratante/contratada/terceiro/forcaMaior }
│   └─ chatSugestoesIndicadores: Array<{ id, texto }>  // (legado)
│
└─ Campos aninhados (1 por aba — type específico):
    ├─ faturamento: FaturamentoBM           → doc 03
    ├─ recursos: RecursosBM                 → doc 04
    ├─ produtividade: ProdutividadeBM       → doc 05
    ├─ prazo: PrazoBM                       → doc 06
    ├─ insumos: InsumosBM                   → doc 07
    ├─ curvasAnalise: CurvasAnaliseBM       → doc 08
    ├─ analiseResp: AnaliseRespBM           → doc 09
    ├─ panorama: PanoramaBM                 → doc 10
    ├─ condutas: CondutasBM                 → doc 11
    └─ planoAcao: PlanoAcaoBM               → doc 12
```

### 3.2 `VisaoGeralData` (envelope da obra)

```
VisaoGeralData
├─ contractId: string
├─ contratoNumero: string                   // metadata da obra (não varia por BM)
├─ prazoTotalDias: number
├─ terminoPrevistoISO: string
├─ sinteseResumida: SinteseResumida         // dados fixos do contrato (cliente, gestor, valor, prazo)
├─ entregaveis: EntregavelAtalho[]          // atalhos de "Gerar/Atualizar RMA·BM-09", etc.
├─ bms: BmSnapshot[]                        // lista do mais antigo ao mais recente
└─ bmCorrente: string                       // "BM-09" — default ao entrar
```

### 3.3 Tipos auxiliares compartilhados

```ts
type FarolLevel = "critico" | "risco" | "observacao" | "conforme";

type BlocoFarol = {
  valor: string; // "-15,7%" / "+18%" / "R$ 12,4 mi"
  nivel: FarolLevel;
  descricao: string; // "Real R$ 44,1 mi · Contratado R$ 52,3 mi acum."
  nota: string; // "aderência no mês: 78%"
};

type EventoIA = {
  id: string;
  nivel: FarolLevel;
  titulo: string;
  meta: string; // "há 4h · Agente de Medição · sugestão de impugnação"
};

type EntregavelAtalho = {
  id: string;
  label: string; // "RMA · BM-09"
  acao: string; // "Gerar" / "Atualizar"
  descricao: string; // "consolidado mensal"
  icon: "doc" | "note" | "tag" | "check" | "calendar" | "users";
};

type SinteseResumida = {
  cliente;
  modalidade;
  valorContratado;
  saldoFaturar: string;
  assinaturaISO;
  terminoPrevistoISO: string;
  prazoLabel: string; // "184 / 540 dias (34%)"
  reajuste: string; // "IPCA · anual"
  gestorObra;
  admContratual: string;
  documentosIndexados;
  tacsEmNegociacao: number;
};
```

### 3.4 Helpers de mock

**Arquivo**: [`src/lib/mocks/obras/index.ts`](../../src/lib/mocks/obras/index.ts)

| Função              | Assinatura             | Retorno                                                           |
| ------------------- | ---------------------- | ----------------------------------------------------------------- |
| `getObra`           | `(contractId: string)` | `ObraData \| undefined` — dados completos da obra                 |
| `getSintese`        | `(contractId)`         | `SinteseObra \| undefined` — M2.1.1                               |
| `getRevisao`        | `(contractId)`         | `RevisaoDocumental \| null \| undefined` — M1.1                   |
| `getBases`          | `(contractId)`         | `BasesData \| null \| undefined` — M1.2                           |
| `getDiagnostico`    | `(contractId)`         | `DiagnosticoData \| null \| undefined` — M1.3                     |
| `getTranspasse`     | `(contractId)`         | `TranspasseData \| null \| undefined` — M1.4                      |
| **`getVisaoGeral`** | `(contractId)`         | `VisaoGeralData \| null \| undefined` — **entry RMA**             |
| **`getBm`**         | `(visao, numero?)`     | `BmSnapshot` — BM solicitado ou `bmCorrente`; fallback pro último |
| `getBmByAnoMes`     | `(visao, ano, mes)`    | `BmSnapshot \| undefined` — usado pelo BmSeletor                  |
| `listAnosBms`       | `(visao)`              | `number[]` — anos com BMs, ordem desc                             |
| `listMesesBms`      | `(visao, ano)`         | `number[]` — meses 1-12 com BM no ano                             |

Catálogo de contratos: [`src/lib/mocks/contracts.ts`](../../src/lib/mocks/contracts.ts) → `getContract(id) → Contract | undefined`.

---

## 4. Padrões transversais nas 12 abas

### 4.1 Boilerplate idêntico de Route

Cada `<aba>.tsx` declara:

```ts
type <Slug>Search = { bm?: string };

export const Route = createFileRoute("/_app/contracts/$contractId/rma/<slug>")({
  component: <Slug>Aba,
  validateSearch: (s) => ({ bm: typeof s.bm === "string" ? s.bm : undefined }),
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const visao = getVisaoGeral(params.contractId);
    if (!visao) throw notFound();
    return { contract, visao };
  },
});

function <Slug>Aba() {
  const { visao } = Route.useLoaderData();
  const search = Route.useSearch();
  const bm = getBm(visao, search.bm);
  // ... usa bm.<seuTypeDaAba>
}
```

> Oportunidade futura: extrair pra `createRmaRoute(slug, Component)` — 12 cópias quase idênticas hoje.

### 4.2 Constantes de farol

Cada aba **redeclara** os mesmos mapas (oportunidade DRY):

```ts
const FAROL_COLOR = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
} as const;

const FAROL_LABEL = {
  critico: "CRÍTICO",
  risco: "RISCO",
  observacao: "OBSERVAÇÃO", // alguns: "OBS"
  conforme: "CONFORME",
} as const;
```

### 4.3 Layout interno

Padrão de cada aba:

```tsx
<main className="<prefix>-main">
  <<Aba>Header bm={bm} />                  // título + sub local (não é o PageHeader pai)
  <KpisHero {...bm.<seuType>} />           // 3-6 KpiCards horizontais
  {/* Cards/Charts/Tables específicos */}
</main>
```

Prefixos CSS por aba: `vg-`, `ind-`, `fat-`, `rec-`, `prod-`, `prz-`, `ins-`, `cur-`, `rsp-`, `pan-`. Sem compartilhamento entre abas — cada uma reimplementa header/kpi-card/section local.

### 4.4 Gráficos (Recharts)

- **LineChart** — Faturamento (Curva S), Recursos (curva acumulada), Produtividade (evolução HH), Prazo (avanço físico), Insumos (índices), Curvas (Lib×Cap×Aloc)
- **BarChart** — Recursos (barras mensais), Produtividade (comparativo)
- **ComposedChart** — Curvas (linhas + área de gap)
- **PieChart** — Visão Geral (mini gráficos)
- Padrões comuns: `ResponsiveContainer`, `CartesianGrid`, `Tooltip`, `XAxis`/`YAxis`, `ReferenceLine` pra marcar BM corrente

---

## 5. Sistema de Farol (4 níveis)

| Nível        | Cor (CSS)        | Quando                             |
| ------------ | ---------------- | ---------------------------------- |
| `conforme`   | `var(--success)` | dentro da tolerância contratual    |
| `observacao` | `var(--info)`    | atenção, ainda OK                  |
| `risco`      | `var(--warning)` | risco real, ação preventiva        |
| `critico`    | `var(--danger)`  | risco materializado, ação imediata |

Critérios **variam por aba** (configuráveis). Exemplo do Faturamento ([`docs/04-m2-gestao-contratual.md`](../04-m2-gestao-contratual.md) §5.3.2):

| Nível      | Desvio %      |
| ---------- | ------------- |
| Conforme   | até −1%       |
| Observação | −1% a −5%     |
| Risco      | −5% a −15%    |
| Crítico    | acima de −15% |

Cada doc por aba lista os critérios específicos quando relevantes.

---

## 6. Estado do mock

### `aeroporto-uberlandia.ts` (mock principal)

- **10.708 linhas** em [`src/lib/mocks/obras/aeroporto-uberlandia.ts`](../../src/lib/mocks/obras/aeroporto-uberlandia.ts)
- **9 BMs preenchidos** (BM-01 a BM-09); BM-10..BM-18 só com `contratado` na Curva S (projeção)
- BM-09 é o **corrente** (`visao.bmCorrente === "BM-09"`)
- Todas as 10 abas têm dados (faturamento, recursos, produtividade, prazo, insumos, curvasAnalise, analiseResp, panorama, condutas, planoAcao) + os campos da aba Indicadores (blocosContagem, aderenciaMesPct, forcaNoMerito, marcos, responsabilidade, curvas)
- Função `buildCurvaSAeroporto()` gera a Curva S dinâmica a partir de `CONTRATADO_ACUM` (18 BMs) + `REAL_ACUM` (9 BMs)

### `hospital-jureia.ts` (secundário)

Mock alternativo, mesmo shape. Usado pra demonstrar diversidade de contratos.

---

## 7. Índice dos 12 docs

| #   | Aba                         | Doc                                              | Slug rota               | Type raiz                                         |
| --- | --------------------------- | ------------------------------------------------ | ----------------------- | ------------------------------------------------- |
| 01  | Visão Geral                 | [01-visao-geral.md](01-visao-geral.md)           | `visao-geral` (default) | `BmSnapshot` (raiz) + `VisaoGeralData`            |
| 02  | Indicadores e Farol         | [02-indicadores.md](02-indicadores.md)           | `indicadores`           | `BmSnapshot` (campos da §5.3.1)                   |
| 03  | Faturamento                 | [03-faturamento.md](03-faturamento.md)           | `faturamento`           | `bm.faturamento: FaturamentoBM`                   |
| 04  | Recursos · MOD/MOI/EQP      | [04-recursos.md](04-recursos.md)                 | `recursos`              | `bm.recursos: RecursosBM`                         |
| 05  | Produtividade               | [05-produtividade.md](05-produtividade.md)       | `produtividade`         | `bm.produtividade: ProdutividadeBM`               |
| 06  | Prazo e Cronograma          | [06-prazo.md](06-prazo.md)                       | `prazo`                 | `bm.prazo: PrazoBM`                               |
| 07  | Insumos                     | [07-insumos.md](07-insumos.md)                   | `insumos`               | `bm.insumos: InsumosBM`                           |
| 08  | Curvas Lib×Cap×Aloc         | [08-curvas.md](08-curvas.md)                     | `curvas`                | `bm.curvasAnalise: CurvasAnaliseBM`               |
| 09  | Análise de Responsabilidade | [09-responsabilidade.md](09-responsabilidade.md) | `responsabilidade`      | `bm.analiseResp: AnaliseRespBM`                   |
| 10  | Panorama do Contrato        | [10-panorama.md](10-panorama.md)                 | `panorama`              | `bm.panorama: PanoramaBM`                         |
| 11  | Condutas Sugeridas          | [11-condutas.md](11-condutas.md)                 | `condutas`              | `bm.condutas: CondutasBM` (via `CondutasView`)    |
| 12  | Plano de Ação               | [12-plano-acao.md](12-plano-acao.md)             | `plano-acao`            | `bm.planoAcao: PlanoAcaoBM` (via `PlanoAcaoView`) |

---

## 8. Observações arquiteturais conhecidas

1. **`Visão Geral` × `Indicadores e Farol`** — sobreposição grande (hero strip, diagnóstico, faróis dos blocos). Provavelmente uma vai absorver a outra no futuro.
2. **`FAROL_COLOR` duplicado** em 12 arquivos. Deveria viver em `src/components/ds/` ou `tokens.css`.
3. **12 prefixos CSS diferentes** reimplementam padrões similares (kpi-card, hero-cell, header local). Componentes `KpiCard` e `HeroCard` do DS existem mas não são usados consistentemente.
4. **Boilerplate de Route** quase idêntico em todas as 12 abas — daria pra extrair `createRmaRoute(slug, Component)`.
5. **Condutas** e **Plano de Ação** são wrappers finos: `condutas.tsx` renderiza `<CondutasView>` e `plano-acao.tsx` renderiza `<PlanoAcaoView>`. Esses 2 componentes em [`src/components/pages/`](../../src/components/pages/) são **compartilhados** também com `/contracts/$id/condutas` e `/contracts/$id/plano-acao` (rotas top-level fora do RMA).
6. **Componente de chat** foi removido (junho/2026) em todas as 12 abas. Campos `chatQuote`, `chatSugestoes`, `chatAgentQuote` continuam nos types do mock mas **não são consumidos** mais — limpeza pendente.
