-- Migration · Normalização (Camada A) — C.8 CURVAS Lib×Cap×Aloc (RMA · origem do gargalo)
-- Cards consolidados no corte: contratado/liberado/capacidade/executado + os 3 % do card
-- Liberação×Capacidade×Alocado. executado_acum cruza com o faturamento real (gate). 1 row por obra.

create table if not exists public.obra_curvas_c8 (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  contratado_acum_corte numeric,   -- contratado acumulado até o BM corrente (R$)
  liberado_acum numeric,           -- liberado p/ execução acumulado (R$)
  capacidade_acum numeric,         -- capacidade produtiva acumulada (R$)
  executado_acum numeric,          -- executado acumulado (R$) == faturamento real
  maior_gap_rs numeric,            -- maior gap entre as curvas (R$)
  liberacao_pct numeric,           -- liberado / contratado (fração 0..1)
  capacidade_pct numeric,          -- capacidade / contratado (fração 0..1)
  alocado_pct numeric,             -- executado / contratado (fração 0..1)
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_curvas_c8_contrato_idx on public.obra_curvas_c8 (contrato_id);
alter table public.obra_curvas_c8 enable row level security;
drop policy if exists "select_c8_owner" on public.obra_curvas_c8;
create policy "select_c8_owner" on public.obra_curvas_c8 for select
  using (exists (select 1 from public.obras o where o.id = obra_curvas_c8.contrato_id and o.created_by = auth.uid()));
drop policy if exists "c8_anon" on public.obra_curvas_c8;
create policy "c8_anon" on public.obra_curvas_c8 for select to anon using (true);
grant all on public.obra_curvas_c8 to service_role;
grant select on public.obra_curvas_c8 to anon, authenticated;
