-- Migration · Normalização — C.3 FATURAMENTO POR FRENTE NOMEADA + MACRO (drill "Por Frente")
-- A seção template "C.3 — Faturamento por Frente": Macro (Pista—Trechos / OAEs-Pontes / Dispositivos / …)
-- × Frente NOMEADA (Trecho 01 — KM…, Pte Rio Macaé, Disp. KM 152,20) × Contratado Total/Acum × Real Acum.
-- Σ Contratado Total = PV (611M · gate de conservação). Fonte ROBUSTA dos rótulos do drill "Por Frente":
-- cada obra traz as SUAS frentes (lido por estrutura no resolver, sem hardcode de KM). Distinto de
-- obra_faturamento_frentes (resumo por DISCIPLINA, sem macro). Real é INPUT alocado → NULL até a medição
-- ratear por frente (PENDENTE ≠ 0). ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_faturamento_frente_macro (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  macro text,                          -- macro-grupo (Pista—Trechos / OAEs-Pontes / Dispositivos / …)
  frente text not null,                -- frente nomeada da obra (Trecho 01 — KM…, Pte Rio Macaé, …)
  contratado_total_rs numeric,         -- contratado total da frente (Σ = PV)
  contratado_acum_rs numeric,          -- contratado acumulado até o BM
  real_acum_rs numeric,                -- real medido até o BM · NULL até ratear por frente (não 0)
  pct numeric,                         -- aderência (real / contratado-acum) · NULL enquanto real pendente
  farol text,                          -- farol da fonte · NULL enquanto real pendente
  real_pendente boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_fat_frente_macro_contrato_idx on public.obra_faturamento_frente_macro (contrato_id);
alter table public.obra_faturamento_frente_macro enable row level security;
drop policy if exists "select_fat_frente_macro_owner" on public.obra_faturamento_frente_macro;
create policy "select_fat_frente_macro_owner" on public.obra_faturamento_frente_macro for select
  using (exists (select 1 from public.obras o where o.id = obra_faturamento_frente_macro.contrato_id and o.created_by = auth.uid()));
drop policy if exists "fat_frente_macro_anon" on public.obra_faturamento_frente_macro;
create policy "fat_frente_macro_anon" on public.obra_faturamento_frente_macro for select to anon using (true);
grant all on public.obra_faturamento_frente_macro to service_role;
grant select on public.obra_faturamento_frente_macro to anon, authenticated;
