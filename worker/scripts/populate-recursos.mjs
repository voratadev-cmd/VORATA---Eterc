// Popula obra_recursos + obra_recursos_meses (BR-101) a partir do payload já computado pelo
// splitter python (/tmp/recursos_payload.json via build_recursos_payload). One-off: o worker
// auto-processa uploads futuros (rota C.4 já wirada em workbook_motor.py). Idempotente.
//
// Uso (de dentro de worker/, com pg instalado):
//   cd agent && venv/bin/python -m agents.normalizacao.build_recursos_payload
//   SUPABASE_DB_URL='postgresql://…@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/populate-recursos.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "f9248790-cd04-48ed-b660-3d8a9fdc524c"; // BR101 Aterpa
const p = JSON.parse(readFileSync("/tmp/recursos_payload.json", "utf8"));
if (p.status !== "ok" || p.gate !== "ok")
  throw new Error(`payload não-ok: status=${p.status} gate=${p.gate}`);
const CFG_VER = p.config_version;

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// 1 · o workbook-motor da obra + última versão de extração
const arq = await c.query(
  `select a.id, max(e.version) as version
   from obra_arquivos a join obra_arquivo_extracoes e on e.arquivo_id = a.id
   where a.obra_id = $1 and e.doc_type ilike '%workbook%'
   group by a.id`,
  [CONTRATO],
);
if (arq.rows.length !== 1) throw new Error(`esperava 1 workbook-motor, achei ${arq.rows.length}`);
const { id: arquivoId, version } = arq.rows[0];
console.log(`workbook-motor: ${arquivoId} · extracao_version=${version} · cfg=${CFG_VER}`);

// 2 · idempotente: apaga a contribuição anterior
await c.query(
  `delete from obra_recursos_meses where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);
await c.query(
  `delete from obra_recursos where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · itens (lotes via multi-row insert · 10 cols)
const base = [CONTRATO, arquivoId, version, CFG_VER];
let ni = 0;
for (let k = 0; k < p.itens.length; k += 200) {
  const chunk = p.itens.slice(k, k + 200);
  const vals = chunk.map((_, j) => {
    const o = j * 11;
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11})`;
  });
  const params = [];
  for (const i of chunk)
    params.push(
      CONTRATO,
      arquivoId,
      version,
      CFG_VER,
      i.categoria,
      i.recurso,
      i.ordem,
      i.contratado_qtde ?? null,
      i.real_qtde ?? null,
      i.contratado_rs ?? null,
      i.real_rs ?? null,
    );
  await c.query(
    `insert into obra_recursos (contrato_id, arquivo_id, extracao_version, config_version, categoria, recurso, ordem, contratado_qtde, real_qtde, contratado_rs, real_rs) values ${vals.join(",")}`,
    params,
  );
  ni += chunk.length;
}
console.log(`inseridos ${ni} itens (status='ok' default)`);

// 4 · meses (lotes · 12 cols)
let nm = 0;
for (let k = 0; k < p.meses.length; k += 200) {
  const chunk = p.meses.slice(k, k + 200);
  const vals = chunk.map((_, j) => {
    const o = j * 12;
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12})`;
  });
  const params = [];
  for (const m of chunk)
    params.push(
      CONTRATO,
      arquivoId,
      version,
      CFG_VER,
      m.categoria,
      m.ano,
      m.mes,
      m.periodo_label ?? null,
      m.contratado_qtde ?? null,
      m.real_qtde ?? null,
      m.contratado_rs ?? null,
      m.real_rs ?? null,
    );
  await c.query(
    `insert into obra_recursos_meses (contrato_id, arquivo_id, extracao_version, config_version, categoria, ano, mes, periodo_label, contratado_qtde, real_qtde, contratado_rs, real_rs) values ${vals.join(",")}`,
    params,
  );
  nm += chunk.length;
}
console.log(`inseridas ${nm} linhas-mês`);

// 5 · conferência por valor no banco (Σ contratado por categoria)
const chk = await c.query(
  `select categoria, count(*) n,
          round(sum(contratado_qtde)::numeric,2) soma_q,
          round(sum(contratado_rs)::numeric,2) soma_rs
   from obra_recursos where contrato_id=$1 group by categoria order by categoria`,
  [CONTRATO],
);
console.log("banco · itens por categoria:");
for (const r of chk.rows)
  console.log("  ", r.categoria, "n=" + r.n, "Σq=" + r.soma_q, "ΣR$=" + r.soma_rs);
await c.end();
