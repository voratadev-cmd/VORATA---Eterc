// Validação LINHA A LINHA da Central de Subcontratos vs o Excel (/tmp/subs_rowcheck.json).
// Complementa o gate de âncoras (totais): aqui cada célula exibida é conferida com a fonte.
import { readFileSync } from "node:fs";
import { getSubcontratos } from "../../src/lib/supabase/subcontratos";

const ID = process.argv[2] ?? "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const ref = JSON.parse(readFileSync("/tmp/subs_rowcheck.json", "utf8"));
const d = (await getSubcontratos(ID))!;
let falhas = 0;
let checks = 0;
const eq = (a: number | null, b: unknown, rot: string) => {
  checks++;
  const bb = b == null || b === "None" ? null : Number(b);
  const pass =
    (a == null && (bb == null || bb === 0)) || (a != null && bb != null && Math.abs(a - bb) < 0.51);
  if (!pass) {
    falhas++;
    console.log(`✗ ${rot}: tela=${a} excel=${bb}`);
  }
};

d.mestre.forEach((m, i) => {
  const r = ref.mestre[i];
  eq(m.contratado, r.contratado, `mestre[${i + 1}].contratado`);
  eq(m.valorPsq, r.valorPsq, `mestre[${i + 1}].valorPsq`);
  eq(m.psqItemSubc, r.psqItem, `mestre[${i + 1}].psqItem`);
  eq(m.economiaJa, r.economia, `mestre[${i + 1}].economia`);
  eq(m.saldoExecutar, r.saldo, `mestre[${i + 1}].saldo`);
  eq(m.previstoSubc, r.previsto, `mestre[${i + 1}].previsto`);
  eq(m.potencialFuturo, r.potencial, `mestre[${i + 1}].potencial`);
  eq(m.conclusaoRs, r.conclusao, `mestre[${i + 1}].conclusão`);
});
d.medicao.forEach((m, i) => {
  const r = ref.med[i];
  eq(m.totalContrato, r.total, `med[${i + 1}].total`);
  eq(m.medidoSub, r.medido, `med[${i + 1}].medido`);
  eq(m.saldoMedicao, r.saldo, `med[${i + 1}].saldo`);
  eq(m.medidoBm04, r.bm04, `med[${i + 1}].bm04`);
  eq(m.saldoPsq, r.saldoPsq, `med[${i + 1}].saldoPsq`);
  eq(m.potencialLiberado, r.potencial, `med[${i + 1}].potencial`);
});
const porCt = new Map(d.contratos.map((x) => [x.numContrato, x]));
for (const r of ref.cts) {
  const x = porCt.get(String(r.ct));
  checks++;
  if (!x) {
    falhas++;
    console.log(`✗ CT ${r.ct} ausente na tela`);
    continue;
  }
  eq(x.contratado, r.valor, `${r.ct}.contratado`);
  eq(x.medido, r.medido, `${r.ct}.medido`);
  eq(x.saldo, r.saldo, `${r.ct}.saldo`);
}
d.frentes.forEach((f, i) => {
  eq(f.contratado, ref.frentes[i].contratado, `frente[${i + 1}].contratado`);
  eq(f.psq, ref.frentes[i].psq, `frente[${i + 1}].psq`);
});

console.log(`${checks} células conferidas · ${falhas} divergências`);
process.exit(falhas ? 1 : 0);
