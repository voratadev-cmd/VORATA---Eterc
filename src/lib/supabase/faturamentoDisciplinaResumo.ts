// Read-model do C.3 Faturamento por DISCIPLINA · resumo (drill "Por Disciplina") · lê
// obra_faturamento_disciplina_resumo (15 disciplinas finas COM real alocado + farol). Σ Contratado
// Total = PV (gate-validado). Diferente de obra_faturamento_frentes (coarse, 12, sem real): ESTA
// acende os faróis coloridos do drill (Mobilização Risco, Terraplenagem Crítico…). O farol vem cru
// da fonte ("● Risco") → normalizado aqui pro tom do DS.

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { FarolLevel } from "@/lib/mocks/contracts";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

/** Farol cru da fonte ("● Risco", "Crítico", "conforme") → nível canônico do DS. null se vazio. */
export function normalizarFarol(v: number | string | boolean | null): FarolLevel | null {
  if (typeof v !== "string") return null;
  const s = v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  if (!s) return null;
  if (s.includes("conforme")) return "conforme";
  if (s.includes("observacao")) return "observacao";
  if (s.includes("risco")) return "risco";
  if (s.includes("critico")) return "critico";
  return null;
}

export type DisciplinaResumoItem = {
  ordem: number;
  disciplina: string;
  servico: boolean | null;
  contratadoTotal: number | null;
  contratadoAcum: number | null;
  realAcum: number | null;
  pct: number | null;
  farol: FarolLevel | null;
  realPendente: boolean;
};

export type FaturamentoDisciplinaResumo = {
  disciplinas: DisciplinaResumoItem[];
  somaContratadoTotal: number;
  nDisciplinas: number;
  realPendente: boolean;
};

/** C.3 Faturamento por disciplina (resumo, com real + farol) de uma obra. null se não normalizado. */
export async function getFaturamentoDisciplinaResumo(
  contractId: string,
): Promise<FaturamentoDisciplinaResumo | null> {
  const { data, error } = await untypedTable("obra_faturamento_disciplina_resumo")
    .select(
      "ordem, disciplina, servico, contratado_total_rs, contratado_acum_rs, real_acum_rs, pct, farol, real_pendente",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | boolean | null) => (v != null ? Number(v) : null);
  const disciplinas: DisciplinaResumoItem[] = rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    disciplina: String(r.disciplina ?? ""),
    servico: typeof r.servico === "boolean" ? r.servico : null,
    contratadoTotal: num(r.contratado_total_rs),
    contratadoAcum: num(r.contratado_acum_rs),
    realAcum: num(r.real_acum_rs),
    pct: num(r.pct),
    farol: normalizarFarol(r.farol),
    realPendente: r.real_pendente !== false,
  }));

  return {
    disciplinas,
    somaContratadoTotal:
      Math.round(disciplinas.reduce((a, d) => a + (d.contratadoTotal ?? 0), 0) * 100) / 100,
    nDisciplinas: disciplinas.length,
    realPendente: !disciplinas.some((d) => !d.realPendente),
  };
}
