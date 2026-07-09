// Read-model do D.2 BDI — desequilíbrio do BDI NÃO REMUNERADO (≠ getBdi, que é a composição C.1).
// Lê 3 entidades normalizadas pelo workbook-motor:
//   obra_bdi_deseq          → params/base + KPIs + cenários (1 linha)
//   obra_bdi_rubrica_tempo  → 6 rubricas tempo-dependentes (gasto teórico × remunerado → desequilíbrio)
//   obra_bdi_perda_mensal   → curva da perda do BDI mês a mês (BM 1–46)
// Conservação conferida pelo gate (Σ rubricas == total; perda acum no BM == desequilíbrio).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type BdiDeseqParams = {
  pvRs: number | null;
  bdiDeclarado: number | null;
  custoDiretoRs: number | null;
  custoIndiretoRs: number | null;
  bmCorrente: number | null;
  mesesContratuais: number | null;
  medicaoAcumRs: number | null;
  mesesExtensao: number | null;
  desequilibrioRs: number | null;
  pctSobrePv: number | null;
  custoMensalTempoRs: number | null;
  gastoTeoricoAcumRs: number | null;
  remuneradoAcumRs: number | null;
  valorTotalContratoRs: number | null;
  overheadMesRs: number | null;
  projecaoExtensaoRs: number | null;
  deltaReducaoRs: number | null;
  farol: string | null;
};

export type BdiRubricaTempo = {
  ordem: number;
  rubrica: string;
  tipo: string | null;
  pctRubrica: number | null;
  valorContratoRs: number | null;
  incorridoMesRs: number | null;
  gastoTeoricoAcumRs: number | null;
  remuneradoAcumRs: number | null;
  desequilibrioRs: number | null;
  obs: string | null;
};

export type BdiPerdaMensal = {
  ordem: number;
  bm: number | null;
  mesLabel: string | null;
  gastoTeoricoMesRs: number | null;
  remuneradoMesRs: number | null;
  perdaMesRs: number | null;
  perdaAcumRs: number | null;
};

const n = (v: number | string | null) => (v != null ? Number(v) : null);

/** Params/KPIs do D.2 BDI. Null se ainda não normalizado. */
export async function getBdiDeseq(contractId: string): Promise<BdiDeseqParams | null> {
  const { data, error } = await untypedTable("obra_bdi_deseq")
    .select(
      "pv_rs, bdi_declarado, custo_direto_rs, custo_indireto_rs, bm_corrente, meses_contratuais, medicao_acum_rs, meses_extensao, desequilibrio_rs, pct_sobre_pv, custo_mensal_tempo_rs, gasto_teorico_acum_rs, remunerado_acum_rs, valor_total_contrato_rs, overhead_mes_rs, projecao_extensao_rs, delta_reducao_rs, farol",
    )
    .eq("contrato_id", contractId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any;
  return {
    pvRs: n(r.pv_rs),
    bdiDeclarado: n(r.bdi_declarado),
    custoDiretoRs: n(r.custo_direto_rs),
    custoIndiretoRs: n(r.custo_indireto_rs),
    bmCorrente: n(r.bm_corrente),
    mesesContratuais: n(r.meses_contratuais),
    medicaoAcumRs: n(r.medicao_acum_rs),
    mesesExtensao: n(r.meses_extensao),
    desequilibrioRs: n(r.desequilibrio_rs),
    pctSobrePv: n(r.pct_sobre_pv),
    custoMensalTempoRs: n(r.custo_mensal_tempo_rs),
    gastoTeoricoAcumRs: n(r.gasto_teorico_acum_rs),
    remuneradoAcumRs: n(r.remunerado_acum_rs),
    valorTotalContratoRs: n(r.valor_total_contrato_rs),
    overheadMesRs: n(r.overhead_mes_rs),
    projecaoExtensaoRs: n(r.projecao_extensao_rs),
    deltaReducaoRs: n(r.delta_reducao_rs),
    farol: r.farol != null ? String(r.farol) : null,
  };
}

/** 6 rubricas de tempo do D.2 BDI. Null se ausente. */
export async function getBdiRubricasTempo(contractId: string): Promise<BdiRubricaTempo[] | null> {
  const { data, error } = await untypedTable("obra_bdi_rubrica_tempo")
    .select(
      "ordem, rubrica, tipo, pct_rubrica, valor_contrato_rs, incorrido_mes_rs, gasto_teorico_acum_rs, remunerado_acum_rs, desequilibrio_rs, obs",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    rubrica: String(r.rubrica ?? ""),
    tipo: r.tipo != null ? String(r.tipo) : null,
    pctRubrica: n(r.pct_rubrica),
    valorContratoRs: n(r.valor_contrato_rs),
    incorridoMesRs: n(r.incorrido_mes_rs),
    gastoTeoricoAcumRs: n(r.gasto_teorico_acum_rs),
    remuneradoAcumRs: n(r.remunerado_acum_rs),
    desequilibrioRs: n(r.desequilibrio_rs),
    obs: r.obs != null ? String(r.obs) : null,
  }));
}

// ── Curva de perda do BDI · BLOCO 6 do Excel (D.2) reconstruída das fórmulas-fonte ───────────────
// Duas curvas ao longo dos 46 meses, ambas saindo das MESMAS rubricas/fonte (regra do Excel):
//   • REAL (laranja cheia · col F)     — faturamento real até o BM corrente, previsto depois.
//   • TEÓRICA (verde tracejada · col H) — sempre previsto; fecha em 0 no mês final (régua de equilíbrio).
// Fórmulas (BLOCO 6, linhas 44–89):
//   gasto/mês (col C)            = custo mensal tempo (flat) = SUM(E22:E27)
//   remunerado/mês (col D)       = (faturamento_mês ÷ PV) × SUM(D22:D27)
//   remunerado teórico/mês (G)   = (previsto_mês  ÷ PV) × SUM(D22:D27)
// PV = Σ previsto da PRÓPRIA curva de faturamento (garante Σprevisto/PV = 1 → teórica → 0). O gap
// final da REAL (≈ R$ 1.725.507 na BR-101) é o BDI não recuperado pelo sub-faturamento inicial.
export type BdiCurvaPonto = {
  ordem: number;
  bm: number;
  mesLabel: string;
  previstoMesRs: number;
  realMesRs: number | null;
  medido: boolean;
  gastoMesRs: number;
  remRealMesRs: number;
  remTeoricaMesRs: number;
  perdaRealAcumRs: number;
  perdaTeoricaAcumRs: number;
};

export type BdiCurvaPerda = {
  pontos: BdiCurvaPonto[];
  /** Endpoint da curva REAL — o BDI não recuperado (gap entre as curvas no fim). */
  perdaRealFinalRs: number;
  /** Endpoint da curva TEÓRICA — deve ≈ 0 (a régua de equilíbrio fecha). */
  perdaTeoricaFinalRs: number;
  gastoMesRs: number;
  /** SUM(D22:D27) — total remunerado-na-vida das 6 rubricas de tempo. */
  remTotalRs: number;
  pvRs: number;
  bmCorrente: number | null;
};

const MES_ABBR_BDI = [
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

/** Reconstrói as duas curvas de perda do BDI (BLOCO 6) das fórmulas-fonte. `meses` vem da curva de
 *  faturamento (obra_faturamento_meses): contratado = previsto, real = faturado real. Null quando
 *  falta insumo (sem curva, sem gasto/mês, ou rubricas zeradas) → a tela cai no fallback. */
export function computeBdiCurvaPerda(
  params: BdiDeseqParams,
  rubricas: BdiRubricaTempo[],
  meses: { ano: number; mes: number; contratadoRs: number | null; realRs?: number | null }[] | null,
): BdiCurvaPerda | null {
  if (!meses || meses.length === 0) return null;
  const gastoMes = params.custoMensalTempoRs;
  const remTotal = rubricas.reduce((a, r) => a + (r.valorContratoRs ?? 0), 0);
  // PV consistente com a fonte do faturamento: Σ previsto da própria curva (não params.pvRs, que pode
  // divergir por arredondamento) — assim a TEÓRICA fecha exatamente em zero.
  const pv = meses.reduce((a, m) => a + (m.contratadoRs ?? 0), 0);
  if (gastoMes == null || !(gastoMes > 0) || !(remTotal > 0) || !(pv > 0)) return null;

  // Corte real = último mês com Real > 0 (workbook-motor). Até ele usa Real; depois, previsto.
  let lastReal = -1;
  meses.forEach((m, i) => {
    if (m.realRs != null && m.realRs > 0) lastReal = i;
  });

  let perdaRealAcum = 0;
  let perdaTeoricaAcum = 0;
  const pontos: BdiCurvaPonto[] = meses.map((m, i) => {
    const previsto = m.contratadoRs ?? 0;
    const medido = i <= lastReal;
    const realMes = medido ? (m.realRs ?? 0) : null;
    const realUsado = medido ? (realMes as number) : previsto;
    const remReal = (realUsado / pv) * remTotal;
    const remTeo = (previsto / pv) * remTotal;
    perdaRealAcum += gastoMes - remReal;
    perdaTeoricaAcum += gastoMes - remTeo;
    const mm = m.mes >= 1 && m.mes <= 12 ? MES_ABBR_BDI[m.mes] : "";
    return {
      ordem: i,
      bm: i + 1,
      mesLabel: mm ? `${mm}/${String(m.ano).slice(2)}` : `M${i + 1}`,
      previstoMesRs: previsto,
      realMesRs: realMes,
      medido,
      gastoMesRs: gastoMes,
      remRealMesRs: remReal,
      remTeoricaMesRs: remTeo,
      perdaRealAcumRs: perdaRealAcum,
      perdaTeoricaAcumRs: perdaTeoricaAcum,
    };
  });

  return {
    pontos,
    perdaRealFinalRs: perdaRealAcum,
    perdaTeoricaFinalRs: perdaTeoricaAcum,
    gastoMesRs: gastoMes,
    remTotalRs: remTotal,
    pvRs: pv,
    bmCorrente: params.bmCorrente ?? (lastReal >= 0 ? lastReal + 1 : null),
  };
}

/** Curva de perda mensal do D.2 BDI (BM 1–46). Null se ausente. */
export async function getBdiPerdaMensal(contractId: string): Promise<BdiPerdaMensal[] | null> {
  const { data, error } = await untypedTable("obra_bdi_perda_mensal")
    .select(
      "ordem, bm, mes_label, gasto_teorico_mes_rs, remunerado_mes_rs, perda_mes_rs, perda_acum_rs",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    bm: n(r.bm),
    mesLabel: r.mes_label != null ? String(r.mes_label) : null,
    gastoTeoricoMesRs: n(r.gasto_teorico_mes_rs),
    remuneradoMesRs: n(r.remunerado_mes_rs),
    perdaMesRs: n(r.perda_mes_rs),
    perdaAcumRs: n(r.perda_acum_rs),
  }));
}
