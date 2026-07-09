// Read-model da MATRIZ FÍSICA disciplina×mês (C.5 · obra_cronograma_frente_mes) — % físico previsto
// acumulado por frente/disciplina (12 × 46 meses · fração 0..~1,0). Alimenta o seletor "por frente"
// do gráfico de avanço físico do Prazo: cada frente normalizada ao próprio escopo. O % REAL é input
// do RDO → pendente (NULL), nunca 0. Agrega em séries por frente, pronto p/ trocar a curva do gráfico.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type FrenteFisicaCelula = {
  mesNum: number;
  previstoPct: number | null;
  realPct: number | null;
};

export type FrenteFisicaSerie = {
  disciplina: string;
  /** último % previsto (≈ conclusão planejada da frente). */
  fimPct: number | null;
  celulas: FrenteFisicaCelula[];
};

export type CronogramaFrenteMes = {
  frentes: FrenteFisicaSerie[];
  nMeses: number;
  /** % real ainda não medido (input do RDO). */
  realPendente: boolean;
};

/** Matriz física por frente (C.5) de uma obra. Null se não normalizada. */
export async function getCronogramaFrenteMes(
  contractId: string,
): Promise<CronogramaFrenteMes | null> {
  const { data, error } = await untypedTable("obra_cronograma_frente_mes")
    .select("disciplina, mes_num, previsto_pct, real_pct, real_pendente")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar null silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | boolean | null) => (v != null ? Number(v) : null);

  const map = new Map<string, FrenteFisicaCelula[]>();
  const mesesSet = new Set<number>();
  let realPendente = true;
  for (const r of rows) {
    const disc = String(r.disciplina ?? "");
    if (!map.has(disc)) map.set(disc, []);
    const mn = Number(r.mes_num ?? 0);
    mesesSet.add(mn);
    const realPct = num(r.real_pct);
    if (realPct != null) realPendente = false;
    map.get(disc)!.push({ mesNum: mn, previstoPct: num(r.previsto_pct), realPct });
  }

  const frentes: FrenteFisicaSerie[] = [];
  for (const [disciplina, celulas] of map) {
    celulas.sort((a, b) => a.mesNum - b.mesNum);
    frentes.push({
      disciplina,
      fimPct: celulas.length ? celulas[celulas.length - 1].previstoPct : null,
      celulas,
    });
  }
  frentes.sort((a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR"));

  return { frentes, nMeses: mesesSet.size, realPendente };
}
