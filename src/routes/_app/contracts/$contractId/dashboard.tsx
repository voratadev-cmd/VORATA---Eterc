// Dashboard executivo POR OBRA (a "cabine") — a home de cada obra. Reúne, do dado REAL, o farol
// consolidado + os faróis por domínio (faturamento/prazo/desequilíbrio/recursos/produtividade), os
// riscos detectados e atalhos pros módulos. Backbone = useVisaoGeralView (mesma Camada B das telas).
// Distinto da Síntese (identidade do contrato) e do RMA Visão Geral (detalhe dentro do fluxo RMA):
// aqui é launchpad executivo. Honesto: obra sem dado normalizado → estado vazio, nunca número fake.
import { type ReactNode, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Clock,
  Gauge,
  LayoutGrid,
  type LucideIcon,
  MessageSquareText,
  Scale,
  TrendingDown,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Button, Card, EmptyState, I, PageHeader, Skeleton } from "@/components/ds";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import type { FarolLevel } from "@/lib/mocks/contracts";
import { statusMarco } from "@/lib/rma/marcoFarol";
import { useObras } from "@/lib/hooks/useObras";
import { useVisaoGeralView } from "@/lib/hooks/useVisaoGeralView";
import "./dashboard.css";

export const Route = createFileRoute("/_app/contracts/$contractId/dashboard")({
  component: DashboardObra,
  head: () => ({ meta: [{ title: "Dashboard da Obra — RDM IA" }] }),
});

const asFarol = (n: string): FarolLevel => (n in farolToBadge ? (n as FarolLevel) : "observacao");

function DashboardObra() {
  const { contractId } = Route.useParams();
  const { data: obras } = useObras();
  const obraNome = obras?.find((o) => o.id === contractId)?.nome_interno ?? "Obra";
  const { data, isLoading, isError, refetch } = useVisaoGeralView(contractId);

  if (isError) {
    return (
      <>
        <PageHeader title={obraNome} subtitle="Dashboard executivo" />
        <EmptyState
          framed
          icon={<TriangleAlert size={44} />}
          title="Não foi possível carregar o dashboard"
          text="Falha ao ler os dados da obra."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title={obraNome} subtitle="Dashboard executivo · carregando…" />
        <div className="dob-kpis">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="dob-skel-kpi" />
          ))}
        </div>
        <Skeleton className="dob-skel-sintese" />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title={obraNome} subtitle="Dashboard executivo" />
        <EmptyState
          framed
          icon={<Gauge size={44} />}
          title="Dashboard aguardando processamento"
          text="Assim que o pipeline normalizar os documentos desta obra, o farol consolidado, os indicadores e os riscos da IA aparecem aqui."
          hint="Sem dados normalizados ainda"
          action={
            <Link to="/contracts/$contractId" params={{ contractId }}>
              <Button variant="outline">Abrir Síntese do Contrato</Button>
            </Link>
          }
        />
      </>
    );
  }

  const bm = data.bm;
  const situacao = asFarol(bm.situacao);

  // contagem de domínios por farol — o hero não pode dizer só "observação" quando há domínios críticos.
  const contagem: Record<string, number> = {
    critico: 0,
    risco: 0,
    observacao: 0,
    conforme: 0,
    pendente: 0,
  };
  const blocosByKey = bm as unknown as Record<
    string,
    { pendente?: boolean; nivel: string } | undefined
  >;
  const criticos: string[] = [];
  for (const k of ["faturamento", "prazo", "desequilibrio", "recursos", "produtividade"]) {
    const b = blocosByKey[`bloco${cap(k)}`];
    if (!b) continue;
    if (b.pendente) {
      contagem.pendente++;
    } else {
      const n = asFarol(b.nivel);
      contagem[n]++;
      if (n === "critico") criticos.push(KPI_META[k].titulo);
    }
  }
  // tom/veredito do hero = o PIOR sinal (não o consolidado "observação", que cala os críticos).
  const pior: FarolLevel =
    contagem.critico > 0
      ? "critico"
      : contagem.risco > 0
        ? "risco"
        : contagem.observacao > 0
          ? "observacao"
          : "conforme";

  return (
    <>
      <PageHeader
        title={obraNome}
        subtitle={`Dashboard executivo · BM ${data.bmLabel}`}
        actions={
          <Link to="/contracts/$contractId/rma" params={{ contractId }}>
            <Button size="sm" variant="outline">
              Abrir RMA <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />

      <FarolGrid contractId={contractId} bm={bm} />

      <SinteseStrip
        pior={pior}
        consolidado={situacao}
        contagem={contagem}
        criticos={criticos}
        coverage={bm.situacaoLabel}
      />

      <ChartsSection bm={bm} painel={data.painelDeseq} />

      <div className="dob-grid">
        <RiscosPanel contractId={contractId} data={data} />
        <AtalhosPanel contractId={contractId} />
      </div>
    </>
  );
}

// ── Síntese · faixa compacta de saúde (quieta, abaixo dos faróis) ──────

const listar = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;

function SinteseStrip({
  pior,
  consolidado,
  contagem,
  criticos,
  coverage,
}: {
  pior: FarolLevel;
  consolidado: FarolLevel;
  contagem: Record<string, number>;
  criticos: string[];
  coverage: string;
}) {
  const verdict =
    contagem.critico > 0
      ? `${contagem.critico} ${contagem.critico === 1 ? "frente" : "frentes"} em situação crítica`
      : contagem.risco > 0
        ? `${contagem.risco} ${contagem.risco === 1 ? "frente" : "frentes"} em risco`
        : contagem.observacao > 0
          ? "sob observação"
          : "sob controle";
  const detalhe = criticos.length
    ? `${listar(criticos)} ${criticos.length === 1 ? "exige" : "exigem"} atenção`
    : null;
  return (
    <div className={`dob-sintese tom-${pior}`} role="status">
      <span className="dob-sintese-dot" aria-hidden />
      <p className="dob-sintese-txt">
        <span className="dob-sintese-label">Saúde da obra:</span>{" "}
        <strong className="dob-sintese-verdict">{verdict}</strong>
        {detalhe ? <span className="dob-sintese-detalhe"> · {detalhe}</span> : null}
      </p>
      <span className="dob-sintese-cov">
        consolidado: {farolLabel[consolidado].toLowerCase()} · {coverage.toLowerCase()}
      </span>
    </div>
  );
}

// ── Grid de KPIs com farol (5 blocos) · clicáveis ─────────────────────

const KPI_META: Record<string, { titulo: string; icon: LucideIcon; to: string }> = {
  faturamento: {
    titulo: "Faturamento",
    icon: Wallet,
    to: "/contracts/$contractId/rma/faturamento",
  },
  prazo: { titulo: "Prazo", icon: Clock, to: "/contracts/$contractId/rma/prazo" },
  desequilibrio: {
    titulo: "Desequilíbrio",
    icon: TrendingDown,
    to: "/contracts/$contractId/desequilibrio",
  },
  recursos: { titulo: "Recursos", icon: Users, to: "/contracts/$contractId/rma/recursos" },
  produtividade: {
    titulo: "Produtividade",
    icon: Activity,
    to: "/contracts/$contractId/rma/produtividade",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FarolGrid({ contractId, bm }: { contractId: string; bm: any }) {
  const ordem = ["faturamento", "prazo", "desequilibrio", "recursos", "produtividade"];
  // ordena por severidade (crítico → risco → observação → conforme → pendente) — o diretor vê o pior 1º.
  const rankBloco = (b: { pendente?: boolean; nivel: string }) =>
    b.pendente ? 5 : RANK[asFarol(b.nivel)];
  const blocos = ordem
    .map((key) => ({ key, bloco: bm[`bloco${cap(key)}`] }))
    .filter((b) => b.bloco)
    .sort((a, b) => rankBloco(a.bloco) - rankBloco(b.bloco));
  return (
    <div className="dob-kpis">
      {blocos.map(({ key, bloco }) => {
        const meta = KPI_META[key];
        const Icon = meta.icon;
        const nivel = bloco.pendente ? "pendente" : asFarol(bloco.nivel);
        const farolTxt = bloco.pendente ? "pendente" : farolLabel[asFarol(bloco.nivel)];
        return (
          <Link
            key={key}
            to={meta.to}
            params={{ contractId }}
            className={`dob-kpi tom-${nivel}`}
            aria-label={`${meta.titulo}: ${bloco.valor} · ${farolTxt}. Ver detalhe.`}
          >
            <div className="dob-kpi-top">
              <span className="dob-kpi-ic" aria-hidden>
                <Icon size={16} />
              </span>
              <span className="dob-kpi-titulo">{meta.titulo}</span>
              <span className="dob-kpi-farol">
                {bloco.pendente ? "Pendente" : farolLabel[asFarol(bloco.nivel)]}
              </span>
            </div>
            <div className="dob-kpi-valor">{bloco.valor}</div>
            {bloco.descricao ? <div className="dob-kpi-desc">{bloco.descricao}</div> : null}
            <span className="dob-kpi-go" aria-hidden>
              ver detalhe <ArrowRight size={13} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Riscos & Alertas da IA (derivados do dado real) ───────────────────

type Risco = { titulo: string; detalhe: string; nivel: FarolLevel; to: string };

function RiscosPanel({
  contractId,
  data,
}: {
  contractId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}) {
  const riscos = useMemo<Risco[]>(() => {
    const out: Risco[] = [];
    const bm = data.bm;
    // 1) domínios em risco/crítico (faróis já calculados)
    for (const key of ["faturamento", "prazo", "desequilibrio", "recursos", "produtividade"]) {
      const b = bm[`bloco${cap(key)}`];
      if (!b || b.pendente) continue;
      const nivel = asFarol(b.nivel);
      if (nivel === "risco" || nivel === "critico") {
        out.push({
          titulo: `${KPI_META[key].titulo}: ${b.valor}`,
          detalhe: b.descricao || b.nota || "",
          nivel,
          to: KPI_META[key].to,
        });
      }
    }
    // 2) marcos contratuais em risco/atrasados (mesma derivação da C.5)
    const marcos = (data.marcos ?? []) as Array<{
      categoria: string;
      trecho: string | null;
      dataLimite: string | null;
      pctConcluido: number | null;
    }>;
    const emRisco = marcos.filter((m) => {
      const s = statusMarco(m.dataLimite, data.corteISO, m.pctConcluido);
      return s === "em-risco" || s === "atrasado";
    });
    if (emRisco.length > 0) {
      const temAtraso = emRisco.some(
        (m) => statusMarco(m.dataLimite, data.corteISO, m.pctConcluido) === "atrasado",
      );
      out.push({
        titulo: `${emRisco.length} marco${emRisco.length === 1 ? "" : "s"} contratual${emRisco.length === 1 ? "" : "is"} em risco`,
        detalhe: emRisco
          .slice(0, 3)
          .map((m) => [m.categoria, m.trecho].filter(Boolean).join(" "))
          .join(" · "),
        nivel: temAtraso ? "critico" : "risco",
        to: "/contracts/$contractId/rma/prazo",
      });
    }
    return out.sort((a, b) => RANK[a.nivel] - RANK[b.nivel]);
  }, [data]);

  return (
    <Card className="dob-card">
      <div className="dob-card-head">
        <div>
          <h3 className="dob-card-title">Riscos & alertas</h3>
          <span className="dob-card-sub">Detectados pela IA no BM de corte.</span>
        </div>
        {riscos.length > 0 ? (
          <Badge tone="danger">
            {riscos.length} {riscos.length === 1 ? "alerta" : "alertas"}
          </Badge>
        ) : null}
      </div>
      {riscos.length === 0 ? (
        <div className="dob-empty-inline">
          <span className="dob-empty-ic ok" aria-hidden>
            {I.check({ size: 18 })}
          </span>
          Nenhum risco em aberto neste corte. Os domínios avaliados estão conformes ou em
          observação.
        </div>
      ) : (
        <ul className="dob-riscos">
          {riscos.map((r, i) => (
            <li key={i}>
              <Link to={r.to} params={{ contractId }} className={`dob-risco tom-${r.nivel}`}>
                <span className="dob-risco-dot" aria-hidden />
                <span className="dob-risco-body">
                  <span className="dob-risco-titulo">{r.titulo}</span>
                  {r.detalhe ? <span className="dob-risco-detalhe">{r.detalhe}</span> : null}
                </span>
                <ArrowRight size={15} className="dob-risco-go" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Atalhos rápidos ───────────────────────────────────────────────────

const ATALHOS: Array<{ titulo: string; sub: string; icon: LucideIcon; to: string; key?: boolean }> =
  [
    {
      titulo: "RMA Mensal",
      sub: "Relatório de acompanhamento",
      icon: LayoutGrid,
      to: "/contracts/$contractId/rma",
    },
    {
      titulo: "Painel de Desequilíbrio",
      sub: "D.0 e as parcelas",
      icon: TrendingDown,
      to: "/contracts/$contractId/desequilibrio",
    },
    {
      titulo: "Gerador de Claim",
      sub: "Monta o pleito (.docx)",
      icon: Scale,
      to: "/contracts/$contractId/desequilibrio/gerador-claim",
      key: true,
    },
    {
      titulo: "Chat · Adm Contratual IA",
      sub: "Pergunte sobre os dados",
      icon: MessageSquareText,
      to: "/contracts/$contractId/chat",
      key: true,
    },
  ];

function AtalhosPanel({ contractId }: { contractId: string }) {
  return (
    <Card className="dob-card">
      <div className="dob-card-head">
        <div>
          <h3 className="dob-card-title">Atalhos</h3>
          <span className="dob-card-sub">Ir direto ao que importa.</span>
        </div>
      </div>
      <div className="dob-atalhos">
        {ATALHOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.titulo}
              to={a.to}
              params={{ contractId }}
              className={`dob-atalho${a.key ? " key" : ""}`}
            >
              <span className="dob-atalho-ic" aria-hidden>
                <Icon size={18} />
              </span>
              <span className="dob-atalho-body">
                <span className="dob-atalho-titulo">{a.titulo}</span>
                <span className="dob-atalho-sub">{a.sub}</span>
              </span>
              <ArrowRight size={15} className="dob-atalho-go" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

// ── Gráficos premium (Recharts · tokens-only) ─────────────────────────

const TT = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 11,
} as const;
const miFromMi = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
const miFromReais = (v: number) =>
  `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
const miTick = (v: number) =>
  v >= 1000
    ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`
    : `${Math.round(v)}`;

function ChartCard({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <Card className="dob-chart" role="group" aria-label={sub ? `${titulo} · ${sub}` : titulo}>
      <div className="dob-chart-head">
        <span className="dob-chart-titulo">{titulo}</span>
        {sub ? <span className="dob-chart-sub">{sub}</span> : null}
      </div>
      {children}
    </Card>
  );
}
const ChartPendente = ({ texto }: { texto: string }) => (
  <div className="dob-chart-pendente">{texto}</div>
);
function ChartLegend({ itens }: { itens: Array<{ label: string; cls: string }> }) {
  return (
    <div className="dob-chart-legend">
      {itens.map((it) => (
        <span key={it.label} className={`dob-legend-pill ${it.cls}`}>
          {it.label}
        </span>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartsSection({ bm, painel }: { bm: any; painel: any }) {
  return (
    <>
      <div className="dob-charts dob-charts-a">
        <CurvaSChart bm={bm} />
        <PrazoDonut bm={bm} />
      </div>
      <div className="dob-charts dob-charts-b">
        <DesequilibrioChart painel={painel} />
        <RecursosChart bm={bm} />
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurvaSChart({ bm }: { bm: any }) {
  const curva = (bm.faturamento?.curvaS ?? []) as Array<{
    bm: string;
    contratado: number;
    real: number | null;
    projecao: number | null;
  }>;
  const dados = curva.map((p) => ({
    bm: p.bm.replace("BM-", ""),
    contratado: p.contratado,
    real: p.real,
    projecao: p.projecao,
  }));
  const temProj = dados.some((d) => d.projecao != null);
  const ultimoReal = [...dados].reverse().find((d) => d.real != null) ?? null;
  const corte = ultimoReal?.bm ?? null;
  const realEnd = ultimoReal?.real ?? null;
  const xticks = (() => {
    if (!dados.length) return [] as string[];
    const step = Math.max(1, Math.ceil((dados.length - 1) / 5));
    const idx: number[] = [];
    for (let i = 0; i < dados.length; i += step) idx.push(i);
    if (idx[idx.length - 1] !== dados.length - 1) idx.push(dados.length - 1);
    return idx.map((i) => dados[i].bm);
  })();
  return (
    <ChartCard
      titulo="Curva de Faturamento"
      sub={`acumulado · contratado × real${temProj ? " × projeção" : ""} (R$ mi)${corte ? ` · BM ${corte}` : ""}`}
    >
      {dados.length === 0 ? (
        <ChartPendente texto="Curva de faturamento ainda não normalizada." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={232}>
            <ComposedChart data={dados} margin={{ top: 8, right: 18, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id="dobFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis
                dataKey="bm"
                ticks={xticks}
                tick={{ fill: "var(--text-3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickMargin={6}
              />
              <YAxis
                width={38}
                tick={{ fill: "var(--text-3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickCount={4}
                tickFormatter={miTick}
              />
              <Tooltip
                contentStyle={TT}
                labelStyle={{ fontWeight: 600 }}
                formatter={(v: number | string) =>
                  typeof v === "number" ? miFromMi(v) : (v ?? "—")
                }
              />
              {corte != null && (
                <ReferenceLine x={corte} stroke="var(--border-strong)" strokeDasharray="3 3" />
              )}
              <Area
                type="monotone"
                dataKey="contratado"
                name="Contratado"
                stroke="var(--text-2)"
                strokeWidth={1.75}
                fill="url(#dobFat)"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Real"
                stroke="var(--brand)"
                strokeWidth={2.5}
                dot={{ r: 2, fill: "var(--brand)", strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              {temProj && (
                <Line
                  type="monotone"
                  dataKey="projecao"
                  name="Projeção"
                  stroke="var(--brand)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {corte != null && realEnd != null && (
                <ReferenceDot
                  x={corte}
                  y={realEnd}
                  r={4}
                  fill="var(--brand)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isFront
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <ChartLegend
            itens={[
              { label: "Contratado", cls: "c" },
              { label: "Real", cls: "r" },
              ...(temProj ? [{ label: "Projeção", cls: "p" }] : []),
            ]}
          />
        </>
      )}
    </ChartCard>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PrazoDonut({ bm }: { bm: any }) {
  const p = bm.prazo;
  const decorrido = Number(p?.decorridoDias ?? 0);
  const restante = Math.max(Number(p?.restantesDias ?? 0), 0);
  const pct = Number(p?.decorridoPct ?? 0);
  const dados = [
    { name: "Decorrido", value: decorrido, fill: "var(--brand)" },
    { name: "Restante", value: restante, fill: "var(--surface-3)" },
  ];
  const semDado = decorrido + restante <= 0;
  return (
    <ChartCard
      titulo="Prazo contratual"
      sub={
        p?.prazoContratualDias
          ? `tempo decorrido (calendário) · ${p.prazoContratualDias} dias contratuais`
          : "tempo decorrido (calendário)"
      }
    >
      {semDado ? (
        <ChartPendente texto="Prazo ainda não normalizado." />
      ) : (
        <>
          <div className="dob-donut">
            <ResponsiveContainer width="100%" height={188}>
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {dados.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v: number) => `${v} dias`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="dob-donut-center">
              <span className="dob-donut-pct">
                {pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
              </span>
              <span className="dob-donut-label">decorrido</span>
            </div>
          </div>
          <ChartLegend
            itens={[
              { label: `${decorrido} d decorridos`, cls: "r" },
              { label: `${restante} d restantes`, cls: "c" },
            ]}
          />
        </>
      )}
    </ChartCard>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DesequilibrioChart({ painel }: { painel: any }) {
  const total = Number(painel?.resumo?.totalRs ?? 0);
  const comp = ((painel?.composicao ?? []) as Array<{ categoria: string; valorRs: number | null }>)
    .filter((c) => (c.valorRs ?? 0) > 0)
    .sort((a, b) => (b.valorRs ?? 0) - (a.valorRs ?? 0))
    .map((c) => ({ cat: c.categoria, valor: c.valorRs ?? 0 }));
  return (
    <ChartCard
      titulo="Desequilíbrio por categoria"
      sub={total > 0 ? `Painel D.0 · total ${miFromReais(total)}` : "Painel D.0"}
    >
      {comp.length === 0 ? (
        <ChartPendente texto="Desequilíbrio ainda não quantificado (M3)." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.min(Math.max(150, comp.length * 42), 360)}>
          <BarChart
            data={comp}
            layout="vertical"
            margin={{ top: 4, right: 64, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="cat"
              width={150}
              tick={{ fill: "var(--text-2)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={TT}
              formatter={(v: number) => miFromReais(v)}
              cursor={{ fill: "var(--surface-2)" }}
            />
            <Bar
              dataKey="valor"
              radius={[0, 4, 4, 0]}
              fill="var(--brand)"
              maxBarSize={22}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="valor"
                position="right"
                formatter={(v: number) => miFromReais(v)}
                style={{ fill: "var(--text-3)", fontSize: 10 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RecursosChart({ bm }: { bm: any }) {
  const grupos = (["MOI", "MOD", "EQP"] as const)
    .map((tipo) => {
      const g = bm.recursos?.porGrupo?.[tipo];
      const ult = g?.curvaAcumulada?.[g.curvaAcumulada.length - 1];
      return { tipo, contratado: Number(ult?.contratado ?? 0), real: Number(ult?.real ?? 0) };
    })
    .filter((g) => g.contratado > 0 || g.real > 0);
  return (
    <ChartCard titulo="Alocação de recursos" sub="contratado × real acumulado · por grupo">
      {grupos.length === 0 ? (
        <ChartPendente texto="Histograma de recursos não normalizado." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={grupos}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
              barCategoryGap="22%"
              barGap={3}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="tipo"
                tick={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip contentStyle={TT} cursor={{ fill: "var(--surface-2)" }} />
              <Bar
                dataKey="contratado"
                name="Contratado"
                fill="var(--text-2)"
                radius={[0, 3, 3, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="real"
                name="Real"
                fill="var(--brand)"
                radius={[0, 3, 3, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend
            itens={[
              { label: "Contratado", cls: "c" },
              { label: "Real", cls: "r" },
            ]}
          />
        </>
      )}
    </ChartCard>
  );
}

const RANK: Record<FarolLevel, number> = { critico: 0, risco: 1, observacao: 2, conforme: 3 };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
