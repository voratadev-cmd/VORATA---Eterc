-- Migration · Normalização — D.6 Análises Pontuais (eventos de paralisação/ociosidade)
-- Paralisações/ociosidades documentadas evento a evento (chuva excedente + impedimentos de frente).
-- HONESTIDADE: a perda é VALIDADA = R$ 0 (não soma ao desequilíbrio) — fica como DOSSIÊ pendente
-- (R$ 763.277) p/ não dobrar contagem com a D.4 (macro); a escolha macro×eventos é feita no D.10.
-- 4 entidades:
--   obra_pontuais_evento        → 4 eventos (chuva-resumo + 3 impedimentos) · unificado
--   obra_pontuais_chuva_mensal  → memória de cálculo da chuva (líquida da prevista · mês a mês)
--   obra_pontuais_chuva_dia     → ociosidade por chuva dia a dia (equipe afetada · dias >5mm)
--   obra_pontuais_params        → jornada/custos-hora + cards do resumo (1 linha)

create table if not exists public.obra_pontuais_evento (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  categoria text,                      -- 'Chuva' | 'Frente bloqueada' | 'Retrabalho' | 'Outros'
  titulo text not null,
  periodo text,                        -- janela (col Data: '10/03–07/06', '08/05 →')
  duracao text,                        -- '27 dias / 41 períodos' | 'em aberto' | 'contínuo'
  descricao text,                      -- transcrição RDO/doc (vira a anotação da ficha)
  dias int,
  -- equipe afetada (impedimentos · por subtração); null p/ chuva
  mod_total numeric,
  mod_frentes_ativas numeric,
  mod_afetado numeric,
  eqp_total numeric,
  eqp_frentes_ativas numeric,
  eqp_afetado numeric,
  hh_ociosas numeric,                  -- HH MOD paradas (líquida da prevista p/ chuva)
  heq_ociosas numeric,
  -- valores
  custo_mod_rs numeric,                -- hh_ociosas × custo-hora MOD
  custo_eqp_rs numeric,                -- heq_ociosas × custo-hora EQP
  custo_rs numeric,                    -- perda do evento (pendente · não validada)
  fonte text,                          -- referência ATA/RDO
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_pontuais_evento_contrato_idx on public.obra_pontuais_evento (contrato_id);
alter table public.obra_pontuais_evento enable row level security;
drop policy if exists "select_pontuais_evento_owner" on public.obra_pontuais_evento;
create policy "select_pontuais_evento_owner" on public.obra_pontuais_evento for select
  using (exists (select 1 from public.obras o where o.id = obra_pontuais_evento.contrato_id and o.created_by = auth.uid()));
drop policy if exists "pontuais_evento_anon" on public.obra_pontuais_evento;
create policy "pontuais_evento_anon" on public.obra_pontuais_evento for select to anon using (true);
grant all on public.obra_pontuais_evento to service_role;
grant select on public.obra_pontuais_evento to anon, authenticated;

create table if not exists public.obra_pontuais_chuva_mensal (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  mes_label text,
  real_5mm numeric,
  prev_5mm numeric,
  excedente numeric,
  fracao_excedente numeric,
  pleiteavel_mod_rs numeric,
  pleiteavel_eqp_rs numeric,
  total_mes_rs numeric,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_pontuais_chuva_mensal_contrato_idx on public.obra_pontuais_chuva_mensal (contrato_id);
alter table public.obra_pontuais_chuva_mensal enable row level security;
drop policy if exists "select_pont_chuva_mes_owner" on public.obra_pontuais_chuva_mensal;
create policy "select_pont_chuva_mes_owner" on public.obra_pontuais_chuva_mensal for select
  using (exists (select 1 from public.obras o where o.id = obra_pontuais_chuva_mensal.contrato_id and o.created_by = auth.uid()));
drop policy if exists "pont_chuva_mes_anon" on public.obra_pontuais_chuva_mensal;
create policy "pont_chuva_mes_anon" on public.obra_pontuais_chuva_mensal for select to anon using (true);
grant all on public.obra_pontuais_chuva_mensal to service_role;
grant select on public.obra_pontuais_chuva_mensal to anon, authenticated;

create table if not exists public.obra_pontuais_chuva_dia (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  data_label text,
  chuva_mm numeric,
  acima_5mm boolean,
  periodos_afetados int,
  efetivo_rdo numeric,
  hh_ociosas numeric,
  custo_ocioso_rs numeric,
  equip_producao numeric,
  heq_ociosas numeric,
  custo_eqp_rs numeric,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_pontuais_chuva_dia_contrato_idx on public.obra_pontuais_chuva_dia (contrato_id);
alter table public.obra_pontuais_chuva_dia enable row level security;
drop policy if exists "select_pont_chuva_dia_owner" on public.obra_pontuais_chuva_dia;
create policy "select_pont_chuva_dia_owner" on public.obra_pontuais_chuva_dia for select
  using (exists (select 1 from public.obras o where o.id = obra_pontuais_chuva_dia.contrato_id and o.created_by = auth.uid()));
drop policy if exists "pont_chuva_dia_anon" on public.obra_pontuais_chuva_dia;
create policy "pont_chuva_dia_anon" on public.obra_pontuais_chuva_dia for select to anon using (true);
grant all on public.obra_pontuais_chuva_dia to service_role;
grant select on public.obra_pontuais_chuva_dia to anon, authenticated;

create table if not exists public.obra_pontuais_params (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  jornada_dia_h numeric,
  custo_hora_mod_rs numeric,
  custo_hora_eqp_rs numeric,
  perda_validada_rs numeric,           -- R$ 0 (não soma · dedup com D.4)
  pendente_total_rs numeric,           -- R$ 763.277 (dossiê)
  eventos_pendentes int,
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_pontuais_params_contrato_idx on public.obra_pontuais_params (contrato_id);
alter table public.obra_pontuais_params enable row level security;
drop policy if exists "select_pontuais_params_owner" on public.obra_pontuais_params;
create policy "select_pontuais_params_owner" on public.obra_pontuais_params for select
  using (exists (select 1 from public.obras o where o.id = obra_pontuais_params.contrato_id and o.created_by = auth.uid()));
drop policy if exists "pontuais_params_anon" on public.obra_pontuais_params;
create policy "pontuais_params_anon" on public.obra_pontuais_params for select to anon using (true);
grant all on public.obra_pontuais_params to service_role;
grant select on public.obra_pontuais_params to anon, authenticated;
