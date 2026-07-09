-- D.1 Indiretos v2 — corrige o modelo de dados.
--
-- O dado correto JÁ está na extração (obra_secoes): 4 métodos (M2/M2.1/M2.2/M3),
-- bases gasto/medido/real/contratado, decomposição em 29 grupos da Adm Local, e os
-- 2 cenários (redução/extensão). O resolver antigo lia a seção errada e somava os
-- cenários no total (R$ 31,9 mi). Esta migration estende o schema pro modelo certo:
--   • total = método ativo (M2.2 = R$ 2.491.837), NÃO soma de cenários;
--   • métodos guardam o par comparado (valor_a − valor_b) + código + pendente;
--   • nova tabela de itens (29 grupos contratado×real do M2);
--   • cenários (redução/extensão) ficam guardados mas NÃO entram na D.1 (alimentam D.10).
-- Aditiva e idempotente.

-- ── base: bases dos métodos + PV + cenários ──────────────────────────────────
alter table public.obra_indiretos_base add column if not exists gasto_acum numeric;
alter table public.obra_indiretos_base add column if not exists medido_acum numeric;
alter table public.obra_indiretos_base add column if not exists real_acum numeric;
alter table public.obra_indiretos_base add column if not exists contratado_acum numeric;
alter table public.obra_indiretos_base add column if not exists pv numeric;
alter table public.obra_indiretos_base add column if not exists percent_pv numeric;
alter table public.obra_indiretos_base add column if not exists prazo_meses integer;
alter table public.obra_indiretos_base add column if not exists bm_corrente integer;
alter table public.obra_indiretos_base add column if not exists reducao_pct numeric;
alter table public.obra_indiretos_base add column if not exists extensao_meses numeric;
-- reducao_escopo + desequilibrio_extensao (já existentes) = TOTAL de cada cenário.

-- ── métodos: par comparado + código + flag pendente ──────────────────────────
alter table public.obra_indiretos_metodos add column if not exists codigo text;
alter table public.obra_indiretos_metodos add column if not exists comparacao text;
alter table public.obra_indiretos_metodos add column if not exists valor_a numeric;
alter table public.obra_indiretos_metodos add column if not exists valor_b numeric;
alter table public.obra_indiretos_metodos add column if not exists pendente boolean not null default false;

-- ── itens: 29 grupos da Adm Local (M2 · contratado × real) ───────────────────
create table if not exists public.obra_indiretos_itens (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null,
  arquivo_id uuid,
  extracao_version text,
  config_version text,
  ordem integer not null,
  grupo text not null,
  qtd_contr numeric,
  qtd_real numeric,
  custo_contr numeric,
  custo_real numeric,
  delta_custo numeric,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);
create index if not exists idx_obra_indiretos_itens_contrato
  on public.obra_indiretos_itens (contrato_id);

-- RLS + grants no mesmo padrão das demais read-models (leitura pública anon + authenticated).
alter table public.obra_indiretos_itens enable row level security;
drop policy if exists obra_indiretos_itens_anon_read on public.obra_indiretos_itens;
create policy obra_indiretos_itens_anon_read on public.obra_indiretos_itens
  for select to anon using (true);
drop policy if exists obra_indiretos_itens_auth_read on public.obra_indiretos_itens;
create policy obra_indiretos_itens_auth_read on public.obra_indiretos_itens
  for select to authenticated using (true);
grant select on public.obra_indiretos_itens to anon, authenticated;
