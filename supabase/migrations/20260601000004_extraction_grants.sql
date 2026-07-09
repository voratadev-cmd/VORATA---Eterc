-- Migration · GRANTs nas tabelas de extração (worker)
-- ─────────────────────────────────────────────────────────────────────
-- Mesma situação do adm_chat: estas tabelas foram criadas via conexão pg
-- direta (migration 20260601000001) e NÃO herdaram os grants padrão do
-- Supabase. Sem isso o worker (service_role / sb_secret) recebe
-- "permission denied" ao gravar contexto/runs.
-- Idempotente (re-grant é no-op).

-- obras / obra_arquivos foram criadas fora deste repo (anon/authenticated já
-- têm grant — o front lê), mas a service_role NÃO. O mapeador precisa de
-- SELECT/UPDATE em obra_arquivos pra fechar o job (complete_job) após a RPC
-- (security definer) ter pego o lease; e o agente de chat lê `obras` pra
-- montar contexto. Sem isso: "permission denied for table ...".
grant all on public.obras                  to service_role;
grant all on public.obra_arquivos          to service_role;

grant all on public.obra_arquivo_contextos to service_role;
grant all on public.obra_arquivo_extracoes to service_role;
grant all on public.agent_runs            to service_role;

grant select on public.obra_arquivo_contextos to anon, authenticated;
grant select on public.obra_arquivo_extracoes to anon, authenticated;
grant select on public.agent_runs            to anon, authenticated;
