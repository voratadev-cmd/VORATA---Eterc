// Read-model do D.1 INDIRETOS (under-recovery da Adm Local) · lê obra_indiretos_base
// (1 row · bases + método ativo + cenários) + obra_indiretos_metodos (4 métodos: M2/M2.1/M2.2/M3)
// + obra_indiretos_itens (29 grupos da Adm Local · M2 contratado×real).
// desequilibrioTotal = método ATIVO (NÃO soma de cenários). Só leitura (anon/authenticated SELECT).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name as keyof Database["public"]["Tables"]);
}

export type IndiretoMetodo = {
  ordem: number;
  /** Código curto (M2, M2.1, M2.2, M3). */
  codigo: string | null;
  metodo: string;
  /** Rótulo da comparação (ex.: "gasto − boletim medido"). */
  comparacao: string | null;
  /** Lado A / lado B da comparação (ex.: gasto e medido). */
  valorA: number | null;
  valorB: number | null;
  desequilibrioRs: number | null;
  defensabilidade: number | null;
  ativo: boolean;
  /** true = aguardando input (ex.: M3 contábil). */
  pendente: boolean;
  obs: string | null;
};

export type IndiretoItem = {
  ordem: number;
  grupo: string;
  qtdContr: number | null;
  qtdReal: number | null;
  custoContr: number | null;
  custoReal: number | null;
  deltaCusto: number | null;
};

export type Indiretos = {
  // bases
  admLocalCheio: number | null;
  admLocalMensal: number | null;
  custoDireto: number | null;
  pv: number | null;
  percentPv: number | null;
  prazoMeses: number | null;
  bmCorrente: number | null;
  gastoAcum: number | null;
  medidoAcum: number | null;
  realAcum: number | null;
  contratadoAcum: number | null;
  // método ativo + total (= método ativo)
  metodoAtivo: string | null;
  desequilibrioTotal: number | null;
  // cenários (alimentam o pleito D.10 · NÃO somam à D.1)
  reducaoPct: number | null;
  reducaoEscopo: number | null;
  extensaoMeses: number | null;
  desequilibrioExtensao: number | null;
  // coleções
  metodos: IndiretoMetodo[];
  itens: IndiretoItem[];
  status: string;
};

/** D.1 Indiretos de uma obra. Null se ainda não normalizado. */
export async function getIndiretos(contractId: string): Promise<Indiretos | null> {
  const [baseRes, metRes, itRes] = await Promise.all([
    untypedTable("obra_indiretos_base")
      .select(
        "adm_local_cheio, adm_local_mensal, custo_direto, pv, percent_pv, prazo_meses, bm_corrente, gasto_acum, medido_acum, real_acum, contratado_acum, metodo_ativo, desequilibrio_total, reducao_pct, reducao_escopo, extensao_meses, desequilibrio_extensao, status",
      )
      .eq("contrato_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    untypedTable("obra_indiretos_metodos")
      .select(
        "ordem, codigo, metodo, comparacao, valor_a, valor_b, desequilibrio_rs, defensabilidade, ativo, pendente, obs, status",
      )
      .eq("contrato_id", contractId)
      .order("ordem", { ascending: true }),
    untypedTable("obra_indiretos_itens")
      .select("ordem, grupo, qtd_contr, qtd_real, custo_contr, custo_real, delta_custo")
      .eq("contrato_id", contractId)
      .order("ordem", { ascending: true }),
  ]);

  // Falha de leitura (RLS/timeout/rede) NÃO pode virar "não rodado" — falhe alto (erro = milhões).
  if (baseRes.error) throw new Error(baseRes.error.message);
  if (metRes.error) throw new Error(metRes.error.message);
  if (itRes.error) throw new Error(itRes.error.message);

  const base = baseRes.data as Record<string, number | string | null> | null;
  const metodosRows = (metRes.data ?? []) as Array<
    Record<string, number | string | boolean | null>
  >;
  const itensRows = (itRes.data ?? []) as Array<Record<string, number | string | null>>;
  if (!base && metodosRows.length === 0) return null;

  const num = (v: number | string | boolean | null | undefined) => (v != null ? Number(v) : null);

  const metodos: IndiretoMetodo[] = metodosRows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    codigo: r.codigo != null ? String(r.codigo) : null,
    metodo: String(r.metodo ?? ""),
    comparacao: r.comparacao != null ? String(r.comparacao) : null,
    valorA: num(r.valor_a),
    valorB: num(r.valor_b),
    desequilibrioRs: num(r.desequilibrio_rs),
    defensabilidade: num(r.defensabilidade),
    ativo: Boolean(r.ativo),
    pendente: Boolean(r.pendente),
    obs: r.obs != null ? String(r.obs) : null,
  }));

  const itens: IndiretoItem[] = itensRows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    grupo: String(r.grupo ?? ""),
    qtdContr: num(r.qtd_contr),
    qtdReal: num(r.qtd_real),
    custoContr: num(r.custo_contr),
    custoReal: num(r.custo_real),
    deltaCusto: num(r.delta_custo),
  }));

  const needsReview =
    base?.status === "needs_review" || metodosRows.some((r) => r.status === "needs_review");

  return {
    admLocalCheio: num(base?.adm_local_cheio),
    admLocalMensal: num(base?.adm_local_mensal),
    custoDireto: num(base?.custo_direto),
    pv: num(base?.pv),
    percentPv: num(base?.percent_pv),
    prazoMeses: num(base?.prazo_meses),
    bmCorrente: num(base?.bm_corrente),
    gastoAcum: num(base?.gasto_acum),
    medidoAcum: num(base?.medido_acum),
    realAcum: num(base?.real_acum),
    contratadoAcum: num(base?.contratado_acum),
    metodoAtivo: base?.metodo_ativo != null ? String(base.metodo_ativo) : null,
    desequilibrioTotal: num(base?.desequilibrio_total),
    reducaoPct: num(base?.reducao_pct),
    reducaoEscopo: num(base?.reducao_escopo),
    extensaoMeses: num(base?.extensao_meses),
    desequilibrioExtensao: num(base?.desequilibrio_extensao),
    metodos,
    itens,
    status: needsReview ? "needs_review" : "ok",
  };
}
