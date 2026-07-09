-- Migration · Normalização (Camada A) — INSUMOS · eixo de PREÇO (reajustado / real)
-- ─────────────────────────────────────────────────────────────────────
-- A Curva ABC de materiais do WORKBOOK-MOTOR (C.6) traz preço ORÇADO (já em preco_orcado_unit),
-- e prepara dois eixos adicionais de preço: reajustado (índice contratual) e real pago.
-- Ambos NULLABLE — ficam VAZIOS até haver BM com medição/nota; honestidade: branco ≠ zero, e o
-- farol de DESVIO DE PREÇO (que depende do real) fica PENDENTE na Camada B (nunca verde sem real).
-- Idempotente (add column if not exists). preco_orcado_unit / valor_orcado já existem (0001/0004).
-- ─────────────────────────────────────────────────────────────────────

alter table public.obra_insumos add column if not exists preco_reajustado_unit numeric;
alter table public.obra_insumos add column if not exists preco_real_pago_unit numeric;

comment on column public.obra_insumos.preco_reajustado_unit is
  'Preço unitário reajustado (índice contratual). NULL até reajuste/medição — não inventar.';
comment on column public.obra_insumos.preco_real_pago_unit is
  'Preço unitário real pago (nota fiscal). NULL no BM-1 — farol de desvio fica pendente sem ele.';
