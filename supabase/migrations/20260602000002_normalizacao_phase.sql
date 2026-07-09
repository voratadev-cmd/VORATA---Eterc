-- Migration · Fase 'normalizacao' na fila (3ª etapa da pipeline)
-- ─────────────────────────────────────────────────────────────────────
-- Adiciona a fase 'normalizacao' à RPC de lease: o worker normalizador pega docs já
-- EXTRAÍDOS (extracted|verified), lê a última extração, roda o engine determinístico e
-- faz upsert nas tabelas canônicas (obra_medicoes/itens/totais).
--
-- Decisões:
--   · Elegíveis = extracted | verified (extração confiável) + normalizacao_error (retry) +
--     normalizing preso. NÃO pega 'needs_review' (extração incerta — resolve o gate humano antes).
--   · Contador PRÓPRIO (`normalize_attempts`) — decopulado de mapping/extração (mesma lição
--     da 0006: contador compartilhado esgotava o orçamento de retry da fase seguinte).
--   · Status do ARQUIVO = normalizing → normalized (o doc foi processado). O gate de
--     invariante que falha marca a MEDIÇÃO (obra_medicoes.status='needs_review'), não o
--     arquivo — separação entre "doc processado" e "dado precisa revisão".
-- Idempotente.

-- 1. Contador próprio da normalização.
alter table public.obra_arquivos
  add column if not exists normalize_attempts int not null default 0;

-- 2. Status válidos · adiciona os 3 da normalização (drop+recreate, como 0011).
do $$
declare v_conname text;
begin
  select conname into v_conname from pg_constraint
  where conrelid = 'public.obra_arquivos'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%' limit 1;
  if v_conname is not null then
    execute format('alter table public.obra_arquivos drop constraint %I', v_conname);
  end if;
  alter table public.obra_arquivos add constraint obra_arquivos_status_check check (status in (
    'staged', 'raw', 'queued', 'mapping', 'mapped', 'mapping_error',
    'ready_to_extract', 'extracting', 'extracted', 'needs_review', 'verified', 'extraction_error',
    'normalizing', 'normalized', 'normalizacao_error',
    'cancelled', 'processing', 'error'
  ));
end $$;

create index if not exists obra_arquivos_norm_queue_idx
  on public.obra_arquivos (status, lease_until)
  where status in ('extracted', 'verified', 'normalizacao_error', 'normalizing');

-- 3. acquire · + branch 'normalizacao'. Recria a função inteira (assinatura com p_owner da 0009).
create or replace function public.acquire_arquivo_lease(
  p_lease_minutes int, p_phase text default 'mapping', p_owner uuid default null
)
returns setof public.obra_arquivos
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if p_phase = 'mapping' then
    select id into v_id from public.obra_arquivos
    where (status = any(array['raw','queued','mapping_error']) or (status='mapping' and lease_until < now()))
      and attempts < 3
    order by uploaded_at asc for update skip locked limit 1;
    if v_id is null then return; end if;
    return query update public.obra_arquivos
      set status='mapping', lease_until = now() + (p_lease_minutes || ' minutes')::interval,
          attempts = attempts + 1, lease_owner = p_owner
      where id = v_id returning *;
  elsif p_phase = 'extracting' then
    select id into v_id from public.obra_arquivos
    where (status = any(array['ready_to_extract','extraction_error']) or (status='extracting' and lease_until < now()))
      and extract_attempts < 3
    order by uploaded_at asc for update skip locked limit 1;
    if v_id is null then return; end if;
    return query update public.obra_arquivos
      set status='extracting', lease_until = now() + (p_lease_minutes || ' minutes')::interval,
          extract_attempts = extract_attempts + 1, lease_owner = p_owner
      where id = v_id returning *;
  elsif p_phase = 'normalizacao' then
    select id into v_id from public.obra_arquivos
    where (status = any(array['extracted','verified','normalizacao_error']) or (status='normalizing' and lease_until < now()))
      and normalize_attempts < 3
    order by uploaded_at asc for update skip locked limit 1;
    if v_id is null then return; end if;
    return query update public.obra_arquivos
      set status='normalizing', lease_until = now() + (p_lease_minutes || ' minutes')::interval,
          normalize_attempts = normalize_attempts + 1, lease_owner = p_owner
      where id = v_id returning *;
  else
    raise exception 'Fase desconhecida: %', p_phase;
  end if;
end; $$;
revoke all on function public.acquire_arquivo_lease(int, text, uuid) from public, anon, authenticated;
grant execute on function public.acquire_arquivo_lease(int, text, uuid) to service_role;

-- 4. renew/complete · + 'normalizing' no conjunto de status transientes.
create or replace function public.renew_arquivo_lease(
  p_id uuid, p_lease_minutes int, p_owner uuid default null
)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare v_until timestamptz;
begin
  update public.obra_arquivos
  set lease_until = now() + (p_lease_minutes || ' minutes')::interval
  where id = p_id and status in ('mapping','extracting','normalizing')
    and (p_owner is null or lease_owner is null or lease_owner = p_owner)
  returning lease_until into v_until;
  return v_until;
end; $$;
revoke all on function public.renew_arquivo_lease(uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.renew_arquivo_lease(uuid, int, uuid) to service_role;

create or replace function public.complete_arquivo_job(
  p_id uuid, p_status text, p_error text default null, p_owner uuid default null
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_ok boolean;
begin
  update public.obra_arquivos
  set status = p_status, lease_until = null, lease_owner = null,
      last_error = case
        when p_error is not null then left(p_error, 2000)
        when p_status in ('error','mapping_error','extraction_error','normalizacao_error') then last_error
        else null end
  where id = p_id and status in ('mapping','extracting','normalizing')
    and (p_owner is null or lease_owner is null or lease_owner = p_owner)
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;
revoke all on function public.complete_arquivo_job(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.complete_arquivo_job(uuid, text, text, uuid) to service_role;

-- 5. reaper · + 'normalizing' preso (lease vencido + contador esgotado) → normalizacao_error.
create or replace function public.reap_stale_leases()
returns int language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  with reaped as (
    update public.obra_arquivos
    set status = case
          when status = 'mapping' then 'mapping_error'
          when status = 'extracting' then 'extraction_error'
          else 'normalizacao_error' end,
        lease_until = null, lease_owner = null,
        last_error = left(coalesce(last_error || ' · ', '') || 'lease expirado e tentativas esgotadas (reaper)', 2000)
    where (status = 'mapping' and lease_until < now() and attempts >= 3)
       or (status = 'extracting' and lease_until < now() and extract_attempts >= 3)
       or (status = 'normalizing' and lease_until < now() and normalize_attempts >= 3)
    returning 1
  )
  select count(*) into v_n from reaped;
  return coalesce(v_n, 0);
end; $$;
revoke all on function public.reap_stale_leases() from public, anon, authenticated;
grant execute on function public.reap_stale_leases() to service_role;
