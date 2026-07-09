-- Migration · Normalização — D.2 BDI (desequilíbrio do BDI não remunerado)
-- D.2 é a VIEW DE DESEQUILÍBRIO do BDI (≠ obra_bdi_rubricas, que é a composição/buildup do C.1):
-- as rubricas tempo-dependentes (Adm Central, Lucro, garantias, seguros) incorrem ao custo mensal
-- cheio, mas a medição (baixa no início) remunera o BDI proporcional ao avanço → gap = desequilíbrio.
-- 3 entidades, todas do workbook (D.2 BDI · Blocos 1/2/6 + Cards + Cenários):
--   obra_bdi_deseq          → params/base + KPIs + cenários (1 linha)
--   obra_bdi_rubrica_tempo  → 6 rubricas de tempo (gasto teórico × remunerado → desequilíbrio)
--   obra_bdi_perda_mensal   → curva da perda do BDI mês a mês (BM 1–46)

-- (a) parâmetros + KPIs + cenários (1 linha por extração)
create table if not exists public.obra_bdi_deseq (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  -- base contratual
  pv_rs numeric,                       -- preço de venda
  bdi_declarado numeric,               -- fração (0,2975)
  custo_direto_rs numeric,
  custo_indireto_rs numeric,
  bm_corrente int,
  meses_contratuais int,               -- 46
  medicao_acum_rs numeric,             -- medição acumulada até o BM
  meses_extensao int,                  -- projeção (0 = sem extensão)
  -- KPIs / totais
  desequilibrio_rs numeric,            -- BDI não remunerado acumulado (realizado)
  pct_sobre_pv numeric,                -- fração
  custo_mensal_tempo_rs numeric,       -- rubricas tempo-dependentes/mês
  gasto_teorico_acum_rs numeric,
  remunerado_acum_rs numeric,
  valor_total_contrato_rs numeric,     -- Σ valor das 6 rubricas de tempo no contrato
  -- cenários
  overhead_mes_rs numeric,             -- overhead de tempo/mês (sem Lucro)
  projecao_extensao_rs numeric,        -- desequilíbrio realizado + projeção da extensão
  delta_reducao_rs numeric,            -- Δ BDI por redução de escopo (cenário A)
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_bdi_deseq_contrato_idx on public.obra_bdi_deseq (contrato_id);
alter table public.obra_bdi_deseq enable row level security;
drop policy if exists "select_bdi_deseq_owner" on public.obra_bdi_deseq;
create policy "select_bdi_deseq_owner" on public.obra_bdi_deseq for select
  using (exists (select 1 from public.obras o where o.id = obra_bdi_deseq.contrato_id and o.created_by = auth.uid()));
drop policy if exists "bdi_deseq_anon" on public.obra_bdi_deseq;
create policy "bdi_deseq_anon" on public.obra_bdi_deseq for select to anon using (true);
grant all on public.obra_bdi_deseq to service_role;
grant select on public.obra_bdi_deseq to anon, authenticated;

-- (b) rubricas de tempo (6 · geram o desequilíbrio)
create table if not exists public.obra_bdi_rubrica_tempo (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  rubrica text not null,
  tipo text,                           -- 'Tempo'
  pct_rubrica numeric,                 -- % do PV (fração)
  valor_contrato_rs numeric,
  incorrido_mes_rs numeric,
  gasto_teorico_acum_rs numeric,
  remunerado_acum_rs numeric,
  desequilibrio_rs numeric,
  obs text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_bdi_rubrica_tempo_contrato_idx on public.obra_bdi_rubrica_tempo (contrato_id);
alter table public.obra_bdi_rubrica_tempo enable row level security;
drop policy if exists "select_bdi_rubrica_tempo_owner" on public.obra_bdi_rubrica_tempo;
create policy "select_bdi_rubrica_tempo_owner" on public.obra_bdi_rubrica_tempo for select
  using (exists (select 1 from public.obras o where o.id = obra_bdi_rubrica_tempo.contrato_id and o.created_by = auth.uid()));
drop policy if exists "bdi_rubrica_tempo_anon" on public.obra_bdi_rubrica_tempo;
create policy "bdi_rubrica_tempo_anon" on public.obra_bdi_rubrica_tempo for select to anon using (true);
grant all on public.obra_bdi_rubrica_tempo to service_role;
grant select on public.obra_bdi_rubrica_tempo to anon, authenticated;

-- (c) perda mensal do BDI não remunerado (curva · BM 1–46)
create table if not exists public.obra_bdi_perda_mensal (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  bm int,
  mes_label text,                      -- 'mar-26'
  gasto_teorico_mes_rs numeric,
  remunerado_mes_rs numeric,
  perda_mes_rs numeric,
  perda_acum_rs numeric,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_bdi_perda_mensal_contrato_idx on public.obra_bdi_perda_mensal (contrato_id);
alter table public.obra_bdi_perda_mensal enable row level security;
drop policy if exists "select_bdi_perda_mensal_owner" on public.obra_bdi_perda_mensal;
create policy "select_bdi_perda_mensal_owner" on public.obra_bdi_perda_mensal for select
  using (exists (select 1 from public.obras o where o.id = obra_bdi_perda_mensal.contrato_id and o.created_by = auth.uid()));
drop policy if exists "bdi_perda_mensal_anon" on public.obra_bdi_perda_mensal;
create policy "bdi_perda_mensal_anon" on public.obra_bdi_perda_mensal for select to anon using (true);
grant all on public.obra_bdi_perda_mensal to service_role;
grant select on public.obra_bdi_perda_mensal to anon, authenticated;
