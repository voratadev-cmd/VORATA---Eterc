// Read-model da SÉRIE MENSAL DAS CURVAS (C.8 × C.3 · obra_curvas_serie_mes) — alimenta o gráfico
// "As curvas · R$ acumulado" da aba Curvas e Responsabilidade, com toggle Total (financeiro) ×
// Produção (apenas serviços). Capacidade/Executado vêm NULL pós-BM (carry da planilha cortado na
// normalização · PENDENTE≠0). "Previsto Serviços" chega MENSAL e é acumulado aqui (determinístico).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type CurvaSerieMes = {
  mesNum: number;
  /** rótulo da fonte (ex.: 'jun-26'). */
  periodoLabel: string | null;
  contratadoAcum: number | null;
  liberadoAcum: number | null;
  /** NULL pós-BM (capacidade só existe até o corte). */
  capacidadeAcum: number | null;
  /** NULL pós-BM (real não medido — nunca 0 fabricado). */
  executadoAcum: number | null;
  /** acumulado de C.3 'Previsto Serviços' — base "Produção" do toggle. */
  previstoServicosAcum: number | null;
};

export type CurvasSerie = {
  meses: CurvaSerieMes[];
  bmCorrente: number | null;
  nMeses: number;
};

/** Série mensal das curvas de uma obra. Null se ainda não normalizada. */
export async function getCurvasSerieMes(contractId: string): Promise<CurvasSerie | null> {
  const { data, error } = await untypedTable("obra_curvas_serie_mes")
    .select(
      "mes_num, periodo_label, contratado_acum_rs, liberado_acum_rs, capacidade_acum_rs, executado_acum_rs, previsto_servicos_rs, bm_corrente",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar null silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | null) => (v != null ? Number(v) : null);
  let servAcum = 0;
  const meses: CurvaSerieMes[] = rows.map((r) => {
    const servMes = num(r.previsto_servicos_rs);
    if (servMes != null) servAcum += servMes;
    return {
      mesNum: Number(r.mes_num ?? 0),
      periodoLabel: r.periodo_label != null ? String(r.periodo_label) : null,
      contratadoAcum: num(r.contratado_acum_rs),
      liberadoAcum: num(r.liberado_acum_rs),
      capacidadeAcum: num(r.capacidade_acum_rs),
      executadoAcum: num(r.executado_acum_rs),
      previstoServicosAcum: servMes != null ? servAcum : null,
    };
  });
  const bm = rows.map((r) => num(r.bm_corrente)).find((v) => v != null) ?? null;
  return { meses, bmCorrente: bm, nMeses: meses.length };
}
