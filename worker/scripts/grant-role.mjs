// Atribui um papel (master|admin|regular) a um usuário já existente em auth.users.
// Bootstrap do primeiro master + base do futuro "master gerencia usuários".
//
// Uso (a partir de worker/):
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/grant-role.mjs <email> <master|admin|regular>
//
// O usuário precisa já existir no Supabase Auth (painel → Authentication → Add user,
// com "Auto Confirm User"). Este script garante o profile e fixa o papel (substitui
// papéis anteriores do usuário).

import pg from "pg";

const [email, role] = process.argv.slice(2);
const VALID = ["master", "admin", "regular"];

if (!email || !VALID.includes(role)) {
  console.error("uso: node scripts/grant-role.mjs <email> <master|admin|regular>");
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("defina SUPABASE_DB_URL (pooler IPv4, ver CLAUDE.md).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();
try {
  const u = await client.query("select id, email from auth.users where lower(email) = lower($1)", [
    email,
  ]);
  if (u.rowCount === 0) {
    console.error(
      `Nenhum usuário em auth.users com e-mail ${email}.\n` +
        "Crie a conta no painel do Supabase (Authentication → Add user, marcando Auto Confirm) e rode de novo.",
    );
    process.exit(1);
  }
  const uid = u.rows[0].id;
  await client.query(
    "insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing",
    [uid, u.rows[0].email],
  );
  await client.query("delete from public.user_roles where user_id = $1", [uid]);
  await client.query(
    "insert into public.user_roles (user_id, role) values ($1, $2::public.app_role)",
    [uid, role],
  );
  console.log(`OK · ${u.rows[0].email} → ${role}`);
} finally {
  await client.end();
}
