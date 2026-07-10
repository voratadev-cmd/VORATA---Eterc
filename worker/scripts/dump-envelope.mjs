// Dump de envelopes de extração (dev) — lista o inventário da obra (status · doc_type ·
// nome) e, dado um padrão de nome/doc_type, grava o payload mais recente dos docs que
// casam em agent/agents/normalizacao/fixtures/. Reusa o session pooler IPv4 da vorata.
//
// Uso (de dentro de worker/, com pg instalado):
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/dump-envelope.mjs            # só inventário
//   ...                                          node scripts/dump-envelope.mjs rdo   # + dumpa RDOs

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import pg from "pg";

const OBRA = "5dd81834-f02c-4f34-8b7d-c186883acd75"; // Aeroporto Sorriso (teste real)
const REF = "rruhfhcvtlnuqmskxbpr"; // projeto Supabase da vorata
const POOLER = "aws-0-us-east-1.pooler.supabase.com:5432";
const __dir = dirname(fileURLToPath(import.meta.url)); // worker/scripts
const FIX = join(__dir, "..", "..", "agent", "agents", "normalizacao", "fixtures");
const pad = (process.argv[2] || "").toLowerCase();

// Pergunta a senha sem ecoar — assim ninguém precisa colar URL/senha no comando.
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {}; // não mostra o que for digitado
    rl.question("", (ans) => {
      rl.close();
      process.stdout.write("\n");
      resolve(ans.trim());
    });
  });
}

let url = process.env.SUPABASE_DB_URL || process.env.DB_URL;
if (!url) {
  const senha = await askHidden("Senha do banco (Settings → Database; não aparece ao digitar): ");
  if (!senha) {
    console.error("Senha vazia — abortando.");
    process.exit(1);
  }
  url = `postgresql://postgres.${REF}:${encodeURIComponent(senha)}@${POOLER}/postgres`;
}

const slug = (s) => (s || "doc").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(
  `select oa.nome_original, oa.status, e.doc_type, e.payload
     from obra_arquivos oa
     join lateral (
       select doc_type, payload from obra_arquivo_extracoes ex
       where ex.arquivo_id = oa.id order by version desc limit 1
     ) e on true
    where oa.obra_id = $1
    order by oa.nome_original`,
  [OBRA],
);

console.log(`\n=== INVENTÁRIO (${rows.length} docs) · status | doc_type | nome ===`);
for (const r of rows) console.log([r.status, r.doc_type, r.nome_original].join("  |  "));

// Modo --reset: docs 'normalized' → 'verified' (re-entram na fila da normalização, p/ re-
// normalizar com config nova). Idempotente. Aceita vários padrões separados por vírgula no dump.
const pats = pad
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
let n = 0;
if (pad === "--reset") {
  const upd = await c.query(
    `update public.obra_arquivos set status = 'verified', normalize_attempts = 0
       where obra_id = $1 and status = 'normalized'
       returning nome_original`,
    [OBRA],
  );
  console.log(`\n=== RESET: ${upd.rowCount} doc(s) 'normalized' → 'verified' (re-normalizar) ===`);
  for (const r of upd.rows) console.log(`  ↺ ${r.nome_original}`);
} else if (pats.length) {
  console.log(`\n=== DUMP para os padrões: ${pats.join(" · ")} ===`);
  for (const r of rows) {
    const hay = `${r.nome_original || ""} ${r.doc_type || ""}`.toLowerCase();
    if (pats.some((p) => hay.includes(p))) {
      const f = join(FIX, `${slug(r.nome_original)}.json`);
      writeFileSync(f, JSON.stringify(r.payload, null, 1));
      console.log(`DUMPED -> ${f}`);
      n++;
    }
  }
  console.log(`=== ${n} envelope(s) gravado(s) ===`);
} else {
  console.log(
    "\n(sem padrão → só inventário. Ex.: dump `… cronograma,histograma` · reset `… --reset`)",
  );
}
await c.end();
