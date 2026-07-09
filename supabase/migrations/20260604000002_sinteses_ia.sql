-- Sínteses da IA (Adm Contratual IA) · 1 linha por (obra, lente). A IA INTERPRETA fatos resolvidos
-- e nunca afirma número fora deles (validador de ancoragem). `status='needs_review'` quando a saída
-- citou número não-ancorado. `fatos_hash` torna reproduzível/auditável (qual versão dos dados gerou).
create table if not exists public.obra_sinteses (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  lente text not null,                                   -- 'diagnostico_geral', 'analise_faturamento'…
  campo text,                                            -- campo da tab que preenche ('diagnostico'…)
  conteudo jsonb not null,                               -- saída estruturada da IA
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  fatos_hash text,                                       -- hash dos fatos que geraram (auditável)
  modelo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id, lente)
);

create index if not exists obra_sinteses_contrato_idx on public.obra_sinteses (contrato_id);

alter table public.obra_sinteses enable row level security;

drop policy if exists "select_sintese_by_obra_owner" on public.obra_sinteses;
create policy "select_sintese_by_obra_owner"
  on public.obra_sinteses for select
  using (exists (select 1 from public.obras o
                 where o.id = obra_sinteses.contrato_id and o.created_by = auth.uid()));

drop policy if exists "obra_sinteses_anon_select" on public.obra_sinteses;
create policy "obra_sinteses_anon_select"
  on public.obra_sinteses for select to anon using (true);

grant all on public.obra_sinteses to service_role;
grant select on public.obra_sinteses to anon, authenticated;
