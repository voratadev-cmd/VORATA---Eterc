-- C.14 Mapa da Obra · itens TRANSVERSAIS (sem km · não impedíveis por trecho).
-- A tela C.14 mostra as 16 frentes FÍSICAS (obra_mapa_segmentos · Σ 381.573.415) + 2 transversais:
--   Administração Local  132.965.428  (fonte C.4 Recursos · cláusula 8.13)
--   Materiais Faturamento Direto  96.818.471  (fonte C.3/C.6 · cláusula 8.8)
-- físicas (381,6mi) + transversais (229,8mi) = PV 611.357.314 — bate C.8/C.10/C.3.
-- NÃO entram em obra_mapa_segmentos (a C.1 Síntese lê essa tabela sem filtro de tipo e somaria errado).
-- Guardadas em obra_secoes, lidas separadamente pelo read-model do mapa. Idempotente.

begin;

delete from obra_secoes
where contrato_id = (select id from obras where id::text like 'fe288319%' limit 1)
  and titulo = 'C.14 Mapa da Obra — Itens transversais (sem km · não impedíveis por trecho)';

insert into obra_secoes
  (arquivo_id, contrato_id, modulo, codigo, titulo, tipo, colunas, dados,
   n_linhas, tem_dado, coberta, ordem, status, extracao_version, config_version)
select
  t.arquivo_id,
  o.id,
  t.modulo,
  'C.14',
  'C.14 Mapa da Obra — Itens transversais (sem km · não impedíveis por trecho)',
  'tabela',
  '["Item","Natureza","Tratado em","Valor (R$)"]'::jsonb,
  '[{"Item":"Administração Local","Natureza":"transversal (sem km)","Tratado em":"C.4 Recursos · cláusula 8.13","Valor (R$)":132965428},{"Item":"Materiais Faturamento Direto","Natureza":"transversal (sem km)","Tratado em":"C.3/C.6 · cláusula 8.8","Valor (R$)":96818471}]'::jsonb,
  2, true, true, 9999, 'ok', 46, 'v46_surgical'
from (select id from obras where id::text like 'fe288319%' limit 1) o
cross join lateral (
  select arquivo_id, modulo
  from obra_secoes
  where contrato_id = o.id and titulo like 'C.14 Mapa da Obra%'
  order by ordem
  limit 1
) t;

-- assertion: exatamente 2 itens, soma = 229.783.899 (PV físicas+transversais = 611.357.314)
do $$
declare s numeric; n int;
begin
  select count(*), coalesce(sum((d->>'Valor (R$)')::numeric), 0)
    into n, s
  from obra_secoes os
  cross join lateral jsonb_array_elements(os.dados) d
  where os.contrato_id = (select id from obras where id::text like 'fe288319%' limit 1)
    and os.titulo = 'C.14 Mapa da Obra — Itens transversais (sem km · não impedíveis por trecho)';
  if n <> 2 then raise exception 'transversais: esperado 2 itens, veio %', n; end if;
  if round(s) <> 229783899 then raise exception 'transversais: soma % != 229783899', s; end if;
  raise notice 'OK transversais: % itens, soma %', n, s;
end $$;

commit;
