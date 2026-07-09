-- Migration · Normalização (Camada A) — CRONOGRAMA → curva PREVISTA FÍSICA
-- ─────────────────────────────────────────────────────────────────────
-- 2ª fatia da normalização factual. O Cronograma Físico-Financeiro traz a distribuição
-- mensal do PREVISTO. Curva FÍSICA (% avanço) e FINANCEIRA (R$) são DISTINTAS: a física é
-- completa (Σ == 100%, base do gate), a financeira vem PARCIAL no PDF (só os meses legíveis).
-- O resolver unpivot_temporal transpõe {mês: %} → linhas atômicas; o gate confere Σ% == 100%.
--
-- Alimenta a aba PRAZO (avanço físico previsto × realizado) e Indicadores (aderência física).
-- O previsto FINANCEIRO do Faturamento NÃO sai daqui (incompleto) — virá de fonte legível.
-- Espelha o padrão da fatia-1 (obra_medicoes): header + filhos, RLS por dono, grants. Idempotente.
-- ─────────────────────────────────────────────────────────────────────

-- 1. obra_cronogramas · header (1 por contribuição de documento de cronograma) ───────
-- Uma row = a baseline físico-financeira que UM documento declara para o contrato. A
-- baseline é a mesma entre BMs (é o plano); re-normalizar uma nova versão da extração
-- insere nova row, o assembly lê a latest por contrato.
create table if not exists public.obra_cronogramas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,                  -- aponta obra_arquivo_extracoes.version usada
  config_version text not null,                   -- 'config@1.0.0' (qual mapeamento gerou)
  custo_total_obra numeric,                       -- custoTotalObra do cronograma (= contratado raiz do BM)
  data_base text,                                 -- 'maio-24' (rótulo mês-ano, não data)
  inicio_obra date,
  termino_obra date,
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),     -- needs_review = curva física não fechou 100%
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);

create index if not exists obra_cronogramas_contrato_idx
  on public.obra_cronogramas (contrato_id);
create index if not exists obra_cronogramas_arquivo_idx
  on public.obra_cronogramas (arquivo_id);


-- 2. obra_cronograma_meses · ponto ATÔMICO da curva prevista (1 por competência) ─────
-- Só fato extraível: % físico do mês, % físico acumulado, e o financeiro DECLARADO quando
-- legível (nullable — não se inventa o mês ilegível). `ordem` = posição cronológica.
create table if not exists public.obra_cronograma_meses (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.obra_cronogramas(id) on delete cascade,
  ordem int not null,                             -- posição cronológica (estável)
  ano int not null,
  mes int not null,                               -- 1-12
  competencia_chave text,                         -- rótulo original ('abr-26') p/ rastreio
  previsto_pct numeric,                           -- fração 0..1 do avanço físico do mês
  previsto_pct_acumulado numeric,                 -- fração 0..1 acumulada (S-curve física)
  previsto_financeiro_declarado numeric,          -- R$ do mês SE legível no doc (senão null)
  unique (cronograma_id, ano, mes)
);

create index if not exists obra_cronograma_meses_cronograma_idx
  on public.obra_cronograma_meses (cronograma_id);


-- 3. RLS · dono da obra lê; worker (service_role) escreve e bypassa ──────────────────
do $$
declare
  t text;
begin
  foreach t in array array['obra_cronogramas', 'obra_cronograma_meses'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists "select_cronograma_by_obra_owner" on public.obra_cronogramas;
create policy "select_cronograma_by_obra_owner"
  on public.obra_cronogramas
  for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_cronogramas.contrato_id
        and o.created_by = auth.uid()
    )
  );

drop policy if exists "select_cronograma_mes_by_obra_owner" on public.obra_cronograma_meses;
create policy "select_cronograma_mes_by_obra_owner"
  on public.obra_cronograma_meses
  for select
  using (
    exists (
      select 1
      from public.obra_cronogramas c
      join public.obras o on o.id = c.contrato_id
      where c.id = obra_cronograma_meses.cronograma_id
        and o.created_by = auth.uid()
    )
  );

-- anon-read (dev · espelha 20260602000003) — o front lê via anon na fase de mocks.
-- FECHAR no go-live junto com as demais policies anon.
drop policy if exists "obra_cronogramas_anon_select" on public.obra_cronogramas;
create policy "obra_cronogramas_anon_select"
  on public.obra_cronogramas for select to anon using (true);

drop policy if exists "obra_cronograma_meses_anon_select" on public.obra_cronograma_meses;
create policy "obra_cronograma_meses_anon_select"
  on public.obra_cronograma_meses for select to anon using (true);


-- 4. GRANTs · tabelas via pg direto NÃO herdam os grants padrão do Supabase. Idempotente.
grant all on public.obra_cronogramas      to service_role;
grant all on public.obra_cronograma_meses to service_role;
grant select on public.obra_cronogramas      to anon, authenticated;
grant select on public.obra_cronograma_meses to anon, authenticated;
