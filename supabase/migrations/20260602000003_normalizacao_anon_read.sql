-- Migration · DEV · anon SELECT nas tabelas canônicas da normalização
-- ─────────────────────────────────────────────────────────────────────
-- O front lê o pipeline via ANON em dev (obra_arquivo_extracoes tem
-- `obra_arquivo_extracoes_anon_select`). As tabelas da normalização só tinham owner-RLS,
-- então a tela de Normalização (anon) não enxergava o dado. Espelha o mesmo padrão dev.
-- ⚠️ Fechar no go-live junto com as outras (ver 20260601000008_PRODUCAO_close_anon_access).
-- Idempotente.

do $$
declare
  t text;
begin
  foreach t in array array['obra_medicoes', 'obra_medicao_itens', 'obra_medicao_totais'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_select', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_anon_select', t
    );
  end loop;
end $$;
