-- C.13 Timeline · o workbook v46 reformulou o "Registro de Eventos que impactam o prazo" para o
-- framing de IMPACTO NO CAMINHO CRÍTICO: saiu Categoria/Status análise/Cláusula; entrou
--   • Atraso considerado (dias)  • Janela do impacto (início → fim)  • Fonte (RDO/ATA).
-- Adiciona as colunas correspondentes em obra_eventos_prazo. ADITIVO e IDEMPOTENTE — mantém as
-- colunas antigas (retrocompat) e não toca em RLS/grants (a policy de SELECT anon/authenticated
-- já existe). Após aplicar: regenerar database.types.ts.
alter table public.obra_eventos_prazo
  add column if not exists dias_atraso integer,
  add column if not exists fonte text,
  add column if not exists janela_inicio date,
  add column if not exists janela_fim text;
