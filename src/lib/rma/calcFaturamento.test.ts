// Golden da Camada B · Faturamento. Fixture = curva REAL da Sorriso (obra_faturamento_meses,
// 22 meses) + realizado autoritativo da cadeia de BMs (9.927.488,02). Trava os valores: se o
// cálculo derivar errado, milhões saem errados na tela. Roda com `bun test`.

import { test, expect } from "bun:test";
import { calcularFaturamento } from "./calcFaturamento";
import type { FaturamentoCurva } from "@/lib/supabase/faturamentoCurva";

// Curva real da Sorriso (exata, em R$). Projeção = realizado-lumpado até o corte + forecast.
const SORRISO: FaturamentoCurva = {
  custoTotal: 39775999.98,
  status: "ok",
  nMeses: 22,
  meses: [
    {
      ano: 2025,
      mes: 9,
      contratadoRs: 0,
      contratadoRsAcum: 0,
      projecaoRs: null,
      projecaoRsAcum: null,
      tipoProjecao: null,
    },
    {
      ano: 2025,
      mes: 10,
      contratadoRs: 722164.23,
      contratadoRsAcum: 722164.23,
      projecaoRs: 1648346.88,
      projecaoRsAcum: 1648346.88,
      tipoProjecao: null,
    },
    {
      ano: 2025,
      mes: 11,
      contratadoRs: 0,
      contratadoRsAcum: 722164.23,
      projecaoRs: 0,
      projecaoRsAcum: 1648346.88,
      tipoProjecao: null,
    },
    {
      ano: 2025,
      mes: 12,
      contratadoRs: 0,
      contratadoRsAcum: 722164.23,
      projecaoRs: 0,
      projecaoRsAcum: 1648346.88,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 1,
      contratadoRs: 0,
      contratadoRsAcum: 722164.23,
      projecaoRs: 0,
      projecaoRsAcum: 1648346.88,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 2,
      contratadoRs: 0,
      contratadoRsAcum: 722164.23,
      projecaoRs: 0,
      projecaoRsAcum: 1648346.88,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 3,
      contratadoRs: 1562792.04,
      contratadoRsAcum: 2284956.27,
      projecaoRs: 1925589.14,
      projecaoRsAcum: 3573936.02,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 4,
      contratadoRs: 3750286.58,
      contratadoRsAcum: 6035242.85,
      projecaoRs: 0,
      projecaoRsAcum: 3573936.02,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 5,
      contratadoRs: 3238833.63,
      contratadoRsAcum: 9274076.48,
      projecaoRs: 6353552,
      projecaoRsAcum: 9927488.02,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 6,
      contratadoRs: 6318890.36,
      contratadoRsAcum: 15592966.84,
      projecaoRs: 5840906.53,
      projecaoRsAcum: 15768394.55,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 7,
      contratadoRs: 6688396.27,
      contratadoRsAcum: 22281363.11,
      projecaoRs: 9831318.97,
      projecaoRsAcum: 25599713.52,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 8,
      contratadoRs: 7197448.44,
      contratadoRsAcum: 29478811.55,
      projecaoRs: 4768325.26,
      projecaoRsAcum: 30368038.78,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 9,
      contratadoRs: 3254556.3,
      contratadoRsAcum: 32733367.85,
      projecaoRs: 3099619.42,
      projecaoRsAcum: 33467658.2,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 10,
      contratadoRs: 1919316.33,
      contratadoRsAcum: 34652684.18,
      projecaoRs: 1746146.03,
      projecaoRsAcum: 35213804.23,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 11,
      contratadoRs: 2923052.38,
      contratadoRsAcum: 37575736.56,
      projecaoRs: 2822560.62,
      projecaoRsAcum: 38036364.85,
      tipoProjecao: null,
    },
    {
      ano: 2026,
      mes: 12,
      contratadoRs: 798490.95,
      contratadoRsAcum: 38374227.51,
      projecaoRs: 512770.42,
      projecaoRsAcum: 38549135.27,
      tipoProjecao: null,
    },
    {
      ano: 2027,
      mes: 1,
      contratadoRs: 1049416.4,
      contratadoRsAcum: 39423643.91,
      projecaoRs: 924308.32,
      projecaoRsAcum: 39473443.59,
      tipoProjecao: null,
    },
    {
      ano: 2027,
      mes: 2,
      contratadoRs: 324256.36,
      contratadoRsAcum: 39747900.27,
      projecaoRs: 274456.66,
      projecaoRsAcum: 39747900.25,
      tipoProjecao: null,
    },
    {
      ano: 2027,
      mes: 3,
      contratadoRs: 28099.73,
      contratadoRsAcum: 39776000,
      projecaoRs: 28099.73,
      projecaoRsAcum: 39775999.98,
      tipoProjecao: null,
    },
    {
      ano: 2027,
      mes: 4,
      contratadoRs: 0,
      contratadoRsAcum: 39776000,
      projecaoRs: 0,
      projecaoRsAcum: 39775999.98,
      tipoProjecao: null,
    },
    {
      ano: 2027,
      mes: 5,
      contratadoRs: null,
      contratadoRsAcum: null,
      projecaoRs: 0,
      projecaoRsAcum: 39775999.98,
      tipoProjecao: null,
    },
    {
      ano: 2027,
      mes: 6,
      contratadoRs: null,
      contratadoRsAcum: null,
      projecaoRs: 0,
      projecaoRsAcum: 39775999.98,
      tipoProjecao: null,
    },
  ],
};

const REALIZADO_BM = 9927488.02; // Σ cadeia de BMs (autoritativo, dos PDFs)

test("Sorriso · corte=mai/2026, realizado adiante do plano → Conforme", () => {
  const r = calcularFaturamento(SORRISO, { realizadoAcum: REALIZADO_BM });
  expect(r).not.toBeNull();
  if (!r) return;

  // data de corte = mês cujo projecao_acum casa com o realizado dos BMs
  expect(r.mesCorte).toEqual({ ano: 2026, mes: 5 });
  expect(r.contratadoAcum).toBeCloseTo(9274076.48, 2);
  expect(r.realizadoAcum).toBeCloseTo(9927488.02, 2);

  // desvio = realizado − planejado = +653.411,54 (+7,05%)
  expect(r.desvioAcumRs).toBeCloseTo(653411.54, 2);
  expect(r.desvioAcumPct).toBeCloseTo(7.0456, 3);

  // aderência = realizado/planejado = 107,05% (desvio +7,05% ≥ -1) → Conforme (régua oficial)
  expect(r.aderenciaAcum).toBeCloseTo(107.0456, 3);
  expect(r.farol).toBe("conforme");

  // avanço financeiro vs custo total (39.776.000)
  expect(r.avancoContratadoPct).toBeCloseTo(23.3158, 3);
  expect(r.avancoRealizadoPct).toBeCloseTo(24.9585, 3);

  // série: 22 meses, realizado até o corte (idx 8), forecast depois
  expect(r.serie).toHaveLength(22);
  expect(r.serie[8].tipo).toBe("realizado");
  expect(r.serie[9].tipo).toBe("forecast");
  expect(r.serie[21].tipo).toBe("forecast");
});

test("Sem realizado conhecido (sem BMs, sem tipo_projecao) → sem foto atual", () => {
  const r = calcularFaturamento(SORRISO, {});
  expect(r).not.toBeNull();
  if (!r) return;
  expect(r.mesCorte).toBeNull();
  expect(r.realizadoAcum).toBeNull();
  expect(r.aderenciaAcum).toBeNull();
  expect(r.farol).toBeNull();
});

test("Farol OFICIAL da C.3: ADERÊNCIA acum. de faturamento (real÷previsto · régua 90/85/70)", () => {
  // mini-curva de 1 mês: contratado 100, realizado = X → aderência = X%
  const mk = (realizado: number): FaturamentoCurva => ({
    custoTotal: 100,
    status: "ok",
    nMeses: 1,
    meses: [
      {
        ano: 2026,
        mes: 1,
        contratadoRs: 100,
        contratadoRsAcum: 100,
        projecaoRs: realizado,
        projecaoRsAcum: realizado,
        tipoProjecao: "realizado",
      },
    ],
  });
  // aderência = realizado ÷ contratado: ≥90 → Conforme · ≥85 → Obs · ≥70 → Risco · <70 → Crítico.
  expect(calcularFaturamento(mk(105), { realizadoAcum: 105 })?.farol).toBe("conforme"); // 105%
  expect(calcularFaturamento(mk(92), { realizadoAcum: 92 })?.farol).toBe("conforme"); // 92%
  expect(calcularFaturamento(mk(88), { realizadoAcum: 88 })?.farol).toBe("observacao"); // 88%
  expect(calcularFaturamento(mk(78), { realizadoAcum: 78 })?.farol).toBe("risco"); // 78%
  expect(calcularFaturamento(mk(60), { realizadoAcum: 60 })?.farol).toBe("critico"); // 60%
});

test("Curva ausente → null", () => {
  expect(calcularFaturamento(null)).toBeNull();
});
