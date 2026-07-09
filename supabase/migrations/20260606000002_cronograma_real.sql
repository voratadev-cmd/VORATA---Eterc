-- Migration · Normalização (Camada A) — CRONOGRAMA FÍSICO: eixo REAL na curva
-- ─────────────────────────────────────────────────────────────────────
-- O workbook-motor (C.5 Prazo, curva física % previsto × real acum.) traz o % físico REAL DIRETO na
-- curva. Adiciona as 2 colunas pra a curva física ser auto-contida (previsto + real no mesmo ponto-
-- mês). Em obra cujo '% Físico Real (input)' não foi preenchido, fica NULL (farol físico pendente —
-- honesto). Idempotente.
-- ─────────────────────────────────────────────────────────────────────

alter table public.obra_cronograma_meses
  add column if not exists real_pct numeric,             -- avanço físico REAL do mês (fração)
  add column if not exists real_pct_acumulado numeric;   -- físico real acumulado (fração)
