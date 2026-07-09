-- Migration · Normalização (Camada A) — FATURAMENTO mensal (Curva S financeira em R$)
-- ─────────────────────────────────────────────────────────────────────
-- Da Medição acumulada (XLSX-ERP) vêm DUAS curvas em R$ que faltavam (hoje só existe a
-- curva FÍSICA % do cronograma do BM-02):
--   • CONTRATADO (baseline planejado)  ← seção "diário" (folhas × dias → bucket mensal)
--   • PROJEÇÃO (realizado-até-hoje + forecast) ← seção "mensal R$" (linha-raiz EDT=1)
-- O Real (medido) continua vindo de obra_medicoes (BMs). Resolver: unpivot_tabela_temporal.
-- Gate: cada curva Σ == custo total (39.776.000); a baseline DIVERGE do realizado nos meses
-- dos BMs (prova de que é plano, não medido). Espelha o padrão header+filhos. Idempotente.
-- ─────────────────────────────────────────────────────────────────────

-- 1. obra_faturamento_curvas · header (1 por contribuição de documento) ──────────────
create table if not exists public.obra_faturamento_curvas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  custo_total numeric,                            -- 39.776.000 (oráculo do gate das 2 curvas)
  data_corte date,                                -- último mês realizado (separa realizado/forecast)
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);

create index if not exists obra_faturamento_curvas_contrato_idx
  on public.obra_faturamento_curvas (contrato_id);
create index if not exists obra_faturamento_curvas_arquivo_idx
  on public.obra_faturamento_curvas (arquivo_id);


-- 2. obra_faturamento_meses · ponto mensal das curvas (1 por competência) ────────────
-- Contratado e Projeção podem ter conjuntos de meses diferentes (baseline 20, projeção 21);
-- cada coluna é nullable — o mês existe se QUALQUER curva tiver valor nele.
create table if not exists public.obra_faturamento_meses (
  id uuid primary key default gen_random_uuid(),
  curva_id uuid not null references public.obra_faturamento_curvas(id) on delete cascade,
  ordem int not null,
  ano int not null,
  mes int not null,                               -- 1-12
  contratado_rs numeric,                          -- baseline planejado do mês (sec diário)
  contratado_rs_acumulado numeric,
  projecao_rs numeric,                            -- realizado-lumpado + forecast do mês (sec mensal)
  projecao_rs_acumulado numeric,
  tipo_projecao text                              -- 'realizado' (mês <= data_corte) | 'forecast'
    check (tipo_projecao is null or tipo_projecao in ('realizado', 'forecast')),
  unique (curva_id, ano, mes)
);

create index if not exists obra_faturamento_meses_curva_idx
  on public.obra_faturamento_meses (curva_id);


-- 3. RLS · dono lê; worker (service_role) escreve e bypassa ──────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['obra_faturamento_curvas', 'obra_faturamento_meses'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists "select_fat_curva_by_obra_owner" on public.obra_faturamento_curvas;
create policy "select_fat_curva_by_obra_owner"
  on public.obra_faturamento_curvas
  for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_faturamento_curvas.contrato_id
        and o.created_by = auth.uid()
    )
  );

drop policy if exists "select_fat_mes_by_obra_owner" on public.obra_faturamento_meses;
create policy "select_fat_mes_by_obra_owner"
  on public.obra_faturamento_meses
  for select
  using (
    exists (
      select 1
      from public.obra_faturamento_curvas c
      join public.obras o on o.id = c.contrato_id
      where c.id = obra_faturamento_meses.curva_id
        and o.created_by = auth.uid()
    )
  );

-- anon-read (dev · espelha as demais). FECHAR no go-live.
drop policy if exists "obra_faturamento_curvas_anon_select" on public.obra_faturamento_curvas;
create policy "obra_faturamento_curvas_anon_select"
  on public.obra_faturamento_curvas for select to anon using (true);

drop policy if exists "obra_faturamento_meses_anon_select" on public.obra_faturamento_meses;
create policy "obra_faturamento_meses_anon_select"
  on public.obra_faturamento_meses for select to anon using (true);


-- 4. GRANTs · tabelas via pg direto não herdam os grants padrão. Idempotente.
grant all on public.obra_faturamento_curvas to service_role;
grant all on public.obra_faturamento_meses  to service_role;
grant select on public.obra_faturamento_curvas to anon, authenticated;
grant select on public.obra_faturamento_meses  to anon, authenticated;
