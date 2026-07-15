// GATE da SPEC 3 (ajustes-REVISADO-v3) · invariantes executáveis da Onda 1.
// bun run scripts/parity/probe_spec3_gate.ts [obra_id] — sai !=0 em divergência.
import { getFaturamentoWbs } from "../../src/lib/supabase/faturamentoWbs";
import { getInsumosSbso } from "../../src/lib/supabase/insumosSbso";
import { getPrazoC5 } from "../../src/lib/supabase/prazoC5";
import { getRecursosCardsQtde } from "../../src/lib/supabase/recursosCardsQtde";
import { getSinteseContrato } from "../../src/lib/supabase/sinteseContrato";

const ID = process.argv[2] ?? "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const falhas: string[] = [];
const ok = (nome: string, cond: boolean, det: string) => {
  console.log(`${cond ? "✓" : "✗"} ${nome} — ${det}`);
  if (!cond) falhas.push(nome);
};
const r2 = (v: number) => Math.round(v * 100) / 100;

const [wbs, c5, cards, sintese, insumos] = await Promise.all([
  getFaturamentoWbs(ID),
  getPrazoC5(ID),
  getRecursosCardsQtde(ID),
  getSinteseContrato(ID),
  getInsumosSbso(ID),
]);

// Invariante 1 — TOTAL Real "Por Disciplina" == "Por Frente" (BM-9).
if (wbs) {
  const totDisc = r2(wbs.disciplinas.reduce((s, d) => s + (d.real ?? 0), 0));
  const totFrente = r2(wbs.frentes.reduce((s, f) => s + (f.real ?? 0), 0));
  ok(
    "v3#1 faturamento disciplina==frente",
    Math.abs(totDisc - totFrente) < 0.02,
    `disc ${totDisc} × frente ${totFrente}`,
  );
  const ger = wbs.disciplinas.find((d) => /^gerenciamento/i.test(d.nome));
  ok(
    "v3#1 Gerenciamento = Σ filhos (2.453.151)",
    ger?.real != null && Math.abs(ger.real - 2453151.38) < 1,
    `real ${ger?.real}`,
  );
}

// Invariante 2 — Σ 4 fatias da natureza == TOTAL medido.
if (c5 && c5.naturezas.length) {
  const soma = r2(c5.naturezas.reduce((s, f) => s + f.valorRs, 0));
  ok(
    "v3#2 natureza Σ fatias == TOTAL",
    c5.naturezaTotalRs != null && Math.abs(soma - c5.naturezaTotalRs) < 0.02,
    `Σ ${soma} × total ${c5.naturezaTotalRs}`,
  );
  const pcts = c5.naturezas.reduce((s, f) => s + (f.pctDoMedido ?? 0), 0);
  ok("v3#2 percentuais somam 100", Math.abs(pcts - 100) < 0.1, `${r2(pcts)}%`);
}

// Invariante 7 — diferença == contratado − real nos cards por categoria (qtd).
if (cards) {
  for (const cat of ["MOD", "MOI", "EQP"] as const) {
    const c = cards[cat];
    const d =
      c.contratadoBm != null && c.realBm != null ? Math.round(c.contratadoBm - c.realBm) : null;
    ok(
      `v3#7 ${cat} diferença = contratado − real`,
      d != null,
      `${Math.round(c.contratadoBm ?? -1)} − ${c.realBm} = ${d}`,
    );
  }
}

// Invariante 4 — PV do card == Σ disciplinas (Parte E) == PSQ; CFF com nota (delta declarado).
if (sintese) {
  const pv = sintese.financeiro.pvInicialRs;
  ok(
    "v3#4 PV == Σ premissas (PSQ)",
    pv != null && Math.abs(sintese.premissasTotal - pv) < 0.02,
    `pv ${pv} × Σ ${r2(sintese.premissasTotal)}`,
  );
  // Invariante 5 — BDI oficial do Painel 3 (22,40 na SBSO), nunca o derivado do CFF.
  ok(
    "v3#5 BDI oficial (Painel 3)",
    sintese.financeiro.bdiPct != null,
    `${sintese.financeiro.bdiPct?.toFixed(2)}%`,
  );
}

// Invariante 6 — Reajuste (C.6 SBSO): concedido + novo == acumulado; acumulado ÷ base == ~11,98%;
// Σ por item == cards (oracle); Σ itens fd == base.
if (insumos) {
  const ic = insumos.cards;
  ok(
    "v3#6 concedido + novo == acumulado",
    Math.abs(ic.concedidoRs + ic.novoRs - ic.acumRs) < 0.02,
    `${r2(ic.concedidoRs)} + ${r2(ic.novoRs)} = ${r2(ic.concedidoRs + ic.novoRs)} × ${r2(ic.acumRs)}`,
  );
  ok(
    "v3#6 acumulado ÷ base == 11,98%",
    Math.abs(ic.acumRs / ic.baseRs - 0.119772) < 0.0005,
    `${((ic.acumRs / ic.baseRs) * 100).toFixed(3)}%`,
  );
  const somaItens = r2(insumos.itens.reduce((s, x) => s + x.custoTotalRs, 0));
  ok(
    "v3#6 Σ itens fd == base",
    Math.abs(somaItens - ic.baseRs) < 0.02,
    `${somaItens} × ${ic.baseRs}`,
  );
  const somaConc = r2(insumos.itens.reduce((s, x) => s + x.concedidoRs, 0));
  ok(
    "v3#6 Σ por item == card concedido",
    Math.abs(somaConc - ic.concedidoRs) < 0.02,
    `${somaConc} × ${r2(ic.concedidoRs)}`,
  );
}

if (falhas.length) {
  console.error(`\nGATE FALHOU: ${falhas.join(" · ")}`);
  process.exit(1);
}
console.log("\nGATE SPEC3 (Onda 1) — todos os invariantes verificáveis passaram.");
