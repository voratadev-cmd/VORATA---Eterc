-- Migration · PRODUÇÃO · fecha o acesso ANÔNIMO ao pipeline
-- ═════════════════════════════════════════════════════════════════════
-- ⚠️ APLIQUE SÓ AO ENTRAR AUTH REAL (Supabase Auth). Em DEV o front opera como
--    `anon` (sem login, fase de mocks) → se aplicar isto agora, as telas de
--    mapeamento/extração PARAM de carregar e os botões de re-extrair/avançar
--    quebram. NÃO está no fluxo de apply automático; rode manualmente no go-live.
--
-- O que fecha (corrige os 2 blockers de segurança do review):
--   1. anon-READ vazava TODA extração financeira de TODAS as obras pra internet
--      (migration ..._0005 deu `select to anon using(true)` sem filtro por dono).
--   2. anon-WRITE deixava qualquer um re-disparar extração (custo de IA arbitrário)
--      e pular o gate humano (policy UPDATE anon criada fora do repo).
--
-- Depois disto, a leitura do pipeline e as mutações de fila DEVEM ir por backend
-- autenticado / RPC security-definer, ou por usuário logado com RLS por dono.
-- Idempotente.

-- ── 1. Leitura · desfaz as policies/grants anônimos da ..._0005 ──────────
drop policy if exists "obra_arquivo_contextos_anon_select" on public.obra_arquivo_contextos;
drop policy if exists "obra_arquivo_extracoes_anon_select" on public.obra_arquivo_extracoes;
drop policy if exists "agent_runs_anon_select" on public.agent_runs;

revoke select on public.obra_arquivo_contextos from anon;
revoke select on public.obra_arquivo_extracoes from anon;
revoke select on public.agent_runs from anon; -- agent_runs é INTERNO · nunca anon

-- ── 2. Escrita na fila · bloqueia mutação anônima de obra_arquivos ───────
-- (re-extrair zera contador → custo de IA; mapped→ready_to_extract pula o gate).
drop policy if exists "obra_arquivos_anon_update" on public.obra_arquivos;
drop policy if exists "obra_arquivos anon update" on public.obra_arquivos;
revoke insert, update, delete on public.obra_arquivos from anon;

-- A leitura de obra_arquivos (lista) também deveria virar por-dono ao ter auth;
-- mantida por ora pois a tela de cadastro depende dela. Revise no go-live.

-- ── 3. Gate SERVER-SIDE · valida transições de status (cliente não pula etapas) ──
-- Hoje o gate humano (mapped→ready_to_extract) é só de UI; um cliente podia setar
-- qualquer status. Aqui: backend (service_role/postgres) faz QUALQUER transição;
-- cliente (anon/authenticated) só as SEGURAS — avançar o gate, re-mapear, re-extrair,
-- cancelar/retomar. Nunca *→extracted/extracting/verified direto do cliente.
create or replace function public.validate_arquivo_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(auth.role(), 'service_role');
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  -- auth.role() lê o papel do JWT (anon/authenticated/service_role) e funciona
  -- mesmo em SECURITY DEFINER (≠ current_user, que aqui seria sempre o dono postgres
  -- → tornava o gate um no-op). Conexão direta (admin/migration) → null → service_role.
  if v_role not in ('anon', 'authenticated') then
    return new;  -- backend/admin pode tudo
  end if;
  if (old.status = 'mapped' and new.status = 'ready_to_extract')
     or (old.status = 'staged' and new.status = 'raw')  -- submit do cadastro promove staged→raw
     or (old.status in ('mapped','mapping_error','needs_review','error','extracted','verified','extraction_error')
         and new.status = 'raw')
     or (old.status in ('extracted','verified','needs_review','extraction_error')
         and new.status = 'ready_to_extract')
     or (new.status = 'cancelled')
     or (old.status = 'cancelled' and new.status in ('raw','queued')) then
    return new;
  end if;
  raise exception 'Transição de status não permitida ao cliente: % -> %', old.status, new.status;
end; $$;

drop trigger if exists trg_validate_arquivo_transition on public.obra_arquivos;
create trigger trg_validate_arquivo_transition
  before update of status on public.obra_arquivos
  for each row execute function public.validate_arquivo_transition();
