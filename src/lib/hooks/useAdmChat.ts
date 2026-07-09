// Hook do chat REAL "Adm Contratual IA" — substitui o motor mockado (useGeracaoMock/gerarResposta).
// Fluxo: visitor_id (localStorage) → carrega conversas+mensagens (anon) → assina Realtime da conversa
// ativa → enviar() POSTa /ask (o WORKER grava user+ai e streama via UPDATE; o front recebe por Realtime).
//
// A UI NÃO muda — este hook entrega a mesma interface (threads/activeId/enviar/…) que a tela consumia.
// Honestidade: erro de leitura aparece como erro (não some); a mensagem de streaming vive na thread com
// `streaming=true` (sem 0/placeholder fabricado). pin/excluir são LOCAIS (anon não escreve — RLS).

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { type ChatMessage, type ChatThread, tituloDaPergunta, uid } from "@/lib/mocks/chat";
import { admAsk } from "@/lib/agent/admChat";
import {
  type AdmMessageRow,
  convToThread,
  getAdmConversations,
  getAdmMessages,
  rowToChatMessage,
  subscribeAdmMessages,
} from "@/lib/supabase/admChat";

const ehTemp = (id: string | null | undefined) => Boolean(id && id.startsWith("tmp"));
const ordenar = (m: ChatMessage[]) => [...m].sort((a, b) => a.ts - b.ts);

/** Mescla uma linha do Realtime nas mensagens: atualiza por id; reconcilia a msg otimista do user
 *  (id `tmp-…`, mesmo conteúdo) com a real; senão acrescenta. */
function mesclar(msgs: ChatMessage[], nova: ChatMessage): ChatMessage[] {
  const i = msgs.findIndex((m) => m.id === nova.id);
  if (i >= 0) {
    const out = msgs.slice();
    out[i] = nova;
    return out;
  }
  if (nova.role === "user") {
    const t = msgs.findIndex(
      (m) => m.role === "user" && ehTemp(m.id) && m.content === nova.content,
    );
    if (t >= 0) {
      const out = msgs.slice();
      out[t] = nova;
      return out;
    }
  }
  return [...msgs, nova];
}

export type UseAdmChat = {
  threads: ChatThread[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  gerando: boolean;
  enviar: (texto: string) => void;
  regenerar: (threadId: string) => void;
  novaConversa: () => void;
  excluir: (id: string) => void;
  fixar: (id: string) => void;
  abrir: (id: string) => void;
};

export function useAdmChat(contractId: string): UseAdmChat {
  // Identidade = USUÁRIO LOGADO (não um UUID por-navegador no localStorage). Assim as conversas
  // persistem entre origens/dispositivos do mesmo usuário — antes, localhost e produção viam
  // históricos diferentes (visitor_id distinto por origem) e a sensação era "perdi as conversas".
  const { user } = useCurrentUser();
  const visitorId = user.id;
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "enviando" cobre a janela do POST (antes do streaming acender `gerando`): sem isso, um 2º envio
  // rápido abriria uma 2ª conversa em paralelo. Ref p/ o guard SÍNCRONO + state p/ a UI (`gerando`).
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const marcarEnviando = useCallback((v: boolean) => {
    enviandoRef.current = v;
    setEnviando(v);
  }, []);

  // mantém uma referência viva da thread ativa p/ handlers sem recriar dependências
  const threadsRef = useRef<ChatThread[]>(threads);
  threadsRef.current = threads;

  // ── carga inicial: conversas + mensagens do visitante nesta obra ────────────────────────────
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const convs = await getAdmConversations(visitorId, contractId);
        const porConv = new Map<string, ChatMessage[]>();
        if (convs.length) {
          const rows = await getAdmMessages(convs.map((c) => c.id));
          for (const r of rows) {
            const arr = porConv.get(r.conversation_id) ?? [];
            arr.push(rowToChatMessage(r));
            porConv.set(r.conversation_id, arr);
          }
        }
        // descarta conversas SEM mensagens (criadas por um envio que falhou → lixo no histórico).
        const ts = convs
          .map((c) => convToThread(c, porConv.get(c.id) ?? []))
          .filter((t) => t.messages.length > 0);
        if (!cancel) {
          setThreads(ts);
          // abre direto a conversa mais recente (prova que persistiu) — vazio → estado de boas-vindas.
          setActiveId(ts[0]?.id ?? null);
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [contractId, visitorId]);

  // ── Realtime da conversa ativa (id real): BOOTSTRAP (fecha a janela cega da conversa nova, onde o
  //    INSERT de user/ai ocorre ANTES do subscribe) → depois assina os UPDATEs do streaming ────────
  useEffect(() => {
    if (!activeId || ehTemp(activeId)) return;
    let cancel = false;
    let unsub = () => {};
    const aplicar = (row: AdmMessageRow) => {
      if (cancel) return;
      const m = rowToChatMessage(row);
      setThreads((ts) =>
        ts.map((t) =>
          t.id === activeId
            ? { ...t, messages: ordenar(mesclar(t.messages, m)), updatedAt: Date.now() }
            : t,
        ),
      );
    };
    void (async () => {
      // Bootstrap: lê o estado atual do banco (user+ai REAIS, descartando as otimistas) ANTES de
      // assinar — assim nenhum INSERT da janela cega se perde. Os UPDATEs (conteúdo CUMULATIVO)
      // chegam depois pelo subscribe e convergem mesmo que algum intermediário escape.
      try {
        const rows = await getAdmMessages(activeId);
        if (!cancel) {
          const msgs = ordenar(rows.map(rowToChatMessage));
          setThreads((ts) => ts.map((t) => (t.id === activeId ? { ...t, messages: msgs } : t)));
        }
      } catch {
        // leitura falhou → segue só com o Realtime (degrada seguro)
      }
      if (!cancel) unsub = subscribeAdmMessages(activeId, aplicar);
    })();
    return () => {
      cancel = true;
      unsub();
    };
  }, [activeId]);

  // ── enviar ──────────────────────────────────────────────────────────────────────────────────
  const enviar = useCallback(
    (texto: string) => {
      const t = texto.trim();
      if (!t || enviandoRef.current) return;
      marcarEnviando(true);
      const now = Date.now();
      const userMsg: ChatMessage = { id: uid("tmp"), role: "user", content: t, ts: now };
      const existente = activeId && !ehTemp(activeId) ? activeId : null;

      // 1) otimista: mostra a msg do user na hora. Decide AQUI (síncrono) se é conversa NOVA — o id
      // NÃO pode nascer dentro do updater do setThreads: o setActiveId abaixo roda ANTES do React
      // executar o updater, então leria null e a conversa nova não seria selecionada (bug "tenho que
      // clicar nela"). Usa threadsRef (estado atual) p/ saber se a conversa-alvo já existe.
      const ehExistente = Boolean(existente && threadsRef.current.some((x) => x.id === existente));
      const novaThreadId = ehExistente ? null : uid("tmp-th");
      setThreads((ts) => {
        if (ehExistente) {
          return ts.map((x) =>
            x.id === existente ? { ...x, messages: [...x.messages, userMsg], updatedAt: now } : x,
          );
        }
        const novo: ChatThread = {
          id: novaThreadId!,
          title: tituloDaPergunta(t),
          contractId,
          createdAt: now,
          updatedAt: now,
          messages: [userMsg],
        };
        return [novo, ...ts];
      });
      if (novaThreadId) setActiveId(novaThreadId); // abre a conversa nova na hora

      // 2) dispara o worker; ao retornar o conversation_id real, troca o id temp e o Realtime assume
      admAsk({ visitorId, message: t, obraId: contractId, conversationId: existente })
        .then((res) => {
          if (novaThreadId) {
            setThreads((ts) =>
              ts.map((x) => (x.id === novaThreadId ? { ...x, id: res.conversation_id } : x)),
            );
            setActiveId((cur) => (cur === novaThreadId ? res.conversation_id : cur));
          }
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
          // POST falhou numa conversa NOVA → remove a thread temporária (sem fantasma no histórico)
          if (novaThreadId) {
            setThreads((ts) => ts.filter((x) => x.id !== novaThreadId));
            setActiveId((cur) => (cur === novaThreadId ? null : cur));
          }
        })
        .finally(() => marcarEnviando(false));
    },
    [activeId, visitorId, contractId, marcarEnviando],
  );

  // re-pergunta a última mensagem do usuário (não há endpoint de "regenerar" — re-envia)
  const regenerar = useCallback(
    (threadId: string) => {
      const th = threadsRef.current.find((x) => x.id === threadId);
      const ultUser = th && [...th.messages].reverse().find((m) => m.role === "user");
      if (!ultUser || ehTemp(threadId) || enviandoRef.current) return;
      marcarEnviando(true);
      admAsk({
        visitorId,
        message: ultUser.content,
        obraId: contractId,
        conversationId: threadId,
      })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => marcarEnviando(false));
    },
    [visitorId, contractId, marcarEnviando],
  );

  const novaConversa = useCallback(() => setActiveId(null), []);
  const abrir = useCallback((id: string) => setActiveId(id), []);

  // pin/excluir são LOCAIS (anon não escreve nas tabelas — RLS). Some da lista nesta sessão.
  const excluir = useCallback((id: string) => {
    setThreads((ts) => ts.filter((t) => t.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);
  const fixar = useCallback((id: string) => {
    setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }, []);

  const ativa = threads.find((t) => t.id === activeId) ?? null;
  const gerando =
    enviando || Boolean(ativa?.messages.some((m) => m.role === "agent" && m.streaming));

  return {
    threads,
    activeId,
    loading,
    error,
    gerando,
    enviar,
    regenerar,
    novaConversa,
    excluir,
    fixar,
    abrir,
  };
}
