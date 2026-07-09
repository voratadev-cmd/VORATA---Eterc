-- Migration · Normalização — D.4 Valor Agregado · SÉRIE MENSAL (para o gráfico VA × Custo Alocado)
-- A aba "D.4 Valor Agregado" traz a série mês-a-mês (VA medido e Real alocado por categoria, por
-- mês de medição). 1 linha = 1 mês COM produção (mês sem produção = 0 por default de fórmula, não
-- entra). O acumulado do gráfico é derivado (cumsum) e cruzado contra as linhas-acum da aba. Gate:
-- Σ mensal por categoria == VA/Real do resumo (obra_valor_agregado). ADITIVO.

create table if not exists public.obra_valor_agregado_mes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  ano int not null,
  mes int not null,                  -- 1..12
  periodo_label text,                -- 'abr-26'
  va_mod_rs numeric,                 -- VA medido MOD no mês (R$)
  va_eqp_rs numeric,                 -- VA medido EQP no mês (R$)
  real_mod_rs numeric,              -- Real alocado MOD no mês (R$)
  real_eqp_rs numeric,             -- Real alocado EQP no mês (R$)
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ano, mes)
);
create index if not exists obra_valor_agregado_mes_contrato_idx on public.obra_valor_agregado_mes (contrato_id);
alter table public.obra_valor_agregado_mes enable row level security;
drop policy if exists "select_va_mes_owner" on public.obra_valor_agregado_mes;
create policy "select_va_mes_owner" on public.obra_valor_agregado_mes for select
  using (exists (select 1 from public.obras o where o.id = obra_valor_agregado_mes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "va_mes_anon" on public.obra_valor_agregado_mes;
create policy "va_mes_anon" on public.obra_valor_agregado_mes for select to anon using (true);
grant all on public.obra_valor_agregado_mes to service_role;
grant select on public.obra_valor_agregado_mes to anon, authenticated;
