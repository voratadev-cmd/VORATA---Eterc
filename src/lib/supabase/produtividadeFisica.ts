// Read-model do refactor C.7 Produtividade — parte FÍSICA + params/cards + ponte (dado real, antes
// EmptyState/config). Lê obra_produtividade_params (1 linha · KPIs + benchmarks + META REAL + ponte),
// obra_produtividade_fisica (tracker serviço×trecho), obra_produtividade_fisica_detalhe (cálculo por
// equip), obra_produtividade_impedimento (D.6). A série mensal financeira continua em
// produtividadeEconomica.ts. Conservação conferida pelo gate.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}
const n = (v: number | string | null) => (v != null ? Number(v) : null);

export type ProdParams = {
  bmCorrente: number | null;
  baseHh: string | null;
  valorTotalContratado: number | null;
  jornadaModHMes: number | null;
  jornadaMoiHMes: number | null;
  contratadaPeriodoRsHh: number | null;
  faturadoAcumRs: number | null;
  hhRealAcum: number | null;
  hhContratadoAcum: number | null;
  realAcumRsHh: number | null;
  realMesRsHh: number | null;
  aderenciaAcum: number | null;
  metaProjetoRsHh: number | null;
  farolAderencia: string | null;
  cambio: number | null;
  bmkAterpaRsHh: number | null;
  bmkSetorRsHh: number | null;
  realDivAterpa: number | null;
  realDivSetor: number | null;
  farolBmk: string | null;
  pontePctLiberado: number | null;
  pontePctAproveitamento: number | null;
  pontePctCapacidade: number | null;
  ponteOciosidadeHh: number | null;
};

export type ProdFisica = {
  ordem: number;
  disciplina: string | null;
  servico: string;
  trecho: string | null;
  unidade: string | null;
  qtdContratada: number | null;
  qtdMedida: number | null;
  pctFisico: number | null;
  cpuUnH: number | null;
  realUnH: number | null;
  aderencia: number | null;
  farol: string | null;
};

export type ProdFisicaDetalhe = {
  ordem: number;
  servico: string;
  frente: string | null;
  unidade: string | null;
  cpuUnH: number | null;
  equipPrincipal: string | null;
  qtdExecutada: number | null;
  diasServico: number | null;
  equipDia: number | null;
  equipHoras: number | null;
  realUnH: number | null;
  aderencia: number | null;
  farol: string | null;
};

export type ProdImpedimento = {
  ordem: number;
  impedimento: string;
  periodo: string | null;
  hhOciosas: number | null;
};

export async function getProdutividadeParams(contractId: string): Promise<ProdParams | null> {
  const { data, error } = await untypedTable("obra_produtividade_params")
    .select(
      "bm_corrente, base_hh, valor_total_contratado, jornada_mod_h_mes, jornada_moi_h_mes, contratada_periodo_rs_hh, faturado_acum_rs, hh_real_acum, hh_contratado_acum, real_acum_rs_hh, real_mes_rs_hh, aderencia_acum, meta_projeto_rs_hh, farol_aderencia, cambio, bmk_aterpa_rs_hh, bmk_setor_rs_hh, real_div_aterpa, real_div_setor, farol_bmk, ponte_pct_liberado, ponte_pct_aproveitamento, ponte_pct_capacidade, ponte_ociosidade_hh",
    )
    .eq("contrato_id", contractId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any;
  return {
    bmCorrente: n(r.bm_corrente),
    baseHh: r.base_hh != null ? String(r.base_hh) : null,
    valorTotalContratado: n(r.valor_total_contratado),
    jornadaModHMes: n(r.jornada_mod_h_mes),
    jornadaMoiHMes: n(r.jornada_moi_h_mes),
    contratadaPeriodoRsHh: n(r.contratada_periodo_rs_hh),
    faturadoAcumRs: n(r.faturado_acum_rs),
    hhRealAcum: n(r.hh_real_acum),
    hhContratadoAcum: n(r.hh_contratado_acum),
    realAcumRsHh: n(r.real_acum_rs_hh),
    realMesRsHh: n(r.real_mes_rs_hh),
    aderenciaAcum: n(r.aderencia_acum),
    metaProjetoRsHh: n(r.meta_projeto_rs_hh),
    farolAderencia: r.farol_aderencia != null ? String(r.farol_aderencia) : null,
    cambio: n(r.cambio),
    bmkAterpaRsHh: n(r.bmk_aterpa_rs_hh),
    bmkSetorRsHh: n(r.bmk_setor_rs_hh),
    realDivAterpa: n(r.real_div_aterpa),
    realDivSetor: n(r.real_div_setor),
    farolBmk: r.farol_bmk != null ? String(r.farol_bmk) : null,
    pontePctLiberado: n(r.ponte_pct_liberado),
    pontePctAproveitamento: n(r.ponte_pct_aproveitamento),
    pontePctCapacidade: n(r.ponte_pct_capacidade),
    ponteOciosidadeHh: n(r.ponte_ociosidade_hh),
  };
}

export async function getProdutividadeFisica(contractId: string): Promise<ProdFisica[] | null> {
  const { data, error } = await untypedTable("obra_produtividade_fisica")
    .select(
      "ordem, disciplina, servico, trecho, unidade, qtd_contratada, qtd_medida, pct_fisico, cpu_un_h, real_un_h, aderencia, farol",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    disciplina: r.disciplina != null ? String(r.disciplina) : null,
    servico: String(r.servico ?? ""),
    trecho: r.trecho != null ? String(r.trecho) : null,
    unidade: r.unidade != null ? String(r.unidade) : null,
    qtdContratada: n(r.qtd_contratada),
    qtdMedida: n(r.qtd_medida),
    pctFisico: n(r.pct_fisico),
    cpuUnH: n(r.cpu_un_h),
    realUnH: n(r.real_un_h),
    aderencia: n(r.aderencia),
    farol: r.farol != null ? String(r.farol) : null,
  }));
}

export async function getProdutividadeDetalhe(
  contractId: string,
): Promise<ProdFisicaDetalhe[] | null> {
  const { data, error } = await untypedTable("obra_produtividade_fisica_detalhe")
    .select(
      "ordem, servico, frente, unidade, cpu_un_h, equip_principal, qtd_executada, dias_servico, equip_dia, equip_horas, real_un_h, aderencia, farol",
    )
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    servico: String(r.servico ?? ""),
    frente: r.frente != null ? String(r.frente) : null,
    unidade: r.unidade != null ? String(r.unidade) : null,
    cpuUnH: n(r.cpu_un_h),
    equipPrincipal: r.equip_principal != null ? String(r.equip_principal) : null,
    qtdExecutada: n(r.qtd_executada),
    diasServico: n(r.dias_servico),
    equipDia: n(r.equip_dia),
    equipHoras: n(r.equip_horas),
    realUnH: n(r.real_un_h),
    aderencia: n(r.aderencia),
    farol: r.farol != null ? String(r.farol) : null,
  }));
}

export async function getProdutividadeImpedimentos(
  contractId: string,
): Promise<ProdImpedimento[] | null> {
  const { data, error } = await untypedTable("obra_produtividade_impedimento")
    .select("ordem, impedimento, periodo, hh_ociosas")
    .eq("contrato_id", contractId)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, number | string | null>>;
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    ordem: Number(r.ordem ?? 0),
    impedimento: String(r.impedimento ?? ""),
    periodo: r.periodo != null ? String(r.periodo) : null,
    hhOciosas: n(r.hh_ociosas),
  }));
}
