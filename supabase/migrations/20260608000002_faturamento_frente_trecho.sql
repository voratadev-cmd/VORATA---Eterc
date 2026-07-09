-- Migration · Normalização — C.3 FATURAMENTO POR FRENTE × TRECHO (drill-down · caderno SaaS A171:I242)
-- Matriz Frente→Trecho: Contratado + Previsto acum até BM + Real(input) + Déficit + Aderência + Farol.
-- Real é input não medido → real/déficit/aderência NULL (pendente) e real_pendente=true (a tela pinta
-- "a medir" vermelho no drill-down operacional). Σ Contratado ≈ PV (cross-check). ADITIVO: não toca
-- nenhuma tabela existente — só adiciona o drill-down novo (resto da obra segue do _11).

create table if not exists public.obra_faturamento_frente_trecho (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  frente text not null,
  trecho text not null,
  share_pct numeric,
  contratado_rs numeric,
  previsto_acum_rs numeric,
  real_acum_rs numeric,          -- input · NULL até a medição (não 0 fabricado)
  deficit_rs numeric,            -- NULL enquanto real pendente
  aderencia numeric,             -- real/previsto · NULL enquanto real pendente
  farol text,                    -- conforme/observacao/critico · NULL enquanto real pendente
  real_pendente boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_fat_frente_trecho_contrato_idx on public.obra_faturamento_frente_trecho (contrato_id);
create index if not exists obra_fat_frente_trecho_frente_idx on public.obra_faturamento_frente_trecho (contrato_id, frente);
alter table public.obra_faturamento_frente_trecho enable row level security;
drop policy if exists "select_fat_ft_owner" on public.obra_faturamento_frente_trecho;
create policy "select_fat_ft_owner" on public.obra_faturamento_frente_trecho for select
  using (exists (select 1 from public.obras o where o.id = obra_faturamento_frente_trecho.contrato_id and o.created_by = auth.uid()));
drop policy if exists "fat_ft_anon" on public.obra_faturamento_frente_trecho;
create policy "fat_ft_anon" on public.obra_faturamento_frente_trecho for select to anon using (true);
grant all on public.obra_faturamento_frente_trecho to service_role;
grant select on public.obra_faturamento_frente_trecho to anon, authenticated;
