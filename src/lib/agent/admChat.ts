// Cliente HTTP do agente "Adm Contratual IA" — POST /ask dispara a resposta. O WORKER insere as
// mensagens (user + placeholder ai) em adm_messages e streama via UPDATE; o front escuta por Realtime
// (ver src/lib/supabase/admChat.ts). Falha-alto em !ok (erro de leitura ≠ pendência, regra do projeto).
//
// Auth: Bearer VITE_ADM_BEARER (dev-only · no go-live mover /ask pra trás de uma Edge/Vercel function
// que injeta o VPS_SECRET server-side — o Bearer NÃO deve ir no bundle do front em prod).

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
const BEARER = import.meta.env.VITE_ADM_BEARER as string | undefined;

export type AdmAskResult = { conversation_id: string; message_id: string; status: string };

/** Dispara a pergunta. Retorna o id da conversa (real) + o id do placeholder do agente. */
export async function admAsk(params: {
  visitorId: string;
  message: string;
  obraId: string;
  conversationId?: string | null;
}): Promise<AdmAskResult> {
  const res = await fetch(`${API_URL}/api/agents/adm/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(BEARER ? { Authorization: `Bearer ${BEARER}` } : {}),
    },
    body: JSON.stringify({
      visitor_id: params.visitorId,
      message: params.message,
      obra_id: params.obraId,
      conversation_id: params.conversationId ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Falha ao enviar a pergunta (HTTP ${res.status}). O worker do agente está rodando em ${API_URL}?`,
    );
  }
  return (await res.json()) as AdmAskResult;
}
