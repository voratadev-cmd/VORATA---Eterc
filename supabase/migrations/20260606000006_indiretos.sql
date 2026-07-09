-- Migration · Normalização (Camada A) — D.1 INDIRETOS (M3 · maior componente do desequilíbrio)
-- ─────────────────────────────────────────────────────────────────────
-- Métodos paralelos de cálculo (M1 PSQ · M2 RDO×SICRO · M3 contábil · M4 comparativo) + a base
-- (Adm Local cheio/mensal, cenário A redução-escopo, cenário B extensão). Composição = mensal +
-- redução + extensão = 31,99M (cruza com D.0 D.1 no gate). Idempotente por obra/version.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_indiretos_base (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  adm_local_cheio numeric,         -- custo cheio da Adm Local no contrato (R$)
  adm_local_mensal numeric,        -- custo mensal da Adm Local (R$)
  reducao_escopo numeric,          -- cenário A: redução de escopo adicional (R$)
  desequilibrio_extensao numeric,  -- cenário B: desequilíbrio na extensão de prazo (R$)
  custo_direto numeric,            -- CD (== BDI)
  metodo_ativo text,               -- método de cálculo ativo (ex.: 'M1')
  desequilibrio_total numeric,     -- mensal + redução + extensão (== D.0 D.1)
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);

create table if not exists public.obra_indiretos_metodos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  metodo text not null,            -- 'M1 — PSQ Contratada' etc.
  desequilibrio_rs numeric,
  medido_rs numeric,
  defensabilidade int,             -- nº de estrelas (1-5)
  ativo boolean not null default false,
  obs text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);

create index if not exists obra_indiretos_base_contrato_idx on public.obra_indiretos_base (contrato_id);
create index if not exists obra_indiretos_metodos_contrato_idx on public.obra_indiretos_metodos (contrato_id);

alter table public.obra_indiretos_base enable row level security;
alter table public.obra_indiretos_metodos enable row level security;

drop policy if exists "select_indbase_owner" on public.obra_indiretos_base;
create policy "select_indbase_owner" on public.obra_indiretos_base for select
  using (exists (select 1 from public.obras o where o.id = obra_indiretos_base.contrato_id and o.created_by = auth.uid()));
drop policy if exists "indbase_anon" on public.obra_indiretos_base;
create policy "indbase_anon" on public.obra_indiretos_base for select to anon using (true);
drop policy if exists "select_indmet_owner" on public.obra_indiretos_metodos;
create policy "select_indmet_owner" on public.obra_indiretos_metodos for select
  using (exists (select 1 from public.obras o where o.id = obra_indiretos_metodos.contrato_id and o.created_by = auth.uid()));
drop policy if exists "indmet_anon" on public.obra_indiretos_metodos;
create policy "indmet_anon" on public.obra_indiretos_metodos for select to anon using (true);

grant all on public.obra_indiretos_base to service_role;
grant all on public.obra_indiretos_metodos to service_role;
grant select on public.obra_indiretos_base to anon, authenticated;
grant select on public.obra_indiretos_metodos to anon, authenticated;
