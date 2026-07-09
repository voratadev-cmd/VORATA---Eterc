// Aba "Aderência das Curvas" (RMA · C.8). Quatro curvas acumuladas em R$: Contratado ≥ Liberado ≥
// Capacidade ≥ Executado — comparadas, revelam de quem é a responsabilidade por um desvio. Single-page,
// fiel ao mockup C08_Curvas. Dado dos read-models TIPADOS (v46): obra_curvas_c8 (headline no BM) +
// obra_curvas_serie_mes (46 meses) + obra_curvas_frentes (leitura por frente). A liberação por km
// (C.14) é da tela do Mapa, não vive mais aqui.

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, TriangleAlert } from "lucide-react";
import {
  Badge,
  Card,
  ChartTooltip,
  type ChartTooltipEntry,
  EmptyState,
  ErroCard,
  FilterChip,
  I,
  Segmented,
  Skeleton,
} from "@/components/ds";
import { ColPag, ColToolbar, ColVazio, useColecao } from "@/lib/rma/colecao";
import { useCurvasC8, useCurvasFrentes } from "@/lib/hooks/useCurvasC8";
import { useCurvasSerieMes } from "@/lib/hooks/useCurvasSerieMes";
import type { CurvasSerie } from "@/lib/supabase/curvasSerieMes";
import "./curvas.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/curvas")({
  component: CurvasAba,
});

// ── formatadores ───────────────────────────────────────────────────
const fmtBRL = (v: number | null) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
// "R$ 28,1 mi" — valor cheio fica no title/tooltip
const fmtMi = (v: number | null) =>
  v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
    : "—";
const fmtM = (v: number) =>
  (v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pct0 = (v: number) => `${Math.round(v)}%`;

// cores das 4 curvas — tokens semânticos do DS (verde=liberado, âmbar=capacidade, azul=executado,
// neutro=contratado). Mesma paleta em KPI, gráfico, gaps e tabelas — leitura única.
const COR = {
  contratado: "var(--text-3)",
  liberado: "var(--success)",
  capacidade: "var(--warning)",
  executado: "var(--info)",
} as const;

function CurvasAba() {
  const { contractId } = Route.useParams();
  const { data: c8, isLoading: l1, isError: e1, refetch: r1 } = useCurvasC8(contractId);
  const { data: frentes, isLoading: l2, isError: e2, refetch: r2 } = useCurvasFrentes(contractId);
  const { data: serie, isLoading: l3, isError: e3, refetch: r3 } = useCurvasSerieMes(contractId);

  if (l1 || l2 || l3) {
    // skeleton com a forma real da página: KPIs → gráfico → 3 gaps → 2 tabelas
    return (
      <main className="cur-main">
        <div className="cur-kpis-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 92 }} />
          ))}
        </div>
        <Skeleton style={{ height: 420 }} />
        <div className="cur-gapgrid">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 132 }} />
          ))}
        </div>
        <Skeleton style={{ height: 240 }} />
        <Skeleton style={{ height: 170 }} />
      </main>
    );
  }
  if (e1 || e3) {
    // ERRO ≠ pendência: falha de leitura fala alto e oferece retry (nunca vira "aguardando")
    return (
      <main className="cur-main">
        <ErroCard
          titulo="Não foi possível carregar as curvas (C.8)"
          mensagem="Erro ao ler os dados normalizados desta obra. Tente recarregar."
          onRetry={() => {
            if (e1) void r1();
            if (e3) void r3();
          }}
        />
      </main>
    );
  }
  if (!c8 || !serie) {
    return (
      <main className="cur-main">
        <Card>
          <EmptyState
            framed
            icon={I.trending({ size: 42 })}
            title="Aderência das Curvas ainda não normalizada"
            text="As 4 curvas (Contratado · Liberado · Capacidade · Executado) e a leitura por frente aparecem aqui quando a seção C.8 for normalizada."
            hint={<Badge tone="info">Aguardando normalização</Badge>}
          />
        </Card>
      </main>
    );
  }

  // headline acumulado no BM corrente
  const contratado = c8.contratadoAcumCorte ?? 0;
  const liberado = c8.liberadoAcum ?? 0;
  const capacidade = c8.capacidadeAcum ?? 0;
  const executado = c8.executadoAcum ?? 0;
  const bm = serie.bmCorrente;
  const bmLabel = serie.meses.find((m) => m.mesNum === bm)?.periodoLabel ?? null;
  const bmTag = bm != null ? `BM ${String(bm).padStart(2, "0")}` : "BM";

  // os 3 gaps (cadeia Contratado → Liberado → Capacidade → Executado)
  const gapCL = contratado - liberado; // Contratante (não liberou)
  const gapLCap = liberado - capacidade; // Contratada (falta equipe)
  const gapCapE = capacidade - executado; // produtividade / execução

  // destaque do gap dominante: usa o maiorGapRs CARREGADO do read-model (não re-deriva) com
  // tolerância de comparação R$ (0,1% do contratado, piso 1k) — ruído de arredondamento não
  // elege herói errado. Empate dentro da tolerância → destaca só o primeiro da cadeia.
  const TOL_MAIOR = Math.max(contratado * 0.001, 1000);
  const bateMaior = (v: number) =>
    c8.maiorGapRs != null && c8.maiorGapRs > TOL_MAIOR && Math.abs(v - c8.maiorGapRs) <= TOL_MAIOR;
  const flagsMaior = [gapCL, gapLCap, gapCapE].map(bateMaior);
  const idxMaior = flagsMaior.indexOf(true);
  const ehMaior = (i: number) => i === idxMaior;

  // leitura por frente: só as frentes FÍSICAS (com aderência por trecho). Adm Local e Insumos são
  // transversais (sem trecho físico) — fora desta tabela, como na fonte v46. possível = contratado
  // (impedido=0 no BM), real = contratado − gap dominante. Responsável e R$/HH vêm prontos do
  // read-model (obra_curvas_frentes) — null = pendente (veredito só quando há executado medido).
  const fisicas: FrenteLinha[] = (frentes ?? [])
    .filter((f) => !/administra|insumo/i.test(f.frente))
    .map((f) => {
      const contr = f.contratadoRs ?? 0;
      const possivel = contr; // sem impedimento registrado no BM → possível = contratado
      const real = contr - (f.gapDominanteRs ?? 0);
      return {
        ordem: f.ordem,
        nome: nomeFrenteCurto(f.frente),
        contratado: contr,
        possivel,
        real,
        resp: f.responsabilidade,
        rsHh: f.produtividadeRsHh,
      };
    });

  return (
    <main className="cur-main">
      <header className="cur-head">
        <div>
          <h2 className="cur-titulo">Aderência das Curvas · C.8</h2>
          <p className="cur-sub">
            Quatro curvas acumuladas em R$ ao longo do tempo — <strong>Contratado</strong>,{" "}
            <strong>Liberado</strong>, <strong>Capacidade</strong> e <strong>Executado</strong>.
            Comparadas, revelam de quem é a responsabilidade por um desvio. A curva Liberado vem dos
            impedimentos do Mapa (C.14).
          </p>
        </div>
      </header>

      <div className="cur-warn">
        <TriangleAlert size={14} aria-hidden style={{ verticalAlign: "-2px" }} />{" "}
        <strong>Corte no {bmTag}:</strong> Contratado e Liberado seguem como previsão; Capacidade e
        Executado têm dado real só até o BM ({bmLabel ?? "corrente"}) — por isso suas linhas param
        no mês corrente.
      </div>

      <div className="cur-sec">As 4 curvas — posição acumulada no BM ({bmLabel ?? "corrente"})</div>
      <div className="cur-kpis-4">
        <CurvaKpi
          cor={COR.contratado}
          label="Contratado"
          valor={contratado}
          sub={`previsto até ${bmLabel ?? "o BM"}`}
        />
        <CurvaKpi
          cor={COR.liberado}
          label="Liberado"
          valor={liberado}
          sub={
            // % vs contratado já vem pronto do read-model (liberacaoPct) — quantifica o sub
            c8.liberacaoPct != null
              ? `${pct0(c8.liberacaoPct)} do contratado · ${liberado >= contratado ? "tudo liberado" : "abaixo do contratado"}`
              : liberado >= contratado
                ? "= contratado (tudo liberado)"
                : "abaixo do contratado"
          }
        />
        <CurvaKpi
          cor={COR.capacidade}
          label="Capacidade"
          valor={capacidade}
          sub={
            c8.capacidadePct != null
              ? `${pct0(c8.capacidadePct)} do contratado · teto da equipe alocada`
              : "teto da equipe alocada"
          }
        />
        <CurvaKpi
          cor={COR.executado}
          label="Executado"
          valor={executado}
          sub={
            c8.alocadoPct != null
              ? `${pct0(c8.alocadoPct)} do contratado · realizado (RDO)`
              : "realizado (RDO)"
          }
        />
      </div>

      <Card className="cur-chart-card">
        <CurvasChart serie={serie} />
      </Card>

      <div className="cur-sec">Diagnóstico de responsabilidade — os 3 gaps</div>
      <div className="cur-gapgrid">
        <GapCard
          variante="contratante"
          num="1"
          titulo="Contratado → Liberado"
          valor={gapCL}
          maior={ehMaior(0)}
          resp="Responsabilidade: CONTRATANTE"
          desc={
            gapCL > 0
              ? `${fmtMi(gapCL)} previstos mas não liberados — frente impedida. Base de pleito de prorrogação.`
              : "Tudo que era previsto está liberado. Sem gargalo de liberação."
          }
        />
        <GapCard
          variante="contratada"
          num="2"
          titulo="Liberado → Capacidade"
          valor={gapLCap}
          maior={ehMaior(1)}
          resp="Responsabilidade: CONTRATADA"
          desc={
            gapLCap > 0
              ? `${fmtMi(gapLCap)} de frente liberada sem equipe alocada para produzir. Falta mobilização.`
              : "A capacidade cobre o liberado."
          }
        />
        <GapCard
          variante="exec"
          num="3"
          titulo="Capacidade → Executado"
          valor={gapCapE}
          maior={ehMaior(2)}
          resp="Produtividade / execução"
          desc={
            gapCapE > 0
              ? `${fmtMi(gapCapE)} entre o que a equipe poderia e o que produziu. Perda de produtividade.`
              : "Executado no teto da capacidade."
          }
        />
      </div>

      <div className="cur-sec">Leitura por frente ({bmTag} atual)</div>
      <Card>
        {e2 ? (
          <ErroCard
            framed={false}
            titulo="Não foi possível carregar as frentes"
            mensagem="Falha ao ler a matriz por frente (C.8)."
            onRetry={() => void r2()}
          />
        ) : fisicas.length > 0 ? (
          <FrenteLeitura linhas={fisicas} />
        ) : (
          <EmptyState
            title="Leitura por frente pendente"
            text="As frentes físicas com aderência por trecho aparecem aqui quando a matriz C.8 for normalizada."
          />
        )}
        <p className="cur-note">
          <strong>Possível</strong> = o que daria para produzir já descontados os impedimentos (do
          Mapa C.14). <strong>Real</strong> = executado no RDO. Onde Real ≪ Possível com a frente
          liberada, o gargalo é interno (falta equipe ou produtividade); onde Possível ≪ Contratado,
          o gargalo é a liberação (Contratante).
        </p>
      </Card>

      <div className="cur-sec">Responsabilidade pelo desvio (Contratado − Executado)</div>
      <Card>
        <RespDesvio contratado={contratado} liberado={liberado} executado={executado} />
        <p className="cur-note">
          <strong>Como é calculado:</strong> o desvio total é Contratado − Executado (o que deixou
          de ser produzido). A parte da <strong>Contratante</strong> é Contratado − Liberado (frente
          que ela não desimpediu). A parte da <strong>Contratada</strong> é Liberado − Executado
          (frente liberada que ela não produziu). Hoje, sem impedimentos registrados, 100% é da
          Contratada — mas ao registrar impedimentos no Mapa (C.14), a parte da Contratante sobe
          automaticamente.
        </p>
      </Card>

      <Diagnostico
        idxMaior={idxMaior}
        contratado={contratado}
        liberado={liberado}
        capacidade={capacidade}
        executado={executado}
      />
    </main>
  );
}

// ── KPI de curva (dot da cor + valor em mi) ────────────────────────
function CurvaKpi({
  cor,
  label,
  valor,
  sub,
}: {
  cor: string;
  label: string;
  valor: number;
  sub: string;
}) {
  return (
    <div className="cur-kpi">
      <div className="cur-kpi-label">
        <span className="cur-kpi-dot" style={{ background: cor }} />
        {label}
      </div>
      <div className="cur-kpi-valor tabular" title={fmtBRL(valor)}>
        {fmtM(valor)} <span className="cur-kpi-unit">mi</span>
      </div>
      <div className="cur-kpi-sub">{sub}</div>
    </div>
  );
}

// ── card de gap (tinta semântica · sem tarja de borda) ─────────────
// `maior` destaca o card do maiorGapRs carregado: borda/sombra NEUTRAS (color-mix c/ --text)
// + Badge — sem tingir pelo responsável (danger=Contratante criaria um 3º eixo semântico
// além da paleta das curvas e do farol).
function GapCard({
  variante,
  num,
  titulo,
  valor,
  maior,
  resp,
  desc,
}: {
  variante: "contratante" | "contratada" | "exec";
  num: string;
  titulo: string;
  valor: number;
  maior?: boolean;
  resp: string;
  desc: string;
}) {
  const temGap = valor > 0;
  return (
    <div className={`cur-gap cur-gap-${variante}${maior ? " cur-gap-maior" : ""}`}>
      <div className="cur-gap-top">
        <span className="cur-gap-num">{num}</span>
        <span className="cur-gap-titulo">{titulo}</span>
        {maior ? (
          <Badge tone="neutral" className="cur-gap-maior-badge">
            Maior gap
          </Badge>
        ) : null}
      </div>
      <div className={`cur-gap-valor tabular${temGap ? "" : " cur-gap-zero"}`}>
        {temGap ? fmtMi(valor) : "sem gap"}
      </div>
      <div className="cur-gap-resp">
        <ChevronRight size={12} aria-hidden style={{ verticalAlign: "-2px" }} /> {resp}
      </div>
      <div className="cur-gap-desc">{desc}</div>
    </div>
  );
}

// ── tabela: leitura por frente ─────────────────────────────────────
type FrenteLinha = {
  ordem: number;
  nome: string;
  contratado: number;
  possivel: number;
  real: number;
  /** veredito preliminar do read-model — null = pendente (sem executado medido). */
  resp: string | null;
  /** produtividade contratual (R$/HH) — null = pendente. */
  rsHh: number | null;
};

const aderenciaFrente = (f: FrenteLinha) => (f.possivel > 0 ? (f.real / f.possivel) * 100 : 0);

// Badge do responsável — mesmos tons da tabela RespDesvio (danger=Contratante · warning=Contratada).
// Texto livre da fonte (ex.: "Contratada (subdim.)"): limpa marcador glifo e mantém o resto.
function RespFrenteCell({ resp }: { resp: string | null }) {
  const txt = resp?.replace(/^[^\p{L}\p{N}]+/u, "").trim() ?? "";
  if (!txt) {
    return (
      <span className="cur-pendente" title="Pendente — veredito sai quando houver executado medido">
        —
      </span>
    );
  }
  const tone = /contratante/i.test(txt)
    ? ("danger" as const)
    : /contratada/i.test(txt)
      ? ("warning" as const)
      : ("neutral" as const);
  return (
    <span className="cur-cell-resp">
      <Badge tone={tone} title={txt}>
        {txt}
      </Badge>
    </span>
  );
}

function FrenteLeitura({ linhas }: { linhas: FrenteLinha[] }) {
  // TOTAL fixo no rodapé, calculado sobre TODAS as frentes físicas — fora da busca/ordenação
  const tot: FrenteLinha = {
    ordem: -1,
    nome: "TOTAL",
    contratado: linhas.reduce((s, f) => s + f.contratado, 0),
    possivel: linhas.reduce((s, f) => s + f.possivel, 0),
    real: linhas.reduce((s, f) => s + f.real, 0),
    resp: null,
    rsHh: null,
  };
  const col = useColecao(linhas, {
    busca: (f) => `${f.nome} ${f.resp ?? ""}`,
    ordenacoes: [
      { value: "fonte", label: "Ordem da fonte", cmp: (a, b) => a.ordem - b.ordem },
      {
        value: "ader",
        label: "Pior aderência",
        cmp: (a, b) => aderenciaFrente(a) - aderenciaFrente(b),
      },
      {
        value: "contratado",
        label: "Maior contratado",
        cmp: (a, b) => b.contratado - a.contratado,
      },
    ],
    perPage: 12,
  });
  const cor = (ad: number) =>
    ad >= 80 ? "var(--success)" : ad >= 40 ? "var(--warning)" : "var(--danger)";

  const renderRow = (f: FrenteLinha, total = false) => {
    const ad = aderenciaFrente(f);
    return (
      <div key={`${f.ordem}-${f.nome}`} className={`cur-tab-row${total ? " cur-tab-total" : ""}`}>
        <strong
          className="cur-tab-nome"
          title={
            total ? "Total de todas as frentes físicas — independe da busca/ordenação" : undefined
          }
        >
          {f.nome}
        </strong>
        {total ? <span /> : <RespFrenteCell resp={f.resp} />}
        <span className="tabular cur-tab-r">{fmt(f.contratado)}</span>
        <span className="tabular cur-tab-r">{fmt(f.possivel)}</span>
        <span className="tabular cur-tab-r">{fmt(f.real)}</span>
        {total ? (
          <span />
        ) : (
          <span className="tabular cur-tab-r">{f.rsHh != null ? fmt(f.rsHh) : "—"}</span>
        )}
        <span className="cur-ader">
          <span className="cur-ader-bar">
            <span
              className="cur-ader-fl"
              style={{ width: `${Math.min(100, ad)}%`, background: cor(ad) }}
            />
          </span>
          <span className="tabular cur-ader-pct">{pct0(ad)}</span>
        </span>
      </div>
    );
  };

  return (
    <>
      {linhas.length >= 5 ? (
        <ColToolbar col={col} placeholder="Buscar frente… ex.: Trecho 03" />
      ) : null}
      <div className="cur-tab cur-tab-frente">
        <div className="cur-tab-head">
          <span>Frente</span>
          <span>Responsável</span>
          <span className="cur-tab-r">Contratado (R$)</span>
          <span
            className="cur-tab-r"
            title="Possível = liberado (contratado − impedimentos do C.14)"
          >
            Possível (R$)
          </span>
          <span className="cur-tab-r">Real (R$)</span>
          <span className="cur-tab-r" title="Produtividade contratual (R$ por HH)">
            R$/HH
          </span>
          <span>Aderência real ÷ possível</span>
        </div>
        {col.total === 0 ? (
          <ColVazio
            termo={col.debounced}
            rotulo="frente"
            artigo="Nenhuma"
            onClear={() => col.setQuery("")}
          />
        ) : (
          col.visible.map((f) => renderRow(f))
        )}
        {renderRow(tot, true)}
      </div>
      <ColPag col={col} rotulo="frentes" />
    </>
  );
}

// ── tabela: responsabilidade pelo desvio ───────────────────────────
function RespDesvio({
  contratado,
  liberado,
  executado,
}: {
  contratado: number;
  liberado: number;
  executado: number;
}) {
  const desvioTotal = contratado - executado;
  const pContratante = Math.max(0, contratado - liberado);
  const pContratada = Math.max(0, liberado - executado);
  const pctCtte = desvioTotal > 0 ? (pContratante / desvioTotal) * 100 : 0;
  const pctCda = desvioTotal > 0 ? (pContratada / desvioTotal) * 100 : 0;

  const linhas = [
    {
      resp: "Contratante",
      tone: "danger" as const,
      origem: "Frente não liberada (impedimentos)",
      valor: pContratante,
      pct: pctCtte,
      cor: "var(--danger)",
    },
    {
      resp: "Contratada",
      tone: "warning" as const,
      origem: "Frente liberada não executada (equipe/produtividade)",
      valor: pContratada,
      pct: pctCda,
      cor: "var(--warning)",
    },
  ];

  return (
    <div className="cur-tab cur-tab-resp">
      <div className="cur-tab-head">
        <span>Responsável</span>
        <span>Origem do desvio</span>
        <span className="cur-tab-r">Valor (R$)</span>
        <span className="cur-tab-r">% do desvio</span>
        <span>Participação</span>
      </div>
      {linhas.map((l) => (
        <div key={l.resp} className="cur-tab-row">
          <span>
            <Badge tone={l.tone}>{l.resp}</Badge>
          </span>
          <span className="cur-cell-origem">{l.origem}</span>
          <span className="tabular cur-tab-r">{fmt(l.valor)}</span>
          <strong className="tabular cur-tab-r" style={{ color: l.cor }}>
            {pct0(l.pct)}
          </strong>
          <span className="cur-ader">
            <span className="cur-ader-bar">
              <span
                className="cur-ader-fl"
                style={{ width: `${Math.min(100, l.pct)}%`, background: l.cor }}
              />
            </span>
          </span>
        </div>
      ))}
      <div className="cur-tab-row cur-tab-total">
        <strong className="cur-tab-nome">Desvio total</strong>
        <span className="cur-cell-origem">Contratado − Executado</span>
        <strong className="tabular cur-tab-r">{fmt(desvioTotal)}</strong>
        <strong className="tabular cur-tab-r">100%</strong>
        <span />
      </div>
    </div>
  );
}

// ── card escuro: leitura das curvas ────────────────────────────────
function Diagnostico({
  contratado,
  liberado,
  capacidade,
  executado,
  idxMaior,
}: {
  contratado: number;
  liberado: number;
  capacidade: number;
  idxMaior: number;
  executado: number;
}) {
  const gapCL = contratado - liberado;
  const gapLCap = liberado - capacidade;
  const gapCapE = capacidade - executado;
  // fonte ÚNICA do "maior gap": o idxMaior calculado no CurvasAba sobre o maiorGapRs CARREGADO
  // (com tolerância) — o mesmo que destaca a badge dos GapCards. Re-derivar aqui divergia.
  const GAP_NOMES: Array<[string, string]> = [
    ["Contratado → Liberado", "a Contratante (frente não liberada)"],
    ["Liberado → Capacidade", "a Contratada (falta equipe nas frentes liberadas)"],
    ["Capacidade → Executado", "produtividade de execução"],
  ];
  const dominante = idxMaior >= 0 ? GAP_NOMES[idxMaior] : null;
  const pctCap = capacidade > 0 ? Math.round((executado / capacidade) * 100) : 0;
  // Narrativa DERIVADA do dado (era semi-hardcoded p/ o snapshot da BR-101 — quick win 4 do refino):
  // cada afirmação só aparece quando a relação entre as curvas a sustenta.
  // tolerância de 0,1% do contratado (piso R$ 1k): ruído de arredondamento não vira acusação
  const TOL_LIBERACAO = Math.max(contratado * 0.001, 1000);
  const tudoLiberado = gapCL <= TOL_LIBERACAO; // Liberado cobre o Contratado → sem gargalo da Contratante
  const EXEC_NO_TETO_PCT = 90; // executado ≥ 90% da capacidade = "colado no teto" (narrativa, não farol)
  const execNoTeto = pctCap >= EXEC_NO_TETO_PCT;

  return (
    <aside className="cur-diagdark">
      <div className="cur-diagdark-head">{I.trending({ size: 16 })} Leitura das curvas</div>
      <p className="cur-diagdark-texto">
        {tudoLiberado ? (
          <>
            No BM atual, as frentes estão <strong>liberadas</strong> (Liberado = Contratado ={" "}
            {fmtMi(contratado)}) — a Contratante não é o gargalo agora.
          </>
        ) : (
          <>
            No BM atual, há <strong>{fmtMi(gapCL)}</strong> previstos e ainda não liberados
            (Liberado {fmtMi(liberado)} vs Contratado {fmtMi(contratado)}) — parte do gargalo está
            na Contratante.
          </>
        )}{" "}
        {gapLCap > 0 ? (
          <>
            Adiante, a <strong>Capacidade</strong> ({fmtMi(capacidade)}) fica abaixo do liberado, e
            o <strong>Executado</strong> ({fmtMi(executado)}) está em {pctCap}% da capacidade.{" "}
            {execNoTeto ? (
              <>
                Ou seja: <strong>falta equipe</strong>, não falta produtividade — quem está
                mobilizado produz no teto, enquanto as demais frentes liberadas seguem sem
                mobilização.
              </>
            ) : (
              <>
                Além da equipe aquém do liberado, o executado fica abaixo do teto da capacidade — há
                perda de produtividade na equipe mobilizada.
              </>
            )}
          </>
        ) : (
          <>
            A <strong>Capacidade</strong> ({fmtMi(capacidade)}) cobre o liberado, e o{" "}
            <strong>Executado</strong> ({fmtMi(executado)}) está em {pctCap}% da capacidade
            {execNoTeto
              ? " — execução no teto da equipe alocada."
              : " — há perda de produtividade na equipe mobilizada."}
          </>
        )}{" "}
        {dominante ? (
          <>
            O maior gap é <strong>{dominante[0]}</strong>, apontando para {dominante[1]}.{" "}
          </>
        ) : (
          <>Nenhum gap domina além da tolerância — as quatro curvas caminham juntas. </>
        )}
        <strong>Conexão com o Mapa (C.14):</strong>{" "}
        {tudoLiberado
          ? "se você registrar impedimentos lá, a curva Liberado cai aqui e o gap 1 (Contratante) abre — virando base de pleito."
          : "os impedimentos registrados lá já derrubam a curva Liberado aqui — o gap 1 (Contratante) aberto é base de pleito."}
      </p>
    </aside>
  );
}

// ── gráfico das 4 curvas (zoom BM × contrato inteiro · futuro tracejado) ──
type Zoom = "bm" | "full";

function CurvasChart({ serie }: { serie: CurvasSerie }) {
  const [zoom, setZoom] = useState<Zoom>("bm");
  // 5ª linha opcional: acumulado de C.3 "Previsto Serviços" (produção física, sem transversais)
  const [comPrevServ, setComPrevServ] = useState(false);
  const temPrevServ = serie.meses.some((m) => m.previstoServicosAcum != null);
  const bm = serie.bmCorrente ?? serie.meses.length;
  const bmIdx = serie.meses.findIndex((m) => m.mesNum === bm);
  const bmLabel = serie.meses.find((m) => m.mesNum === bm)?.periodoLabel ?? null;
  const bmTag = `BM ${String(bm).padStart(2, "0")}`;

  // recorte: foco no BM mostra só onde as 4 curvas têm dado real e se comparam
  const fim =
    zoom === "bm" ? (bmIdx >= 0 ? bmIdx : serie.meses.length - 1) : serie.meses.length - 1;
  const sub = serie.meses.slice(0, fim + 1);

  // TODAS as séries: linha cheia até o BM, tracejada depois — pós-BM é previsão (Contratado/
  // Liberado) ou carry congelado (Capacidade/Executado, hoje NULL na normalização). A legenda
  // "tracejado = futuro / previsão" vale para as 4 curvas.
  const data = sub.map((m) => {
    const ateBm = m.mesNum <= bm;
    const desdeBm = m.mesNum >= bm;
    return {
      periodo: m.periodoLabel ?? `M${String(m.mesNum).padStart(2, "0")}`,
      contratado: ateBm ? m.contratadoAcum : null,
      contratadoFut: desdeBm ? m.contratadoAcum : null,
      liberado: ateBm ? m.liberadoAcum : null,
      liberadoFut: desdeBm ? m.liberadoAcum : null,
      capacidade: ateBm ? m.capacidadeAcum : null,
      capacidadeFut: desdeBm ? m.capacidadeAcum : null,
      executado: ateBm ? m.executadoAcum : null,
      executadoFut: desdeBm ? m.executadoAcum : null,
      previstoServicos: m.previstoServicosAcum,
    };
  });

  // tooltip: dedupa base×Fut (no mês do BM as duas têm o mesmo valor — prefere a com dado),
  // ordena na cadeia Contratado → Liberado → Capacidade → Executado e mantém "—" p/ pendente.
  const CADEIA = ["contratado", "liberado", "capacidade", "executado", "previstoServicos"];
  const tooltipContent = (p: unknown) => {
    const props = p as { active?: boolean; payload?: ChartTooltipEntry[]; label?: string | number };
    const base = (k: string) => k.replace(/Fut$/, "");
    const porBase = new Map<string, ChartTooltipEntry>();
    for (const e of props.payload ?? []) {
      const b = base(String(e.dataKey ?? ""));
      const atual = porBase.get(b);
      if (!atual || (atual.value == null && e.value != null)) porBase.set(b, e);
    }
    const entries = [...porBase.values()].sort(
      (a, b) =>
        CADEIA.indexOf(base(String(a.dataKey ?? ""))) -
        CADEIA.indexOf(base(String(b.dataKey ?? ""))),
    );
    return (
      <ChartTooltip
        active={props.active}
        payload={entries}
        label={props.label}
        formatter={(v) => fmtMi(v)}
      />
    );
  };

  return (
    <>
      <div className="cur-chart-titulo">
        Curvas acumuladas (R$) · Contratado × Liberado × Capacidade × Executado
      </div>
      <div className="cur-cleg">
        <LegItem cor={COR.contratado} label="Contratado (previsto)" />
        <LegItem cor={COR.liberado} label="Liberado (desimpedido)" />
        <LegItem cor={COR.capacidade} label="Capacidade (equipe alocada)" />
        <LegItem cor={COR.executado} label="Executado (RDO)" />
        {comPrevServ ? (
          <LegItem cor="var(--text-4)" label="Previsto Serviços (produção)" fina />
        ) : null}
        <span className="cur-cleg-nota">
          <span className="cur-cleg-dash" aria-hidden /> tracejado = futuro / previsão
        </span>
      </div>

      <div className="cur-chart-toolbar">
        <Segmented<Zoom>
          value={zoom}
          onChange={setZoom}
          aria-label="Recorte do gráfico das curvas"
          items={[
            { value: "bm", label: "Foco no BM" },
            { value: "full", label: "Contrato inteiro" },
          ]}
        />
        {temPrevServ ? (
          <FilterChip
            label="Previsto Serviços"
            active={comPrevServ}
            dashed={!comPrevServ}
            aria-pressed={comPrevServ}
            title="Acumulado de C.3 'Previsto Serviços' — só a produção física prevista, sem verbas transversais"
            onClick={() => setComPrevServ((v) => !v)}
          />
        ) : null}
        <span className="cur-section-sub cur-chart-hint">
          {zoom === "bm"
            ? "As 4 curvas só têm dado real até o BM — o foco mostra onde elas se comparam."
            : "Contrato inteiro: Capacidade e Executado (reais) param no BM; Contratado e Liberado seguem como previsão (tracejados)."}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 16, right: 18, left: 6, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="periodo"
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={Math.max(0, Math.ceil(data.length / 14) - 1)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mi`
            }
          />
          <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={tooltipContent} />
          {bmLabel != null && bmIdx <= fim && (
            <ReferenceLine
              x={bmLabel}
              stroke="var(--text-4)"
              strokeDasharray="4 3"
              label={{
                value: `${bmTag} · hoje`,
                position: "insideTopLeft",
                fontSize: 10,
                fill: "var(--text-3)",
                fontWeight: 700,
              }}
            />
          )}
          {comPrevServ ? (
            <Line
              type="monotone"
              dataKey="previstoServicos"
              name="Previsto Serviços"
              stroke="var(--text-4)"
              strokeWidth={1.6}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="contratado"
            name="Contratado"
            stroke={COR.contratado}
            strokeWidth={2.4}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="contratadoFut"
            name="Contratado (previsão)"
            stroke={COR.contratado}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeOpacity={0.55}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="liberado"
            name="Liberado"
            stroke={COR.liberado}
            strokeWidth={2.4}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="liberadoFut"
            name="Liberado (previsão)"
            stroke={COR.liberado}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeOpacity={0.55}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="capacidade"
            name="Capacidade"
            stroke={COR.capacidade}
            strokeWidth={2.6}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="capacidadeFut"
            name="Capacidade (previsão)"
            stroke={COR.capacidade}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeOpacity={0.55}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="executado"
            name="Executado"
            stroke={COR.executado}
            strokeWidth={2.8}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="executadoFut"
            name="Executado (previsão)"
            stroke={COR.executado}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeOpacity={0.55}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="none"
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

function LegItem({ cor, label, fina }: { cor: string; label: string; fina?: boolean }) {
  return (
    <span className="cur-cleg-item">
      <span
        className={`cur-cleg-ln${fina ? " cur-cleg-ln-fina" : ""}`}
        style={{ background: cor }}
      />
      {label}
    </span>
  );
}

// "Trecho 01 — KM 144,6 a 156,4" → "Trecho 01" · "Recuperação de Sinistros" intacto
function nomeFrenteCurto(nome: string) {
  const corte = nome.split(/\s+—\s+|\s+-\s+/)[0];
  return corte.trim() || nome;
}
