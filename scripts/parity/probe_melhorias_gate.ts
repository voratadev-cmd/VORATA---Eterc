// GATE da C.15 Melhorias Documentais (dialeto SBSO) — âncoras da fonte; sai !=0 em divergência.
import { getMelhoriasSbso } from "../../src/lib/supabase/melhoriasSbso";

const ID = process.argv[2] ?? "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const falhas: string[] = [];
const ok = (nome: string, cond: boolean, det: string) => {
  console.log(`${cond ? "✓" : "✗"} ${nome} — ${det}`);
  if (!cond) falhas.push(nome);
};
const d = await getMelhoriasSbso(ID);
if (!d) {
  console.error("read-model null");
  process.exit(1);
}
ok("desvios n", d.desvios.length === 8, `${d.desvios.length} × 8`);
ok(
  "desvios críticos",
  d.desvios.filter((x) => /crít|crit/i.test(x.severidade ?? "")).length === 4,
  "4 críticos",
);
ok("defasagem n", d.defasagem.length === 9, `${d.defasagem.length} × 9`);
ok(
  "Σ defasagem == painel (7.191.278)",
  Math.abs(d.defasagemTot.defasagemRs - 7191278) <= 1,
  String(d.defasagemTot.defasagemRs),
);
ok(
  "Σ previsto == C.3 (17.411.200)",
  Math.abs(d.defasagemTot.previstoRs - 17411200) <= 1,
  String(d.defasagemTot.previstoRs),
);
ok(
  "Σ medido == BM04 (10.219.922)",
  Math.abs(d.defasagemTot.medidoRs - 10219922) <= 1,
  String(d.defasagemTot.medidoRs),
);
ok(
  "% medido == aderência C.3 (58,7%)",
  Math.abs((d.defasagemTot.pctMed ?? 0) * 100 - 58.697) < 0.05,
  `${((d.defasagemTot.pctMed ?? 0) * 100).toFixed(3)}%`,
);
ok("farol geral = Risco", /risco/i.test(d.painel.farolGeral ?? ""), d.painel.farolGeral ?? "—");
ok("achados presentes", (d.achadosTexto?.length ?? 0) > 3000, `${d.achadosTexto?.length} chars`);

if (falhas.length) {
  console.error(`\nGATE MELHORIAS FALHOU: ${falhas.join(" · ")}`);
  process.exit(1);
}
console.log("\nGATE MELHORIAS (C.15 SBSO) — todas as âncoras passaram.");
