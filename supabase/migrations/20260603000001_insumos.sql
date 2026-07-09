-- Migration · Normalização (Camada A) — INSUMOS (take-off FÍSICO mensal)
-- ─────────────────────────────────────────────────────────────────────
-- Do Histograma de Insumos por Quantidades (XLSX): a quantidade física planejada por insumo,
-- com distribuição mensal. Alimenta a aba Insumos (qtde + Curva ABC). Chave = CÓDIGO atômico
-- (1 unidade por código). Gate de conservação: Σ células mensais == Σ 'Total' declarado.
--
-- PREÇO/ABC ficam NULL aqui de propósito: o catálogo de preço é pântano (0/absurdo/unidade
-- inconsistente) — entram num passo de ENRIQUECIMENTO separado, com flag de confiabilidade.
-- Duas tabelas FLAT (contrato denormalizado), idempotentes; o read-model junta por código.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_insumos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  codigo text not null,                           -- código atômico do insumo (ex. 'IM0029')
  descricao text,
  unidade text,                                   -- KG/M3/H/UN/% … NÃO somar entre unidades
  qtde_total numeric,                             -- Σ da distribuição mensal (take-off físico)
  classe_abc text,                                -- A/B/C/D/N · NULL até enriquecer (catálogo)
  grupo_custo text,                               -- MATERIAIS/MAO-DE-OBRA… · NULL até enriquecer
  preco_orcado_unit numeric,                      -- NULL até enriquecer (catálogo é pântano)
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, codigo)
);

create index if not exists obra_insumos_contrato_idx
  on public.obra_insumos (contrato_id);

create table if not exists public.obra_insumo_meses (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  codigo text not null,                           -- junta com obra_insumos.codigo
  ano int not null,
  mes int not null,
  qtde numeric not null,                          -- branco≠zero: só meses com qtde != 0
  unique (contrato_id, arquivo_id, extracao_version, codigo, ano, mes)
);

create index if not exists obra_insumo_meses_contrato_idx
  on public.obra_insumo_meses (contrato_id);


-- RLS · dono lê; anon lê (dev); worker (service_role) escreve e bypassa.
alter table public.obra_insumos enable row level security;
alter table public.obra_insumo_meses enable row level security;

drop policy if exists "select_insumo_by_obra_owner" on public.obra_insumos;
create policy "select_insumo_by_obra_owner"
  on public.obra_insumos for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_insumos.contrato_id and o.created_by = auth.uid()
    )
  );
drop policy if exists "obra_insumos_anon_select" on public.obra_insumos;
create policy "obra_insumos_anon_select"
  on public.obra_insumos for select to anon using (true);

drop policy if exists "select_insumo_mes_by_obra_owner" on public.obra_insumo_meses;
create policy "select_insumo_mes_by_obra_owner"
  on public.obra_insumo_meses for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_insumo_meses.contrato_id and o.created_by = auth.uid()
    )
  );
drop policy if exists "obra_insumo_meses_anon_select" on public.obra_insumo_meses;
create policy "obra_insumo_meses_anon_select"
  on public.obra_insumo_meses for select to anon using (true);

grant all on public.obra_insumos to service_role;
grant all on public.obra_insumo_meses to service_role;
grant select on public.obra_insumos to anon, authenticated;
grant select on public.obra_insumo_meses to anon, authenticated;
