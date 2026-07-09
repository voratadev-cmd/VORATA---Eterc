-- Migration · Normalização (Camada A) — FÍSICO do BM em obra_medicao_totais
-- ─────────────────────────────────────────────────────────────────────
-- O % FÍSICO (executado) do BM vive na LINHA-RAIZ do documento (Item '1'): 'Quantidade no
-- Período' = '15,99%' (mês) e 'Quantidade acumulada no Período' = '24,99%' (acumulado · valor
-- OFICIAL do avanço físico real, atestado pela Infraero — ver DADOS-PENDENTES §4.1).
--
-- A fatia-1 só capturava VALOR (R$): o % físico era descartado em silêncio (perfil=quantidade
-- rejeita a string '15,99%'). Aqui abrimos o eixo FÍSICO no oráculo de totais — frações 0..1,
-- NULL até o BM trazer o dado. Fonte primária no engine: identificacao.percentualNoPeriodo /
-- percentualAcumulado (já frações); cross-check de coerência com a linha-raiz da tabela.
-- Idempotente (add column if not exists).
-- ─────────────────────────────────────────────────────────────────────

alter table public.obra_medicao_totais
  add column if not exists fisico_pct_periodo numeric,    -- fração 0..1 · físico DO MÊS (linha-raiz)
  add column if not exists fisico_pct_acumulado numeric;  -- fração 0..1 · físico ACUMULADO (oficial §4.1)
