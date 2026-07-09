-- Migration · Normalização — D.5 · EXCEDENTE AO IPCA POR INSUMO RELEVANTE (cláusula 8.8 · Tela Insumos)
-- Reframe do Caderno (Tela 4): índice contratual é IPCA (cl. 6.2); nos insumos relevantes (8.8) a
-- variação até o IPCA é risco da Contratada (6.2.2) e SÓ o excedente é faturado direto — não é
-- reequilíbrio paramétrico. 1 linha = 1 insumo relevante no snapshot (mês comum, ex.: jan/26):
-- Δ% real provado por índice (ANP/SICRO/SINAPI) · teto IPCA acum. · excedente = (Δ%−teto)⁺ ·
-- Δ R$ = excedente × qtde ORÇADA × preço-base (repasse EFETIVO usa qtde da NF, mês a mês — input
-- futuro). Sem índice → colunas NULL (o 0 da planilha é default de fórmula, nunca medição).
-- Fonte: aba 'D.5 Insumos' da revisão jun/2026 do workbook (pós-correção SICRO/INCC → IPCA);
-- gate cruza qtd/preço com a Curva ABC (obra_insumos) ao centavo e recomputa todas as derivações.
-- ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_insumo_excedente (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  insumo text not null,            -- 'Óleo diesel' · 'Brita comercial' · …
  classe_abc text,                 -- classe na Curva ABC (A/B/C)
  qtd_orcada numeric,              -- take-off (NULL p/ pendentes sem linha na ABC)
  preco_orcado_rs numeric,
  preco_ref_real_rs numeric,       -- orçado × (1+Δ%) · NULL sem índice
  delta_real_pct numeric,          -- FRAÇÃO · NULL = índice de mercado pendente
  teto_ipca_pct numeric,           -- FRAÇÃO · teto IPCA acum. no snapshot
  excedente_pct numeric check (excedente_pct is null or excedente_pct >= 0),  -- (Δ% − teto)⁺
  delta_rs numeric check (delta_rs is null or delta_rs >= 0),  -- Δ R$ (sobre a qtde orçada) · NULL pendente
  farol text,                      -- 'Conforme' | 'Conforme · caiu' | 'Observação' | 'Risco' | 'Crítico' · NULL pendente
  indice_pendente boolean not null default false,
  snapshot_label text,             -- mês comum do snapshot (ex.: 'jan/26')
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_insumo_exc_contrato_idx on public.obra_insumo_excedente (contrato_id);
alter table public.obra_insumo_excedente enable row level security;
drop policy if exists "select_insumo_exc_owner" on public.obra_insumo_excedente;
create policy "select_insumo_exc_owner" on public.obra_insumo_excedente for select
  using (exists (select 1 from public.obras o where o.id = obra_insumo_excedente.contrato_id and o.created_by = auth.uid()));
drop policy if exists "insumo_exc_anon" on public.obra_insumo_excedente;
create policy "insumo_exc_anon" on public.obra_insumo_excedente for select to anon using (true);
grant all on public.obra_insumo_excedente to service_role;
grant select on public.obra_insumo_excedente to anon, authenticated;

-- Header (1 linha por extração): parâmetros contratuais + consolidação (cards do D.5)
create table if not exists public.obra_insumo_excedente_params (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  data_base date,                  -- data-base do orçamento (âncora do teto · jul/25 na BR-101;
                                   -- alternativa contratual: assinatura dez/25 — Condições Específicas)
  normativa text,                  -- 'IPCA (cl. 6.2) · excedente repassável (8.8)'
  metodo_ativo text,               -- M1 SICRO/SINAPI · M2 NF · M3 ANP
  snapshot_label text,             -- 'jan/26'
  teto_snapshot_pct numeric,       -- teto IPCA do snapshot (FRAÇÃO · +1,57% jan/26)
  total_delta_rs numeric,          -- Σ Δ R$ (sobre qtde orçada · itens com índice)
  insumos_acima_teto int,
  pct_sobre_pv numeric,
  reajuste_pago_acum_rs numeric,   -- desconto obrigatório (TCU) — 0 até o 1º reajuste
  farol text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_insumo_exc_params_contrato_idx on public.obra_insumo_excedente_params (contrato_id);
alter table public.obra_insumo_excedente_params enable row level security;
drop policy if exists "select_insumo_excp_owner" on public.obra_insumo_excedente_params;
create policy "select_insumo_excp_owner" on public.obra_insumo_excedente_params for select
  using (exists (select 1 from public.obras o where o.id = obra_insumo_excedente_params.contrato_id and o.created_by = auth.uid()));
drop policy if exists "insumo_excp_anon" on public.obra_insumo_excedente_params;
create policy "insumo_excp_anon" on public.obra_insumo_excedente_params for select to anon using (true);
grant all on public.obra_insumo_excedente_params to service_role;
grant select on public.obra_insumo_excedente_params to anon, authenticated;
