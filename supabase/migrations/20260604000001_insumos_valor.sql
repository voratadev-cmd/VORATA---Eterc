-- Valor ORÇADO (R$) por insumo — do Histograma de Insumos por Valor (enriquecimento cross-doc).
-- É REFERÊNCIA orçada, NÃO preço de centavo: a extração tem confiança 0,600 e as fontes de valor
-- divergem ~7% (histograma por valor Σ=39,26 mi × curva ABC detalhamento Σ=42,27 mi × contrato
-- 39,78 mi). Habilita a Curva ABC POR VALOR (ranking de Pareto — quais insumos concentram o custo),
-- que é robusto entre as fontes; o valor absoluto é referência. NULL até enriquecer.
alter table public.obra_insumos
  add column if not exists valor_orcado numeric;
