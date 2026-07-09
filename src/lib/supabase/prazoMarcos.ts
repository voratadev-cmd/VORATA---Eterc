// Read-model dos MARCOS CONTRATUAIS (C.5 · gap fechado) · lê obra_prazo_marcos. Categoria + trecho +
// data-limite + farol. O "% concluído" é input por BM → pendente até a obra medir (honesto).
import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type PrazoMarco = {
  ordem: number;
  categoria: string | null;
  trecho: string | null;
  dataLimite: string | null;
  /** % concluído em 0–100 (convenção statusMarco/C.5) — ≠ obra_cronograma_tarefas.pct_concluido,
   *  que é FRAÇÃO 0–1. Null até a obra medir (input por BM). */
  pctConcluido: number | null;
  farol: string | null;
};

export async function getPrazoMarcos(contractId: string): Promise<PrazoMarco[]> {
  const { data, error } = await untypedTable("obra_prazo_marcos")
    .select("ordem, categoria, trecho, data_limite, pct_concluido, farol")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  // Falha de leitura não pode virar "sem marcos" silenciosa — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    categoria: r.categoria != null ? String(r.categoria) : null,
    trecho: r.trecho != null ? String(r.trecho) : null,
    dataLimite: r.data_limite != null ? String(r.data_limite) : null,
    pctConcluido: r.pct_concluido != null ? Number(r.pct_concluido) : null,
    farol: r.farol != null ? String(r.farol) : null,
  }));
}
