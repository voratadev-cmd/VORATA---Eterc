-- Migration · Normalização — C.7 Produtividade (refactor: financeira + FÍSICA, do dado real)
-- A série mensal financeira já vive em obra_produtividade_economica. Esta migration normaliza o que
-- faltava (e estava como EmptyState / config hardcoded):
--   obra_produtividade_params          → KPIs/cards + benchmarks + META REAL + jornadas + ponte (1 linha)
--   obra_produtividade_fisica          → tracker serviço×trecho (CPU un/h × real · 13 linhas)
--   obra_produtividade_fisica_detalhe  → detalhe do cálculo por equipamento (Trecho 1 · equip-horas)
--   obra_produtividade_impedimento     → impedimentos documentados (D.6 · HH ociosas)
-- META vem do dado (R$ 229,95 = valor total ÷ HH total previsto atual), aposentando o config 340,33
-- defasado. Capacidade da ponte = 47,7% (seção C.7 Sinais, dedicada · não o 70,6 da C.8).

create table if not exists public.obra_produtividade_params (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  bm_corrente int,
  base_hh text,                          -- 'MOD+MOI'
  valor_total_contratado numeric,
  jornada_mod_h_mes numeric,
  jornada_moi_h_mes numeric,
  -- cards financeiros (acum até BM)
  contratada_periodo_rs_hh numeric,
  faturado_acum_rs numeric,
  hh_real_acum numeric,
  hh_contratado_acum numeric,
  real_acum_rs_hh numeric,
  real_mes_rs_hh numeric,
  aderencia_acum numeric,                -- fração
  meta_projeto_rs_hh numeric,            -- REAL (229,95), não o config 340,33
  farol_aderencia text,
  -- benchmark (vem do workbook desta obra · não config)
  cambio numeric,
  bmk_aterpa_rs_hh numeric,
  bmk_setor_rs_hh numeric,
  real_div_aterpa numeric,
  real_div_setor numeric,
  farol_bmk text,
  -- ponte: utilização × liberação (C.7 Sinais)
  ponte_pct_liberado numeric,
  ponte_pct_aproveitamento numeric,
  ponte_pct_capacidade numeric,          -- 47,7% (C.7 Sinais)
  ponte_ociosidade_hh numeric,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_produtividade_params_contrato_idx on public.obra_produtividade_params (contrato_id);
alter table public.obra_produtividade_params enable row level security;
drop policy if exists "select_prod_params_owner" on public.obra_produtividade_params;
create policy "select_prod_params_owner" on public.obra_produtividade_params for select
  using (exists (select 1 from public.obras o where o.id = obra_produtividade_params.contrato_id and o.created_by = auth.uid()));
drop policy if exists "prod_params_anon" on public.obra_produtividade_params;
create policy "prod_params_anon" on public.obra_produtividade_params for select to anon using (true);
grant all on public.obra_produtividade_params to service_role;
grant select on public.obra_produtividade_params to anon, authenticated;

create table if not exists public.obra_produtividade_fisica (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  disciplina text,
  servico text not null,
  trecho text,
  unidade text,
  qtd_contratada numeric,
  qtd_medida numeric,
  pct_fisico numeric,                    -- fração (medida ÷ contratada)
  cpu_un_h numeric,                      -- produção CPU (un/h por equip)
  real_un_h numeric,                     -- produtividade real medida
  aderencia numeric,                     -- fração (real ÷ CPU)
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_produtividade_fisica_contrato_idx on public.obra_produtividade_fisica (contrato_id);
alter table public.obra_produtividade_fisica enable row level security;
drop policy if exists "select_prod_fisica_owner" on public.obra_produtividade_fisica;
create policy "select_prod_fisica_owner" on public.obra_produtividade_fisica for select
  using (exists (select 1 from public.obras o where o.id = obra_produtividade_fisica.contrato_id and o.created_by = auth.uid()));
drop policy if exists "prod_fisica_anon" on public.obra_produtividade_fisica;
create policy "prod_fisica_anon" on public.obra_produtividade_fisica for select to anon using (true);
grant all on public.obra_produtividade_fisica to service_role;
grant select on public.obra_produtividade_fisica to anon, authenticated;

create table if not exists public.obra_produtividade_fisica_detalhe (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  servico text not null,
  frente text,
  unidade text,
  cpu_un_h numeric,
  equip_principal text,
  qtd_executada numeric,
  dias_servico int,                      -- dias c/ serviço (RDO)
  equip_dia numeric,
  equip_horas numeric,
  real_un_h numeric,
  aderencia numeric,
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_produtividade_fis_det_contrato_idx on public.obra_produtividade_fisica_detalhe (contrato_id);
alter table public.obra_produtividade_fisica_detalhe enable row level security;
drop policy if exists "select_prod_fis_det_owner" on public.obra_produtividade_fisica_detalhe;
create policy "select_prod_fis_det_owner" on public.obra_produtividade_fisica_detalhe for select
  using (exists (select 1 from public.obras o where o.id = obra_produtividade_fisica_detalhe.contrato_id and o.created_by = auth.uid()));
drop policy if exists "prod_fis_det_anon" on public.obra_produtividade_fisica_detalhe;
create policy "prod_fis_det_anon" on public.obra_produtividade_fisica_detalhe for select to anon using (true);
grant all on public.obra_produtividade_fisica_detalhe to service_role;
grant select on public.obra_produtividade_fisica_detalhe to anon, authenticated;

create table if not exists public.obra_produtividade_impedimento (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  impedimento text not null,
  periodo text,
  hh_ociosas numeric,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_produtividade_imped_contrato_idx on public.obra_produtividade_impedimento (contrato_id);
alter table public.obra_produtividade_impedimento enable row level security;
drop policy if exists "select_prod_imped_owner" on public.obra_produtividade_impedimento;
create policy "select_prod_imped_owner" on public.obra_produtividade_impedimento for select
  using (exists (select 1 from public.obras o where o.id = obra_produtividade_impedimento.contrato_id and o.created_by = auth.uid()));
drop policy if exists "prod_imped_anon" on public.obra_produtividade_impedimento;
create policy "prod_imped_anon" on public.obra_produtividade_impedimento for select to anon using (true);
grant all on public.obra_produtividade_impedimento to service_role;
grant select on public.obra_produtividade_impedimento to anon, authenticated;
