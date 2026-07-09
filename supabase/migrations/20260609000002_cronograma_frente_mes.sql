-- Migration · Normalização — C.5 PRAZO · MATRIZ FÍSICA POR FRENTE/DISCIPLINA × MÊS (caderno A140:AW151)
-- % físico PREVISTO acumulado por disciplina (12 × 46 meses · BR-101) — alimenta o seletor por frente
-- do gráfico de avanço físico do Prazo. "frente" = disciplina/serviço (vocabulário do Prazo). % é
-- FRAÇÃO (0..~1,0). O % REAL é input do RDO → real_pct NULL (pendente) + real_pendente=true; nunca 0.
-- Gate TIGHT: matriz[corte] == snapshot "Atraso físico por disciplina (% até BM)" + monotônico.
-- ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_cronograma_frente_mes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  disciplina text not null,
  mes_num int not null,          -- ordinal do mês (M01..M46)
  previsto_pct numeric,          -- % físico previsto ACUMULADO · FRAÇÃO (0..~1,0)
  real_pct numeric,              -- input do RDO · NULL até a medição (não 0 fabricado)
  real_pendente boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_cron_frente_mes_contrato_idx on public.obra_cronograma_frente_mes (contrato_id);
create index if not exists obra_cron_frente_mes_disc_idx on public.obra_cronograma_frente_mes (contrato_id, disciplina);
alter table public.obra_cronograma_frente_mes enable row level security;
drop policy if exists "select_cron_fm_owner" on public.obra_cronograma_frente_mes;
create policy "select_cron_fm_owner" on public.obra_cronograma_frente_mes for select
  using (exists (select 1 from public.obras o where o.id = obra_cronograma_frente_mes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "cron_fm_anon" on public.obra_cronograma_frente_mes;
create policy "cron_fm_anon" on public.obra_cronograma_frente_mes for select to anon using (true);
grant all on public.obra_cronograma_frente_mes to service_role;
grant select on public.obra_cronograma_frente_mes to anon, authenticated;
