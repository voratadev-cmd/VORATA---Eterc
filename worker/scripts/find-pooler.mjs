// Sonda qual região/prefixo do Session pooler aceita o tenant deste projeto.
// Uso: DBPASS='<senha>' node scripts/find-pooler.mjs
import pg from "pg";

const pwd = process.env.DBPASS;
const ref = "rruhfhcvtlnuqmskxbpr";
if (!pwd) {
  console.error("DBPASS ausente");
  process.exit(1);
}

const regions = [
  "sa-east-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-south-1",
  "ap-northeast-1",
  "ca-central-1",
];
const prefixes = ["aws-0", "aws-1"];

for (const pre of prefixes) {
  for (const r of regions) {
    const host = `${pre}-${r}.pooler.supabase.com`;
    const url = `postgresql://postgres.${ref}:${pwd}@${host}:5432/postgres`;
    const c = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    try {
      await c.connect();
      await c.query("select 1");
      console.log(`\n✓✓ ACHOU: ${host}\n`);
      await c.end();
      process.exit(0);
    } catch (e) {
      console.log(`· ${host} → ${String(e.message).slice(0, 45)}`);
      try {
        await c.end();
      } catch {
        /* ignore */
      }
    }
  }
}
console.log("\n✗ nenhuma região bateu");
