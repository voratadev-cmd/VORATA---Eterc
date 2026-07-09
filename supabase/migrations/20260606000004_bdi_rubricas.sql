-- Migration · Normalização (Camada A) — C.1 BDI DETALHE (FONTE-MÃE econômica)
-- ─────────────────────────────────────────────────────────────────────
-- Rubricas do BDI (PV/BDI/CD · lida por 14 telas). Tabela FLAT com hierarquia leve (eh_subtotal):
-- 'Despesas Indiretas+Impostos' e 'Impostos' são subtotais; as FOLHAS somam o markup sem double-
-- count. Conservação (no resolver/gate): CD = valor/(%CD) constante célula-a-célula + CD+markup ≈ PV.
-- Idempotente por (contrato, arquivo, version, ordem).
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_bdi_rubricas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  descricao text not null,
  pct_receita numeric,             -- % sobre a receita (fonte)
  pct_custo_direto numeric,        -- % sobre o custo direto (base do VALOR)
  valor_rs numeric,                -- VALOR (R$) = %CD × CD
  pct_receita_implicito numeric,
  eh_subtotal boolean not null default false,  -- subtotal (não somar com as folhas)
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);

create index if not exists obra_bdi_rubricas_contrato_idx
  on public.obra_bdi_rubricas (contrato_id);

alter table public.obra_bdi_rubricas enable row level security;

drop policy if exists "select_bdi_by_obra_owner" on public.obra_bdi_rubricas;
create policy "select_bdi_by_obra_owner"
  on public.obra_bdi_rubricas for select
  using (exists (select 1 from public.obras o
                 where o.id = obra_bdi_rubricas.contrato_id and o.created_by = auth.uid()));
drop policy if exists "obra_bdi_rubricas_anon_select" on public.obra_bdi_rubricas;
create policy "obra_bdi_rubricas_anon_select"
  on public.obra_bdi_rubricas for select to anon using (true);

grant all on public.obra_bdi_rubricas to service_role;
grant select on public.obra_bdi_rubricas to anon, authenticated;
