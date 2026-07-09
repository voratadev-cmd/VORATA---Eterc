// Golden do Bridge §7.1 · Visão Geral. Prova: reuso dos nested (faturamento/prazo), síntese real
// (valor/saldo/datas/prazo), situação NEUTRA com cobertura parcial, e os pendentes (recursos vazio,
// desequilíbrio 0, eventos/entregáveis vazios). Inputs mínimos via cast (o bridge só lê alguns campos).

import { test, expect } from "bun:test";
import { buildVisaoGeralView } from "./bridgeVisaoGeral";
import type { FaturamentoBM, PrazoBM } from "@/lib/mocks/obras";
import type { FaturamentoCalc } from "./calcFaturamento";
import type { IndicadoresCalc } from "./calcIndicadores";
import type { FaturamentoReal } from "@/lib/supabase/medicoes";

const MI = 1e6;

const fatBridge = {
  fat: { curvaS: [], desvioAcumuladoPct: 7 } as unknown as FaturamentoBM,
  bmLabel: "mai/26",
};
const prazoBridge = {
  prazo: {
    decorridoDias: 257,
    restantesDias: 282,
    prazoContratualDias: 539,
    decorridoPct: 47.68,
    inicioISO: "2025-09-16",
    fimContratualISO: "2027-03-09",
  } as unknown as PrazoBM,
  bmLabel: "mai/26",
};
const fat = {
  custoTotal: 39.776 * MI,
  avancoRealizadoPct: 24.96,
  avancoContratadoPct: 23.32,
} as unknown as FaturamentoCalc;
const ind = {
  contagem: { conforme: 1, observacao: 0, risco: 0, critico: 0, pendente: 5 },
  cobertura: { disponiveis: 1, total: 6 },
  farolDisponiveis: "conforme",
  farolGeral: null, // cobertura parcial
  consolidadoConfiavel: false,
  situacaoLabel: "Parcial — 1/6 com dado",
  aderenciaMesPct: 107.05,
  blocos: [
    {
      chave: "faturamento",
      label: "Faturamento",
      nivel: "conforme",
      valor: "107.0%",
      descricao: "x",
      nota: "y",
      disponivel: true,
    },
    {
      chave: "recursos",
      label: "Recursos",
      nivel: null,
      valor: "",
      descricao: "P",
      nota: "n",
      disponivel: false,
    },
    {
      chave: "produtividade",
      label: "Produtividade",
      nivel: null,
      valor: "",
      descricao: "P",
      nota: "n",
      disponivel: false,
    },
    {
      chave: "prazo",
      label: "Prazo",
      nivel: null,
      valor: "",
      descricao: "P",
      nota: "n",
      disponivel: false,
    },
    {
      chave: "insumos",
      label: "Insumos",
      nivel: null,
      valor: "",
      descricao: "P",
      nota: "n",
      disponivel: false,
    },
    {
      chave: "desequilibrio",
      label: "Desequilíbrio",
      nivel: null,
      valor: "",
      descricao: "P",
      nota: "n",
      disponivel: false,
    },
  ],
} as unknown as IndicadoresCalc;
const real = {
  saldoFaturar: 29.848 * MI,
  contratadoTotal: 39.776 * MI,
} as unknown as FaturamentoReal;

test("bridge visão geral · reuso nested + síntese real + situação neutra parcial", () => {
  const out = buildVisaoGeralView({
    fatBridge,
    prazoBridge,
    ind,
    fat,
    real,
    obra: null,
    bmLabel: "mai/26",
  });
  expect(out).not.toBeNull();
  if (!out) return;

  // HONESTO: cobertura parcial → situação neutra (não verde)
  expect(out.bm.situacao).toBe("observacao");
  expect(out.bm.situacaoLabel).toBe("Parcial — 1/6 com dado");

  // faturamento real + reuso dos nested
  expect(out.bm.faturamentoPct).toBe(25); // 24,96 → 25,0
  expect(out.bm.faturamento).toBe(fatBridge.fat); // reuso (mesma referência)
  expect(out.bm.prazo).toBe(prazoBridge.prazo);
  expect(out.bm.blocoFaturamento.nivel).toBe("conforme");
  expect(out.bm.blocoRecursos.valor).toBe("—"); // pendente

  // síntese REAL (do custoTotal/saldo/prazo) + pendentes do contrato (obra null)
  expect(out.visao.sinteseResumida.valorContratado).toContain("39.776.000");
  expect(out.visao.sinteseResumida.saldoFaturar).toContain("29.848.000");
  expect(out.visao.sinteseResumida.prazoLabel).toBe("257 / 539 dias (48%)");
  expect(out.visao.sinteseResumida.gestorObra).toContain("pendente");

  // PENDENTES estruturais
  expect(out.bm.desequilibrioAcumulado).toBe(0);
  expect(out.bm.recursos.porGrupo.MOD.curvaAcumulada).toEqual([]);
  expect(out.bm.ultimosEventos).toEqual([]);
  expect(out.visao.entregaveis).toEqual([]);
});

test("bridge visão geral · null sem núcleo (faturamento/prazo/indicadores)", () => {
  expect(
    buildVisaoGeralView({ fatBridge: null, prazoBridge, ind, fat, real, obra: null, bmLabel: "—" }),
  ).toBeNull();
});
