// Camada B · cálculo de PRAZO (puro, sem I/O). Junta o cronograma PREVISTO físico (curva de
// avanço + datas da obra) com o cálculo de Faturamento (que já resolve o mês de corte e o
// realizado autoritativo) e deriva: posição de calendário (decorrido/restante), o avanço
// PREVISTO no corte (físico e financeiro) e uma referência de aderência FINANCEIRA.
//
// HONESTIDADE (regra dura — erro de prazo = milhões): o realizado FÍSICO agora vem do BM
// (`obra_medicao_totais.fisico_pct_acumulado`, oficial §4.1 = 24,99% na Sorriso) — expomos
// `avancoFisicoRealPct` como âncora. MAS o farol de aderência física só sai quando o PREVISTO
// físico do cronograma for COERENTE com o previsto financeiro (guard de coerência): se divergirem
// muito, o baseline está quebrado e farolFisico fica PENDENTE com motivo — emitir Crítico de um
// previsto inconsistente seria o erro que §4.1 alerta. O que damos:
//   • calendário puro (informativo, sem farol);
//   • previsto físico no corte = onde o PLANO dizia que estaríamos (informativo);
//   • realizado físico (âncora oficial) + atraso físico (informativo);
//   • aderência FÍSICA (farol) só quando previsto físico×financeiro coerentes;
//   • aderência FINANCEIRA (realizado R$ ÷ previsto R$) — financeiro×financeiro, referência (proxy).
//     NUNCA cruzar realizado-financeiro com previsto-físico.

import type { CronogramaPrevisto } from "@/lib/supabase/cronograma";
import type { FaturamentoCalc } from "./calcFaturamento";
import { classificarPorRegra, type FarolLevel, type FarolRegra } from "./farol";

const DIA_MS = 86_400_000;

// Coerência do PLANO: o previsto FÍSICO e o previsto FINANCEIRO de um mês devem andar juntos
// (fatura-se conforme se constrói). Um gap grande denuncia baseline físico mis-escalado/desalinhado
// (ex.: Sorriso · previsto físico 82,5% × financeiro 23,3% no corte → Δ59pp, baseline MS Project R0
// obsoleto). Acima deste limite, NÃO emitimos farol físico — seria Crítico de baseline quebrado (o
// erro que §4.1 alerta). Calibração: 15pp tolera o descasamento NORMAL (mobilização/retenção podem
// pôr o físico modestamente à frente do financeiro), mas barra o descasamento de revisões diferentes
// (dezenas de pp). Configurável por contrato no futuro.
const LIMITE_COERENCIA_PREVISTO_PP = 15;

/** Parse "YYYY-MM-DD" → epoch ms (UTC, meia-noite). null se inválido/ausente. */
function parseISO(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Dias inteiros entre duas datas ISO (b − a). null se qualquer uma faltar. */
function diffDias(aISO: string | null, bISO: string | null): number | null {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  if (a == null || b == null) return null;
  return Math.round((b - a) / DIA_MS);
}

/** Último dia do mês (ano, mes 1..12) como ISO "YYYY-MM-DD" (UTC). */
function fimDoMesISO(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0)); // dia 0 do mês seguinte = último dia deste
  return d.toISOString().slice(0, 10);
}

/** Divide com guarda: null se ausente, NÃO-finito (NaN/Infinity) ou denominador zero — NaN não
 * pode vazar pro farol (passa por `== null`, por isso o isFinite). */
function pct(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null) return null;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return (num / den) * 100;
}

export type PrazoCalc = {
  // ── calendário (informativo, SEM farol) ──
  inicioISO: string | null;
  fimContratualISO: string | null;
  prazoContratualDias: number | null;
  /** Data-referência da foto = fim do mês de corte (último BM). */
  dataReferenciaISO: string | null;
  decorridoDias: number | null;
  decorridoPct: number | null;
  restantesDias: number | null;
  // ── posição no corte ──
  mesCorte: { ano: number; mes: number } | null;
  /** Avanço FÍSICO previsto no corte (plano, %). Informativo — não casar com financeiro. */
  previstoFisicoPct: number | null;
  // ── referência FINANCEIRA (proxy honesto, financeiro×financeiro) ──
  realizadoFinanceiroPct: number | null;
  previstoFinanceiroPct: number | null;
  aderenciaFinanceiraPct: number | null;
  /** realizado% − previsto% financeiro (pp). Positivo = adiantado no faturamento. */
  atrasoFinanceiroPp: number | null;
  farolFinanceiro: FarolLevel | null;
  // ── aderência FÍSICA (físico×físico — o farol que o Prazo de fato pede) ──
  fisicoRealizadoDisponivel: boolean;
  /** Avanço FÍSICO realizado acumulado (%) — âncora oficial do BM (§4.1). */
  avancoFisicoRealPct: number | null;
  /** Físico realizado DO MÊS (%) — informativo. */
  fisicoRealMesPct: number | null;
  /** realizado% − previsto% físico (pp). Negativo = atrasado fisicamente. */
  atrasoFisicoPp: number | null;
  /** previsto físico − previsto financeiro (pp) — gap de coerência do PLANO. */
  previstoFisicoVsFinanceiroPp: number | null;
  /** Farol da aderência física — null enquanto o previsto físico não for coerente (motivo abaixo). */
  farolFisico: FarolLevel | null;
  /** Por que o farol físico não saiu (null se saiu). */
  farolFisicoMotivo: string | null;
};

export type CalcPrazoOpts = {
  inicioISO?: string | null;
  fimContratualISO?: string | null;
  /** Físico realizado ACUMULADO do BM (fração 0..1) — do read-model de medições. */
  fisicoRealizadoAcum?: number | null;
  /** Físico realizado DO MÊS do BM (fração 0..1). */
  fisicoRealizadoMes?: number | null;
  /** Régua de farol já mesclada com os overrides da obra (default: régua oficial). */
  regras?: Record<string, FarolRegra>;
};

/**
 * Camada B do Prazo. Pura: mesmos dados → mesmo resultado. Não joga erro; ausências viram null.
 * Reusa o `mesCorte`/realizado do Faturamento — NÃO reimplementa o corte.
 */
export function calcularPrazo(
  cron: CronogramaPrevisto | null,
  faturamento: FaturamentoCalc | null,
  opts: CalcPrazoOpts = {},
): PrazoCalc | null {
  if (!cron && !faturamento) return null;

  const inicioISO = opts.inicioISO ?? cron?.inicioObra ?? null;
  const fimContratualISO = opts.fimContratualISO ?? cron?.terminoObra ?? null;
  const mesCorte = faturamento?.mesCorte ?? null;
  const dataReferenciaISO = mesCorte ? fimDoMesISO(mesCorte.ano, mesCorte.mes) : null;

  const prazoContratualDias = diffDias(inicioISO, fimContratualISO);
  const decorridoDias = diffDias(inicioISO, dataReferenciaISO);
  const restantesDias =
    prazoContratualDias != null && decorridoDias != null
      ? prazoContratualDias - decorridoDias
      : null;

  // previsto FÍSICO no mês de corte (fração 0..1 → %)
  let previstoFisicoPct: number | null = null;
  if (cron && mesCorte) {
    const m = cron.meses.find((x) => x.ano === mesCorte.ano && x.mes === mesCorte.mes);
    if (m) previstoFisicoPct = m.previstoPctAcumulado * 100;
  }

  // referência financeira (vem pronta do Faturamento — financeiro×financeiro)
  const realizadoFinanceiroPct = faturamento?.avancoRealizadoPct ?? null;
  const previstoFinanceiroPct = faturamento?.avancoContratadoPct ?? null;
  const aderenciaFinanceiraPct = faturamento?.aderenciaAcum ?? null;
  const atrasoFinanceiroPp =
    realizadoFinanceiroPct != null && previstoFinanceiroPct != null
      ? realizadoFinanceiroPct - previstoFinanceiroPct
      : null;

  // ── aderência FÍSICA (físico × físico) ──────────────────────────────
  const fisicoAcumFrac = opts.fisicoRealizadoAcum ?? null; // fração 0..1
  const avancoFisicoRealPct = fisicoAcumFrac != null ? fisicoAcumFrac * 100 : null;
  const fisicoRealMesPct = opts.fisicoRealizadoMes != null ? opts.fisicoRealizadoMes * 100 : null;
  const fisicoRealizadoDisponivel = avancoFisicoRealPct != null;
  const atrasoFisicoPp =
    avancoFisicoRealPct != null && previstoFisicoPct != null
      ? avancoFisicoRealPct - previstoFisicoPct
      : null;
  // o previsto físico do cronograma bate com o previsto financeiro do plano?
  const previstoFisicoVsFinanceiroPp =
    previstoFisicoPct != null && previstoFinanceiroPct != null
      ? previstoFisicoPct - previstoFinanceiroPct
      : null;
  // farol físico só sai com real disponível, previsto presente E previsto coerente
  let farolFisico: FarolLevel | null = null;
  let farolFisicoMotivo: string | null = null;
  if (!fisicoRealizadoDisponivel) {
    farolFisicoMotivo = "sem físico realizado no BM";
  } else if (previstoFisicoPct == null) {
    farolFisicoMotivo = "sem previsto físico no corte para comparar";
  } else if (previstoFisicoVsFinanceiroPp == null) {
    // sem previsto FINANCEIRO não há como validar a coerência do baseline físico — coerência
    // não-verificável é motivo de PENDÊNCIA, não passe-livre (o header deste arquivo exige a
    // validação antes de emitir farol físico)
    farolFisicoMotivo =
      "coerência físico×financeiro não-verificável (sem previsto financeiro no corte) — farol pendente";
  } else if (Math.abs(previstoFisicoVsFinanceiroPp) > LIMITE_COERENCIA_PREVISTO_PP) {
    farolFisicoMotivo =
      `previsto físico (${previstoFisicoPct.toFixed(1)}%) incoerente com o financeiro ` +
      `(${previstoFinanceiroPct!.toFixed(1)}%, Δ${previstoFisicoVsFinanceiroPp.toFixed(0)}pp) — ` +
      `baseline não reconciliado (§4.1/§3)`;
  } else {
    farolFisico = classificarPorRegra("prazo_atraso_fisico", atrasoFisicoPp, opts.regras);
  }

  return {
    inicioISO,
    fimContratualISO,
    prazoContratualDias,
    dataReferenciaISO,
    decorridoDias,
    decorridoPct: pct(decorridoDias, prazoContratualDias),
    restantesDias,
    mesCorte,
    previstoFisicoPct,
    realizadoFinanceiroPct,
    previstoFinanceiroPct,
    aderenciaFinanceiraPct,
    atrasoFinanceiroPp,
    // a referência financeira do Prazo É o farol de faturamento (desvio acum.) — reusa-o
    farolFinanceiro: faturamento?.farol ?? null,
    // aderência física: real (âncora oficial) exposto; farol só com previsto coerente
    fisicoRealizadoDisponivel,
    avancoFisicoRealPct,
    fisicoRealMesPct,
    atrasoFisicoPp,
    previstoFisicoVsFinanceiroPp,
    farolFisico,
    farolFisicoMotivo,
  };
}
