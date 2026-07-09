-- C.6/D.5 Insumos v53 · backend ÚNICO das duas telas (cláusula 6.2 + 8.8).
-- ──────────────────────────────────────────────────────────────────────────
-- 30 insumos de faturamento direto × todas as fontes de índice (108), parâmetros do
-- reequilíbrio (IPCA divisória, datas, saldo M1) e a série IPCA com os cenários de
-- data-base do Mecanismo 1. Números = Excel v53 (abas C.6/D.5); rótulos/agrupamentos
-- = mockups C06/D05 (Prompt_Devs_C06_D05_Insumos.md §0). Cálculo de repasse/potencial
-- fica no cliente (read-model), reproduzindo as views do doc §4 ao centavo.
-- Substitui (sem drop · viram histórico) obra_insumos / obra_insumo_excedente como
-- fonte das telas C.6 e D.5.

-- 3.1 — insumos de faturamento direto (um por linha, ordem ABC = valor desc)
create table if not exists public.obra_insumos_fd (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid not null references public.obras(id) on delete cascade,
  arquivo_id       uuid,
  extracao_version int  not null default 53,
  config_version   text not null default 'insumos_v53',
  ordem_abc        int  not null,            -- 1..30 (valor de contrato desc)
  nome             text not null,
  unidade          text not null,            -- t, l, m3, kg, m2…
  classe           text not null,            -- 'A' | 'B' | 'C'
  categoria        text,                     -- Ordem da PQ: COMBUSTÍVEL/CBUQ/AGREGADOS/AÇO/CONCRETO
  ordem_pq         int,                      -- posição na PQ (visão "Ordem da PQ")
  qtd_pq           numeric not null,
  preco_unit_bdi   numeric not null,
  valor_contrato_bdi numeric not null,       -- qtd_pq × preço (persistido; gate confere)
  qtd_medida       numeric not null default 0,
  valor_medido_bdi numeric not null default 0,
  fonte_recomendada text,                    -- id da fonte ★ (default do seletor)
  status           text not null default 'ok',
  created_at       timestamptz not null default now(),
  unique (contrato_id, ordem_abc)
);

-- 3.2 — fontes de índice por insumo (108; ordem_opcao preserva a ordem do mockup —
-- os presets DNIT/melhor/pior/mercado dependem dela p/ desempate determinístico)
create table if not exists public.obra_insumos_fd_fontes (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.obras(id) on delete cascade,
  insumo_ordem int  not null,                -- ordem_abc do insumo (1..30)
  ordem_opcao  int  not null,                -- ordem da opção no seletor (mockup)
  fonte_id     text not null,                -- id estável ('pav', 'cap', 'anp', 'sinapi_3045'…)
  fonte        text not null,                -- SINAPI | DNIT | ANP | SBC | EMOP | SCO
  rotulo       text not null,                -- rótulo do seletor ('DNIT·Pavim.', 'SINAPI CAP 30/45'…)
  codigo       text,                         -- código na fonte ('00034770'…) · null se n/a
  tipo         text not null default 'preco',-- 'indice' (DNIT, base 100) | 'preco' (R$ absoluto)
  valor_os     numeric,                      -- na data da OS (mar/26) · null = delta_fixo
  valor_atual  numeric,                      -- na data da verificação (mai/26)
  delta_pct    numeric,                      -- Δ% (persistido do v53; gate = (atual−os)/os)
  is_recomendada boolean not null default false,
  status       text not null default 'ok',
  created_at   timestamptz not null default now(),
  unique (contrato_id, insumo_ordem, fonte_id)
);
create index if not exists obra_insumos_fd_fontes_insumo_idx
  on public.obra_insumos_fd_fontes (contrato_id, insumo_ordem);

-- 3.3 — parâmetros do reequilíbrio (M2) + reajuste (M1) · 1 linha por obra
create table if not exists public.obra_insumos_reeq (
  contrato_id        uuid primary key references public.obras(id) on delete cascade,
  ipca_periodo       numeric not null,       -- 0.01254 · linha divisória 8.8 (mar→mai/26)
  data_os            date not null,          -- 2026-03-09
  data_verificacao   date not null,          -- 2026-05-31 (prévia mai/26)
  data_assinatura    date,                   -- 2026-01-08
  data_proposta      date,                   -- 2025-07-24
  data_reajuste_aniversario date,            -- 2027-01-08
  data_verificacao_reeq date,                -- 2026-09-09 (1ª verificação semestral)
  contrato_cheio_bdi numeric not null,       -- 611.357.314,09
  medido_acumulado   numeric not null,       -- 11.375.380,19
  saldo_a_executar   numeric not null,       -- cheio − medido = 599.981.933,90 (M1 · ⚠️ não usar base medição)
  reajuste_acumulado numeric,                -- 0.0157 (informativo C.6)
  ipca_atual         numeric not null,       -- I de mai/26 = 7640.15 (série dez/93=100)
  cenario_m1_ativo   text not null default 'proposta',  -- cpus | proposta | assinatura
  status             text not null default 'ok',
  created_at         timestamptz not null default now()
);

-- 3.4 — série IPCA (número-índice · dez/93=100) + papel de cenário M1 (i0)
create table if not exists public.obra_ipca_serie (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  mes         text not null,                 -- '2024-11' … '2026-05'
  indice      numeric not null,
  cenario_id  text,                          -- 'cpus' | 'proposta' | 'assinatura' quando o mês é uma data-base do M1
  cenario_nome text,                         -- 'Nov/2024' · 'Jul/2025' · 'Jan/2026'
  cenario_desc text,                         -- 'data das CPUs (composição de custos)'…
  unique (contrato_id, mes)
);

-- RLS · leitura anon/authenticated (espelha as demais read-models); escrita service role
do $$
declare t text;
begin
  foreach t in array array['obra_insumos_fd','obra_insumos_fd_fontes','obra_insumos_reeq','obra_ipca_serie'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_anon_select" on public.%I', t, t);
    execute format('create policy "%s_anon_select" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
