-- Migration · Normalização — D.4 · VALOR AGREGADO (earned value · AACE 25R-03 · Tela Recursos/C.4 + D.4)
-- A aba "D.4 Valor Agregado" do workbook decompõe o avanço FÍSICO produtivo (Qtd medida × CPU R$/un)
-- em Valor Agregado por categoria (MOD/EQP) e confronta com o Real Alocado (histograma C.4) →
-- Perda de Produtividade = Alocado − Agregado. 1ª tabela = RESUMO por categoria (MOD/EQP/TOTAL);
-- 2ª = VA por serviço (Qtd medida × R$/un, só os serviços com produção medida; o 0 é default de
-- fórmula, não medição). Gate conserva ao centavo: perda == alocado − agregado · TOTAL == MOD+EQP ·
-- Σ VA por serviço == VA medido do resumo. ADITIVO: não toca nenhuma tabela existente.

create table if not exists public.obra_valor_agregado (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  categoria text not null,           -- 'MOD' | 'EQP' | 'TOTAL'
  va_medido_rs numeric,              -- Valor Agregado necessário (R$) = Σ serviço (Qtd × R$/un)
  real_alocado_rs numeric,           -- Real alocado (histograma C.4 · R$)
  perda_rs numeric,                  -- Perda de produtividade = Alocado − Agregado
  pct_pv numeric,                    -- FRAÇÃO · perda / PV (informativo, não conserva por soma)
  farol text,                        -- farol da perda · só na linha TOTAL (ex.: 'Observação') · NULL nas demais
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, categoria)
);
create index if not exists obra_valor_agregado_contrato_idx on public.obra_valor_agregado (contrato_id);
alter table public.obra_valor_agregado enable row level security;
drop policy if exists "select_va_owner" on public.obra_valor_agregado;
create policy "select_va_owner" on public.obra_valor_agregado for select
  using (exists (select 1 from public.obras o where o.id = obra_valor_agregado.contrato_id and o.created_by = auth.uid()));
drop policy if exists "va_anon" on public.obra_valor_agregado;
create policy "va_anon" on public.obra_valor_agregado for select to anon using (true);
grant all on public.obra_valor_agregado to service_role;
grant select on public.obra_valor_agregado to anon, authenticated;

-- VA por serviço (Qtd medida × R$/un) — 1 linha por serviço com produção. Serviço sem qtd → VA 0
-- (default de fórmula, não fabricado). Keyed por código CPU (há serviços homônimos).
create table if not exists public.obra_valor_agregado_servico (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.obras(id) on delete cascade,
  arquivo_id uuid not null references public.obra_arquivos(id) on delete cascade,
  extracao_version int not null,
  config_version text not null,
  ordem int not null,
  codigo_cpu text,                   -- '1.1.1.23.' (normalizado, sem espaços) · âncora da unique
  servico text not null,             -- 'Supressão Vegetal com destocamento' · 'Escavação 1ª e 2ª cat'
  unidade text,                      -- 'm²' | 'm³' | …
  pct_mod numeric,                   -- FRAÇÃO · participação MOD na CPU
  pct_eqp numeric,                   -- FRAÇÃO · participação EQP na CPU
  mod_rs_un numeric,                 -- R$/un de MOD (CPU)
  eqp_rs_un numeric,                 -- R$/un de EQP (CPU)
  qtd_medida numeric,                -- Qtd medida (BM · input) · NULL/0 = não medido
  va_mod_rs numeric,                 -- VA MOD (R$) = qtd × mod_rs_un
  va_eqp_rs numeric,                 -- VA EQP (R$) = qtd × eqp_rs_un
  status text not null default 'ok' check (status in ('ok', 'needs_review')),
  created_at timestamptz not null default now(),
  unique (contrato_id, arquivo_id, extracao_version, ordem)
);
create index if not exists obra_valor_agregado_serv_contrato_idx on public.obra_valor_agregado_servico (contrato_id);
alter table public.obra_valor_agregado_servico enable row level security;
drop policy if exists "select_va_serv_owner" on public.obra_valor_agregado_servico;
create policy "select_va_serv_owner" on public.obra_valor_agregado_servico for select
  using (exists (select 1 from public.obras o where o.id = obra_valor_agregado_servico.contrato_id and o.created_by = auth.uid()));
drop policy if exists "va_serv_anon" on public.obra_valor_agregado_servico;
create policy "va_serv_anon" on public.obra_valor_agregado_servico for select to anon using (true);
grant all on public.obra_valor_agregado_servico to service_role;
grant select on public.obra_valor_agregado_servico to anon, authenticated;
