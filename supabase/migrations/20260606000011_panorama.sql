-- Migration · Normalização (Camada A) — C.10 PANORAMA DO CONTRATO (RMA · faróis multidimensionais)
-- Visão consolidada: 6 dimensões (projetos, interferências, liberações de área, clima/força maior,
-- preços/quantidades, suprimentos/material) + consolidado + métricas. Faróis NULL = dimensão não
-- avaliada (pendente, não verde). 1 row por obra/version.

create table if not exists public.obra_panorama (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  consolidado text,                       -- pior farol consolidado (conforme/observacao/risco/critico)
  farol_projetos text,
  farol_interferencias text,
  farol_liberacoes_area text,
  farol_clima_forca_maior text,
  farol_precos_quantidades text,
  farol_suprimentos_material text,
  pct_areas_liberadas numeric,            -- fração 0..1
  dias_parados_acum numeric,
  frentes_impedidas_rs numeric,           -- R$ de frentes impedidas hoje
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_panorama_contrato_idx on public.obra_panorama (contrato_id);
alter table public.obra_panorama enable row level security;
drop policy if exists "select_panorama_owner" on public.obra_panorama;
create policy "select_panorama_owner" on public.obra_panorama for select
  using (exists (select 1 from public.obras o where o.id = obra_panorama.contrato_id and o.created_by = auth.uid()));
drop policy if exists "panorama_anon" on public.obra_panorama;
create policy "panorama_anon" on public.obra_panorama for select to anon using (true);
grant all on public.obra_panorama to service_role;
grant select on public.obra_panorama to anon, authenticated;
