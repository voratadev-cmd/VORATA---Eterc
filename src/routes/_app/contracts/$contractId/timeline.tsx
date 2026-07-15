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
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  I,
  Segmented,
  Skeleton,
  Toggle,
} from "@/components/ds";
import { useTimeline } from "@/lib/hooks/useTimeline";
import { useSubcontratos } from "@/lib/hooks/useSubcontratos";
import type { SubTimelineItem } from "@/lib/supabase/subcontratos";
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
  const { tarefas, eventos, params, projecao, painel } = view;

  const model = useMemo(() => {
    // eixo: OS real → término contratual (fallback: min/max das tarefas)
    const inicios = tarefas.map((t) => t.dataInicio).filter(Boolean) as string[];
    const fins = tarefas.map((t) => t.dataTermino).filter(Boolean) as string[];
    const t0s = params?.osReal ?? inicios.sort()[0] ?? null;
    // término CONTRATUAL (pino/rótulo) ≠ fim do EIXO: o eixo estende até o término de impacto
    // mais tardio — é isso que deixa a 3ª faixa (+71d) VISÍVEL além do previsto (spec item 3).
    const tCon = params?.terminoContratual ?? fins.sort().slice(-1)[0] ?? null;
    const finsImpacto = tarefas.map((t) => t.dataTerminoImpacto).filter(Boolean) as string[];
    const t1s = [tCon, ...finsImpacto].filter(Boolean).sort().slice(-1)[0] ?? null;
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
      tCon,
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

      {/* cards de início (spec item 2) — contratual · impacto crítico · tendência · físico */}
      <div className="tl-kpis">
        <Kpi
          label="Término contratual"
          value={fmtBR(model.tCon)}
          sub={`${view.prazoDias != null ? `${view.prazoDias} dias · ` : ""}OS ${fmtBR(model.t0s)}`}
        />
        <Kpi
          label="Impacto crítico físico"
          value={painel?.impactoFinalDias != null ? `+${painel.impactoFinalDias} dias` : "—"}
          sub={
            painel?.terminoCriticoFisicoISO
              ? `término ${fmtBR(painel.terminoCriticoFisicoISO)}`
              : undefined
          }
          tone="danger"
        />
        <Kpi
          label="Tendência por ritmo"
          value={
            painel?.deltaVsContratualDias != null ? `+${painel.deltaVsContratualDias} dias` : "—"
          }
          sub={
            painel?.terminoProjetado
              ? `término ${fmtBR(painel.terminoProjetado.slice(0, 10))}`
              : undefined
          }
          tone="warning"
        />
        <Kpi
          label="Avanço físico real"
          value={
            painel?.fisicoRealPct != null
              ? `${painel.fisicoRealPct.toFixed(1).replace(".", ",")}%`
              : "—"
          }
          sub={
            painel?.fisicoPrevistoPct != null && painel?.atrasoAcumPp != null
              ? `previsto ${painel.fisicoPrevistoPct.toFixed(1).replace(".", ",")}% · −${painel.atrasoAcumPp.toFixed(1).replace(".", ",")} pp`
              : undefined
          }
        />
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
                right: `${100 - model.pct(model.tCon)}%`,
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
              leftPct={model.pct(model.tCon)}
              align="end"
              label={fmtBR(model.tCon)}
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

      {/* ── Faixa de vigência dos subcontratos (spec item 5 · toggle) ── */}
      <SubsFaixa
        pct={model.pct}
        anos={model.anos}
        hoje={model.hoje}
        hojeVisivel={model.hojeVisivel}
      />

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

      {/* ── Tabela de impacto resumida + a conta dos 71 dias (spec item 4) ── */}
      <ImpactoResumo tarefas={tarefas} tCon={model.tCon} painel={painel} />

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

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warning";
}) {
  return (
    <span className={`tl-kpi${tone ? ` tl-kpi-${tone}` : ""}`}>
      {label} <b>{value}</b>
      {sub ? <em className="tl-kpi-sub">{sub}</em> : null}
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
        <>
          <div
            className={`tl-ibar ${/realizado/i.test(t.natureza ?? "") ? "tl-ibar-real" : "tl-ibar-proj"}`}
            style={{
              left: `${pct(t.dataInicioImpacto)}%`,
              width: `${Math.max(0.4, pct(t.dataTerminoImpacto) - pct(t.dataInicioImpacto))}%`,
            }}
            title={`Impacto: ${fmtBR(t.dataInicioImpacto)} → ${fmtBR(t.dataTerminoImpacto)}${
              t.impactoDias != null ? ` (+${t.impactoDias}d)` : ""
            }${t.natureza ? ` · ${t.natureza}` : ""}`}
          />
          {t.impactoDias != null ? (
            <span className="tl-ilabel" style={{ left: `${pct(t.dataTerminoImpacto)}%` }}>
              +{t.impactoDias}d
            </span>
          ) : null}
        </>
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

// ── Faixa de vigência dos subcontratos (spec item 5) ────────────────────────
// Mesma escala `pct` do Gantt acima → correlação temporal CT × disciplina lado a lado.
// Dado da Central de Subcontratos (S_SUBCONTRATADOS · useSubcontratos, cache compartilhado
// com a tela C.7): vigência = min início → max término por CT, preenchimento = % medido
// (satura em 100 no estouro). Obra sem seções S (BR-101) → a faixa simplesmente não existe.
const SUB_ESTADO: Record<SubTimelineItem["estado"], { cor: string; label: string }> = {
  andamento: { cor: "var(--success)", label: "Em andamento" },
  concluido: { cor: "var(--info)", label: "Concluído" },
  critico: { cor: "var(--danger)", label: "Crítico (estouro/parado)" },
  cancelado: { cor: "var(--text-4)", label: "Cancelado" },
  aprovacao: { cor: "var(--warning)", label: "Em aprovação" },
};

function SubsFaixa({
  pct,
  anos,
  hoje,
  hojeVisivel,
}: {
  pct: (s: string | null | undefined) => number;
  anos: { label: number; left: number }[];
  hoje: number;
  hojeVisivel: boolean;
}) {
  const { contractId } = Route.useParams();
  const { data: subs } = useSubcontratos(contractId);
  const [ligada, setLigada] = useState(true);
  const [fEstado, setFEstado] = useState<"todos" | SubTimelineItem["estado"]>("todos");
  if (!subs || !subs.timeline.length) return null;
  const nPor = (e: SubTimelineItem["estado"]) => subs.timeline.filter((t) => t.estado === e).length;
  const barras =
    fEstado === "todos" ? subs.timeline : subs.timeline.filter((t) => t.estado === fEstado);
  return (
    <>
      <div className="tl-subhead">
        <h2 className="tl-sec">
          Vigência dos subcontratos{" "}
          <span className="tl-sec-hint">
            · {subs.timeline.length} contratos · mesma escala do Gantt · preenchimento = % medido
          </span>
        </h2>
        <label className="tl-subtoggle">
          Mostrar faixa
          <Toggle
            checked={ligada}
            onCheckedChange={setLigada}
            aria-label="Mostrar faixa de vigência dos subcontratos"
          />
        </label>
      </div>
      {ligada && (
        <>
          <div className="tl-subfiltro">
            <Segmented<"todos" | SubTimelineItem["estado"]>
              value={fEstado}
              onChange={setFEstado}
              aria-label="Filtrar subcontratos por estado"
              items={[
                { value: "todos", label: `Todos · ${subs.timeline.length}` },
                { value: "critico", label: `Críticos · ${nPor("critico")}` },
                { value: "andamento", label: `Em andamento · ${nPor("andamento")}` },
                { value: "concluido", label: `Concluídos · ${nPor("concluido")}` },
                { value: "aprovacao", label: `Aprovação · ${nPor("aprovacao")}` },
                { value: "cancelado", label: `Cancelados · ${nPor("cancelado")}` },
              ]}
            />
          </div>
          <div className="tl-gantt tl-subband">
            {barras.map((t) => {
              const e = SUB_ESTADO[t.estado];
              const left = pct(t.inicioISO);
              const width = Math.max(0.6, pct(t.terminoISO) - left);
              const fill = clamp(t.pctMed ?? 0);
              return (
                <div className="tl-row tl-subrow" key={t.numContrato}>
                  <div className="tl-label tl-sublabel" title={`${t.numContrato} · ${t.nome}`}>
                    <span className="tl-subdot" style={{ background: e.cor }} aria-hidden />
                    <span className="tl-nm">
                      {t.numContrato.split(/[-/]/)[0]} · {t.nome}
                    </span>
                  </div>
                  <div className="tl-track tl-subtrack">
                    <Gridlines anos={anos} hoje={hoje} hojeVisivel={hojeVisivel} />
                    <span
                      className="tl-subbar"
                      style={{ left: `${left}%`, width: `${width}%`, borderColor: e.cor }}
                      title={`${t.numContrato} · ${t.nome} — vigência ${fmtBR(t.inicioISO)} → ${fmtBR(
                        t.terminoISO,
                      )} · ${t.pctMed != null ? `${Math.round(t.pctMed)}% medido` : "sem medição"} · ${e.label}`}
                    >
                      <span
                        className="tl-subfill"
                        style={{ width: `${fill}%`, background: e.cor }}
                      />
                    </span>
                  </div>
                </div>
              );
            })}
            {barras.length === 0 && (
              <div className="tl-subvazio">
                Nenhum subcontrato no estado selecionado.{" "}
                <button type="button" className="tl-btn" onClick={() => setFEstado("todos")}>
                  Limpar filtro
                </button>
              </div>
            )}
          </div>
          <p className="tl-subleg">
            {Object.values(SUB_ESTADO).map((e) => (
              <span key={e.label} className="tl-subleg-item">
                <span className="tl-subdot" style={{ background: e.cor }} aria-hidden /> {e.label}
              </span>
            ))}
            <span className="tl-subleg-nota">
              Vigências da Central de Subcontratos (C.7) na escala do contrato — correlação temporal
              apenas; não entram no caminho crítico nem na conta de impacto.
            </span>
          </p>
        </>
      )}
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

const fmtPct1 = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function ImpactoResumo({
  tarefas,
  tCon,
  painel,
}: {
  tarefas: TimelineTarefa[];
  tCon: string | null;
  painel: View["painel"];
}) {
  // 1 linha por DISCIPLINA (nível 0 da tabela de impacto da aba C.5) — é daqui que saem os 71d.
  const discs = tarefas.filter((t) => t.nivel === 0);
  if (!discs.length) return null;
  const maxImpacto = discs
    .map((t) => t.dataTerminoImpacto)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] as string | undefined;
  const impactoFinal =
    tCon && maxImpacto ? Math.round((ms(maxImpacto) - ms(tCon)) / 86_400_000) : null;
  const noLimite = discs
    .filter((t) => t.dataTerminoImpacto === maxImpacto)
    .map((t) => nomeCurto(t.nome));
  return (
    <>
      <h2 className="tl-sec">Tabela de impacto por disciplina</h2>
      <Card className="tl-card">
        <div className="tl-resumo-wrap">
          <table className="tl-resumo">
            <thead>
              <tr>
                <th>Cód</th>
                <th>Disciplina</th>
                <th>Início prev.</th>
                <th>Térm. prev.</th>
                <th>Início Real</th>
                <th>Térm. Real</th>
                <th className="r">Atraso</th>
                <th className="r">Impacto</th>
                <th>Térm. Impacto</th>
                <th>Natureza</th>
              </tr>
            </thead>
            <tbody>
              {discs.map((t) => (
                <tr key={t.ordem}>
                  <td className="tabular">{t.numeroItem ?? t.codigo ?? "—"}</td>
                  <td className="tl-resumo-nm">{t.nome}</td>
                  <td className="tabular">{fmtBR(t.dataInicio)}</td>
                  <td className="tabular">{fmtBR(t.dataTermino)}</td>
                  <td className="tabular">{fmtBR(t.dataInicioReal)}</td>
                  <td className="tabular">{fmtBR(t.dataTerminoReal)}</td>
                  <td className="r tabular">{t.desvioDias ?? "—"}</td>
                  <td className="r tabular tl-resumo-imp">
                    {t.impactoDias != null ? t.impactoDias : "—"}
                  </td>
                  <td className="tabular">{fmtBR(t.dataTerminoImpacto)}</td>
                  <td>
                    {t.natureza ? (
                      <Badge tone={/realizado/i.test(t.natureza) ? "danger" : "warning"}>
                        {t.natureza}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tl-conta">
          <div className="tl-conta-bloco">
            <b>IMPACTO FINAL — CENÁRIO CRÍTICO FÍSICO</b>
            <span>
              Término contratual: <b className="tabular">{fmtBR(tCon)}</b>
            </span>
            <span>
              Data de impacto mais tardia (físicas):{" "}
              <b className="tabular">{fmtBR(maxImpacto ?? null)}</b>
              {noLimite.length ? ` (${noLimite.join(", ")})` : ""}
            </span>
            <span>
              IMPACTO FINAL (prorrogação) ={" "}
              <b className="tabular">{impactoFinal != null ? `${impactoFinal} dias` : "—"}</b>
              {maxImpacto && tCon ? ` [= ${fmtBR(maxImpacto)} − ${fmtBR(tCon)}]` : ""}
            </span>
          </div>
          <div className="tl-conta-bloco">
            <b>CENÁRIO TENDÊNCIA (POR RITMO)</b>
            <span>
              Término projetado:{" "}
              <b className="tabular">{fmtBR(painel?.terminoProjetado?.slice(0, 10) ?? null)}</b> ·
              Prorrogação:{" "}
              <b className="tabular">
                {painel?.deltaVsContratualDias != null
                  ? `${painel.deltaVsContratualDias} dias`
                  : "—"}
              </b>{" "}
              · ritmo {painel?.ritmoVsNecessario ?? "—"}
            </span>
          </div>
        </div>
        <p className="tl-conta-nota">
          O impacto final NÃO é a soma dos impactos individuais — é o término de impacto mais tardio
          ({fmtBR(maxImpacto ?? null)}) menos o término contratual ({fmtBR(tCon)}). Três disciplinas
          do encadeamento desembocam nessa data; Serviços Finais (a última da cadeia) confirma.
          Fundações tem o maior impacto individual (+113d) mas termina antes (23/10/2026) — por isso
          não define o fim.
        </p>
      </Card>
    </>
  );
}

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
