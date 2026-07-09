// Read-model da MATRIZ disciplina×mês (C.3 · obra_faturamento_disciplina_mes) — a explosão 2D da
// curva: PREVISTO mensal por disciplina (12 disc × 46 meses · BR-101). REAL/DÉFICIT são input do RDO
// → pendente (NULL), nunca 0. Σ previsto = PV (gate-validado na normalização). Agrega em séries por
// disciplina (com cumulativo derivado) + eixo de meses, pronto p/ heatmap e curva por disciplina.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type DisciplinaMesCelula = {
  mesNum: number;
  ano: number | null;
  mes: number | null;
  previstoRs: number | null;
  realRs: number | null;
  /** cumulativo do previsto da disciplina até este mês (derivado). */
  previstoAcumRs: number;
};

export type DisciplinaSerie = {
  disciplina: string;
  totalPrevisto: number;
  celulas: DisciplinaMesCelula[];
};

export type MesAxis = { mesNum: number; ano: number | null; mes: number | null; label: string };

export type FaturamentoDisciplinaMes = {
  /** séries por disciplina, ordenadas por total previsto desc. */
  disciplinas: DisciplinaSerie[];
  /** eixo de meses (1..46), ordenado. */
  mesesAxis: MesAxis[];
  totalPrevisto: number;
  /** Real/Déficit ainda não medidos (input do RDO). */
  realPendente: boolean;
  nDisciplinas: number;
  nMeses: number;
};

const MES_ABBR = [
  "",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
function mesLabel(ano: number | null, mes: number | null, mesNum: number): string {
  if (ano != null && mes != null && mes >= 1 && mes <= 12) {
    return `${MES_ABBR[mes]}/${String(ano).slice(2)}`;
  }
  return `M${mesNum}`;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Matriz disciplina×mês (C.3) de uma obra. Null se não normalizada. */
export async function getFaturamentoDisciplinaMes(
  contractId: string,
): Promise<FaturamentoDisciplinaMes | null> {
  const { data, error } = await untypedTable("obra_faturamento_disciplina_mes")
    .select("ordem, disciplina, mes_num, ano, mes, previsto_rs, real_rs, real_pendente")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar null silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | boolean | null) => (v != null ? Number(v) : null);

  // eixo de meses (distintos, ordenados por mes_num)
  const mesesMap = new Map<number, MesAxis>();
  for (const r of rows) {
    const mn = Number(r.mes_num ?? 0);
    if (!mesesMap.has(mn)) {
      const ano = num(r.ano);
      const mes = num(r.mes);
      mesesMap.set(mn, { mesNum: mn, ano, mes, label: mesLabel(ano, mes, mn) });
    }
  }
  const mesesAxis = [...mesesMap.values()].sort((a, b) => a.mesNum - b.mesNum);

  // agrupa por disciplina
  const discMap = new Map<string, DisciplinaMesCelula[]>();
  for (const r of rows) {
    const disc = String(r.disciplina ?? "");
    if (!discMap.has(disc)) discMap.set(disc, []);
    discMap.get(disc)!.push({
      mesNum: Number(r.mes_num ?? 0),
      ano: num(r.ano),
      mes: num(r.mes),
      previstoRs: num(r.previsto_rs),
      realRs: num(r.real_rs),
      previstoAcumRs: 0,
    });
  }

  let realPendente = true;
  const disciplinas: DisciplinaSerie[] = [];
  for (const [disciplina, celulas] of discMap) {
    celulas.sort((a, b) => a.mesNum - b.mesNum);
    let acum = 0;
    let total = 0;
    for (const cel of celulas) {
      acum += cel.previstoRs ?? 0;
      cel.previstoAcumRs = round2(acum);
      total += cel.previstoRs ?? 0;
      if (cel.realRs != null) realPendente = false;
    }
    disciplinas.push({ disciplina, totalPrevisto: round2(total), celulas });
  }
  disciplinas.sort((a, b) => b.totalPrevisto - a.totalPrevisto);

  return {
    disciplinas,
    mesesAxis,
    totalPrevisto: round2(disciplinas.reduce((a, d) => a + d.totalPrevisto, 0)),
    realPendente,
    nDisciplinas: disciplinas.length,
    nMeses: mesesAxis.length,
  };
}
