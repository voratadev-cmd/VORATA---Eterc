// Gera a cirurgia de envelope dos Subcontratos (rótulos + Conclusão numérica) com pareamento
// validado célula a célula. Roda de dentro do clone Eterc: bun run /tmp/gen_subs_envelope.ts
import { readFileSync, writeFileSync } from "node:fs";
import { getSupabase } from "../../src/lib/supabase/client";

const sb = getSupabase();
const ID = "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const ref = JSON.parse(readFileSync("/tmp/subs_labels.json", "utf8"));
const num = (v: unknown) => (v == null ? 0 : Number(v));

const { data: m } = await sb
  .from("obra_secoes")
  .select("titulo, dados, colunas")
  .eq("contrato_id", ID)
  .ilike("titulo", "S — Subcontratados · Perda/Economia%")
  .limit(1);
const mestre = m![0].dados as Record<string, unknown>[];
if (mestre.length !== ref.mestre.length) throw new Error("n mestre difere");
for (let i = 0; i < mestre.length; i++) {
  const a = num(mestre[i]["Valor Contratado Subempreiteiro"]);
  const b = num(ref.mestre[i].contratado);
  if (Math.abs(a - b) > 0.02) throw new Error(`pareamento mestre linha ${i}: ${a} != ${b}`);
  mestre[i]["Disciplina"] = ref.mestre[i].disciplina;
  if (ref.mestre[i].conclusaoRs != null) mestre[i]["Conclusão (R$)"] = ref.mestre[i].conclusaoRs;
}
const colsM = [
  ...new Set(["Disciplina", ...((m![0].colunas as string[]) ?? []), "Conclusão (R$)"]),
];

const { data: f } = await sb
  .from("obra_secoes")
  .select("titulo, dados, colunas")
  .eq("contrato_id", ID)
  .ilike("titulo", "S — Subcontratados × PSQ por frente%")
  .limit(1);
const frentes = f![0].dados as Record<string, unknown>[];
if (frentes.length !== ref.frentes.length) throw new Error("n frentes difere");
for (let i = 0; i < frentes.length; i++) {
  const a = num(frentes[i]["Valor Contratado Subempreiteiro"]);
  const b = num(ref.frentes[i].contratado);
  const p = num(frentes[i]["PSQ"]);
  const q = num(ref.frentes[i].psq);
  if (Math.abs(a - b) > 0.02 || Math.abs(p - q) > 0.02)
    throw new Error(`pareamento frente linha ${i}`);
  frentes[i]["Frente"] = ref.frentes[i].frente;
}
const colsF = ["Frente", ...((f![0].colunas as string[]) ?? [])];

const esc = (s: string) => s.replace(/'/g, "''");
const sql = [
  "-- Subcontratos · cirurgia de envelope: rótulos (Disciplina/Frente) + Conclusão (R$) numérica.",
  "-- Colunas sem cabeçalho no Excel (D e AC) que a captura pré-col_N dropou; valores conferidos",
  "-- célula a célula contra S_SUBCONTRATADOS (pareamento por Valor Contratado; Σ Conclusão = 9.952.514,48).",
  `update obra_secoes set dados = '${esc(JSON.stringify(mestre))}'::jsonb, colunas = '${esc(JSON.stringify(colsM))}'::jsonb`,
  `where contrato_id = '${ID}' and titulo ilike 'S — Subcontratados · Perda/Economia%';`,
  `update obra_secoes set dados = '${esc(JSON.stringify(frentes))}'::jsonb, colunas = '${esc(JSON.stringify(colsF))}'::jsonb`,
  `where contrato_id = '${ID}' and titulo ilike 'S — Subcontratados × PSQ por frente%';`,
  "",
].join("\n");
writeFileSync("/tmp/subs_envelope.sql", sql);
console.log("SQL gerado ·", sql.length, "bytes · pareamento 9+6 OK");
