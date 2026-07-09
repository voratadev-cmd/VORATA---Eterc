-- C.11 Condutas · a tela v46 mostra, por conduta, um parágrafo de MOTIVO/CONTEXTO (o "porquê" da
-- conduta — fato que a origina, base do registro contemporâneo). O schema não tinha esse campo.
-- Adiciona obra_condutas.motivo. ADITIVO e IDEMPOTENTE. Após aplicar: regenerar database.types.ts.
alter table public.obra_condutas
  add column if not exists motivo text;
