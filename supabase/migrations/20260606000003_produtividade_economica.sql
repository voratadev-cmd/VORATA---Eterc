-- Migration · Normalização (Camada A) — PRODUTIVIDADE ECONÔMICA (R$/HH · C.7)
-- ─────────────────────────────────────────────────────────────────────
-- Do workbook-motor C.7: série mensal de produtividade ECONÔMICA (faturado R$, HH previsto/real,
-- R$/HH, aderência) — distinta da produtividade FÍSICA (kg/Hh do Controle de Armação, em
-- obra_produtividade). Tabela FLAT, idempotente por (contrato,arquivo,version,ano,mes).
-- Gate de conservação: Σ HH previsto == card hhTotalPrevisto. HH real é PARCIAL (obra em execução).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_produtividade_economica (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ano int not null,
  mes int not null,
  periodo_label text,
  faturado_rs numeric,        -- faturado no mês (R$)
  hh_previsto numeric,        -- homem-hora previsto do mês
  hh_real numeric,            -- homem-hora real (NULL/0 até a obra medir)
  rs_por_hh numeric,          -- R$/HH real do mês (produtividade econômica)
  aderencia numeric,          -- razão R$/HH real ÷ R$/HH contratado (índice econômico; >1 = HH rendeu mais R$ que o contratado)
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ano, mes)
);

create index if not exists obra_produtividade_economica_contrato_idx
  on public.obra_produtividade_economica (contrato_id);

alter table public.obra_produtividade_economica enable row level security;

drop policy if exists "select_prodecon_by_obra_owner" on public.obra_produtividade_economica;
create policy "select_prodecon_by_obra_owner"
  on public.obra_produtividade_economica for select
  using (exists (select 1 from public.obras o
                 where o.id = obra_produtividade_economica.contrato_id and o.created_by = auth.uid()));
drop policy if exists "obra_produtividade_economica_anon_select" on public.obra_produtividade_economica;
create policy "obra_produtividade_economica_anon_select"
  on public.obra_produtividade_economica for select to anon using (true);

grant all on public.obra_produtividade_economica to service_role;
grant select on public.obra_produtividade_economica to anon, authenticated;
