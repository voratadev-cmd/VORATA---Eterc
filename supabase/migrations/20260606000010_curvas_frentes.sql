-- Migration · Normalização (Camada A) — C.8 MATRIZ POR FRENTE (Responsabilidade × gargalo)
-- 12 frentes de serviço: Contratado, Produtividade (R$/HH), Gap dominante, Responsabilidade
-- preliminar. Combina com a aba Curvas e Responsabilidade. Σ contratado cruza com C.8 contratado.

create table if not exists public.obra_curvas_frentes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  frente text not null,
  contratado_rs numeric,
  produtividade_rs_hh numeric,
  gap_dominante_rs numeric,
  responsabilidade text,
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_curvas_frentes_contrato_idx on public.obra_curvas_frentes (contrato_id);
alter table public.obra_curvas_frentes enable row level security;
drop policy if exists "select_frentes_owner" on public.obra_curvas_frentes;
create policy "select_frentes_owner" on public.obra_curvas_frentes for select
  using (exists (select 1 from public.obras o where o.id = obra_curvas_frentes.contrato_id and o.created_by = auth.uid()));
drop policy if exists "frentes_anon" on public.obra_curvas_frentes;
create policy "frentes_anon" on public.obra_curvas_frentes for select to anon using (true);
grant all on public.obra_curvas_frentes to service_role;
grant select on public.obra_curvas_frentes to anon, authenticated;
