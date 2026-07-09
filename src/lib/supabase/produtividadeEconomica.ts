// Read-model da PRODUTIVIDADE ECONÔMICA (Camada C) · lê obra_produtividade_economica (workbook-motor
// C.7 · R$/HH). Distinta da produtividade FÍSICA (kg/Hh · obra_produtividade, em produtividade.ts).
// Série mensal: faturado, HH previsto/real, R$/HH, aderência. Só leitura (anon SELECT na migration
// 20260606000003). HH real é PARCIAL (obra em execução) → null onde a obra ainda não mediu.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type ProdutividadeEconomicaMes = {
  ano: number;
  mes: number;
  periodoLabel: string | null;
  /** Faturado no mês (R$). */
  faturadoRs: number | null;
  /** Homem-hora previsto/real do mês. real null = ainda não medido. */
  hhPrevisto: number | null;
  hhReal: number | null;
  /** R$/HH real do mês (produtividade econômica: faturado ÷ HH real). */
  rsPorHh: number | null;
  /** Razão R$/HH real ÷ R$/HH contratado (índice econômico; >1 = HH rendeu mais R$ que o contratado).
   * NÃO confundir com HH real÷previsto — essa é calculada no card "ADERÊNCIA HH" da aba. */
  aderencia: number | null;
};

export type ProdutividadeEconomica = {
  meses: ProdutividadeEconomicaMes[];
  nMeses: number;
  /** Σ HH previsto (== card hhTotalPrevisto · âncora de conservação). */
  somaHhPrevisto: number;
  /** Σ HH real medido até agora (parcial). */
  somaHhReal: number;
  /** true = nenhum mês tem HH real > 0 (obra pré-execução) → farol de aderência PENDENTE. */
  eixoRealVazio: boolean;
  /** 'ok' = gate Σ HH == card · 'needs_review' = não fechou. */
  status: string;
};

/** Produtividade econômica (R$/HH) de uma obra. Null se ainda não normalizada. */
export async function getProdutividadeEconomica(
  contractId: string,
): Promise<ProdutividadeEconomica | null> {
  const { data, error } = await untypedTable("obra_produtividade_economica")
    .select(
      "ano, mes, periodo_label, faturado_rs, hh_previsto, hh_real, rs_por_hh, aderencia, status",
    )
    .eq("contrato_id", contractId)
    .order("ano", { ascending: true })
    .order("mes", { ascending: true });

  // Falha de leitura não pode virar null silencioso (área-cega) — falhe alto.
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    ano: number;
    mes: number;
    periodo_label: string | null;
    faturado_rs: number | null;
    hh_previsto: number | null;
    hh_real: number | null;
    rs_por_hh: number | null;
    aderencia: number | null;
    status: string;
  }>;
  if (rows.length === 0) return null;

  const num = (v: number | null) => (v != null ? Number(v) : null);
  const meses: ProdutividadeEconomicaMes[] = rows.map((r) => ({
    ano: r.ano,
    mes: r.mes,
    periodoLabel: r.periodo_label,
    faturadoRs: num(r.faturado_rs),
    hhPrevisto: num(r.hh_previsto),
    hhReal: num(r.hh_real),
    rsPorHh: num(r.rs_por_hh),
    aderencia: num(r.aderencia),
  }));

  const somaHhPrevisto = meses.reduce((a, m) => a + (m.hhPrevisto ?? 0), 0);
  const somaHhReal = meses.reduce((a, m) => a + (m.hhReal ?? 0), 0);
  const eixoRealVazio = !meses.some((m) => (m.hhReal ?? 0) > 0);
  // status pior entre as linhas (qualquer needs_review degrada o conjunto)
  const status = rows.some((r) => r.status !== "ok") ? "needs_review" : "ok";

  return { meses, nMeses: meses.length, somaHhPrevisto, somaHhReal, eixoRealVazio, status };
}
