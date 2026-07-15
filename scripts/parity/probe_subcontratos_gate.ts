// GATE da Central de Subcontratos — TODAS as âncoras de validação da spec (sai !=0 em divergência).
// bun run scripts/parity/probe_subcontratos_gate.ts [obra_id]
import { getSubcontratos } from "../../src/lib/supabase/subcontratos";

const ID = process.argv[2] ?? "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const falhas: string[] = [];
const ok = (nome: string, got: number | null, want: number, tol = 1) => {
  const pass = got != null && Math.abs(got - want) <= tol;
  console.log(`${pass ? "✓" : "✗"} ${nome} — ${got != null ? Math.round(got) : "null"} × ${want}`);
  if (!pass) falhas.push(nome);
};

const d = await getSubcontratos(ID);
if (!d) {
  console.error("read-model null");
  process.exit(1);
}

// Bloco 2 — tabela mestra (Total)
ok("mestre contratado", d.tot.contratado, 13374922);
ok("mestre valor PSQ", d.tot.valorPsq, 42642917);
ok("mestre PSQ item subc", d.tot.psqItemSubc, 26774043);
ok("mestre economia já", d.tot.economiaJa, 12525175);
ok("mestre saldo a executar", d.tot.saldoExecutar, 15868874);
ok("mestre previsto p/ subc", d.tot.previstoSubc, 18375641);
ok("mestre potencial futuro", d.tot.potencialFuturo, -814852);
ok("mestre conclusão (ganho projetado)", d.tot.conclusaoRs, 9952514);

// Bloco 5 — farol de contratos
ok("contratos n", d.contratos.length, 20, 0);
ok("contratos contratado", d.contratosTot.contratado, 13374922);
ok("contratos medido", d.contratosTot.medido, 3031866);
ok("contratos saldo", d.contratosTot.saldo, 10343056);
ok("contratos %med", d.contratosTot.pctMed, 22.7, 0.05);
ok("faróis críticos", d.criticos, 3, 0);

// Bloco 6 — medido por disciplina (agregação da Lista)
const disc = (frag: string) =>
  d.porDisciplina.find((x) => x.disciplina.toUpperCase().includes(frag))?.medido ?? null;
ok("disc Gerenciamento medido", disc("GERENCIAMENTO"), 712532);
ok("disc Projetos medido", disc("PROJETOS"), 373000);
ok("disc Arquitetura medido", disc("ARQUITETURA - OBRA"), 801633);
ok("disc Fundações medido", disc("FUNDA"), 1144701);
ok("disc Mecânicos medido", disc("MECÂNICOS"), 0, 0);

// Bloco 7 — acompanhamento (Total) · ponte com o RMA
const t = d.medicaoTot;
ok("medição contrato subs", t?.totalContrato ?? null, 13374922);
ok("medição medido subs", t?.medidoSub ?? null, 3031866);
ok("medição saldo a medir", t?.saldoMedicao ?? null, 10343056);
ok("medição Medido BM04 == RMA", t?.medidoBm04 ?? null, 10219923);
ok("medição saldo PSQ", t?.saldoPsq ?? null, 29546077);
ok("medição potencial liberado", t?.potencialLiberado ?? null, 14258859);

// Bloco 9 — edificação
const fr = (nome: string) => d.frentes.find((x) => x.frente === nome);
ok("frente Geral contratado", fr("Geral")?.contratado ?? null, 1907322);
ok("frente TPS contratado", fr("TPS")?.contratado ?? null, 9263291);
ok("frente Subestação contratado", fr("Subestação")?.contratado ?? null, 239556);
ok(
  "frentes Σ contratado",
  d.frentes.reduce((s, x) => s + (x.contratado ?? 0), 0),
  13374922,
);
ok(
  "frentes Σ PSQ",
  d.frentes.reduce((s, x) => s + (x.psq ?? 0), 0),
  39776000,
);

// Rótulos presentes (guarda de pareamento não pode ter desabilitado nenhum)
ok("mestre rótulos vivos", d.mestre.filter((m) => m.disciplina).length, 9, 0);
ok("frentes rótulos vivos", d.frentes.filter((f) => f.frente).length, 6, 0);
ok("drill disciplinas c/ itens", d.drill.size, 0, 99); // informativo (>=0)

if (falhas.length) {
  console.error(`\nGATE SUBCONTRATOS FALHOU: ${falhas.join(" · ")}`);
  process.exit(1);
}
console.log("\nGATE SUBCONTRATOS — todas as âncoras da spec passaram.");
