-- Migration · Normalização (Camada A) — D.0 PAINEL DESEQUILÍBRIO (M3 · headline)
-- ─────────────────────────────────────────────────────────────────────
-- Composição do desequilíbrio econômico-financeiro por categoria (D.1 Indiretos, D.2 BDI, D.3
-- Encargos, D.4 Produtividade, D.5 Insumos, D.6 Pontuais, D.7 Atraso, D.8 Pleitos). Σ categorias =
-- total do desequilíbrio (alimenta o bloco do RMA + Visão Geral + Dashboard). Tabela FLAT,
-- idempotente por (contrato, arquivo, version, ordem). Conservação no gate: Σ == total declarado.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_desequilibrio (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  categoria text not null,         -- natureza (ex.: 'Custos Indiretos', 'BDI')
  tela text,                       -- D.1..D.8 (origem da categoria)
  valor_rs numeric,                -- desequilíbrio da categoria (R$)
  pct_do_total numeric,            -- fração 0..1 do total
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);

create index if not exists obra_desequilibrio_contrato_idx
  on public.obra_desequilibrio (contrato_id);

alter table public.obra_desequilibrio enable row level security;

drop policy if exists "select_deseq_by_obra_owner" on public.obra_desequilibrio;
create policy "select_deseq_by_obra_owner"
  on public.obra_desequilibrio for select
  using (exists (select 1 from public.obras o
                 where o.id = obra_desequilibrio.contrato_id and o.created_by = auth.uid()));
drop policy if exists "obra_desequilibrio_anon_select" on public.obra_desequilibrio;
create policy "obra_desequilibrio_anon_select"
  on public.obra_desequilibrio for select to anon using (true);

grant all on public.obra_desequilibrio to service_role;
grant select on public.obra_desequilibrio to anon, authenticated;
