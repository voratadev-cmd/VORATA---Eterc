-- C.5 Prazo · Marcos contratuais detalhados (24) — popula o card "Marcos" do Prazo (estava vazio)
create table if not exists public.obra_prazo_marcos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  categoria text,
  trecho text,
  data_limite text,
  pct_concluido numeric,   -- input (NULL até a obra medir)
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_prazo_marcos_contrato_idx on public.obra_prazo_marcos (contrato_id);
alter table public.obra_prazo_marcos enable row level security;
drop policy if exists "select_marcos_owner" on public.obra_prazo_marcos;
create policy "select_marcos_owner" on public.obra_prazo_marcos for select
  using (exists (select 1 from public.obras o where o.id = obra_prazo_marcos.contrato_id and o.created_by = auth.uid()));
drop policy if exists "marcos_anon" on public.obra_prazo_marcos;
create policy "marcos_anon" on public.obra_prazo_marcos for select to anon using (true);
grant all on public.obra_prazo_marcos to service_role;
grant select on public.obra_prazo_marcos to anon, authenticated;
