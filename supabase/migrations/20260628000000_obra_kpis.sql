-- obra_kpis · valores CANÔNICOS por domínio (Fase B do gate de paridade).
-- ──────────────────────────────────────────────────────────────────────────
-- Persistidos a partir dos READ-MODELS das telas (a autoridade da regra) pelo job
-- scripts/persist_kpis.ts. O CHAT (tools.py) LÊ daqui o headline de cada domínio em vez de
-- re-derivar → chat == tela por construção (mata a classe do bug do D.0/chuvas/mapa). O gate
-- de paridade (scripts/parity/) confere obra_kpis == read-model == oráculo.
-- Genérica: 1 linha por (obra, kpi_key) — adicionar KPI não muda o schema.

create table if not exists public.obra_kpis (
  contrato_id uuid not null references public.obras(id) on delete cascade,
  kpi_key     text not null,                       -- ex.: 'desequilibrio_total', 'faturamento_realizado_acum'
  valor       numeric,                             -- valor canônico (na unidade de `unidade`)
  unidade     text,                                -- 'BRL' | 'frac' | 'pct' | 'count' | 'dias'
  label       text,                                -- rótulo humano do KPI
  fonte       text,                                -- read-model/probe de origem
  updated_at  timestamptz not null default now(),
  primary key (contrato_id, kpi_key)
);

create index if not exists obra_kpis_contrato_idx on public.obra_kpis (contrato_id);

alter table public.obra_kpis enable row level security;

-- leitura aberta a anon/authenticated (dev · espelha dev_anon_read_pipeline); escrita só service role.
drop policy if exists "obra_kpis_anon_select" on public.obra_kpis;
create policy "obra_kpis_anon_select" on public.obra_kpis
  for select to anon, authenticated using (true);

grant select on public.obra_kpis to anon, authenticated;
-- o CHAT lê via service key (service_role) — sem este grant a leitura dá 42501 e o pin cai no fallback.
grant select, insert, update, delete on public.obra_kpis to service_role;
