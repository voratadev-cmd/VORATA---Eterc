// Golden da Camada B · Prazo. Fixture = cronograma PREVISTO físico REAL da Sorriso
// (obra_cronograma_meses, 14 meses, Σ=100%; datas da obra 16/09/2025→09/03/2027) + o
// FaturamentoCalc real (corte mai/26). Trava calendário, previsto físico e referência
// financeira. O ponto-chave: aderência FÍSICA fica PENDENTE (sem realizado físico no BM).

import { test, expect } from "bun:test";
import { calcularPrazo } from "./calcPrazo";
import { calcularFaturamento } from "./calcFaturamento";
import type { CronogramaPrevisto } from "@/lib/supabase/cronograma";
import type { FaturamentoCurva } from "@/lib/supabase/faturamentoCurva";

// Cronograma previsto físico real (curva de avanço, fração 0..1). No corte (mai/26) = 0,825.
const m = (
  ano: number,
  mes: number,
  previstoPct: number,
  previstoPctAcumulado: number,
  previstoFinanceiroDeclarado: number | null,
) => ({ ano, mes, previstoPct, previstoPctAcumulado, previstoFinanceiroDeclarado });

const CRON_SORRISO: CronogramaPrevisto = {
  custoTotal: 39776000,
  inicioObra: "2025-09-16",
  terminoObra: "2027-03-09",
  status: "ok",
  nMeses: 14,
  somaPct: 1,
  meses: [
    m(2025, 10, 0.0414, 0.0414, 1648346.88),
    m(2025, 11, 0.0484, 0.0898, null),
    m(2025, 12, 0.0731, 0.1629, null),
    m(2026, 1, 0.0814, 0.2443, null),
    m(2026, 2, 0.1589, 0.4032, 1925589.14),
    m(2026, 3, 0.1597, 0.5629, 2908399.8),
    m(2026, 4, 0.1803, 0.7432, 3238833.63),
    m(2026, 5, 0.0818, 0.825, null),
    m(2026, 6, 0.0483, 0.8733, null),
    m(2026, 7, 0.0735, 0.9468, null),
    m(2026, 8, 0.0201, 0.9669, null),
    m(2026, 9, 0.0255, 0.9924, 798490.95),
    m(2026, 10, 0.0069, 0.9993, null),
    m(2026, 11, 0.0007, 1, 274456.66),
  ],
};

// FaturamentoCalc real da Sorriso: curva mínima no corte → calcularFaturamento resolve tudo.
const FAT_CURVA: FaturamentoCurva = {
  custoTotal: 39775999.98,
  status: "ok",
  nMeses: 1,
  meses: [
    {
      ano: 2026,
      mes: 5,
      contratadoRs: 3238833.63,
      contratadoRsAcum: 9274076.48,
      projecaoRs: 6353552,
      projecaoRsAcum: 9927488.02,
      tipoProjecao: null,
    },
  ],
};
const FAT = calcularFaturamento(FAT_CURVA, { realizadoAcum: 9927488.02 });

test("Sorriso · calendário + previsto físico + referência financeira (físico PENDENTE)", () => {
  const r = calcularPrazo(CRON_SORRISO, FAT);
  expect(r).not.toBeNull();
  if (!r) return;

  // calendário (datas reais da obra), foto no fim do mês de corte
  expect(r.mesCorte).toEqual({ ano: 2026, mes: 5 });
  expect(r.dataReferenciaISO).toBe("2026-05-31");
  expect(r.inicioISO).toBe("2025-09-16");
  expect(r.fimContratualISO).toBe("2027-03-09");
  expect(r.prazoContratualDias).toBe(539);
  expect(r.decorridoDias).toBe(257);
  expect(r.decorridoPct).toBeCloseTo(47.6809, 3);
  expect(r.restantesDias).toBe(282);

  // previsto FÍSICO no corte = onde o plano dizia que estaríamos (82,5%) — informativo
  expect(r.previstoFisicoPct).toBeCloseTo(82.5, 4);

  // referência FINANCEIRA (financeiro×financeiro, honesta)
  expect(r.realizadoFinanceiroPct).toBeCloseTo(24.9585, 3);
  expect(r.previstoFinanceiroPct).toBeCloseTo(23.3158, 3);
  expect(r.aderenciaFinanceiraPct).toBeCloseTo(107.0456, 3);
  expect(r.atrasoFinanceiroPp).toBeCloseTo(1.6427, 3);
  expect(r.farolFinanceiro).toBe("conforme");

  // sem físico passado → real indisponível, farol pendente com motivo (NUNCA inventado)
  expect(r.fisicoRealizadoDisponivel).toBe(false);
  expect(r.avancoFisicoRealPct).toBeNull();
  expect(r.atrasoFisicoPp).toBeNull();
  expect(r.farolFisico).toBeNull();
  expect(r.farolFisicoMotivo).toBe("sem físico realizado no BM");
});

test("Sorriso · físico real do BM (24,99%) — âncora exposta, farol PENDENTE (previsto incoerente)", () => {
  // BM-03 oficial: 24,99% físico acumulado (§4.1). Previsto físico no corte = 82,5%, mas o
  // previsto FINANCEIRO é 23,3% — gap de 59pp denuncia baseline quebrado. Expomos o real e o
  // atraso (informativos), mas NÃO emitimos farol de um previsto inconsistente.
  const r = calcularPrazo(CRON_SORRISO, FAT, {
    fisicoRealizadoAcum: 0.2499,
    fisicoRealizadoMes: 0.1599,
  });
  expect(r).not.toBeNull();
  if (!r) return;

  expect(r.fisicoRealizadoDisponivel).toBe(true);
  expect(r.avancoFisicoRealPct).toBeCloseTo(24.99, 4); // âncora oficial (§4.1)
  expect(r.fisicoRealMesPct).toBeCloseTo(15.99, 4);
  expect(r.atrasoFisicoPp).toBeCloseTo(24.99 - 82.5, 3); // −57,51pp (informativo)
  expect(r.previstoFisicoVsFinanceiroPp).toBeCloseTo(82.5 - 23.3158, 2); // ~59pp incoerência
  // guard de coerência: previsto físico×financeiro divergem >15pp → farol NÃO sai
  expect(r.farolFisico).toBeNull();
  expect(r.farolFisicoMotivo).toContain("incoerente");
});

test("Físico coerente → farol físico SAI pela régua (atraso − previsto)", () => {
  // cenário sintético: previsto físico (24%) ~ financeiro (23,3%) coerentes; real 22% → atraso
  // −2pp → Conforme (régua prazo_atraso_fisico: conforme −2 / obs −5 / risco −10).
  const cronCoerente: CronogramaPrevisto = {
    ...CRON_SORRISO,
    meses: CRON_SORRISO.meses.map((x) =>
      x.ano === 2026 && x.mes === 5 ? { ...x, previstoPctAcumulado: 0.24 } : x,
    ),
  };
  const r = calcularPrazo(cronCoerente, FAT, { fisicoRealizadoAcum: 0.22 });
  expect(r).not.toBeNull();
  if (!r) return;
  expect(r.previstoFisicoPct).toBeCloseTo(24, 4);
  expect(r.atrasoFisicoPp).toBeCloseTo(22 - 24, 3); // −2pp
  expect(r.farolFisico).toBe("conforme");
  expect(r.farolFisicoMotivo).toBeNull();
});

test("guard de coerência · gap dentro (14pp) emite farol; fora (16pp) bloqueia", () => {
  // FAT sintético com previsto financeiro redondo (20%) para isolar o limite de 15pp
  const fat20 = calcularFaturamento(
    {
      custoTotal: 100,
      status: "ok",
      nMeses: 1,
      meses: [
        {
          ano: 2026,
          mes: 5,
          contratadoRs: 20,
          contratadoRsAcum: 20,
          projecaoRs: 20,
          projecaoRsAcum: 20,
          tipoProjecao: null,
        },
      ],
    },
    { realizadoAcum: 20 },
  );
  const cron = (prevFisAcum: number): CronogramaPrevisto => ({
    custoTotal: 100,
    inicioObra: "2026-01-01",
    terminoObra: "2026-12-31",
    status: "ok",
    nMeses: 1,
    somaPct: 1,
    meses: [m(2026, 5, prevFisAcum, prevFisAcum, null)],
  });

  // previsto físico 34% × financeiro 20% = gap 14pp (< 15) → emite (atraso 33−34=−1 → conforme)
  const dentro = calcularPrazo(cron(0.34), fat20, { fisicoRealizadoAcum: 0.33 });
  expect(dentro?.previstoFisicoVsFinanceiroPp).toBeCloseTo(14, 4);
  expect(dentro?.farolFisico).not.toBeNull();

  // previsto físico 36% × financeiro 20% = gap 16pp (> 15) → bloqueia com motivo
  const fora = calcularPrazo(cron(0.36), fat20, { fisicoRealizadoAcum: 0.33 });
  expect(fora?.previstoFisicoVsFinanceiroPp).toBeCloseTo(16, 4);
  expect(fora?.farolFisico).toBeNull();
  expect(fora?.farolFisicoMotivo).toContain("incoerente");
});

test("BM com físico mas corte SEM previsto físico → real exposto, farol pendente (sem previsto)", () => {
  // cronograma sem o mês de corte (mai/26) → previstoFisicoPct null
  const cronSemCorte: CronogramaPrevisto = {
    ...CRON_SORRISO,
    meses: CRON_SORRISO.meses.filter((x) => !(x.ano === 2026 && x.mes === 5)),
  };
  const r = calcularPrazo(cronSemCorte, FAT, { fisicoRealizadoAcum: 0.2499 });
  expect(r?.fisicoRealizadoDisponivel).toBe(true);
  expect(r?.avancoFisicoRealPct).toBeCloseTo(24.99, 4); // real exposto mesmo sem previsto
  expect(r?.previstoFisicoPct).toBeNull();
  expect(r?.atrasoFisicoPp).toBeNull();
  expect(r?.farolFisico).toBeNull();
  expect(r?.farolFisicoMotivo).toBe("sem previsto físico no corte para comparar");
});

test("Sem faturamento (sem corte) → sem foto, mas calendário do contrato ainda sai", () => {
  const r = calcularPrazo(CRON_SORRISO, null);
  expect(r).not.toBeNull();
  if (!r) return;
  expect(r.mesCorte).toBeNull();
  expect(r.dataReferenciaISO).toBeNull();
  expect(r.decorridoDias).toBeNull();
  expect(r.prazoContratualDias).toBe(539); // datas do contrato independem do corte
  expect(r.previstoFisicoPct).toBeNull();
  expect(r.aderenciaFinanceiraPct).toBeNull();
  expect(r.farolFinanceiro).toBeNull();
  expect(r.farolFisico).toBeNull();
});

test("Tudo ausente → null", () => {
  expect(calcularPrazo(null, null)).toBeNull();
});
