-- Migration · DEV · libera SOMENTE LEITURA do pipeline pro front anônimo
-- ─────────────────────────────────────────────────────────────────────
-- O front ainda não tem auth (fase final) · opera como `anon`. A tabela
-- obra_arquivos já tem policy `anon select using(true)` (criada fora do repo),
-- mas obra_arquivo_contextos / _extracoes / agent_runs só têm policies por dono
-- (`created_by = auth.uid()`), que para anon (auth.uid() = null) retornam ZERO
-- linhas → os contextos não carregam (cards "Aguardando mapa", sem o tipo da IA).
--
-- Aqui liberamos APENAS SELECT pro anon (somente leitura · nenhuma escrita
-- anônima). Quando entrar auth de verdade, trocar por policies por dono.
-- Idempotente.

grant select on public.obra_arquivo_contextos to anon, authenticated;
grant select on public.obra_arquivo_extracoes to anon, authenticated;
grant select on public.agent_runs            to anon, authenticated;

drop policy if exists "obra_arquivo_contextos_anon_select" on public.obra_arquivo_contextos;
create policy "obra_arquivo_contextos_anon_select" on public.obra_arquivo_contextos
  for select to anon, authenticated using (true);

drop policy if exists "obra_arquivo_extracoes_anon_select" on public.obra_arquivo_extracoes;
create policy "obra_arquivo_extracoes_anon_select" on public.obra_arquivo_extracoes
  for select to anon, authenticated using (true);

drop policy if exists "agent_runs_anon_select" on public.agent_runs;
create policy "agent_runs_anon_select" on public.agent_runs
  for select to anon, authenticated using (true);
