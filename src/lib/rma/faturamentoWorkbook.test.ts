// Caminho WORKBOOK-MOTOR do Faturamento: curva com Real DIRETO (sem projeção/medições) → adapter →
// Camada B → Bridge produz um FaturamentoBM renderável (corte, realizado, saldo, histórico mensal).
// Garante que a aba NÃO fica vazia com dado correto (o bug que o fix do corte resolveu). bun test.

import { test, expect } from "bun:test";

import { faturamentoRealFromCurva, type FaturamentoCurva } from "@/lib/supabase/faturamentoCurva";
import { buildFaturamentoBm } from "./bridgeFaturamento";
import { calcularFaturamento } from "./calcFaturamento";

// 4 meses · Contratado cheio · Real DIRETO só nos 2 primeiros (obra em execução) · SEM projeção/tipo.
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

test("workbook: curva sem projeção + Real direto → adapter sintetiza o realizado", () => {
  const real = faturamentoRealFromCurva(curva);
  expect(real.nBms).toBe(2); // 2 meses com Real > 0 viram "BMs"
  expect(real.realAcumulado).toBe(300);
  expect(real.saldoFaturar).toBe(700); // contratado 1000 − realizado 300
  expect(real.contratadoTotal).toBe(1000);
});

test("workbook: Camada B acha o corte pelo Real (sem projeção) → foto atual correta", () => {
  const real = faturamentoRealFromCurva(curva);
  const calc = calcularFaturamento(curva, { realizadoAcum: real.realAcumulado });
  expect(calc).not.toBeNull();
  expect(calc!.mesCorte).toEqual({ ano: 2026, mes: 2 }); // último mês com Real
  expect(calc!.realizadoAcum).toBe(300);
  expect(calc!.contratadoAcum).toBe(400); // planejado acumulado NO corte
  expect(calc!.desvioAcumRs).toBe(-100); // 300 − 400 (atraso de faturamento)
});

test("workbook: Bridge produz FaturamentoBM renderável (não-vazio) com Curva S e período", () => {
  const real = faturamentoRealFromCurva(curva);
  const calc = calcularFaturamento(curva, { realizadoAcum: real.realAcumulado });
  const bridge = buildFaturamentoBm(calc, real, null);
  expect(bridge).not.toBeNull();
  // Curva S = fonte do Resumo BM a BM (Previsto/Real/Aderência por mês); 4 meses (contratado cheio).
  expect(bridge!.fat.curvaS.length).toBe(4);
  expect(bridge!.fat.periodo).not.toBeNull(); // deck Período/projeção montado a partir do corte
});
