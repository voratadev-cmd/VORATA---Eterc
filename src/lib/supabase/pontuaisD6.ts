// Read-model da D.6 Análises Pontuais — eventos de paralisação/ociosidade (dado REAL normalizado).
// Lê obra_pontuais_evento (4 eventos: chuva + impedimentos · com a quebra de equipe por subtração),
// obra_pontuais_chuva_mensal (memória do pleiteável mês a mês), obra_pontuais_chuva_dia (ociosidade
// diária · equipe afetada), obra_pontuais_params (jornada/custos + resumo dos Cards: validada=0,
// pendente, nº eventos, farol). Conservação conferida pelo gate (Σ eventos == pendente · validada=0).

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}
const n = (v: number | string | null) => (v != null ? Number(v) : null);
const s = (v: unknown) => (v != null ? String(v) : null);

export type PontualEvento = {
  ordem: number;
  categoria: string | null;
  titulo: string;
  periodo: string | null;
  duracao: string | null;
  descricao: string | null;
  dias: number | null;
  modTotal: number | null;
  modFrentesAtivas: number | null;
  modAfetado: number | null;
  eqpTotal: number | null;
  eqpFrentesAtivas: number | null;
  eqpAfetado: number | null;
  hhOciosas: number | null;
  heqOciosas: number | null;
  custoModRs: number | null;
  custoEqpRs: number | null;
  custoRs: number | null;
  fonte: string | null;
  status: string | null;
};

export type PontualChuvaMes = {
  ordem: number;
  mesLabel: string | null;
  real5mm: number | null;
  prev5mm: number | null;
  excedente: number | null;
  fracaoExcedente: number | null;
  pleiteavelModRs: number | null;
  pleiteavelEqpRs: number | null;
  totalMesRs: number | null;
};

export type PontualChuvaDia = {
  ordem: number;
  dataLabel: string | null;
  chuvaMm: number | null;
  acima5mm: boolean | null;
  periodosAfetados: number | null;
  efetivoRdo: number | null;
  hhOciosas: number | null;
  custoOciosoRs: number | null;
  equipProducao: number | null;
  heqOciosas: number | null;
  custoEqpRs: number | null;
};

export type PontualParams = {
  jornadaDiaH: number | null;
  custoHoraModRs: number | null;
  custoHoraEqpRs: number | null;
  perdaValidadaRs: number | null;
  pendenteTotalRs: number | null;
  eventosPendentes: number | null;
  farol: string | null;
};

export async function getPontuaisEventos(contractId: string): Promise<PontualEvento[] | null> {
  const { data, error } = await untypedTable("obra_pontuais_evento")
    .select(
      "ordem, categoria, titulo, periodo, duracao, descricao, dias, mod_total, mod_frentes_ativas, mod_afetado, eqp_total, eqp_frentes_ativas, eqp_afetado, hh_ociosas, heq_ociosas, custo_mod_rs, custo_eqp_rs, custo_rs, fonte, status",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    categoria: s(r.categoria),
    titulo: String(r.titulo ?? ""),
    periodo: s(r.periodo),
    duracao: s(r.duracao),
    descricao: s(r.descricao),
    dias: n(r.dias as number | null),
    modTotal: n(r.mod_total as number | null),
    modFrentesAtivas: n(r.mod_frentes_ativas as number | null),
    modAfetado: n(r.mod_afetado as number | null),
    eqpTotal: n(r.eqp_total as number | null),
    eqpFrentesAtivas: n(r.eqp_frentes_ativas as number | null),
    eqpAfetado: n(r.eqp_afetado as number | null),
    hhOciosas: n(r.hh_ociosas as number | null),
    heqOciosas: n(r.heq_ociosas as number | null),
    custoModRs: n(r.custo_mod_rs as number | null),
    custoEqpRs: n(r.custo_eqp_rs as number | null),
    custoRs: n(r.custo_rs as number | null),
    fonte: s(r.fonte),
    status: s(r.status),
  }));
}

export async function getPontuaisChuvaMensal(
  contractId: string,
): Promise<PontualChuvaMes[] | null> {
  const { data, error } = await untypedTable("obra_pontuais_chuva_mensal")
    .select(
      "ordem, mes_label, real_5mm, prev_5mm, excedente, fracao_excedente, pleiteavel_mod_rs, pleiteavel_eqp_rs, total_mes_rs",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    mesLabel: s(r.mes_label),
    real5mm: n(r.real_5mm),
    prev5mm: n(r.prev_5mm),
    excedente: n(r.excedente),
    fracaoExcedente: n(r.fracao_excedente),
    pleiteavelModRs: n(r.pleiteavel_mod_rs),
    pleiteavelEqpRs: n(r.pleiteavel_eqp_rs),
    totalMesRs: n(r.total_mes_rs),
  }));
}

export async function getPontuaisChuvaDia(contractId: string): Promise<PontualChuvaDia[] | null> {
  const { data, error } = await untypedTable("obra_pontuais_chuva_dia")
    .select(
      "ordem, data_label, chuva_mm, acima_5mm, periodos_afetados, efetivo_rdo, hh_ociosas, custo_ocioso_rs, equip_producao, heq_ociosas, custo_eqp_rs",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | boolean | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    dataLabel: s(r.data_label),
    chuvaMm: n(r.chuva_mm as number | null),
    acima5mm: r.acima_5mm != null ? Boolean(r.acima_5mm) : null,
    periodosAfetados: n(r.periodos_afetados as number | null),
    efetivoRdo: n(r.efetivo_rdo as number | null),
    hhOciosas: n(r.hh_ociosas as number | null),
    custoOciosoRs: n(r.custo_ocioso_rs as number | null),
    equipProducao: n(r.equip_producao as number | null),
    heqOciosas: n(r.heq_ociosas as number | null),
    custoEqpRs: n(r.custo_eqp_rs as number | null),
  }));
}

export async function getPontuaisParams(contractId: string): Promise<PontualParams | null> {
  const { data, error } = await untypedTable("obra_pontuais_params")
    .select(
      "jornada_dia_h, custo_hora_mod_rs, custo_hora_eqp_rs, perda_validada_rs, pendente_total_rs, eventos_pendentes, farol",
    )
    .eq("contrato_id", contractId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any;
  return {
    jornadaDiaH: n(r.jornada_dia_h),
    custoHoraModRs: n(r.custo_hora_mod_rs),
    custoHoraEqpRs: n(r.custo_hora_eqp_rs),
    perdaValidadaRs: n(r.perda_validada_rs),
    pendenteTotalRs: n(r.pendente_total_rs),
    eventosPendentes: n(r.eventos_pendentes),
    farol: s(r.farol),
  };
}
