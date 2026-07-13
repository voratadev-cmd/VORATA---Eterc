// Bridge (Camada B → BmSnapshot) · Faturamento — o PRIMEIRO elo do "Bridge Camada B → BmSnapshot"
// (DADOS-PENDENTES §7.1). Materializa o FaturamentoBM que a aba consome a partir do cálculo puro
// (FaturamentoCalc) + o read-model real (FaturamentoReal). Campos com dado normalizado saem REAIS;
// campos de IA / por-frente saem como PENDENTE honesto — NUNCA inventa número/texto.

import { formatBRLAbbreviated } from "@/lib/mocks/contracts";
import type { FaturamentoBM, PeriodoFat } from "@/lib/mocks/obras";
import type { FaturamentoReal } from "@/lib/supabase/medicoes";
import type { SinteseTexto } from "@/lib/supabase/sinteses";
import type { FaturamentoCalc } from "./calcFaturamento";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "mai/26" — rótulo de mês/ano para o eixo da Curva S e cabeçalhos (a curva REAL é mensal). */
function rotuloMes(ano: number, mes: number): string {
  return `${MESES[mes - 1]}/${String(ano % 100).padStart(2, "0")}`;
}

/** R$ com sinal explícito para o desvio (+R$ 653 k / −R$ 1,2 mi). */
function rotuloComSinal(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : "−"}${formatBRLAbbreviated(Math.abs(v))}`;
}

/** R$ → milhões arredondado a 2 casas (unidade do eixo Y da Curva S). null preserva o gap. */
function emMilhoes(v: number | null | undefined): number | null {
  return v != null ? Math.round((v / 1e6) * 100) / 100 : null;
}

const PENDENTE_IA = "Pendente — gerado pelo Adm Contratual IA a partir dos números normalizados.";

/** R$ em milhões com 2 casas — preserva o centavo no valor AUDITÁVEL do ritmo (validado vs _12).
 *  formatBRLAbbreviated arredonda ≥10mi p/ 0 casas (12,94M→"R$ 13 mi"); aqui mostra-se o centavo. */
function fmtMiExato(v: number | null): string {
  return v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";
}

/** Earned Schedule (cronograma ganho): em qual "mês de cronograma" o planejado-acumulado da Curva S
 *  contratada igualaria o REALIZADO-acumulado de hoje. Interpola dentro do mês em que o baseline cruza
 *  o realizado. Retorna o nº de BM fracionário (origem sintética = BM 0, acum 0). null se o realizado
 *  é ≤0 / não-finito ou ultrapassa todo o baseline (obra adiantada além do horizonte contratado). */
function earnedSchedule(serie: FaturamentoCalc["serie"], realizadoAcum: number): number | null {
  if (!Number.isFinite(realizadoAcum) || realizadoAcum <= 0) return null;
  for (let i = 0; i < serie.length; i++) {
    const acum = serie[i].contratadoAcum;
    if (acum == null) continue;
    if (acum >= realizadoAcum) {
      const prevAcum = i > 0 ? (serie[i - 1].contratadoAcum ?? 0) : 0;
      const span = acum - prevAcum;
      const frac = span > 0 ? (realizadoAcum - prevAcum) / span : 0;
      // o ponto i tem nº de BM (i+1); seu antecessor tem (i) — ou a origem sintética BM 0 quando i=0.
      return i + frac;
    }
  }
  return null;
}

/** Deck de projeção (ritmo · projeção término · Δ vs prazo) — derivado da curva (BMs executados).
 *  RITMO = média dos últimos 3 BMs reais (métrica exibida). PROJEÇÃO TÉRMINO = Earned Schedule:
 *  mede em que mês de cronograma o realizado-acum foi "ganho" (ES) e estende o trabalho restante ao
 *  passo planejado → projeção = bmCorrente + (prazo − ES). Na BR-101: ritmo R$ 4,29M · ES 1,98 ·
 *  projeção 47,0 · Δ +1,0. (A fórmula antiga "BM corrente + saldo ÷ ritmo" extrapolava TODO o saldo
 *  ao ritmo de mobilização → mês 142, absurdo.) Faturado/previsto/aderência do mês não saem aqui —
 *  o tooltip do gráfico os mostra por BM (da curvaS). */
function buildPeriodo(calc: FaturamentoCalc): PeriodoFat | null {
  const serie = calc.serie;
  // BM corrente = ÚLTIMO mês 'realizado' (data de corte). Guardamos o ÍNDICE na série inteira para
  // contar "meses decorridos" mesmo que as tags venham não-contíguas (robusto vs realizados.length).
  let corteIdx = -1;
  for (let i = 0; i < serie.length; i++) if (serie[i].tipo === "realizado") corteIdx = i;
  if (corteIdx < 0) return null;

  // Ritmo médio = realizado acumulado ÷ meses DECORRIDOS (spec C.3: 10.219.923 ÷ 9 = 1.135.547).
  // Meses ociosos contam — são lentidão real. (A média dos últimos 3 BMs escondia os meses parados.)

  // Realizado acum. = o do CALC (recortado ao corte/override). Em default == real.realAcumulado
  // (calc recebe realizadoAcumDe(real,curva) como opts.realizadoAcum), então o ES não muda sem ?bm;
  // sob override, a projeção passa a ser coerente "como naquele BM" (antes usava o realizado cheio).
  const realizadoAcum = calc.realizadoAcum;
  const bmCorrente = corteIdx + 1; // meses decorridos (posição do corte na série)
  const ritmo = realizadoAcum != null && bmCorrente > 0 ? realizadoAcum / bmCorrente : null;
  // Prazo = horizonte do BASELINE contratado (Curva S contratada): meses com contratadoRs != null —
  // NÃO serie.length, que pode incluir cauda de projeção sem baseline. Para a BR-101 ambos = 46.
  const prazo = serie.filter((s) => s.contratadoRs != null).length;
  // PROJEÇÃO TÉRMINO = prazo ÷ aderência acumulada (spec C.3 · é o que o workbook declara:
  // 18 ÷ 0,58697 = 30,67 → Δ +12,7 → mar/28). Aderência = realizado-acum ÷ contratado-acum no corte.
  let ctAcumCorte = 0;
  for (let i = 0; i <= corteIdx; i++) ctAcumCorte += serie[i].contratadoRs ?? 0;
  const aderAcum = realizadoAcum != null && ctAcumCorte > 0 ? realizadoAcum / ctAcumCorte : null;
  const projecao = aderAcum != null && aderAcum > 0 && prazo > 0 ? prazo / aderAcum : null;
  const delta = projecao != null && prazo > 0 ? projecao - prazo : null;
  // Δ exibido = arredondado a 1 casa. O alerta acende sobre o MESMO valor arredondado (não o cru),
  // para o card nunca ler "0 meses" enquanto o banner diz que ultrapassa. O "⚠" é apresentação (a UI
  // desenha o ícone) — o dado é texto limpo.
  const deltaRound = delta != null ? Math.round(delta * 10) / 10 : null;
  // Período (mês de corte): faturado (real) × previsto do mês + aderência do período. Honesto: o
  // faturado vem do real do corte; se o mês de corte não tem real medido, fica "—" (sem 0 fabricado).
  const corteMes = serie[corteIdx];
  const faturadoMes = corteMes.projecaoRs;
  const previstoMesCorte = corteMes.contratadoRs;
  const aderenciaPeriodoPct =
    previstoMesCorte != null && previstoMesCorte > 0 && faturadoMes != null
      ? (faturadoMes / previstoMesCorte) * 100
      : null;
  // mês-calendário do término projetado: mês #floor(projeção) contando do 1º mês da série
  let projecaoTerminoMesLabel: string | null = null;
  if (projecao != null && serie[0]?.ano != null && serie[0]?.mes != null) {
    const idxMes = Math.floor(projecao) - 1;
    const d = new Date(serie[0].ano, serie[0].mes - 1 + idxMes, 1);
    projecaoTerminoMesLabel = `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
  }
  return {
    bmCorrente,
    faturadoMesLabel: fmtMiExato(faturadoMes),
    previstoMesLabel: fmtMiExato(previstoMesCorte),
    aderenciaPeriodoPct,
    ritmo3BmLabel: fmtMiExato(ritmo),
    projecaoTerminoMeses: projecao != null ? Math.round(projecao * 10) / 10 : null,
    projecaoTerminoMesLabel,
    deltaProjecaoMeses: deltaRound,
    alertaProrrogacao:
      deltaRound != null && deltaRound > 0 ? "Projeção ultrapassa o prazo contratual" : null,
  };
}

import type { FarolRegra } from "./farol";

export type FaturamentoBridge = {
  fat: FaturamentoBM;
  bmLabel: string;
  /** Mês de corte (data da "foto") — usado por outras abas p/ acumular "até o BM" (ex.: Recursos). */
  mesCorte: { ano: number; mes: number };
  /** Régua mesclada c/ os overrides da obra — linhas/legendas classificam pela MESMA régua do farol oficial. */
  regras?: Record<string, FarolRegra>;
};

/**
 * Monta o FaturamentoBM (forma da aba) do dado REAL. null se não há faturamento normalizado.
 * REAIS: 5 KPIs, Curva S (contratado + real + projeção), desvio/farol, saldo, histórico por BM.
 * PENDENTES (honestos): análise textual, alerta, frentes (sem planilha por-frente), chat.
 */
export function buildFaturamentoBm(
  calc: FaturamentoCalc | null,
  real: FaturamentoReal,
  analiseIA?: SinteseTexto | null,
): FaturamentoBridge | null {
  if (!calc || !calc.mesCorte || calc.realizadoAcum == null) return null;

  const corte = calc.mesCorte;
  const bmLabel = rotuloMes(corte.ano, corte.mes);
  const custoTotal = calc.custoTotal ?? real.contratadoTotal ?? 0;

  // Curva S: série mensal → pontos (em milhões). Real até o corte; projeção do corte em diante.
  // O ponto do CORTE entra em ambas (real + projeção) para a linha tracejada conectar à sólida.
  // CUMULATIVA: quando o acumulado vem null (o baseline contratado termina antes da projeção),
  // carrega o último valor válido (platô) — NUNCA despenca a 0 no fim da curva.
  // PROJEÇÃO só existe se há forecast REAL (Sorriso, projeção do corte em diante). No workbook-motor
  // NÃO há projeção — o realizado acumulado apenas carrega o último valor (platô); desenhar esse
  // platô como "Projeção" é ENGANOSO (linha tracejada flat até o fim). Detecção ROBUSTA: a projeção
  // de verdade CRESCE além do realizado-no-corte; o platô da workbook fica igual ao realizado. Só
  // desenhamos a projeção quando algum mês forecast a ultrapassa; senão a curva é só Contratado × Real.
  const temForecast =
    calc.realizadoAcum != null &&
    calc.serie.some(
      (s) =>
        s.tipo === "forecast" && s.projecaoAcum != null && s.projecaoAcum > calc.realizadoAcum! + 1,
    );
  let ultimoContratado = 0;
  const curvaS = calc.serie.map((s) => {
    const ehCorte = s.ano === corte.ano && s.mes === corte.mes;
    const c = emMilhoes(s.contratadoAcum);
    if (c != null) ultimoContratado = c;
    const proj = emMilhoes(s.projecaoAcum);
    return {
      bm: rotuloMes(s.ano, s.mes),
      contratado: c ?? ultimoContratado,
      real: s.tipo === "realizado" ? proj : null,
      projecao: temForecast && (s.tipo === "forecast" || ehCorte) ? proj : null,
      // Barras mensais (não acumuladas): Previsto Todo do mês + Real medido do mês. Real só nos
      // meses realizados (PENDENTE ≠ ZERO: mês não medido → null, sem barra fabricada).
      previstoMes: emMilhoes(s.contratadoRs),
      realMes: s.tipo === "realizado" ? emMilhoes(s.projecaoRs) : null,
    };
  });

  const bmsRestantes = calc.serie.filter((s) => s.tipo === "forecast").length;
  // PENDENTE ≠ ZERO: sem contratado total não há % de saldo — null → "—" (não "0%" fabricado)
  const saldoFaturarPct =
    real.contratadoTotal && real.saldoFaturar != null
      ? Math.round((real.saldoFaturar / real.contratadoTotal) * 1000) / 10
      : null;

  // Deck "Período · BM corrente" (cards D12:G19) — TUDO derivado da curva (BMs executados). Não é
  // pendente: são projeções reais. Ritmo = média dos últimos 3 BMs reais (meses sem medição ignorados);
  // projeção término = Earned Schedule (bmCorrente + prazo − ES); Δ = projeção − prazo (meses do
  // baseline contratado). Alerta acende quando a projeção ultrapassa o prazo.
  const periodo = buildPeriodo(calc);

  const fat: FaturamentoBM = {
    contratadoTotalLabel: formatBRLAbbreviated(custoTotal),
    contratadoTotalNota: "Valor total do contrato",
    // PENDENTE ≠ ZERO: campo null → "—", não "R$ 0" fabricado (latente p/ obra sem curva normalizada)
    contratadoAcumuladoLabel:
      calc.contratadoAcum != null ? formatBRLAbbreviated(calc.contratadoAcum) : "—",
    contratadoAcumuladoNota: `Planejado até ${bmLabel}`,
    // Real acum. = o do CALC (recortado ao corte/override). Em default == real.realAcumulado.
    realAcumuladoLabel: formatBRLAbbreviated(calc.realizadoAcum),
    realAcumuladoNota: `${real.nBms} ${real.nBms === 1 ? "medição" : "medições"}`,
    desvioAcumuladoPct: calc.desvioAcumPct ?? null,
    desvioValorLabel: rotuloComSinal(calc.desvioAcumRs),
    // FAROL OFICIAL da C.3 = aderência acum. (régua 90/85/70). O Desvio Acum. vira magnitude (sem farol).
    aderenciaAcumuladoPct: calc.aderenciaAcum ?? null,
    aderenciaFarol: calc.farol ?? undefined,
    totalExecutadoPct: calc.avancoRealizadoPct ?? null,
    saldoFaturarLabel: real.saldoFaturar != null ? formatBRLAbbreviated(real.saldoFaturar) : "—",
    saldoFaturarPct,
    saldoFaturarBmsRestantes: bmsRestantes,
    periodo,
    curvaS,
    // análise da IA (lente 'analise_faturamento'), ancorada nos fatos. needs_review → sinaliza no texto.
    analiseTextual: analiseIA
      ? analiseIA.status === "needs_review"
        ? `⚠ (números a revisar) ${analiseIA.texto}`
        : analiseIA.texto
      : PENDENTE_IA,
    frentes: [],
    frentesObservacao:
      "Análise por frente pendente — requer a planilha comparativa por frente (ainda não normalizada).",
    chatQuote: "",
    chatSugestoes: [],
  };

  return { fat, bmLabel, mesCorte: corte };
}
