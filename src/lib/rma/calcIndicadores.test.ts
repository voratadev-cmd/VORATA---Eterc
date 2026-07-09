// Golden da Camada B · Indicadores. Trava a AGREGAÇÃO honesta: só Faturamento tem farol firme;
// Prazo (físico) e os 4 demais blocos ficam PENDENTES; a Situação Geral fica null (pendente) até
// cobertura completa — nunca um verde com áreas cegas. Inclui a regra `consolidar` com cobertura
// COMPLETA (o caminho que a montagem real ainda não alcança) + invariantes de honestidade.

import { test, expect } from "bun:test";
import {
  calcularIndicadores,
  consolidar,
  type BlocoIndicador,
  type FarolNivelInput,
} from "./calcIndicadores";
import { calcularFaturamento } from "./calcFaturamento";
import { calcularPrazo } from "./calcPrazo";
import type { FaturamentoCurva } from "@/lib/supabase/faturamentoCurva";
import type { CronogramaPrevisto } from "@/lib/supabase/cronograma";

// fat real da Sorriso (corte mai/26, aderência 107,05% → Conforme)
function fatSorriso(realizado = 9927488.02, contratadoAcum = 9274076.48) {
  const curva: FaturamentoCurva = {
    custoTotal: 39775999.98,
    status: "ok",
    nMeses: 1,
    meses: [
      {
        ano: 2026,
        mes: 5,
        contratadoRs: contratadoAcum,
        contratadoRsAcum: contratadoAcum,
        projecaoRs: realizado,
        projecaoRsAcum: realizado,
        tipoProjecao: null,
      },
    ],
  };
  return calcularFaturamento(curva, { realizadoAcum: realizado });
}

const CRON: CronogramaPrevisto = {
  custoTotal: 39776000,
  inicioObra: "2025-09-16",
  terminoObra: "2027-03-09",
  status: "ok",
  nMeses: 1,
  somaPct: 0.825,
  meses: [
    {
      ano: 2026,
      mes: 5,
      previstoPct: 0.0818,
      previstoPctAcumulado: 0.825,
      previstoFinanceiroDeclarado: null,
    },
  ],
};

test("Sorriso · só Faturamento firme; geral PENDENTE (parcial 1/6)", () => {
  const fat = fatSorriso();
  const prazo = calcularPrazo(CRON, fat);
  const r = calcularIndicadores(fat, prazo);

  expect(r.blocos).toHaveLength(6);

  // bloco Faturamento = único com farol real — trava valor, descricao E nota (o que a tela mostra)
  const fatB = r.blocos[0];
  expect(fatB.chave).toBe("faturamento");
  expect(fatB.nivel).toBe("conforme");
  expect(fatB.valor).toBe("107,0%");
  expect(fatB.descricao).toBe("Aderência 107,0% · desvio +7,0 pp");
  expect(fatB.nota).toBe("Realizado ÷ contratado no corte");
  expect(fatB.disponivel).toBe(true);

  // bloco Prazo = pendente; SEM valor headline (não confundir previsto do plano com realização)
  const prazoB = r.blocos[3];
  expect(prazoB.chave).toBe("prazo");
  expect(prazoB.nivel).toBeNull();
  expect(prazoB.disponivel).toBe(false);
  expect(prazoB.valor).toBe("—");
  expect(prazoB.nota).toBe("Plano previa 82,5% físico · ref. financeira 107,0% (Conforme)");

  // os 4 demais blocos = pendentes
  for (const i of [1, 2, 4, 5]) {
    expect(r.blocos[i].nivel).toBeNull();
    expect(r.blocos[i].disponivel).toBe(false);
  }

  // contagem + cobertura
  expect(r.contagem).toEqual({ conforme: 1, observacao: 0, risco: 0, critico: 0, pendente: 5 });
  expect(r.cobertura).toEqual({ disponiveis: 1, total: 6 });

  // consolidado: referência parcial = Conforme, MAS geral null (não confiável)
  expect(r.farolDisponiveis).toBe("conforme");
  expect(r.farolGeral).toBeNull();
  expect(r.consolidadoConfiavel).toBe(false);
  expect(r.situacaoLabel).toBe("Parcial — 1/6 com dado · 1/6 classificado");
  expect(r.aderenciaMesPct).toBeCloseTo(107.0456, 3);
});

test("produtividade física liga o bloco (valor real exposto, farol PENDENTE sem benchmark)", () => {
  const fat = fatSorriso();
  const produtividade = {
    produtividadeRealKgPh: 2.3182,
    acoTotalKg: 4138,
    avancoFisicoPct: 39.31,
    indicePerdaRaw: 2152.27,
    perdaAnomalia: true,
    nMeses: 1,
  };
  const r = calcularIndicadores(fat, null, produtividade);
  const prod = r.blocos.find((b) => b.chave === "produtividade");
  expect(prod).toBeDefined();
  if (!prod) return;
  // valor REAL (kg/Hh) exposto; mas farol PENDENTE (sem benchmark normalizado não classifica)
  expect(prod.valor).toBe("2,32 kg/Hh");
  expect(prod.nivel).toBeNull();
  expect(prod.disponivel).toBe(false); // não conta na cobertura (sem farol)
  expect(prod.nota).toContain("avanço 39,3%");
  expect(prod.nota).toContain("2152% (anomalia de origem)");
  // cobertura segue parcial (só faturamento firme) — o valor não infla a contagem
  expect(r.cobertura.disponiveis).toBe(1);
});

test("insumos físico liga o bloco (nº + Curva ABC do orçamento, farol PENDENTE sem preço)", () => {
  const fat = fatSorriso();
  const insumos = {
    nInsumos: 344,
    status: "ok",
    nSemQtde: 0,
    nComPreco: 0,
    nComClasse: 344,
    nComValor: 344,
    totalValor: 39255964,
    curvaAbcValor: [],
    nPareto80: 36,
    porUnidade: [],
    porClasse: [
      { classe: "A", nInsumos: 30 },
      { classe: "B", nInsumos: 50 },
      { classe: "C", nInsumos: 157 },
      { classe: "D", nInsumos: 79 },
      { classe: "N", nInsumos: 28 },
    ],
    insumos: [],
  };
  const r = calcularIndicadores(fat, null, null, insumos);
  const ins = r.blocos.find((b) => b.chave === "insumos");
  expect(ins).toBeDefined();
  if (!ins) return;
  // valor REAL (nº de insumos) exposto; Pareto por VALOR no headline; farol PENDENTE (sem preço real)
  expect(ins.valor).toBe("344 insumos");
  expect(ins.nivel).toBeNull();
  expect(ins.disponivel).toBe(false); // não conta na cobertura (sem farol)
  // nota no vocabulário v53: Pareto sobre o contrato FD + excedente ao IPCA (cl. 8.8)
  expect(ins.nota).toContain("36 insumos = 80% do contrato FD"); // Curva ABC por valor (Pareto real)
  expect(ins.nota).toContain("excedente ao IPCA pendente");
  // o fato físico não infla a cobertura (só faturamento firme)
  expect(r.cobertura.disponiveis).toBe(1);
});

test("desvio negativo formata com '-'; desvio ~0 não vira '-0.0'", () => {
  // realizado 97 < contratado 100 → desvio -3% → Observação (régua oficial -1..-5)
  const neg = calcularIndicadores(fatSorriso(97, 100), null);
  expect(neg.blocos[0].nivel).toBe("observacao");
  expect(neg.blocos[0].descricao).toBe("Aderência 97,0% · desvio -3,0 pp");
  // desvio minúsculo negativo (-0,03%) deve sair "0.0 pp", nunca "-0.0 pp"
  const quase = calcularIndicadores(fatSorriso(99970, 100000), null);
  expect(quase.blocos[0].descricao).toBe("Aderência 100,0% · desvio 0,0 pp");
});

test("farolDisponiveis acompanha o nível do bloco disponível (Risco)", () => {
  const r = calcularIndicadores(fatSorriso(92, 100), null); // desvio -8% → Risco (régua -5..-10)
  expect(r.blocos[0].nivel).toBe("risco");
  expect(r.farolDisponiveis).toBe("risco");
  expect(r.farolGeral).toBeNull(); // ainda parcial
  expect(r.contagem.risco).toBe(1);
  expect(r.contagem.pendente).toBe(5);
});

test("Nada calculado → painel todo pendente (0/6)", () => {
  const r = calcularIndicadores(null, null);
  expect(r.blocos.every((b) => b.nivel === null)).toBe(true);
  expect(r.farolDisponiveis).toBeNull();
  expect(r.farolGeral).toBeNull();
  expect(r.cobertura).toEqual({ disponiveis: 0, total: 6 });
  expect(r.situacaoLabel).toBe("Parcial — 0/6 com dado · 0/6 classificado");
});

test("invariante: bloco.disponivel ⇔ nivel != null", () => {
  for (const fat of [fatSorriso(), null]) {
    const r = calcularIndicadores(fat, calcularPrazo(CRON, fat));
    for (const b of r.blocos) expect(b.disponivel).toBe(b.nivel != null);
  }
});

// ── consolidar: o caminho de COBERTURA COMPLETA que a montagem real ainda não alcança ──
const mkBloco = (i: number, nivel: FarolNivelInput): BlocoIndicador => ({
  chave: "faturamento",
  label: `b${i}`,
  nivel,
  valor: "",
  descricao: "",
  nota: "",
  disponivel: nivel != null,
});

test("consolidar · cobertura completa → farolGeral = pior nível (worst-of)", () => {
  const seis = [
    mkBloco(0, "conforme"),
    mkBloco(1, "conforme"),
    mkBloco(2, "risco"),
    mkBloco(3, "observacao"),
    mkBloco(4, "conforme"),
    mkBloco(5, "critico"),
  ];
  const c = consolidar(seis);
  expect(c.cobertura).toEqual({ disponiveis: 6, total: 6 });
  expect(c.consolidadoConfiavel).toBe(true);
  expect(c.farolGeral).toBe("critico"); // pior de todos
  expect(c.farolDisponiveis).toBe("critico");
  expect(c.situacaoLabel).toBe("Crítico");
  expect(c.contagem).toEqual({ conforme: 3, observacao: 1, risco: 1, critico: 1, pendente: 0 });
});

test("consolidar · cobertura completa toda Conforme → Conforme", () => {
  const c = consolidar(Array.from({ length: 6 }, (_, i) => mkBloco(i, "conforme")));
  expect(c.farolGeral).toBe("conforme");
  expect(c.situacaoLabel).toBe("Conforme");
});

test("INVARIANTE DURA: farolGeral != null ⇒ cobertura completa (nunca verde com área cega)", () => {
  // qualquer combinação com ao menos 1 pendente NÃO pode produzir farolGeral
  const casos: FarolNivelInput[][] = [
    ["conforme", "conforme", "conforme", "conforme", "conforme", null],
    ["conforme", null, null, null, null, null],
    ["critico", "conforme", "conforme", "conforme", "conforme", null],
  ];
  for (const niveis of casos) {
    const c = consolidar(niveis.map((n, i) => mkBloco(i, n)));
    if (c.farolGeral != null) expect(c.cobertura.disponiveis).toBe(c.cobertura.total);
    expect(c.farolGeral).toBeNull(); // todos têm 1+ pendente
  }
});
