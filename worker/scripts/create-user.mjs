// Cria (ou atualiza a senha de) um usuário no Supabase Auth + define o papel.
// Bootstrap de contas enquanto a UI de convites não existe. Cria a row em
// auth.users (senha via pgcrypto bcrypt, e-mail já confirmado) + a auth.identities
// (necessária pro login por e-mail) + profile + papel. Idempotente.
//
// Uso (a partir de worker/):
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<SENHA>@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     node scripts/create-user.mjs <email> <senha> <master|admin|regular>

import pg from "pg";

const [email, password, role = "regular"] = process.argv.slice(2);
const VALID = ["master", "admin", "regular"];

if (!email || !password || !VALID.includes(role)) {
  console.error("uso: node scripts/create-user.mjs <email> <senha> <master|admin|regular>");
  process.exit(1);
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("defina SUPABASE_DB_URL (pooler IPv4, ver CLAUDE.md).");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  await c.query("begin");

  let uid;
  const existing = await c.query("select id from auth.users where lower(email) = lower($1)", [
    email,
  ]);
  if (existing.rowCount) {
    uid = existing.rows[0].id;
    await c.query(
      `update auth.users set
         encrypted_password = crypt($2, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = coalesce(confirmation_token, ''),
         recovery_token = coalesce(recovery_token, ''),
         email_change = coalesce(email_change, ''),
         email_change_token_new = coalesce(email_change_token_new, ''),
         updated_at = now()
       where id = $1`,
      [uid, password],
    );
    console.log("· usuário já existia → senha redefinida + tokens normalizados");
  } else {
    const ins = await c.query(
      `insert into auth.users
         (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, recovery_token, email_change, email_change_token_new)
       values
         (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          $1, crypt($2, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
          '', '', '', '')
       returning id`,
      [email, password],
    );
    uid = ins.rows[0].id;
    console.log("· auth.users criado");
  }

  // Identidade de e-mail (sem ela o login por senha falha em GoTrue moderno).
  const idn = await c.query(
    "select 1 from auth.identities where user_id = $1 and provider = 'email'",
    [uid],
  );
  if (!idn.rowCount) {
    await c.query(
      `insert into auth.identities
         (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values
         ($1::text, $2::uuid,
          jsonb_build_object('sub', $1::text, 'email', $3::text, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now())`,
      [String(uid), uid, email],
    );
    console.log("· auth.identities criada");
  }

  await c.query(
    "insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing",
    [uid, email],
  );
  await c.query("delete from public.user_roles where user_id = $1", [uid]);
  await c.query("insert into public.user_roles (user_id, role) values ($1, $2::public.app_role)", [
    uid,
    role,
  ]);

  await c.query("commit");
  console.log(`OK · ${email} pronto → papel ${role}`);
} catch (e) {
  await c.query("rollback");
  console.error("ERRO:", e.message);
  process.exit(1);
} finally {
  await c.end();
}
