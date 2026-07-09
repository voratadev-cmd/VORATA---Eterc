// Adapter Prazo → RelatorioDados. Mapeia o read-model REAL da aba Prazo (C.5) para os DADOS do
// relatório — paridade total com a tela. A aba controla PRAZO FÍSICO (avanço de serviços, NÃO
// financeiro): o físico é DERIVADO do faturamento (contratadoAcum/realAcum ÷ contratadoTotal, só
// serviços), exatamente como a rota faz em derivarFisico(). Aqui replicamos a MESMA derivação,
// importando os MESMOS getters da rota — sem recalcular nada diferente, sem normalização nova.
//
// Indicadores = os 3 decks/headline da aba (avanço físico real × previsto, atraso pp, decorrido,
// marcos). Gráfico = a Curva física (Previsto × Real, % acum, só serviços). Detalhamento = a tabela
// "O que está atrasado — por disciplina" (% prev × real × Δpp). null = obra sem prazo normalizado.

import { getCronogramaPrevisto, getCronogramaTarefas } from "@/lib/supabase/cronograma";
import { getFaturamentoCurva, realizadoAcumDe } from "@/lib/supabase/faturamentoCurva";
import { getFaturamentoReal } from "@/lib/supabase/medicoes";
import { getSinteseTexto } from "@/lib/supabase/sinteses";
import { getObraById } from "@/lib/supabase/obras";
import { calcularFaturamento } from "@/lib/rma/calcFaturamento";
import { calcularPrazo } from "@/lib/rma/calcPrazo";
import { farolOverridesDe, mesclarRegras } from "@/lib/rma/farol";
import { buildPrazoBm } from "@/lib/rma/bridgePrazo";
import { getFaturamentoDisciplinaResumo } from "@/lib/supabase/faturamentoDisciplinaResumo";
import { getFaturamentoDisciplinaMes } from "@/lib/supabase/faturamentoDisciplinaMes";
import { getFaturamentoCruzamento } from "@/lib/supabase/faturamentoCruzamento";
import { getPrazoMarcos } from "@/lib/supabase/prazoMarcos";
import { corteMesParaISO, statusMarco } from "@/lib/rma/marcoFarol";
import { normTxt } from "@/lib/rma/colecao";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ── Formatadores (espelham a rota prazo.tsx) ────────────────────────────────────────────────────
const fmtPct = (v: number | null, d = 2) =>
  v != null
    ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`
    : "—";
const fmtPp = (v: number | null) =>
  v != null
    ? `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pp`
    : "—";

// ── Farol do desvio físico (pp) — régua REAL do mockup −1/−5/−15 (idêntica à rota) ───────────────
const FAROL_FISICO_PP = { observacao: -1, risco: -5, critico: -15 } as const;
function farolDesvioFisico(desvioPp: number | null): RelatorioFarol | null {
  if (desvioPp == null) return null;
  if (desvioPp >= FAROL_FISICO_PP.observacao) return "conforme";
  if (desvioPp >= FAROL_FISICO_PP.risco) return "observacao";
  if (desvioPp >= FAROL_FISICO_PP.critico) return "risco";
  return "critico";
}

function pctDiv(num: number | null | undefined, den: number | null | undefined): number | null {
  return den && den > 0 && num != null ? (num / den) * 100 : null;
}

/** DADOS reais da aba Prazo (C.5) p/ o relatório. null = obra sem cronograma/medições normalizados. */
export async function dadosPrazo(contractId: string): Promise<RelatorioDados | null> {
  // ── 1) PrazoBridge (calendário: decorrido/prazo/início/término) — mesmo pipeline do usePrazoBm ──
  const [cron, curva, real, tarefas, analiseIA, obra] = await Promise.all([
    getCronogramaPrevisto(contractId),
    getFaturamentoCurva(contractId),
    getFaturamentoReal(contractId),
    getCronogramaTarefas(contractId),
    getSinteseTexto(contractId, "analise_prazo", "analise"),
    getObraById(contractId),
  ]);
  const regras = mesclarRegras(farolOverridesDe(obra?.farol_regras));
  const fatCalc = calcularFaturamento(curva, {
    realizadoAcum: realizadoAcumDe(real, curva),
    regras,
  });
  const calc = calcularPrazo(cron, fatCalc, {
    fisicoRealizadoAcum: real.fisicoAcumulado ?? cron?.realAcum ?? null,
    fisicoRealizadoMes: real.fisicoMes,
    regras,
  });
  const corte = fatCalc?.mesCorte;
  const bmLabelMes = corte
    ? `${MESES[corte.mes - 1]}/${String(corte.ano % 100).padStart(2, "0")}`
    : "—";
  const bridge = buildPrazoBm(calc, cron, bmLabelMes, tarefas, analiseIA);
  if (!bridge) return null; // sem calendário → obra não normalizada (empty state honesto)
  const prazo = bridge.prazo;

  // ── 2) Físico DERIVADO do faturamento (mesma lógica de derivarFisico na rota) ───────────────────
  const [discFat, dmes, cruz, marcos] = await Promise.all([
    getFaturamentoDisciplinaResumo(contractId),
    getFaturamentoDisciplinaMes(contractId),
    getFaturamentoCruzamento(contractId),
    getPrazoMarcos(contractId),
  ]);

  // corte mes_num do cronograma = meses desde o início (1-based), igual à rota.
  let corteMesNum: number | null = null;
  if (prazo.inicioISO && corte) {
    const [iy, im] = prazo.inicioISO.split("-").map(Number);
    corteMesNum = (corte.ano - iy) * 12 + (corte.mes - im) + 1;
  }
  const corteDataISO = corte ? corteMesParaISO(corte.ano, corte.mes) : null;
  const bmLabel = corteMesNum ? `BM ${corteMesNum}` : "BM —";

  // Físico overall (apenas serviços) — Σ contratadoAcum/realAcum ÷ Σ contratadoTotal.
  let prevOverallPct: number | null = null;
  let realOverallPct: number | null = null;
  let atrasoPp: number | null = null;
  let porDisciplina: Array<{
    disciplina: string;
    prevPct: number | null;
    realPct: number | null;
    deltaPp: number | null;
    farol: RelatorioFarol | null;
  }> = [];
  const curvaFisica: Array<{ mesNum: number; prevPct: number; realPct: number | null }> = [];

  if (discFat) {
    const servicoDiscs = discFat.disciplinas.filter((d) => d.servico);
    const totalServ = servicoDiscs.reduce((a, d) => a + (d.contratadoTotal ?? 0), 0);
    const prevServ = servicoDiscs.reduce((a, d) => a + (d.contratadoAcum ?? 0), 0);
    const realServ = servicoDiscs.reduce((a, d) => a + (d.realAcum ?? 0), 0);
    prevOverallPct = pctDiv(prevServ, totalServ);
    realOverallPct = pctDiv(realServ, totalServ);
    atrasoPp =
      prevOverallPct != null && realOverallPct != null ? realOverallPct - prevOverallPct : null;

    porDisciplina = discFat.disciplinas.map((d) => {
      const prev = pctDiv(d.contratadoAcum, d.contratadoTotal);
      const realP = pctDiv(d.realAcum, d.contratadoTotal);
      const delta = prev != null && realP != null ? realP - prev : null;
      return {
        disciplina: d.disciplina,
        prevPct: prev,
        realPct: realP,
        deltaPp: delta,
        farol: farolDesvioFisico(delta),
      };
    });

    // Curva física acum/mês (só serviços), real congela no corte — idêntica à rota.
    const servNomes = new Set(servicoDiscs.map((d) => normTxt(d.disciplina)));
    if (dmes && totalServ > 0) {
      for (const mx of dmes.mesesAxis) {
        let acum = 0;
        for (const s of dmes.disciplinas) {
          if (!servNomes.has(normTxt(s.disciplina))) continue;
          const cel = s.celulas.find((c) => c.mesNum === mx.mesNum);
          if (cel) acum += cel.previstoAcumRs;
        }
        curvaFisica.push({
          mesNum: mx.mesNum,
          prevPct: (acum / totalServ) * 100,
          realPct: corteMesNum != null && mx.mesNum === corteMesNum ? realOverallPct : null,
        });
      }
    }
  }

  // cruz é lido para paridade do read-model (toggle Frente da rota), mas o detalhamento canônico do
  // relatório é "por disciplina" (a default da aba). Mantemos a leitura para não divergir do pipeline.
  void cruz;

  const farol: RelatorioFarol = farolDesvioFisico(atrasoPp) ?? "observacao";

  // ── 3) Indicadores (os decks/headline da aba) ──────────────────────────────────────────────────
  // Marcos: cumpridos / atrasados (status oficial via statusMarco) p/ o KPI de marcos.
  const nMarcos = marcos.length;
  const cumpridos = marcos.filter(
    (m) => statusMarco(m.dataLimite, corteDataISO, m.pctConcluido) === "cumprido",
  ).length;
  const atrasados = marcos.filter(
    (m) => statusMarco(m.dataLimite, corteDataISO, m.pctConcluido) === "atrasado",
  ).length;

  const indicadores = [
    {
      label: "Avanço físico real",
      valor: fmtPct(realOverallPct),
      hint: `real até o ${bmLabel} · só serviços`,
    },
    {
      label: "Avanço físico previsto",
      valor: fmtPct(prevOverallPct),
      hint: `planejado no corte (${bmLabelMes})`,
    },
    {
      label: "Atraso acumulado",
      valor: fmtPp(atrasoPp),
      hint: `farol ${farolLabelPt(farol)} · real − previsto`,
    },
    {
      label: "Prazo decorrido",
      valor: fmtPct(prazo.decorridoPct, 1),
      hint:
        nMarcos > 0
          ? `${nMarcos} marcos · ${cumpridos} cumpridos · ${atrasados} atrasados`
          : "do prazo contratual",
    },
    {
      label: "Prazo contratual",
      valor: `${prazo.prazoContratualDias.toLocaleString("pt-BR")} dias`,
      hint: "horizonte do contrato",
    },
    {
      label: "Dias restantes",
      valor: `${prazo.restantesDias.toLocaleString("pt-BR")} dias`,
      hint: `decorrido ${fmtPct(prazo.decorridoPct, 1)} do prazo`,
    },
  ];

  // ── 4) Gráfico — Curva física Previsto × Real (% acum, só serviços) ────────────────────────────
  const grafico =
    curvaFisica.length > 0
      ? {
          tipo: "curva" as const,
          unidade: "% acum",
          legenda:
            "Curva física — avanço previsto × real acumulado (% só serviços). Real congela no BM corrente.",
          serie: curvaFisica.map((p) => ({
            m: `M${p.mesNum}`,
            previsto: p.prevPct != null ? Math.round(p.prevPct * 100) / 100 : null,
            real: p.realPct != null ? Math.round(p.realPct * 100) / 100 : null,
          })),
        }
      : null;

  // ── 5) Detalhamento — "O que está atrasado, por disciplina" (Δpp crescente, igual à aba) ────────
  const linhasDisc = porDisciplina
    .filter((d) => d.prevPct != null || d.realPct != null)
    .sort((a, b) => (a.deltaPp ?? 0) - (b.deltaPp ?? 0));
  const detalhamento =
    linhasDisc.length > 0
      ? {
          titulo: "Avanço físico por disciplina (% de conclusão no grupo)",
          colunas: ["Disciplina", "% Previsto", "% Real", "Δ (pp)"],
          linhas: linhasDisc.map((d) => [
            d.disciplina,
            fmtPct(d.prevPct),
            fmtPct(d.realPct),
            fmtPp(d.deltaPp),
          ]),
          colDesvio: 3,
        }
      : null;

  // 2ª tabela — Marcos do cronograma (MarcoCronograma: titulo · statusLabel · descricao). O marco não
  // carrega data própria — a data prevista está embutida na `descricao` ("Previsto: dd/mm/aa …").
  const marcosCron = prazo.marcosCronograma;
  const tabelas: RelatorioDados["tabelas"] =
    marcosCron.length > 0
      ? [
          {
            titulo: "Marcos do cronograma",
            colunas: ["Marco", "Status", "Detalhe"],
            linhas: marcosCron.map((mk) => [mk.titulo, mk.statusLabel, mk.descricao]),
          },
        ]
      : undefined;

  return { titulo: "Prazo e Cronograma", farol, indicadores, grafico, detalhamento, tabelas };
}

// rótulo PT-BR do farol p/ o hint (1:1 com os 4 níveis fixos do Sistema de Farol).
function farolLabelPt(f: RelatorioFarol): string {
  const m: Record<RelatorioFarol, string> = {
    conforme: "Conforme",
    observacao: "Observação",
    risco: "Risco",
    critico: "Crítico",
  };
  return m[f];
}
