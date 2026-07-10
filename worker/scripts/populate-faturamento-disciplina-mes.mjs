// Popula obra_faturamento_disciplina_mes (BR-101) a partir do payload do splitter python
// (/tmp/faturamento_matriz_payload.json via build_faturamento_matriz_payload). One-off · idempotente.
// REAL é input do RDO → real_rs/deficit_rs NULL (default real_pendente=true); nunca 0 fabricado.
//
// Uso (de dentro de worker/):
//   cd agent && venv/bin/python -m agents.normalizacao.build_faturamento_matriz_payload
//   SUPABASE_DB_URL='postgresql://…@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/populate-faturamento-disciplina-mes.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "fe288319-ff4f-4564-a459-139dfb021265"; // BR-101 Macaé (Aterpa)
const p = JSON.parse(readFileSync("/tmp/faturamento_matriz_payload.json", "utf8"));
if (p.status !== "ok" || p.gate !== "ok")
  throw new Error(`payload não-ok: status=${p.status} gate=${p.gate}`);

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// 1 · anchor: a matriz vira SIBLING da curva de faturamento existente (mesmo arquivo/versão/config) —
// robusto às 2 extrações workbook-motor da obra e garante consistência com o resto do C.3.
const arq = await c.query(
  `select arquivo_id, extracao_version, config_version
   from obra_faturamento_curvas where contrato_id = $1 order by created_at desc limit 1`,
  [CONTRATO],
);
if (arq.rows.length !== 1)
  throw new Error(
    `curva de faturamento não encontrada p/ ${CONTRATO} (rode o workbook-motor primeiro)`,
  );
const { arquivo_id: arquivoId, extracao_version: version, config_version: CFG_VER } = arq.rows[0];
console.log(`sibling da curva: arquivo=${arquivoId} · v=${version} · cfg=${CFG_VER}`);

// 2 · idempotente: apaga a contribuição anterior
await c.query(
  `delete from obra_faturamento_disciplina_mes where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · linhas disciplina×mês (lotes · 12 cols · real/deficit NULL, real_pendente/status default)
let n = 0;
for (let k = 0; k < p.linhas.length; k += 200) {
  const chunk = p.linhas.slice(k, k + 200);
  const vals = chunk.map((_, j) => {
    const o = j * 12;
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12})`;
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
      l.ano ?? null,
      l.mes ?? null,
      l.previsto_rs ?? null,
      l.real_rs ?? null,
      l.deficit_rs ?? null,
    );
  await c.query(
    `insert into obra_faturamento_disciplina_mes (contrato_id, arquivo_id, extracao_version, config_version, ordem, disciplina, mes_num, ano, mes, previsto_rs, real_rs, deficit_rs) values ${vals.join(",")}`,
    params,
  );
  n += chunk.length;
}
console.log(`inseridas ${n} linhas (real/deficit NULL · real_pendente=true default)`);

// 4 · conferência no banco: n disciplinas · Σ previsto · acum até o mês 4 (== Contratado Acum)
const chk = await c.query(
  `select count(distinct disciplina) n_disc, count(*) n,
          round(sum(previsto_rs)::numeric, 2) soma,
          round(sum(previsto_rs) filter (where mes_num <= 4)::numeric, 2) acum4,
          count(*) filter (where real_rs is not null) n_real
   from obra_faturamento_disciplina_mes where contrato_id=$1`,
  [CONTRATO],
);
console.log("banco · matriz:", JSON.stringify(chk.rows[0]));
await c.end();
