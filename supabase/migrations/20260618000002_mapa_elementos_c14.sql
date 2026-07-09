-- Migration · Normalização — C.14 Mapa da Obra (BLOCO 5: Elementos Pontuais do Retigráfico)
-- O BLOCO 1 (segmentos de duplicação + sinistro agregado) já vive em obra_mapa_segmentos. Falta o
-- BLOCO 5 = elementos PONTUAIS marcados no retigráfico: OAEs (pontes), dispositivos (retornos /
-- Rocha Leão) e os 5 taludes sinistrados INDIVIDUAIS (carve-out do S1, valores da PQ). Os 5 taludes
-- somam exatamente o sinistro agregado do BLOCO 1 (R$ 9.198.001,81) — o gate confere ao centavo.

create table if not exists public.obra_mapa_elementos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  tipo text not null,                 -- 'OAE' | 'Dispositivo' | 'Talude'
  elemento text not null,             -- 'Ponte Rio Macaé' · 'Retorno km 152' · 'Talude 148+700 (S10)'
  km numeric not null,                -- posição no eixo linear da rodovia
  estaca numeric,
  impedido_ate_mes int,               -- só taludes: mês (ordinal) até o qual fica impedido
  obs_lado text,                      -- 'ponte' · 'retorno em nível' · 'Sul · sinistro (BLOCO 1)'
  valor_rs numeric,                   -- só taludes (carve-out); OAE/dispositivo = null
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_mapa_elementos_contrato_idx on public.obra_mapa_elementos (contrato_id);
alter table public.obra_mapa_elementos enable row level security;
drop policy if exists "select_mapa_elementos_owner" on public.obra_mapa_elementos;
create policy "select_mapa_elementos_owner" on public.obra_mapa_elementos for select
  using (exists (select 1 from public.obras o where o.id = obra_mapa_elementos.contrato_id and o.created_by = auth.uid()));
drop policy if exists "mapa_elementos_anon" on public.obra_mapa_elementos;
create policy "mapa_elementos_anon" on public.obra_mapa_elementos for select to anon using (true);
grant all on public.obra_mapa_elementos to service_role;
grant select on public.obra_mapa_elementos to anon, authenticated;
