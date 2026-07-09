// Re-normaliza o REAL ALOCADO do D.4 Valor Agregado de uma obra para o escopo CHEIO (= histograma
// C.4, apoio incluído), corrigindo o desvio do resumo do workbook que traz o real de PRODUÇÃO
// (corta o equipamento de apoio). "Regra de ouro": o real do VA é a MESMA fonte da C.4 Recursos.
//   EQP real: 6.791.408 (produção) → 6.927.696 (cheio · = obra_recursos_meses EQP real_rs)
//   perda TOTAL: 6.702.675 → 6.838.963 ; MOD não muda (887.471, sem apoio).
// va_medido (earned value) é preservado; perda = real_cheio − va_medido; pct = perda / PV.
//
// Uso (de worker/): SUPABASE_DB_URL='postgresql://...pooler...:5432/postgres' \
//   node scripts/renorm-valoragregado.mjs <contrato_id>

import pg from "pg";

const contrato = process.argv[2];
if (!contrato) {
  console.error("uso: node scripts/renorm-valoragregado.mjs <contrato_id>");
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("defina SUPABASE_DB_URL (pooler IPv4).");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  // 1) histograma C.4 CHEIO: Σ real_rs por categoria (MOD/EQP) + por mês
  const hist = (
    await c.query(
      `select categoria, ano, mes, real_rs from public.obra_recursos_meses
       where contrato_id=$1 and categoria in ('MOD','EQP') order by ano,mes`,
      [contrato],
    )
  ).rows;
  if (!hist.length) throw new Error("sem histograma C.4 (obra_recursos_meses) para a obra.");
  const cheio = { MOD: 0, EQP: 0 };
  const cheioMes = new Map(); // `${ano}-${mes}` -> {MOD, EQP}
  for (const r of hist) {
    const v = Number(r.real_rs) || 0;
    cheio[r.categoria] += v;
    const k = `${r.ano}-${r.mes}`;
    const m = cheioMes.get(k) || { MOD: 0, EQP: 0 };
    m[r.categoria] += v;
    cheioMes.set(k, m);
  }

  // 2) estado atual do VA (preserva va_medido; deriva PV da razão perda/pct do TOTAL)
  const cats = (
    await c.query(
      `select categoria, va_medido_rs, real_alocado_rs, perda_rs, pct_pv from public.obra_valor_agregado where contrato_id=$1`,
      [contrato],
    )
  ).rows;
  if (!cats.length) throw new Error("sem obra_valor_agregado para a obra.");
  const byCat = Object.fromEntries(cats.map((r) => [r.categoria, r]));
  const tot0 = byCat.TOTAL;
  const pv = tot0 && Number(tot0.pct_pv) ? Number(tot0.perda_rs) / Number(tot0.pct_pv) : null; // ex.: 611,4mi
  if (!pv) throw new Error("não consegui derivar o PV (TOTAL.pct_pv/perda ausente).");

  // 3) novos valores: real = cheio · perda = real − va_medido · pct = perda / PV
  const vaMed = (cat) => Number(byCat[cat]?.va_medido_rs ?? 0);
  const real = { MOD: cheio.MOD, EQP: cheio.EQP };
  real.TOTAL = real.MOD + real.EQP;
  const upd = {};
  for (const cat of ["MOD", "EQP", "TOTAL"]) {
    const perda = real[cat] - vaMed(cat);
    upd[cat] = { real: real[cat], perda, pct: perda / pv };
  }

  for (const cat of ["MOD", "EQP", "TOTAL"]) {
    await c.query(
      `update public.obra_valor_agregado set real_alocado_rs=$2, perda_rs=$3, pct_pv=$4
       where contrato_id=$1 and categoria=$5`,
      [contrato, upd[cat].real, upd[cat].perda, upd[cat].pct, cat],
    );
  }

  // 4) série mensal: real por mês = histograma cheio (MOD/EQP). va_* preservado.
  const meses = (
    await c.query(
      `select ano, mes, real_mod_rs, real_eqp_rs from public.obra_valor_agregado_mes where contrato_id=$1`,
      [contrato],
    )
  ).rows;
  let nMes = 0;
  for (const m of meses) {
    const k = `${m.ano}-${m.mes}`;
    const cm = cheioMes.get(k);
    if (!cm) continue;
    await c.query(
      `update public.obra_valor_agregado_mes set real_mod_rs=$3, real_eqp_rs=$4 where contrato_id=$1 and ano=$2 and mes=$5`,
      [contrato, m.ano, cm.MOD, cm.EQP, m.mes],
    );
    nMes++;
  }

  const f = (n) => Math.round(n).toLocaleString("pt-BR");
  console.log(`OK · D.4 VA re-normalizado p/ real CHEIO (contrato ${contrato.slice(0, 8)})`);
  console.log(
    `   EQP real ${f(byCat.EQP.real_alocado_rs)} → ${f(upd.EQP.real)} | perda TOTAL ${f(byCat.TOTAL.perda_rs)} → ${f(upd.TOTAL.perda)} | pct ${(upd.TOTAL.pct * 100).toFixed(2)}% | ${nMes} meses`,
  );
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await c.end();
}
