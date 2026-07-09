-- Migration · GRANTs nas tabelas do chat
-- ─────────────────────────────────────────────────────────────────────
-- As tabelas adm_* foram criadas via conexão Postgres direta (pooler), que
-- NÃO herda os grants padrão que o Supabase aplica em tabelas criadas pelo
-- SQL Editor/dashboard. Sem isso, a role da API (service_role / sb_secret)
-- recebe "permission denied for table adm_conversations" (42501).
--
-- Modelo Supabase: GRANT amplo + RLS controla as linhas.
--   · service_role  → tudo (bypassa RLS de qualquer forma)
--   · anon/authenticated → SELECT (RLS já restringe via policy; precisam do
--     grant de tabela pra leitura/Realtime funcionar)
-- Idempotente (re-grant é no-op).

grant all on public.adm_conversations to service_role;
grant all on public.adm_messages to service_role;

grant select on public.adm_conversations to anon, authenticated;
grant select on public.adm_messages to anon, authenticated;
