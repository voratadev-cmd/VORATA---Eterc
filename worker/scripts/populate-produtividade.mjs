// Popula obra_produtividade + obra_produtividade_meses (Sorriso) a partir do payload normalizado
// pelo engine python (/tmp/produtividade_payload.json). One-off: o worker auto-processa no futuro.
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "5dd81834-f02c-4f34-8b7d-c186883acd75"; // Aeroporto Sorriso
const CFG_VER = "produtividade_v1";
const p = JSON.parse(readFileSync("/tmp/produtividade_payload.json", "utf8"));
if (p.status !== "ok") throw new Error(`payload não-ok: status=${p.status}`);

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();

// 1 · arquivo do Controle de Armação + última versão de extração
const arq = await c.query(
  `select a.id, max(e.version) as version
   from obra_arquivos a join obra_arquivo_extracoes e on e.arquivo_id = a.id
   where a.obra_id = $1 and (lower(a.nome_original) like '%armaç%' or lower(a.nome_original) like '%armac%')
   group by a.id`,
  [CONTRATO],
);
if (arq.rows.length !== 1)
  throw new Error(`esperava 1 arquivo de armação, achei ${arq.rows.length}`);
const { id: arquivoId, version } = arq.rows[0];
console.log(`arquivo armação: ${arquivoId} · extracao_version=${version}`);

// 2 · idempotente
await c.query(
  `delete from obra_produtividade where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · resumo (parent)
const rz = p.resumo;
const up = await c.query(
  `insert into obra_produtividade
     (contrato_id, arquivo_id, extracao_version, config_version, aco_total_kg, person_horas_total,
      produtividade_real_kg_ph, avanco_fisico_pct, indice_perda_pct_raw, status)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ok') returning id`,
  [
    CONTRATO,
    arquivoId,
    version,
    CFG_VER,
    rz.aco_total_kg ?? null,
    rz.person_horas_total ?? null,
    rz.produtividade_real_kg_ph ?? null,
    rz.avanco_fisico_pct ?? null,
    rz.indice_perda_pct_raw ?? null,
  ],
);
const prodId = up.rows[0].id;

// 4 · meses (child)
for (const m of p.meses) {
  await c.query(
    `insert into obra_produtividade_meses
       (contrato_id, produtividade_id, ano, mes, aco_kg, person_horas, produtividade_kg_ph, n_dias)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      CONTRATO,
      prodId,
      m.ano,
      m.mes,
      m.aco_kg ?? null,
      m.person_horas ?? null,
      m.produtividade_kg_ph ?? null,
      m.n_dias ?? null,
    ],
  );
}
console.log(
  `inserido produtividade ${prodId} · ${p.meses.length} meses · ` +
    `${rz.produtividade_real_kg_ph} kg/person-h · avanço ${rz.avanco_fisico_pct}%`,
);
await c.end();
