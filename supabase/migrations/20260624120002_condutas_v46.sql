-- C.11 Condutas · o workbook v46 reformulou as condutas (4 genéricas → 15 dirigidas à Arteris) e
-- enriqueceu o registro com 3 campos que o schema não tinha: DESTINATÁRIO (Interno vs Arteris),
-- RESPONSÁVEL (área dona da conduta) e RESULTADO ESPERADO (objetivo da conduta). Adiciona as colunas
-- correspondentes em obra_condutas. ADITIVO e IDEMPOTENTE — mantém as colunas antigas (retrocompat) e
-- não toca em RLS/grants (a policy de SELECT já existe). Após aplicar: regenerar database.types.ts.
alter table public.obra_condutas
  add column if not exists destinatario text,
  add column if not exists responsavel text,
  add column if not exists resultado_esperado text;
