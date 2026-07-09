-- Migration · Normalização — C.14 MAPA DA OBRA · AVANÇO FÍSICO-FINANCEIRO CONTRATADO por DISCIPLINA × MÊS
-- A baseline CONTRATADA físico-financeira (curva-S) das disciplinas FÍSICAS de obra, em PREÇO (com
-- BDI/markup). Fonte: auxiliar_C.14 Crono (Valor(R$) × %mês ÷ 100, agrupado por Disciplina). Σ das
-- 8 físicas = 367.256.923 = porção física do PV de 611M (as rubricas não-físicas — Adm Local, Insumos,
-- Mob/Desmob, Outros — completam o PV; `fisico` separa as duas). PREVISTO/CONTRATADO, não real: cobre o
-- horizonte inteiro do cronograma. REAL/ADERÊNCIA = input do RDO → NULL (pendente; nunca 0 fabricado).
-- Distinto do C.3 (obra_faturamento_disciplina_mes = faturamento CHEIO/PV, 12-15 disc) e do C.5
-- (obra_cronograma_frente_mes = % físico, fração). ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_avanco_fisico_disciplina_mes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  disciplina text not null,
  fisico boolean not null,            -- disciplina física (serviço de campo) × rubrica não-física (Adm/Insumo/Mob)
  mes_num int not null,               -- ordinal do mês no cronograma (1..46)
  contratado_rs numeric,              -- desembolso CONTRATADO no mês (Valor × %mês ÷ 100 · preço)
  contratado_acum_rs numeric,         -- acumulado recomposto (cumsum mensal por disciplina)
  real_rs numeric,                    -- input do RDO · NULL até a medição (não 0 fabricado)
  aderencia_pct numeric,              -- real / contratado · NULL enquanto real pendente
  real_pendente boolean not null default true,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_avanco_fis_contrato_idx on public.obra_avanco_fisico_disciplina_mes (contrato_id);
create index if not exists obra_avanco_fis_disc_idx on public.obra_avanco_fisico_disciplina_mes (contrato_id, disciplina);
alter table public.obra_avanco_fisico_disciplina_mes enable row level security;
drop policy if exists "select_avanco_fis_owner" on public.obra_avanco_fisico_disciplina_mes;
create policy "select_avanco_fis_owner" on public.obra_avanco_fisico_disciplina_mes for select
  using (exists (select 1 from public.obras o where o.id = obra_avanco_fisico_disciplina_mes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "avanco_fis_anon" on public.obra_avanco_fisico_disciplina_mes;
create policy "avanco_fis_anon" on public.obra_avanco_fisico_disciplina_mes for select to anon using (true);
grant all on public.obra_avanco_fisico_disciplina_mes to service_role;
grant select on public.obra_avanco_fisico_disciplina_mes to anon, authenticated;
