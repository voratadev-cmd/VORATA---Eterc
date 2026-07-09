-- Migration · Normalização — C.3 FATURAMENTO POR DISCIPLINA · resumo (drill "Por Disciplina")
-- A seção template "C.3 — Faturamento por Disciplina" (15 disciplinas finas: Mobilização, Desmobilização,
-- Terraplenagem, …) × Contratado Total/Acum × Real Acum × % × Farol. Distinta de obra_faturamento_frentes
-- (coarse, 12 disc, sem real): ESTA traz o REAL ALOCADO por disciplina (Mobilização 5,33M, Terraplenagem
-- 1,02M…) que acende os faróis do drill. Σ Contratado Total = PV (611M · gate). Lida por estrutura no
-- resolver (sem hardcode). ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_faturamento_disciplina_resumo (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  disciplina text not null,
  servico boolean,                     -- disciplina de serviço (campo) × não-serviço (Adm/Insumo)
  contratado_total_rs numeric,         -- contratado total da disciplina (Σ = PV)
  contratado_acum_rs numeric,          -- contratado acumulado até o BM
  real_acum_rs numeric,                -- real medido por disciplina · NULL se não alocado (não 0)
  pct numeric,                         -- aderência (real / contratado-acum) · NULL se real pendente
  farol text,                          -- farol da fonte (cru, ex.: "● Risco") · NULL se real pendente
  real_pendente boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_fat_disc_resumo_contrato_idx on public.obra_faturamento_disciplina_resumo (contrato_id);
alter table public.obra_faturamento_disciplina_resumo enable row level security;
drop policy if exists "select_fat_disc_resumo_owner" on public.obra_faturamento_disciplina_resumo;
create policy "select_fat_disc_resumo_owner" on public.obra_faturamento_disciplina_resumo for select
  using (exists (select 1 from public.obras o where o.id = obra_faturamento_disciplina_resumo.contrato_id and o.created_by = auth.uid()));
drop policy if exists "fat_disc_resumo_anon" on public.obra_faturamento_disciplina_resumo;
create policy "fat_disc_resumo_anon" on public.obra_faturamento_disciplina_resumo for select to anon using (true);
grant all on public.obra_faturamento_disciplina_resumo to service_role;
grant select on public.obra_faturamento_disciplina_resumo to anon, authenticated;
