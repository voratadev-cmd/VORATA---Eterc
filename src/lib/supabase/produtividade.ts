// Read-model da Normalização (Camada C) · lê a produtividade FÍSICA normalizada
// (obra_produtividade · kg de aço por person-hora real). Só leitura (anon SELECT na migration 0003).
// É produtividade FÍSICA (kg/Hh) — distinta do comparativo de CUSTO (R$/Hh) da aba Produtividade,
// que depende de CONTAS PAGAS + benchmarks externos. Alimenta o blocoProdutividade dos Indicadores.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type ProdutividadeReal = {
  /** Produtividade física real = Σaço / Σ(horas×armadores), em kg por person-hora. */
  produtividadeRealKgPh: number | null;
  acoTotalKg: number | null;
  /** Avanço físico do controle (CONTEXTO suplementar — o oficial é o BM-03, §4.1). */
  avancoFisicoPct: number | null;
  /** Índice de perda de aço CRU (% — pode ser anômalo). */
  indicePerdaRaw: number | null;
  /** true quando o índice de perda > 100% (anomalia de unidade/fórmula na origem). */
  perdaAnomalia: boolean;
  nMeses: number;
};

/** Produtividade física real de uma obra. Null se não normalizada. */
export async function getProdutividade(contractId: string): Promise<ProdutividadeReal | null> {
  const { data, error } = await untypedTable("obra_produtividade")
    .select("produtividade_real_kg_ph, aco_total_kg, avanco_fisico_pct, indice_perda_pct_raw")
    .eq("contrato_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  if (!data) return null;
  const d = data as {
    produtividade_real_kg_ph: number | null;
    aco_total_kg: number | null;
    avanco_fisico_pct: number | null;
    indice_perda_pct_raw: number | null;
  };
  const perda = d.indice_perda_pct_raw != null ? Number(d.indice_perda_pct_raw) : null;

  const { count } = await untypedTable("obra_produtividade_meses")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", contractId);

  return {
    produtividadeRealKgPh:
      d.produtividade_real_kg_ph != null ? Number(d.produtividade_real_kg_ph) : null,
    acoTotalKg: d.aco_total_kg != null ? Number(d.aco_total_kg) : null,
    avancoFisicoPct: d.avanco_fisico_pct != null ? Number(d.avanco_fisico_pct) : null,
    indicePerdaRaw: perda,
    perdaAnomalia: perda != null && perda > 100,
    nMeses: count ?? 0,
  };
}
