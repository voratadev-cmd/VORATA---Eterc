// Read-model da SÉRIE MENSAL por disciplina/frente (C.3 · obra_faturamento_serie_mes) — alimenta o
// select da Curva S (filtra a curva por item). Cada item (disciplina Terraplenagem / frente Trecho 01)
// traz sua série mensal {previsto, real}. Σ previsto = PV · Σ real = real medido (gate na normalização).
// Diferente do obra_faturamento_disciplina_mes (coarse, real=0): aqui o real mensal por item EXISTE.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type SerieMesCelula = {
  mesNum: number;
  ano: number | null;
  mes: number | null;
  previstoRs: number | null;
  realRs: number | null;
};
export type SerieItem = { item: string; celulas: SerieMesCelula[] };
export type FaturamentoSerieMes = {
  /** itens por disciplina (15 finas), na ordem do template. */
  disciplina: SerieItem[];
  /** itens por frente nomeada (17), na ordem do template. */
  frente: SerieItem[];
};

/** Série mensal por disciplina e frente de uma obra. null se não normalizada. */
export async function getFaturamentoSerieMes(
  contractId: string,
): Promise<FaturamentoSerieMes | null> {
  // PAGINAÇÃO OBRIGATÓRIA: 15 disc + 17 frentes × 46 meses = 1.472 linhas, ACIMA do teto de 1.000
  // linhas/requisição do PostgREST. Uma query única traz só as 1.000 primeiras → o seletor da Curva S
  // perde ~⅓ dos itens (disciplinas/frentes "somem"), bug silencioso de erro = milhões. Buscamos em
  // páginas de 1.000 até a última vir incompleta. Ordem por (dimensao, ordem): chave TOTAL e única na
  // obra (ordem é o ordinal item×mês por dimensão) — sem ela o tie em `ordem` entre dimensões poderia
  // pular/duplicar linha na fronteira da página. Não trocar por `.order("ordem")` sem range.
  const PAGE = 1000;
  const cols = "dimensao, item, ordem, mes_num, ano, mes, previsto_rs, real_rs";
  const rows: Array<Record<string, number | string | null>> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await untypedTable("obra_faturamento_serie_mes")
      .select(cols)
      .eq("contrato_id", contractId)
      .order("dimensao", { ascending: true })
      .order("ordem", { ascending: true })
      // tiebreaker: garante ordem TOTAL (id é PK único) → a paginação nunca pula/duplica linha na
      // fronteira de página. NÃO deduplica versões: como os read-models irmãos, assume 1 extração por obra.
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Array<Record<string, number | string | null>>;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (rows.length === 0) return null;

  const num = (v: number | string | null) => (v != null ? Number(v) : null);
  const porDim: Record<"disciplina" | "frente", Map<string, SerieItem>> = {
    disciplina: new Map(),
    frente: new Map(),
  };
  for (const r of rows) {
    const dim = String(r.dimensao) as "disciplina" | "frente";
    if (dim !== "disciplina" && dim !== "frente") continue;
    const item = String(r.item ?? "");
    let s = porDim[dim].get(item);
    if (!s) {
      s = { item, celulas: [] };
      porDim[dim].set(item, s);
    }
    s.celulas.push({
      mesNum: Number(r.mes_num ?? 0),
      ano: num(r.ano),
      mes: num(r.mes),
      previstoRs: num(r.previsto_rs),
      realRs: num(r.real_rs),
    });
  }
  for (const dim of ["disciplina", "frente"] as const) {
    for (const s of porDim[dim].values()) s.celulas.sort((a, b) => a.mesNum - b.mesNum);
  }
  return {
    disciplina: [...porDim.disciplina.values()],
    frente: [...porDim.frente.values()],
  };
}
