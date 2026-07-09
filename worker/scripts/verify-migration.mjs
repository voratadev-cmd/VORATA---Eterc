// Confere se a migration criou os objetos esperados.
import pg from "pg";
const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const q = async (label, sql) => {
  const { rows } = await c.query(sql);
  console.log(label, "→", JSON.stringify(rows));
};
await q(
  "tabelas",
  `select table_name from information_schema.tables
   where table_schema='public'
     and table_name in ('obra_arquivo_contextos','obra_arquivo_extracoes','agent_runs')
   order by table_name`,
);
await q(
  "função acquire_arquivo_lease",
  `select proname from pg_proc where proname='acquire_arquivo_lease'`,
);
await q(
  "colunas novas em obra_arquivos",
  `select column_name from information_schema.columns
   where table_name='obra_arquivos' and column_name in ('lease_until','attempts','last_error')
   order by column_name`,
);
await q(
  "status 'cancelled' permitido?",
  `select count(*) as ok from information_schema.check_constraints
   where constraint_name='obra_arquivos_status_check' and check_clause like '%cancelled%'`,
);
await c.end();
