// Golden MULTI-OBRA (sintético, NÃO Sorriso) · prova que a Camada B generaliza nos caminhos que a
// OBRA #2 exercita PRIMEIRO: denominador zero/null, curva vazia, meses fora de ordem, e — o mais
// crítico — NaN/Infinity vazando pro farol. Erro de farol = milhões; estes casos travam a borda.

import { test, expect } from "bun:test";
import { calcularFaturamento } from "./calcFaturamento";
import { calcularPrazo } from "./calcPrazo";
import { calcularIndicadores } from "./calcIndicadores";
import type { FaturamentoCurva } from "@/lib/supabase/faturamentoCurva";
import type { CronogramaPrevisto } from "@/lib/supabase/cronograma";

type Mes = FaturamentoCurva["meses"][number];
const mes = (
  ano: number,
  m: number,
  cAcum: number | null,
  pAcum: number | null,
  tipo: string | null = null,
): Mes => ({
  ano,
  mes: m,
  contratadoRs: null,
  contratadoRsAcum: cAcum,
  projecaoRs: null,
  projecaoRsAcum: pAcum,
  tipoProjecao: tipo,
});
const curva = (meses: Mes[], custoTotal: number | null = 1000): FaturamentoCurva => ({
  custoTotal,
  status: "ok",
  nMeses: meses.length,
  meses,
});

// ── denominador degenerado ──────────────────────────────────────────────
test("custoTotal=0 → avanço null (NUNCA Infinity)", () => {
  const r = calcularFaturamento(curva([mes(2026, 1, 100, 100, "realizado")], 0), {
    realizadoAcum: 100,
  });
  expect(r).not.toBeNull();
  expect(r!.avancoContratadoPct).toBeNull(); // 100/0 não pode virar Infinity
  expect(r!.avancoRealizadoPct).toBeNull();
  expect(r!.aderenciaAcum).toBe(100); // aderência não depende do custoTotal — segue válida
});

test("custoTotal=null → avanço null, sem crash", () => {
  const r = calcularFaturamento(curva([mes(2026, 1, 100, 100, "realizado")], null), {
    realizadoAcum: 100,
  });
  expect(r!.avancoContratadoPct).toBeNull();
  expect(r!.avancoRealizadoPct).toBeNull();
});

test("contratadoAcum=0 no corte → aderência/desvio null, farol null", () => {
  const r = calcularFaturamento(curva([mes(2026, 1, 0, 50, "realizado")]), { realizadoAcum: 50 });
  expect(r!.aderenciaAcum).toBeNull();
  expect(r!.desvioAcumPct).toBeNull();
  expect(r!.farol).toBeNull(); // sem aderência, NÃO inventa um nível
});

// ── NaN/Infinity NÃO pode virar farol (o guard de finitude) ─────────────
test("NaN no acumulado contratado → aderência/desvio/farol null (guard de finitude)", () => {
  const r = calcularFaturamento(curva([mes(2026, 1, NaN, 100, "realizado")]), {
    realizadoAcum: 100,
  });
  expect(r!.aderenciaAcum).toBeNull();
  expect(r!.desvioAcumPct).toBeNull();
  expect(r!.farol).toBeNull(); // um NaN jamais pode produzir Conforme/Crítico
});

test("Indicadores: faturamento com NaN não pinta o bloco (farol null)", () => {
  const fat = calcularFaturamento(curva([mes(2026, 1, NaN, 100, "realizado")]), {
    realizadoAcum: 100,
  });
  const ind = calcularIndicadores(fat, null);
  expect(ind.blocos[0].chave).toBe("faturamento");
  expect(ind.blocos[0].nivel).toBeNull();
  expect(ind.farolGeral).toBeNull();
});

// ── curva vazia / fora de ordem ─────────────────────────────────────────
test("meses vazios → corte/farol null, sem crash", () => {
  const r = calcularFaturamento(curva([]), { realizadoAcum: 50 });
  expect(r!.mesCorte).toBeNull();
  expect(r!.aderenciaAcum).toBeNull();
  expect(r!.farol).toBeNull();
});

test("meses FORA DE ORDEM → corte por VALOR (não por posição)", () => {
  const r = calcularFaturamento(
    curva([mes(2026, 3, 300, 300), mes(2026, 1, 100, 100), mes(2026, 2, 200, 200)]),
    { realizadoAcum: 200 },
  );
  expect(r!.mesCorte).toEqual({ ano: 2026, mes: 2 }); // casa pelo acumulado 200, não pelo índice
  expect(r!.realizadoAcum).toBe(200);
});

// ── Prazo degenerado ────────────────────────────────────────────────────
function cron(
  meses: CronogramaPrevisto["meses"],
  inicio = "2026-01-01",
  termino = "2026-12-31",
): CronogramaPrevisto {
  return {
    custoTotal: 1000,
    inicioObra: inicio,
    terminoObra: termino,
    status: "ok",
    nMeses: meses.length,
    somaPct: 1,
    meses,
  };
}

test("Prazo: cron e faturamento nulos → null (nada a calcular)", () => {
  expect(calcularPrazo(null, null)).toBeNull();
});

test("Prazo: datas invertidas (término < início) → prazo negativo NÃO crasha", () => {
  const r = calcularPrazo(cron([], "2026-12-31", "2026-01-01"), null);
  expect(r).not.toBeNull();
  // não há corte (sem faturamento) → físico/aderência pendentes, sem farol falso
  expect(r!.farolFisico).toBeNull();
});
