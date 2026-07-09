-- Migration · Pipeline de extração com Claude Agent SDK
-- ─────────────────────────────────────────────────────────────────────
-- Adiciona infra para o worker externo (DigitalOcean) que lê
-- `obra_arquivos.status='raw'`, classifica, extrai e persiste o JSON
-- estruturado. A normalização para tabelas de domínio (obra_medicoes,
-- obra_rdos, etc.) é fase 2.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Expandir obra_arquivos · lease + retry + last_error ───────────────
alter table public.obra_arquivos
  add column if not exists lease_until timestamptz,
  add column if not exists attempts int not null default 0,
  add column if not exists last_error text;

-- Status válidos (pipeline em 2 fases distintas com gate humano no meio):
--
--   Fase 1 · Mapeamento (Mapper agent gera texto-mapa do documento)
--     'raw'                → recém subido, aguardando worker
--     'queued'             → liberado após lease expirado (re-tentativa)
--     'mapping'            → worker segurando lease, gerando contexto
--     'mapped'             → contexto.md pronto, aguardando validação humana
--     'mapping_error'      → falha persistente no mapeamento (após MAX_ATTEMPTS)
--
--   ── Gate humano (UI: "Validar todos e avançar pra Extração") ──
--
--   Fase 2 · Extração (Extractor + Reconciler + Verifier)
--     'ready_to_extract'   → humano aprovou o mapa, fila de extração
--     'extracting'         → worker extraindo dados estruturados
--     'extracted'          → JSON validado, sem findings críticos
--     'needs_review'       → verifier marcou pra HITL (confidence ou consistência)
--     'verified'           → revisado e aprovado por humano (terminal feliz)
--     'extraction_error'   → falha persistente na extração
--
--   Status legado (compat — mantém por enquanto)
--     'processing'         → genérico, vai sumindo
--     'error'              → genérico, vai sumindo
--
-- Constraint extensível · adicionar novos stages é só rodar nova migration.
alter table public.obra_arquivos
  drop constraint if exists obra_arquivos_status_check;
alter table public.obra_arquivos
  add constraint obra_arquivos_status_check
  check (status in (
    'raw', 'queued',
    'mapping', 'mapped', 'mapping_error',
    'ready_to_extract',
    'extracting', 'extracted',
    'needs_review', 'verified',
    'extraction_error',
    'cancelled',
    'processing', 'error'
  ));
-- 'cancelled' = usuário parou o mapeamento manualmente · worker ignora
-- (não está nos status elegíveis da RPC). Reversível via "Retomar".

-- Índice da fila · cobre os 2 momentos onde o worker pega trabalho:
--   1) Fase Mapeamento · status raw|queued|mapping_error
--   2) Fase Extração · status ready_to_extract|extraction_error
create index if not exists obra_arquivos_queue_idx
  on public.obra_arquivos (status, lease_until)
  where status in (
    'raw', 'queued', 'mapping_error',
    'ready_to_extract', 'extraction_error'
  );


-- 2. obra_arquivo_contextos · output do Mapper (1:N por arquivo, versionado)
-- ─────────────────────────────────────────────────────────────────────
-- O Mapper gera, ANTES da extração, um "texto-mapa" descrevendo o doc:
--   · estrutura (sheets, dimensões, headers)
--   · onde estão os valores importantes (ranges, colunas relevantes)
--   · anomalias detectadas (células mescladas, linhas em branco, etc)
--   · padrões observados (formato de data, decimais)
-- Esse contexto guia o Extractor depois — extração dirigida, não cega.
create table if not exists public.obra_arquivo_contextos (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  doc_type text not null,
  doc_type_confidence numeric(4,3),
  version int not null default 1,
  schema_version text not null,                 -- ex: 'context@1.0.0'
  context_md text not null,                     -- texto narrativo (humano-readable)
  context_path text,                            -- path no Storage do .md (cópia em arquivo)
  structure jsonb,                              -- mapa estruturado (ranges, dimensões, anomalias)
  agent_model text,                             -- ex: claude-sonnet-4-5
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (arquivo_id, version)
);

create index if not exists obra_arquivo_contextos_arquivo_idx
  on public.obra_arquivo_contextos (arquivo_id);
create index if not exists obra_arquivo_contextos_arquivo_version_idx
  on public.obra_arquivo_contextos (arquivo_id, version desc);


-- 3. obra_arquivo_extracoes · 1:N por arquivo (versionado) ─────────────
-- Cada re-extração incrementa `version`. Sempre lemos a última.
create table if not exists public.obra_arquivo_extracoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  doc_type text not null,
  doc_type_confidence numeric(4,3),
  version int not null default 1,
  schema_version text not null,                 -- ex: 'bm@1.0.0'
  payload jsonb not null,                       -- JSON validado pelo Zod
  field_confidence jsonb,                       -- { campoX: 0.0..1.0 }
  discrepancies jsonb,                          -- [{ field, valueA, valueB, resolution }]
  verifier_findings jsonb,                      -- [{ field, severity, msg }]
  human_overrides jsonb,                        -- diff aplicado na HITL
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (arquivo_id, version)
);

create index if not exists obra_arquivo_extracoes_arquivo_idx
  on public.obra_arquivo_extracoes (arquivo_id);
create index if not exists obra_arquivo_extracoes_doc_type_idx
  on public.obra_arquivo_extracoes (doc_type);
-- Lookup rápido de "última versão por arquivo"
create index if not exists obra_arquivo_extracoes_arquivo_version_idx
  on public.obra_arquivo_extracoes (arquivo_id, version desc);


-- 4. agent_runs · observabilidade do pipeline ──────────────────────────
-- Uma row por chamada de modelo (router, extractor passada 1/2, verifier,
-- reconciler). Custo e latência por run pra análise + dashboard.
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid references public.obra_arquivos(id) on delete cascade,
  agent_name text not null,                     -- router | mapper | extractor | verifier | reconciler
  model text not null,                          -- claude-haiku-4-5-... | claude-sonnet-4-5-...
  pass int not null default 1,                  -- 1 ou 2 (dupla passada)
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_creation_tokens int,
  cost_usd numeric(10,6),
  latency_ms int,
  status text not null,                         -- ok | error | timeout
  error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists agent_runs_arquivo_idx
  on public.agent_runs (arquivo_id);
create index if not exists agent_runs_started_at_idx
  on public.agent_runs (started_at desc);


-- 5. RLS · leitura pra dono da obra; worker usa service_role e bypassa ───────────
-- Notas:
--  · Mantém apenas SELECT/UPDATE pra owner; INSERT é só service_role (worker).
--  · DELETE não exposto · histórico de extrações é imutável (use re-extração).
alter table public.obra_arquivo_extracoes enable row level security;

drop policy if exists "select_extracao_by_obra_owner"
  on public.obra_arquivo_extracoes;
create policy "select_extracao_by_obra_owner"
  on public.obra_arquivo_extracoes
  for select
  using (
    exists (
      select 1
      from public.obra_arquivos a
      join public.obras o on o.id = a.obra_id
      where a.id = obra_arquivo_extracoes.arquivo_id
        and o.created_by = auth.uid()
    )
  );

-- Update permitido pelo dono (HITL · marcar verified, gravar overrides).
drop policy if exists "update_extracao_by_obra_owner"
  on public.obra_arquivo_extracoes;
create policy "update_extracao_by_obra_owner"
  on public.obra_arquivo_extracoes
  for update
  using (
    exists (
      select 1
      from public.obra_arquivos a
      join public.obras o on o.id = a.obra_id
      where a.id = obra_arquivo_extracoes.arquivo_id
        and o.created_by = auth.uid()
    )
  );

-- 6. RPC atômica · pega 1 arquivo elegível com FOR UPDATE SKIP LOCKED ──
-- Worker chama via `rpc('acquire_arquivo_lease', { p_lease_minutes, p_phase })`.
--
-- Garante atomicidade entre N workers concorrentes. A fase determina quais
-- status são elegíveis e qual status terminal o lease aplica:
--
--   p_phase = 'mapping'    → pega raw|queued|mapping_error → marca 'mapping'
--   p_phase = 'extracting' → pega ready_to_extract|extraction_error → 'extracting'
--
-- Sem `p_phase`, default = 'mapping' (Fase 1, único stage ativo hoje).
create or replace function public.acquire_arquivo_lease(
  p_lease_minutes int,
  p_phase text default 'mapping'
)
returns setof public.obra_arquivos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_eligible_statuses text[];
  v_new_status text;
begin
  if p_phase = 'mapping' then
    v_eligible_statuses := array['raw', 'queued', 'mapping_error'];
    v_new_status := 'mapping';
  elsif p_phase = 'extracting' then
    v_eligible_statuses := array['ready_to_extract', 'extraction_error'];
    v_new_status := 'extracting';
  else
    raise exception 'Fase desconhecida: %', p_phase;
  end if;

  -- Pega 1 candidato com lock, sem bloquear outras instâncias.
  select id into v_id
  from public.obra_arquivos
  where (
    status = any(v_eligible_statuses)
    or ((status = 'mapping' or status = 'extracting') and lease_until < now())
  )
    and attempts < 3
  order by uploaded_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return; -- sem trabalho
  end if;

  return query
    update public.obra_arquivos
    set status = v_new_status,
        lease_until = now() + (p_lease_minutes || ' minutes')::interval,
        attempts = attempts + 1
    where id = v_id
    returning *;
end;
$$;

-- Só service_role chama essa RPC (worker). Não exponha pra anon/authenticated.
revoke all on function public.acquire_arquivo_lease(int, text) from public, anon, authenticated;
grant execute on function public.acquire_arquivo_lease(int, text) to service_role;


-- 7. RLS · obra_arquivo_contextos · dono lê e valida ───────────────────
alter table public.obra_arquivo_contextos enable row level security;

drop policy if exists "select_contexto_by_obra_owner"
  on public.obra_arquivo_contextos;
create policy "select_contexto_by_obra_owner"
  on public.obra_arquivo_contextos
  for select
  using (
    exists (
      select 1
      from public.obra_arquivos a
      join public.obras o on o.id = a.obra_id
      where a.id = obra_arquivo_contextos.arquivo_id
        and o.created_by = auth.uid()
    )
  );

-- Update permitido pelo dono · usado quando humano valida o mapa ou edita
-- pontos do context_md antes de avançar pra extração.
drop policy if exists "update_contexto_by_obra_owner"
  on public.obra_arquivo_contextos;
create policy "update_contexto_by_obra_owner"
  on public.obra_arquivo_contextos
  for update
  using (
    exists (
      select 1
      from public.obra_arquivos a
      join public.obras o on o.id = a.obra_id
      where a.id = obra_arquivo_contextos.arquivo_id
        and o.created_by = auth.uid()
    )
  );


-- 8. RLS · agent_runs · só admins e o próprio dono podem ler ───────────
alter table public.agent_runs enable row level security;

drop policy if exists "select_runs_by_obra_owner" on public.agent_runs;
create policy "select_runs_by_obra_owner"
  on public.agent_runs
  for select
  using (
    arquivo_id is null
    or exists (
      select 1
      from public.obra_arquivos a
      join public.obras o on o.id = a.obra_id
      where a.id = agent_runs.arquivo_id
        and o.created_by = auth.uid()
    )
  );


-- 9. Bucket rma-docs · liberar MIME types pra aceitar todos os formatos ─
-- O upload já é validado por extensão no client (uploadObraRawFile.ts).
-- Browsers reportam .md como text/markdown, text/plain ou "" de forma
-- inconsistente · setar allowed_mime_types = null (sem restrição de MIME)
-- evita rejeição. Bucket é privado, então o risco é baixo.
-- Se esta linha falhar por permissão, ajuste via Studio → Storage →
-- rma-docs → Settings → Allowed MIME types (deixe vazio).
update storage.buckets
  set allowed_mime_types = null
  where id = 'rma-docs';
