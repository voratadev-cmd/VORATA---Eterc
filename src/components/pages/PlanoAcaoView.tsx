// Tela "Plano de Ação · C.12" — consolida as condutas da C.11 em tarefas (5W2H) com dado REAL
// (obra_secoes via usePlanoAcao). Renderizada pela aba do RMA (/rma/plano-acao) e pela rota top-level
// (/contracts/$id/plano-acao). KPIs: contagens GRAVADAS no Resumo (snapshot do BM, oráculo); o
// realce de linha (atrasada) e a distância relativa do prazo são derivados do prazo vs hoje. Sem mock.
//
// DS: coleção canônica (useColecao: busca + ordenação + filtro por status + paginação 10/pág) ·
// KPIs com chip lucide (padrão canônico, sem tarja) · barra de distribuição por status · farol via
// farolToBadge + critério visível · ErroCard com retry (erro ≠ pendência) · "por quê" (5W2H) legível
// com expansor EXPLÍCITO (nunca só title/hover — é argumento de pleito).

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  ListTodo,
  Loader2,
  OctagonAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, EmptyState, ErroCard, FilterChip, I, Skeleton } from "@/components/ds";
import type { BadgeTone } from "@/components/ds";
import {
  ColPag,
  ColToolbar,
  ColVazio,
  normTxt,
  type Ordenacao,
  useColecao,
} from "@/lib/rma/colecao";
import { farolToBadge } from "@/lib/mocks/contracts";
import { usePlanoAcao } from "@/lib/hooks/usePlanoAcao";
import type { PlanoResumo, PlanoTarefa } from "@/lib/supabase/planoAcao";
import "./PlanoAcaoView.css";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
}
function fmtPct(v: number | null): string {
  return v != null ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—";
}
function urgTone(u: string | null): BadgeTone {
  const s = (u ?? "").toLowerCase();
  if (s.includes("crít") || s.includes("crit")) return "danger";
  if (s.includes("méd") || s.includes("med")) return "warning";
  if (s.includes("baix")) return "info";
  return "neutral";
}
function statusTone(s: string | null): BadgeTone {
  const t = (s ?? "").toLowerCase();
  if (t.includes("conclu")) return "success";
  if (t.includes("andamento")) return "info";
  return "neutral";
}
// Realce de linha ATRASADA (prazo vencido vs hoje). Concluída nunca atrasa. "Vencendo ≤7d" fica só no
// card KPI (snapshot do Resumo) — não como flag de linha, p/ não contradizer o card (que é gravado).
function prazoAtrasada(prazo: string | null, status: string | null): boolean {
  if (!prazo || /conclu/i.test(status ?? "")) return false;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d < hoje;
}
// Distância relativa do prazo (informação de calendário, NÃO farol — o farol de linha continua sendo
// só a flag "atrasada"). Poupa a conta mental "10/08 é semana que vem ou mês que vem?".
function prazoRelativo(prazo: string | null): string | null {
  if (!prazo) return null;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
  if (dias === 0) return "hoje";
  return dias > 0
    ? `em ${dias} dia${dias === 1 ? "" : "s"}`
    : `há ${-dias} dia${dias === -1 ? "" : "s"}`;
}

// ── Coleção: chaves de status + ordenações ──────────────────────────────────────────────────────
// Agrupa a grafia livre do workbook ("A Fazer" / "Em Andamento" / "Concluída") em chaves estáveis
// p/ filtro. Valores desconhecidos viram grupo próprio (nada é engolido).
function statusKey(s: string | null): string {
  const t = normTxt(s ?? "");
  if (!t) return "sem";
  if (t.includes("conclu")) return "concluida";
  if (t.includes("andamento")) return "andamento";
  if (t.includes("fazer")) return "afazer";
  return t;
}
function urgSev(u: string | null): number {
  const s = normTxt(u ?? "");
  if (s.includes("crit")) return 4;
  if (s.includes("alta")) return 3;
  if (s.includes("med")) return 2;
  if (s.includes("baix")) return 1;
  return 0;
}
const STATUS_SEV: Record<string, number> = { andamento: 0, afazer: 1, concluida: 3 };
const cmpId = (a: PlanoTarefa, b: PlanoTarefa) =>
  a.id.localeCompare(b.id, "pt-BR", { numeric: true });
// Prazo asc (mais próximo 1º), sem prazo por último; empates pelo ID.
const cmpPrazo = (a: PlanoTarefa, b: PlanoTarefa) => {
  if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo) || cmpId(a, b);
  if (a.prazo) return -1;
  if (b.prazo) return 1;
  return cmpId(a, b);
};
const ORDENACOES: Ordenacao<PlanoTarefa>[] = [
  { value: "prazo", label: "Prazo (mais próximo 1º)", cmp: cmpPrazo },
  {
    value: "urgencia",
    label: "Urgência (crítica 1º)",
    cmp: (a, b) => urgSev(b.urgencia) - urgSev(a.urgencia) || cmpPrazo(a, b),
  },
  {
    value: "status",
    label: "Status (abertas 1º)",
    cmp: (a, b) =>
      (STATUS_SEV[statusKey(a.status)] ?? 2) - (STATUS_SEV[statusKey(b.status)] ?? 2) ||
      cmpPrazo(a, b),
  },
  { value: "id", label: "ID (T-01…)", cmp: cmpId },
];

export function PlanoAcaoView({ contractId }: { contractId: string }) {
  const { data, isLoading, isError, error, refetch } = usePlanoAcao(contractId);
  const tarefas = useMemo(() => data?.tarefas ?? [], [data]);
  const [fStatus, setFStatus] = useState("");

  // Chips de status com contagem VIVA das linhas (o snapshot gravado continua nos KPIs).
  const chips = useMemo(() => {
    const rotulos: Record<string, string> = {
      afazer: "A fazer",
      andamento: "Em andamento",
      concluida: "Concluídas",
      sem: "Sem status",
    };
    const ordem = ["afazer", "andamento", "concluida"];
    const m = new Map<string, { label: string; n: number }>();
    for (const t of tarefas) {
      const k = statusKey(t.status);
      const cur = m.get(k);
      if (cur) cur.n += 1;
      else m.set(k, { label: rotulos[k] ?? t.status ?? "Sem status", n: 1 });
    }
    return [...m.entries()]
      .sort((a, b) => {
        const ia = ordem.indexOf(a[0]);
        const ib = ordem.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([key, v]) => ({ key, ...v }));
  }, [tarefas]);

  const col = useColecao(tarefas, {
    busca: (t) =>
      [
        t.id,
        t.titulo,
        t.origem,
        t.responsavel,
        t.frenteTrecho,
        t.status,
        t.urgencia,
        t.vinculacao,
        t.porQue,
        t.esforco,
        t.prazoTexto,
      ]
        .filter(Boolean)
        .join(" "),
    ordenacoes: ORDENACOES,
    filtro: (t) => !fStatus || statusKey(t.status) === fStatus,
    perPage: 10,
    resetKey: fStatus,
  });

  if (isLoading) {
    // Skeleton com a forma real: header → 6 KPIs → faixa de distribuição → toolbar → quadro.
    return (
      <main className="pa-main">
        <Skeleton style={{ height: 56, maxWidth: 560 }} />
        <div className="pa-kpis">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 92 }} />
          ))}
        </div>
        <Skeleton style={{ height: 24, maxWidth: 480 }} />
        <Skeleton style={{ height: 38 }} />
        <Skeleton style={{ height: 360 }} />
      </main>
    );
  }
  // ERRO ≠ PENDÊNCIA: falha de leitura ganha retry; pendência é o EmptyState honesto abaixo.
  if (isError) {
    return (
      <main className="pa-main">
        <ErroCard
          titulo="Não foi possível carregar o Plano de Ação"
          mensagem={
            error instanceof Error ? error.message : "Erro ao ler as seções C.12 (obra_secoes)."
          }
          onRetry={() => void refetch()}
        />
      </main>
    );
  }
  if (!data || (!data.resumo && data.tarefas.length === 0)) {
    return (
      <main className="pa-main">
        <Card>
          <EmptyState
            framed
            icon={I.note({ size: 40 })}
            title="Plano de Ação pendente"
            text="As tarefas aparecem aqui quando as condutas da C.11 forem consolidadas (C.12) para esta obra."
            hint={<Badge tone="info">Aguardando C.12 normalizada</Badge>}
          />
        </Card>
      </main>
    );
  }

  const { resumo, leituraIA } = data;
  const filtrando = Boolean(col.debounced) || Boolean(fStatus);
  // SBSO não tem a coluna Esforço no quadro — quando 100% vazia, a coluna some (sem "—" em série).
  const temEsforco = tarefas.some((t) => t.esforco);

  return (
    <main className="pa-main">
      <header className="pa-head">
        <div>
          <h2 className="pa-titulo">Plano de Ação · C.12</h2>
          <p className="pa-sub">
            Consolida as condutas da C.11 em tarefas (5W2H) com responsável, prazo, urgência e
            status
            {resumo ? (
              <>
                {" "}
                · Total <b>{resumo.total}</b> · concluídas{" "}
                <b className="tabular">{fmtPct(resumo.pctConcluidas)}</b>
                {resumo.slaMedioDias != null ? (
                  <>
                    {" "}
                    · SLA médio <b className="tabular">{resumo.slaMedioDias} dias</b>
                  </>
                ) : null}
                {resumo.vinculadasAC11 != null ? (
                  <>
                    {" "}
                    · vinculadas à C.11 <b className="tabular">{resumo.vinculadasAC11}</b>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </div>
        {resumo ? (
          <div className="pa-farol">
            <Badge tone={farolToBadge[resumo.farolNivel]} title={resumo.farolCriterio ?? undefined}>
              {resumo.farolLabel}
            </Badge>
            {resumo.farolCriterio ? (
              <span className="pa-farol-crit">Critério: {resumo.farolCriterio}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      {resumo ? <KpiBar resumo={resumo} fStatus={fStatus} onFiltro={setFStatus} /> : null}
      {resumo ? <DistStatus resumo={resumo} /> : null}

      <section className="pa-section">
        <header className="pa-section-head">
          <div>
            <h3 className="pa-section-title">Quadro de tarefas</h3>
            <div className="pa-section-sub tabular">
              {filtrando
                ? `${col.total} de ${col.nItens} ações`
                : `${col.nItens} ${col.nItens === 1 ? "ação" : "ações"}`}{" "}
              · O QUE / POR QUÊ / QUEM / QUANDO / ONDE{temEsforco ? " / ESFORÇO" : ""} / STATUS
            </div>
          </div>
        </header>

        {tarefas.length === 0 ? (
          <EmptyState title="Sem tarefas no período" text="Aguardando condutas da C.11." />
        ) : (
          <>
            {tarefas.length >= 5 ? (
              <ColToolbar
                col={col}
                placeholder="Buscar por tarefa, responsável ou origem…"
                extra={
                  <div className="pa-chips" role="group" aria-label="Filtrar por status">
                    <FilterChip
                      label="Todas"
                      value={col.nItens}
                      active={!fStatus}
                      onClick={() => setFStatus("")}
                    />
                    {chips.map((c) => (
                      <FilterChip
                        key={c.key}
                        label={c.label}
                        value={c.n}
                        active={fStatus === c.key}
                        onClick={() => setFStatus(fStatus === c.key ? "" : c.key)}
                      />
                    ))}
                  </div>
                }
              />
            ) : null}

            {col.visible.length === 0 ? (
              col.debounced ? (
                <ColVazio
                  termo={col.debounced}
                  rotulo="ação"
                  artigo="Nenhuma"
                  onClear={() => col.setQuery("")}
                />
              ) : (
                <div className="col-vazia">
                  Nenhuma ação com este status.{" "}
                  <button type="button" className="col-vazia-clear" onClick={() => setFStatus("")}>
                    Limpar filtro
                  </button>
                </div>
              )
            ) : (
              <div className={`pa-tabela${temEsforco ? "" : " pa-tabela-sem-esf"}`} role="table">
                <div className="pa-tabela-head" role="row">
                  <span role="columnheader">ID</span>
                  <span role="columnheader">Tarefa</span>
                  <span role="columnheader">Responsável</span>
                  <span role="columnheader">Prazo</span>
                  <span role="columnheader">Urgência</span>
                  <span role="columnheader">Status</span>
                  {temEsforco ? <span role="columnheader">Esforço</span> : null}
                </div>
                {col.visible.map((t) => (
                  <TarefaRow key={t.id || t.titulo} t={t} temEsforco={temEsforco} />
                ))}
              </div>
            )}
            <ColPag col={col} rotulo="ações" />
          </>
        )}
      </section>

      <p className="pa-gatilho">
        <Flame size={13} strokeWidth={2} aria-hidden /> <strong>Gatilhos automáticos:</strong> a
        plataforma cria e atualiza tarefas sozinha — pendência sem resposta vira tarefa, prazo
        perdido sobe a urgência, e cada conduta nova da C.11 entra aqui já vinculada.
      </p>

      {leituraIA ? (
        <section className="pa-ia">
          <div className="pa-ia-tag">
            <Sparkles size={12} strokeWidth={2} aria-hidden /> LEITURA DO PLANO · ADM CONTRATUAL IA
          </div>
          <p className="pa-ia-texto">{leituraIA}</p>
        </section>
      ) : null}
    </main>
  );
}

// ── 6 KPIs (contagens gravadas no Resumo · snapshot do BM · padrão canônico chip lucide) ─────────
// Os 3 cards de status são atalhos clicáveis do filtro do quadro (o status é campo POPULADO por
// linha — o filtro bate 1:1 com o dado). Atrasadas/Vencendo/Críticas ficam só como snapshot: a
// contagem é gravada no Resumo e um filtro derivado de "hoje" poderia contradizê-la.
function KpiBar({
  resumo,
  fStatus,
  onFiltro,
}: {
  resumo: PlanoResumo;
  fStatus: string;
  onFiltro: (k: string) => void;
}) {
  const sub = (n: number) =>
    resumo.total > 0 ? `${n} de ${resumo.total} · ${Math.round((n / resumo.total) * 100)}%` : "—";
  const cards: Array<{
    label: string;
    valor: number;
    tone?: "danger" | "warning" | "info" | "success";
    icone: ReactNode;
    filtroKey?: string;
  }> = [
    {
      label: "Tarefas atrasadas",
      valor: resumo.atrasadas,
      tone: "danger",
      icone: <TriangleAlert size={14} strokeWidth={2} />,
    },
    {
      label: "Vencendo < 7 dias",
      valor: resumo.vencendo,
      tone: "warning",
      icone: <Clock size={14} strokeWidth={2} />,
    },
    {
      label: "Críticas atrasadas",
      valor: resumo.criticasAtrasadas,
      tone: "danger",
      icone: <OctagonAlert size={14} strokeWidth={2} />,
    },
    {
      label: "Em andamento",
      valor: resumo.emAndamento,
      tone: "info",
      icone: <Loader2 size={14} strokeWidth={2} />,
      filtroKey: "andamento",
    },
    {
      label: "A fazer",
      valor: resumo.aFazer,
      icone: <ListTodo size={14} strokeWidth={2} />,
      filtroKey: "afazer",
    },
    {
      label: "Concluídas",
      valor: resumo.concluidas,
      tone: "success",
      icone: <CheckCircle2 size={14} strokeWidth={2} />,
      filtroKey: "concluida",
    },
  ];
  const corValor = (c: (typeof cards)[number]) =>
    c.valor > 0 && c.tone === "danger"
      ? "var(--danger)"
      : c.valor > 0 && c.tone === "warning"
        ? "color-mix(in srgb, var(--warning) 82%, var(--text))"
        : c.valor > 0 && c.tone === "success"
          ? "var(--success)"
          : "var(--text)";
  return (
    <div className="pa-kpis">
      {cards.map((c) => {
        const ativo = Boolean(c.filtroKey) && fStatus === c.filtroKey;
        const inner = (
          <>
            <div className="pa-kpi-top">
              <span className={`pa-kpi-chip${c.tone ? ` t-${c.tone}` : ""}`} aria-hidden>
                {c.icone}
              </span>
              <span className="pa-kpi-l">{c.label}</span>
            </div>
            <div className="pa-kpi-v tabular" style={{ color: corValor(c) }}>
              {c.valor}
            </div>
            <div className="pa-kpi-s tabular">{sub(c.valor)}</div>
          </>
        );
        return c.filtroKey ? (
          <button
            key={c.label}
            type="button"
            className={`pa-kpi pa-kpi-btn${ativo ? " ativo" : ""}`}
            aria-pressed={ativo}
            title={ativo ? "Limpar o filtro do quadro" : "Filtrar o quadro por este status"}
            onClick={() => onFiltro(ativo ? "" : (c.filtroKey ?? ""))}
          >
            {inner}
          </button>
        ) : (
          <div key={c.label} className="pa-kpi">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// ── Distribuição por status (barra empilhada CSS · snapshot do Resumo) ──────────────────────────
function DistStatus({ resumo }: { resumo: PlanoResumo }) {
  const soma = resumo.aFazer + resumo.emAndamento + resumo.concluidas;
  if (soma <= 0) return null;
  const segs = [
    { n: resumo.aFazer, cor: "var(--text-3)", rotulo: `A fazer ${resumo.aFazer}` },
    { n: resumo.emAndamento, cor: "var(--info)", rotulo: `Em andamento ${resumo.emAndamento}` },
    { n: resumo.concluidas, cor: "var(--success)", rotulo: `Concluídas ${resumo.concluidas}` },
  ];
  return (
    <div className="pa-dist">
      <div
        className="pa-dist-bar"
        role="img"
        aria-label={`Distribuição por status: ${segs.map((s) => s.rotulo).join(" · ")}`}
      >
        {segs
          .filter((s) => s.n > 0)
          .map((s) => (
            <span
              key={s.rotulo}
              className="pa-dist-seg"
              title={s.rotulo}
              style={{ width: `${(s.n / soma) * 100}%`, background: s.cor }}
            />
          ))}
      </div>
      <div className="pa-dist-leg tabular">
        {segs.map((s) => (
          <span key={s.rotulo} className="pa-dist-leg-it">
            <span className="pa-dist-dot" style={{ background: s.cor }} aria-hidden />
            {s.rotulo}
          </span>
        ))}
        {resumo.pctConcluidas != null ? (
          <span className="pa-dist-pct">{fmtPct(resumo.pctConcluidas)} concluídas</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Linha do quadro (5W2H) ──────────────────────────────────────────────────────────────────────
// "Por quê" é argumento de pleito: fica legível em linha própria; textos longos ganham clamp de
// 2 linhas + expansor EXPLÍCITO (nunca só title/hover). Origem/vinculação viram pílulas.
const PQ_LONGO = 140;

function TarefaRow({ t, temEsforco }: { t: PlanoTarefa; temEsforco: boolean }) {
  const [pqAberto, setPqAberto] = useState(false);
  const atrasada = prazoAtrasada(t.prazo, t.status);
  const rel = prazoRelativo(t.prazo);
  const pqLongo = (t.porQue ?? "").length > PQ_LONGO;
  return (
    <div className={`pa-tabela-row${atrasada ? " pa-row-late" : ""}`} role="row">
      <span role="cell" className="pa-cell-id">
        {t.id || "—"}
      </span>
      <span role="cell" className="pa-cell-tarefa">
        <span className="pa-tarefa-ttl">{t.titulo}</span>
        {t.origem || t.vinculacao ? (
          <span className="pa-tarefa-tags">
            {t.origem ? <span className="pa-pill">origem: {t.origem}</span> : null}
            {t.vinculacao ? <span className="pa-pill">vínc: {t.vinculacao}</span> : null}
          </span>
        ) : null}
        {t.porQue ? (
          <span className="pa-pq-wrap">
            <span className={`pa-pq${pqLongo && !pqAberto ? " pa-pq-clamp" : ""}`}>
              <strong>por quê:</strong> {t.porQue}
            </span>
            {pqLongo ? (
              <button
                type="button"
                className="pa-pq-toggle"
                aria-expanded={pqAberto}
                onClick={() => setPqAberto((v) => !v)}
              >
                {pqAberto ? (
                  <>
                    Ver menos <ChevronUp size={12} strokeWidth={2} aria-hidden />
                  </>
                ) : (
                  <>
                    Justificativa completa <ChevronDown size={12} strokeWidth={2} aria-hidden />
                  </>
                )}
              </button>
            ) : null}
          </span>
        ) : null}
      </span>
      <span role="cell" className="pa-cell-resp" data-l="Responsável">
        <span className="pa-resp-nome">{t.responsavel ?? "—"}</span>
        {t.frenteTrecho ? <span className="pa-frt">{t.frenteTrecho}</span> : null}
      </span>
      <span role="cell" className="pa-cell-prazo tabular" data-l="Prazo">
        {/* prazo não-data ("a definir") mostra o TEXTO da fonte — "—" mentiria ausência */}
        <span className={t.prazo ? undefined : "pa-prazo-txt"}>
          {t.prazo ? fmtDate(t.prazo) : (t.prazoTexto ?? "—")}
        </span>
        {rel ? <span className="pa-prazo-rel">{rel}</span> : null}
        {atrasada ? <span className="pa-flag pa-flag-late">atrasada</span> : null}
      </span>
      <span role="cell" className="pa-cell-urg" data-l="Urgência">
        {t.urgencia ? <Badge tone={urgTone(t.urgencia)}>{t.urgencia}</Badge> : "—"}
      </span>
      <span role="cell" className="pa-cell-status" data-l="Status">
        {t.status ? <Badge tone={statusTone(t.status)}>{t.status}</Badge> : "—"}
      </span>
      {temEsforco ? (
        <span role="cell" className="pa-cell-esf tabular" data-l="Esforço">
          {t.esforco ?? "—"}
        </span>
      ) : null}
    </div>
  );
}
