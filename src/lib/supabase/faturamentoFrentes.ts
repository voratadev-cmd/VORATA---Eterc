// Read-model do FATURAMENTO POR FRENTE (C.3 · gap apontado pelo usuário) · lê obra_faturamento_frentes.
// Contratado Total + Contratado Acum (até BM) por disciplina. O REAL por frente é input separado:
// para a BR-101 o total real (20,5M) foi medido mas NÃO foi alocado por frente → real pendente
// (mostra "—", não 0 fabricado). Σ Contratado Total = PV · Σ Contratado Acum = C.8 (cross-check).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type FrenteFaturamento = {
  ordem: number;
  frente: string;
  servico: boolean | null;
  contratadoTotal: number | null;
  contratadoAcum: number | null;
  realAcum: number | null;
  pct: number | null;
};

export type FaturamentoFrentes = {
  frentes: FrenteFaturamento[];
  somaContratadoTotal: number;
  somaContratadoAcum: number;
  /** real por frente não alocado (só o total foi medido) → eixo real pendente. */
  realPendente: boolean;
  nFrentes: number;
};

/** Faturamento por frente (C.3) de uma obra. Null se não normalizado. */
export async function getFaturamentoFrentes(
  contractId: string,
): Promise<FaturamentoFrentes | null> {
  const { data, error } = await untypedTable("obra_faturamento_frentes")
    .select("ordem, frente, servico, contratado_total, contratado_acum, real_acum, pct")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;

  const num = (v: number | string | boolean | null) => (v != null ? Number(v) : null);
  const frentes: FrenteFaturamento[] = rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    frente: String(r.frente ?? ""),
    servico: typeof r.servico === "boolean" ? r.servico : null,
    contratadoTotal: num(r.contratado_total),
    contratadoAcum: num(r.contratado_acum),
    realAcum: num(r.real_acum),
    pct: num(r.pct),
  }));
  const somaContratadoTotal = frentes.reduce((a, f) => a + (f.contratadoTotal ?? 0), 0);
  const somaContratadoAcum = frentes.reduce((a, f) => a + (f.contratadoAcum ?? 0), 0);
  const realPendente = !frentes.some((f) => (f.realAcum ?? 0) > 0);

  return {
    frentes,
    somaContratadoTotal,
    somaContratadoAcum,
    realPendente,
    nFrentes: frentes.length,
  };
}
