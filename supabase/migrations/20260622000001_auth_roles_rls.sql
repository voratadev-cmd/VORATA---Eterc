-- Auth · papéis master/admin/regular + RLS self-read pro login montar o /me.
--
-- Contexto: a app passou a usar Supabase Auth real com 3 papéis (master > admin >
-- regular). O enum public.app_role já existia com valores legados
-- (admin, diretor, gerente_contrato, juridico). Aqui só ADICIONAMOS 'master' e
-- 'regular' (os legados permanecem no enum, sem uso — remover valor de enum no
-- Postgres é destrutivo e desnecessário). A app usa apenas master/admin/regular.
--
-- Idempotente. Roda como transação única (apply-migration.mjs). Os novos valores
-- de enum NÃO são referenciados nesta mesma transação (restrição do Postgres p/
-- ALTER TYPE ADD VALUE) — as policies abaixo usam auth.uid(), não o valor do papel.

-- 1) Novos papéis no enum -----------------------------------------------------
alter type public.app_role add value if not exists 'master';
alter type public.app_role add value if not exists 'regular';

-- 2) RLS — cada usuário autenticado lê o PRÓPRIO profile + os PRÓPRIOS papéis.
--    É o mínimo pro front montar o usuário corrente (/me) depois do login.
--    A gestão por master (ler/editar todos) entra numa migration posterior.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select" on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());
