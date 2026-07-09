// Aba "Produtividade" (RMA · C.7) — refactor: FINANCEIRA (R$/HH) + FÍSICA (serviço×trecho), 100% do
// dado real. Financeira: série mensal (obra_produtividade_economica) + cards/benchmarks/META REAL +
// ponte (obra_produtividade_params). Física: tracker serviço×trecho + detalhe do cálculo por
// equipamento + Ponte utilização×liberação + impedimentos (D.6) — antes EmptyState, agora normalizado.
// META vem do dado (R$ 229,95), não mais do config 340,33 defasado. Tokens-only; farol canônico.

import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  CHART_SERIE_COR,
  Card,
  ChartLegend,
  ChartTooltip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErroCard,
  FarolCard,
  type FarolCardFarol,
  I,
  Select,
  Skeleton,
} from "@/components/ds";
import { RmaParamBar } from "@/components/RmaParamBar/RmaParamBar";
import { ColPag, ColToolbar, ColVazio, useColecao } from "@/lib/rma/colecao";
import { useProdutividade } from "@/lib/hooks/useProdutividade";
import { useFaturamentoCurva } from "@/lib/hooks/useFaturamentoCurva";
import type { ProdutividadeEconomicaMes } from "@/lib/supabase/produtividadeEconomica";
import type { ProdFisica, ProdFisicaDetalhe, ProdParams } from "@/lib/supabase/produtividadeFisica";
import "./produtividade.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/produtividade")({
  component: ProdutividadeAba,
});

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloMes(m: { ano: number; mes: number; periodoLabel?: string | null }): string {
  return m.periodoLabel ?? `${MESES[m.mes - 1] ?? m.mes}/${String(m.ano % 100).padStart(2, "0")}`;
}

const fmtRsHh = (v: number | null) =>
  v != null && Number.isFinite(v) ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : "—";
const fmtBRL = (v: number | null) =>
  v != null && Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
const fmtNum = (v: number | null, d = 0) =>
  v != null && Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: d }) : "—";
const fmtPct = (v: number | null, d = 1) =>
  v != null && Number.isFinite(v)
    ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: d })}%`
    : "—";
const fmtMult = (v: number | null) =>
  v != null && Number.isFinite(v)
    ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×`
    : "—";

type FarolNivel = { tone: "success" | "info" | "warning" | "danger"; label: string };
const FAROL_TOM: Record<string, FarolNivel["tone"]> = {
  Conforme: "success",
  Observação: "info",
  Observacao: "info",
  Risco: "warning",
  Crítico: "danger",
  Critico: "danger",
};
function farolDeTexto(s: string | null): FarolNivel | null {
  if (!s) return null;
  return { tone: FAROL_TOM[s.trim()] ?? "info", label: s.trim() };
}
function farolBenchmark(ratio: number | null): FarolNivel | null {
  if (ratio == null) return null;
  if (ratio >= 1.2) return { tone: "success", label: "Conforme" };
  if (ratio >= 1.0) return { tone: "info", label: "Observação" };
  if (ratio >= 0.85) return { tone: "warning", label: "Risco" };
  return { tone: "danger", label: "Crítico" };
}
// texto do banco → prop `farol` do FarolCard (o KPI de aderência carrega o farol que ele dispara)
const FAROL_CARD: Record<string, FarolCardFarol> = {
  Conforme: "conforme",
  Observação: "observacao",
  Observacao: "observacao",
  Risco: "risco",
  Crítico: "critico",
  Critico: "critico",
};

// régua do farol (aderência acumulada · 95/85/70) — os 4 níveis canônicos, exibidos como
// faixa compacta no rodapé da seção 1 (antes: 4 cards ao fim da página, longe do KPI que regem).
const FAROL_CRITERIOS = [
  ["success", "Conforme", "≥ 95%"],
  ["info", "Observação", "85–95%"],
  ["warning", "Risco", "70–85%"],
  ["danger", "Crítico", "< 70%"],
] as const;

function ProdutividadeAba() {
  const { contractId } = Route.useParams();
  const { data, isLoading, error, refetch } = useProdutividade(contractId);
  const { data: curva } = useFaturamentoCurva(contractId);

  if (isLoading) {
    // skeleton com a forma final: param bar → 5 KPIs → grid [gráfico | posicionamento] → tracker
    return (
      <main className="prod-main">
        <Skeleton style={{ height: 46 }} />
        <div className="prod-kpis prod-kpis-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 92 }} />
          ))}
        </div>
        <div className="prod-grow">
          <Skeleton style={{ height: 320 }} />
          <Skeleton style={{ height: 320 }} />
        </div>
        <Skeleton style={{ height: 260 }} />
      </main>
    );
  }
  if (error) {
    // ERRO ≠ PENDÊNCIA: falha de leitura mostra Badge danger + retry (nunca vira empty honesto)
    return (
      <main className="prod-main">
        <ErroCard
          titulo="Não foi possível carregar a produtividade"
          mensagem={error instanceof Error ? error.message : "Erro ao ler a produtividade."}
          onRetry={() => void refetch()}
        />
      </main>
    );
  }
  if (!data || (!data.serie && !data.params)) {
    return (
      <main className="prod-main">
        <Card>
          <EmptyState
            framed
            icon={I.trending({ size: 42 })}
            title="Produtividade ainda não normalizada"
            text="A produtividade (R$/HH + física) aparece aqui quando a seção C.7 for normalizada (Camada A)."
            hint={<Badge tone="info">Aguardando normalização</Badge>}
          />
        </Card>
      </main>
    );
  }

  const p = data.params;
  const meses = data.serie?.meses ?? [];

  // contratada R$/HH do mês: exato nos medidos (rsPorHh ÷ aderencia); cross-join nos futuros.
  const fatContrPorMes = new Map<string, number>();
  for (const m of curva?.meses ?? []) {
    if (m.contratadoRs != null) fatContrPorMes.set(`${m.ano}-${m.mes}`, m.contratadoRs);
  }
  const contratadaMes = (m: ProdutividadeEconomicaMes): number | null => {
    if (m.rsPorHh != null && m.aderencia != null && m.aderencia > 0) return m.rsPorHh / m.aderencia;
    const fc = fatContrPorMes.get(`${m.ano}-${m.mes}`);
    return fc != null && m.hhPrevisto != null && m.hhPrevisto > 0 ? fc / m.hhPrevisto : null;
  };
  const medidos = meses.filter((m) => (m.hhReal ?? 0) > 0 && m.faturadoRs != null);

  // KPIs vêm dos cards REAIS (params); benchmark/meta também (não mais config).
  const realAcum = p?.realAcumRsHh ?? null;
  const aderAcum = p?.aderenciaAcum ?? null;
  const farolAder = farolDeTexto(p?.farolAderencia ?? null);
  const farolCardAder = p?.farolAderencia ? FAROL_CARD[p.farolAderencia.trim()] : undefined;
  const divAterpa = p?.realDivAterpa ?? null;
  const divSetor = p?.realDivSetor ?? null;
  const farolBmk = farolDeTexto(p?.farolBmk ?? null) ?? farolBenchmark(divAterpa);
  const precisaRevisao = data.serie != null && data.serie.status !== "ok";

  return (
    <main className="prod-main">
      <header className="prod-head">
        <div>
          <h2 className="prod-titulo">Produtividade · R$/HH + física</h2>
          <p className="prod-sub">
            R$ faturado / hora-homem · aderência vs. contratada · produtividade física
            serviço×trecho (CPU × real) · base do desvio (M3.4)
          </p>
        </div>
        <div className="prod-head-badges">
          {precisaRevisao ? (
            <span title="Gate de conservação da série (Σ HH ≠ card) não fechou — números sob revisão.">
              <Badge tone="warning">Precisa revisão</Badge>
            </span>
          ) : null}
          {farolAder ? (
            <Badge tone={farolAder.tone}>{farolAder.label}</Badge>
          ) : (
            <Badge tone="info">Pendente</Badge>
          )}
        </div>
      </header>

      {/* Faixa de parâmetros (do dado real) — barra canônica compartilhada das abas RMA */}
      <RmaParamBar
        items={[
          { label: "Métrica", valor: "R$ faturado / hora-homem" },
          { label: "Base do HH", valor: p?.baseHh ?? "—" },
          {
            label: "BM corrente",
            valor: p?.bmCorrente != null ? `BM ${fmtNum(p.bmCorrente)}` : "—",
          },
          {
            label: "Jornada",
            valor:
              p?.jornadaModHMes != null || p?.jornadaMoiHMes != null
                ? `MOD ${fmtNum(p?.jornadaModHMes ?? null)}h · MOI ${fmtNum(p?.jornadaMoiHMes ?? null)}h/mês`
                : "—",
            title: "Horas/mês por pessoa — denominador do HH no R$/HH",
          },
          {
            label: "Câmbio (benchmark)",
            valor:
              p?.cambio != null
                ? `US$ 1 = R$ ${p.cambio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
                : "—",
          },
          {
            label: "Total Cost / Milha",
            valor: (
              <Link
                to="/contracts/$contractId/desequilibrio/valor-agregado"
                params={{ contractId }}
                className="prod-pbar-link"
                title="Abrir Valor Agregado (D.4) no Painel de Desequilíbrio"
              >
                Módulo 3 (D.4) {I.arrowRight({ size: 12 })}
              </Link>
            ),
          },
        ]}
      />

      <div className="prod-sec-label">1 · Produtividade financeira (R$/HH)</div>
      <div className="prod-kpis prod-kpis-5">
        <FarolCard
          label="CONTRATADA DO PERÍODO"
          icon="trending"
          value={fmtRsHh(p?.contratadaPeriodoRsHh ?? null)}
          info="R$/HH previsto até o BM"
          accent="neutral"
        />
        <FarolCard
          label="REAL ACUMULADO"
          icon="wallet"
          value={fmtRsHh(realAcum)}
          info="faturado ÷ HH real"
          accent="ink"
        />
        <FarolCard
          label="REAL NO MÊS"
          icon="clock"
          value={fmtRsHh(p?.realMesRsHh ?? null)}
          info="R$/HH do BM corrente"
          accent="neutral"
        />
        {/* o KPI que dispara o farol da aba carrega o próprio farol (dot + label no canto) */}
        <FarolCard
          label="ADERÊNCIA ACUM."
          icon="flag"
          value={fmtPct(aderAcum)}
          info="real ÷ contratada · faixas 95 · 85 · 70%"
          farol={farolCardAder}
          accent="neutral"
        />
        <FarolCard
          label="META DO PROJETO"
          icon="trending"
          value={fmtRsHh(p?.metaProjetoRsHh ?? null)}
          info="R$/HH · valor total ÷ HH previsto"
          accent="neutral"
        />
      </div>

      <div className="prod-grow">
        <RhhChart
          meses={meses}
          contratadaMes={contratadaMes}
          metaRsHh={p?.metaProjetoRsHh ?? null}
          nMedidos={medidos.length}
        />
        <Posicionamento
          params={p}
          realAcum={realAcum}
          aderAcum={aderAcum}
          divAterpa={divAterpa}
          divSetor={divSetor}
          farolBmk={farolBmk}
        />
      </div>

      {/* Régua do farol — rodapé da seção 1 (explica o KPI/Badge de aderência logo acima).
          Mesmos 4 níveis/faixas/cores dos antigos cards, agora compactos e no lugar certo. */}
      <div className="prod-farol-regua" role="note">
        <span className="prod-farol-regua-t">
          Critérios do farol · aderência acumulada (real ÷ contratada) · só pune queda
        </span>
        {FAROL_CRITERIOS.map(([tone, label, faixa]) => (
          <span key={label} className={`prod-farol-pill prod-farol-pill-${tone}`}>
            <span className="prod-criterio-dot" aria-hidden />
            {label} <span className="tabular">{faixa}</span>
          </span>
        ))}
      </div>

      {/* 2 · produtividade física por serviço × trecho (REAL) */}
      <div className="prod-sec-label">
        2 · Produtividade física por serviço × trecho{" "}
        <span className="prod-sec-hint">· CPU × real · cresce a cada medição</span>
      </div>
      <FisicaTracker linhas={data.fisica} />

      <div className="prod-grow">
        <DetalheCalc detalhe={data.detalhe} />
        <Ponte params={p} impedimentos={data.impedimentos} />
      </div>

      <AnaliseCard params={p} fisica={data.fisica} medidos={medidos} farolAder={farolAder} />

      <SerieCard meses={meses} contratadaMes={contratadaMes} />
    </main>
  );
}

// ── Física: tracker serviço×trecho (chips disciplina/trecho + tabela) ────────────────────────────
function ChipRow({
  label,
  opts,
  sel,
  onSel,
}: {
  label: string;
  opts: string[];
  sel: string | null;
  onSel: (v: string | null) => void;
}) {
  return (
    <div className="prod-chiprow">
      <span className="prod-chip-lbl">{label}:</span>
      <button
        type="button"
        className={`prod-chip${sel == null ? " on" : ""}`}
        onClick={() => onSel(null)}
      >
        Todos
      </button>
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          className={`prod-chip${sel === o ? " on" : ""}`}
          onClick={() => onSel(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
function FisicaTracker({ linhas }: { linhas: ProdFisica[] }) {
  const disciplinas = Array.from(
    new Set(linhas.map((l) => l.disciplina).filter(Boolean)),
  ) as string[];
  const trechos = Array.from(new Set(linhas.map((l) => l.trecho).filter(Boolean))) as string[];
  const [disc, setDisc] = useState<string | null>(null);
  const [trk, setTrk] = useState<string | null>(null);
  // coleção canônica (busca + ordenação + paginação); os chips entram como filtro extra
  const col = useColecao(linhas, {
    busca: (l) => `${l.disciplina ?? ""} ${l.servico} ${l.trecho ?? ""} ${l.unidade ?? ""}`,
    ordenacoes: [
      { value: "pq", label: "Ordem da PQ", cmp: (a, b) => a.ordem - b.ordem },
      {
        value: "aderencia",
        label: "Menor aderência",
        cmp: (a, b) => (a.aderencia ?? Infinity) - (b.aderencia ?? Infinity),
      },
      {
        value: "contratada",
        label: "Maior contratada",
        cmp: (a, b) => (b.qtdContratada ?? 0) - (a.qtdContratada ?? 0),
      },
    ],
    filtro: (l) => (!disc || l.disciplina === disc) && (!trk || l.trecho === trk),
    perPage: 10,
    resetKey: `${disc ?? ""}|${trk ?? ""}`,
  });
  if (!linhas.length) {
    return (
      <Card>
        <EmptyState
          icon={I.clock({ size: 36 })}
          title="Tracker físico aguardando medição"
          text="Nenhum serviço×trecho normalizado ainda."
        />
      </Card>
    );
  }
  const filtroAtivo = disc != null || trk != null || col.debounced !== "";
  return (
    <Card>
      {disciplinas.length > 1 ? (
        <ChipRow label="Disciplina" opts={disciplinas} sel={disc} onSel={setDisc} />
      ) : null}
      {trechos.length > 1 ? (
        <ChipRow label="Trecho" opts={trechos} sel={trk} onSel={setTrk} />
      ) : null}
      {col.showToolbar ? (
        <ColToolbar col={col} placeholder="Buscar por serviço, trecho ou disciplina…" />
      ) : null}
      {col.visible.length === 0 && filtroAtivo ? (
        // empty FILTRADO (≠ empty inicial): a combinação chips+busca zerou o resultado
        <ColVazio
          termo={col.debounced || [disc, trk].filter(Boolean).join(" · ")}
          rotulo="serviço"
          onClear={() => {
            col.setQuery("");
            setDisc(null);
            setTrk(null);
          }}
        />
      ) : (
        <FisicaTable rows={col.visible} />
      )}
      <ColPag col={col} rotulo="serviços" />
      <p className="prod-note">
        Contratada vem da PQ; % físico = medido ÷ contratado; CPU un/h derivada do custo horário do
        equipamento ÷ R$/un. Real preenche com medição + RDO por frente — cresce a cada medição.
      </p>
    </Card>
  );
}
function FisicaTable({ rows }: { rows: ProdFisica[] }) {
  return (
    <>
      <div className="prod-fis-wrap">
        <table className="prod-fis-t">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Serviço</th>
              <th>Trecho</th>
              <th>Un</th>
              <th className="r">Contratada</th>
              <th className="r">Medida</th>
              <th className="r">% físico</th>
              <th className="r">CPU un/h</th>
              <th className="r">Real un/h</th>
              <th className="r">Aderência</th>
              <th>Farol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const f = farolDeTexto(l.farol);
              return (
                <tr key={l.ordem}>
                  <td className="prod-fis-disc">{l.disciplina ?? "—"}</td>
                  <td>{l.servico}</td>
                  <td>{l.trecho ?? "—"}</td>
                  <td>{l.unidade ?? "—"}</td>
                  <td className="r tabular">{fmtNum(l.qtdContratada)}</td>
                  <td className="r tabular">
                    {(l.qtdMedida ?? 0) > 0 ? fmtNum(l.qtdMedida) : "—"}
                  </td>
                  <td className="r tabular">
                    {(l.qtdMedida ?? 0) > 0 ? fmtPct(l.pctFisico) : "—"}
                  </td>
                  <td className="r tabular">{fmtNum(l.cpuUnH)}</td>
                  <td className="r tabular">{l.realUnH != null ? fmtNum(l.realUnH, 1) : "—"}</td>
                  <td className="r tabular">{l.aderencia != null ? fmtPct(l.aderencia) : "—"}</td>
                  <td>
                    {f ? (
                      <Badge tone={f.tone}>{f.label}</Badge>
                    ) : (
                      <span className="prod-aguard">○ Aguardando</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Detalhe do cálculo (serviço medido · equip-horas) ────────────────────────────────────────────
function DetalheCalc({ detalhe }: { detalhe: ProdFisicaDetalhe[] }) {
  // default = 1º serviço com medição; com 2+ serviços normalizados aparece o seletor
  // (hoje a BR-101 tem 1 — nada muda; amanhã a tela não engole o dado novo)
  const defaultIdx = detalhe.findIndex((d) => (d.equipHoras ?? 0) > 0 && d.realUnH != null);
  const [idxSel, setIdxSel] = useState<number | null>(null);
  const idx = idxSel ?? Math.max(0, defaultIdx);
  const medido: ProdFisicaDetalhe | undefined = detalhe[idx];
  return (
    <section className="prod-section">
      <div className="prod-section-head prod-section-head-row">
        <div>
          <h3 className="prod-section-title">Detalhe do cálculo — por equipamento</h3>
          <p className="prod-section-sub">
            {medido ? `${medido.servico}${medido.frente ? ` · ${medido.frente}` : ""}` : "exemplo"}
          </p>
        </div>
        {detalhe.length > 1 ? (
          <Select
            value={String(idx)}
            onChange={(v) => setIdxSel(Number(v))}
            items={detalhe.map((d, i) => ({
              value: String(i),
              label: `${d.servico}${d.frente ? ` · ${d.frente}` : ""}`,
            }))}
            size="sm"
            align="end"
            aria-label="Serviço do detalhe do cálculo"
          />
        ) : null}
      </div>
      {medido ? (
        <>
          <div className="prod-det">
            <DetItem label="CPU (un/h · por equip)" value={fmtNum(medido.cpuUnH)} />
            <DetItem label="Equip. principal" value={medido.equipPrincipal ?? "—"} wide />
            <DetItem
              label="Qtd executada"
              value={`${fmtNum(medido.qtdExecutada)} ${medido.unidade ?? ""}`}
            />
            <DetItem label="Dias c/ serviço (RDO)" value={fmtNum(medido.diasServico)} />
            <DetItem label="Equip/dia" value={fmtNum(medido.equipDia)} />
            <DetItem label="Equip-horas" value={fmtNum(medido.equipHoras)} />
            <DetItem
              label="Produtiv. real"
              value={`${fmtNum(medido.realUnH, 1)} ${medido.unidade ?? ""}/h`}
            />
            <DetItem
              label="Aderência"
              value={fmtPct(medido.aderencia)}
              farol={farolDeTexto(medido.farol)}
            />
          </div>
          <p className="prod-note">
            Real = qtd executada ÷ equip-horas; aderência = real ÷ CPU. Recuperação de sinistro em
            fase de mobilização (RDO de efetivo fixo) → ainda não é pleito.
          </p>
        </>
      ) : (
        <EmptyState
          icon={I.clock({ size: 32 })}
          title="Sem serviço medido"
          text="O detalhe do cálculo aparece quando houver medição com equip-horas."
        />
      )}
    </section>
  );
}
function DetItem({
  label,
  value,
  wide,
  farol,
}: {
  label: string;
  value: string;
  wide?: boolean;
  farol?: FarolNivel | null;
}) {
  return (
    <div className={`prod-det-it${wide ? " prod-det-it-wide" : ""}`}>
      <span className="prod-det-l">{label}</span>
      <span className="prod-det-v tabular">
        {value}
        {farol ? <Badge tone={farol.tone}>{farol.label}</Badge> : null}
      </span>
    </div>
  );
}

// ── Ponte: utilização × liberação + impedimentos ─────────────────────────────────────────────────
function Ponte({
  params: p,
  impedimentos,
}: {
  params: ProdParams | null;
  impedimentos: {
    ordem: number;
    impedimento: string;
    periodo: string | null;
    hhOciosas: number | null;
  }[];
}) {
  return (
    <section className="prod-section">
      <div className="prod-section-head">
        <h3 className="prod-section-title">
          Ponte: Utilização × Liberação <span className="prod-sec-hint">(C.8 · D.6)</span>
        </h3>
        <p className="prod-section-sub">
          separa ritmo da Contratada × responsabilidade da Contratante
        </p>
      </div>
      <div className="prod-ponte-stats">
        <PonteStat label="% liberado vs contratado" value={fmtPct(p?.pontePctLiberado ?? null)} />
        <PonteStat
          label="% aproveitamento da liberação"
          value={fmtPct(p?.pontePctAproveitamento ?? null)}
        />
        <PonteStat
          label="% capacidade vs contratado"
          value={fmtPct(p?.pontePctCapacidade ?? null)}
        />
        <PonteStat
          label="Ociosidade documentada"
          value={`${fmtNum(p?.ponteOciosidadeHh ?? null, 1)} HH`}
        />
      </div>
      {impedimentos.length > 0 && (
        <table className="prod-imp-t">
          <thead>
            <tr>
              <th>Impedimento (D.6)</th>
              <th>Período</th>
              <th className="r">HH ociosas</th>
            </tr>
          </thead>
          <tbody>
            {impedimentos.map((im) => (
              <tr key={im.ordem}>
                <td>{im.impedimento}</td>
                <td>{im.periodo ?? "—"}</td>
                <td className="r tabular">
                  {im.hhOciosas != null ? fmtNum(im.hhOciosas, 1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="prod-note">
        O "liberado" da C.8 ainda aproxima o contratado (trechos bloqueados não chegaram à janela de
        faturamento). Só vira pleito quando o RDO separar equipamento por frente e a curva
        "Liberado" vier do retigráfico (C.14).
      </p>
    </section>
  );
}
function PonteStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="prod-ponte-stat">
      <span className="prod-ponte-v tabular">{value}</span>
      <span className="prod-ponte-l">{label}</span>
    </div>
  );
}

// ── Gráfico R$/HH no tempo ───────────────────────────────────────────────────────────────────────
// O ponto carrega o dado bruto do mês (faturado/HH/aderência) — o read-model já entrega tudo;
// o tooltip conta a história do mês em vez de descartar o que foi baixado.
type RhhPonto = {
  label: string;
  contratada: number | null;
  real: number | null;
  faturado: number | null;
  hhReal: number | null;
  aderencia: number | null;
};
function RhhChart({
  meses,
  contratadaMes,
  metaRsHh,
  nMedidos,
}: {
  meses: ProdutividadeEconomicaMes[];
  contratadaMes: (m: ProdutividadeEconomicaMes) => number | null;
  metaRsHh: number | null;
  nMedidos: number;
}) {
  const dados: RhhPonto[] = meses.map((m) => ({
    label: rotuloMes(m),
    contratada: contratadaMes(m),
    real: (m.hhReal ?? 0) > 0 ? m.rsPorHh : null,
    faturado: m.faturadoRs,
    hhReal: (m.hhReal ?? 0) > 0 ? m.hhReal : null,
    aderencia: m.aderencia,
  }));
  const temContratadaFutura = dados.some((d, i) => i >= nMedidos && d.contratada != null);
  return (
    <section className="prod-section">
      <div className="prod-section-head prod-section-head-row">
        <div>
          <h3 className="prod-section-title">R$/HH no tempo — Real × Contratada (mês a mês)</h3>
          <p className="prod-section-sub">
            comparação mês a mês, não pela média
            {metaRsHh != null ? ` · meta tracejada ${fmtRsHh(metaRsHh)}` : ""}
          </p>
        </div>
        <ChartLegend
          items={[
            { label: "Contratada", tipo: "linha", cor: CHART_SERIE_COR.contratado },
            { label: "Real", tipo: "linha", cor: CHART_SERIE_COR.real },
            ...(metaRsHh != null
              ? ([{ label: "Meta", tipo: "tracejada", cor: CHART_SERIE_COR.meta }] as const)
              : []),
          ]}
        />
      </div>
      <div className="prod-chart">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dados} margin={{ top: 8, right: 14, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            {/* rótulos horizontais: o Recharts afina pela largura (preserva início+fim) —
                legível onde antes eram 46 ticks a 9px/-50° */}
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={28}
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `R$ ${v}`}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)" }}
              content={
                <ChartTooltip
                  formatter={(v: number) => fmtRsHh(v)}
                  nomes={{ contratada: "Contratada", real: "Real" }}
                  titulo={(label, payload) => {
                    const pt = payload?.[0]?.payload as RhhPonto | undefined;
                    if (!pt) return label;
                    return (
                      <>
                        {label}
                        <span className="prod-tip-extra">
                          Faturado {fmtBRL(pt.faturado)} · HH real {fmtNum(pt.hhReal)} · Aderência{" "}
                          {fmtPct(pt.aderencia)}
                        </span>
                      </>
                    );
                  }}
                />
              }
            />
            {metaRsHh != null ? (
              <ReferenceLine
                y={metaRsHh}
                stroke={CHART_SERIE_COR.meta}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `Meta ${fmtRsHh(metaRsHh)}`,
                  position: "insideTopRight",
                  fill: "var(--text-3)",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="contratada"
              stroke={CHART_SERIE_COR.contratado}
              strokeWidth={1.8}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="real"
              stroke={CHART_SERIE_COR.real}
              strokeWidth={2.6}
              dot={{ r: 3, fill: CHART_SERIE_COR.real }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="prod-note">
        A produtividade contratada varia mês a mês (perfil do histograma × faturamento), por isso
        comparamos mês a mês e não pela média. A linha tracejada é a meta do projeto.
        {!temContratadaFutura
          ? " A curva contratada além do BM corrente pende da normalização da série (mostramos só onde é derivável)."
          : ""}
      </p>
    </section>
  );
}

// ── Posicionamento (benchmark) ───────────────────────────────────────────────────────────────────
type BmkPonto = { label: string; valor: number | null; tipo: "contr" | "real" | "bmk" };
function Posicionamento({
  params: p,
  realAcum,
  aderAcum,
  divAterpa,
  divSetor,
  farolBmk,
}: {
  params: ProdParams | null;
  realAcum: number | null;
  aderAcum: number | null;
  divAterpa: number | null;
  divSetor: number | null;
  farolBmk: FarolNivel | null;
}) {
  const metaRsHh = p?.metaProjetoRsHh ?? null;
  const dados: BmkPonto[] = [
    { label: "Contratada", valor: p?.contratadaPeriodoRsHh ?? null, tipo: "contr" },
    { label: "Real", valor: realAcum, tipo: "real" },
    ...(p?.bmkAterpaRsHh != null
      ? ([
          { label: "Benchmark ATERPA", valor: p.bmkAterpaRsHh, tipo: "bmk" },
          { label: "Benchmark setor", valor: p.bmkSetorRsHh, tipo: "bmk" },
        ] as BmkPonto[])
      : []),
  ];
  // mesmo código de cor do gráfico vizinho (ChartKit): Contratada = info · Real = navy
  const cor = (t: BmkPonto["tipo"]) =>
    t === "real"
      ? CHART_SERIE_COR.real
      : t === "contr"
        ? CHART_SERIE_COR.contratado
        : "var(--text-4)";
  const acimaBmk = divAterpa != null && divSetor != null && divAterpa >= 1 && divSetor >= 1;
  return (
    <section className="prod-section">
      <div className="prod-section-head">
        <h3 className="prod-section-title">Posicionamento da produtividade</h3>
        <p className="prod-section-sub">real × contratada × benchmark de mercado</p>
      </div>
      <div className="prod-chart">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 0, right: 52, left: 8, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v) => `R$ ${v}`}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontSize: 11, fill: "var(--text-2)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={
                <ChartTooltip
                  formatter={(v: number) => `${fmtRsHh(v)}/HH`}
                  nomes={{ valor: "R$/HH" }}
                />
              }
            />
            {metaRsHh != null ? (
              // mesma semântica do line chart: meta tracejada (aqui vertical, eixo X = R$/HH)
              <ReferenceLine
                x={metaRsHh}
                stroke={CHART_SERIE_COR.meta}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{
                  value: "Meta",
                  position: "insideTop",
                  fill: "var(--text-3)",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Bar dataKey="valor" radius={[0, 3, 3, 0]} barSize={16} isAnimationActive={false}>
              {dados.map((d, i) => (
                <Cell key={i} fill={cor(d.tipo)} />
              ))}
              {/* 4 barras → valor na ponta dispensa hover */}
              <LabelList
                dataKey="valor"
                position="right"
                formatter={(v: number) => fmtRsHh(v)}
                style={{ fill: "var(--text-2)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="prod-stbox">
        <div className="prod-stb">
          <div className="prod-stb-v tabular">{fmtNum(p?.hhContratadoAcum ?? null)}</div>
          <div className="prod-stb-l">HH contratado acum.</div>
        </div>
        <div className="prod-stb">
          <div className="prod-stb-v tabular">{fmtNum(p?.hhRealAcum ?? null)}</div>
          <div className="prod-stb-l">HH real acum.</div>
        </div>
      </div>
      <p className="prod-note">
        Real abaixo do contratado (aderência {fmtPct(aderAcum)} → farol da aba).
        {p?.bmkAterpaRsHh != null ? (
          <>
            {" "}
            Vs. benchmark: <strong>{fmtMult(divAterpa)} ATERPA</strong> ·{" "}
            <strong>{fmtMult(divSetor)} setor</strong> ({acimaBmk ? "acima" : "abaixo/igual"}) →
            farol {farolBmk ? <Badge tone={farolBmk.tone}>{farolBmk.label}</Badge> : "—"}.
          </>
        ) : (
          " Benchmark de mercado não disponível para esta obra."
        )}
      </p>
    </section>
  );
}

// ── Análise IA ───────────────────────────────────────────────────────────────────────────────────
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
function AnaliseCard({
  params: p,
  fisica,
  medidos,
  farolAder,
}: {
  params: ProdParams | null;
  fisica: ProdFisica[];
  medidos: ProdutividadeEconomicaMes[];
  farolAder: FarolNivel | null;
}) {
  if (!p || p.realAcumRsHh == null || p.aderenciaAcum == null) return null;
  const trend = medidos.map((m) => fmtRsHh(m.rsPorHh)).join(" → ");
  const bmkFrase =
    p.realDivAterpa != null && p.realDivAterpa >= 1
      ? `O real ainda está **acima** do benchmark de mercado (${fmtMult(p.realDivAterpa)} ATERPA). `
      : "";
  const fisMedido = fisica.find((l) => (l.qtdMedida ?? 0) > 0 && l.aderencia != null);
  const fisFrase = fisMedido
    ? `**Física:** a única medição (${fisMedido.servico}, ${fmtNum(fisMedido.qtdMedida)} ${fisMedido.unidade ?? ""}) rende ${fmtPct(fisMedido.aderencia)} da CPU — recuperação de sinistro em mobilização, **ainda não é pleito**. O tracker passa a acompanhar isso a cada medição; quando a queda for consistente E não for falta de frente liberada (ponte C.8/D.6), vira insumo do Valor Agregado / Milha no Módulo 3.`
    : "";
  const texto =
    `**Financeira:** a aderência acumulada está em **${fmtPct(p.aderenciaAcum)} (${farolAder?.label ?? "—"})** — o R$/HH real (${fmtRsHh(p.realAcumRsHh)}) está abaixo do contratado (${fmtRsHh(p.contratadaPeriodoRsHh)} no período). ` +
    bmkFrase +
    `A tendência mês a mês é ${trend || "—"}. `;
  return (
    <section className="prod-section">
      <div className="prod-analise-tag">
        {I.sparkle({ size: 12 })} ANÁLISE DO PERÍODO · ADM CONTRATUAL IA
      </div>
      <p className="prod-analise-texto">
        <FormattedText text={texto} />
      </p>
      {fisFrase ? (
        <p className="prod-analise-texto">
          <FormattedText text={fisFrase} />
        </p>
      ) : null}
    </section>
  );
}

// ── Série mensal (tabela) ────────────────────────────────────────────────────────────────────────
function SerieCard({
  meses,
  contratadaMes,
}: {
  meses: ProdutividadeEconomicaMes[];
  contratadaMes: (m: ProdutividadeEconomicaMes) => number | null;
}) {
  const col = useColecao(meses, {
    busca: (m) => rotuloMes(m),
    ordenacoes: [
      { value: "cronologico", label: "Cronológico", cmp: (a, b) => a.ano - b.ano || a.mes - b.mes },
      { value: "recente", label: "Mais recente", cmp: (a, b) => b.ano - a.ano || b.mes - a.mes },
      {
        value: "aderencia",
        label: "Menor aderência",
        cmp: (a, b) => (a.aderencia ?? Infinity) - (b.aderencia ?? Infinity),
      },
    ],
    perPage: 12,
  });
  if (!meses.length) return null;
  return (
    <Card>
      <div className="prod-section-head">
        <h3 className="prod-section-title">Série mensal · faturado × HH × R$/HH</h3>
        <p className="prod-section-sub">
          {meses.length} meses · "—" onde o HH real ainda não foi medido
        </p>
      </div>
      {col.showToolbar ? (
        <ColToolbar col={col} placeholder="Buscar por mês (ex.: jun/27, mai)…" />
      ) : null}
      {col.visible.length === 0 && col.debounced ? (
        <ColVazio termo={col.debounced} rotulo="mês" onClear={() => col.setQuery("")} />
      ) : (
        <SerieTable rows={col.visible} contratadaMes={contratadaMes} />
      )}
      <ColPag col={col} rotulo="meses" />
    </Card>
  );
}
function SerieTable({
  rows,
  contratadaMes,
}: {
  rows: ProdutividadeEconomicaMes[];
  contratadaMes: (m: ProdutividadeEconomicaMes) => number | null;
}) {
  const cols: DataTableColumn<ProdutividadeEconomicaMes>[] = [
    { key: "mes", label: "Mês", width: "1fr", render: (m) => <strong>{rotuloMes(m)}</strong> },
    {
      key: "faturado",
      label: "Faturado",
      width: "1.2fr",
      align: "right",
      render: (m) => <span className="tabular">{fmtBRL(m.faturadoRs)}</span>,
    },
    {
      key: "hhPrev",
      label: "HH previsto",
      width: "0.9fr",
      align: "right",
      render: (m) => <span className="tabular">{fmtNum(m.hhPrevisto)}</span>,
    },
    {
      key: "hhReal",
      label: "HH real",
      width: "0.9fr",
      align: "right",
      render: (m) =>
        (m.hhReal ?? 0) > 0 ? (
          <span className="tabular">{fmtNum(m.hhReal)}</span>
        ) : (
          <span className="prod-cell-pend">—</span>
        ),
    },
    {
      key: "contr",
      label: "Contratada R$/HH",
      width: "1.1fr",
      align: "right",
      render: (m) => {
        const c = contratadaMes(m);
        return c != null ? (
          <span className="tabular">{fmtRsHh(c)}</span>
        ) : (
          <span className="prod-cell-pend">—</span>
        );
      },
    },
    {
      key: "real",
      label: "Real R$/HH",
      width: "1fr",
      align: "right",
      render: (m) =>
        (m.hhReal ?? 0) > 0 && m.rsPorHh != null ? (
          <span className="tabular">{fmtRsHh(m.rsPorHh)}</span>
        ) : (
          <span className="prod-cell-pend">—</span>
        ),
    },
    {
      // razão real÷contratada do mês — já vinha do banco em toda linha, só não era exibida
      key: "aderencia",
      label: "Aderência",
      width: "0.9fr",
      align: "right",
      render: (m) =>
        m.aderencia != null ? (
          <span className="tabular">{fmtPct(m.aderencia)}</span>
        ) : (
          <span className="prod-cell-pend">—</span>
        ),
    },
  ];
  return <DataTable columns={cols} rows={rows} getRowId={(m) => `${m.ano}-${m.mes}`} />;
}
