// Camada B · cálculo de FATURAMENTO (puro, sem I/O). A partir da curva financeira crua
// (Contratado planejado × Projeção = realizado-lumpado + forecast) e do REALIZADO autoritativo
// (cadeia de BMs, obra_medicoes), deriva a série de desvios/aderências acumuladas, identifica o
// MÊS DE CORTE (até onde é realizado) e produz um resumo "atual" com o FAROL aplicado.
//
// Princípio (back sólido e geral > tela): isto NÃO depende do shape de nenhuma tela. Devolve
// número cru + classificação; qualquer view (hoje ou futura) escolhe o que mostrar.
//
// Por que o realizado vem dos BMs e não da projeção: a "Projeção" da Medição acumulada lumpa o
// realizado nos meses até o corte e segue como forecast. O realizado LIMPO (por BM, vindo dos
// PDFs) é a fonte autoritativa. Como `Σ projeção até o corte == Σ BM` (validado por valor na
// Sorriso: 9.927.488 = 9.927.488), o corte = o mês cujo `projecao_acum` casa com o realizado.

import type { FaturamentoCurva, FaturamentoMes } from "@/lib/supabase/faturamentoCurva";
import { classificarPorRegra, type FarolLevel, type FarolRegra } from "./farol";

/** Divide com guarda: null se ausente, NÃO-finito (NaN/Infinity) ou denominador zero. O guard de
 * finitude é dura: um NaN/Infinity vindo de upstream (parse ruim, divisão anterior) NÃO pode
 * vazar pro farol — erro de milhões. NaN passa por `== null` (NaN != null), por isso o isFinite. */
function pct(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null) return null;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return (num / den) * 100;
}

export type FaturamentoMesCalc = {
  ano: number;
  mes: number;
  tipo: "realizado" | "forecast" | null;
  /** Planejado (Contratado) e Projeção, do mês e acumulado. */
  contratadoRs: number | null;
  contratadoAcum: number | null;
  projecaoRs: number | null;
  projecaoAcum: number | null;
  /** Desvio acumulado (Projeção − Contratado), em R$ e %. Negativo = atraso de faturamento. */
  desvioAcumRs: number | null;
  desvioAcumPct: number | null;
  /** Aderência acumulada (Projeção ÷ Contratado, %). "Maior = melhor". */
  aderenciaAcum: number | null;
};

export type FaturamentoResumo = {
  custoTotal: number | null;
  /** Último mês considerado realizado (data de corte). Null se não há realizado conhecido. */
  mesCorte: { ano: number; mes: number } | null;
  /** Acumulados NO CORTE (a "foto" atual da obra). realizadoAcum = cadeia de BMs (autoritativo). */
  contratadoAcum: number | null;
  realizadoAcum: number | null;
  desvioAcumRs: number | null;
  desvioAcumPct: number | null;
  aderenciaAcum: number | null;
  /** FAROL OFICIAL da C.3 = aderência acum. classificada (régua 'faturamento_aderencia_acumulada',
   *  90/85/70). A C.2 usa o DESVIO em p.p. — métricas distintas de propósito (operacional × executiva). */
  farol: FarolLevel | null;
  /** Avanço financeiro vs custo total da obra (planejado × realizado), em %. */
  avancoContratadoPct: number | null;
  avancoRealizadoPct: number | null;
};

export type FaturamentoCalc = FaturamentoResumo & {
  serie: FaturamentoMesCalc[];
};

export type CalcFaturamentoOpts = {
  /** Realizado acumulado autoritativo (Σ até o último BM). Define o corte e a aderência. */
  realizadoAcum?: number | null;
  /** Régua de farol já mesclada com os overrides da obra (default: régua oficial). */
  regras?: Record<string, FarolRegra>;
  /**
   * Override do BM de corte (seletor de período do RMA). Ausente/null = corte = último mês medido
   * (comportamento de hoje, intacto). Quando presente, "rebobina" o corte pro mês escolhido e o
   * realizado do resumo passa a ser o acumulado NAQUELE mês.
   */
  corteBmOverride?: { ano: number; mes: number } | null;
};

function normTipo(t: string | null | undefined): "realizado" | "forecast" | null {
  if (t === "realizado" || t === "forecast") return t;
  return null;
}

/**
 * Acha o índice do mês de corte. Preferência: o realizado autoritativo (casa `projecao_acum` com
 * `realizadoAcum`, mês mais próximo). Fallback: último mês marcado `tipo_projecao = 'realizado'`.
 * Retorna -1 se nenhum sinal de corte existir.
 */
// Realizado EFETIVO do mês: a Projeção (fluxo Sorriso · realizado-lumpado) OU, quando a curva traz o
// Real DIRETO (workbook-motor · real_rs), esse. `??` preserva o Sorriso intacto (lá real_rs é null).
function realAcumEfetivo(m: FaturamentoMes): number | null {
  return m.projecaoRsAcum ?? m.realRsAcum ?? null;
}
function realMesEfetivo(m: FaturamentoMes): number | null {
  return m.projecaoRs ?? m.realRs ?? null;
}

function acharCorteIdx(
  curva: FaturamentoCurva,
  realizadoAcum: number | null | undefined,
  corteBmOverride?: { ano: number; mes: number } | null,
): number {
  // Corte NATURAL (lógica de sempre): realizado autoritativo (mês acum mais próximo) → último mês
  // 'realizado' → último com Real DIRETO > 0. É o último mês MEDIDO.
  let natural = -1;
  if (realizadoAcum != null && Number.isFinite(realizadoAcum)) {
    let menorDiff = Number.POSITIVE_INFINITY;
    curva.meses.forEach((m, i) => {
      const acum = realAcumEfetivo(m);
      if (acum == null) return;
      const diff = Math.abs(acum - realizadoAcum);
      if (diff < menorDiff) {
        menorDiff = diff;
        natural = i;
      }
    });
  }
  if (natural < 0) {
    curva.meses.forEach((m, i) => {
      if (normTipo(m.tipoProjecao) === "realizado") natural = i;
    });
  }
  if (natural < 0) {
    // fallback (workbook · sem projeção nem tipo): último mês com REAL DIRETO da curva > 0 é o corte.
    // Usa m.realRs (não o efetivo) DE PROPÓSITO: no Sorriso real_rs é null → não dispara.
    curva.meses.forEach((m, i) => {
      if (m.realRs != null && m.realRs > 0) natural = i;
    });
  }
  // Override do seletor de período: só "rebobina pra trás" — aceita o mês escolhido apenas se ELE
  // EXISTE e é <= corte natural (nunca avança pro forecast/futuro). Senão, cai no corte natural
  // (graceful, ex.: ?bm velho/inválido) — nunca rotula forecast como realizado.
  if (corteBmOverride) {
    const i = curva.meses.findIndex(
      (m) => m.ano === corteBmOverride.ano && m.mes === corteBmOverride.mes,
    );
    if (i >= 0 && (natural < 0 || i <= natural)) return i;
  }
  return natural;
}

/**
 * Calcula a Camada B do Faturamento a partir da curva crua + realizado autoritativo. Pura:
 * mesmos dados → mesmo resultado. Não joga erro; campos ausentes viram null e o farol fica null.
 */
export function calcularFaturamento(
  curva: FaturamentoCurva | null,
  opts: CalcFaturamentoOpts = {},
): FaturamentoCalc | null {
  if (!curva) return null;
  const custoTotal = curva.custoTotal;
  const corteIdx = acharCorteIdx(curva, opts.realizadoAcum, opts.corteBmOverride);

  const serie: FaturamentoMesCalc[] = curva.meses.map((m, i) => {
    const realAcum = realAcumEfetivo(m);
    const desvioAcumRs =
      realAcum != null && m.contratadoRsAcum != null ? realAcum - m.contratadoRsAcum : null;
    const tipo: "realizado" | "forecast" | null =
      corteIdx >= 0 ? (i <= corteIdx ? "realizado" : "forecast") : normTipo(m.tipoProjecao);
    return {
      ano: m.ano,
      mes: m.mes,
      tipo,
      contratadoRs: m.contratadoRs,
      contratadoAcum: m.contratadoRsAcum,
      projecaoRs: realMesEfetivo(m),
      projecaoAcum: realAcum,
      desvioAcumRs,
      desvioAcumPct: pct(desvioAcumRs, m.contratadoRsAcum),
      aderenciaAcum: pct(realAcum, m.contratadoRsAcum),
    };
  });

  const corte = corteIdx >= 0 ? serie[corteIdx] : null;
  // Override só "vale" se o corte caiu EXATAMENTE no mês escolhido (acharCorteIdx pode ter ignorado
  // um override forward/inexistente e voltado ao corte natural → aí seguimos o default).
  const overrideAplicado =
    opts.corteBmOverride != null &&
    corte != null &&
    corte.ano === opts.corteBmOverride.ano &&
    corte.mes === opts.corteBmOverride.mes;
  // realizado autoritativo (BM) se veio; senão a própria projeção acumulada no corte.
  // COM override aplicado: o realizado vem do acumulado NAQUELE mês (corte.projecaoAcum), não do total
  // autoritativo das medições (cheio) — senão um BM anterior mostraria real cheio × contratado parcial.
  // Sem override (default), a expressão é idêntica à de antes.
  const realizadoAcum = overrideAplicado
    ? (corte?.projecaoAcum ?? null)
    : opts.realizadoAcum != null && Number.isFinite(opts.realizadoAcum)
      ? opts.realizadoAcum
      : (corte?.projecaoAcum ?? null);
  const contratadoAcum = corte?.contratadoAcum ?? null;
  const desvioAcumRs =
    realizadoAcum != null && contratadoAcum != null ? realizadoAcum - contratadoAcum : null;
  const aderenciaAcum = pct(realizadoAcum, contratadoAcum);

  const resumo: FaturamentoResumo = {
    custoTotal,
    mesCorte: corte ? { ano: corte.ano, mes: corte.mes } : null,
    contratadoAcum,
    realizadoAcum,
    desvioAcumRs,
    desvioAcumPct: pct(desvioAcumRs, contratadoAcum),
    aderenciaAcum,
    // FAROL OFICIAL da C.3 (operacional): ADERÊNCIA acumulada (real ÷ previsto acum), régua 90/85/70.
    // A C.2 (Indicadores · executiva) segue com o DESVIO em p.p. — distintas DE PROPÓSITO (não unificar).
    farol: classificarPorRegra("faturamento_aderencia_acumulada", aderenciaAcum, opts.regras),
    avancoContratadoPct: pct(contratadoAcum, custoTotal),
    avancoRealizadoPct: pct(realizadoAcum, custoTotal),
  };

  return { ...resumo, serie };
}
