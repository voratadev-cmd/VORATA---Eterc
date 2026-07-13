// Golden do Bridge §7.1 · Faturamento. Prova o mapeamento FaturamentoCalc+FaturamentoReal →
// FaturamentoBM: KPIs/Curva S/saldo/histórico saem REAIS; análise/frentes/chat saem PENDENTES.
// Cenário hand-verificável (custoTotal 100 mi, corte fev/26, realizado 38 mi).

import { test, expect } from "bun:test";
import { buildFaturamentoBm } from "./bridgeFaturamento";
import type { FaturamentoCalc, FaturamentoMesCalc } from "./calcFaturamento";
import type { FaturamentoReal } from "@/lib/supabase/medicoes";

const MI = 1e6;

const CALC: FaturamentoCalc = {
  custoTotal: 100 * MI,
  mesCorte: { ano: 2026, mes: 2 },
  contratadoAcum: 40 * MI,
  realizadoAcum: 38 * MI,
  desvioAcumRs: -2 * MI,
  desvioAcumPct: -5,
  aderenciaAcum: 95,
  farol: "observacao",
  avancoContratadoPct: 40,
  avancoRealizadoPct: 38,
  serie: [
    {
      ano: 2026,
      mes: 1,
      tipo: "realizado",
      contratadoRs: 20 * MI,
      contratadoAcum: 20 * MI,
      projecaoRs: 18 * MI,
      projecaoAcum: 18 * MI,
      desvioAcumRs: -2 * MI,
      desvioAcumPct: -10,
      aderenciaAcum: 90,
    },
    {
      ano: 2026,
      mes: 2,
      tipo: "realizado",
      contratadoRs: 20 * MI,
      contratadoAcum: 40 * MI,
      projecaoRs: 20 * MI,
      projecaoAcum: 38 * MI,
      desvioAcumRs: -2 * MI,
      desvioAcumPct: -5,
      aderenciaAcum: 95,
    },
    {
      ano: 2026,
      mes: 3,
      tipo: "forecast",
      contratadoRs: 20 * MI,
      contratadoAcum: 60 * MI,
      projecaoRs: 22 * MI,
      projecaoAcum: 60 * MI,
      desvioAcumRs: 0,
      desvioAcumPct: 0,
      aderenciaAcum: 100,
    },
    {
      ano: 2026,
      mes: 4,
      tipo: "forecast",
      contratadoRs: 20 * MI,
      contratadoAcum: 80 * MI,
      projecaoRs: 20 * MI,
      projecaoAcum: 80 * MI,
      desvioAcumRs: 0,
      desvioAcumPct: 0,
      aderenciaAcum: 100,
    },
    {
      // cauda: baseline contratado terminou (null) — contratado deve PLATÔAR em 80, não cair a 0
      ano: 2026,
      mes: 5,
      tipo: "forecast",
      contratadoRs: null,
      contratadoAcum: null,
      projecaoRs: 20 * MI,
      projecaoAcum: 100 * MI,
      desvioAcumRs: 0,
      desvioAcumPct: 0,
      aderenciaAcum: 100,
    },
  ],
};

const REAL: FaturamentoReal = {
  curva: [
    { bm: 1, medidoMes: 18 * MI, acumulado: 18 * MI },
    { bm: 2, medidoMes: 20 * MI, acumulado: 38 * MI },
  ],
  contratadoTotal: 100 * MI,
  realAcumulado: 38 * MI,
  pctFaturado: 0.38,
  saldoFaturar: 62 * MI,
  fisicoMes: null,
  fisicoAcumulado: null,
  nBms: 2,
};

test("bridge faturamento · calc+real → FaturamentoBM (KPIs/curva reais, IA pendente)", () => {
  const out = buildFaturamentoBm(CALC, REAL);
  expect(out).not.toBeNull();
  if (!out) return;
  const { fat, bmLabel } = out;

  expect(bmLabel).toBe("fev/26");

  // 5 KPIs reais
  expect(fat.contratadoTotalLabel).toBe("R$ 100 mi");
  expect(fat.contratadoAcumuladoLabel).toBe("R$ 40 mi");
  expect(fat.realAcumuladoLabel).toBe("R$ 38 mi");
  expect(fat.realAcumuladoNota).toBe("2 medições");
  expect(fat.desvioAcumuladoPct).toBe(-5);
  expect(fat.desvioValorLabel).toBe("−R$ 2,0 mi"); // sinal − unicode + abreviado
  // FAROL OFICIAL da C.3 = ADERÊNCIA acum. (mapeado de calc.farol). O Desvio Acum. vira MAGNITUDE (sem farol).
  expect(fat.desvioFarol).toBeUndefined();
  expect(fat.aderenciaFarol).toBe("observacao");
  expect(fat.aderenciaAcumuladoPct).toBe(95);
  expect(fat.totalExecutadoPct).toBe(38); // real acum 38 mi ÷ contratado total 100 mi
  expect(fat.saldoFaturarLabel).toBe("R$ 62,00 mi");
  expect(fat.saldoFaturarPct).toBe(62);
  expect(fat.saldoFaturarBmsRestantes).toBe(3); // 3 meses forecast (mar, abr, mai)

  // Curva S: 5 pontos; real até o corte (fev), projeção do corte (fev) em diante
  expect(fat.curvaS.map((p) => p.bm)).toEqual(["jan/26", "fev/26", "mar/26", "abr/26", "mai/26"]);
  // contratado cumulativo; mai/26 com acumulado null PLATÔA em 80 (carry-forward, não cai a 0)
  expect(fat.curvaS.map((p) => p.contratado)).toEqual([20, 40, 60, 80, 80]);
  expect(fat.curvaS[0].real).toBe(18);
  expect(fat.curvaS[0].projecao).toBeNull();
  expect(fat.curvaS[1].real).toBe(38); // corte
  expect(fat.curvaS[1].projecao).toBe(38); // corte entra na projeção (conecta a tracejada)
  expect(fat.curvaS[2].real).toBeNull();
  expect(fat.curvaS[2].projecao).toBe(60);
  expect(fat.curvaS[4].real).toBeNull(); // forecast → sem real
  expect(fat.curvaS[4].projecao).toBe(100); // projeção segue mesmo sem contratado

  // Barras mensais (não acumuladas): Previsto Todo do mês + Real do mês (só nos realizados).
  expect(fat.curvaS.map((p) => p.previstoMes)).toEqual([20, 20, 20, 20, null]); // mai/26 contratado null
  expect(fat.curvaS.map((p) => p.realMes)).toEqual([18, 20, null, null, null]); // real só até o corte (fev)

  // PENDENTES honestos — não inventa
  expect(fat.analiseTextual).toContain("Pendente");
  expect(fat.frentes).toEqual([]);
  expect(fat.frentesObservacao).toContain("pendente");
});

test("bridge faturamento · null quando não há corte/realizado", () => {
  expect(buildFaturamentoBm(null, REAL)).toBeNull();
  expect(buildFaturamentoBm({ ...CALC, mesCorte: null }, REAL)).toBeNull();
  expect(buildFaturamentoBm({ ...CALC, realizadoAcum: null }, REAL)).toBeNull();
});

// Deck de projeção (ritmo · projeção término · Δ) — hand-verificável sobre o mesmo CALC.
// corte = fev/26 (último realizado). Trava os números (auditável: "erro = milhões").
test("bridge faturamento · deck projeção (ritmo/projeção/Δ/alerta)", () => {
  const out = buildFaturamentoBm(CALC, REAL);
  expect(out?.fat.periodo).not.toBeNull();
  const p = out!.fat.periodo!;

  // Ritmo = realizado-acum (38) ÷ meses decorridos (2) = 19 (2 casas em mi · auditável).
  expect(p.ritmo3BmLabel).toBe("R$ 19,00 mi");

  // Projeção = prazo ÷ aderência acumulada (fórmula do workbook C.3): aderência = realizado-acum
  // (38) ÷ contratado-acum no corte (40) = 0,95 → projeção = 4 ÷ 0,95 = 4,21 → 4,2 (1 casa).
  expect(p.projecaoTerminoMeses).toBe(4.2);
  // Δ = projeção(4,2) − prazo(4) = 0,2. Prazo = meses com contratadoRs != null = 4 (mai/26 é cauda null
  // e NÃO conta). deltaRound 0,2 > 0 → o alerta de prorrogação ainda acende.
  expect(p.deltaProjecaoMeses).toBe(0.2);
  // Mês-calendário do término projetado: mês #floor(4,2) = 4 contando de jan/26 → abr/26.
  expect(p.projecaoTerminoMesLabel).toBe("abr/26");
  // Alerta acende sobre o Δ ARREDONDADO e sem emoji (a UI desenha o ícone).
  expect(p.alertaProrrogacao).toBe("Projeção ultrapassa o prazo contratual");
  // Período do mês de corte (fev/26): faturado (real 20 mi) × previsto (20 mi) → aderência 100%.
  expect(p.bmCorrente).toBe(2);
  expect(p.faturadoMesLabel).toBe("R$ 20,00 mi");
  expect(p.previstoMesLabel).toBe("R$ 20,00 mi");
  expect(p.aderenciaPeriodoPct).toBe(100);
  // O farol oficial da C.3 NÃO vive no deck — vive em fat.aderenciaFarol.
  expect(p).not.toHaveProperty("farol");
});

// Ritmo = realizado-acum ÷ meses DECORRIDOS (spec C.3): mês sem medição e mês ocioso CONTAM
// igualmente — ambos são tempo de contrato consumido (10,2mi ÷ 9 meses na SBSO, não ÷ 4 BMs).
function mesCalc(
  ano: number,
  mes: number,
  contratadoRs: number,
  projecaoRs: number | null,
): FaturamentoMesCalc {
  return {
    ano,
    mes,
    tipo: "realizado",
    contratadoRs,
    contratadoAcum: null,
    projecaoRs,
    projecaoAcum: null,
    desvioAcumRs: null,
    desvioAcumPct: null,
    aderenciaAcum: null,
  };
}

const MI3_REAL: FaturamentoReal = {
  curva: [
    { bm: 1, medidoMes: 10 * MI, acumulado: 10 * MI },
    { bm: 2, medidoMes: 0, acumulado: 10 * MI },
    { bm: 3, medidoMes: 30 * MI, acumulado: 40 * MI },
  ],
  contratadoTotal: 100 * MI,
  realAcumulado: 40 * MI,
  pctFaturado: 0.4,
  saldoFaturar: 60 * MI,
  fisicoMes: null,
  fisicoAcumulado: null,
  nBms: 3,
};

function calc3(mid: number | null): FaturamentoCalc {
  return {
    custoTotal: 100 * MI,
    mesCorte: { ano: 2026, mes: 3 },
    contratadoAcum: 30 * MI,
    realizadoAcum: 40 * MI,
    desvioAcumRs: null,
    desvioAcumPct: null,
    aderenciaAcum: null,
    farol: null,
    avancoContratadoPct: null,
    avancoRealizadoPct: null,
    serie: [
      mesCalc(2026, 1, 10 * MI, 10 * MI),
      mesCalc(2026, 2, 10 * MI, mid), // null = não medido · 0 = ocioso genuíno
      mesCalc(2026, 3, 10 * MI, 30 * MI),
    ],
  };
}

test("bridge faturamento · ritmo conta meses decorridos (sem medição e ocioso idem)", () => {
  // realizado-acum 40 ÷ 3 meses decorridos = 13,33 — mês sem medição CONTA (tempo consumido)…
  const semMedicao = buildFaturamentoBm(calc3(null), MI3_REAL);
  expect(semMedicao?.fat.periodo?.ritmo3BmLabel).toBe("R$ 13,33 mi");

  // …e mês genuinamente ocioso (real = 0) idem: mesma base de meses decorridos.
  const ocioso = buildFaturamentoBm(calc3(0), MI3_REAL);
  expect(ocioso?.fat.periodo?.ritmo3BmLabel).toBe("R$ 13,33 mi");
});
