// Layer 1 — banco vs mockup C14 (campo a campo). Mockup = fonte da verdade (D object).
import pg from "pg";

// referência do mockup C14_MapaObra (D object) — frente por nome → {km (kmInicio p/ pontual), valor}
const MOCK_FRENTES = {
  "Trecho 01": { ki: 144.6, kf: 156.4, valor: 74997580 },
  "Trecho 02": { ki: 156.4, kf: 162.08, valor: 66677194 },
  "Trecho 03": { ki: 162.08, kf: 177.0, valor: 63743665 },
  "Duplicação 177–183,7": { ki: 177.0, kf: 183.7, valor: 41394792 },
  "Duplicação 183,7–190,3": { ki: 183.7, kf: 190.3, valor: 46073582 },
  "OAE Rio dos Quarenta": { ki: 144.805, valor: 2680807 },
  "Alargamento OAE Quarenta": { ki: 144.8, valor: 2459739 },
  "OAE Rio Aduelas": { ki: 157.5, valor: 7447573 },
  "OAE Rio São Pedro": { ki: 159.0, valor: 10154902 },
  "OAE Rio Macaé": { ki: 161.1, valor: 10421406 },
  "Dispositivo KM 152": { ki: 152.2, valor: 11879873 },
  "Dispositivo KM 162": { ki: 162.2, valor: 10115795 },
  "Dispositivo KM 175": { ki: 175.76, valor: 9610918 },
  "Dispositivo Rocha Leão": { ki: 181.5, valor: 15851606 },
  "Recuperação de Taludes": { ki: 148.7, valor: 6516330 },
  "Pré-Furo Geodreno": { ki: 144.6, valor: 1547653 },
};
const MOCK_TRANSV = {
  "Administração Local": 132965428,
  "Materiais Faturamento Direto": 96818471,
};
const MOCK_SOMA_FISICA = 381573415;
const MOCK_SOMA_TRANSV = 229783899;
const MOCK_PV = 611357314;

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const obraId = (await c.query("select id from obras where id::text like 'fe288319%' limit 1"))
  .rows[0].id;

let pass = 0;
let fail = 0;
const ck = (name, got, exp, tol = 0.0001) => {
  const ok = typeof exp === "number" ? Math.abs(Number(got) - exp) <= tol : got === exp;
  if (ok) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}: got ${got} ≠ exp ${exp}`);
  }
};

const seg = (
  await c.query(
    "select item_nome, km_inicio, valor_contrato_rs from obra_mapa_segmentos where contrato_id=$1 order by ordem",
    [obraId],
  )
).rows;

ck("nº frentes = 16", seg.length, 16);
for (const r of seg) {
  const m = MOCK_FRENTES[r.item_nome];
  if (!m) {
    fail++;
    console.log(`  ✗ frente desconhecida no banco: "${r.item_nome}"`);
    continue;
  }
  ck(`${r.item_nome} · kmInicio`, Number(r.km_inicio), m.ki, 0.001);
  ck(`${r.item_nome} · valor`, Number(r.valor_contrato_rs), m.valor);
}
// toda frente do mockup existe no banco?
for (const nome of Object.keys(MOCK_FRENTES)) {
  if (!seg.find((r) => r.item_nome === nome)) {
    fail++;
    console.log(`  ✗ frente do mockup ausente no banco: "${nome}"`);
  }
}

const tr = (
  await c.query(
    "select dados from obra_secoes where contrato_id=$1 and titulo like '%C.14%Itens transversais%'",
    [obraId],
  )
).rows[0].dados;
ck("nº transversais = 2", tr.length, 2);
for (const t of tr) ck(`transversal ${t.Item}`, Number(t["Valor (R$)"]), MOCK_TRANSV[t.Item]);

const somaFis = seg.reduce((a, r) => a + Number(r.valor_contrato_rs), 0);
const somaTr = tr.reduce((a, t) => a + Number(t["Valor (R$)"]), 0);
ck("Σ físicas = 381.573.415", somaFis, MOCK_SOMA_FISICA);
ck("Σ transversais = 229.783.899", somaTr, MOCK_SOMA_TRANSV);
ck("PV = 611.357.314", somaFis + somaTr, MOCK_PV);

console.log(`\nLayer 1 (banco vs mockup): ${pass} ✓ · ${fail} ✗`);
await c.end();
process.exit(fail ? 1 : 0);
