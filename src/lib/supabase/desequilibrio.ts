// Read-model do DESEQUILÍBRIO (Camada C · M3) · composição por categoria do painel D.0. Σ categorias =
// desequilíbrio total. Alimenta o D.0, o RMA (Visão Geral/Indicadores) e o Dashboard. Só leitura.
//
// FONTE: lê a captura genérica `obra_secoes` (Bloco 2 "Composição por Categoria", regenerada e travada),
// NÃO a tabela `obra_desequilibrio` (que ficou stale na extração v1: D.1=31,9mi, D.4=0, total 33mi — não
// bate o oráculo). A composição usa a coluna "Valor (R$)" (a "R$ desequilíbrio" do bloco está corrompida).
// CANÔNICO = a coluna "Valor (R$)" da própria Bloco 2, SEM override, p/ TODAS as categorias (inclusive
// a D.4 = Total Cost do período = 736.740,88). Reproduz o total que o workbook DECLARA: R$ 6.287.068
// (= D.1 2.491.837 + D.2 3.058.491 + D.4 736.741), confirmado 2x pela fonte — a Σ das categorias E o
// "% sobre valor contratual" da Bloco 1 (1,0284% × 611.357.315 = 6.287.061). O chat (tools.py
// get_desequilibrio_resumo) lê a MESMA coluna → chat == tela == fonte. (Histórico: já houve override
// do D.4 p/ 5,96mi "ajustado" e p/ 791k "sem-ajuste"; ambos descartados — fixado o literal da fonte.)

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
const normC = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Valor por nome de coluna: match EXATO (normalizado), depois por fragmento. */
function pick(row: Row | null | undefined, ...frags: string[]): unknown {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const f of frags) {
    const k = keys.find((kk) => normC(kk) === normC(f));
    if (k) return row[k];
  }
  for (const f of frags) {
    const k = keys.find((kk) => normC(kk).includes(normC(f)));
    if (k) return row[k];
  }
  return null;
}

/** dados de uma seção por fragmento de título (array de linhas OU objeto chave_valor). null se ausente. */
async function getSecaoDados(contractId: string, tituloFrag: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  // Falha de leitura (RLS/timeout/rede) NÃO pode virar "ausência" silenciosa — erro = milhões.
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
}

// Nome de exibição por tela, caso a coluna "Categoria (natureza)" venha vazia em alguma linha.
const CAT_NOME: Record<string, string> = {
  "D.1": "Custos Indiretos",
  "D.2": "BDI",
  "D.3": "Encargos Sociais",
  "D.4": "Perda de Produtividade",
  "D.6": "Eventos Pontuais",
  "D.7": "Atraso de Pagamento",
  "D.8": "Pleitos Pontuais",
};

export type DesequilibrioCategoriaReal = {
  categoria: string;
  tela: string | null;
  valorRs: number | null;
  pctDoTotal: number | null;
};

export type Desequilibrio = {
  categorias: DesequilibrioCategoriaReal[];
  /** Σ dos valores das categorias = desequilíbrio total (R$). */
  totalRs: number;
  /** Categorias com valor > 0 (as que realmente compõem o desequilíbrio hoje). */
  nComValor: number;
  status: string;
};

/** Desequilíbrio (composição D.0) de uma obra. Null se ainda não normalizado (M3 não rodado). */
export async function getDesequilibrio(contractId: string): Promise<Desequilibrio | null> {
  const b2 = await getSecaoDados(contractId, "D.0 — Bloco 2");
  if (!Array.isArray(b2) || b2.length === 0) return null;

  const cats = (b2 as Row[]).map((r) => {
    const tela = str(pick(r, "tela"));
    const categoria = str(pick(r, "categoria")) ?? (tela ? CAT_NOME[tela] : null) ?? "—";
    // SEMPRE a coluna "Valor (R$)" da fonte (a "R$ desequilíbrio" do bloco está corrompida — ex.: a D.2
    // vem negativa). Sem override por categoria: a D.4 usa o 736.740,88 da própria Bloco 2.
    const valorRs = num(pick(r, "valor (r", "valor (r$)"));
    return { categoria, tela, valorRs };
  });

  const totalRs = cats.reduce((a, c) => a + (c.valorRs ?? 0), 0);
  const categorias: DesequilibrioCategoriaReal[] = cats.map((c) => ({
    ...c,
    // % do total RECOMPUTADO do valor_rs/total (o "% do total" do bloco usa o D.4 pequeno → errado).
    pctDoTotal: totalRs > 0 && c.valorRs != null ? c.valorRs / totalRs : null,
  }));
  const nComValor = categorias.filter((c) => (c.valorRs ?? 0) > 0).length;

  return { categorias, totalRs, nComValor, status: "ok" };
}
