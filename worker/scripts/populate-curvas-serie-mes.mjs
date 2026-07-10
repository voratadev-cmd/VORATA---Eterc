// Popula obra_curvas_serie_mes (BR-101) a partir do payload do splitter python
// (/tmp/curvas_serie_mes_payload.json via build_curvas_serie_mes_payload). One-off · idempotente.
// Capacidade/Executado pós-BM já chegam NULL (carry da planilha cortado no resolver · PENDENTE≠0).
//
// Uso (de dentro de worker/):
//   cd agent && venv/bin/python -m agents.normalizacao.build_curvas_serie_mes_payload
//   SUPABASE_DB_URL='postgresql://…@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/populate-curvas-serie-mes.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "fe288319-ff4f-4564-a459-139dfb021265"; // BR-101 Macaé (Aterpa)
const p = JSON.parse(readFileSync("/tmp/curvas_serie_mes_payload.json", "utf8"));
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
if (p.config_version && p.config_version !== CFG_VER)
  console.warn(
    `AVISO: config do payload (${p.config_version}) ≠ config do sibling (${CFG_VER}) — confira se o envelope é o mesmo`,
  );

// 2 · idempotente
await c.query(
  `delete from obra_curvas_serie_mes where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · meses (lote único · 13 cols)
const COLS = 13;
const vals = p.meses.map((_, j) => {
  const o = j * COLS;
  return `(${Array.from({ length: COLS }, (_, i) => `$${o + i + 1}`).join(",")})`;
});
const params = [];
for (const m of p.meses)
  params.push(
    CONTRATO,
    arquivoId,
    version,
    CFG_VER,
    m.ordem,
    m.mes_num,
    m.periodo_label ?? null,
    m.contratado_acum_rs ?? null,
    m.liberado_acum_rs ?? null,
    m.capacidade_acum_rs ?? null,
    m.executado_acum_rs ?? null,
    m.previsto_servicos_rs ?? null,
    p.bm_corrente ?? null,
  );
await c.query(
  `insert into obra_curvas_serie_mes (contrato_id, arquivo_id, extracao_version, config_version,
     ordem, mes_num, periodo_label, contratado_acum_rs, liberado_acum_rs, capacidade_acum_rs,
     executado_acum_rs, previsto_servicos_rs, bm_corrente) values ${vals.join(",")}`,
  params,
);
console.log(`inseridos ${p.meses.length} meses (BM ${p.bm_corrente})`);

// 4 · conferência: corte == cards C.8 · fim == Contratado Total · carry pós-BM NULL · Σ serviços
const chk = await c.query(
  `select count(*) n,
          max(contratado_acum_rs) filter (where mes_num=4) m04_contratado,
          max(capacidade_acum_rs) filter (where mes_num=4) m04_capacidade,
          max(executado_acum_rs)  filter (where mes_num=4) m04_executado,
          max(contratado_acum_rs) fim_contratado,
          count(*) filter (where mes_num>4 and (capacidade_acum_rs is not null or executado_acum_rs is not null)) carry_pos_bm,
          sum(previsto_servicos_rs) soma_servicos
   from obra_curvas_serie_mes where contrato_id=$1`,
  [CONTRATO],
);
console.log("banco · série das curvas:", JSON.stringify(chk.rows[0]));
await c.end();
