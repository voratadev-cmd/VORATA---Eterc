-- Migration · Normalização — C.13 Timeline do Contrato (Gantt contratado × real)
-- Normaliza as seções C.13 já preparadas no workbook p/ o SaaS:
--  (a) auxiliar_C.13 Cron Project (MS Project): tarefas com início/término CONTRATADO e REAL + desvio
--      + nível (hierarquia overview→disciplina) → estende obra_cronograma_tarefas (eixo real, antes só
--      contratado). É a fonte do Gantt inteiro (overview E zoom por disciplina).
--  (b) C.13 Registro de Eventos: eventos datados que impactam o prazo → obra_eventos_prazo (nova).
--  (c) C.13 Marcos Contratuais / Windows Analysis / Resumo-Cards → obra_timeline_params (nova · 1 linha).
-- ADITIVO: só estende obra_cronograma_tarefas com colunas nullable + cria 2 tabelas.

-- (a) eixo REAL + desvio + código no cronograma de tarefas (antes só contratado)
alter table public.obra_cronograma_tarefas add column if not exists codigo text;
alter table public.obra_cronograma_tarefas add column if not exists data_inicio_real date;
alter table public.obra_cronograma_tarefas add column if not exists data_termino_real date;
alter table public.obra_cronograma_tarefas add column if not exists desvio_dias int;
alter table public.obra_cronograma_tarefas add column if not exists pct_concluido numeric;

-- (b) eventos que impactam o prazo (cadastro · 1 linha = 1 evento)
create table if not exists public.obra_eventos_prazo (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  ev_id text,                        -- 'EV-02' …
  titulo text not null,
  categoria text,                    -- 'Impacto' | 'Marco' | 'Liberação' | 'Clima' … (glifo removido)
  data_inicio date,
  data_fim date,
  frente_trecho text,                -- 'S10/S11' · 'S1/S2'
  critico boolean,                   -- 'Crítico?' ● Sim/Não
  clausulas text,                    -- cláusulas citadas
  status_analise text,               -- 'Analisado' | 'Não analisado'
  cross_matriz text,                 -- cross-link com a Matriz de Responsabilidade
  impacta boolean,                   -- 'Impacta obra? (timeline)' Sim/Não
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_eventos_prazo_contrato_idx on public.obra_eventos_prazo (contrato_id);
alter table public.obra_eventos_prazo enable row level security;
drop policy if exists "select_eventos_prazo_owner" on public.obra_eventos_prazo;
create policy "select_eventos_prazo_owner" on public.obra_eventos_prazo for select
  using (exists (select 1 from public.obras o where o.id = obra_eventos_prazo.contrato_id and o.created_by = auth.uid()));
drop policy if exists "eventos_prazo_anon" on public.obra_eventos_prazo;
create policy "eventos_prazo_anon" on public.obra_eventos_prazo for select to anon using (true);
grant all on public.obra_eventos_prazo to service_role;
grant select on public.obra_eventos_prazo to anon, authenticated;

-- (c) parâmetros da timeline (header + cards + Windows Analysis · 1 linha por extração)
create table if not exists public.obra_timeline_params (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  os_real date,                      -- ordem de serviço real (início do eixo)
  os_original date,                  -- OS original (contratual)
  termino_contratual date,           -- término contratual de referência (fim do eixo)
  inicio_execucao text,              -- 'mar/2026'
  termino_previsto text,             -- 'dez/2029'
  total_eventos int,
  eventos_climaticos int,
  marcos_em_risco int,
  marcos_cumpridos int,
  marcos_total int,
  criticos_impacto_fisico int,
  caminho_critico_dias numeric,      -- 'caminho crítico (+X dias)' do Windows
  mes_corte_indice int,
  avanco_fisico_previsto_pp numeric,
  delta_impacto_fisico_pp numeric,
  windows_obs text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);
create index if not exists obra_timeline_params_contrato_idx on public.obra_timeline_params (contrato_id);
alter table public.obra_timeline_params enable row level security;
drop policy if exists "select_timeline_params_owner" on public.obra_timeline_params;
create policy "select_timeline_params_owner" on public.obra_timeline_params for select
  using (exists (select 1 from public.obras o where o.id = obra_timeline_params.contrato_id and o.created_by = auth.uid()));
drop policy if exists "timeline_params_anon" on public.obra_timeline_params;
create policy "timeline_params_anon" on public.obra_timeline_params for select to anon using (true);
grant all on public.obra_timeline_params to service_role;
grant select on public.obra_timeline_params to anon, authenticated;
