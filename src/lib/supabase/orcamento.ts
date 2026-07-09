// Read-model do Orçamento (Camada C) · lê obra_orcamentos (resumo + BDI) da Medição acumulada
// normalizada. Referência de preço/custo p/ Desequilíbrio/BDI. Só leitura (anon SELECT na 0006).
//
// ⚠️ CONTRATO DE HONESTIDADE: o orçamento é entidade INDEPENDENTE com gate próprio. `status` pode
// ser "needs_review" (gate de conservação Σ itens ≠ preço-venda não fechou). Todo consumidor DEVE
// gatear em `status` antes de exibir BDI/preço-venda — needs_review = números NÃO confiáveis (erro
// de milhões no Desequilíbrio). Nunca pintar verde sem checar o status.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

const num = (v: unknown): number | null => (v != null ? Number(v) : null);

export type Orcamento = {
  /** Σ BASE1 — orçamento de venda (R$). */
  precoVenda: number | null;
  custoDireto: number | null;
  custoIndireto: number | null;
  custoTotalAtividades: number | null;
  receita: number | null;
  /** Markup preço-venda / custo (ex.: 1,24465 = BDI 24,47%). */
  bdi: number | null;
  status: string;
  nItens: number;
};

/** Orçamento (resumo + BDI) de uma obra. Null se ainda não normalizado. */
export async function getOrcamento(contractId: string): Promise<Orcamento | null> {
  const { data: orcs, error: orcsErr } = await untypedTable("obra_orcamentos")
    .select(
      "id, preco_venda, custo_direto, custo_indireto, custo_total_atividades, receita, bdi, status",
    )
    .eq("contrato_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1);
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (orcsErr) throw new Error(orcsErr.message);
  const o = (orcs ?? [])[0] as
    | {
        id: string;
        preco_venda: number | null;
        custo_direto: number | null;
        custo_indireto: number | null;
        custo_total_atividades: number | null;
        receita: number | null;
        bdi: number | null;
        status: string;
      }
    | undefined;
  if (!o) return null;

  const { count, error: cntErr } = await untypedTable("obra_orcamento_itens")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", o.id);
  if (cntErr) throw new Error(cntErr.message);

  return {
    precoVenda: num(o.preco_venda),
    custoDireto: num(o.custo_direto),
    custoIndireto: num(o.custo_indireto),
    custoTotalAtividades: num(o.custo_total_atividades),
    receita: num(o.receita),
    bdi: num(o.bdi),
    status: o.status,
    nItens: count ?? 0,
  };
}
