-- Migration · Normalização (Camada A) — PRODUTIVIDADE (Controle de Armação e Concreto)
-- ─────────────────────────────────────────────────────────────────────
-- Produtividade REAL (kg de aço por person-hora) consolidada das tabelas diárias de armação.
-- DECISÃO DE DOMÍNIO: o 'produtMediaArmacao' do Dashboard do XLSX é MÉDIA ARITMÉTICA das razões
-- diárias (estatisticamente errada) — NÃO persistimos. `produtividade_real_kg_ph` = Σaço/Σ(horas×
-- armadores), recomputado pelo resolver. `avanco_fisico_pct` é CONTEXTO (suplementar — o avanço
-- oficial é o BM-03, §4.1). `indice_perda_pct_raw` é CRU: > 100% é anomalia de unidade/fórmula na
-- origem (vira finding, não verdade limpa). Parent (1 por arquivo) + child mensal. Idempotente.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_produtividade (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  aco_total_kg numeric,
  person_horas_total numeric,
  produtividade_real_kg_ph numeric,        -- REAL = Σaço/Σperson-h (NÃO o KPI errado do dashboard)
  avanco_fisico_pct numeric,               -- contexto · suplementar (oficial = BM-03 · §4.1)
  indice_perda_pct_raw numeric,            -- CRU · > 100% = anomalia de origem (ver findings)
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);

create index if not exists obra_produtividade_contrato_idx
  on public.obra_produtividade (contrato_id);

create table if not exists public.obra_produtividade_meses (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  produtividade_id uuid not null references public.obra_produtividade(id) on delete cascade,
  ano int not null,
  mes int not null,
  aco_kg numeric,
  person_horas numeric,
  produtividade_kg_ph numeric,
  n_dias int,
  unique (produtividade_id, ano, mes)
);

create index if not exists obra_produtividade_meses_contrato_idx
  on public.obra_produtividade_meses (contrato_id);

-- RLS · dono lê; anon lê (dev); worker (service_role) escreve e bypassa.
alter table public.obra_produtividade enable row level security;
alter table public.obra_produtividade_meses enable row level security;

drop policy if exists "select_produtividade_by_obra_owner" on public.obra_produtividade;
create policy "select_produtividade_by_obra_owner"
  on public.obra_produtividade for select
  using (exists (select 1 from public.obras o
    where o.id = obra_produtividade.contrato_id and o.created_by = auth.uid()));
drop policy if exists "obra_produtividade_anon_select" on public.obra_produtividade;
create policy "obra_produtividade_anon_select"
  on public.obra_produtividade for select to anon using (true);

drop policy if exists "select_produtividade_mes_by_obra_owner" on public.obra_produtividade_meses;
create policy "select_produtividade_mes_by_obra_owner"
  on public.obra_produtividade_meses for select
  using (exists (select 1 from public.obras o
    where o.id = obra_produtividade_meses.contrato_id and o.created_by = auth.uid()));
drop policy if exists "obra_produtividade_meses_anon_select" on public.obra_produtividade_meses;
create policy "obra_produtividade_meses_anon_select"
  on public.obra_produtividade_meses for select to anon using (true);

grant all on public.obra_produtividade to service_role;
grant all on public.obra_produtividade_meses to service_role;
grant select on public.obra_produtividade to anon, authenticated;
grant select on public.obra_produtividade_meses to anon, authenticated;
