// Chat · Adm Contratual IA (RMA transversal) — agente REAL (tool-calling) via useAdmChat: threads do
// banco (adm_conversations/adm_messages, anon) + streaming por Supabase Realtime. A UI (sidebar,
// conversa, composer, painel de resumo) é a MESMA do mock — só o motor por trás mudou.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Flag,
  Loader2,
  type LucideIcon,
  PanelLeft,
  PanelRight,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button, IconButton } from "@/components/ds";
import { useObras } from "@/lib/hooks/useObras";
import { useAdmChat } from "@/lib/hooks/useAdmChat";
import {
  type ChatMessage,
  type ChatThread,
  type InsightCronologico,
  SUGESTOES,
  coletarInsights,
} from "@/lib/mocks/chat";
import "./chat.css";

export const Route = createFileRoute("/_app/contracts/$contractId/chat")({
  component: ChatAba,
});

// ícones das sugestões (lucide · substitui os ícones do DS que o usuário reprovou)
const SUG_ICON: Record<string, LucideIcon> = {
  wallet: Wallet,
  clock: Clock,
  users: Users,
  flag: Flag,
  trending: TrendingDown,
};

// Marca do agente — chip com gradiente brand + monograma "IA" (sem o sparkle, a pedido).
function AgentMark({ size = 30, hero = false }: { size?: number; hero?: boolean }) {
  return (
    <span
      className={`chat-agent-mark${hero ? " hero" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      IA
    </span>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────

function ChatAba() {
  const { contractId } = Route.useParams();
  const { data: obras } = useObras();
  const obraNome = obras?.find((o) => o.id === contractId)?.nome_interno ?? "esta obra";

  const {
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
  } = useAdmChat(contractId);
  const [input, setInput] = useState("");
  const [recolhido, setRecolhido] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(true);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const vazia = !active || active.messages.length === 0;
  const insights = active ? coletarInsights(active) : [];

  // o hook cuida da thread/streaming; aqui só limpamos o input ao enviar.
  const onEnviar = useCallback(
    (texto: string) => {
      enviar(texto);
      setInput("");
    },
    [enviar],
  );

  return (
    <div className={`chat${recolhido ? " recolhido" : ""}${resumoAberto ? "" : " sem-resumo"}`}>
      <ThreadsSidebar
        threads={threads}
        activeId={activeId}
        onAbrir={abrir}
        onNova={novaConversa}
        onFixar={fixar}
        onExcluir={excluir}
      />
      <section className="chat-conversa">
        <header className="chat-conversa-head">
          <IconButton
            aria-label={recolhido ? "Mostrar conversas" : "Ocultar conversas"}
            variant="ghost"
            size="sm"
            className="chat-toggle-threads"
            onClick={() => setRecolhido((r) => !r)}
          >
            <PanelLeft size={17} />
          </IconButton>
          <AgentMark size={32} />
          <div className="chat-conversa-id">
            <span className="chat-conversa-nome">Adm Contratual IA</span>
            <span className="chat-conversa-sub">
              {active ? active.title : "Nova conversa"} · {obraNome}
            </span>
          </div>
          <IconButton
            aria-label={resumoAberto ? "Ocultar resumo" : "Mostrar resumo"}
            variant="ghost"
            size="sm"
            className={`chat-toggle-resumo${resumoAberto ? " ativo" : ""}`}
            onClick={() => setResumoAberto((r) => !r)}
          >
            <PanelRight size={17} />
          </IconButton>
        </header>

        {vazia ? (
          loading ? (
            <div className="chat-vazio">
              <div className="chat-vazio-inner">
                <p className="chat-vazio-sub">Carregando conversas…</p>
              </div>
            </div>
          ) : error ? (
            <div className="chat-vazio">
              <div className="chat-vazio-inner">
                <p className="chat-vazio-sub" role="alert">
                  Não foi possível falar com o agente: {error}
                </p>
              </div>
            </div>
          ) : (
            <ChatVazio obraNome={obraNome} onSugestao={onEnviar} />
          )
        ) : (
          <Mensagens thread={active!} onRegenerar={regenerar} />
        )}

        {error && !vazia ? (
          <div role="alert" className="chat-error-alert">
            {error}
          </div>
        ) : null}

        <Composer
          valor={input}
          onValor={setInput}
          onEnviar={onEnviar}
          gerando={gerando}
          focoKey={activeId ?? "nova"}
        />
      </section>
      <ResumoPanel insights={insights} temConversa={!vazia} />
    </div>
  );
}

// ── Sidebar de threads ───────────────────────────────────────────────

function grupoData(ts: number, agora: number): string {
  const dia = 24 * 60 * 60 * 1000;
  const d = agora - ts;
  if (d < dia) return "Hoje";
  if (d < 2 * dia) return "Ontem";
  if (d < 7 * dia) return "Últimos 7 dias";
  return "Anteriores";
}

const ORDEM_GRUPOS = ["Fixadas", "Hoje", "Ontem", "Últimos 7 dias", "Anteriores"];

function ThreadsSidebar({
  threads,
  activeId,
  onAbrir,
  onNova,
  onFixar,
  onExcluir,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onAbrir: (id: string) => void;
  onNova: () => void;
  onFixar: (id: string) => void;
  onExcluir: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const agora = useRef(Date.now()).current;

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtradas = q ? threads.filter((t) => t.title.toLowerCase().includes(q)) : threads;
    const map = new Map<string, ChatThread[]>();
    for (const t of [...filtradas].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const g = t.pinned ? "Fixadas" : grupoData(t.updatedAt, agora);
      (map.get(g) ?? map.set(g, []).get(g)!).push(t);
    }
    return ORDEM_GRUPOS.filter((g) => map.has(g)).map((g) => ({ grupo: g, itens: map.get(g)! }));
  }, [threads, busca, agora]);

  return (
    <aside className="chat-threads">
      <div className="chat-threads-top">
        <Button variant="outline" size="sm" className="chat-novo" onClick={onNova}>
          <Plus size={15} /> Nova conversa
        </Button>
        <label className="col-busca chat-busca">
          <span className="col-busca-ic" aria-hidden>
            <Search size={14} />
          </span>
          <input
            type="search"
            className="col-busca-in"
            placeholder="Buscar conversas…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar conversas"
          />
          {busca ? (
            <button
              type="button"
              className="col-busca-cl"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          ) : null}
        </label>
      </div>

      <div className="chat-threads-list">
        {grupos.length === 0 ? (
          <div className="chat-threads-vazio">
            {busca ? "Nenhuma conversa encontrada." : "Sem conversas ainda."}
          </div>
        ) : (
          grupos.map(({ grupo, itens }) => (
            <div key={grupo} className="chat-grupo">
              <div className="chat-grupo-label">{grupo}</div>
              {itens.map((t) => (
                <ThreadItem
                  key={t.id}
                  thread={t}
                  ativo={t.id === activeId}
                  onAbrir={() => onAbrir(t.id)}
                  onFixar={() => onFixar(t.id)}
                  onExcluir={() => onExcluir(t.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function ThreadItem({
  thread,
  ativo,
  onAbrir,
  onFixar,
  onExcluir,
}: {
  thread: ChatThread;
  ativo: boolean;
  onAbrir: () => void;
  onFixar: () => void;
  onExcluir: () => void;
}) {
  const ultima = thread.messages[thread.messages.length - 1];
  return (
    <div className={`chat-thread ${ativo ? "ativo" : ""}`}>
      <button type="button" className="chat-thread-main" onClick={onAbrir}>
        <span className="chat-thread-title">
          {thread.pinned ? (
            <span className="chat-thread-pin">
              <Pin size={12} fill="currentColor" />
            </span>
          ) : null}
          {thread.title}
        </span>
        <span className="chat-thread-prev">{ultima?.content.replace(/[*`#]/g, "") ?? ""}</span>
      </button>
      <div className="chat-thread-acts">
        <IconButton
          aria-label={thread.pinned ? "Desafixar" : "Fixar"}
          aria-pressed={thread.pinned}
          variant="ghost"
          size="sm"
          onClick={onFixar}
        >
          {thread.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </IconButton>
        <IconButton aria-label="Excluir conversa" variant="ghost" size="sm" onClick={onExcluir}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  );
}

// ── Painel "Linha do tempo" (timeline dos dados-chave que a IA destacou) ──────

// descrição curta por insight — o backend emite só label/valor/tom; isto dá a "descrição" da timeline.
const INSIGHT_DESC: Record<string, string> = {
  "Real acumulado": "Faturamento realizado até o BM de corte.",
  "Desvio acum.": "Realizado vs. previsto no acumulado.",
  "Desequilíbrio total": "Soma das parcelas do Painel D.0.",
  Impedido: "Valor travado por impedimento / força maior.",
  "Impedido (chuva/sinistro)": "Valor travado por chuva ou sinistro.",
  "Markup BDI": "Markup total do BDI contratual.",
  "Insumos (orçado)": "Valor total orçado de insumos.",
  "MOD contratado": "Mão de obra direta contratada.",
  "Aderência HH": "Aderência de horas-homem realizadas.",
};

function dataRelativa(ts: number): string {
  const d = new Date(ts);
  const agora = new Date();
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === agora.toDateString()) return `Hoje, ${hhmm}`;
  if (d.toDateString() === ontem.toDateString()) return `Ontem, ${hhmm}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${hhmm}`;
}

function ResumoPanel({
  insights,
  temConversa,
}: {
  insights: InsightCronologico[];
  temConversa: boolean;
}) {
  return (
    <aside className="chat-resumo">
      <header className="chat-resumo-head">
        <div className="chat-resumo-id">
          <span className="chat-resumo-titulo">Linha do tempo</span>
          <span className="chat-resumo-sub">dados-chave que a IA destacou</span>
        </div>
        {insights.length > 0 ? <span className="chat-resumo-count">{insights.length}</span> : null}
      </header>
      <div className="chat-resumo-body">
        {insights.length === 0 ? (
          <div className="chat-resumo-vazio">
            <p>
              {temConversa
                ? "Esta conversa ainda não destacou números. Pergunte sobre faturamento, prazo ou recursos."
                : "Conforme você conversa, monto aqui uma linha do tempo com os números e fatos mais importantes."}
            </p>
          </div>
        ) : (
          <ol className="chat-tl" aria-label="Linha do tempo dos dados-chave">
            {insights.map((ins, i) => (
              <li
                key={`${ins.label}-${ins.ts}`}
                className="chat-tl-node"
                style={{ animationDelay: `${Math.min(i, 14) * 70}ms` }}
              >
                <span className={`chat-tl-dot tom-${ins.tom ?? "neutral"}`} aria-hidden />
                <div className={`chat-tl-card tom-${ins.tom ?? "neutral"}`}>
                  <div className="chat-tl-top">
                    <span className="chat-tl-title">{ins.label}</span>
                    <time className="chat-tl-date" dateTime={new Date(ins.ts).toISOString()}>
                      {dataRelativa(ins.ts)}
                    </time>
                  </div>
                  <div className="chat-tl-valor">{ins.valor}</div>
                  {INSIGHT_DESC[ins.label] ? (
                    <p className="chat-tl-desc">{INSIGHT_DESC[ins.label]}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

// ── Conversa (mensagens + geração em andamento) ──────────────────────

function Mensagens({
  thread,
  onRegenerar,
}: {
  thread: ChatThread;
  onRegenerar: (threadId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [noFim, setNoFim] = useState(true);
  const ultima = thread.messages[thread.messages.length - 1];

  const aoFundo = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // ao abrir/trocar de conversa: vai direto pro fim (mostra a última mensagem)
  useEffect(() => {
    aoFundo();
    setNoFim(true);
  }, [thread.id, aoFundo]);

  // mensagem nova / streaming (conteúdo cresce via Realtime): acompanha o fim se o usuário já estava perto
  useEffect(() => {
    if (noFim) aoFundo();
  }, [thread.messages.length, ultima?.content, ultima?.streaming, noFim, aoFundo]);

  const aoRolar = () => {
    const el = ref.current;
    if (el) setNoFim(el.scrollHeight - el.scrollTop - el.clientHeight < 160);
  };

  return (
    <div className="chat-msgs-wrap">
      <div className="chat-msgs" ref={ref} onScroll={aoRolar}>
        <div className="chat-msgs-inner">
          {thread.messages.map((m) => (
            <Mensagem
              key={m.id}
              msg={m}
              ehUltima={m.id === ultima?.id}
              onRegenerar={() => onRegenerar(thread.id)}
            />
          ))}
        </div>
      </div>
      {!noFim ? (
        <IconButton
          aria-label="Ir para o fim"
          variant="outline"
          className="chat-scroll-fim"
          onClick={aoFundo}
        >
          <ArrowDown size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Mensagem({
  msg,
  ehUltima,
  onRegenerar,
}: {
  msg: ChatMessage;
  ehUltima: boolean;
  onRegenerar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard?.writeText(msg.content).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    });
  };
  // memoiza o parse do markdown por conteúdo: no streaming, só a msg que cresce re-parseia (as outras
  // reaproveitam o cache), em vez de TODAS re-parsearem a cada token.
  const md = useMemo(() => <Markdown text={msg.content} />, [msg.content]);
  if (msg.role === "user") {
    return (
      <div className="chat-msg user">
        <div className="chat-msg-main user">
          <div className="chat-bubble user">{msg.content}</div>
          <time className="chat-msg-time">{hora(msg.ts)}</time>
        </div>
      </div>
    );
  }
  // resposta do agente em GERAÇÃO (streaming real via Realtime): "pensando" (sem conteúdo) → bolha com cursor.
  if (msg.streaming) {
    const semConteudo = !msg.content.trim();
    return (
      <div className="chat-msg agent">
        <AgentMark size={30} />
        <div className="chat-msg-main" aria-live="polite" aria-busy>
          {semConteudo ? (
            <div className="chat-thinking pensando">
              <TypingDots />
              <span className="chat-thinking-label">
                {msg.status === "thinking" ? "Consultando os dados…" : "Pensando"}
              </span>
            </div>
          ) : (
            <div className="chat-bubble agent">
              {md}
              <span className="chat-cursor" aria-hidden />
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="chat-msg agent">
      <AgentMark size={30} />
      <div className="chat-msg-main">
        {msg.thinking ? (
          <ThinkingBlock durationMs={msg.thinking.durationMs} trace={msg.thinking.trace} />
        ) : null}
        <div className="chat-bubble agent">{md}</div>
        <div className="chat-msg-foot">
          <time className="chat-msg-time">{hora(msg.ts)}</time>
          <div className="chat-msg-acts">
            <IconButton
              aria-label={copiado ? "Copiado" : "Copiar"}
              variant="ghost"
              size="sm"
              onClick={copiar}
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />}
            </IconButton>
            {ehUltima ? (
              <IconButton aria-label="Regenerar" variant="ghost" size="sm" onClick={onRegenerar}>
                <RefreshCw size={14} />
              </IconButton>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingBlock({
  pensando,
  elapsed,
  durationMs,
  trace,
}: {
  pensando?: boolean;
  elapsed?: number;
  durationMs: number;
  trace: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (pensando) {
    return (
      <div className="chat-thinking pensando">
        <TypingDots />
        <span className="chat-thinking-label">
          Pensando
          <span className="chat-thinking-time"> · {Math.round((elapsed ?? 0) / 1000)}s</span>
        </span>
      </div>
    );
  }
  const seg = Math.max(1, Math.round(durationMs / 1000));
  return (
    <div className="chat-thinking">
      <button type="button" className="chat-thinking-toggle" onClick={() => setAberto((a) => !a)}>
        Pensou por {seg}s
        <span className={`chat-thinking-chev ${aberto ? "aberto" : ""}`}>
          <ChevronDown size={14} />
        </span>
      </button>
      {aberto ? <div className="chat-thinking-trace">{trace}</div> : null}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="chat-dots" aria-label="Pensando">
      <i />
      <i />
      <i />
    </span>
  );
}

// ── Estado vazio (boas-vindas + sugestões) ───────────────────────────

function ChatVazio({
  obraNome,
  onSugestao,
}: {
  obraNome: string;
  onSugestao: (t: string) => void;
}) {
  return (
    <div className="chat-vazio">
      <div className="chat-vazio-inner">
        <AgentMark size={60} hero />
        <h2 className="chat-vazio-titulo">Como posso ajudar na {obraNome}?</h2>
        <p className="chat-vazio-sub">
          Pergunte sobre faturamento, prazo, recursos ou desequilíbrio — eu cruzo os números e
          aponto os riscos.
        </p>
        <div className="chat-sugestoes">
          {SUGESTOES.map((s) => {
            const Ic = SUG_ICON[s.icon];
            return (
              <button
                key={s.texto}
                type="button"
                className="chat-sugestao"
                onClick={() => onSugestao(s.texto)}
              >
                <span className="chat-sugestao-ic">{Ic ? <Ic size={17} /> : null}</span>
                <span>{s.texto}</span>
                <ArrowUp size={15} className="chat-sugestao-go" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Composer (auto-grow) ─────────────────────────────────────────────

function Composer({
  valor,
  onValor,
  onEnviar,
  gerando,
  focoKey,
}: {
  valor: string;
  onValor: (v: string) => void;
  onEnviar: (t: string) => void;
  gerando: boolean;
  focoKey: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [valor]);

  // foca o composer ao abrir/trocar de conversa e quando a geração termina (fluidez de digitação)
  useEffect(() => {
    if (!gerando) ref.current?.focus();
  }, [focoKey, gerando]);

  const submit = () => {
    const t = valor.trim();
    if (!t || gerando) return;
    onEnviar(t);
  };

  return (
    <div className="chat-composer">
      <div className="chat-composer-box">
        <textarea
          ref={ref}
          className="chat-composer-input"
          rows={1}
          value={valor}
          aria-label="Escreva sua pergunta sobre os dados desta obra"
          placeholder="Pergunte sobre os dados desta obra…"
          onChange={(e) => onValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {gerando ? (
          // a geração roda no servidor (sem abort) → estado honesto "gerando", não um botão de parar fake
          <IconButton
            aria-label="Gerando resposta…"
            variant="solid"
            className="chat-send gerando"
            disabled
          >
            <Loader2 size={17} className="chat-spin" />
          </IconButton>
        ) : (
          <IconButton
            aria-label="Enviar"
            variant="solid"
            className="chat-send"
            disabled={!valor.trim()}
            onClick={submit}
          >
            <ArrowUp size={18} />
          </IconButton>
        )}
      </div>
      <div className="chat-composer-hint">
        <strong>Enter</strong> envia · <strong>Shift+Enter</strong> quebra linha · a IA pode errar —
        confira números críticos
      </div>
    </div>
  );
}

// ── Markdown rico (títulos · tabelas · listas · citações · negrito/itálico/código · farol) ──────
// Parser por blocos: o agente responde MUITO em tabela markdown (composição do D.0, faturamento…) e a
// versão antiga só fazia parágrafo/lista, então as tabelas saíam como texto quebrado com `|` e `---`.

const FAROL_TOM: Record<string, "success" | "info" | "warning" | "danger"> = {
  conforme: "success",
  observação: "info",
  observacao: "info",
  risco: "warning",
  crítico: "danger",
  critico: "danger",
};

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const ehNumerica = (s: string) => /^[-+]?[\d.,%]+$|R\$|\d/.test(s.trim()) && /\d/.test(s);

function TableBlock({
  header,
  aligns,
  rows,
}: {
  header: string[];
  aligns: string[];
  rows: string[][];
}) {
  return (
    <div className="chat-md-tablewrap">
      <table className="chat-md-table">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                style={{ textAlign: (aligns[i] as "left" | "right" | "center") ?? "left" }}
              >
                <Inline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => {
                const num = ehNumerica(c);
                const align =
                  (aligns[ci] as "left" | "right" | "center") ?? (num ? "right" : "left");
                return (
                  <td key={ci} className={num ? "num" : undefined} style={{ textAlign: align }}>
                    <Inline text={c} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let buf: { ord: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!buf) return;
    const { ord, items } = buf;
    const itens = items.slice();
    out.push(
      ord ? (
        <ol key={`l${out.length}`} className="chat-md-ol">
          {itens.map((l, j) => (
            <li key={j}>
              <Inline text={l} />
            </li>
          ))}
        </ol>
      ) : (
        <ul key={`l${out.length}`} className="chat-md-ul">
          {itens.map((l, j) => (
            <li key={j}>
              <Inline text={l} />
            </li>
          ))}
        </ul>
      ),
    );
    buf = null;
  };

  let i = 0;
  while (i < lines.length) {
    const l = lines[i].trim();

    // bloco de código cercado (```), preservando quebras de linha internas
    if (l.startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // pula o ``` de fechamento
      out.push(
        <pre key={`c${out.length}`} className="chat-md-pre">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // tabela: linha com | + a SEGUINTE é separador (|---|:--:|)
    const sep = lines[i + 1]?.trim() ?? "";
    if (l.startsWith("|") && /-/.test(sep) && /^\|?[\s:|-]+\|?$/.test(sep)) {
      flush();
      const header = splitRow(l);
      const aligns = splitRow(sep).map((c) =>
        c.endsWith(":") ? (c.startsWith(":") ? "center" : "right") : "left",
      );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i].trim()));
        i++;
      }
      out.push(<TableBlock key={`t${out.length}`} header={header} aligns={aligns} rows={rows} />);
      continue;
    }

    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      out.push(
        <div key={`h${out.length}`} className={`chat-md-h chat-md-h${h[1].length}`}>
          <Inline text={h[2]} />
        </div>,
      );
      i++;
      continue;
    }
    if (l.startsWith(">")) {
      flush();
      out.push(
        <blockquote key={`q${out.length}`} className="chat-md-quote">
          <Inline text={l.replace(/^>\s?/, "")} />
        </blockquote>,
      );
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) {
      flush();
      out.push(<hr key={`hr${out.length}`} className="chat-md-hr" />);
      i++;
      continue;
    }
    const ol = l.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (!buf || !buf.ord) {
        flush();
        buf = { ord: true, items: [] };
      }
      buf.items.push(ol[1]);
      i++;
      continue;
    }
    const ul = l.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (!buf || buf.ord) {
        flush();
        buf = { ord: false, items: [] };
      }
      buf.items.push(ul[1]);
      i++;
      continue;
    }
    flush();
    if (l)
      out.push(
        <p key={`p${out.length}`} className="chat-md-p">
          <Inline text={l} />
        </p>,
      );
    i++;
  }
  flush();
  return <>{out}</>;
}

function Inline({ text }: { text: string }) {
  // links [txt](url) + negrito/itálico/código + farol (Conforme/Observação/Risco/Crítico) → badge
  const parts = text.split(
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\b(?:Conforme|Observa[çc][ãa]o|Risco|Cr[íi]tico)\b)/g,
  );
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const url = link[2];
          return /^https?:\/\//i.test(url) ? (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="chat-md-link"
            >
              {link[1]}
            </a>
          ) : (
            <span key={i}>{link[1]}</span>
          );
        }
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code key={i} className="chat-md-code">
              {p.slice(1, -1)}
            </code>
          );
        const tom = FAROL_TOM[p.toLowerCase()];
        if (tom)
          return (
            <span key={i} className={`chat-md-farol tom-${tom}`}>
              {p}
            </span>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
