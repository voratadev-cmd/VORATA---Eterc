// Read-model dos CARDS oficiais em QUANTIDADE da C.4 — seção "C.4 — Cards por categoria
// (quantidade)" do workbook (dialeto SBSO). É o eixo QTD que a aba declara para os cards
// (MOD 215/85/51): o histograma mensal (obra_recursos_meses) guarda Hh no MOD, e exibi-lo
// nos cards era o bug da spec ajustes-REVISADO-v3 §C.4.1. A aderência acumulada NÃO sai
// daqui — permanece no eixo Hh/série (59,7%), como a mesma spec exige (nota de consistência).
// Obras sem a seção (BR-101) → null e a tela segue no histograma (fluxo atual intocado).

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { RecursoTipo } from "./recursos";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

export type CardsQtdeCat = {
  /** ① Total do contrato (qtde). */
  totalContrato: number | null;
  /** ② Contratado até o período (qtde). */
  contratadoBm: number | null;
  /** ③ Real até o período (qtde). */
  realBm: number | null;
};
export type RecursosCardsQtde = Record<RecursoTipo, CardsQtdeCat>;

const CATS: RecursoTipo[] = ["MOD", "MOI", "EQP"];

/** Cards por categoria (qtde) da fonte. null quando a obra não tem a seção. */
export async function getRecursosCardsQtde(contractId: string): Promise<RecursosCardsQtde | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", "%C.4 — Cards por categoria (quantidade)%")
    .limit(1);
  if (error) throw new Error(error.message);
  const rows = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Linhas {metrica, MOD, MOI, EQP} — a métrica identifica o card (①/②/③ no rótulo da fonte).
  const linha = (frag: string): Row | null =>
    (rows as Row[]).find((r) => String(r["metrica"] ?? "").includes(frag)) ?? null;
  const total = linha("Total do contrato");
  const contratado = linha("Contratado até o período");
  const real = linha("Real até o período");
  if (!total && !contratado && !real) return null;

  const out = {} as RecursosCardsQtde;
  for (const cat of CATS) {
    out[cat] = {
      totalContrato: total ? num(total[cat]) : null,
      contratadoBm: contratado ? num(contratado[cat]) : null,
      realBm: real ? num(real[cat]) : null,
    };
  }
  return out;
}
