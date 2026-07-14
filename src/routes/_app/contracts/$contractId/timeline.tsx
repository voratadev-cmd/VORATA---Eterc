// C.13 — Timeline do Contrato (Gantt contratado × real). Tudo do dado REAL normalizado pelo
// workbook-motor (obra_cronograma_tarefas + obra_eventos_prazo + obra_timeline_params):
//   1. Visão geral (masterrow OS real → término contratual + marcos de término por trecho)
//   2. Gantt expansível: 12 grupos/trechos → disciplinas (folhas), contratado × real
//   3. Zoom por trecho (eixo re-escalado ao período do grupo)
//   4. Registro de eventos que impactam o prazo (cadastro real)
//   5. Windows Analysis (janela do mês de corte) — projeção honesta; propagação rigorosa = C.5 Prazo
//
// HONESTIDADE: o eixo REAL vem do banco. Tarefa NÃO iniciada → placeholder tracejado ("real a
// iniciar"). Tarefa EM ANDAMENTO (início real sem término real) → barra pintada do início real até
// o CORTE DO BM (não até "hoje" — o real vem do Boletim de Medição; decisão do dono, jul/2026), com
// ponta esmaecida sinalizando continuação. Farol via Badge (vocab canônico Conforme/Observação/
// Risco/Crítico) — NUNCA "Atenção" nem border-left colorido (vetado no CLAUDE.md). Tokens-only.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Badge, Card, DataTable, EmptyState, I, Skeleton } from "@/components/ds";
import { useTimeline } from "@/lib/hooks/useTimeline";
import type {
  TimelineEvento,
  TimelineParams,
  TimelineProjecao,
  TimelineTarefa,
} from "@/lib/supabase/timeline";
import "./timeline.css";

export const Route = createFileRoute("/_app/contracts/$contractId/timeline")({
  component: TimelineRoute,
  head: () => ({ meta: [{ title: "Timeline do Contrato — RDM IA" }] }),
});

// ── Helpers de data (ISO 'YYYY-MM-DD' · sem libs) ────────────────────────────
const MS_DAY = 86_400_000;
const ms = (s: string) => Date.parse(`${s}T00:00:00`);
const fmtBR = (s: string | null | undefined) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "—"; // não-ISO / parcial → não renderiza 'undefined/…'
  return `${d}/${m}/${y.slice(2)}`;
};
const diffDias = (a: string, b: string) => Math.round((ms(b) - ms(a)) / MS_DAY);
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const hojeISO = () => new Date().toISOString().slice(0, 10);

function TimelineRoute() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError } = useTimeline(contractId);

  if (isLoading) {
    return (
      <div className="tl-page">
        <Skeleton style={{ height: 28, width: 320, marginBottom: 12 }} />
        <Skeleton style={{ height: 64, marginBottom: 16 }} />
        <Skeleton style={{ height: 420 }} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="tl-page">
        <EmptyState
          icon={I.calendar({ size: 40 })}
          title="Timeline ainda não disponível"
          text="O cronograma do contrato (C.13) ainda não foi normalizado para esta obra. Assim que o workbook for processado, o Gantt contratado × real aparece aqui."
          framed
        />
      </div>
    );
  }
  return <TimelineView view={data} />;
}

type View = NonNullable<ReturnType<typeof useTimeline>["data"]>;

function TimelineView({ view }: { view: View }) {
  const { tarefas, eventos, params, projecao } = view;

  const model = useMemo(() => {
    // eixo: OS real → término contratual (fallback: min/max das tarefas)
    const inicios = tarefas.map((t) => t.dataInicio).filter(Boolean) as string[];
    const fins = tarefas.map((t) => t.dataTermino).filter(Boolean) as string[];
    const t0s = params?.osReal ?? inicios.sort()[0] ?? null;
    const t1s = params?.terminoContratual ?? fins.sort().slice(-1)[0] ?? null;
    const t0 = t0s ? ms(t0s) : 0;
    const t1 = t1s ? ms(t1s) : 1;
    const span = Math.max(1, t1 - t0);
    // PAD = margem do eixo (%) nas duas pontas → datas/dots/marcos não colam na borda do container
    const PAD = 2;
    const pct = (s: string | null | undefined) =>
      s ? clamp(PAD + ((ms(s) - t0) / span) * (100 - 2 * PAD)) : PAD;
    const eixoValido = !!t0s && !!t1s; // sem OS real nem datas → não dá pra montar o eixo

    // árvore: cada folha (nivel 1) pertence ao grupo (nivel 0) anterior
    let lastGroup = -1;
    const rows = tarefas.map((t, i) => {
      if (t.nivel === 0) lastGroup = i;
      return { t, idx: i, parent: t.nivel === 0 ? -1 : lastGroup };
    });
    const grupos = rows.filter((r) => r.t.nivel === 0);

    // gridlines de ano dentro do eixo
    const yStart = t0s ? Number(t0s.slice(0, 4)) : 0;
    const yEnd = t1s ? Number(t1s.slice(0, 4)) : 0;
    const anos: { label: number; left: number }[] = [];
    for (let y = yStart + 1; y <= yEnd; y++) anos.push({ label: y, left: pct(`${y}-01-01`) });

    const hoje = pct(hojeISO());
    const hojeVisivel = hoje > 0 && hoje < 100;
    const reprog =
      params?.osOriginal && params?.osReal ? diffDias(params.osOriginal, params.osReal) : null;

    // eventos datados que impactam o prazo → ◆ na masterrow (contexto temporal do impacto)
    const impactos = eventos
      .filter((e) => e.impacta && e.dataInicio)
      .map((e) => ({ left: pct(e.dataInicio), titulo: e.titulo, data: e.dataInicio as string }));

    // data de corte do BM — fim das barras "em andamento" (real conhecido até aqui)
    const corte = corteBmISO(params, tarefas);

    return {
      rows,
      grupos,
      pct,
      anos,
      hoje,
      hojeVisivel,
      reprog,
      t0s,
      t1s,
      eixoValido,
      impactos,
      corte,
    };
  }, [tarefas, eventos, params]);

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [zoom, setZoom] = useState<number>(() => model.grupos[0]?.idx ?? 0);

  const toggle = (idx: number) => setExpanded((e) => ({ ...e, [idx]: !e[idx] }));
  const expandAll = () => setExpanded(Object.fromEntries(model.grupos.map((g) => [g.idx, true])));
  const collapseAll = () => setExpanded({});

  const farol = farolDoContrato(model.reprog, params);

  if (!model.eixoValido) {
    return (
      <div className="tl-page">
        <EmptyState
          icon={I.calendar({ size: 40 })}
          title="Cronograma sem datas de referência"
          text="As tarefas do contrato foram normalizadas, mas falta a OS real / término contratual para montar o eixo do Gantt."
          framed
        />
      </div>
    );
  }

  return (
    <div className="tl-page">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <header className="tl-head">
        <div>
          <h1 className="tl-title">Timeline do Contrato</h1>
          <p className="tl-sub">
            Gantt contratado × real · cronograma reprogramado p/ OS real ({fmtBR(model.t0s)}) ·
            trechos expansíveis até disciplina
          </p>
        </div>
        <Badge tone={farol.tone}>{farol.label}</Badge>
      </header>

      <div className="tl-kpis">
        <Kpi label="Trechos / grupos" value={String(model.grupos.length)} />
        <Kpi label="Término contratual" value={fmtBR(model.t1s)} />
        <Kpi
          label="Reprogramado (OS real)"
          value={model.reprog != null ? `+${model.reprog}d` : "—"}
        />
        <Kpi label="OS real" value={fmtBR(model.t0s)} />
        <div className="tl-legend">
          <LegItem cls="tl-sw-ctr-g" text="Contratado" />
          <LegItem cls="tl-sw-real" text="Real" />
          <LegItem cls="tl-sw-and" text="Em andamento (até o corte do BM)" />
          <LegItem cls="tl-sw-slip" text="Atraso" />
          <LegItem cls="tl-sw-place" text="Real a iniciar" dashed />
          <span className="tl-li">
            <span className="tl-dia" /> Marco
          </span>
          <span className="tl-li tl-imp-leg">◆ Impacto</span>
        </div>
      </div>

      {/* ── Gantt ───────────────────────────────────────────────────── */}
      <div className="tl-toolbar">
        <button type="button" className="tl-btn" onClick={expandAll}>
          <span className="tl-btn-gl">⊞</span> Expandir tudo
        </button>
        <button type="button" className="tl-btn" onClick={collapseAll}>
          <span className="tl-btn-gl">⊟</span> Recolher tudo
        </button>
      </div>

      <div className="tl-gantt">
        {/* masterrow — visão geral */}
        <div className="tl-master">
          <div className="tl-mlabel">
            <span className="tl-mlabel-t">{I.pin({ size: 14 })} Contrato — visão geral</span>
            <span className="tl-mlabel-s">
              OS real → término contratual · marcos de término por trecho
            </span>
          </div>
          <div className="tl-track tl-mtrack">
            <Gridlines anos={model.anos} hoje={model.hoje} hojeVisivel={model.hojeVisivel} master />
            <div
              className="tl-mbar"
              style={{
                left: `${model.pct(model.t0s)}%`,
                right: `${100 - model.pct(model.t1s)}%`,
              }}
            />
            {model.grupos.map((g) => (
              <span
                key={g.idx}
                className="tl-mesp"
                style={{ left: `${model.pct(g.t.dataTermino)}%` }}
                title={`${g.t.nome} — término ${fmtBR(g.t.dataTermino)}`}
              />
            ))}
            {model.impactos.map((im, i) => (
              <span
                key={`imp-${i}`}
                className="tl-imp"
                style={{ left: `${im.left}%` }}
                title={`Impacto: ${im.titulo} (${fmtBR(im.data)})`}
              >
                ◆
              </span>
            ))}
            <Pin
              leftPct={model.pct(model.t0s)}
              align="start"
              label={fmtBR(model.t0s)}
              sub="OS real"
            />
            <Pin
              leftPct={model.pct(model.t1s)}
              align="end"
              label={fmtBR(model.t1s)}
              sub="Térm. contr."
            />
          </div>
        </div>

        {/* linhas */}
        {model.rows.map((r) => {
          const isGroup = r.t.nivel === 0;
          const visible = isGroup || expanded[r.parent];
          if (!visible) return null;
          return (
            <div key={r.idx} className="tl-row">
              <div
                className={`tl-label${isGroup ? " tl-label-g" : ""}`}
                style={{ paddingLeft: isGroup ? 8 : 24, cursor: isGroup ? "pointer" : "default" }}
                onClick={isGroup ? () => toggle(r.idx) : undefined}
              >
                {isGroup ? (
                  <span className="tl-chev">{expanded[r.idx] ? "▾" : "▸"}</span>
                ) : (
                  <span className="tl-chev tl-chev-none" />
                )}
                <span className="tl-nm">{r.t.nome}</span>
                {isGroup && !r.t.dataInicioReal && (
                  <span className="tl-rtag">real: aguardando</span>
                )}
              </div>
              <div className="tl-track">
                <Gridlines anos={model.anos} hoje={model.hoje} hojeVisivel={model.hojeVisivel} />
                <Bars t={r.t} pct={model.pct} isGroup={isGroup} corte={model.corte} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Zoom por trecho ─────────────────────────────────────────── */}
      <h2 className="tl-sec">Detalhe do trecho (zoom)</h2>
      <div className="tl-zchips">
        {model.grupos.map((g) => (
          <button
            key={g.idx}
            type="button"
            className={`tl-zchip${zoom === g.idx ? " on" : ""}`}
            onClick={() => setZoom(g.idx)}
          >
            {nomeCurto(g.t.nome)}
          </button>
        ))}
      </div>
      <ZoomView grupoIdx={zoom} rows={model.rows} corte={model.corte} />

      {/* ── Eventos ─────────────────────────────────────────────────── */}
      <h2 className="tl-sec">Registro de eventos que impactam o prazo</h2>
      <Card className="tl-card">
        <EventosTabela eventos={eventos} />
      </Card>

      {/* ── Windows Analysis ────────────────────────────────────────── */}
      {params && <WindowsPanel params={params} nEventos={eventos.length} />}

      {/* ── Projeção do término (impactos documentados) ─────────────── */}
      {projecao.length > 0 && (
        <>
          <h2 className="tl-sec">
            Projeção do término{" "}
            <span className="tl-sec-hint">· considerando os impactos documentados</span>
          </h2>
          <Card className="tl-card">
            <ProjecaoTabela linhas={projecao} />
          </Card>
        </>
      )}
    </div>
  );
}

function ProjecaoTabela({ linhas }: { linhas: TimelineProjecao[] }) {
  return (
    <DataTable<TimelineProjecao>
      columns={[
        {
          key: "trecho",
          label: "Trecho / marco",
          width: "180px",
          render: (p) => <strong className="tl-proj-trecho">{p.trecho}</strong>,
        },
        {
          key: "ctr",
          label: "Término contratual",
          width: "130px",
          render: (p) => <span className="tabular">{p.terminoContratual}</span>,
        },
        {
          key: "proj",
          label: "Término projetado (impactado)",
          width: "170px",
          render: (p) => <span className="tabular">{p.terminoProjetado}</span>,
        },
        {
          key: "delta",
          label: "Δ prazo",
          width: "108px",
          align: "right",
          render: (p) => (
            <strong
              className="tabular"
              style={{ color: /^\+/.test(p.deltaPrazo) ? "var(--danger)" : "var(--success)" }}
            >
              {p.deltaPrazo}
            </strong>
          ),
        },
        {
          key: "drivers",
          label: "Principais drivers",
          width: "1.6fr",
          render: (p) => <span className="tl-proj-drivers">{p.drivers}</span>,
        },
      ]}
      rows={linhas}
      getRowId={(p) => p.trecho}
    />
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <span className="tl-kpi">
      {label} <b>{value}</b>
    </span>
  );
}

function LegItem({ cls, text, dashed }: { cls: string; text: string; dashed?: boolean }) {
  return (
    <span className="tl-li">
      <span className={`${dashed ? "tl-swd" : "tl-sw"} ${cls}`} /> {text}
    </span>
  );
}

function Gridlines({
  anos,
  hoje,
  hojeVisivel,
  master,
}: {
  anos: { label: number; left: number }[];
  hoje: number;
  hojeVisivel: boolean;
  master?: boolean;
}) {
  return (
    <>
      {anos.map((a) => (
        <span key={a.label} className="tl-yl" style={{ left: `${a.left}%` }}>
          {master && <span className="tl-ylab">{a.label}</span>}
        </span>
      ))}
      {hojeVisivel && (
        <span className={`tl-hj${master ? " tl-hj-m" : ""}`} style={{ left: `${hoje}%` }}>
          {master && <span className="tl-hjlab">hoje</span>}
        </span>
      )}
    </>
  );
}

function Bars({
  t,
  pct,
  isGroup,
  corte,
}: {
  t: TimelineTarefa;
  pct: (s: string | null | undefined) => number;
  isGroup: boolean;
  corte: string | null;
}) {
  if (!t.dataInicio || !t.dataTermino) return null;
  const left = pct(t.dataInicio);
  const width = Math.max(0.4, pct(t.dataTermino) - left);
  // ⚠️ o real PODE começar antes do contratado (Trecho 01: real 10/03/26 × contratado 07/05/26 —
  // cronograma reprogramado). Barra verde à esquerda da azul NÃO é bug. `desvioDias` é valor baked
  // do workbook (≠ início real − contratado) — exibir como está, sem reinterpretar.
  const temRealCompleto = !!t.dataInicioReal && !!t.dataTerminoReal;
  const emAndamento = !!t.dataInicioReal && !t.dataTerminoReal && !!corte;
  const temImpacto = !!t.dataInicioImpacto && !!t.dataTerminoImpacto;
  return (
    <>
      {/* contratado */}
      <div
        className={`tl-cbar${isGroup ? " tl-cbar-g" : ""}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        {t.pctConcluido ? (
          <span className="tl-cfill" style={{ width: `${clamp(t.pctConcluido * 100)}%` }} />
        ) : null}
        {t.desvioDias ? <span className="tl-cdev">+{t.desvioDias}d</span> : null}
      </div>
      {/* real: concluído · em andamento (até o corte do BM) · ou placeholder */}
      {temRealCompleto ? (
        <>
          <div
            className="tl-rbar"
            style={{
              left: `${pct(t.dataInicioReal)}%`,
              width: `${Math.max(0.4, pct(t.dataTerminoReal) - pct(t.dataInicioReal))}%`,
            }}
            title={`Real: ${fmtBR(t.dataInicioReal)} → ${fmtBR(t.dataTerminoReal)}`}
          />
          {t.dataTerminoReal! > t.dataTermino && (
            <div
              className="tl-rslip"
              style={{
                left: `${pct(t.dataTermino)}%`,
                width: `${Math.max(0.4, pct(t.dataTerminoReal) - pct(t.dataTermino))}%`,
              }}
              title={`Atraso: término real ${fmtBR(t.dataTerminoReal)} × contratado ${fmtBR(t.dataTermino)}`}
            />
          )}
        </>
      ) : emAndamento ? (
        <div
          className="tl-rbar tl-rbar-and"
          style={{
            left: `${pct(t.dataInicioReal)}%`,
            width: `${Math.max(0.4, pct(corte) - pct(t.dataInicioReal))}%`,
          }}
          title={tituloAndamento(t, corte)}
        />
      ) : (
        <div className="tl-rplace" style={{ left: `${left}%`, width: `${width}%` }} />
      )}
      {/* impacto (◆ · SBSO): janela de impacto declarada pela tabela da aba C.5 */}
      {temImpacto ? (
        <div
          className="tl-ibar"
          style={{
            left: `${pct(t.dataInicioImpacto)}%`,
            width: `${Math.max(0.4, pct(t.dataTerminoImpacto) - pct(t.dataInicioImpacto))}%`,
          }}
          title={`Impacto: ${fmtBR(t.dataInicioImpacto)} → ${fmtBR(t.dataTerminoImpacto)}${
            t.impactoDias != null ? ` (+${t.impactoDias}d)` : ""
          }${t.natureza ? ` · ${t.natureza}` : ""}`}
        />
      ) : null}
      {/* marco de término */}
      <span
        className="tl-mk"
        style={{ left: `${pct(t.dataTermino)}%` }}
        title={`Término: ${fmtBR(t.dataTermino)}`}
      />
    </>
  );
}

function Pin({
  leftPct,
  align,
  label,
  sub,
}: {
  leftPct: number;
  align: "start" | "end";
  label: string;
  sub: string;
}) {
  return (
    <div className={`tl-pin tl-pin-${align}`} style={{ left: `${leftPct}%` }}>
      <span className="tl-pd" />
      <span className={`tl-pl tl-pl-${align}`}>
        <b>{label}</b>
        <br />
        {sub}
      </span>
    </div>
  );
}

function ZoomView({
  grupoIdx,
  rows,
  corte,
}: {
  grupoIdx: number;
  rows: { t: TimelineTarefa; idx: number; parent: number }[];
  corte: string | null;
}) {
  const grupo = rows.find((r) => r.idx === grupoIdx)?.t;
  const folhas = rows.filter((r) => r.parent === grupoIdx);
  // sem grupo selecionado ou grupo sem datas contratadas → não dá pra re-escalar o eixo do zoom
  if (!grupo || !grupo.dataInicio || !grupo.dataTermino) {
    return (
      <Card className="tl-card tl-zoom-empty">
        <EmptyState
          title="Sem trecho para detalhar"
          text="Selecione um trecho com datas contratadas para ver o zoom da disciplina."
        />
      </Card>
    );
  }
  const itens: { t: TimelineTarefa; idx: number }[] = folhas.length
    ? folhas.map((r) => ({ t: r.t, idx: r.idx }))
    : [{ t: grupo, idx: grupoIdx }];
  // eixo re-escalado ao período do grupo, EXPANDIDO pelas datas reais — o real pode começar antes
  // do início contratado (Trecho 01: real 10/03 × contratado 07/05); clampar no eixo contratado
  // mentiria o início. Fim inclui término real e o corte do BM (barras em andamento).
  const todos = [grupo, ...itens.map((x) => x.t)];
  const inicios = todos
    .flatMap((t) => [t.dataInicio, t.dataInicioReal])
    .filter(Boolean) as string[];
  const fins = todos
    .flatMap((t) => [
      t.dataTermino,
      t.dataTerminoReal,
      t.dataInicioReal && !t.dataTerminoReal ? corte : null,
    ])
    .filter(Boolean) as string[];
  const i0 = ms(inicios.sort()[0]);
  const i1 = ms(fins.sort().slice(-1)[0]);
  const sp = Math.max(1, i1 - i0);
  const zp = (s: string | null | undefined) => (s ? clamp(((ms(s) - i0) / sp) * 100) : 0);
  return (
    <Card className="tl-card tl-zoom">
      <div className="tl-zhdr">
        {grupo.nome} &middot; {fmtBR(grupo.dataInicio)} → {fmtBR(grupo.dataTermino)}
      </div>
      {itens.map(({ t: f, idx }) => {
        if (!f.dataInicio || !f.dataTermino) return null;
        const l = zp(f.dataInicio);
        const w = Math.max(1, zp(f.dataTermino) - l);
        const temRealCompleto = !!f.dataInicioReal && !!f.dataTerminoReal;
        const emAndamento = !!f.dataInicioReal && !f.dataTerminoReal && !!corte;
        return (
          <div key={idx} className="tl-zrow">
            <div className="tl-zlabel" title={f.nome}>
              {f.nome}
            </div>
            <div className="tl-ztrack">
              <div className="tl-zbar" style={{ left: `${l}%`, width: `${w}%` }} />
              {temRealCompleto ? (
                <>
                  <div
                    className="tl-zrbar"
                    style={{
                      left: `${zp(f.dataInicioReal)}%`,
                      width: `${Math.max(1, zp(f.dataTerminoReal) - zp(f.dataInicioReal))}%`,
                    }}
                    title={`Real: ${fmtBR(f.dataInicioReal)} → ${fmtBR(f.dataTerminoReal)}`}
                  />
                  {f.dataTerminoReal! > f.dataTermino && (
                    <div
                      className="tl-zrslip"
                      style={{
                        left: `${zp(f.dataTermino)}%`,
                        width: `${Math.max(1, zp(f.dataTerminoReal) - zp(f.dataTermino))}%`,
                      }}
                      title={`Atraso: término real ${fmtBR(f.dataTerminoReal)} × contratado ${fmtBR(f.dataTermino)}`}
                    />
                  )}
                </>
              ) : emAndamento ? (
                <div
                  className="tl-zrbar tl-zrbar-and"
                  style={{
                    left: `${zp(f.dataInicioReal)}%`,
                    width: `${Math.max(1, zp(corte) - zp(f.dataInicioReal))}%`,
                  }}
                  title={tituloAndamento(f, corte)}
                />
              ) : (
                <div className="tl-zplace" style={{ left: `${l}%`, width: `${w}%` }} />
              )}
              <span className="tl-zmk" style={{ left: `${zp(f.dataTermino)}%` }} />
              <span className="tl-zdate">{fmtBR(f.dataTermino)}</span>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function EventosTabela({ eventos }: { eventos: TimelineEvento[] }) {
  if (!eventos.length) {
    return (
      <EmptyState
        icon={I.flag({ size: 40 })}
        title="Sem eventos cadastrados"
        text="Nenhum evento que impacta o prazo foi registrado no cronograma desta obra."
      />
    );
  }
  const fmtJanela = (e: TimelineEvento) =>
    e.janelaInicio ? `${fmtBR(e.janelaInicio)} → ${e.janelaFim ?? "—"}` : "—";
  // Dialeto SBSO ("Marcos & Eventos para o timeline"): a fonte só tem Data · Tipo · Marco/Evento ·
  // Descrição — reproduzir as colunas DELA e omitir as demais (spec: nunca preencher de outra tabela).
  const shapeSbso = eventos.every(
    (e) => e.frenteTrecho == null && e.impacta == null && e.diasAtraso == null && e.fonte == null,
  );
  if (shapeSbso) {
    const toneTipo: Record<string, "info" | "warning" | "danger" | "success"> = {
      contratual: "info",
      execução: "success",
      execucao: "success",
      medição: "info",
      medicao: "info",
      atraso: "danger",
      projeção: "warning",
      projecao: "warning",
    };
    return (
      <DataTable<TimelineEvento>
        columns={[
          { key: "data", label: "Data", width: "96px", render: (e) => fmtBR(e.dataInicio) },
          {
            key: "tipo",
            label: "Tipo",
            width: "110px",
            render: (e) =>
              e.categoria ? (
                <Badge tone={toneTipo[e.categoria.toLowerCase()] ?? "info"}>{e.categoria}</Badge>
              ) : (
                "—"
              ),
          },
          {
            key: "marco",
            label: "Marco / Evento",
            width: "1.4fr",
            render: (e) => <span className="tl-evnm">{e.titulo}</span>,
          },
          {
            key: "desc",
            label: "Descrição / Observação",
            width: "2fr",
            render: (e) => <span className="tl-fonte">{e.clausulas ?? "—"}</span>,
          },
        ]}
        rows={eventos}
        getRowId={(e) => e.evId ?? String(e.ordem)}
      />
    );
  }
  return (
    <DataTable<TimelineEvento>
      columns={[
        { key: "ev", label: "ID", width: "58px", render: (e) => e.evId ?? "—" },
        { key: "data", label: "Data", width: "86px", render: (e) => fmtBR(e.dataInicio) },
        {
          key: "ev2",
          label: "Evento (fato real)",
          width: "1.7fr",
          render: (e) => (
            <span className="tl-evnm">
              {e.critico && <span className="tl-evcrit" title="Crítico" />}
              {e.titulo}
            </span>
          ),
        },
        {
          key: "frente",
          label: "Frente / km",
          width: "118px",
          render: (e) => e.frenteTrecho ?? "—",
        },
        {
          key: "imp",
          label: "Impacta crítico?",
          width: "108px",
          align: "center",
          render: (e) =>
            e.impacta == null ? (
              "—"
            ) : (
              <Badge tone={e.impacta ? "danger" : "success"}>{e.impacta ? "Sim" : "Não"}</Badge>
            ),
        },
        {
          key: "jan",
          label: "Janela do impacto",
          width: "148px",
          render: (e) => <span className="tl-janela tabular">{fmtJanela(e)}</span>,
        },
        {
          key: "atr",
          label: "Dias de atraso",
          width: "104px",
          align: "right",
          render: (e) =>
            e.diasAtraso == null ? (
              <span className="tl-nulo">—</span>
            ) : e.diasAtraso > 0 ? (
              <strong className="tl-atraso tabular">{e.diasAtraso} d</strong>
            ) : (
              <span className="tl-nulo tabular">0 d</span>
            ),
        },
        {
          key: "fonte",
          label: "Fonte",
          width: "1.2fr",
          render: (e) => <span className="tl-fonte">{e.fonte ?? "—"}</span>,
        },
      ]}
      rows={eventos}
      getRowId={(e) => e.evId ?? String(e.ordem)}
    />
  );
}

const fmtPct1 = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function WindowsPanel({ params, nEventos }: { params: TimelineParams; nEventos: number }) {
  const fmtPp = (v: number | null) =>
    v == null
      ? "—"
      : `${v < 0 ? "−" : "+"}${Math.abs(v).toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} p.p.`;
  return (
    <>
      <h2 className="tl-sec">Cronograma impactado · Windows Analysis (janela do mês de corte)</h2>
      <Card className="tl-card tl-windows">
        <div className="tl-wgrid">
          <WCard
            label="Mês de corte"
            value={
              params.mesCorteIndice != null
                ? `BM ${String(params.mesCorteIndice).padStart(2, "0")}`
                : "—"
            }
          />
          <WCard
            label="Avanço físico previsto no período"
            value={
              params.avancoFisicoRealPp != null && params.avancoFisicoPrevistoPp != null
                ? `${fmtPct1(params.avancoFisicoPrevistoPp)} (real ${fmtPct1(params.avancoFisicoRealPp)})`
                : fmtPp(params.avancoFisicoPrevistoPp)
            }
          />
          <WCard label="Δ impacto físico" value={fmtPp(params.deltaImpactoFisicoPp)} />
          <WCard
            label="Caminho crítico"
            value={
              params.caminhoCritico ??
              (params.caminhoCriticoDias != null ? `+${params.caminhoCriticoDias}d` : "—")
            }
          />
          <WCard label="Eventos cadastrados" value={String(nEventos)} />
          <WCard
            label="Marcos em risco"
            value={
              params.marcosEmRisco != null
                ? `${params.marcosEmRisco}${params.marcosTotal ? ` / ${params.marcosTotal}` : ""}`
                : "—"
            }
          />
        </div>
        {params.windowsObs && <p className="tl-wobs">{params.windowsObs}</p>}
        <p className="tl-wnote">
          {I.note({ size: 14 })} A propagação rigorosa até o término do contrato (se o atraso de um
          trecho consome folga ou empurra o caminho crítico) é a Windows Analysis completa, feita na{" "}
          <b>C.5 Prazo</b>.
        </p>
      </Card>
    </>
  );
}

function WCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="tl-wcard">
      <span className="tl-wcard-l">{label}</span>
      <span className="tl-wcard-v">{value}</span>
    </div>
  );
}

// ── puro ─────────────────────────────────────────────────────────────────────

/** Fim do mês do BM de corte (M1 = mês da OS real; BM n = M1 + n−1). O real vem do Boletim de
 *  Medição — a barra "em andamento" vai até aqui, NÃO até hoje (decisão do dono, jul/2026).
 *  Fallback sem params: última data real conhecida no cronograma (nunca "hoje"). */
function corteBmISO(params: TimelineParams | null, tarefas: TimelineTarefa[]): string | null {
  if (params?.osReal && params.mesCorteIndice != null) {
    const [y, m] = params.osReal.split("-").map(Number);
    if (y && m) {
      const idx = y * 12 + (m - 1) + (params.mesCorteIndice - 1);
      const yy = Math.floor(idx / 12);
      const mm = idx % 12; // 0-based
      const ultimoDia = new Date(yy, mm + 1, 0).getDate();
      return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
    }
  }
  const reais = tarefas
    .flatMap((t) => [t.dataInicioReal, t.dataTerminoReal])
    .filter(Boolean) as string[];
  return reais.sort().slice(-1)[0] ?? null;
}

/** Tooltip factual da barra em andamento — sem inferir término nem reinterpretar desvio. */
function tituloAndamento(t: TimelineTarefa, corte: string): string {
  const pctTxt =
    t.pctConcluido != null
      ? ` · ${(t.pctConcluido * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% concluído`
      : "";
  return `Em andamento — iniciou ${fmtBR(t.dataInicioReal)}${pctTxt} · real conhecido até o corte do BM (${fmtBR(corte)})`;
}

function farolDoContrato(
  reprog: number | null,
  params: TimelineParams | null,
): { tone: "success" | "info" | "warning" | "danger"; label: string } {
  // delta = avanço físico previsto − real na janela (p.p.); >0 = real ATRÁS do plano.
  const delta = params?.deltaImpactoFisicoPp ?? 0;
  const marcosRisco = params?.marcosEmRisco ?? 0;
  // Crítico só quando o real está MUITO atrás do previsto (≥10 p.p.) — não basta a OS reprogramar:
  // os impactos atuais estão no início do Trecho 01 (fora do caminho crítico), término c/ folga.
  if (delta >= 10) return { tone: "danger", label: "Crítico" };
  if (marcosRisco > 0 || (reprog ?? 0) > 30 || delta > 0)
    return { tone: "warning", label: "Risco" };
  if ((reprog ?? 0) > 0) return { tone: "info", label: "Observação" };
  return { tone: "success", label: "Conforme" };
}

function nomeCurto(nome: string): string {
  // "Trecho 01 — km144+600 ao 156+400 (11,8 km)" → "Trecho 01"
  const base = nome.split("—")[0].trim();
  return base.length > 26 ? `${base.slice(0, 26)}…` : base;
}
