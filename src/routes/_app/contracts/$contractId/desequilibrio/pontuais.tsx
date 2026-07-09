// D.6 — Análises Pontuais (eventos de paralisação/ociosidade). Tudo do dado REAL normalizado pelo
// workbook-motor: obra_pontuais_evento (4 eventos: chuva excedente + impedimentos, com a quebra de
// equipe por subtração) + obra_pontuais_chuva_mensal (memória do pleiteável) + obra_pontuais_chuva_dia
// (ociosidade diária) + obra_pontuais_params (resumo dos Cards). HONESTIDADE central: a perda é
// VALIDADA = R$ 0 — fica como DOSSIÊ pendente (R$ 763k) pra não dobrar contagem com a D.4 (macro); a
// escolha macro × eventos é feita no Gerador de Claim (D.10). Tokens-only; farol canônico.

import { useState } from "react";
import {
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CloudRain,
  HardHat,
  Hourglass,
  TriangleAlert,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  CHART_SERIE_COR,
  ChartLegend,
  ChartTooltip,
  EmptyState,
  ErroCard,
  FarolCard,
  Skeleton,
} from "@/components/ds";
import { type PontuaisD6View, usePontuaisD6 } from "@/lib/hooks/usePontuaisD6";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import type {
  PontualChuvaDia,
  PontualChuvaMes,
  PontualEvento,
  PontualParams,
} from "@/lib/supabase/pontuaisD6";
import { normalizarFarol } from "@/lib/supabase/faturamentoDisciplinaResumo";
import "./pontuais.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/pontuais")({
  component: PontuaisPage,
  head: () => ({ meta: [{ title: "D.6 Análises Pontuais — RDM IA" }] }),
});

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmtBRL = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : "—";
const fmtInt = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? Math.round(n).toLocaleString("pt-BR") : "—";
const fmtPctInt = (frac: number | null | undefined) =>
  frac != null && Number.isFinite(frac) ? `${Math.round(frac * 100)}%` : "—";
const fmtNum1 = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";

type CatTone = "info" | "warning" | "vault" | "slate";
function catTone(cat: string | null): CatTone {
  const c = (cat ?? "").toLowerCase();
  if (c === "chuva") return "info";
  if (c.includes("frente")) return "warning";
  if (c.includes("retrabalho")) return "vault";
  return "slate";
}
type TipoFicha = "chuva" | "impedimento" | "prazo";
function tipoFicha(e: PontualEvento): TipoFicha {
  if ((e.categoria ?? "").toLowerCase() === "chuva") return "chuva";
  if ((e.dias ?? 0) > 0 && (e.custoRs ?? 0) > 0) return "impedimento";
  return "prazo";
}

// ── Página ─────────────────────────────────────────────────────────────────────
function PontuaisPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = usePontuaisD6(contractId);

  return (
    <main className="pnt-main">
      <PntHeader nome={data?.nome ?? null} params={data?.params ?? null} />
      {isLoading ? (
        <PntSkeleton />
      ) : isError ? (
        <ErroCard mensagem={error?.message} onRetry={() => refetch()} />
      ) : !data || data.eventos.length === 0 ? (
        <EmptyState
          framed
          title="Análises pontuais ainda não disponíveis"
          text="Esta obra não tem eventos pontuais (chuva excedente / impedimentos) normalizados no banco ainda."
          hint="Aguardando o módulo M3"
        />
      ) : (
        <PntConteudo v={data} />
      )}
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function PntHeader({ nome, params }: { nome: string | null; params: PontualParams | null }) {
  const nivel = normalizarFarol(params?.farol ?? null);
  return (
    <header className="pnt-head">
      <div className="pnt-head-row">
        <div>
          <h2 className="pnt-titulo">D.6 — Análises Pontuais (eventos)</h2>
          <p className="pnt-sub">
            Paralisações e ociosidades documentadas evento a evento{nome ? ` · ${nome}` : ""}.{" "}
            <strong>Clique em cada evento</strong> para abrir a ficha: período, equipe afetada,
            memória de cálculo e anotação do RDO/ATA.
          </p>
        </div>
        {nivel && <Badge tone={farolToBadge[nivel]}>{farolLabel[nivel]}</Badge>}
      </div>
      <p className="pnt-fontes">
        Fontes: auxiliar_D.6 Chuva · auxiliar_D.6 Impedimentos · C.9 — Chuvas
      </p>
    </header>
  );
}

// ── Conteúdo ─────────────────────────────────────────────────────────────────
function PntConteudo({ v }: { v: PontuaisD6View }) {
  return (
    <>
      <D6Resumo params={v.params} eventos={v.eventos} />
      <D6Eventos v={v} />
      <DuplaContagemWarn />
      <IaLeitura v={v} />
    </>
  );
}

// ── Resumo (4 KPIs) ───────────────────────────────────────────────────────────
function D6Resumo({ params, eventos }: { params: PontualParams | null; eventos: PontualEvento[] }) {
  const validada = params?.perdaValidadaRs ?? 0;
  // Guarda de reconciliação (display-only, BRUTOS, tolerância < 0,01): a Σ dos eventos deve bater
  // com o pendente informado nos Cards. NUNCA substitui o pendente canônico — só revela divergência.
  const somaEventos = eventos.reduce((a, e) => a + (e.custoRs ?? 0), 0);
  const pendente = params?.pendenteTotalRs ?? somaEventos;
  const recOk =
    params?.pendenteTotalRs == null || Math.abs(somaEventos - params.pendenteTotalRs) < 0.01;
  const nPend = params?.eventosPendentes ?? eventos.length;
  return (
    <>
      <div className="pnt-sec">Resumo</div>
      <div className="pnt-kpis">
        <FarolCard
          label="Perda validada (acum.)"
          icon="check"
          value={fmtBRL(validada)}
          info="alimenta a D.0"
          accent="success"
        />
        <FarolCard
          label="Pendente (não somado)"
          icon="clock"
          value={fmtBRL(pendente)}
          info={`${nPend} ${nPend === 1 ? "evento" : "eventos"} em análise`}
          accent="warning"
        />
        <FarolCard
          label="Eventos pendentes"
          icon="note"
          value={fmtInt(nPend)}
          info="de revisão / validação"
          accent="neutral"
        />
        <FarolCard
          label="Farol"
          icon="flag"
          value={params?.farol ?? "Conforme"}
          info="nada somado ainda"
          accent="success"
        />
      </div>
      {!recOk ? (
        <RecWarn>
          Soma dos eventos ({fmtBRL(somaEventos)}) diverge do pendente informado (
          {fmtBRL(params?.pendenteTotalRs)}) — conferir extração. Pendente canônico mantido.
        </RecWarn>
      ) : null}
    </>
  );
}

// ── Eventos documentados ───────────────────────────────────────────────────────
function D6Eventos({ v }: { v: PontuaisD6View }) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const toggle = (ordem: number) =>
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(ordem)) next.delete(ordem);
      else next.add(ordem);
      return next;
    });
  return (
    <>
      <div className="pnt-sec">Eventos documentados — clique para abrir a ficha</div>
      <div className="pnt-evts">
        {v.eventos.map((e) => (
          <EventoCard
            key={e.ordem}
            e={e}
            v={v}
            aberto={abertos.has(e.ordem)}
            onToggle={() => toggle(e.ordem)}
          />
        ))}
      </div>
    </>
  );
}

function EventoCard({
  e,
  v,
  aberto,
  onToggle,
}: {
  e: PontualEvento;
  v: PontuaisD6View;
  aberto: boolean;
  onToggle: () => void;
}) {
  const tone = catTone(e.categoria);
  const tipo = tipoFicha(e);
  const subtitulo = [e.periodo, e.duracao].filter(Boolean).join(" · ");
  // Identidade primária do evento no dossiê = o título; período · duração vira o subtítulo (antes o
  // card abria só com "10/03–07/06 · 27 dias" sem dizer O QUÊ). Fallbacks quando o título falta.
  const tituloPrincipal = e.titulo || subtitulo || e.descricao || "Evento";
  const subLinha = e.titulo ? subtitulo || null : subtitulo ? e.descricao : null;
  const revisar = (e.status ?? "").toLowerCase() === "needs_review";
  const fichaId = `pnt-ficha-${e.ordem}`;
  return (
    <section className={`pnt-evt${aberto ? " aberto" : ""}`}>
      <button
        type="button"
        className="pnt-evt-hd"
        onClick={onToggle}
        aria-expanded={aberto}
        aria-controls={fichaId}
      >
        <span className={`pnt-cat pnt-cat-${tone}`}>{e.categoria ?? "—"}</span>
        <span className="pnt-evt-ti">
          <span className="pnt-evt-d">
            {tituloPrincipal}
            {revisar && (
              <Badge tone="warning" className="pnt-evt-badge">
                Revisar
              </Badge>
            )}
          </span>
          {subLinha && <span className="pnt-evt-p">{subLinha}</span>}
        </span>
        <span className="pnt-evt-vv">
          <span className="pnt-evt-pv">{fmtBRL(e.custoRs)}</span>
          <span className="pnt-evt-pend">
            <Hourglass size={12} aria-hidden /> Pendente
          </span>
        </span>
        <span className="pnt-evt-tog">
          {aberto ? (
            <>
              <ChevronDown size={13} aria-hidden /> fechar ficha
            </>
          ) : (
            <>
              <ChevronRight size={13} aria-hidden /> ver ficha
            </>
          )}
        </span>
      </button>
      {aberto && (
        <div className="pnt-ficha" id={fichaId}>
          {tipo === "chuva" ? (
            <FichaChuva e={e} chuvaMensal={v.chuvaMensal} chuvaDia={v.chuvaDia} />
          ) : tipo === "impedimento" ? (
            <FichaImpedimento e={e} params={v.params} />
          ) : (
            <FichaPrazo e={e} />
          )}
        </div>
      )}
    </section>
  );
}

// ── Ficha · seção genérica ──────────────────────────────────────────────────────
function Fsec({
  titulo,
  icon,
  children,
}: {
  titulo: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pnt-fsec">
      <div className="pnt-fsec-h">
        {icon}
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Anotacao({ tag, texto }: { tag: string | null; texto: string | null }) {
  return (
    <div className="pnt-rdo">
      {tag && <span className="pnt-rdo-tag">{tag}</span>}
      {texto ?? "—"}
    </div>
  );
}

// ── Ficha CHUVA ────────────────────────────────────────────────────────────────
function FichaChuva({
  e,
  chuvaMensal,
  chuvaDia,
}: {
  e: PontualEvento;
  chuvaMensal: PontualChuvaMes[];
  chuvaDia: PontualChuvaDia[];
}) {
  const impacto = chuvaDia.filter((d) => (d.hhOciosas ?? 0) > 0);
  const totHH = chuvaDia.reduce((a, d) => a + (d.hhOciosas ?? 0), 0);
  const totHEQ = chuvaDia.reduce((a, d) => a + (d.heqOciosas ?? 0), 0);
  const totMod = chuvaMensal.reduce((a, m) => a + (m.pleiteavelModRs ?? 0), 0);
  const totEqp = chuvaMensal.reduce((a, m) => a + (m.pleiteavelEqpRs ?? 0), 0);
  const totMes = chuvaMensal.reduce((a, m) => a + (m.totalMesRs ?? 0), 0);
  const mesExc = chuvaMensal.find((m) => (m.excedente ?? 0) > 0);
  // Guarda de reconciliação (display-only, valores BRUTOS, tolerância < 0,01): a Σ das parcelas
  // pleiteáveis (MOD + EQP) deve bater com o custo do evento. NUNCA substitui e.custoRs — só revela.
  const somaParcelas = totMod + totEqp;
  const recOk = Math.abs(somaParcelas - (e.custoRs ?? 0)) < 0.01;

  return (
    <>
      <Fsec icon={<CalendarDays size={14} aria-hidden />} titulo="Período e dias">
        <div className="pnt-rdo">
          Janela chuvosa {e.periodo ? <strong>{e.periodo}</strong> : null} · {e.duracao ?? "—"}.
          Dias com chuva &gt; 5&nbsp;mm e equipe em campo geram ociosidade.
        </div>
      </Fsec>

      <Fsec
        icon={<CloudRain size={14} aria-hidden />}
        titulo="Evidência diária — chuva por dia e critério > 5 mm"
      >
        <ChuvaDiaChart dias={chuvaDia} />
      </Fsec>

      <Fsec
        icon={<HardHat size={14} aria-hidden />}
        titulo="Equipe afetada · dias com impacto (efetivo real do RDO)"
      >
        <div className="pnt-ft-wrap">
          <table className="pnt-ft">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Chuva (mm)</th>
                <th>Efetivo (RDO)</th>
                <th>HH ociosas</th>
                <th>Equip. prod.</th>
                <th>HEQ ociosas</th>
                <th>Custo ocioso/dia</th>
              </tr>
            </thead>
            <tbody>
              {impacto.map((d) => (
                <tr key={d.ordem}>
                  <td>{d.dataLabel ?? "—"}</td>
                  <td className={d.acima5mm ? "pnt-ft-hot" : ""}>{fmtNum1(d.chuvaMm)}</td>
                  <td>{fmtInt(d.efetivoRdo)}</td>
                  <td>{fmtInt(d.hhOciosas)}</td>
                  <td>{fmtInt(d.equipProducao)}</td>
                  <td>{fmtInt(d.heqOciosas)}</td>
                  <td>{fmtBRL((d.custoOciosoRs ?? 0) + (d.custoEqpRs ?? 0))}</td>
                </tr>
              ))}
              <tr className="pnt-ft-tot">
                <td>TOTAL (dias &gt; 5 mm)</td>
                <td>—</td>
                <td>—</td>
                <td>{fmtInt(totHH)}</td>
                <td>—</td>
                <td>{fmtInt(totHEQ)}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Fsec>

      <Fsec
        icon={<Calculator size={14} aria-hidden />}
        titulo="Memória de cálculo — líquida da prevista (C.9)"
      >
        <ChuvaMensalChart meses={chuvaMensal} />
        <div className="pnt-ft-wrap">
          <table className="pnt-ft">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Real &gt; 5 mm (dias)</th>
                <th>Previsto (dias)</th>
                <th>Excedente</th>
                <th>Fração</th>
                <th>Pleiteável MOD</th>
                <th>Pleiteável EQP</th>
                <th>Total mês</th>
              </tr>
            </thead>
            <tbody>
              {chuvaMensal.map((m) => (
                <tr key={m.ordem} className={(m.totalMesRs ?? 0) > 0 ? "" : "pnt-ft-z"}>
                  <td>{m.mesLabel ?? "—"}</td>
                  <td>{fmtInt(m.real5mm)}</td>
                  <td>{fmtInt(m.prev5mm)}</td>
                  <td>{fmtInt(m.excedente)}</td>
                  <td>{fmtPctInt(m.fracaoExcedente)}</td>
                  <td className="pnt-ft-pl">{fmtBRL(m.pleiteavelModRs)}</td>
                  <td className="pnt-ft-pl">{fmtBRL(m.pleiteavelEqpRs)}</td>
                  <td className="pnt-ft-pl">{fmtBRL(m.totalMesRs)}</td>
                </tr>
              ))}
              <tr className="pnt-ft-tot">
                <td colSpan={5}>Total pleiteável (líquido da prevista)</td>
                <td className="pnt-ft-pl">{fmtBRL(totMod)}</td>
                <td className="pnt-ft-pl">{fmtBRL(totEqp)}</td>
                <td className="pnt-ft-pl">{fmtBRL(totMes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="pnt-memo">
          Só o que <strong>excede</strong> a chuva prevista é pleiteável.
          {mesExc ? (
            <>
              {" "}
              Apenas <strong>{mesExc.mesLabel}</strong> teve excedente ({fmtInt(mesExc.real5mm)}{" "}
              dias reais vs {fmtInt(mesExc.prev5mm)} previstos → fração{" "}
              {fmtPctInt(mesExc.fracaoExcedente)}
              ).
            </>
          ) : null}{" "}
          MOD <strong>{fmtBRL(totMod)}</strong> + EQP <strong>{fmtBRL(totEqp)}</strong> ={" "}
          <span className="pnt-memo-res">{fmtBRL(e.custoRs)}</span>
        </div>
        {!recOk ? (
          <RecWarn>
            Soma das parcelas ({fmtBRL(somaParcelas)}) diverge do custo do evento (
            {fmtBRL(e.custoRs)}) — conferir extração. Valor do evento mantido.
          </RecWarn>
        ) : null}
      </Fsec>

      <Fsec icon={<ClipboardList size={14} aria-hidden />} titulo="Anotação (RDO)">
        <Anotacao tag="RDO diário" texto={e.descricao ?? e.fonte} />
      </Fsec>
    </>
  );
}

// ── Gráfico · chuva diária (mm) com critério > 5 mm ─────────────────────────────
// Plota chuvaMm por dia (série JÁ carregada) — barras acima de 5 mm em danger (o "ruim"
// semântico: geram ociosidade); linha de referência no critério. HH ociosas no tooltip.
function ChuvaDiaChart({ dias }: { dias: PontualChuvaDia[] }) {
  const dados = dias
    .filter((d) => d.chuvaMm != null)
    .map((d) => ({
      dia: d.dataLabel ?? "—",
      mm: d.chuvaMm,
      acima: d.acima5mm ?? (d.chuvaMm ?? 0) > 5,
      hh: d.hhOciosas,
    }));
  if (dados.length === 0) return null;
  return (
    <div className="pnt-chart">
      <ResponsiveContainer width="100%" height={150}>
        <BarChart
          data={dados}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          barCategoryGap="16%"
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="dia"
            tick={{ fontSize: 9, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${v} mm`}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
            content={
              <ChartTooltip
                formatter={(v: number) => `${fmtNum1(v)} mm`}
                nomes={{ mm: "Chuva do dia" }}
                titulo={(label, payload) => {
                  const p = payload?.[0]?.payload as { hh: number | null } | undefined;
                  return (
                    <>
                      {label}
                      <span className="pnt-tip-extra">{fmtInt(p?.hh)} HH ociosas</span>
                    </>
                  );
                }}
              />
            }
          />
          <ReferenceLine
            y={5}
            stroke={CHART_SERIE_COR.meta}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: "5 mm", position: "right", fontSize: 10, fill: "var(--warning)" }}
          />
          <Bar dataKey="mm" name="Chuva do dia" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {dados.map((d, i) => (
              <Cell key={i} fill={d.acima ? CHART_SERIE_COR.ruim : CHART_SERIE_COR.contratado} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { label: "Dia ≤ 5 mm", tipo: "barra", cor: CHART_SERIE_COR.contratado },
          { label: "Dia > 5 mm (ocioso)", tipo: "barra", cor: CHART_SERIE_COR.ruim },
          { label: "Critério 5 mm", tipo: "tracejada", cor: CHART_SERIE_COR.meta },
        ]}
      />
    </div>
  );
}

// ── Gráfico · dias > 5 mm por mês (Real × Previsto) ─────────────────────────────
// Plota real5mm × prev5mm por mês (séries JÁ carregadas) — a comparação central do pleito de
// chuva. O mês com excedente sai em danger (o "ruim" semântico). Só meses com movimento.
function ChuvaMensalChart({ meses }: { meses: PontualChuvaMes[] }) {
  const dados = meses
    .filter((m) => (m.real5mm ?? 0) > 0 || (m.prev5mm ?? 0) > 0)
    .map((m) => ({
      mes: m.mesLabel ?? "—",
      real: m.real5mm,
      prev: m.prev5mm,
      excedente: m.excedente ?? 0,
    }));
  if (dados.length === 0) return null;
  return (
    <div className="pnt-chart">
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
            tickFormatter={(v) => `${v} d`}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
            content={
              <ChartTooltip
                formatter={(v: number) => `${fmtInt(v)} dias`}
                nomes={{ prev: "Previsto (dias)", real: "Real > 5 mm (dias)" }}
              />
            }
          />
          <Bar
            dataKey="prev"
            name="Previsto (dias)"
            fill={CHART_SERIE_COR.contratado}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="real"
            name="Real > 5 mm (dias)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          >
            {dados.map((d, i) => (
              <Cell
                key={i}
                fill={(d.excedente ?? 0) > 0 ? CHART_SERIE_COR.ruim : CHART_SERIE_COR.real}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { label: "Previsto (dias)", tipo: "barra", cor: CHART_SERIE_COR.contratado },
          { label: "Real > 5 mm (dias)", tipo: "barra", cor: CHART_SERIE_COR.real },
          { label: "Mês com excedente", tipo: "barra", cor: CHART_SERIE_COR.ruim },
        ]}
      />
    </div>
  );
}

// ── Aviso discreto de reconciliação (display-only, nunca substitui o canônico) ─────
function RecWarn({ children }: { children: React.ReactNode }) {
  return (
    <div className="pnt-rec-warn">
      <TriangleAlert size={14} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

// ── Ficha IMPEDIMENTO (equipe por subtração) ─────────────────────────────────────
function FichaImpedimento({ e, params }: { e: PontualEvento; params: PontualParams | null }) {
  const jornada = params?.jornadaDiaH ?? null;
  const cMod = params?.custoHoraModRs ?? null;
  const cEqp = params?.custoHoraEqpRs ?? null;
  // Guarda de reconciliação (BRUTOS, tolerância < 0,01): MOD + EQP do evento == custo do evento.
  const somaParcelas = (e.custoModRs ?? 0) + (e.custoEqpRs ?? 0);
  const recOk = Math.abs(somaParcelas - (e.custoRs ?? 0)) < 0.01;
  return (
    <>
      <Fsec icon={<CalendarDays size={14} aria-hidden />} titulo="Período e dias">
        <div className="pnt-rdo">
          {e.periodo ?? "—"} · <strong>{fmtInt(e.dias)} dias</strong> de impedimento.
        </div>
      </Fsec>

      <Fsec
        icon={<HardHat size={14} aria-hidden />}
        titulo="Equipe afetada (estimada por subtração)"
      >
        <div className="pnt-equip">
          <Eq label="MOD total/dia" v={fmtInt(e.modTotal)} />
          <Eq label="(−) frentes ativas" v={fmtInt(e.modFrentesAtivas)} />
          <Eq label="= MOD afetado" v={fmtInt(e.modAfetado)} afet />
          <Eq label="EQP total/dia" v={fmtInt(e.eqpTotal)} />
          <Eq label="(−) frentes ativas" v={fmtInt(e.eqpFrentesAtivas)} />
          <Eq label="= EQP afetado" v={fmtInt(e.eqpAfetado)} afet />
        </div>
      </Fsec>

      <Fsec icon={<Calculator size={14} aria-hidden />} titulo="Memória de cálculo">
        <div className="pnt-memo">
          MOD: <strong>{fmtInt(e.modAfetado)}</strong> × {fmtInt(e.dias)} dias × {fmtNum1(jornada)}h
          = <strong>{fmtInt(e.hhOciosas)} HH</strong> × {fmtBRL(cMod)} ={" "}
          <strong>{fmtBRL(e.custoModRs)}</strong>
          <br />
          EQP: <strong>{fmtInt(e.eqpAfetado)}</strong> × {fmtInt(e.dias)} dias × {fmtNum1(jornada)}h
          = <strong>{fmtInt(e.heqOciosas)} HEQ</strong> × {fmtBRL(cEqp)} ={" "}
          <strong>{fmtBRL(e.custoEqpRs)}</strong>
          <br />
          Perda do evento = <span className="pnt-memo-res">{fmtBRL(e.custoRs)}</span>
        </div>
        {!recOk ? (
          <RecWarn>
            Soma das parcelas ({fmtBRL(somaParcelas)}) diverge do custo do evento (
            {fmtBRL(e.custoRs)}) — conferir extração. Valor do evento mantido.
          </RecWarn>
        ) : null}
      </Fsec>

      <Fsec icon={<ClipboardList size={14} aria-hidden />} titulo="Anotação (RDO / ATA)">
        <Anotacao tag={e.fonte} texto={e.descricao} />
      </Fsec>
    </>
  );
}

// ── Ficha PRAZO / retrabalho (sem ociosidade direta) ─────────────────────────────
function FichaPrazo({ e }: { e: PontualEvento }) {
  return (
    <>
      <Fsec icon={<CalendarDays size={14} aria-hidden />} titulo="Período e dias">
        <div className="pnt-rdo">
          {e.periodo ?? "—"} · impacto de <strong>prazo</strong> (deslocamento de cronograma).
        </div>
      </Fsec>

      <Fsec icon={<HardHat size={14} aria-hidden />} titulo="Equipe afetada">
        <div className="pnt-equip">
          <Eq label="MOD ocioso direto" v="≈ 0" />
          <Eq label="EQP ocioso direto" v="≈ 0" />
        </div>
      </Fsec>

      <Fsec icon={<Calculator size={14} aria-hidden />} titulo="Memória de cálculo">
        <div className="pnt-memo">
          Não há ociosidade direta a quantificar aqui. A mudança de projeto desloca o{" "}
          <strong>cronograma</strong> — o impacto é de <strong>prazo/prorrogação</strong> (tratado
          na análise de prazo e no BDI estendido), não de hora parada.
        </div>
      </Fsec>

      <Fsec icon={<ClipboardList size={14} aria-hidden />} titulo="Anotação (RDO / ATA)">
        <Anotacao tag={e.fonte} texto={e.descricao} />
      </Fsec>
    </>
  );
}

function Eq({ label, v, afet }: { label: string; v: string; afet?: boolean }) {
  return (
    <div className={`pnt-eq${afet ? " afet" : ""}`}>
      <span className="pnt-eq-l">{label}</span>
      <span className="pnt-eq-v">{v}</span>
    </div>
  );
}

// ── Aviso de dupla contagem ─────────────────────────────────────────────────────
function DuplaContagemWarn() {
  return (
    <section className="pnt-warn">
      <div className="pnt-warn-h">
        <TriangleAlert size={15} aria-hidden /> Atenção — dupla contagem com a D.4
      </div>
      <p>
        A <strong>D.4</strong> calcula a perda de produtividade <strong>macro</strong> (Total Cost /
        Milha); esta <strong>D.6</strong> calcula a perda <strong>por evento</strong>. As duas{" "}
        <strong>não se somam</strong> no claim — seriam o mesmo prejuízo duas vezes. No{" "}
        <strong>Gerador de Claim (D.10)</strong> escolhe-se: (1) D.4 como total + D.6 como dossiê de
        detalhe, ou (2) D.6 como total. A deduplicação é feita na D.10. Por isso os eventos ficam{" "}
        <strong>pendentes</strong> (R$ 0 somado).
      </p>
    </section>
  );
}

// ── Leitura IA ──────────────────────────────────────────────────────────────────
function IaLeitura({ v }: { v: PontuaisD6View }) {
  const pendente = v.params?.pendenteTotalRs ?? v.eventos.reduce((a, e) => a + (e.custoRs ?? 0), 0);
  const chuvaEvt = v.eventos.find((e) => tipoFicha(e) === "chuva") ?? null;
  const mesExc = v.chuvaMensal.find((m) => (m.excedente ?? 0) > 0) ?? null;
  const nEventos = v.eventos.length;
  return (
    <section className="pnt-ia">
      <header className="pnt-ia-h">
        <span className="pnt-ia-badge">IA</span>
        <span className="pnt-ia-t">Leitura da D.6</span>
      </header>
      <p>
        {nEventos} {nEventos === 1 ? "evento" : "eventos"} com ficha completa (período, equipe,
        memória de cálculo, RDO/ATA). A <strong>chuva</strong> é líquida da prevista
        {mesExc ? (
          <>
            {" "}
            — só <strong>{mesExc.mesLabel}</strong> teve excedente, daí {fmtBRL(chuvaEvt?.custoRs)}{" "}
            de ociosidade pleiteável
          </>
        ) : (
          " — só o excedente sobre a chuva prevista é pleiteável"
        )}
        . Os impedimentos usam equipe afetada por subtração; eventos de prazo entram como impacto de
        cronograma.
      </p>
      <p>
        Total documentado <strong>{fmtBRL(pendente)}</strong>, mantido como dossiê pendente (a perda
        já está no macro da D.4). A escolha macro × eventos acontece na D.10.
      </p>
    </section>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────────
function PntSkeleton() {
  return (
    <>
      <div className="pnt-kpis">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="block" className="pnt-sk-kpi" />
        ))}
      </div>
      <div className="pnt-evts">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="block" className="pnt-sk-evt" />
        ))}
      </div>
    </>
  );
}
