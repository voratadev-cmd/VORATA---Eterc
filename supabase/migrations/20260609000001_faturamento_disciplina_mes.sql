-- Migration · Normalização — C.3 FATURAMENTO · MATRIZ DISCIPLINA × MÊS (caderno SaaS A114:L157)
-- A explosão 2D da curva financeira: PREVISTO mensal por disciplina (12 disc × 46 meses · BR-101).
-- O REAL é input do RDO/medição e NÃO vem isolado na fonte → real_rs/deficit_rs NULL (pendente) e
-- real_pendente=true; nunca 0 fabricado. Σ matriz ≈ PV (== Σ curva) + cross-check por mês (gate).
-- ADITIVO: não toca nenhuma tabela existente — só adiciona a matriz nova (resto da obra intacto).

create table if not exists public.obra_faturamento_disciplina_mes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  disciplina text not null,
  mes_num int not null,          -- ordinal do mês na matriz (1..46)
  ano int,                       -- competência derivada da curva C.3 (NULL se sem curva-âncora)
  mes int,
  periodo_label text,
  previsto_rs numeric,           -- PREVISTO mensal (distribuição do contratado · cronograma fís-fin)
  real_rs numeric,               -- input do RDO · NULL até a medição (não 0 fabricado)
  deficit_rs numeric,            -- real − previsto · NULL enquanto real pendente
  real_pendente boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_fat_disc_mes_contrato_idx on public.obra_faturamento_disciplina_mes (contrato_id);
create index if not exists obra_fat_disc_mes_disc_idx on public.obra_faturamento_disciplina_mes (contrato_id, disciplina);
alter table public.obra_faturamento_disciplina_mes enable row level security;
drop policy if exists "select_fat_dm_owner" on public.obra_faturamento_disciplina_mes;
create policy "select_fat_dm_owner" on public.obra_faturamento_disciplina_mes for select
  using (exists (select 1 from public.obras o where o.id = obra_faturamento_disciplina_mes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "fat_dm_anon" on public.obra_faturamento_disciplina_mes;
create policy "fat_dm_anon" on public.obra_faturamento_disciplina_mes for select to anon using (true);
grant all on public.obra_faturamento_disciplina_mes to service_role;
grant select on public.obra_faturamento_disciplina_mes to anon, authenticated;
