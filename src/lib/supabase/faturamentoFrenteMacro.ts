// Read-model do C.3 Faturamento por FRENTE NOMEADA + MACRO (drill "Por Frente") · lê
// obra_faturamento_frente_macro. Frentes nomeadas (Trecho 01 — KM…, Pte Rio Macaé, Disp. KM 152,20)
// agrupadas por macro (Pista—Trechos / OAEs-Pontes / Dispositivos / …), com Contratado Total/Acum +
// Real Acum + aderência + farol. Σ Contratado Total = PV (gate-validado na normalização). Fonte
// ROBUSTA dos rótulos do drill — lida por estrutura, cada obra traz as SUAS frentes (sem hardcode).
// PENDENTE ≠ ZERO: Real por frente é input alocado → null (não 0) enquanto a obra só mediu o agregado.

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { FarolLevel } from "@/lib/mocks/contracts";
import { normalizarFarol } from "./faturamentoDisciplinaResumo";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type FrenteMacroItem = {
  ordem: number;
  macro: string | null;
  frente: string;
  contratadoTotal: number | null;
  contratadoAcum: number | null;
  realAcum: number | null;
  pct: number | null;
  /** Farol calculado quando o Real foi alocado por frente; null = pendente. */
  farol: FarolLevel | null;
  realPendente: boolean;
};

export type MacroGrupo = {
  macro: string;
  frentes: FrenteMacroItem[];
  somaContratadoTotal: number;
};

export type FaturamentoFrenteMacro = {
  /** grupos na ordem de aparição (preserva a ordem do template). */
  grupos: MacroGrupo[];
  /** todas as frentes em ordem (sem agrupar). */
  frentes: FrenteMacroItem[];
  somaContratadoTotal: number;
  nFrentes: number;
  realPendente: boolean;
};

/** C.3 Faturamento por frente nomeada + macro de uma obra. null se não normalizado. */
export async function getFaturamentoFrenteMacro(
  contractId: string,
): Promise<FaturamentoFrenteMacro | null> {
  const { data, error } = await untypedTable("obra_faturamento_frente_macro")
    .select(
      "ordem, macro, frente, contratado_total_rs, contratado_acum_rs, real_acum_rs, pct, farol, real_pendente",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | boolean | null) => (v != null ? Number(v) : null);
  const frentes: FrenteMacroItem[] = rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    macro: r.macro != null ? String(r.macro) : null,
    frente: String(r.frente ?? ""),
    contratadoTotal: num(r.contratado_total_rs),
    contratadoAcum: num(r.contratado_acum_rs),
    realAcum: num(r.real_acum_rs),
    pct: num(r.pct),
    farol: normalizarFarol(r.farol),
    realPendente: r.real_pendente !== false,
  }));

  // agrupa por macro preservando a ordem de aparição (ordem do template)
  const grupos: MacroGrupo[] = [];
  const idx = new Map<string, MacroGrupo>();
  for (const f of frentes) {
    const macro = f.macro ?? "Outros";
    let g = idx.get(macro);
    if (!g) {
      g = { macro, frentes: [], somaContratadoTotal: 0 };
      idx.set(macro, g);
      grupos.push(g);
    }
    g.frentes.push(f);
    g.somaContratadoTotal += f.contratadoTotal ?? 0;
  }
  for (const g of grupos) g.somaContratadoTotal = Math.round(g.somaContratadoTotal * 100) / 100;

  return {
    grupos,
    frentes,
    somaContratadoTotal:
      Math.round(frentes.reduce((a, f) => a + (f.contratadoTotal ?? 0), 0) * 100) / 100,
    nFrentes: frentes.length,
    realPendente: !frentes.some((f) => !f.realPendente),
  };
}
