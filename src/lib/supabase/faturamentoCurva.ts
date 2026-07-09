// Read-model da Curva S financeira (Camada C) · lê obra_faturamento_curvas/meses (da Medição
// acumulada normalizada). Contratado (baseline planejado) + Projeção (realizado+forecast) em
// R$ por mês. O Real (medido) continua vindo das medições. Só leitura (anon SELECT na 0005).

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { CurvaPontoReal, FaturamentoReal } from "./medicoes";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type FaturamentoMes = {
  ano: number;
  mes: number;
  /** Baseline planejado do mês (R$). */
  contratadoRs: number | null;
  contratadoRsAcum: number | null;
  /** Realizado-lumpado + forecast do mês (R$). */
  projecaoRs: number | null;
  projecaoRsAcum: number | null;
  /** 'realizado' (mês ≤ data de corte) | 'forecast' | null. */
  tipoProjecao: string | null;
  /** Faturado REAL do mês (R$) — do workbook-motor (real_rs). null no fluxo Sorriso (Real vem das
   *  medições). Distinto de projecaoRs (que é realizado-lumpado + forecast). OPCIONAL: o fluxo
   *  Sorriso (e seus mocks de teste) nem o produz; consumidores leem com `?? `. */
  realRs?: number | null;
  realRsAcum?: number | null;
};

export type FaturamentoCurva = {
  custoTotal: number | null;
  status: string;
  meses: FaturamentoMes[];
  nMeses: number;
  /** Real acumulado até o último mês com Real > 0 (do workbook · real_rs). null quando a curva não
   *  traz Real direto (Sorriso) — aí o realizado vem das medições. Define o corte/realizado.
   *  OPCIONAL pelo mesmo motivo de realRs (mocks Sorriso não setam). */
  realAcum?: number | null;
};

/** PRECEDÊNCIA ÚNICA do realizado acumulado (achado #1 da validação adversarial): medições (cadeia
 *  de BMs · Sorriso) vencem; senão o Real DIRETO da curva (workbook-motor). Helper compartilhado
 *  pelos 7 hooks (Faturamento/Prazo/Indicadores/VisãoGeral) — antes 4 deles passavam só
 *  `real.realAcumulado` e só não divergiam por coincidência estrutural. */
export function realizadoAcumDe(
  real: { realAcumulado: number | null },
  curva: FaturamentoCurva | null,
): number | null {
  return real.realAcumulado ?? curva?.realAcum ?? null;
}

/** Curva S financeira de uma obra (Contratado + Projeção). Null se ainda não normalizada. */
export async function getFaturamentoCurva(contractId: string): Promise<FaturamentoCurva | null> {
  const { data: curvas, error: curErr } = await untypedTable("obra_faturamento_curvas")
    .select("id, custo_total, status")
    .eq("contrato_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1);
  // Falha de leitura (RLS/timeout/rede) NÃO pode virar null silencioso: a curva é o denominador
  // do farol acumulado em várias telas (Faturamento/Prazo/Indicadores/Desequilíbrio) — falhe alto.
  if (curErr) throw new Error(curErr.message);
  const cur = (curvas ?? [])[0] as
    | { id: string; custo_total: number | null; status: string }
    | undefined;
  if (!cur) return null;

  const { data: meses, error: mesErr } = await untypedTable("obra_faturamento_meses")
    .select(
      "ano, mes, contratado_rs, contratado_rs_acumulado, projecao_rs, projecao_rs_acumulado, tipo_projecao, real_rs, real_rs_acumulado",
    )
    .eq("curva_id", cur.id)
    .order("ordem", { ascending: true });
  if (mesErr) throw new Error(mesErr.message);

  const ms: FaturamentoMes[] = (
    (meses ?? []) as Array<{
      ano: number;
      mes: number;
      contratado_rs: number | null;
      contratado_rs_acumulado: number | null;
      projecao_rs: number | null;
      projecao_rs_acumulado: number | null;
      tipo_projecao: string | null;
      real_rs: number | null;
      real_rs_acumulado: number | null;
    }>
  ).map((m) => ({
    ano: m.ano,
    mes: m.mes,
    contratadoRs: m.contratado_rs != null ? Number(m.contratado_rs) : null,
    contratadoRsAcum: m.contratado_rs_acumulado != null ? Number(m.contratado_rs_acumulado) : null,
    projecaoRs: m.projecao_rs != null ? Number(m.projecao_rs) : null,
    projecaoRsAcum: m.projecao_rs_acumulado != null ? Number(m.projecao_rs_acumulado) : null,
    tipoProjecao: m.tipo_projecao ?? null,
    realRs: m.real_rs != null ? Number(m.real_rs) : null,
    realRsAcum: m.real_rs_acumulado != null ? Number(m.real_rs_acumulado) : null,
  }));

  // realAcum = acumulado no ÚLTIMO mês com Real > 0 (o corte real). Ignora a cauda flat (meses sem
  // Real cujo acumulado carrega o último valor) pra não confundir a detecção de corte da Camada B.
  let realAcum: number | null = null;
  for (const m of ms) {
    if (m.realRs != null && m.realRs > 0) realAcum = m.realRsAcum ?? null;
  }

  return {
    custoTotal: cur.custo_total != null ? Number(cur.custo_total) : null,
    status: cur.status,
    meses: ms,
    nMeses: ms.length,
    realAcum,
  };
}

/**
 * Sintetiza um `FaturamentoReal` a partir da CURVA (workbook-motor traz o Real DIRETO na curva, não
 * via cadeia de BMs). Usado por precedência quando a obra não tem medições mas a curva tem Real: os
 * "BMs" viram os meses COM Real > 0; saldo = contratado − realizado. NÃO substitui o fluxo Sorriso
 * (lá real_rs é null → este nem é chamado). Físico fica null (vem do cronograma, não do faturamento).
 */
export function faturamentoRealFromCurva(curva: FaturamentoCurva): FaturamentoReal {
  const comReal = curva.meses.filter((m) => m.realRs != null && m.realRs > 0);
  const pts: CurvaPontoReal[] = comReal.map((m, i) => ({
    bm: i + 1,
    medidoMes: m.realRs as number,
    acumulado: m.realRsAcum ?? 0,
    // competência conhecida (mês da curva) → o bridge casa BM↔mês por chave, não por posição
    ano: m.ano,
    mes: m.mes,
  }));
  const realAcum = curva.realAcum ?? null;
  const ct = curva.custoTotal;
  return {
    curva: pts,
    contratadoTotal: ct,
    contratadoTotalMotivo: null,
    realAcumulado: realAcum,
    pctFaturado: realAcum != null && ct ? realAcum / ct : null,
    saldoFaturar: ct != null && realAcum != null ? ct - realAcum : null,
    fisicoMes: null,
    fisicoAcumulado: null,
    nBms: pts.length,
  };
}
