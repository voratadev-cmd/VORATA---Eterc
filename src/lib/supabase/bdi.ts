// Read-model do C.1 BDI (rubricas do buildup contratual · alimenta D.2) · lê obra_bdi_rubricas.
// As rubricas são a COMPOSIÇÃO do BDI da proposta (markup), com subtotais marcados (eh_subtotal) para
// não double-count. O markup total = Σ das folhas. ATENÇÃO: o desequilíbrio do BDI (D.2) NÃO está
// aqui — vive só no painel D.0; a memória detalhada do Δ (alíquotas × tempo) ainda não é normalizada.
// Só leitura (anon SELECT).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type BdiRubrica = {
  ordem: number;
  descricao: string;
  /** % sobre a receita (fonte da rubrica). */
  pctReceita: number | null;
  /** % sobre o custo direto (base do valor). */
  pctCustoDireto: number | null;
  valorRs: number | null;
  /** Subtotal (não soma com as folhas — evita double-count). */
  ehSubtotal: boolean;
};

export type Bdi = {
  rubricas: BdiRubrica[];
  /** Σ das folhas (eh_subtotal=false) = markup contratual total, sem double-count (R$). */
  markupTotal: number;
  status: string;
};

/** Buildup do BDI contratual de uma obra. Null se ainda não normalizado. */
export async function getBdi(contractId: string): Promise<Bdi | null> {
  const { data, error } = await untypedTable("obra_bdi_rubricas")
    .select("ordem, descricao, pct_receita, pct_custo_direto, valor_rs, eh_subtotal, status")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });

  // Falha de leitura não pode virar "sem BDI" silencioso — falhe alto (erro = milhões).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    ordem: number;
    descricao: string;
    pct_receita: number | null;
    pct_custo_direto: number | null;
    valor_rs: number | null;
    eh_subtotal: boolean;
    status: string;
  }>;
  if (rows.length === 0) return null;

  const num = (v: number | null) => (v != null ? Number(v) : null);
  const rubricas: BdiRubrica[] = rows.map((r) => ({
    ordem: Number(r.ordem),
    descricao: r.descricao,
    pctReceita: num(r.pct_receita),
    pctCustoDireto: num(r.pct_custo_direto),
    valorRs: num(r.valor_rs),
    ehSubtotal: Boolean(r.eh_subtotal),
  }));
  const markupTotal = rubricas
    .filter((r) => !r.ehSubtotal)
    .reduce((a, r) => a + (r.valorRs ?? 0), 0);
  const status = rows.some((r) => r.status !== "ok") ? "needs_review" : "ok";

  return { rubricas, markupTotal, status };
}
