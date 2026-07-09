-- Migration · Unicidade lógica de documento por obra (rede de segurança contra duplicata)
-- ─────────────────────────────────────────────────────────────────────
-- Hoje a dedup só existe no estado React (fileKey = nome::size). Reload, 2 abas ou
-- retomada de cadastro podem inserir o MESMO documento 2x → a IA mapeia/extrai o mesmo
-- BM duas vezes (custo dobrado + 2 versões do mesmo dado financeiro). Aqui criamos a
-- trava no banco: mesmo (obra_id, nome_original, size) = mesmo documento.
-- O front trata o erro 23505 como "já enviado" (createObraArquivo → duplicate:true).
-- Idempotente.

-- 1. Remove duplicatas JÁ existentes, mantendo a MAIS ANTIGA de cada grupo — só as que
--    ainda NÃO avançaram no pipeline (não apaga dado já processado).
with ranked as (
  select id,
         row_number() over (
           partition by obra_id, nome_original, coalesce(size, -1)
           order by uploaded_at asc, id asc
         ) as rn
  from public.obra_arquivos
)
delete from public.obra_arquivos a
using ranked r
where a.id = r.id
  and r.rn > 1
  and a.status in ('staged', 'raw', 'queued', 'mapping_error', 'error', 'cancelled');

-- 2. Índice único (idempotente). Se ainda restar duplicata JÁ processada, este create
--    falha de propósito — resolva manualmente antes (duplicata processada é dado real).
create unique index if not exists obra_arquivos_doc_uniq
  on public.obra_arquivos (obra_id, nome_original, (coalesce(size, -1)));
