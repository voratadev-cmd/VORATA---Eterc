// Golden do Bridge §7.1 · Prazo. Prova o mapeamento PrazoCalc+cronograma → PrazoBM:
// calendário e físico real saem REAIS; tendência/prorrogação/marcos/Windows saem PENDENTES; o
// físico previsto incoerente NÃO vira Crítico (risco "Em reconciliação"). Cenário Sorriso.

import { test, expect } from "bun:test";
import { buildPrazoBm } from "./bridgePrazo";
import type { PrazoCalc } from "./calcPrazo";
import type { CronogramaPrevisto } from "@/lib/supabase/cronograma";

const CALC: PrazoCalc = {
  inicioISO: "2025-09-16",
  fimContratualISO: "2027-03-09",
  prazoContratualDias: 539,
  dataReferenciaISO: "2026-05-31",
  decorridoDias: 257,
  decorridoPct: 47.68,
  restantesDias: 282,
  mesCorte: { ano: 2026, mes: 5 },
  previstoFisicoPct: 82.5,
  realizadoFinanceiroPct: 24.96,
  previstoFinanceiroPct: 23.32,
  aderenciaFinanceiraPct: 107.05,
  atrasoFinanceiroPp: 1.64,
  farolFinanceiro: "conforme",
  fisicoRealizadoDisponivel: true,
  avancoFisicoRealPct: 24.99,
  fisicoRealMesPct: 15.99,
  atrasoFisicoPp: -57.51,
  previstoFisicoVsFinanceiroPp: 59.18,
  farolFisico: null,
  farolFisicoMotivo: "previsto físico (82.5%) incoerente com o financeiro (23.3%, Δ59pp)",
};

const m = (ano: number, mes: number, acum: number) => ({
  ano,
  mes,
  previstoPct: 0,
  previstoPctAcumulado: acum,
  previstoFinanceiroDeclarado: null,
});
const CRON: CronogramaPrevisto = {
  custoTotal: 39776000,
  inicioObra: "2025-09-16",
  terminoObra: "2027-03-09",
  status: "ok",
  nMeses: 3,
  somaPct: 1,
  meses: [m(2025, 10, 0.0414), m(2026, 5, 0.825), m(2026, 11, 1)],
};

test("bridge prazo · calendário/físico reais + tendência/marcos/Windows pendentes", () => {
  const out = buildPrazoBm(CALC, CRON, "mai/26");
  expect(out).not.toBeNull();
  if (!out) return;
  const { prazo } = out;

  // calendário — REAL
  expect(prazo.prazoContratualDias).toBe(539);
  expect(prazo.decorridoDias).toBe(257);
  expect(prazo.decorridoPct).toBe(47.68);
  expect(prazo.restantesDias).toBe(282);
  expect(prazo.totalDiasProjecao).toBe(539);

  // físico — real é âncora oficial; previsto com caveat; atraso informativo
  expect(prazo.avancoFisicoRealPct).toBe(25); // 24,99 → 25,0
  expect(prazo.avancoFisicoRealNota).toContain("oficial");
  expect(prazo.avancoFisicoPrevistoPct).toBe(82.5);
  expect(prazo.avancoFisicoPrevistoNota).toContain("reconciliação");
  expect(prazo.atrasoFisicoPp).toBe(-57.5);
  // físico incoerente → flag de reconciliação ligado (a aba suaviza previsto/atraso)
  expect(prazo.fisicoEmReconciliacao).toBe(true);
  // físico incoerente → risco NÃO vira Crítico, fica "Em reconciliação"
  expect(prazo.riscoNovoAtrasoLabel).toBe("Em reconciliação");
  expect(prazo.riscoNovoAtrasoFarol).toBeUndefined(); // físico real pendente → sem farol (régua)
  expect(prazo.riscoNovoAtrasoNota).toContain("incoerente");

  // tendência/prorrogação — PENDENTE (gap .mpp #2)
  expect(prazo.tendenciaNota).toContain("Pendente");
  expect(prazo.prorrogacaoDias).toBeNull();
  expect(prazo.prorrogacaoNota).toContain("pendente");

  // curva: contratado = cronograma (×100); real = âncora no corte (mai/26)
  expect(prazo.curva).toHaveLength(3);
  expect(prazo.curva.map((p) => p.contratado)).toEqual([4.1, 82.5, 100]);
  const corte = prazo.curva.find((p) => p.real != null);
  expect(corte?.contratado).toBe(82.5); // o corte é mai/26 (previsto 82,5%)
  expect(corte?.real).toBe(25); // real 24,99 → 25,0 no corte
  expect(prazo.curvaMarcadores.some((mk) => mk.label === "mai/26")).toBe(true);

  // marcos + Windows — PENDENTE
  expect(prazo.marcosCronograma).toEqual([]);
  expect(prazo.marcosResumo).toContain("pendentes");
  expect(prazo.windowsEventos).toEqual([]);
  expect(prazo.windowsObservacao).toContain("pendente");
});

test("bridge prazo · null sem calendário", () => {
  expect(buildPrazoBm(null, CRON, "—")).toBeNull();
  expect(buildPrazoBm({ ...CALC, prazoContratualDias: null }, CRON, "—")).toBeNull();
});

test("bridge prazo · marcos do cronograma-fonte (datas reais, passado×futuro, honesto)", () => {
  const tarefas = {
    marcos: [
      { numeroItem: "1.1.1.1.1.1", nome: "Ordem de Serviço", dataTerminoISO: "2025-09-16" },
      { numeroItem: "1.1.1.1.1.3", nome: "Fim da Obra", dataTerminoISO: "2026-10-31" },
    ],
    terminoPlanejadoISO: "2027-03-09",
    nTarefas: 424,
  };
  const r = buildPrazoBm(CALC, CRON, "mai/26", tarefas);
  expect(r).not.toBeNull();
  if (!r) return;
  const p = r.prazo;

  expect(p.marcosCronograma).toHaveLength(2);
  // passado (antes do corte mai/26) → PREVISTO + nota; futuro → FUTURO; tom neutro (sem cumprido falso)
  expect(p.marcosCronograma[0].titulo).toBe("Ordem de Serviço");
  expect(p.marcosCronograma[0].statusLabel).toBe("PREVISTO");
  expect(p.marcosCronograma[0].descricao).toContain("16/09/2025");
  expect(p.marcosCronograma[0].descricao).toContain("não rastreada");
  expect(p.marcosCronograma[1].statusLabel).toBe("FUTURO"); // 31/10/26 > corte 31/05/26
  expect(p.marcosCronograma.every((m) => m.statusFarol === "observacao")).toBe(true);
  // término planejado do cronograma-fonte + resumo conta marcos/tarefas
  expect(p.tendenciaTerminoISO).toBe("2027-03-09");
  expect(p.marcosResumo).toContain("2 marcos");
  expect(p.marcosResumo).toContain("424 tarefas");
});
