-- Migration · Normalização (Camada A) — ORÇAMENTO baseline (preço de venda + custo + BDI)
-- ─────────────────────────────────────────────────────────────────────
-- Da Medição acumulada (XLSX-ERP): o ORÇAMENTO de venda por EAP (BASE1) + o resumo de custo
-- (Atividades: direto/indireto/receita). É a referência de PREÇO p/ o Desequilíbrio/BDI —
-- distinta de medições (=realizado) e cronograma (=físico/curva). BDI = preço-venda / custo.
-- Gate: Σ(folhas BASE1) == preço de venda (39.776.000). Idempotente. Espelha header+filhos.
-- ─────────────────────────────────────────────────────────────────────

-- 1. obra_orcamentos · header + resumo de custo/BDI (1 por contribuição de documento) ──
create table if not exists public.obra_orcamentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  preco_venda numeric,                            -- Σ BASE1 (orçamento de venda) = 39.776.000
  custo_direto numeric,                           -- Atividades raiz 001 'Custo Parcial'
  custo_indireto numeric,                         -- Atividades raiz 001 'Custo Parcial Indireto'
  custo_total_atividades numeric,                 -- direto + indireto (base do BDI)
  receita numeric,                                -- Atividades '003'
  bdi numeric,                                     -- preço_venda / custo_total (markup, ex. 1.24465)
  status text not null default 'ok'
    check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version)
);

create index if not exists obra_orcamentos_contrato_idx
  on public.obra_orcamentos (contrato_id);
create index if not exists obra_orcamentos_arquivo_idx
  on public.obra_orcamentos (arquivo_id);


-- 2. obra_orcamento_itens · item-FOLHA do orçamento de venda por EAP (BASE1) ─────────
create table if not exists public.obra_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.obra_orcamentos(id) on delete cascade,
  ordem int not null,                             -- ordem original na planilha (estável)
  numero_item text,                               -- EAP '01.01.01.01' (leading-zero preservado)
  nivel int,                                      -- profundidade (null se ITEM date-mangled)
  descricao text,
  unidade text,
  quantidade numeric,
  custo_unitario numeric,
  custo_total numeric                             -- preço de venda do item
);

create index if not exists obra_orcamento_itens_orcamento_idx
  on public.obra_orcamento_itens (orcamento_id);


-- 3. RLS · dono lê; worker (service_role) escreve e bypassa ──────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['obra_orcamentos', 'obra_orcamento_itens'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists "select_orcamento_by_obra_owner" on public.obra_orcamentos;
create policy "select_orcamento_by_obra_owner"
  on public.obra_orcamentos
  for select
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_orcamentos.contrato_id
        and o.created_by = auth.uid()
    )
  );

drop policy if exists "select_orcamento_item_by_obra_owner" on public.obra_orcamento_itens;
create policy "select_orcamento_item_by_obra_owner"
  on public.obra_orcamento_itens
  for select
  using (
    exists (
      select 1
      from public.obra_orcamentos o
      join public.obras ob on ob.id = o.contrato_id
      where o.id = obra_orcamento_itens.orcamento_id
        and ob.created_by = auth.uid()
    )
  );

-- anon-read (dev). FECHAR no go-live.
drop policy if exists "obra_orcamentos_anon_select" on public.obra_orcamentos;
create policy "obra_orcamentos_anon_select"
  on public.obra_orcamentos for select to anon using (true);

drop policy if exists "obra_orcamento_itens_anon_select" on public.obra_orcamento_itens;
create policy "obra_orcamento_itens_anon_select"
  on public.obra_orcamento_itens for select to anon using (true);


-- 4. GRANTs · tabelas via pg direto não herdam os grants padrão. Idempotente.
grant all on public.obra_orcamentos      to service_role;
grant all on public.obra_orcamento_itens to service_role;
grant select on public.obra_orcamentos      to anon, authenticated;
grant select on public.obra_orcamento_itens to anon, authenticated;
