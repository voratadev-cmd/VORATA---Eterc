-- Migration · Habilita Supabase Realtime no pipeline
-- ─────────────────────────────────────────────────────────────────────
-- Adiciona obra_arquivos à publication `supabase_realtime` pra o front receber
-- mudanças de status na hora (substitui o polling de 4s por um fallback longo).
-- O front assina obra_arquivos filtrando por obra_id e invalida os caches.
-- Idempotente (só adiciona se ainda não estiver na publication).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'obra_arquivos'
  ) then
    alter publication supabase_realtime add table public.obra_arquivos;
  end if;
end $$;

-- REPLICA IDENTITY FULL: faz o evento de DELETE/UPDATE carregar a linha inteira
-- (incl. obra_id) no OLD — senão o filtro `obra_id=eq.X` não casa num DELETE (que
-- por padrão só traz a PK). Barato p/ esta tabela (poucas linhas por obra).
alter table public.obra_arquivos replica identity full;
