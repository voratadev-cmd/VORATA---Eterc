-- Migration · Normalização (Camada A) — RECURSOS (MOD/MOI/EQP · Contratado × Real)
-- ─────────────────────────────────────────────────────────────────────
-- Do workbook-motor C.4 Recursos: o plano de recursos contratado por categoria
-- (MOD = Mão de Obra Direta · MOI = Indireta · EQP = Equipamentos), em duas granularidades:
--   • obra_recursos        — item a item (função/equipamento): qtde e R$ Contratado × Real
--   • obra_recursos_meses  — histograma mensal por categoria (curva de mobilização)
--
-- Gate de conservação (gate_recursos): Σ(itens contratado_qtde) == TOTAL declarado por categoria
-- (seção "C.4 Recursos — Totais por categoria"); Σ(contratado_rs) == TOTAL R$ quando a fonte traz
-- R$ (MOD/EQP). MOI vem qtde-only na lista por função (R$ só no histograma) → conserva só a qtde,
-- honesto. Eixo REAL fica em zero/NULL em obra pré-execução → farol de execução PENDENTE (nunca
-- um verde sem dado realizado). Duas tabelas FLAT, idempotentes por (contrato,arquivo,version).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_recursos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  categoria text not null check (categoria in ('MOD', 'MOI', 'EQP')),
  recurso text not null,                          -- nome da função / equipamento
  ordem int not null,                             -- ordem na fonte (e desambigua nomes repetidos)
  contratado_qtde numeric,                        -- efetivo/qtde contratada (Σ person-mês ou qtd)
  real_qtde numeric,                              -- NULL/0 até execução
  contratado_rs numeric,                          -- custo contratado · NULL na MOI por função
  real_rs numeric,                                -- NULL/0 até execução
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, categoria, ordem)
);

create index if not exists obra_recursos_contrato_idx
  on public.obra_recursos (contrato_id);

create table if not exists public.obra_recursos_meses (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  categoria text not null check (categoria in ('MOD', 'MOI', 'EQP')),
  ano int not null,
  mes int not null,
  periodo_label text,                             -- rótulo de origem ("mar-26")
  contratado_qtde numeric,
  real_qtde numeric,
  contratado_rs numeric,
  real_rs numeric,
  unique (contrato_id, arquivo_id, extracao_version, categoria, ano, mes)
);

create index if not exists obra_recursos_meses_contrato_idx
  on public.obra_recursos_meses (contrato_id);


-- RLS · dono lê; anon lê (dev); worker (service_role) escreve e bypassa.
alter table public.obra_recursos enable row level security;
alter table public.obra_recursos_meses enable row level security;

drop policy if exists "select_recurso_by_obra_owner" on public.obra_recursos;
create policy "select_recurso_by_obra_owner"
  on public.obra_recursos for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_recursos.contrato_id and o.created_by = auth.uid()
    )
  );
drop policy if exists "obra_recursos_anon_select" on public.obra_recursos;
create policy "obra_recursos_anon_select"
  on public.obra_recursos for select to anon using (true);

drop policy if exists "select_recurso_mes_by_obra_owner" on public.obra_recursos_meses;
create policy "select_recurso_mes_by_obra_owner"
  on public.obra_recursos_meses for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_recursos_meses.contrato_id and o.created_by = auth.uid()
    )
  );
drop policy if exists "obra_recursos_meses_anon_select" on public.obra_recursos_meses;
create policy "obra_recursos_meses_anon_select"
  on public.obra_recursos_meses for select to anon using (true);

grant all on public.obra_recursos to service_role;
grant all on public.obra_recursos_meses to service_role;
grant select on public.obra_recursos to anon, authenticated;
grant select on public.obra_recursos_meses to anon, authenticated;
