// Popula obra_cronograma_frente_mes (BR-101) a partir do payload do splitter python
// (/tmp/cronograma_frente_mes_payload.json via build_cronograma_frente_mes_payload). One-off · idempotente.
// % real é input do RDO → real_pct NULL (default real_pendente=true); nunca 0 fabricado.
//
// Uso (de dentro de worker/):
//   cd agent && venv/bin/python -m agents.normalizacao.build_cronograma_frente_mes_payload
//   SUPABASE_DB_URL='postgresql://…@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/populate-cronograma-frente-mes.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "fe288319-ff4f-4564-a459-139dfb021265"; // BR-101 Macaé (Aterpa)
const p = JSON.parse(readFileSync("/tmp/cronograma_frente_mes_payload.json", "utf8"));
if (p.status !== "ok" || p.gate !== "ok")
  throw new Error(`payload não-ok: status=${p.status} gate=${p.gate}`);

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// 1 · anchor: sibling da curva física global existente (mesmo arquivo/versão/config do cronograma).
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
  `delete from obra_cronograma_frente_mes where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · linhas disciplina×mês (lotes · 8 cols · real_pct NULL, real_pendente/status default)
let n = 0;
for (let k = 0; k < p.linhas.length; k += 200) {
  const chunk = p.linhas.slice(k, k + 200);
  const vals = chunk.map((_, j) => {
    const o = j * 8;
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8})`;
  });
  const params = [];
  for (const l of chunk)
    params.push(
      CONTRATO,
      arquivoId,
      version,
      CFG_VER,
      l.ordem,
      l.disciplina,
      l.mes_num,
      l.previsto_pct ?? null,
    );
  await c.query(
    `insert into obra_cronograma_frente_mes (contrato_id, arquivo_id, extracao_version, config_version, ordem, disciplina, mes_num, previsto_pct) values ${vals.join(",")}`,
    params,
  );
  n += chunk.length;
}
console.log(`inseridas ${n} linhas (real_pct NULL · real_pendente=true default)`);

// 4 · conferência no banco: n disciplinas · M04 de Terraplenagem/Mobilização (== 0,0504 / 0,795)
const chk = await c.query(
  `select count(distinct disciplina) n_disc, count(*) n,
          round(max(previsto_pct) filter (where disciplina ilike 'Terrapl%' and mes_num=4)::numeric, 4) terra_m04,
          round(max(previsto_pct) filter (where disciplina ilike 'Mobiliz%' and mes_num=4)::numeric, 4) mobil_m04,
          count(*) filter (where real_pct is not null) n_real
   from obra_cronograma_frente_mes where contrato_id=$1`,
  [CONTRATO],
);
console.log("banco · matriz física:", JSON.stringify(chk.rows[0]));
await c.end();
