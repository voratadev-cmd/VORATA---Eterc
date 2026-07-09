-- Migration · Normalização (Camada A) — CPU COEFICIENTES (base de custo de TUDO · 558 CPUs)
-- Composição de Preço Unitário: cada serviço decomposto em custo direto + MOD R$/un + EQP R$/un +
-- %MOD/%EQP/%Mat. Base do orçamento, da produtividade (R$/HH) e do desequilíbrio. Invariante R$:
-- MOD+EQP ≤ custo direto (~99%). O "%" da planilha tem variabilidade na fonte → guardado as-is.

create table if not exists public.obra_cpu_coeficientes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  codigo_cpu text,
  servico text not null,
  unidade text,
  tipo text,                    -- Principal / Auxiliar
  custo_direto_unit numeric,    -- R$/un
  mod_rs_un numeric,
  eqp_rs_un numeric,
  pct_mod numeric,              -- "%" da fonte (variável · as-is)
  pct_eqp numeric,
  pct_mat numeric,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_cpu_coeficientes_contrato_idx on public.obra_cpu_coeficientes (contrato_id);
alter table public.obra_cpu_coeficientes enable row level security;
drop policy if exists "select_cpu_owner" on public.obra_cpu_coeficientes;
create policy "select_cpu_owner" on public.obra_cpu_coeficientes for select
  using (exists (select 1 from public.obras o where o.id = obra_cpu_coeficientes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "cpu_anon" on public.obra_cpu_coeficientes;
create policy "cpu_anon" on public.obra_cpu_coeficientes for select to anon using (true);
grant all on public.obra_cpu_coeficientes to service_role;
grant select on public.obra_cpu_coeficientes to anon, authenticated;
