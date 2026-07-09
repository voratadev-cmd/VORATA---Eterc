-- Migration · RÉGUA DE FAROL CONFIGURÁVEL POR OBRA (P1 front · achado da auditoria)
-- `obras.farol_regras` = overrides PARCIAIS dos cortes da régua oficial (src/lib/rma/farol.ts).
-- Shape: { "<indicador>": { "conforme": n, "observacao": n, "risco": n } } — só os cortes;
-- a DIREÇÃO (maior/menor=melhor) é estrutural e vive no código. Chave desconhecida é ignorada
-- na mescla (mesclarRegras). NULL = régua oficial pura.

alter table public.obras
  add column if not exists farol_regras jsonb;

comment on column public.obras.farol_regras is
  'Overrides parciais dos cortes de farol por indicador (mesclados sobre FAROL_REGRAS do front). NULL = régua oficial.';
