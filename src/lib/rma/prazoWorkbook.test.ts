// Caminho WORKBOOK-MOTOR do Prazo: cronograma com PREVISTO físico (curva normalizada) e físico REAL
// PENDENTE (input vazio · real_pct null) → a aba renderiza o previsto + farol físico pendente
// (honesto), sem ficar vazia. Espelha o fix do Faturamento. bun test.

import { test, expect } from "bun:test";

import type { CronogramaPrevisto } from "@/lib/supabase/cronograma";
import type { FaturamentoCurva } from "@/lib/supabase/faturamentoCurva";
import { buildPrazoBm } from "./bridgePrazo";
import { calcularFaturamento } from "./calcFaturamento";
import { calcularPrazo } from "./calcPrazo";

// cronograma previsto fechando 100% · físico REAL pendente (realPct null em tudo → realAcum null)
const cron: CronogramaPrevisto = {
  custoTotal: 1000,
  inicioObra: "2026-01-01",
  terminoObra: "2026-04-30",
  status: "ok",
  nMeses: 4,
  somaPct: 1.0,
  realAcum: null,
  meses: [
    {
      ano: 2026,
      mes: 1,
      previstoPct: 0.2,
      previstoPctAcumulado: 0.2,
      previstoFinanceiroDeclarado: null,
      realPct: null,
      realPctAcumulado: null,
    },
    {
      ano: 2026,
      mes: 2,
      previstoPct: 0.3,
      previstoPctAcumulado: 0.5,
      previstoFinanceiroDeclarado: null,
      realPct: null,
      realPctAcumulado: null,
    },
    {
      ano: 2026,
      mes: 3,
      previstoPct: 0.3,
      previstoPctAcumulado: 0.8,
      previstoFinanceiroDeclarado: null,
      realPct: null,
      realPctAcumulado: null,
    },
    {
      ano: 2026,
      mes: 4,
      previstoPct: 0.2,
      previstoPctAcumulado: 1.0,
      previstoFinanceiroDeclarado: null,
      realPct: null,
      realPctAcumulado: null,
    },
  ],
};

// curva de faturamento estilo workbook (Real direto) só pra resolver o corte/bmLabel
const curva: FaturamentoCurva = {
  custoTotal: 1000,
  status: "ok",
  nMeses: 4,
  realAcum: 300,
  meses: [
    {
      ano: 2026,
      mes: 1,
      contratadoRs: 200,
      contratadoRsAcum: 200,
      projecaoRs: null,
      projecaoRsAcum: null,
      tipoProjecao: null,
      realRs: 150,
      realRsAcum: 150,
    },
    {
      ano: 2026,
      mes: 2,
      contratadoRs: 200,
      contratadoRsAcum: 400,
      projecaoRs: null,
      projecaoRsAcum: null,
      tipoProjecao: null,
      realRs: 150,
      realRsAcum: 300,
    },
    {
      ano: 2026,
      mes: 3,
      contratadoRs: 300,
      contratadoRsAcum: 700,
      projecaoRs: null,
      projecaoRsAcum: null,
      tipoProjecao: null,
      realRs: null,
      realRsAcum: 300,
    },
    {
      ano: 2026,
      mes: 4,
      contratadoRs: 300,
      contratadoRsAcum: 1000,
      projecaoRs: null,
      projecaoRsAcum: null,
      tipoProjecao: null,
      realRs: null,
      realRsAcum: 300,
    },
  ],
};

test("workbook: Prazo renderiza o previsto físico com físico real PENDENTE (honesto)", () => {
  const fat = calcularFaturamento(curva, { realizadoAcum: curva.realAcum });
  // físico real por precedência: medições null → cron.realAcum (null aqui = pendente)
  const calc = calcularPrazo(cron, fat, { fisicoRealizadoAcum: cron.realAcum ?? null });
  expect(calc).not.toBeNull();
  expect(calc.fisicoRealizadoDisponivel).toBe(false); // real pendente → farol físico não verde
  const bridge = buildPrazoBm(calc, cron, "fev/26", null, null);
  expect(bridge).not.toBeNull(); // aba NÃO fica vazia — mostra o previsto
});

test("workbook futuro: se o físico real vier preenchido (cron.realAcum), o farol acende", () => {
  const cronComReal: CronogramaPrevisto = {
    ...cron,
    realAcum: 0.45,
    meses: cron.meses.map((m, i) =>
      i < 2 ? { ...m, realPct: m.previstoPct, realPctAcumulado: i === 0 ? 0.2 : 0.45 } : m,
    ),
  };
  const fat = calcularFaturamento(curva, { realizadoAcum: curva.realAcum });
  const calc = calcularPrazo(cronComReal, fat, {
    fisicoRealizadoAcum: cronComReal.realAcum ?? null,
  });
  expect(calc.fisicoRealizadoDisponivel).toBe(true); // real disponível → farol físico sai
  expect(calc.avancoFisicoRealPct).toBeCloseTo(45, 1);
});
