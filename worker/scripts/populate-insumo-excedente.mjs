// Popula obra_insumo_excedente + _params (BR-101) a partir do payload do splitter python
// (/tmp/insumo_excedente_payload.json via build_insumo_excedente_payload). One-off · idempotente.
// Pendentes de índice chegam NULL (o 0 da planilha é default de fórmula · PENDENTE≠0); o repasse
// EFETIVO em R$ (qtde da NF, mês a mês) é input futuro.
//
// Uso (de dentro de worker/):
//   cd agent && venv/bin/python -m agents.normalizacao.build_insumo_excedente_payload
//   SUPABASE_DB_URL='postgresql://…@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/populate-insumo-excedente.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "fe288319-ff4f-4564-a459-139dfb021265"; // BR-101 Macaé (Aterpa)
const p = JSON.parse(readFileSync("/tmp/insumo_excedente_payload.json", "utf8"));
if (p.status !== "ok" || p.gate !== "ok")
  throw new Error(`payload não-ok: status=${p.status} gate=${p.gate}`);

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// 1 · anchor: sibling do cronograma existente (mesmo arquivo/versão/config do workbook-motor).
const arq = await c.query(
  `select arquivo_id, extracao_version, config_version
   from obra_cronogramas where contrato_id = $1 order by created_at desc limit 1`,
  [CONTRATO],
);
if (arq.rows.length !== 1)
  throw new Error(`cronograma não encontrado p/ ${CONTRATO} (rode o workbook-motor primeiro)`);
const { arquivo_id: arquivoId, extracao_version: version, config_version: CFG_VER } = arq.rows[0];
console.log(`sibling do cronograma: arquivo=${arquivoId} · v=${version} · cfg=${CFG_VER}`);

// 2 · idempotente
await c.query(
  `delete from obra_insumo_excedente where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);
await c.query(
  `delete from obra_insumo_excedente_params where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · header (params/consolidação)
const pr = p.params ?? {};
await c.query(
  `insert into obra_insumo_excedente_params (contrato_id, arquivo_id, extracao_version,
     config_version, data_base, normativa, metodo_ativo, snapshot_label, teto_snapshot_pct,
     total_delta_rs, insumos_acima_teto, pct_sobre_pv, reajuste_pago_acum_rs, farol)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
  [
    CONTRATO,
    arquivoId,
    version,
    CFG_VER,
    pr.databaseorcamento ?? null,
    pr.normativaaplicavel ?? null,
    pr.metodoativo ?? null,
    p.snapshot_label ?? null,
    // teto do snapshot = teto comum das linhas com índice (gate garante uniformidade do snapshot)
    p.insumos.find((i) => i.teto_ipca_pct != null)?.teto_ipca_pct ?? null,
    pr.excedenterepassavel88 ?? null,
    pr.insumosacimadoteto ?? null,
    pr.pctsobrepv ?? null,
    pr.reajustecontratualjapagoacum ?? null,
    typeof pr.farol === "string" ? pr.farol.replace("●", "").trim() : null,
  ],
);

// 4 · linhas (lote único · 17 cols)
const COLS = 17;
const vals = p.insumos.map((_, j) => {
  const o = j * COLS;
  return `(${Array.from({ length: COLS }, (_, i) => `$${o + i + 1}`).join(",")})`;
});
const params = [];
for (const i of p.insumos)
  params.push(
    CONTRATO,
    arquivoId,
    version,
    CFG_VER,
    i.ordem,
    i.insumo,
    i.classe_abc ?? null,
    i.qtd_orcada ?? null,
    i.preco_orcado_rs ?? null,
    i.preco_ref_real_rs ?? null,
    i.delta_real_pct ?? null,
    i.teto_ipca_pct ?? null,
    i.excedente_pct ?? null,
    i.delta_rs ?? null,
    i.farol ?? null,
    i.indice_pendente,
    p.snapshot_label ?? null,
  );
await c.query(
  `insert into obra_insumo_excedente (contrato_id, arquivo_id, extracao_version, config_version,
     ordem, insumo, classe_abc, qtd_orcada, preco_orcado_rs, preco_ref_real_rs, delta_real_pct,
     teto_ipca_pct, excedente_pct, delta_rs, farol, indice_pendente, snapshot_label)
   values ${vals.join(",")}`,
  params,
);
console.log(
  `inseridos ${p.insumos.length} insumos relevantes + 1 header (snapshot ${p.snapshot_label})`,
);

// 5 · conferência: Σ Δ R$ == header == 114.654,68 · 4 acima do teto · pendentes NULL
const chk = await c.query(
  `select count(*) n, sum(delta_rs) soma,
          count(*) filter (where excedente_pct > 0) acima,
          count(*) filter (where indice_pendente) pendentes,
          count(*) filter (where indice_pendente and delta_rs is not null) pendente_com_rs,
          (select total_delta_rs from obra_insumo_excedente_params where contrato_id=$1
             order by created_at desc limit 1) header_total
   from obra_insumo_excedente where contrato_id=$1`,
  [CONTRATO],
);
console.log("banco · excedente 8.8:", JSON.stringify(chk.rows[0]));
await c.end();
