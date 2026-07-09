// Bridge §7.1 · Prazo — materializa o PrazoBM (forma da aba) do PrazoCalc + cronograma + medições.
// REAIS: calendário (prazo/decorrido/restante), Donut, e o físico REAL (24,99% oficial, §4.1) como
// âncora, com o previsto físico do cronograma e o atraso. PENDENTES honestos: tendência/prorrogação
// (gap .mpp #2), risco de novo atraso (farol físico em reconciliação §4.1), marcos e Windows (gap #7).
// NUNCA inventa: o que não temos vira "Pendente" com o motivo.

import type { CronogramaPrevisto, CronogramaTarefas } from "@/lib/supabase/cronograma";
import type { SinteseTexto } from "@/lib/supabase/sinteses";
import type { PrazoBM } from "@/lib/mocks/obras";
import type { PrazoCalc } from "./calcPrazo";

const DIA_MS = 86_400_000;

/** ISO 'YYYY-MM-DD' → 'dd/mm/aaaa' (label de marco). */
function fmtDataBR(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function parseISO(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function diffDias(aISO: string | null, bISO: string | null): number | null {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  return a != null && b != null ? Math.round((b - a) / DIA_MS) : null;
}
function fimDoMesISO(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

export type PrazoBridge = { prazo: PrazoBM; bmLabel: string; analiseIA: SinteseTexto | null };

/**
 * Monta o PrazoBM real. null se não há calendário (sem cronograma/faturamento normalizados).
 * O físico real é a âncora oficial; o previsto físico e o atraso vêm com caveat de reconciliação.
 */
export function buildPrazoBm(
  calc: PrazoCalc | null,
  cron: CronogramaPrevisto | null,
  bmLabel: string,
  tarefas: CronogramaTarefas | null = null,
  analiseIA: SinteseTexto | null = null,
): PrazoBridge | null {
  if (!calc || calc.prazoContratualDias == null || calc.decorridoDias == null) return null;

  const prazoContratualDias = calc.prazoContratualDias;
  const inicioISO = calc.inicioISO ?? "";
  const fimContratualISO = calc.fimContratualISO ?? "";
  const decorridoDias = calc.decorridoDias;
  const restantesDias = calc.restantesDias ?? prazoContratualDias - decorridoDias;

  // físico: real = âncora oficial (§4.1); previsto = cronograma R0 (em reconciliação)
  // PENDENTE ≠ ZERO: quando o físico real não foi medido (workbook · real_pct vazio · pré-execução),
  // calc.avancoFisicoRealPct é null. NÃO coagir para 0 (isso vira "0,0% executado" + ponto vermelho
  // fabricado na curva — engana). Marca pendente e a aba mostra "—/pendente".
  const fisicoRealPendente = calc.avancoFisicoRealPct == null;
  const avancoFisicoRealPct = calc.avancoFisicoRealPct ?? 0;
  const avancoFisicoPrevistoPct = calc.previstoFisicoPct ?? 0;
  const atrasoFisicoPp = calc.atrasoFisicoPp ?? 0;
  // o risco de novo atraso depende do farol físico — pendente enquanto o previsto não reconciliar
  const fisicoPendente = calc.farolFisico == null;
  const riscoNota = calc.farolFisicoMotivo ?? "aderência física pendente";

  // Curva de avanço físico: contratado = S-curve do cronograma (por dia); real = âncora no corte.
  const curva = (cron?.meses ?? [])
    .map((m, i) => {
      const dia = diffDias(inicioISO || cron?.inicioObra || null, fimDoMesISO(m.ano, m.mes));
      if (dia == null) return null;
      const ehCorte =
        calc.mesCorte != null && m.ano === calc.mesCorte.ano && m.mes === calc.mesCorte.mes;
      return {
        // ordinal 1-based do mês na curva (== mes_num da matriz física por frente) — o front junta a
        // frente por mesNum, NÃO por índice posicional (robusto ao filtro de meses sem `dia`).
        mesNum: i + 1,
        dia: Math.max(0, dia),
        contratado: Math.round(m.previstoPctAcumulado * 1000) / 10,
        // só plota o ponto Real se o físico real foi MEDIDO; pendente → null (sem dot 0% fabricado)
        real: ehCorte && !fisicoRealPendente ? Math.round(avancoFisicoRealPct * 10) / 10 : null,
        projecao: null as number | null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  const corteDia = diffDias(inicioISO || null, calc.dataReferenciaISO);
  const curvaMarcadores: PrazoBM["curvaMarcadores"] = [];
  if (corteDia != null) curvaMarcadores.push({ dia: corteDia, label: bmLabel, cor: "brand" });
  curvaMarcadores.push({ dia: prazoContratualDias, label: "prazo contratual", cor: "neutro" });

  // ── Marcos contratuais (do cronograma-fonte MS Project, obra_cronograma_tarefas) ──
  // Datas REAIS de cada marco. Honesto: NÃO afirmamos cumprido/atrasado (falta físico por marco) —
  // marcamos só passado×futuro pela data de corte, tom neutro.
  const corteISO = calc.dataReferenciaISO;
  const marcosCronograma: PrazoBM["marcosCronograma"] = (tarefas?.marcos ?? []).map((mk) => {
    const futuro = corteISO != null && mk.dataTerminoISO != null && mk.dataTerminoISO > corteISO;
    return {
      id: mk.numeroItem,
      titulo: mk.nome,
      descricao: `Previsto: ${fmtDataBR(mk.dataTerminoISO)}${futuro ? "" : " · execução por marco não rastreada"}`,
      statusLabel: futuro ? "FUTURO" : "PREVISTO",
      statusFarol: "observacao" as const,
    };
  });
  // término PLANEJADO = maior data do cronograma (real); a projeção por RITMO segue pendente (§4.1)
  const terminoPlanejadoISO = tarefas?.terminoPlanejadoISO ?? fimContratualISO;

  const prazo: PrazoBM = {
    // calendário — REAL
    prazoContratualDias,
    inicioISO,
    fimContratualISO,
    decorridoDias,
    decorridoPct: calc.decorridoPct ?? 0,
    restantesDias,
    // término PLANEJADO do cronograma (real); projeção por ritmo (forecast) ainda pendente (§4.1)
    tendenciaTerminoISO: terminoPlanejadoISO,
    // forecast por ritmo pendente → sem farol (undefined), não "observacao" azul fabricado
    tendenciaFarol: undefined,
    tendenciaNota: tarefas
      ? `Término planejado do cronograma · projeção por ritmo pendente (§4.1)`
      : "Pendente — tendência precisa do .mpp R0/R1 (export XML · §6 gap #2)",
    // PENDENTE ≠ ZERO: forecast por ritmo não calculado → pendente:true → UI mostra "— pendente",
    // nunca "0 dias" (0 afirma "zero prorrogação medida" sobre projeção que não existe).
    prorrogacaoDias: null,
    prorrogacaoPendente: true,
    // prorrogação pendente → sem farol; quando houver, classificarPorRegra('prazo_prorrogacao', %)
    prorrogacaoFarol: undefined,
    prorrogacaoNota: "Projeção por ritmo pendente (depende do baseline reconciliado · §4.1)",
    // físico — REAL (âncora) + previsto com caveat de reconciliação
    avancoFisicoRealPct: Math.round(avancoFisicoRealPct * 10) / 10,
    fisicoRealPendente,
    avancoFisicoRealNota: fisicoRealPendente
      ? "físico real não medido — pendente (§4.1)"
      : `${bmLabel} · oficial (§4.1)`,
    avancoFisicoPrevistoPct: Math.round(avancoFisicoPrevistoPct * 10) / 10,
    avancoFisicoPrevistoNota: "cronograma R0 · em reconciliação (§4.1/§3)",
    atrasoFisicoPp: Math.round(atrasoFisicoPp * 10) / 10,
    fisicoEmReconciliacao: fisicoPendente,
    fisicoEmReconciliacaoNota: calc.farolFisicoMotivo ?? undefined,
    riscoNovoAtrasoLabel: fisicoPendente ? "Em reconciliação" : "Avaliado",
    // usa o farol da RÉGUA (atraso físico) já computado; null (físico real pendente) → sem farol
    riscoNovoAtrasoFarol: calc.farolFisico ?? undefined,
    riscoNovoAtrasoNota: riscoNota,
    totalDiasProjecao: decorridoDias + restantesDias,
    // curva — contratado real (cronograma) + âncora real no corte; projeção pendente
    curva,
    curvaMarcadores,
    // marcos — REAIS do cronograma-fonte (datas planejadas; execução por marco ainda não rastreada)
    marcosCronograma,
    marcosResumo: tarefas
      ? `${marcosCronograma.length} marcos do cronograma-fonte (${tarefas.nTarefas} tarefas)`
      : "Marcos contratuais pendentes — dependem do .mpp (§6 gap #2)",
    // Windows Analysis — PENDENTE (matriz Eventos×Resp×Impacto, §7 gap #7). windowsTotalDias=null
    // (não 0) → o header não crava "+0 dias" em vermelho sobre área nunca normalizada.
    windowsEventos: [],
    windowsTotalDias: null,
    windowsObservacao:
      "Windows Analysis pendente — depende da matriz de eventos datados (RS + Atas + CEs · §7 gap #7)",
    chatQuote: "",
  };

  return { prazo, bmLabel, analiseIA };
}
