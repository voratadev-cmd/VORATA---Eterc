// Sonda 3 — reproduz o bug "Por Disciplina" e confere o oráculo C.3 (SPEC 3).
import { getSupabase } from "../../src/lib/supabase/client";
import { getFaturamentoWbs } from "../../src/lib/supabase/faturamentoWbs";

const supabase = getSupabase();
const ID = "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";

const wbs = await getFaturamentoWbs(ID);
const out: Record<string, unknown> = {};
if (wbs) {
  out.disciplinas = wbs.disciplinas.map((d) => ({
    nome: d.nome,
    real: d.real,
    acum: d.acum,
    nFilhos: d.filhos?.length ?? 0,
    somaFilhosReal: d.filhos
      ? Math.round(d.filhos.reduce((s, f) => s + (f.real ?? 0), 0) * 100) / 100
      : null,
  }));
  out.totalRealDisciplinas =
    Math.round(wbs.disciplinas.reduce((s, d) => s + (d.real ?? 0), 0) * 100) / 100;
  out.frentes = wbs.frentes?.map((f) => ({ nome: f.nome, real: f.real })) ?? null;
}
const { data } = await supabase
  .from("obra_secoes")
  .select("titulo, dados")
  .eq("contrato_id", ID)
  .ilike("titulo", "C.3 — Resumo por Disciplina%")
  .limit(1);
out.oraculoC3 = data?.[0]?.dados ?? null;
console.log(JSON.stringify(out, null, 2));
