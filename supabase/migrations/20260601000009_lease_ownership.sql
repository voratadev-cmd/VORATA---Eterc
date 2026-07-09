-- Migration · Lease com TOKEN de dono (fecha o double-pick de forma definitiva)
-- ─────────────────────────────────────────────────────────────────────
-- Antes: renew/complete agiam por id, sem checar QUEM tem o lease. Janela: worker A
-- trava, lease vence, worker B reassume o doc, A volta e o heartbeat de A renova o
-- doc de B (ou A fecha o job de B) → DUPLA-PEGA de dado ultra-sensível.
-- Agora cada worker tem um owner (uuid do processo): renew/complete SÓ agem se o
-- owner bater. Quem perdeu o lease não mexe no doc que o outro reassumiu.
-- Idempotente.

alter table public.obra_arquivos add column if not exists lease_owner uuid;

-- Derruba as assinaturas antigas (sem p_owner) p/ não gerar chamada ambígua.
drop function if exists public.acquire_arquivo_lease(int, text);
drop function if exists public.renew_arquivo_lease(uuid, int);

-- acquire · grava o owner do lease.
create or replace function public.acquire_arquivo_lease(
  p_lease_minutes int,
  p_phase text default 'mapping',
  p_owner uuid default null
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
  else
    raise exception 'Fase desconhecida: %', p_phase;
  end if;
end; $$;
revoke all on function public.acquire_arquivo_lease(int, text, uuid) from public, anon, authenticated;
grant execute on function public.acquire_arquivo_lease(int, text, uuid) to service_role;

-- renew · só estende se o owner bater (e ainda transiente).
create or replace function public.renew_arquivo_lease(
  p_id uuid, p_lease_minutes int, p_owner uuid default null
)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare v_until timestamptz;
begin
  update public.obra_arquivos
  set lease_until = now() + (p_lease_minutes || ' minutes')::interval
  where id = p_id and status in ('mapping','extracting')
    and (p_owner is null or lease_owner is null or lease_owner = p_owner)
  returning lease_until into v_until;
  return v_until;
end; $$;
revoke all on function public.renew_arquivo_lease(uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.renew_arquivo_lease(uuid, int, uuid) to service_role;

-- complete · só fecha se ainda transiente E o owner bater (não sobrescreve doc que
-- mudou de estado no meio). Retorna true se realmente fechou.
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
        when p_status in ('error','mapping_error','extraction_error') then last_error
        else null end
  where id = p_id and status in ('mapping','extracting')
    and (p_owner is null or lease_owner is null or lease_owner = p_owner)
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;
revoke all on function public.complete_arquivo_job(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.complete_arquivo_job(uuid, text, text, uuid) to service_role;
