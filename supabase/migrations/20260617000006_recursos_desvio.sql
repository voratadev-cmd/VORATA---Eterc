-- Migration · Normalização — C.4 Recursos · MAIORES DESVIOS DE ALOCAÇÃO (R$ acum até BM · MOD+EQP)
-- A aba C.4 já prepara, p/ o SaaS, o ranking dos maiores desvios de alocação por recurso/função
-- (Real − Contratado acumulado, em R$, no corte do BM). 1 linha = 1 recurso. Gate: desvio == real −
-- contratado ao centavo. ADITIVO. Complementa o histograma (obra_recursos_meses) com o "quem" do
-- desvio, sem depender do catálogo completo por função (que pode estar ausente).

create table if not exists public.obra_recursos_desvio (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,                -- ranking por |Δ| (0 = maior desvio)
  recurso text not null,             -- 'ESCAVADEIRA VOLVO EC360BLC' · 'GUINDASTE 500T PNEU (OAE)'
  contratado_rs numeric,             -- contratado acumulado até o BM (R$)
  real_rs numeric,                   -- real alocado acumulado até o BM (R$)
  desvio_rs numeric,                 -- real − contratado (R$) · + = acima do plano
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_recursos_desvio_contrato_idx on public.obra_recursos_desvio (contrato_id);
alter table public.obra_recursos_desvio enable row level security;
drop policy if exists "select_rec_desvio_owner" on public.obra_recursos_desvio;
create policy "select_rec_desvio_owner" on public.obra_recursos_desvio for select
  using (exists (select 1 from public.obras o where o.id = obra_recursos_desvio.contrato_id and o.created_by = auth.uid()));
drop policy if exists "rec_desvio_anon" on public.obra_recursos_desvio;
create policy "rec_desvio_anon" on public.obra_recursos_desvio for select to anon using (true);
grant all on public.obra_recursos_desvio to service_role;
grant select on public.obra_recursos_desvio to anon, authenticated;
