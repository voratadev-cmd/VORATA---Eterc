-- Migration · Normalização (Camada A) — C.11 CONDUTAS (RMA · ações sugeridas pelo Adm Contratual IA)
-- Catálogo de condutas (gatilho → documento → cláusula) com prioridade, farol, categoria, status.
-- Conservação: n == card condutasSugeridasTotal. Idempotente por (contrato, arquivo, version, ordem).

create table if not exists public.obra_condutas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  gatilho text not null,
  documento text,
  clausula text,
  categoria text,
  prioridade text,
  farol text,
  status text,
  data_sugerida text,
  dias_aberto int,
  norm_status text not null default 'ok' check (norm_status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_condutas_contrato_idx on public.obra_condutas (contrato_id);
alter table public.obra_condutas enable row level security;
drop policy if exists "select_condutas_owner" on public.obra_condutas;
create policy "select_condutas_owner" on public.obra_condutas for select
  using (exists (select 1 from public.obras o where o.id = obra_condutas.contrato_id and o.created_by = auth.uid()));
drop policy if exists "condutas_anon" on public.obra_condutas;
create policy "condutas_anon" on public.obra_condutas for select to anon using (true);
grant all on public.obra_condutas to service_role;
grant select on public.obra_condutas to anon, authenticated;
