-- Read-models · libera SELECT para a role 'authenticated'.
--
-- POR QUÊ: com Supabase Auth real (persistSession:true), ao logar o client troca
-- de 'anon' para 'authenticated' em TODAS as queries. As tabelas obra_* têm policy
-- de SELECT só para 'anon' (+ owner-check por created_by), então um usuário logado
-- que NÃO criou a obra veria tudo vazio — quebrando todas as telas de obra após o
-- login. Como nesta fase os dados já são lidos publicamente via anon (modelo
-- aberto), espelhamos para 'authenticated': quem está logado também lê (using true).
-- O escopo por usuário/obra ("telas por usuário") entra na fase de RBAC granular —
-- aí estas policies permissivas serão estreitadas.
--
-- Idempotente: percorre toda tabela public que JÁ tem policy de SELECT para 'anon'
-- e, se ainda não houver policy de SELECT para 'authenticated', cria uma permissiva
-- + garante o GRANT de tabela (PostgREST exige policy RLS + grant).
-- profiles/user_roles NÃO são afetados (não têm policy 'anon').

do $$
declare
  t record;
begin
  for t in
    select distinct tablename
    from pg_policies
    where schemaname = 'public'
      and cmd in ('SELECT', 'ALL')
      and 'anon' = any (roles)
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = t.tablename
        and cmd in ('SELECT', 'ALL')
        and 'authenticated' = any (roles)
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        t.tablename || '_authenticated_read',
        t.tablename
      );
    end if;
    execute format('grant select on public.%I to authenticated', t.tablename);
  end loop;
end $$;
