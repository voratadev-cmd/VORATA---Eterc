-- Migration · Normalização (Camada A) — CAPTURA GENÉRICA (rede de completude)
-- ─────────────────────────────────────────────────────────────────────
-- TODA seção do workbook com dado real (tabela/chave_valor, exceto META) é armazenada aqui com a
-- ESTRUTURA preservada (colunas + linhas/KV em JSONB). Garante que o motor não dropa nada em
-- silêncio. `coberta` = tem resolver ESPECÍFICO (typed + cross-checked) por cima. Os resolvers
-- específicos continuam donos das telas; esta é a malha de segurança + auditoria de cobertura.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_secoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  codigo text,                  -- C.5, D.4, B.1, aux_C.3, H, A…
  modulo text,                  -- M1/M2/M3/M4/M5/Dashboard/Catálogo/outro
  titulo text not null,
  tipo text,                    -- tabela / chave_valor
  colunas jsonb,                -- nomes de coluna (tabela)
  dados jsonb,                  -- linhas (array de objetos) OU dict KV (chave_valor)
  n_linhas int not null default 0,
  tem_dado boolean not null default false,
  coberta boolean not null default false,   -- tem resolver específico?
  status text not null default 'ok',
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);

create index if not exists obra_secoes_contrato_idx on public.obra_secoes (contrato_id);
create index if not exists obra_secoes_codigo_idx on public.obra_secoes (contrato_id, codigo);

alter table public.obra_secoes enable row level security;
drop policy if exists "select_secoes_owner" on public.obra_secoes;
create policy "select_secoes_owner" on public.obra_secoes for select
  using (exists (select 1 from public.obras o where o.id = obra_secoes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "secoes_anon" on public.obra_secoes;
create policy "secoes_anon" on public.obra_secoes for select to anon using (true);
grant all on public.obra_secoes to service_role;
grant select on public.obra_secoes to anon, authenticated;
