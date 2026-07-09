-- Migration · Normalização (Camada A) — C.3 FATURAMENTO POR FRENTE/DISCIPLINA
-- 12 frentes: Contratado Total + Contratado Acum até BM + Real Acum + % + Farol. Σ Contratado Total
-- = PV · Σ Contratado Acum = C.8 contratado-no-corte (cross-check duplo). Real é input (0 até medir).

create table if not exists public.obra_faturamento_frentes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  frente text not null,
  servico boolean,
  contratado_total numeric,
  contratado_acum numeric,
  real_acum numeric,
  pct numeric,
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_faturamento_frentes_contrato_idx on public.obra_faturamento_frentes (contrato_id);
alter table public.obra_faturamento_frentes enable row level security;
drop policy if exists "select_fatfrentes_owner" on public.obra_faturamento_frentes;
create policy "select_fatfrentes_owner" on public.obra_faturamento_frentes for select
  using (exists (select 1 from public.obras o where o.id = obra_faturamento_frentes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "fatfrentes_anon" on public.obra_faturamento_frentes;
create policy "fatfrentes_anon" on public.obra_faturamento_frentes for select to anon using (true);
grant all on public.obra_faturamento_frentes to service_role;
grant select on public.obra_faturamento_frentes to anon, authenticated;
