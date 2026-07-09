// Mock do Chat com o Adm Contratual IA (frontend · sem backend). Threads seeded (histórico),
// prompts sugeridos e um gerador de respostas mockadas que conversa "sobre os dados normalizados da
// obra" — keyword-matched, com chain-of-thought ("pensando"), markdown e INSIGHTS (dados-chave que a
// IA "salva" no painel de resumo). Os números são coerentes com as telas reais (BR-101: faturamento
// −50%, prazo 8,6%, recursos pendentes). Quando o backend entrar, troca-se `gerarResposta`; a UI não muda.

export type ChatRole = "user" | "agent";

/** Tom do dado-chave (espelha o farol do DS). */
export type InsightTom = "neutral" | "success" | "info" | "warning" | "danger";

/** Dado-chave extraído da conversa (mostrado no painel de resumo). */
export type Insight = { label: string; valor: string; tom?: InsightTom };

/** Estado de uma resposta do agente real (backend) — espelha metadata.status do adm_messages. */
export type ChatStatus = "thinking" | "streaming" | "done" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string; // markdown leve
  ts: number; // epoch ms
  /** Só no agente: traço de raciocínio + quanto "pensou" (ms). */
  thinking?: { trace: string; durationMs: number };
  /** Só no agente: dados-chave que essa resposta destacou. */
  insights?: Insight[];
  /** Só no agente real: resposta ainda em geração (pensando/streaming). */
  streaming?: boolean;
  /** Só no agente real: status do backend (metadata.status). */
  status?: ChatStatus;
};

export type ChatThread = {
  id: string;
  title: string;
  contractId: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  messages: ChatMessage[];
};

let _seq = 0;
/** Id estável por sessão (sem Math.random → keys previsíveis). */
export function uid(prefix = "id"): string {
  _seq += 1;
  return `${prefix}-${_seq}`;
}

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Prompts sugeridos no estado inicial (e como chips). Refletem os módulos do RMA/M3. */
export const SUGESTOES: Array<{ icon: string; texto: string }> = [
  { icon: "wallet", texto: "Qual o desvio de faturamento e onde está o gargalo?" },
  { icon: "clock", texto: "A obra está dentro do prazo? Qual a tendência de término?" },
  { icon: "users", texto: "Tem indício de perda de produtividade nos recursos?" },
  { icon: "flag", texto: "Quais marcos contratuais estão em risco?" },
  { icon: "trending", texto: "Vale abrir um pleito de reequilíbrio agora?" },
];

/** Histórico seeded da obra (parametrizado pelo contrato; timestamps relativos a `agora`). */
export function seedThreads(contractId: string, agora: number): ChatThread[] {
  const t = (offset: number) => agora - offset;
  return [
    {
      id: uid("th"),
      title: "Desvio de faturamento no BM-04",
      contractId,
      createdAt: t(2 * HORA),
      updatedAt: t(2 * HORA),
      pinned: true,
      messages: [
        {
          id: uid("m"),
          role: "user",
          content: "Por que o faturamento está 50% abaixo do previsto?",
          ts: t(2 * HORA + 3 * MIN),
        },
        {
          id: uid("m"),
          role: "agent",
          ts: t(2 * HORA),
          thinking: {
            durationMs: 2600,
            trace:
              "Lendo o desvio acumulado do faturamento (C.3) e a curva contratada × real até o corte. Cruzo com a alocação de recursos e os marcos para localizar o gargalo.",
          },
          content:
            "O **desvio acumulado é −50%** até o BM-04: real **R$ 21 mi** contra **R$ 41 mi** contratados — farol **Crítico**.\n\nA leitura por frente aponta o gargalo em **Terraplenagem** e **Pavimentação**, onde o real por trecho ainda está *a medir* (Planilha de Quantidades pendente).\n\nNo ritmo atual (R$ 5,73 mi/mês), a **projeção de término é o mês 107** — **+61 meses** sobre o prazo. Isso já é gatilho para o **Painel de Desequilíbrio (M3)**.",
          insights: [
            { label: "Desvio acumulado", valor: "−50%", tom: "danger" },
            { label: "Real até BM-04", valor: "R$ 21 mi / R$ 41 mi" },
            { label: "Gargalo", valor: "Terraplenagem + Pavimentação", tom: "warning" },
            { label: "Projeção de término", valor: "mês 107 · +61 meses", tom: "warning" },
          ],
        },
      ],
    },
    {
      id: uid("th"),
      title: "Marcos em risco — taludes",
      contractId,
      createdAt: t(1 * DIA + 4 * HORA),
      updatedAt: t(1 * DIA + 4 * HORA),
      messages: [
        {
          id: uid("m"),
          role: "user",
          content: "Lista os marcos contratuais que estão em risco.",
          ts: t(1 * DIA + 4 * HORA + 2 * MIN),
        },
        {
          id: uid("m"),
          role: "agent",
          ts: t(1 * DIA + 4 * HORA),
          thinking: {
            durationMs: 2200,
            trace: "Filtrando os 24 marcos por farol; isolo os 'Em risco' e checo a data-limite.",
          },
          content:
            "Há **3 marcos Em risco**, todos de **Sinistros de Talude**:\n\n- **km 148+700 · Sul** — limite 2026-09-04\n- **km 149+383 · Norte** — limite 2026-10-04\n- **km 152+800 · Norte** — limite 2026-10-04\n\nOs demais 21 estão **No prazo**. Quer que eu prepare uma carta de registro de impedimento para os três?",
          insights: [
            { label: "Marcos em risco", valor: "3 de 24", tom: "warning" },
            { label: "Categoria", valor: "Sinistros de Talude" },
            { label: "Próximo limite", valor: "04/09/2026", tom: "warning" },
          ],
        },
      ],
    },
    {
      id: uid("th"),
      title: "Cruzamento recursos × produtividade",
      contractId,
      createdAt: t(5 * DIA),
      updatedAt: t(5 * DIA),
      messages: [
        {
          id: uid("m"),
          role: "user",
          content: "Tem perda de produtividade?",
          ts: t(5 * DIA + MIN),
        },
        {
          id: uid("m"),
          role: "agent",
          ts: t(5 * DIA),
          thinking: {
            durationMs: 1800,
            trace: "Comparo a aderência de recursos (até o BM) com o avanço de faturamento.",
          },
          content:
            "Ainda **não caracterizado** neste BM. Faturamento e recursos caminham na mesma faixa (~50%), então não há indício de **perda de produtividade contemporânea**. O ponto de atenção é a **MOI**, que está 0% medida. A quantificação fina (Valor Agregado / Total Cost) fica no **Módulo 3**.",
          insights: [
            { label: "Produtividade", valor: "sem perda contemporânea", tom: "success" },
            { label: "MOI medida", valor: "0%", tom: "warning" },
            { label: "Aderência recursos", valor: "~50%" },
          ],
        },
      ],
    },
  ];
}

type Resposta = {
  content: string;
  thinking: { trace: string; durationMs: number };
  insights: Insight[];
};

const RESPOSTAS: Array<{ kw: RegExp; r: Resposta }> = [
  {
    kw: /faturament|desvio|curva s|receita|gargalo/i,
    r: {
      thinking: {
        durationMs: 2800,
        trace:
          "Lendo C.3 (faturamento contratado × real). Desvio acumulado, frente com maior gap, e projeção pelo ritmo dos últimos BMs. Cruzo com o prazo para ver se a projeção estoura o contrato.",
      },
      content:
        "O **desvio acumulado de faturamento é −50%** (Crítico) até o BM-04 — real **R$ 21 mi** vs **R$ 41 mi** contratados, sobre um contrato de **R$ 611 mi**.\n\n**Onde está o gargalo**\n- **Terraplenagem** e **Pavimentação** concentram o atraso; o real por frente ainda é *pendente* (entra com a medição por disciplina).\n- O **ritmo médio dos últimos 3 BMs é R$ 5,73 mi/mês** — bem abaixo do previsto (~R$ 12,9 mi/mês).\n\n**Tendência**\n- Projeção de término no ritmo atual: **mês 107** → **+61 meses** sobre o prazo. ⚠️ Já é gatilho de **claim de reequilíbrio**.\n\nQuer que eu abra a quantificação no **Painel de Desequilíbrio**?",
      insights: [
        { label: "Desvio acumulado", valor: "−50%", tom: "danger" },
        { label: "Real / Contratado", valor: "R$ 21 mi / R$ 41 mi" },
        { label: "Ritmo médio · 3 BM", valor: "R$ 5,73 mi/mês", tom: "warning" },
        { label: "Projeção de término", valor: "mês 107 · +61 meses", tom: "warning" },
      ],
    },
  },
  {
    kw: /prazo|atras|cronogram|t[ée]rmino|prorrog/i,
    r: {
      thinking: {
        durationMs: 2400,
        trace:
          "Olhando o prazo contratual, o decorrido e a tendência de término. O físico real está em reconciliação (baseline R0 obsoleto), então a tendência sai pendente — não fabrico número.",
      },
      content:
        "**Prazo contratual: 1.401 dias** (01/03/2026 → 31/12/2029). Decorrido **121 dias (8,6%)** — restam 1.280.\n\n- **Tendência de término:** 31/12/2029 *pendente* — depende do .mpp R0/R1 reconciliado (§4.1).\n- **Prorrogação estimada:** *pendente* — sem físico real medido neste BM.\n- **Windows Analysis:** ainda pendente (depende da matriz de eventos datados · RS + Atas + CEs).\n\nA leitura honesta: **não dá para cravar atraso** sem o baseline reconciliado, mas a **projeção do faturamento já aponta estouro de prazo** — vale priorizar a reconciliação do cronograma.",
      insights: [
        { label: "Prazo contratual", valor: "1.401 dias" },
        { label: "Decorrido", valor: "8,6% · 121 dias" },
        { label: "Tendência de término", valor: "pendente", tom: "info" },
        { label: "Prorrogação", valor: "pendente", tom: "info" },
      ],
    },
  },
  {
    kw: /recurso|produtiv|mod\b|moi\b|equipa|efetivo|m[ãa]o de obra/i,
    r: {
      thinking: {
        durationMs: 2200,
        trace:
          "Comparo a aderência de recursos por categoria (real ÷ contratado até o BM) com o avanço de faturamento. Se recursos ≈ faturamento, não há improdutividade contemporânea.",
      },
      content:
        "**Sem indício de perda de produtividade contemporânea** neste BM.\n\n- Aderência de **faturamento ≈ 50%**, **MOD ≈ 50%**, **EQP ≈ 49%** — todos na mesma faixa, então recursos e avanço caminham juntos.\n- **MOI está 0% medida** — é o ponto cego; entra com a Planilha de Quantidades.\n- O **Valor Agregado** (contratado × avanço) bate com o real nas categorias medidas → alocação coerente.\n\nA quantificação por **Total Cost / Measured Mile** fica no **Módulo 3 (D.4)**, quando a medição real entrar.",
      insights: [
        { label: "Produtividade", valor: "sem perda contemporânea", tom: "success" },
        { label: "Aderência MOD", valor: "~50%" },
        { label: "Aderência EQP", valor: "~49%" },
        { label: "MOI medida", valor: "0%", tom: "warning" },
      ],
    },
  },
  {
    kw: /marco|talude|sinistro|em risco|no prazo/i,
    r: {
      thinking: {
        durationMs: 1900,
        trace:
          "Filtrando os 24 marcos contratuais por farol e ordenando os 'Em risco' por data-limite.",
      },
      content:
        "Dos **24 marcos contratuais**, **3 estão Em risco** — todos de **Sinistros de Talude**:\n\n- **km 148+700 · Sul** — limite **2026-09-04**\n- **km 149+383 · Norte** — limite **2026-10-04**\n- **km 152+800 · Norte** — limite **2026-10-04**\n\nOs outros 21 (Duplicação, OAE, Dispositivos, Drenagem) estão **No prazo**. Posso gerar a **carta de registro de impedimento** dos três taludes — quer?",
      insights: [
        { label: "Marcos em risco", valor: "3 de 24", tom: "warning" },
        { label: "Categoria", valor: "Sinistros de Talude" },
        { label: "Próximo limite", valor: "04/09/2026", tom: "warning" },
        { label: "No prazo", valor: "21 marcos", tom: "success" },
      ],
    },
  },
  {
    kw: /claim|pleito|reequil[íi]brio|desequil[íi]brio|m3|m[óo]dulo 3|aditiv/i,
    r: {
      thinking: {
        durationMs: 3200,
        trace:
          "Checo os gatilhos do M3: desvio de faturamento < −15% (sim, −50%) e projeção estourando o prazo (sim, +61 meses). Vejo o que já está normalizado (D.0/D.1/C.1) e o que falta.",
      },
      content:
        "**Sim — os gatilhos do reequilíbrio já estão acionados:**\n\n1. **Desvio de faturamento −50%** (limiar crítico é −15%).\n2. **Projeção de término +61 meses** sobre o prazo contratual.\n\nO backend de **D.0 (cross-check), D.1 (indiretos) e C.1 (BDI)** já está normalizado e travado ao centavo. O que falta para o **Gerador de Claim** é a quantificação fina (Valor Agregado, Total Cost, Measured Mile) e a matriz de eventos datados para o **nexo causal**.\n\nRecomendo: (1) abrir o **Painel de Desequilíbrio**, (2) lançar a **Planilha de Quantidades** para destravar o real por frente, (3) consolidar a **Windows Analysis**. Quer que eu monte o esqueleto do dossiê?",
      insights: [
        { label: "Gatilho · desvio", valor: "−50% (limiar −15%)", tom: "danger" },
        { label: "Gatilho · prazo", valor: "+61 meses", tom: "warning" },
        { label: "Backend pronto", valor: "D.0 · D.1 · C.1", tom: "success" },
        { label: "Falta p/ o claim", valor: "VA · Total Cost · Windows", tom: "info" },
      ],
    },
  },
];

const FALLBACK: Resposta = {
  thinking: {
    durationMs: 1500,
    trace: "Mapeando a pergunta para os dados que tenho normalizados desta obra.",
  },
  content:
    "Posso te ajudar com os dados normalizados desta obra. Pergunte sobre:\n\n- **Faturamento** — desvio, curva S, gargalo por frente, projeção de término\n- **Prazo** — decorrido × restante, tendência, marcos contratuais\n- **Recursos** — MOD/MOI/EQP, cruzamento com faturamento, produtividade\n- **Desequilíbrio (M3)** — gatilhos de pleito, Valor Agregado, Total Cost\n\nÉ só perguntar em linguagem natural. 🙂",
  insights: [],
};

/** Resposta mockada para uma pergunta (keyword-matched). Quando o agente real entrar, troca aqui. */
export function gerarResposta(pergunta: string): Resposta {
  return RESPOSTAS.find((x) => x.kw.test(pergunta))?.r ?? FALLBACK;
}

/** Agrega os dados-chave da conversa (dedup por label, mantém o valor mais recente). */
/** Insight com a "data que gerou" (ts da resposta onde apareceu) — alimenta a timeline. */
export type InsightCronologico = Insight & { ts: number };

export function coletarInsights(thread: ChatThread): InsightCronologico[] {
  const map = new Map<string, InsightCronologico>();
  for (const m of thread.messages) {
    if (m.role !== "agent" || !m.insights) continue;
    for (const ins of m.insights) {
      const prev = map.get(ins.label);
      // mantém o 1º momento em que o dado surgiu (a "data que gerou"); valor/tom = o mais recente.
      map.set(ins.label, { ...ins, ts: prev?.ts ?? m.ts });
    }
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

/** Título curto derivado da 1ª mensagem do usuário (para a thread nova). */
export function tituloDaPergunta(pergunta: string): string {
  const limpa = pergunta.trim().replace(/\s+/g, " ");
  return limpa.length > 42 ? `${limpa.slice(0, 42).trimEnd()}…` : limpa || "Nova conversa";
}
