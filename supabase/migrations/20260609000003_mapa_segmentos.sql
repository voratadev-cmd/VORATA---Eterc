-- Migration · Normalização — C.14 MAPA DA OBRA · SEGMENTOS POR KM (Bloco 1 · retigráfico espaço×tempo)
-- 1 linha = 1 segmento do mapa de liberação (BR-101: 9 trechos de duplicação contíguos km 144+600→
-- 190+300 + 2 sinistros pontuais como itens próprios). Campos-FONTE: km início/fim, mês de liberação
-- prevista (baseline) e real (efetiva no passado · projetada no futuro), janela de impedimento e
-- valor de contrato. Status/Liberado/Impedido no BM são DERIVÁVEIS — o gate recomputa de (mês lib.
-- real, janela, BM) e exige igualdade ao centavo; o Bloco 2 (seg×mês) deriva no read-model, não é
-- materializado. Causa do impedimento é input da obra. Σ duplicação == Contratado Total (C.3).
-- ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_mapa_segmentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  seg_codigo text not null,        -- 'S1'..'S11'
  item_nome text not null,         -- item do cronograma (ex.: 'Duplicação 144+600–155+610')
  tipo text not null check (tipo in ('duplicacao', 'sinistro')),
  km_inicio numeric not null,
  km_fim numeric not null,         -- sinistro é ponto (km_inicio == km_fim)
  mes_lib_prevista int,            -- ordinal do mês (baseline)
  mes_lib_real int,                -- liberação efetiva (passado) · projetada (futuro)
  imped_mes_inicio int,            -- janela de impedimento (NULL = nunca impedido)
  imped_mes_fim int,               -- NULL com início presente = janela aberta ("até reparo")
  check (imped_mes_fim is null or imped_mes_inicio is null or imped_mes_fim >= imped_mes_inicio),
  valor_contrato_rs numeric not null,
  bm_corrente int,                 -- BM de corte usado nos 3 campos derivados abaixo
  status_bm text,                  -- 'Liberado' | 'Impedido' | 'Não iniciado' (gate confere a derivação)
  liberado_rs numeric,
  impedido_rs numeric,
  causa_impedimento text,          -- input da obra · NULL quando não impedido
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_mapa_seg_contrato_idx on public.obra_mapa_segmentos (contrato_id);
alter table public.obra_mapa_segmentos enable row level security;
drop policy if exists "select_mapa_seg_owner" on public.obra_mapa_segmentos;
create policy "select_mapa_seg_owner" on public.obra_mapa_segmentos for select
  using (exists (select 1 from public.obras o where o.id = obra_mapa_segmentos.contrato_id and o.created_by = auth.uid()));
drop policy if exists "mapa_seg_anon" on public.obra_mapa_segmentos;
create policy "mapa_seg_anon" on public.obra_mapa_segmentos for select to anon using (true);
grant all on public.obra_mapa_segmentos to service_role;
grant select on public.obra_mapa_segmentos to anon, authenticated;
