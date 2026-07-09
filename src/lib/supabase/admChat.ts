// Camada de dados do chat Adm Contratual IA · lê adm_conversations/adm_messages (anon SELECT) e assina
// Realtime das mensagens. ESCRITA é só do worker (/ask, service_role) — o front nunca escreve direto.
// Adapta as linhas pro contrato da UI (ChatMessage/ChatThread): role 'ai'→'agent', metadata→thinking/
// insights/duração. Erro de leitura FALHA ALTO (não vira null silencioso).

import { getSupabase } from "./client";
import {
  type ChatMessage,
  type ChatThread,
  type Insight,
  tituloDaPergunta,
} from "@/lib/mocks/chat";

// adm_* não estão no Database tipado — acesso não-tipado (mesmo padrão dos read-models do RMA).
function admTable(name: "adm_conversations" | "adm_messages") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type AdmMessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "ai";
  content: string;
  streaming?: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type AdmConversationRow = {
  id: string;
  visitor_id: string;
  obra_id: string | null;
  title: string | null;
  created_at: string;
  last_message_at?: string | null;
};

/** adm_messages → ChatMessage (contrato da UI). */
export function rowToChatMessage(r: AdmMessageRow): ChatMessage {
  const md = (r.metadata ?? {}) as Record<string, unknown>;
  const status = md.status as ChatMessage["status"];
  const streaming =
    Boolean(r.streaming) || (status != null && status !== "done" && status !== "error");
  const trace = typeof md.thinking_trace === "string" ? md.thinking_trace : "";
  const durationMs = typeof md.duration_ms === "number" ? md.duration_ms : 0;
  const insights = Array.isArray(md.insights) ? (md.insights as Insight[]) : undefined;
  const agent = r.role === "ai";
  return {
    id: r.id,
    role: agent ? "agent" : "user",
    content: r.content ?? "",
    ts: new Date(r.created_at).getTime(),
    streaming,
    status,
    // mostra o bloco "pensando/pensou" quando há traço, duração OU ainda está em geração
    thinking: agent && (trace || durationMs || streaming) ? { trace, durationMs } : undefined,
    insights,
  };
}

/** adm_conversations (+ mensagens já adaptadas) → ChatThread. Título: da conversa, ou da 1ª pergunta. */
export function convToThread(c: AdmConversationRow, messages: ChatMessage[]): ChatThread {
  const ordenadas = [...messages].sort((a, b) => a.ts - b.ts);
  const primeiraUser = ordenadas.find((m) => m.role === "user");
  const title =
    c.title || (primeiraUser ? tituloDaPergunta(primeiraUser.content) : "Nova conversa");
  const created = new Date(c.created_at).getTime();
  return {
    id: c.id,
    title,
    contractId: c.obra_id ?? "",
    createdAt: created,
    updatedAt: c.last_message_at ? new Date(c.last_message_at).getTime() : created,
    messages: ordenadas,
  };
}

/** Conversas do visitante nesta obra (mais recentes primeiro). */
export async function getAdmConversations(
  visitorId: string,
  obraId: string,
): Promise<AdmConversationRow[]> {
  const { data, error } = await admTable("adm_conversations")
    .select("id, visitor_id, obra_id, title, created_at, last_message_at")
    .eq("visitor_id", visitorId)
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdmConversationRow[];
}

/** Mensagens de uma ou várias conversas (ordem cronológica · in_ pra carregar o histórico de uma vez). */
export async function getAdmMessages(conversationIds: string | string[]): Promise<AdmMessageRow[]> {
  const ids = Array.isArray(conversationIds) ? conversationIds : [conversationIds];
  if (ids.length === 0) return [];
  const { data, error } = await admTable("adm_messages")
    .select("id, conversation_id, role, content, streaming, metadata, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdmMessageRow[];
}

/** Assina Realtime das mensagens de uma conversa (INSERT do user/ai + UPDATEs do streaming). Retorna
 *  o unsubscribe. Degrada seguro: sem Realtime configurado, vira no-op (o reload manual ainda funciona). */
export function subscribeAdmMessages(
  conversationId: string,
  onRow: (r: AdmMessageRow) => void,
): () => void {
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return () => {};
  }
  const channel = supabase
    .channel(`adm-msgs-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "adm_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        if (payload?.new) onRow(payload.new as AdmMessageRow);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
