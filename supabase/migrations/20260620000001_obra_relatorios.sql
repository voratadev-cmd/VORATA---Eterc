-- Relatórios de análise por aba do RMA (gerados pela IA · Adm Contratual IA).
-- Generaliza o padrão de obra_sinteses: 1 relatório vigente por (obra, aba); regenerar = upsert.
-- Escrita só por service_role (o agente que gera); leitura anon em dev (igual obra_secoes/obra_sinteses),
-- a ser fechada no go-live junto com as demais tabelas de dado por obra.

create table if not exists public.obra_relatorios (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  aba text not null,
  conteudo jsonb not null,
  status text not null default 'ok' check (status in ('ok','needs_review','generating','error')),
  -- staleness: hash dos fatos que geraram + versão da extração no momento (sinal de "dado mudou")
  fatos_hash text,
  extracao_version int,
  config_version text,
  modelo text,
  gerado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id, aba)
);

create index if not exists obra_relatorios_contrato_idx on public.obra_relatorios (contrato_id);

alter table public.obra_relatorios enable row level security;

drop policy if exists "select_relatorio_owner" on public.obra_relatorios;
create policy "select_relatorio_owner" on public.obra_relatorios for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_relatorios.contrato_id and o.created_by = auth.uid()
    )
  );

drop policy if exists "obra_relatorios_anon_select" on public.obra_relatorios;
create policy "obra_relatorios_anon_select" on public.obra_relatorios for select to anon using (true);

grant all on public.obra_relatorios to service_role;
grant select on public.obra_relatorios to anon, authenticated;
