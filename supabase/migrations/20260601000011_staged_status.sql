-- Migration · status 'staged' (arquivo subido mas cadastro ainda não finalizado)
-- ─────────────────────────────────────────────────────────────────────
-- O upload no cadastro agora insere 'staged'; o submit promove staged→raw. A RPC
-- acquire_arquivo_lease só pega raw|queued|mapping_error → 'staged' NÃO entra na
-- fila da IA. Assim não se paga mapeamento de obra abandonada (rascunho).
--
-- Garante que 'staged' é um status VÁLIDO: se houver um CHECK na coluna status
-- (criado fora do repo), troca por um com a lista completa + 'staged'. Idempotente.

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.obra_arquivos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%'
  limit 1;

  if v_conname is not null then
    execute format('alter table public.obra_arquivos drop constraint %I', v_conname);
  end if;

  alter table public.obra_arquivos
    add constraint obra_arquivos_status_check check (status in (
      'staged', 'raw', 'queued', 'mapping', 'mapped', 'mapping_error',
      'ready_to_extract', 'extracting', 'extracted', 'needs_review', 'verified',
      'extraction_error', 'cancelled', 'processing', 'error'
    ));
end $$;
