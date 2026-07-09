// Golden do Bridge §7.1 · Indicadores. Prova o mapeamento IndicadoresCalc → IndicadoresView:
// blocos de farol, e o INVARIANTE de honestidade — Situação Geral NEUTRA (não verde) com cobertura
// parcial; blocos sem nível viram "—" em observação; resto pendente.

import { test, expect } from "bun:test";
import { buildIndicadoresView } from "./bridgeIndicadores";
import type { IndicadoresCalc } from "./calcIndicadores";

const CALC: IndicadoresCalc = {
  contagem: { conforme: 1, observacao: 0, risco: 0, critico: 0, pendente: 5 },
  cobertura: { disponiveis: 1, total: 6 },
  farolDisponiveis: "conforme", // pior dos disponíveis (só faturamento)
  farolGeral: null, // cobertura incompleta → sem situação geral confiável
  consolidadoConfiavel: false,
  situacaoLabel: "Parcial — 1/6 com dado",
  aderenciaMesPct: 107.05,
  blocos: [
    {
      chave: "faturamento",
      label: "Faturamento",
      nivel: "conforme",
      valor: "107,0%",
      descricao: "Aderência acum.",
      nota: "no mês",
      disponivel: true,
    },
    {
      chave: "recursos",
      label: "Recursos",
      nivel: null,
      valor: "",
      descricao: "Pendente",
      nota: "AGM",
      disponivel: false,
    },
    {
      chave: "produtividade",
      label: "Produtividade",
      nivel: null,
      valor: "",
      descricao: "Pendente",
      nota: "Hh",
      disponivel: false,
    },
    {
      chave: "prazo",
      label: "Prazo",
      nivel: null,
      valor: "",
      descricao: "Pendente",
      nota: "físico",
      disponivel: false,
    },
    {
      chave: "insumos",
      label: "Insumos",
      nivel: null,
      valor: "",
      descricao: "Pendente",
      nota: "preço",
      disponivel: false,
    },
    {
      chave: "desequilibrio",
      label: "Desequilíbrio",
      nivel: null,
      valor: "",
      descricao: "Pendente",
      nota: "M3",
      disponivel: false,
    },
  ],
};

test("bridge indicadores · consolidação real + honestidade da cobertura parcial", () => {
  const out = buildIndicadoresView(CALC, "mai/26");
  expect(out).not.toBeNull();
  if (!out) return;
  const v = out.view;

  // INVARIANTE de honestidade: cobertura parcial (farolGeral null) → Situação NEUTRA, não "conforme"
  expect(v.situacao).toBe("observacao");
  expect(v.situacaoLabel).toBe("Parcial — 1/6 com dado");

  // contagem dos 4 níveis (pendentes não entram)
  expect(v.blocosContagem).toEqual({
    criticos: 0,
    risco: 0,
    observacao: 0,
    conforme: 1,
    pendentes: 5,
  });
  expect(v.aderenciaMesPct).toBe(107.1); // 107,05 → 107,1

  // bloco real vs pendentes
  expect(v.blocoFaturamento.nivel).toBe("conforme");
  expect(v.blocoFaturamento.valor).toBe("107,0%");
  expect(v.blocoRecursos.nivel).toBe("observacao"); // pendente → tom neutro
  expect(v.blocoRecursos.valor).toBe("—");
  expect(v.blocoPrazo.valor).toBe("—");

  // pendentes honestos
  expect(v.forcaNoMerito).toBe(0);
  expect(v.acaoRecomendada.titulo).toContain("Aguardando");
  expect(v.diagnostico).toContain("Pendente");
  expect(v.curvas.diagnostico).toContain("Pendente");
  expect(v.marcos).toEqual([]);
  expect(v.responsabilidade.contratante.valor).toBe("—");
});

test("bridge indicadores · null sem cálculo", () => {
  expect(buildIndicadoresView(null, "—")).toBeNull();
});
