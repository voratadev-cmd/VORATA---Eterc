// Motor C.6/D.5 v53 — cenário hand-verificável espelhando as regras dos mockups.
// (Os números-âncora do §9 são provados contra o BANCO pelos probes de paridade; aqui
// provamos a SEMÂNTICA: limiar do excedente, presets, medido×contratado, M1.)

import { expect, test } from "bun:test";

import {
  aplicarPreset,
  linhaCalc,
  m1Calc,
  selecaoRecomendada,
  totaisDe,
  type InsumoFd,
} from "./insumosFd";

const IPCA = 0.01254;
const fonte = (
  id: string,
  rotulo: string,
  delta: number | null,
  recomendada = false,
): InsumoFd["opcoes"][number] => ({
  id,
  fonte: rotulo.split(/[ ·]/)[0] ?? rotulo,
  rotulo,
  codigo: null,
  tipo: "preco",
  valorOs: 100,
  valorAtual: delta != null ? 100 * (1 + delta) : null,
  delta,
  excedente: delta != null ? delta - IPCA : null,
  recomendada,
});

// CBUQ-like: DNIT·Pavim. recomendada (+2,5%), DNIT·CAP explosiva (+42,9%), SINAPI parada (0%)
const cbuq: InsumoFd = {
  ordemAbc: 1,
  nome: "CBUQ TESTE",
  unidade: "t",
  classe: "A",
  categoria: "CBUQ",
  ordemPq: 10,
  qtdPq: 1000,
  precoUnitBdi: 100,
  valorContratoBdi: 100_000,
  qtdMedida: 0,
  valorMedidoBdi: 0,
  fonteRecomendada: "pav",
  opcoes: [
    fonte("sinapi", "SINAPI CAP", 0),
    fonte("pav", "DNIT·Pavim.", 0.025, true),
    fonte("cap", "DNIT·CAP", 0.429),
  ],
};
// diesel-like: SEM fonte DNIT (preset dnit → recomendada ANP); tem medição
const diesel: InsumoFd = {
  ordemAbc: 2,
  nome: "DIESEL TESTE",
  unidade: "l",
  classe: "A",
  categoria: "COMBUSTÍVEL",
  ordemPq: 5,
  qtdPq: 500,
  precoUnitBdi: 10,
  valorContratoBdi: 5_000,
  qtdMedida: 100,
  valorMedidoBdi: 1_000,
  fonteRecomendada: "anp",
  opcoes: [
    fonte("anp", "ANP·S-10", 0.0127, true),
    fonte("sbc", "SBC diesel", 0.234),
    fonte("emop_d", "EMOP diesel", 0.005),
  ],
};
// abaixo do IPCA: não aciona nada
const inerte: InsumoFd = {
  ordemAbc: 3,
  nome: "AÇO TESTE",
  unidade: "kg",
  classe: "B",
  categoria: "AÇO",
  ordemPq: 1,
  qtdPq: 10,
  precoUnitBdi: 8,
  valorContratoBdi: 80,
  qtdMedida: 0,
  valorMedidoBdi: 0,
  fonteRecomendada: "emop",
  opcoes: [fonte("emop", "EMOP aço", 0.001, true)],
};
const INS = [cbuq, diesel, inerte];

test("recomendada: totais = Σ excedente×base, só acima do IPCA conta", () => {
  const sel = selecaoRecomendada(INS);
  const t = totaisDe(INS, sel);
  expect(t.acimaDoIpca).toBe(2); // cbuq (+2,5%) e diesel (+1,27%); aço (0,1%) fica abaixo
  expect(t.repasseReal).toBeCloseTo((0.0127 - IPCA) * 1_000, 10); // só diesel tem medição
  expect(t.potencial).toBeCloseTo((0.025 - IPCA) * 100_000 + (0.0127 - IPCA) * 5_000, 8);
});

test("preset dnit: label DNIT*, senão recomendada (diesel sem DNIT)", () => {
  const sel = aplicarPreset(INS, "dnit");
  expect(sel[1]).toBe("pav"); // 1ª DNIT na ordem das opções — não a CAP explosiva
  expect(sel[2]).toBe("anp"); // sem DNIT → recomendada
});

test("presets melhor/pior = maior/menor Δ%; mercado prioriza SINAPI", () => {
  expect(aplicarPreset(INS, "melhor")[1]).toBe("cap");
  expect(aplicarPreset(INS, "pior")[1]).toBe("sinapi");
  expect(aplicarPreset(INS, "mercado")[1]).toBe("sinapi");
  expect(aplicarPreset(INS, "mercado")[2]).toBe("sbc"); // SINAPI ausente → SBC vem antes de ANP
});

test("linhaCalc: repasse null sem medição (pendente ≠ zero) e 0 quando medido não excede", () => {
  const sel = selecaoRecomendada(INS);
  expect(linhaCalc(cbuq, sel).repasseReal).toBeNull(); // sem medição → '—'
  const selPior = aplicarPreset(INS, "pior");
  expect(selPior[2]).toBe("emop_d"); // menor Δ% do diesel
  expect(linhaCalc(diesel, selPior).repasseReal).toBe(0); // medido, mas abaixo do IPCA → R$ 0 (não '—')
});

test("m1Calc: R = [(I − I₀) × P] / I₀ (números do contrato)", () => {
  const reeq = {
    ipcaPeriodo: IPCA,
    dataOs: null,
    dataVerificacao: null,
    dataAssinatura: null,
    dataProposta: null,
    dataReajusteAniversario: null,
    dataVerificacaoReeq: null,
    contratoCheioBdi: 611_357_314.09,
    medidoAcumulado: 11_375_380.19,
    saldoAExecutar: 599_981_933.9,
    reajusteAcumulado: null,
    ipcaAtual: 7640.15,
    cenarioM1Ativo: "proposta",
  };
  const { reajuste } = m1Calc(reeq, {
    id: "proposta",
    nome: "Jul/2025",
    desc: "data da proposta",
    mes: "2025-07",
    i0: 7331.98,
  });
  expect(Math.round(reajuste * 100) / 100).toBe(25_217_803.73);
});
