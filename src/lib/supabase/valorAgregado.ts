// Read-model do VALOR AGREGADO (D.4 · earned value · AACE 25R-03 · obra_valor_agregado + _servico).
// Resumo por categoria MOD/EQP/TOTAL: VA necessário × Real alocado → Perda de produtividade (=
// Alocado − Agregado) · % sobre o PV · farol da perda (só na TOTAL). VA por serviço: Qtd medida ×
// R$/un da CPU → VA MOD/EQP (só os serviços COM produção medida). Sem normalização → null.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- acesso destipado uniforme (igual aos demais read-models)
  return (getSupabase() as any).from(name);
}

export type ValorAgregadoCategoria = {
  categoria: string; // 'MOD' | 'EQP' | 'TOTAL'
  vaMedidoRs: number | null;
  realAlocadoRs: number | null;
  /** Perda de produtividade = Alocado − Agregado. */
  perdaRs: number | null;
  /** fração · perda / PV. */
  pctPv: number | null;
  /** farol da perda · só na linha TOTAL. */
  farol: string | null;
};

export type ValorAgregadoServico = {
  ordem: number;
  codigoCpu: string | null;
  servico: string;
  unidade: string | null;
  pctMod: number | null;
  pctEqp: number | null;
  modRsUn: number | null;
  eqpRsUn: number | null;
  /** Qtd medida (BM · input). */
  qtdMedida: number | null;
  vaModRs: number | null;
  vaEqpRs: number | null;
};

/** Um mês da série (VA medido × Real alocado por categoria) + acumulados derivados (p/ o gráfico). */
export type ValorAgregadoMes = {
  ano: number;
  mes: number;
  periodoLabel: string | null;
  vaModRs: number | null;
  vaEqpRs: number | null;
  realModRs: number | null;
  realEqpRs: number | null;
  /** VA medido total no mês (MOD+EQP). */
  vaMesRs: number;
  /** Real alocado total no mês (MOD+EQP). */
  realMesRs: number;
  /** VA medido acumulado até o mês. */
  vaAcumRs: number;
  /** Real alocado acumulado até o mês. */
  realAcumRs: number;
};

export type ValorAgregadoResumo = {
  categorias: ValorAgregadoCategoria[];
  servicos: ValorAgregadoServico[];
  /** Série mensal (VA × Real alocado · p/ o gráfico). Vazia se não normalizada. */
  serieMensal: ValorAgregadoMes[];
  mod: ValorAgregadoCategoria | null;
  eqp: ValorAgregadoCategoria | null;
  total: ValorAgregadoCategoria | null;
  /** farol global da perda (= farol da categoria TOTAL). */
  farolTotal: string | null;
};

/** Valor Agregado (D.4) de uma obra. Null se ainda não normalizado. */
export async function getValorAgregado(contractId: string): Promise<ValorAgregadoResumo | null> {
  const [cats, servs, meses] = await Promise.all([
    untypedTable("obra_valor_agregado")
      .select("ordem, categoria, va_medido_rs, real_alocado_rs, perda_rs, pct_pv, farol")
      .eq("contrato_id", contractId)
      .order("ordem", { ascending: true }),
    untypedTable("obra_valor_agregado_servico")
      .select(
        "ordem, codigo_cpu, servico, unidade, pct_mod, pct_eqp, mod_rs_un, eqp_rs_un, qtd_medida, va_mod_rs, va_eqp_rs",
      )
      .eq("contrato_id", contractId)
      .order("ordem", { ascending: true }),
    untypedTable("obra_valor_agregado_mes")
      .select("ano, mes, periodo_label, va_mod_rs, va_eqp_rs, real_mod_rs, real_eqp_rs")
      .eq("contrato_id", contractId)
      .order("ano", { ascending: true })
      .order("mes", { ascending: true }),
  ]);
  // Falha de leitura não pode virar null silencioso — falhe alto (erro = milhões).
  if (cats.error) throw new Error(cats.error.message);
  if (servs.error) throw new Error(servs.error.message);
  if (meses.error) throw new Error(meses.error.message);
  const crows = (cats.data ?? []) as Array<Record<string, number | string | null>>;
  if (crows.length === 0) return null;

  const num = (v: number | string | null) => (v != null ? Number(v) : null);
  const categorias: ValorAgregadoCategoria[] = crows.map((r) => ({
    categoria: String(r.categoria ?? ""),
    vaMedidoRs: num(r.va_medido_rs),
    realAlocadoRs: num(r.real_alocado_rs),
    perdaRs: num(r.perda_rs),
    pctPv: num(r.pct_pv),
    farol: r.farol != null ? String(r.farol) : null,
  }));
  const servicos: ValorAgregadoServico[] = (
    (servs.data ?? []) as Array<Record<string, number | string | null>>
  ).map((r) => ({
    ordem: Number(r.ordem ?? 0),
    codigoCpu: r.codigo_cpu != null ? String(r.codigo_cpu) : null,
    servico: String(r.servico ?? ""),
    unidade: r.unidade != null ? String(r.unidade) : null,
    pctMod: num(r.pct_mod),
    pctEqp: num(r.pct_eqp),
    modRsUn: num(r.mod_rs_un),
    eqpRsUn: num(r.eqp_rs_un),
    qtdMedida: num(r.qtd_medida),
    vaModRs: num(r.va_mod_rs),
    vaEqpRs: num(r.va_eqp_rs),
  }));

  // Série mensal + acumulados derivados (cumsum) — o gráfico usa o acum (VA × Real alocado).
  let vaAcum = 0;
  let realAcum = 0;
  const serieMensal: ValorAgregadoMes[] = (
    (meses.data ?? []) as Array<Record<string, number | string | null>>
  ).map((r) => {
    const vaMod = num(r.va_mod_rs) ?? 0;
    const vaEqp = num(r.va_eqp_rs) ?? 0;
    const realMod = num(r.real_mod_rs) ?? 0;
    const realEqp = num(r.real_eqp_rs) ?? 0;
    const vaMesRs = vaMod + vaEqp;
    const realMesRs = realMod + realEqp;
    vaAcum += vaMesRs;
    realAcum += realMesRs;
    return {
      ano: Number(r.ano ?? 0),
      mes: Number(r.mes ?? 0),
      periodoLabel: r.periodo_label != null ? String(r.periodo_label) : null,
      vaModRs: num(r.va_mod_rs),
      vaEqpRs: num(r.va_eqp_rs),
      realModRs: num(r.real_mod_rs),
      realEqpRs: num(r.real_eqp_rs),
      vaMesRs,
      realMesRs,
      vaAcumRs: vaAcum,
      realAcumRs: realAcum,
    };
  });

  const byCat = (c: string) => categorias.find((x) => x.categoria.toUpperCase() === c) ?? null;
  const total = byCat("TOTAL");
  return {
    categorias,
    servicos,
    serieMensal,
    mod: byCat("MOD"),
    eqp: byCat("EQP"),
    total,
    farolTotal: total?.farol ?? null,
  };
}
