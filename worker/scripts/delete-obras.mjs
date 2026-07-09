// Exclusão de obras · remove obras (e tudo que cascateia) direto no Postgres
// da vorata via Session pooler (IPv4). Não usa MCP.
//
// O delete em `obras` cascateia pra TODAS as read-models (contrato_id/obra_id
// com `on delete cascade`). O que NÃO cascateia é o Storage — os arquivos do
// bucket `rma-docs` vivem sob o prefixo `<obraId>/`, então o script também
// apaga as rows de `storage.objects` desse prefixo.
//
// Uso:
//   node scripts/delete-obras.mjs <padrão-do-nome>            → dry-run (só lista)
//   node scripts/delete-obras.mjs <padrão-do-nome> --apply    → deleta de verdade
//
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/delete-obras.mjs sorriso --apply
//
// Requer `pg` instalado (npm i pg --no-save).

import { createInterface } from "node:readline";

import pg from "pg";

const REF = "SUPABASE_REF_ETERC_AQUI"; // projeto Supabase da vorata
const POOLER = "aws-1-us-east-1.pooler.supabase.com:5432";
const BUCKET = "rma-docs";

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {};
    rl.question("", (ans) => {
      rl.close();
      process.stdout.write("\n");
      resolve(ans.trim());
    });
  });
}

const pattern = process.argv[2];
const apply = process.argv.includes("--apply");
if (!pattern) {
  console.error("✗ uso: node scripts/delete-obras.mjs <padrão-do-nome> [--apply]");
  process.exit(1);
}

let url = process.env.SUPABASE_DB_URL;
if (!url) {
  const senha = await askHidden("Senha do banco (Settings → Database; não aparece ao digitar): ");
  if (!senha) {
    console.error("✗ senha vazia — abortando.");
    process.exit(1);
  }
  url = `postgresql://postgres.${REF}:${encodeURIComponent(senha)}@${POOLER}/postgres`;
}

const masked = url.replace(/:([^:@/]+)@/, ":****@");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("· conectado:", masked);

  const { rows: obras } = await client.query(
    `select id, nome_interno, cidade, uf, created_at
       from public.obras
      where nome_interno ilike $1 or coalesce(cidade, '') ilike $1
      order by created_at`,
    [`%${pattern}%`],
  );

  if (obras.length === 0) {
    console.log(`· nenhuma obra bate com "%${pattern}%" — nada a fazer.`);
    process.exit(0);
  }

  console.log(`\n· ${obras.length} obra(s) encontrada(s) com "%${pattern}%":`);
  for (const o of obras) {
    console.log(`  - ${o.id} · ${o.nome_interno} (${o.cidade ?? "?"}/${o.uf ?? "?"})`);
  }

  const ids = obras.map((o) => o.id);
  const { rows: arq } = await client.query(
    `select count(*)::int as n from public.obra_arquivos where obra_id = any($1)`,
    [ids],
  );
  const prefixes = ids.map((id) => `${id}/%`);
  const { rows: sto } = await client.query(
    `select count(*)::int as n from storage.objects
      where bucket_id = $1 and name like any($2)`,
    [BUCKET, prefixes],
  );
  console.log(`\n· obra_arquivos: ${arq[0].n} row(s) · storage.objects (${BUCKET}): ${sto[0].n} objeto(s)`);

  if (!apply) {
    console.log("\n· DRY-RUN — nada foi deletado. Re-rode com --apply pra executar.");
    process.exit(0);
  }

  const del2 = await client.query(`delete from public.obras where id = any($1)`, [ids]);
  console.log(`\n✓ deletado: ${del2.rowCount} obra(s) (cascade em todas as read-models).`);

  // Storage é best-effort — o Supabase pode bloquear DELETE direto em
  // storage.objects (guard "use a Storage API"). Nesse caso, sobra limpar
  // as pastas <obraId>/ no dashboard (Storage → rma-docs).
  try {
    const del1 = await client.query(
      `delete from storage.objects where bucket_id = $1 and name like any($2)`,
      [BUCKET, prefixes],
    );
    console.log(`✓ Storage: ${del1.rowCount} objeto(s) removido(s) de ${BUCKET}.`);
  } catch (e) {
    console.warn(`⚠ Storage bloqueado via SQL (${e.message})`);
    console.warn(`  Limpar manualmente no dashboard · bucket ${BUCKET}, pastas:`);
    for (const id of ids) console.warn(`  - ${id}/`);
  }

  const { rows: rest } = await client.query(
    `select id, nome_interno from public.obras order by created_at`,
  );
  console.log(`\n· obras restantes no banco (${rest.length}):`);
  for (const o of rest) console.log(`  - ${o.id} · ${o.nome_interno}`);
} catch (e) {
  try {
    await client.query("rollback");
  } catch {
    /* sem transação aberta */
  }
  console.error("✗ erro:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
