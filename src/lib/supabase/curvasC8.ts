// Read-model das CURVAS C.8 (Lib×Cap×Aloc) · lê obra_curvas_c8. Alimenta o card "Curvas Liberação ×
// Capacidade × Alocado" da aba Indicadores/Visão Geral. executadoAcum cruza com o faturamento real.
// Pcts em FRAÇÃO 0..1 no banco → a UI multiplica por 100.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type CurvasC8 = {
  /** % (0..100) liberado/capacidade/alocado vs contratado-no-corte. null se ausente. */
  liberacaoPct: number | null;
  capacidadePct: number | null;
  alocadoPct: number | null;
  contratadoAcumCorte: number | null;
  liberadoAcum: number | null;
  capacidadeAcum: number | null;
  executadoAcum: number | null;
  maiorGapRs: number | null;
  status: string;
};

/** Curvas C.8 de uma obra. Null se ainda não normalizado (card fica pendente). */
export async function getCurvasC8(contractId: string): Promise<CurvasC8 | null> {
  const { data, error } = await untypedTable("obra_curvas_c8")
    .select(
      "contratado_acum_corte, liberado_acum, capacidade_acum, executado_acum, maior_gap_rs, liberacao_pct, capacidade_pct, alocado_pct, status",
    )
    .eq("contrato_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, number | string | null>;
  const num = (v: number | string | null) => (v != null ? Number(v) : null);
  const pct = (v: number | string | null) => (v != null ? Number(v) * 100 : null);
  return {
    liberacaoPct: pct(r.liberacao_pct),
    capacidadePct: pct(r.capacidade_pct),
    alocadoPct: pct(r.alocado_pct),
    contratadoAcumCorte: num(r.contratado_acum_corte),
    liberadoAcum: num(r.liberado_acum),
    capacidadeAcum: num(r.capacidade_acum),
    executadoAcum: num(r.executado_acum),
    maiorGapRs: num(r.maior_gap_rs),
    status: String(r.status ?? "ok"),
  };
}

export type FrenteC8 = {
  ordem: number;
  frente: string;
  contratadoRs: number | null;
  produtividadeRsHh: number | null;
  gapDominanteRs: number | null;
  responsabilidade: string | null;
};

/** Matriz por frente (C.8 · Responsabilidade × gargalo). [] se não normalizado. */
export async function getCurvasFrentes(contractId: string): Promise<FrenteC8[]> {
  const { data, error } = await untypedTable("obra_curvas_frentes")
    .select("ordem, frente, contratado_rs, produtividade_rs_hh, gap_dominante_rs, responsabilidade")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  const num = (v: number | string | null) => (v != null ? Number(v) : null);
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    frente: String(r.frente ?? ""),
    contratadoRs: num(r.contratado_rs),
    produtividadeRsHh: num(r.produtividade_rs_hh),
    gapDominanteRs: num(r.gap_dominante_rs),
    responsabilidade: r.responsabilidade != null ? String(r.responsabilidade) : null,
  }));
}
