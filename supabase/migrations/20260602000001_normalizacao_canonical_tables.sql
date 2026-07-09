-- Migration · Normalização (Camada A · factual) — tabelas canônicas da FATIA-1
-- ─────────────────────────────────────────────────────────────────────
-- 3ª etapa da pipeline (Cadastro → Mapeamento → Extração → ★NORMALIZAÇÃO★ → módulos).
-- A Extração entrega um ENVELOPE JSON fiel por documento (forma do documento). A
-- Normalização FACTUAL grava as ENTIDADES ATÔMICAS CRUAS no banco — só número/data/id,
-- ZERO label/farol/narrativa (isso é camada de view, no front). Determinística, falha-alto.
--
-- Esta migration cobre a FATIA-1 (prova da forma): Medição/BM → itens atômicos + totais.
-- Curva S / agregados / projeção / Faturamento ficam de FORA (são Camada B/assembly e
-- Camada C/view, normalizadas depois). A fase 'normalizacao' na RPC de fila entra JUNTO
-- com o worker normalizador (não aqui — seria plumbing prematuro sem quem a consuma).
--
-- Antecipado em 20260601000001 ("normalização para tabelas de domínio: obra_medicoes,
-- obra_rdos, etc. é fase 2"). Idempotente.
-- ─────────────────────────────────────────────────────────────────────

-- 1. obra_medicoes · a competência canônica MATERIALIZADA (a chave de entidade) ──────
-- Uma row = a contribuição de UM documento de medição/BM para UM mês do contrato.
-- A chave (contrato, bm_numero, ano, mês) é RESOLVIDA por código (resolver_competencia,
-- falha-alto se ambíguo) — nunca inferida no merge. `extracao_version` aponta a
-- contribuição usada (a última extração no momento da normalização). Re-normalizar uma
-- nova versão da extração insere nova row; o assembly lê a latest por (contrato, bm).
create table if not exists public.obra_medicoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,                  -- aponta obra_arquivo_extracoes.version usada
  bm_numero int not null,                         -- resolver_competencia · falha-alto se ambíguo
  ano int,                                        -- nullable: nem todo doc declara competência completa
  mes int,                                        -- 1-12 · reconciliado com bm_numero (quando houver)
  data_corte date,
  config_version text not null,                   -- 'config@1.0.0' (rastreia qual mapeamento gerou)
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),     -- needs_review = gate de invariante não fechou
  created_at timestamptz not null default now(),
  -- mesma contribuição (doc+versão) só entra 1x; upsert por esta chave torna idempotente.
  unique (contrato_id, bm_numero, arquivo_id, extracao_version)
);

create index if not exists obra_medicoes_contrato_idx
  on public.obra_medicoes (contrato_id, bm_numero);
create index if not exists obra_medicoes_arquivo_idx
  on public.obra_medicoes (arquivo_id);


-- 2. obra_medicao_itens · item ATÔMICO CRU ──────────────────────────────────────────
-- Só fato extraível: EDT verbatim (string, preserva o zero de '1.10'), valores numéricos
-- crus e unidade tipada. NADA de label formatado ('R$ 70,7 mi'), farol ou texto — isso é
-- derivado na borda. `ordem` = ordem de aparição na tabela (chave estável mesmo se o
-- numero_item colidir/repetir). `nivel` = profundidade parseada do EDT (null se não-dotted).
-- O item carrega PREVISTO × REALIZADO na mesma linha (confirmado no BM-03 real: colunas
-- 'Custo Total'/'Custo Unitário' = contratado; 'Valor (R$) no Período'/'…acumulado' =
-- realizado). Modelar os dois estados uniformemente evita que todo delta vire caso especial.
create table if not exists public.obra_medicao_itens (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references public.obra_medicoes(id) on delete cascade,
  ordem int not null,                             -- ordem de aparição (estável)
  numero_item text not null,                      -- EDT verbatim '1.1.1' (string, preserva zero)
  nivel int,                                      -- profundidade do EDT (null se não hierárquico)
  descricao text,
  unidade text,                                   -- 'm³', 'kg', 'vb', 'conj.'…
  -- contratado (previsto)
  quantidade_contratada numeric,                  -- 'Quantidade Total'
  preco_unitario numeric,                         -- 'Custo Unitário'
  valor_contratado numeric,                       -- 'Custo Total' (qtd_contratada × preço)
  -- realizado · período (o mês deste BM)
  quantidade_periodo numeric,                     -- 'Quantidade no Período'
  valor_medido_periodo numeric,                   -- 'Valor (R$) no Período' (cru, sem label)
  -- realizado · acumulado (até este BM)
  quantidade_acumulada numeric,                   -- 'Quantidade acumulada no Período'
  valor_medido_acumulado numeric,                 -- 'Valor (R$) acumulado no Período'
  percentual_executado numeric                    -- fração 0..1 (não '15,99%' string)
);

create index if not exists obra_medicao_itens_medicao_idx
  on public.obra_medicao_itens (medicao_id);


-- 3. obra_medicao_totais · o ORÁCULO do gate de invariante ──────────────────────────
-- Os totais_declarados do documento (linha TOTAL / total do BM). Usado pelo GATE
-- obrigatório de invariante numérica: Σ(valor dos itens) deve bater com o total — senão
-- a normalização marca needs_review (falha-alto), nunca grava soma errada em silêncio.
-- `fonte` registra de onde veio o total (transparência da conferência).
create table if not exists public.obra_medicao_totais (
  medicao_id uuid primary key references public.obra_medicoes(id) on delete cascade,
  total_periodo_valor numeric,
  total_acumulado_valor numeric,
  fonte text not null
    check (fonte in ('totais_declarados', 'rollup_raiz', 'linha_total'))
);


-- 4. RLS · dono da obra lê; worker normalizador (service_role) escreve e bypassa ─────
-- Espelha o padrão de obra_arquivo_extracoes: SELECT pelo dono; INSERT/UPDATE só
-- service_role. DELETE via cascade da obra/arquivo (histórico imutável caso a caso).
do $$
declare
  t text;
begin
  foreach t in array array['obra_medicoes', 'obra_medicao_itens', 'obra_medicao_totais'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- obra_medicoes · dono lê
drop policy if exists "select_medicao_by_obra_owner" on public.obra_medicoes;
create policy "select_medicao_by_obra_owner"
  on public.obra_medicoes
  for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_medicoes.contrato_id
        and o.created_by = auth.uid()
    )
  );

-- obra_medicao_itens · dono lê (via medicao → obra)
drop policy if exists "select_medicao_item_by_obra_owner" on public.obra_medicao_itens;
create policy "select_medicao_item_by_obra_owner"
  on public.obra_medicao_itens
  for select
  using (
    exists (
      select 1
      from public.obra_medicoes m
      join public.obras o on o.id = m.contrato_id
      where m.id = obra_medicao_itens.medicao_id
        and o.created_by = auth.uid()
    )
  );

-- obra_medicao_totais · dono lê (via medicao → obra)
drop policy if exists "select_medicao_totais_by_obra_owner" on public.obra_medicao_totais;
create policy "select_medicao_totais_by_obra_owner"
  on public.obra_medicao_totais
  for select
  using (
    exists (
      select 1
      from public.obra_medicoes m
      join public.obras o on o.id = m.contrato_id
      where m.id = obra_medicao_totais.medicao_id
        and o.created_by = auth.uid()
    )
  );


-- 5. GRANTs · tabelas criadas via pg direto NÃO herdam os grants padrão do Supabase
-- (mesmo caso da 20260601000004). service_role escreve (worker, bypassa RLS); anon/
-- authenticated leem (front · RLS por dono filtra). Idempotente.
grant all on public.obra_medicoes       to service_role;
grant all on public.obra_medicao_itens  to service_role;
grant all on public.obra_medicao_totais to service_role;
grant select on public.obra_medicoes       to anon, authenticated;
grant select on public.obra_medicao_itens  to anon, authenticated;
grant select on public.obra_medicao_totais to anon, authenticated;
