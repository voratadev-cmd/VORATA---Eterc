import { getSupabase } from "../../src/lib/supabase/client";
const supabase = getSupabase();
const ID = "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const { data } = await supabase
  .from("obra_faturamento_serie_mes")
  .select("dimensao, item, mes_num, previsto_rs, real_rs")
  .eq("contrato_id", ID)
  .eq("dimensao", "disciplina");
const acum: Record<string, { real: number; prev: number }> = {};
for (const r of (data ?? []) as Record<string, number | string>[]) {
  if (r.mes_num > 9) continue;
  acum[r.item] ??= { real: 0, prev: 0 };
  acum[r.item].real += r.real_rs ?? 0;
  acum[r.item].prev += r.previsto_rs ?? 0;
}
let tot = 0,
  totPrev = 0;
for (const [k, v] of Object.entries(acum)) {
  tot += v.real;
  totPrev += v.prev;
  const ader = v.prev > 0 ? Math.round((v.real / v.prev) * 1000) / 10 : null;
  console.log(
    k.slice(0, 44),
    "→ real:",
    Math.round(v.real * 100) / 100,
    "· prev:",
    Math.round(v.prev * 100) / 100,
    "· ader%:",
    ader,
  );
}
console.log(
  "Σ real:",
  Math.round(tot * 100) / 100,
  "· Σ prev:",
  Math.round(totPrev * 100) / 100,
  "· ader TOTAL%:",
  Math.round((tot / totPrev) * 1000) / 10,
);
