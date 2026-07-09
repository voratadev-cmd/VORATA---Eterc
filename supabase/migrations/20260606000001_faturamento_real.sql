-- Migration · Normalização (Camada A) — FATURAMENTO: eixo REAL na curva
-- ─────────────────────────────────────────────────────────────────────
-- O workbook-motor (C.3 Faturamento, curva mensal Previsto × Real por BM) traz o Real R$ DIRETO
-- na curva — diferente do fluxo Sorriso, onde o Real vinha de obra_medicoes (BMs). Adiciona as 2
-- colunas pra a curva ser auto-contida (contratado/previsto + projeção + REAL no mesmo ponto-mês).
-- Idempotente. O read-model passa a preferir real_rs da curva quando presente.
-- ─────────────────────────────────────────────────────────────────────

alter table public.obra_faturamento_meses
  add column if not exists real_rs numeric,             -- faturado REAL do mês (medido)
  add column if not exists real_rs_acumulado numeric;   -- acumulado RECOMPUTADO (não da fonte)
