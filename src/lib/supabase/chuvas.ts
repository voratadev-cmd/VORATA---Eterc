// Read-model das CHUVAS (C.9) · lê obra_chuvas (resumo) + obra_chuvas_meses (série). Análise
// pluviométrica — crucial p/ obra a céu aberto (impacta prazo/produtividade). Chuva REAL é input →
// pendente até a obra medir; o sistema mostra o baseline previsto + o impacto financeiro (impedido).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type ChuvaMes = {
  ordem: number;
  mesObra: string | null;
  periodo: string | null;
  chuvaPrevMm: number | null;
  chuvaRealMm: number | null;
  chuvaPrevAcum: number | null;
  chuvaRealAcum: number | null;
  diasParados: number | null;
  diasPrev5mm: number | null;
  farol: string | null;
};

export type Chuvas = {
  impedidoTotalRs: number | null;
  liberadoTotalRs: number | null;
  frentesNaoIniciadas: number | null;
  principalImpedido: string | null;
  chuvaPrevTotal: number | null;
  /** chuva real ainda não medida (input vazio) → eixo real pendente. */
  eixoRealVazio: boolean;
  meses: ChuvaMes[];
  nMeses: number;
  status: string;
};

/** Chuvas (C.9) de uma obra. Null se ainda não normalizado. */
export async function getChuvas(contractId: string): Promise<Chuvas | null> {
  const [headRes, mesesRes] = await Promise.all([
    untypedTable("obra_chuvas")
      .select(
        "impedido_total_rs, liberado_total_rs, frentes_nao_iniciadas, principal_impedido, chuva_prev_total, eixo_real_vazio, status",
      )
      .eq("contrato_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    untypedTable("obra_chuvas_meses")
      .select(
        "ordem, mes_obra, periodo, chuva_prev_mm, chuva_real_mm, chuva_prev_acum, chuva_real_acum, dias_parados, dias_prev_5mm, farol",
      )
      .eq("contrato_id", contractId)
      .order("ordem", { ascending: true }),
  ]);

  // Falha de leitura não pode virar null silencioso — falhe alto (erro = milhões).
  if (headRes.error) throw new Error(headRes.error.message);
  if (mesesRes.error) throw new Error(mesesRes.error.message);

  const head = headRes.data as Record<string, number | string | boolean | null> | null;
  const mesesRows = (mesesRes.data ?? []) as Array<Record<string, number | string | null>>;
  if (!head && mesesRows.length === 0) return null;

  const num = (v: number | string | boolean | null | undefined) =>
    typeof v === "number" || typeof v === "string" ? Number(v) : null;
  const meses: ChuvaMes[] = mesesRows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    mesObra: r.mes_obra != null ? String(r.mes_obra) : null,
    periodo: r.periodo != null ? String(r.periodo) : null,
    chuvaPrevMm: num(r.chuva_prev_mm),
    chuvaRealMm: num(r.chuva_real_mm),
    chuvaPrevAcum: num(r.chuva_prev_acum),
    chuvaRealAcum: num(r.chuva_real_acum),
    diasParados: num(r.dias_parados),
    diasPrev5mm: num(r.dias_prev_5mm),
    farol: r.farol != null ? String(r.farol) : null,
  }));

  return {
    impedidoTotalRs: num(head?.impedido_total_rs),
    liberadoTotalRs: num(head?.liberado_total_rs),
    frentesNaoIniciadas: num(head?.frentes_nao_iniciadas),
    principalImpedido: head?.principal_impedido != null ? String(head.principal_impedido) : null,
    chuvaPrevTotal: num(head?.chuva_prev_total),
    eixoRealVazio: head?.eixo_real_vazio !== false,
    meses,
    nMeses: meses.length,
    status: String(head?.status ?? "ok"),
  };
}
