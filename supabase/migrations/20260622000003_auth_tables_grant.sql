-- Login · GRANT de tabela pra 'authenticated' em profiles + user_roles.
--
-- POR QUÊ: o fetchMe (montar o usuário corrente) lê public.profiles e
-- public.user_roles como role 'authenticated'. As policies de self-read já
-- existem (migration ...0001), mas o PostgREST exige TAMBÉM o GRANT de tabela —
-- sem ele a query falha com 42501 "permission denied for table profiles", o papel
-- não é lido e o usuário cai pro default 'regular'. As policies (id = auth.uid())
-- continuam limitando cada um a ler só a própria linha. Idempotente.

grant select on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
