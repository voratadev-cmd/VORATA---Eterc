-- Migration · Normalização — C.3 SÉRIE MENSAL por DISCIPLINA/FRENTE (curva por item · Previsto + Real)
-- As matrizes "Previsto por {dim} × Mês" + "Real por {dim} × Mês" (15 disc finas / 17 frentes nomeadas,
-- mesma granularidade) → série mensal {previsto, real} por item, pro select da Curva S filtrar a curva
-- por disciplina/frente específica. AQUI o real EXISTE mensal (a fonte traz "Real por {dim} × Mês",
-- ex.: Mobilização [2,67·0,22·2,44]mi) — distinto do obra_faturamento_disciplina_mes coarse (real=0).
-- Σ previsto == PV (611M) · Σ real == real medido (12,9M · gate). dimensao separa os dois recortes.
-- ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_faturamento_serie_mes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  dimensao text not null check (dimensao in ('disciplina', 'frente')),
  item text not null,                  -- disciplina (Terraplenagem) ou frente nomeada (Trecho 01 — KM…)
  mes_num int not null,                -- ordinal do mês (1..46)
  ano int,
  mes int,
  previsto_rs numeric,                 -- desembolso previsto do item no mês
  real_rs numeric,                     -- real medido do item no mês · NULL/0 onde não medido
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, dimensao, ordem)
);
create index if not exists obra_fat_serie_mes_contrato_idx on public.obra_faturamento_serie_mes (contrato_id, dimensao);
alter table public.obra_faturamento_serie_mes enable row level security;
drop policy if exists "select_fat_serie_mes_owner" on public.obra_faturamento_serie_mes;
create policy "select_fat_serie_mes_owner" on public.obra_faturamento_serie_mes for select
  using (exists (select 1 from public.obras o where o.id = obra_faturamento_serie_mes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "fat_serie_mes_anon" on public.obra_faturamento_serie_mes;
create policy "fat_serie_mes_anon" on public.obra_faturamento_serie_mes for select to anon using (true);
grant all on public.obra_faturamento_serie_mes to service_role;
grant select on public.obra_faturamento_serie_mes to anon, authenticated;
