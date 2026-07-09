-- Migration · Chat do "Adm Contratual IA" (agente Python/FastAPI)
-- ─────────────────────────────────────────────────────────────────────
-- Padrão A do guia VPS: conversa + mensagens com streaming via Realtime.
-- O agente (service_role) escreve; o front lê via anon + escuta Realtime.
-- ─────────────────────────────────────────────────────────────────────

-- ── Conversas ──────────────────────────────────────────────────────
create table if not exists public.adm_conversations (
  id              uuid primary key default gen_random_uuid(),
  visitor_id      text not null,                         -- id do solicitante (pré-auth)
  obra_id         uuid references public.obras(id) on delete set null,  -- contexto (null = global)
  title           text,
  metadata        jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists adm_conversations_visitor_idx
  on public.adm_conversations (visitor_id, last_message_at desc);

-- ── Mensagens ──────────────────────────────────────────────────────
create table if not exists public.adm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.adm_conversations(id) on delete cascade,
  role            text not null check (role in ('user','ai')),
  content         text not null default '',
  streaming       boolean not null default false,        -- true enquanto o agente escreve
  metadata        jsonb not null default '{}'::jsonb,     -- {status: thinking|streaming|done|error}
  created_at      timestamptz not null default now()
);
create index if not exists adm_messages_conv_idx
  on public.adm_messages (conversation_id, created_at asc);

-- ── Trigger: mantém last_message_at ────────────────────────────────
create or replace function public.adm_touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.adm_conversations set last_message_at = now()
   where id = new.conversation_id;
  return new;
end; $$;
drop trigger if exists adm_messages_touch on public.adm_messages;
create trigger adm_messages_touch after insert on public.adm_messages
  for each row execute function public.adm_touch_conversation();

-- ── RLS ────────────────────────────────────────────────────────────
-- Pré-auth (sem Supabase Auth ainda): anon LÊ (pra Realtime funcionar no front),
-- escrita só via service_role (agente). Quando entrar Supabase Auth, trocar o
-- SELECT por filtro `auth.uid()` / visitor vinculado ao usuário (ver guia §10).
alter table public.adm_conversations enable row level security;
alter table public.adm_messages      enable row level security;

drop policy if exists "adm_conv_select" on public.adm_conversations;
create policy "adm_conv_select" on public.adm_conversations for select using (true);

drop policy if exists "adm_msg_select" on public.adm_messages;
create policy "adm_msg_select" on public.adm_messages for select using (true);
-- Sem policy de INSERT/UPDATE/DELETE → bloqueado pra anon; service_role bypassa.

-- ── Realtime ───────────────────────────────────────────────────────
alter publication supabase_realtime add table public.adm_messages;
alter publication supabase_realtime add table public.adm_conversations;
