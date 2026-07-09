// Popula obra_insumos + obra_insumo_meses (Sorriso) a partir do payload já normalizado pelo
// engine python (/tmp/insumos_payload.json). One-off: o worker auto-processa uploads futuros.
import { readFileSync } from "node:fs";
import pg from "pg";

const CONTRATO = "5dd81834-f02c-4f34-8b7d-c186883acd75"; // Aeroporto Sorriso
const CFG_VER = "insumos_v1";
const p = JSON.parse(readFileSync("/tmp/insumos_payload.json", "utf8"));
if (p.status !== "ok" || p.gate !== "ok")
  throw new Error(`payload não-ok: status=${p.status} gate=${p.gate}`);

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();

// 1 · arquivo do histograma + última versão de extração
const arq = await c.query(
  `select a.id, max(e.version) as version
   from obra_arquivos a join obra_arquivo_extracoes e on e.arquivo_id = a.id
   where a.obra_id = $1 and lower(a.nome_original) like '%histograma%quantidade%'
   group by a.id`,
  [CONTRATO],
);
if (arq.rows.length !== 1)
  throw new Error(`esperava 1 arquivo histograma, achei ${arq.rows.length}`);
const { id: arquivoId, version } = arq.rows[0];
console.log(`arquivo histograma: ${arquivoId} · extracao_version=${version}`);

// 2 · idempotente: apaga o que houver dessa contribuição
await c.query(
  `delete from obra_insumo_meses where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);
await c.query(
  `delete from obra_insumos where contrato_id=$1 and arquivo_id=$2 and extracao_version=$3`,
  [CONTRATO, arquivoId, version],
);

// 3 · insumos
const base = [CONTRATO, arquivoId, version, CFG_VER];
for (const i of p.insumos) {
  await c.query(
    `insert into obra_insumos (contrato_id, arquivo_id, extracao_version, config_version, codigo, descricao, unidade, qtde_total, classe_abc, grupo_custo, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ok')`,
    [
      ...base,
      i.codigo,
      i.descricao ?? null,
      i.unidade ?? null,
      i.qtde_total ?? null,
      i.classe_abc ?? null,
      i.grupo_custo ?? null,
    ],
  );
}
console.log(`inseridos ${p.insumos.length} insumos`);

// 4 · meses (lotes via multi-row insert)
let n = 0;
for (let k = 0; k < p.meses.length; k += 200) {
  const chunk = p.meses.slice(k, k + 200);
  const vals8 = chunk.map((_, j) => {
    const o = j * 8;
    return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8})`;
  });
  const params8 = [];
  for (const m of chunk)
    params8.push(CONTRATO, arquivoId, version, CFG_VER, m.codigo, m.ano, m.mes, m.qtde);
  await c.query(
    `insert into obra_insumo_meses (contrato_id, arquivo_id, extracao_version, config_version, codigo, ano, mes, qtde) values ${vals8.join(",")}`,
    params8,
  );
  n += chunk.length;
}
console.log(`inseridas ${n} linhas-mês`);

// 5 · conferência por valor no banco
const chk = await c.query(
  `select (select count(*) from obra_insumos where contrato_id=$1) n_ins,
          (select round(sum(qtde_total)::numeric,4) from obra_insumos where contrato_id=$1) soma_ins,
          (select round(sum(qtde)::numeric,4) from obra_insumo_meses where contrato_id=$1) soma_mes`,
  [CONTRATO],
);
console.log("banco:", chk.rows[0]);
await c.end();
