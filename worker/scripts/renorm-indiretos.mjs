// Re-normaliza SÓ a D.1 Indiretos de uma obra a partir da extração já existente
// (obra_secoes) — sem re-rodar o motor inteiro. I/O de banco via pooler; o cálculo
// determinístico é delegado ao resolver Python (extrair_indiretos_cli.py).
//
// Uso (a partir de worker/):
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-1-...pooler.supabase.com:5432/postgres' \
//     node scripts/renorm-indiretos.mjs <contrato_id>
//
// Requer: migration 20260624000001_indiretos_v2.sql já aplicada (colunas + tabela de itens).

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const contrato = process.argv[2];
if (!contrato) {
  console.error("uso: node scripts/renorm-indiretos.mjs <contrato_id>");
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("defina SUPABASE_DB_URL (pooler IPv4).");
  process.exit(1);
}

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG_VERSION = "workbook_motor@1.0.0";
const BASE_COLS = [
  "adm_local_cheio",
  "adm_local_mensal",
  "reducao_escopo",
  "desequilibrio_extensao",
  "custo_direto",
  "metodo_ativo",
  "gasto_acum",
  "medido_acum",
  "real_acum",
  "contratado_acum",
  "pv",
  "percent_pv",
  "prazo_meses",
  "bm_corrente",
  "reducao_pct",
  "extensao_meses",
];
const MET_COLS = [
  "ordem",
  "metodo",
  "desequilibrio_rs",
  "medido_rs",
  "defensabilidade",
  "ativo",
  "obs",
  "codigo",
  "comparacao",
  "valor_a",
  "valor_b",
  "pendente",
];
const ITEM_COLS = [
  "ordem",
  "grupo",
  "qtd_contr",
  "qtd_real",
  "custo_contr",
  "custo_real",
  "delta_custo",
];

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  // 1) lê as seções da extração + a chave (arquivo_id/version/config) de uma seção de indiretos
  const rows = (
    await c.query(
      "select titulo, tipo, colunas, dados, arquivo_id, extracao_version, config_version from public.obra_secoes where contrato_id = $1 order by ordem",
      [contrato],
    )
  ).rows;
  if (!rows.length) throw new Error("nenhuma seção em obra_secoes para esse contrato.");
  // chave (arquivo_id/version) DEVE vir de uma seção de indiretos — sem fallback p/ rows[0],
  // que poderia carimbar a D.1 com a procedência de outra seção (C.1, D.0…).
  const k = rows.find((r) => /indiret/i.test(r.titulo || ""));
  if (!k)
    throw new Error(
      "nenhuma seção de indiretos (titulo ~ /indiret/i) em obra_secoes — recuso rodar.",
    );
  const arquivo_id = k.arquivo_id;
  const extracao_version = k.extracao_version;
  const config_version = k.config_version || CONFIG_VERSION;

  const secoes = rows.map((r) => {
    const isTable = Array.isArray(r.dados);
    return {
      titulo: r.titulo,
      tipo: r.tipo,
      colunas: r.colunas || [],
      linhas: isTable ? r.dados : undefined,
      dados: isTable ? undefined : r.dados,
    };
  });

  // 2) roda o resolver Python (determinístico) sobre as seções
  const out = execFileSync(
    "python3",
    [join(REPO, "agent", "scripts", "extrair_indiretos_cli.py")],
    {
      input: JSON.stringify(secoes),
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const res = JSON.parse(out.toString());
  if (!res.metodos || res.desequilibrio_total == null) {
    throw new Error("resolver não retornou métodos/total: " + JSON.stringify(res.findings || []));
  }

  const key = {
    contrato_id: contrato,
    arquivo_id,
    extracao_version,
    config_version,
    status: res.status || "ok",
  };

  // VIGENTE POR OBRA: limpa TODAS as linhas anteriores da obra (mesmo de arquivo/version
  // antigos — o dado stale tinha outra chave) antes de inserir o estado correto.
  await c.query("delete from public.obra_indiretos_base where contrato_id=$1", [contrato]);
  await c.query("delete from public.obra_indiretos_metodos where contrato_id=$1", [contrato]);
  await c.query("delete from public.obra_indiretos_itens where contrato_id=$1", [contrato]);

  // 3a) base
  const baseRow = { ...key, desequilibrio_total: res.desequilibrio_total };
  for (const col of BASE_COLS) baseRow[col] = res.base[col] ?? null;
  const bCols = Object.keys(baseRow);
  await c.query(
    `insert into public.obra_indiretos_base (${bCols.join(",")}) values (${bCols.map((_, i) => `$${i + 1}`).join(",")})`,
    bCols.map((x) => baseRow[x]),
  );

  // 3b) métodos
  for (const m of res.metodos) {
    const row = { ...key };
    for (const col of MET_COLS) row[col] = m[col] ?? null;
    const cols = Object.keys(row);
    await c.query(
      `insert into public.obra_indiretos_metodos (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      cols.map((x) => row[x]),
    );
  }

  // 3c) itens (29 grupos)
  for (const it of res.itens || []) {
    const row = { ...key };
    for (const col of ITEM_COLS) row[col] = it[col] ?? null;
    const cols = Object.keys(row);
    await c.query(
      `insert into public.obra_indiretos_itens (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      cols.map((x) => row[x]),
    );
  }

  const f = (n) =>
    n == null ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  console.log(`OK · D.1 re-normalizada (contrato ${contrato.slice(0, 8)})`);
  console.log(
    `   total=${f(res.desequilibrio_total)} | ativo=${res.base.metodo_ativo} | metodos=${res.metodos.length} | itens=${res.itens?.length ?? 0}`,
  );
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await c.end();
}
