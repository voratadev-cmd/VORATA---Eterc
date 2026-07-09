-- Migration · Robustez da fila de extração (auditoria)
-- ─────────────────────────────────────────────────────────────────────
-- Corrige 3 buracos achados na auditoria do pipeline:
--   1. `attempts` era COMPARTILHADO entre mapeamento e extração → o orçamento
--      de retry da extração era "3 − tentativas do mapeamento". Agora a extração
--      tem seu próprio contador (`extract_attempts`), decopulado do mapeamento.
--   2. Um doc podia ficar PRESO em 'extracting'/'mapping' pra sempre (worker
--      morto + contador esgotado → RPC não re-pega, nada vira erro terminal).
--      Agora `reap_stale_leases()` varre os presos e os move pro estado de erro.
--   3. Sem renovação de lease → extração longa (multi-fatia) estourava o lease
--      e abria janela de dupla-pega sob concorrência. Agora `renew_arquivo_lease()`
--      (heartbeat chamado pelo worker durante a extração).
-- Idempotente.

-- 1. Contador de tentativas SÓ da extração (mapeamento continua em `attempts`).
alter table public.obra_arquivos
  add column if not exists extract_attempts int not null default 0;

-- Índice para o scan de leases presos (status transiente + lease vencido).
create index if not exists obra_arquivos_stuck_idx
  on public.obra_arquivos (status, lease_until)
  where status in ('mapping', 'extracting');


-- 2. RPC atômica · contadores POR FASE + estado-preso específico da fase.
--   mapping    → elegíveis raw|queued|mapping_error|(mapping preso) · contador attempts
--   extracting → elegíveis ready_to_extract|extraction_error|(extracting preso) · contador extract_attempts
create or replace function public.acquire_arquivo_lease(
  p_lease_minutes int,
  p_phase text default 'mapping'
)
returns setof public.obra_arquivos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_phase = 'mapping' then
    select id into v_id
    from public.obra_arquivos
    where (
      status = any(array['raw', 'queued', 'mapping_error'])
      or (status = 'mapping' and lease_until < now())
    )
      and attempts < 3
    order by uploaded_at asc
    for update skip locked
    limit 1;

    if v_id is null then
      return;
    end if;

    return query
      update public.obra_arquivos
      set status = 'mapping',
          lease_until = now() + (p_lease_minutes || ' minutes')::interval,
          attempts = attempts + 1
      where id = v_id
      returning *;

  elsif p_phase = 'extracting' then
    select id into v_id
    from public.obra_arquivos
    where (
      status = any(array['ready_to_extract', 'extraction_error'])
      or (status = 'extracting' and lease_until < now())
    )
      and extract_attempts < 3
    order by uploaded_at asc
    for update skip locked
    limit 1;

    if v_id is null then
      return;
    end if;

    return query
      update public.obra_arquivos
      set status = 'extracting',
          lease_until = now() + (p_lease_minutes || ' minutes')::interval,
          extract_attempts = extract_attempts + 1
      where id = v_id
      returning *;

  else
    raise exception 'Fase desconhecida: %', p_phase;
  end if;
end;
$$;

revoke all on function public.acquire_arquivo_lease(int, text) from public, anon, authenticated;
grant execute on function public.acquire_arquivo_lease(int, text) to service_role;


-- 3. Reaper · move pra estado de erro os docs presos em transiente com lease
--    vencido E contador esgotado (>=3). Retorna quantos foram reapados. O worker
--    chama no início de cada ciclo de polling (e no --once).
create or replace function public.reap_stale_leases()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  with reaped as (
    update public.obra_arquivos
    set status = case when status = 'mapping' then 'mapping_error' else 'extraction_error' end,
        lease_until = null,
        last_error = left(
          coalesce(last_error || ' · ', '') || 'lease expirado e tentativas esgotadas (reaper)',
          2000
        )
    where (status = 'mapping' and lease_until < now() and attempts >= 3)
       or (status = 'extracting' and lease_until < now() and extract_attempts >= 3)
    returning 1
  )
  select count(*) into v_n from reaped;
  return coalesce(v_n, 0);
end;
$$;

revoke all on function public.reap_stale_leases() from public, anon, authenticated;
grant execute on function public.reap_stale_leases() to service_role;


-- 4. Renew · heartbeat de lease durante extração/mapeamento longo. Só estende se
--    o doc ainda está no estado transiente (não rouba lease de quem terminou).
create or replace function public.renew_arquivo_lease(
  p_id uuid,
  p_lease_minutes int
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
begin
  update public.obra_arquivos
  set lease_until = now() + (p_lease_minutes || ' minutes')::interval
  where id = p_id
    and status in ('mapping', 'extracting')
  returning lease_until into v_until;
  return v_until;
end;
$$;

revoke all on function public.renew_arquivo_lease(uuid, int) from public, anon, authenticated;
grant execute on function public.renew_arquivo_lease(uuid, int) to service_role;
