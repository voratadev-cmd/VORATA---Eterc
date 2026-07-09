-- Migration · Normalização (Camada A) — C.9 CHUVAS (RMA · análise pluviométrica · obra a céu aberto)
-- Série mensal chuva prevista (baseline histórico) × real (input) + dias parados + resumo de
-- impedimentos (R$ impedido, frentes não iniciadas, sinistro principal). Chuva real é input →
-- pendente. obra_chuvas (1 row · resumo) + obra_chuvas_meses (série). Idempotente por obra/version.

create table if not exists public.obra_chuvas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  impedido_total_rs numeric,        -- R$ impedido por chuva/força maior
  liberado_total_rs numeric,        -- R$ liberado para execução
  frentes_nao_iniciadas int,        -- nº de frentes ainda não iniciadas
  principal_impedido text,          -- maior impedimento (ex.: 'Sinistro Talude 148+700 Sul')
  chuva_prev_total numeric,         -- Σ chuva prevista no horizonte (mm)
  eixo_real_vazio boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);

create table if not exists public.obra_chuvas_meses (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  mes_obra text,                    -- M1, M2…
  periodo text,                     -- mar/26
  chuva_prev_mm numeric,            -- chuva prevista no mês (baseline histórico)
  chuva_real_mm numeric,            -- chuva real medida (input · NULL até medir)
  chuva_prev_acum numeric,
  chuva_real_acum numeric,
  dias_parados numeric,
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);

create index if not exists obra_chuvas_contrato_idx on public.obra_chuvas (contrato_id);
create index if not exists obra_chuvas_meses_contrato_idx on public.obra_chuvas_meses (contrato_id);

alter table public.obra_chuvas enable row level security;
alter table public.obra_chuvas_meses enable row level security;
drop policy if exists "select_chuvas_owner" on public.obra_chuvas;
create policy "select_chuvas_owner" on public.obra_chuvas for select
  using (exists (select 1 from public.obras o where o.id = obra_chuvas.contrato_id and o.created_by = auth.uid()));
drop policy if exists "chuvas_anon" on public.obra_chuvas;
create policy "chuvas_anon" on public.obra_chuvas for select to anon using (true);
drop policy if exists "select_chuvasm_owner" on public.obra_chuvas_meses;
create policy "select_chuvasm_owner" on public.obra_chuvas_meses for select
  using (exists (select 1 from public.obras o where o.id = obra_chuvas_meses.contrato_id and o.created_by = auth.uid()));
drop policy if exists "chuvasm_anon" on public.obra_chuvas_meses;
create policy "chuvasm_anon" on public.obra_chuvas_meses for select to anon using (true);

grant all on public.obra_chuvas to service_role;
grant all on public.obra_chuvas_meses to service_role;
grant select on public.obra_chuvas to anon, authenticated;
grant select on public.obra_chuvas_meses to anon, authenticated;
