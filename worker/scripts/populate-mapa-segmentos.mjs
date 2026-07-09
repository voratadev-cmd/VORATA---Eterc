// Popula obra_mapa_segmentos (BR-101) a partir do payload do splitter python
// (/tmp/mapa_segmentos_payload.json via build_mapa_segmentos_payload). One-off · idempotente.
// Status/Liberado/Impedido vêm da planilha JÁ conferidos pelo gate (derivação de mês lib. real +
// janela de impedimento + BM, ao centavo); causa do impedimento é input da obra.
//
// Uso (de dentro de worker/):
//   cd agent && venv/bin/python -m agents.normalizacao.build_mapa_segmentos_payload
//   SUPABASE_DB_URL='postgresql://…@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/populate-mapa-segmentos.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "fe288319-ff4f-4564-a459-139dfb021265"; // BR-101 Macaé (Aterpa)
const p = JSON.parse(readFileSync("/tmp/mapa_segmentos_payload.json", "utf8"));
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
  `delete from obra_mapa_segmentos where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · segmentos (lote único · 20 cols)
const COLS = 20;
const vals = p.segmentos.map((_, j) => {
  const o = j * COLS;
  return `(${Array.from({ length: COLS }, (_, i) => `$${o + i + 1}`).join(",")})`;
});
const params = [];
for (const s of p.segmentos)
  params.push(
    CONTRATO,
    arquivoId,
    version,
    CFG_VER,
    s.ordem,
    s.seg_codigo,
    s.item_nome,
    s.tipo,
    s.km_inicio,
    s.km_fim,
    s.mes_lib_prevista ?? null,
    s.mes_lib_real ?? null,
    s.imped_mes_inicio ?? null,
    s.imped_mes_fim ?? null,
    s.valor_contrato_rs,
    p.bm_corrente ?? null,
    s.status_bm ?? null,
    s.liberado_rs ?? null,
    s.impedido_rs ?? null,
    s.causa_impedimento ?? null,
  );
await c.query(
  `insert into obra_mapa_segmentos (contrato_id, arquivo_id, extracao_version, config_version, ordem,
     seg_codigo, item_nome, tipo, km_inicio, km_fim, mes_lib_prevista, mes_lib_real,
     imped_mes_inicio, imped_mes_fim, valor_contrato_rs, bm_corrente, status_bm, liberado_rs,
     impedido_rs, causa_impedimento) values ${vals.join(",")}`,
  params,
);
console.log(`inseridos ${p.segmentos.length} segmentos (BM ${p.bm_corrente})`);

// 4 · conferência no banco: Σ duplicação == Contratado Total · Σ liberado/impedido · sinistros c/ causa
const chk = await c.query(
  `select count(*) n, count(*) filter (where tipo='sinistro') n_sinistros,
          sum(valor_contrato_rs) filter (where tipo='duplicacao') soma_duplicacao,
          sum(liberado_rs) soma_liberado, sum(impedido_rs) soma_impedido,
          count(*) filter (where tipo='sinistro' and causa_impedimento is null) sinistro_sem_causa
   from obra_mapa_segmentos where contrato_id=$1`,
  [CONTRATO],
);
console.log("banco · mapa da obra:", JSON.stringify(chk.rows[0]));
await c.end();
