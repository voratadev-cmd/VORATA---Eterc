-- Migration · RPC de CONTAGENS da Normalização (painel de controle da tela /normalizacao)
-- Uma chamada devolve, por tabela obra_* com coluna de obra, quantas linhas a obra tem e quantas
-- estão em needs_review. DINÂMICA via information_schema: tabela nova de entidade aparece no
-- painel sozinha (sem manutenção da lista). SECURITY DEFINER + grant anon (postura dev — a RLS
-- de go-live revisa os grants em bloco).

create or replace function public.normalizacao_contagens(p_contrato uuid)
returns table(tabela text, n bigint, n_review bigint)
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_col text;
  v_tem_status boolean;
begin
  for r in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name like 'obra\_%'
      and t.table_type = 'BASE TABLE'
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name
          and c.column_name in ('contrato_id', 'obra_id'))
    order by t.table_name
  loop
    select c.column_name into v_col
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.table_name
      and c.column_name in ('contrato_id', 'obra_id')
    limit 1;
    select exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = r.table_name
        and c.column_name = 'status') into v_tem_status;
    if v_tem_status then
      return query execute format(
        'select %L::text, count(*)::bigint, '
        '(count(*) filter (where status = ''needs_review''))::bigint from %I where %I = $1',
        r.table_name, r.table_name, v_col) using p_contrato;
    else
      return query execute format(
        'select %L::text, count(*)::bigint, 0::bigint from %I where %I = $1',
        r.table_name, r.table_name, v_col) using p_contrato;
    end if;
  end loop;
end;
$$;

revoke all on function public.normalizacao_contagens(uuid) from public;
grant execute on function public.normalizacao_contagens(uuid) to anon, authenticated, service_role;
