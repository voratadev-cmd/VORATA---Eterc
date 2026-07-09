-- Migration · Normalização (Camada A) — CRONOGRAMA-FONTE (MS-Project · tarefas/datas/marcos)
-- ─────────────────────────────────────────────────────────────────────
-- Da Medição acumulada: o cronograma-fonte MS-Project por EDT — datas, durações e MARCOS
-- planejados. Alimenta Prazo / caminho crítico (que não tínhamos). É estrutural: SEM
-- invariante de Σ monetária; o gate confere a presença das tarefas + a raiz EDT='1' com datas.
-- Tabela FLAT (1 linha/tarefa, contrato denormalizado) — read-model filtra por contrato+latest.
-- Idempotente. eh_marco = Duração '0 dias'.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.obra_cronograma_tarefas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,                             -- ordem na planilha (estável)
  numero_item text,                               -- EDT '1.1.1.1'
  nivel int,
  nome text,
  unidade text,
  quantidade numeric,
  duracao_dias int,
  data_inicio date,
  data_termino date,
  eh_marco boolean not null default false,        -- marco (duração 0 dias)
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);

create index if not exists obra_cronograma_tarefas_contrato_idx
  on public.obra_cronograma_tarefas (contrato_id);
create index if not exists obra_cronograma_tarefas_marco_idx
  on public.obra_cronograma_tarefas (contrato_id, eh_marco);


-- RLS · dono lê; worker (service_role) escreve e bypassa.
alter table public.obra_cronograma_tarefas enable row level security;

drop policy if exists "select_cronograma_tarefa_by_obra_owner" on public.obra_cronograma_tarefas;
create policy "select_cronograma_tarefa_by_obra_owner"
  on public.obra_cronograma_tarefas
  for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_cronograma_tarefas.contrato_id
        and o.created_by = auth.uid()
    )
  );

drop policy if exists "obra_cronograma_tarefas_anon_select" on public.obra_cronograma_tarefas;
create policy "obra_cronograma_tarefas_anon_select"
  on public.obra_cronograma_tarefas for select to anon using (true);

grant all on public.obra_cronograma_tarefas to service_role;
grant select on public.obra_cronograma_tarefas to anon, authenticated;
