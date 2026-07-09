-- Migration · Normalização — C.8/C.3 · SÉRIE MENSAL DAS CURVAS (Tela 6 · gráfico 4 curvas + toggle)
-- 1 linha = 1 mês (1..46 na BR-101). Junta o MESMO eixo de meses de 2 abas: C.8 série acumulada
-- (Contratado/Liberado/Capacidade/Executado, R$) + C.3 curva mensal ("Previsto Serviços" = base
-- "Produção (apenas serviços)" do toggle — fonte própria, NÃO deriva da matriz disciplina×mês).
-- Capacidade e Executado só existem até o BM corrente: o carry-forward (constante) da planilha nos
-- meses futuros vira NULL aqui (futuro sem dado ≠ valor · PENDENTE≠0). Gate: C.8 == C.3 mês a mês
-- ao centavo + corte == cards do C.8 + fim da curva == Contratado Total + acumulados monotônicos.
-- ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_curvas_serie_mes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  mes_num int not null,            -- ordinal do mês (1..46)
  periodo_label text,              -- rótulo da fonte (ex.: 'jun-26')
  contratado_acum_rs numeric,      -- C.8 'Contratado Acum.' (plano · série inteira)
  liberado_acum_rs numeric,        -- C.8 'Liberado Acum.' (hoje ≈ contratado; descola com input por km)
  capacidade_acum_rs numeric,      -- C.8 'Capacidade Acum.' · NULL pós-BM (carry cortado)
  executado_acum_rs numeric,       -- C.8 'Executado Acum.' · NULL pós-BM (real não medido, nunca 0)
  previsto_servicos_rs numeric,    -- C.3 'Previsto Serviços' MENSAL (base Produção do toggle)
  bm_corrente int,                 -- BM de corte usado p/ NULLificar o carry
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_curvas_serie_contrato_idx on public.obra_curvas_serie_mes (contrato_id);
alter table public.obra_curvas_serie_mes enable row level security;
drop policy if exists "select_curvas_serie_owner" on public.obra_curvas_serie_mes;
create policy "select_curvas_serie_owner" on public.obra_curvas_serie_mes for select
  using (exists (select 1 from public.obras o where o.id = obra_curvas_serie_mes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "curvas_serie_anon" on public.obra_curvas_serie_mes;
create policy "curvas_serie_anon" on public.obra_curvas_serie_mes for select to anon using (true);
grant all on public.obra_curvas_serie_mes to service_role;
grant select on public.obra_curvas_serie_mes to anon, authenticated;
