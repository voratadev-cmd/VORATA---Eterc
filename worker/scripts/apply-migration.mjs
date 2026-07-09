// Runner de migration · aplica um arquivo .sql direto no Postgres da vorata
// via Session pooler (IPv4). Não usa MCP. Idempotente — pode re-rodar.
//
// Uso:
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
//     node scripts/apply-migration.mjs ../supabase/migrations/<arquivo>.sql
//
// Requer `pg` instalado (npm i pg).

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import pg from "pg";

const REF = "SUPABASE_REF_ETERC_AQUI"; // projeto Supabase da vorata
const POOLER = "aws-1-us-east-1.pooler.supabase.com:5432";

// Pergunta a senha sem ecoar — evita colar URL/senha no comando.
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

const file = process.argv[2];
if (!file) {
  console.error("✗ uso: node scripts/apply-migration.mjs <arquivo.sql>");
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

const sql = readFileSync(file, "utf8");
const masked = url.replace(/:([^:@/]+)@/, ":****@");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false }, // Supabase exige SSL
});

try {
  await client.connect();
  console.log("· conectado:", masked);
  // Multi-statement em uma query = transação única (atômico).
  await client.query(sql);
  console.log("✓ migration aplicada:", file);
} catch (e) {
  console.error("✗ erro ao aplicar:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
