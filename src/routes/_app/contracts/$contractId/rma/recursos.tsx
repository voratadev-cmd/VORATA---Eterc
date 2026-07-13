// Aba "Recursos" (RMA · 5.3.3) — MOD/MOI/Equipamentos, do dado REAL normalizado (Camada A ·
// obra_recursos + obra_recursos_meses). Real-tolerante: lê pela obra via useRecursos.
// HONESTIDADE: em obra pré-execução mostra o PLANO contratado (por função + curva de mobilização);
// o eixo REAL (alocado) fica "—/pendente" e o farol de mobilização PENDENTE — nunca verde sobre
// área cega. Estados completos + busca/ordenação/paginação (CLAUDE.md · coleção com 5+ itens).

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
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
  CardHeader,
  CardSub,
  CardTitle,
  ChartLegend,
  type ChartLegendItem,
  ChartTooltip,
  EmptyState,
  ErroCard,
  I,
  Segmented,
  Skeleton,
} from "@/components/ds";
import {
  ColPag,
  ColToolbar,
  ColVazio,
  type Ordenacao,
  normTxt,
  useColecao,
} from "@/lib/rma/colecao";
import { useRecursos } from "@/lib/hooks/useRecursos";
import { useRecursosDetalhe } from "@/lib/hooks/useRecursosDetalhe";
import { useFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { useRmaCorte, useRmaCorteEfetivo } from "@/lib/hooks/useRmaCorte";
import { useValorAgregadoD4 } from "@/lib/hooks/useValorAgregado";
import type { CategoriaResumo, RecursoDesvio, RecursoTipo } from "@/lib/supabase/recursos";
import type { RecursoDetalheItem, RecursosDetalhe } from "@/lib/supabase/recursosDetalhe";
import type { ValorAgregadoResumo } from "@/lib/supabase/valorAgregado";
import { classificarPorRegra, FAROL_TONE, type FarolLevel } from "@/lib/rma/farol";
import { farolLabel, formatBRL, formatBRLAbbreviated } from "@/lib/mocks/contracts";
import "./recursos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/recursos")({
  component: RecursosAba,
});

const CAT_ICON: Record<RecursoTipo, "users" | "pkg"> = { MOD: "users", MOI: "users", EQP: "pkg" };

function fmtQtde(v: number | null): string {
  return v != null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";
}

// Ranking "Maiores desvios de alocação" da categoria ativa (R$ acum até o BM · real − contratado),
// derivado do detalhamento por função. Fallback p/ a lista global (obra_recursos_desvio) sem detalhe.
function detalheParaDesvios(
  det: RecursosDetalhe | null,
  tipo: RecursoTipo,
  fallback: RecursoDesvio[],
): RecursoDesvio[] {
  if (!det || det[tipo].length === 0) return fallback;
  return [...det[tipo]]
    .sort((a, b) => Math.abs(b.desvioRsBM ?? 0) - Math.abs(a.desvioRsBM ?? 0))
    .map((d) => ({
      recurso: d.funcao,
      contratadoRs: d.contratadoRsBM,
      realRs: d.realRs,
      desvioRs: d.desvioRsBM,
    }));
}

function RecursosAba() {
  const { contractId } = Route.useParams();
  const { data, isLoading, error, refetch } = useRecursos(contractId);
  // corte (mês do BM) p/ acumular recursos "até o BM"; d4 = Valor Agregado (earned value, real).
  // Hooks chamados SEMPRE (rules-of-hooks): override do ?bm vence; ausente = mesCorte do read-model.
  const corteOverride = useRmaCorte();
  const fatCorte = useFaturamentoBm(contractId).data?.mesCorte ?? null;
  const corte = useRmaCorteEfetivo(fatCorte);
  const d4 = useValorAgregadoD4(contractId).data ?? null;
  // Detalhamento por função das abas auxiliares (preenche o catálogo quando obra_recursos é vazio).
  const detalhe = useRecursosDetalhe(contractId).data ?? null;

  const [tipo, setTipo] = useState<RecursoTipo>("MOD");

  if (isLoading) {
    // Skeleton com a forma REAL da tela: 3 KPI cards → grid histograma (1.7fr chart + 2 cards na
    // coluna lateral) → bloco largo (Total Cost / Composição) — sem salto de layout ao hidratar.
    return (
      <main className="rec-main">
        <div className="rec-c04-kpis">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="rec-skel-kpi" />
          ))}
        </div>
        <div className="rec-histo-grid">
          <Skeleton className="rec-skel-chart" />
          <div className="rec-histo-side">
            <Skeleton className="rec-skel-side" />
            <Skeleton className="rec-skel-side" />
          </div>
        </div>
        <Skeleton className="rec-skel-block" />
      </main>
    );
  }
  if (error) {
    // ERRO ≠ PENDÊNCIA: falha de leitura mostra ErroCard (Badge danger + retry), nunca empty neutro.
    return (
      <main className="rec-main">
        <ErroCard
          titulo="Não foi possível carregar os recursos"
          mensagem={error instanceof Error ? error.message : "Erro ao ler o plano de recursos."}
          onRetry={() => void refetch()}
        />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="rec-main">
        <Card>
          <EmptyState
            framed
            icon={I.users({ size: 42 })}
            title="Recursos ainda não normalizados"
            text="O plano de MOD/MOI/EQP (contratado × alocado) aparecerá aqui quando a seção C.4 Recursos for normalizada (Camada A)."
            hint={<Badge tone="info">Aguardando normalização</Badge>}
          />
        </Card>
      </main>
    );
  }

  const cat = data.categorias[tipo];
  // Maiores desvios de alocação POR categoria ativa (corrige o ranking que não trocava com MOD/MOI/EQP).
  // fallbackGlobal: sem detalhe por função → a lista é o ranking GLOBAL (obra_recursos_desvio),
  // sinalizado na UI (nota) em vez de trocar silenciosamente de escopo.
  const fallbackGlobal = !detalhe || detalhe[tipo].length === 0;
  const desviosCat = detalheParaDesvios(detalhe, tipo, data.maioresDesvios);
  // Badge de conservação em 3 estados (contrato do read-model): needs_review → "Em revisão";
  // ressalvas não-vazias → "Conservação com ressalvas" (warning); só sem ressalva → "Conservação OK".
  const temRessalvas = data.ressalvas.length > 0;
  const badgeTone =
    data.status === "needs_review" ? "warning" : temRessalvas ? "warning" : "success";
  const badgeLabel =
    data.status === "needs_review"
      ? "Em revisão"
      : temRessalvas
        ? "Conservação com ressalvas"
        : "Conservação OK";

  return (
    <main className="rec-main">
      <header className="rec-head">
        <div>
          <h2 className="rec-titulo">Recursos · MOD / MOI / Equipamentos</h2>
          <p className="rec-sub">
            Plano contratado por função × equipamento · curva de efetivo · base do Measured Mile
          </p>
        </div>
        <div className="rec-actions">
          <Segmented<RecursoTipo>
            value={tipo}
            onChange={setTipo}
            items={[
              { value: "MOD", label: "MOD" },
              { value: "MOI", label: "MOI" },
              { value: "EQP", label: "Equipamentos" },
            ]}
            aria-label="Selecionar tipo de recurso"
          />
          <Badge tone={badgeTone}>{badgeLabel}</Badge>
        </div>
      </header>

      {temRessalvas ? (
        <details className="rec-ressalvas">
          <summary className="rec-ressalvas-head">
            <ChevronRight size={13} strokeWidth={2} className="rec-ressalvas-chev" aria-hidden />
            Ressalvas de conservação ·{" "}
            {data.ressalvas.length === 1 ? "1 ressalva" : `${data.ressalvas.length} ressalvas`}
          </summary>
          <ul className="rec-ressalvas-list">
            {data.ressalvas.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {!cat.temReal ? (
        <aside className="rec-aviso">
          {I.flag({ size: 14 })}
          <span>
            <strong>Sem alocação real em {cat.label} ainda</strong> — o eixo{" "}
            <strong>Real (alocado)</strong> não foi medido. Mostrando o{" "}
            <strong>plano contratado</strong> (fonte declarada). O desvio de mobilização e o farol
            ficam <strong>pendentes</strong> até haver alocação real — sem farol verde sobre área
            cega.
          </span>
        </aside>
      ) : null}

      <section>
        <h3 className="rec-sec">Por categoria — acumulado até o BM (real × contratado)</h3>
        <RecKpis categorias={data.categorias} corte={corte} />
        <p className="rec-nota">
          Farol de alocação por categoria: aderência = real ÷ contratado até o BM (banana com
          banana, em quantidade). Acima do plano = recurso à frente do avanço; abaixo = atrás.
        </p>
      </section>

      <section>
        {/* Um único Segmented MOD/MOI/EQP (o do header) controla a categoria — o duplicado que
            vivia aqui foi removido; o título carrega a categoria ativa. */}
        <h3 className="rec-sec">Histograma de alocação · {cat.label} · mês a mês</h3>
        <div className="rec-histo-grid">
          <div className="rec-histo-chart">
            {cat.serieMensal.length > 0 ? (
              <RecCurvaEfetivo cat={cat} corte={corte} />
            ) : (
              <Card>
                <EmptyState title="Sem histograma" text="Esta categoria não tem série mensal." />
              </Card>
            )}
          </div>
          <aside className="rec-histo-side">
            <RecResumoCat cat={cat} corte={corte} det={detalhe?.[tipo] ?? null} />
            <RecMaioresDesvios
              desvios={desviosCat}
              cat={cat}
              snapshot={!!corteOverride}
              fallbackGlobal={fallbackGlobal}
            />
          </aside>
        </div>
      </section>

      <RecCruzamento contractId={contractId} categorias={data.categorias} />

      <section>
        <h3 className="rec-sec">Faturamento × Recursos · resumo por grupo (ajuste pelo avanço)</h3>
        <div className="rec-grid2">
          <RecTotalCost contractId={contractId} categorias={data.categorias} />
          <RecComposicao contractId={contractId} categorias={data.categorias} />
        </div>
      </section>

      <RecValorAgregado d4={d4} />

      <RecIaStub />
    </main>
  );
}

// ── 3 KPIs por categoria (cross-cat · acumulado até o BM) ────────────────────────────────────────

function RecKpis({
  categorias,
  corte,
}: {
  categorias: Record<RecursoTipo, CategoriaResumo>;
  corte: CorteMes | null;
}) {
  return (
    <div className="rec-c04-kpis">
      {(["MOD", "MOI", "EQP"] as RecursoTipo[]).map((tipo) => {
        const cat = categorias[tipo];
        const a = corte ? acumRecAteCorte(cat, corte) : null;
        // rq===0 até o corte é AMBÍGUO (real não lançado ainda ≠ 0% real) → "Pendente", não um
        // Crítico fabricado. Mesma régua de aderenciaRsAteCorte/Cruzamento (erro de valor = milhões).
        const ader = a && a.rq != null && a.rq > 0 && a.cq > 0 ? a.rq / a.cq : null;
        const farol = farolAlocacao(ader);
        const abaixo = ader != null ? ader < 1 : null;
        const dtc = a && a.rr != null ? a.rr - a.cr : null;
        const diff = a && a.rq != null ? a.rq - a.cq : null;
        return (
          <article key={tipo} className="rec-c04-kpi">
            <div className="rec-c04-kpi-top">
              <span className="rec-c04-kpi-nm">
                <span className="rec-c04-kpi-ic" aria-hidden>
                  {I[CAT_ICON[tipo]]?.({ size: 15 })}
                </span>
                {cat.label}
              </span>
              <Badge tone={farol ? FAROL_TONE[farol] : "neutral"} className="rec-c04-pill">
                {farol ? alocLabel(farol, abaixo) : "Pendente"}
              </Badge>
            </div>
            <div className="rec-c04-kpi-big">
              {ader != null
                ? `${(ader * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                : "—"}
            </div>
            <div className="rec-c04-kpi-hint">aderência acum. (real ÷ contratado até o BM)</div>
            <dl className="rec-c04-kpi-stats">
              <div>
                <dt>Total contrato</dt>
                <dd>{fmtQtde(cat.contratadoQtde)}</dd>
              </div>
              <div>
                <dt>Contratado BM</dt>
                <dd>{a ? fmtQtde(a.cq) : "—"}</dd>
              </div>
              <div>
                <dt>Real BM</dt>
                <dd>{a && a.rq != null ? fmtQtde(a.rq) : "—"}</dd>
              </div>
              <div>
                <dt>Diferença</dt>
                <dd>
                  {diff != null
                    ? `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtQtde(Math.abs(diff))}`
                    : "—"}
                </dd>
              </div>
              <div className="wide">
                <dt>Δ Total Cost</dt>
                <dd className={dtc != null && dtc > 0 ? "rec-c04-neg" : ""}>
                  {dtc != null
                    ? `${dtc > 0 ? "+" : dtc < 0 ? "−" : ""}${formatBRL(Math.abs(dtc))}`
                    : "—"}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

// ── Resumo da categoria (ao lado do histograma · acum até o BM) ──────────────────────────────────

function RecResumoCat({
  cat,
  corte,
  det,
}: {
  cat: CategoriaResumo;
  corte: CorteMes | null;
  det: RecursoDetalheItem[] | null;
}) {
  const a = corte ? acumRecAteCorte(cat, corte) : null;
  // Qtde OFICIAL = Σ do detalhe por função (eixo QTD/pessoas · L59 O/V) quando existe — o
  // histograma do MOD guarda Hh, que não é o "QTD" da aba (spec C.4). Sem detalhe → histograma.
  const detCq = det?.length ? det.reduce((acc, i) => acc + (i.contratadoQtde ?? 0), 0) : null;
  const detRq = det?.length
    ? det.some((i) => i.realQtde != null)
      ? det.reduce((acc, i) => acc + (i.realQtde ?? 0), 0)
      : null
    : null;
  const cq = detCq ?? a?.cq ?? null;
  const rq = detCq != null ? detRq : (a?.rq ?? null);
  const signedQ = (v: number | null) =>
    v != null ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtQtde(Math.abs(v))}` : "—";
  const signedRs = (v: number | null) =>
    v != null ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatBRLAbbreviated(Math.abs(v))}` : "—";
  const dq = cq != null && rq != null ? rq - cq : null;
  const drs = a && a.rr != null ? a.rr - a.cr : null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Resumo · {cat.label}</CardTitle>
          <CardSub>acumulado até o BM</CardSub>
        </div>
      </CardHeader>
      <table className="rec-resumo-tab">
        <thead>
          <tr>
            <th />
            <th className="v">Contr.</th>
            <th className="v">Real</th>
            <th className="v">Desvio</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Qtde</td>
            <td className="v">{cq != null ? fmtQtde(cq) : "—"}</td>
            <td className="v">{rq != null ? fmtQtde(rq) : "—"}</td>
            <td className="v">{signedQ(dq)}</td>
          </tr>
          <tr>
            <td>R$</td>
            <td className="v">{a ? formatBRLAbbreviated(a.cr) : "—"}</td>
            <td className="v">{a && a.rr != null ? formatBRLAbbreviated(a.rr) : "—"}</td>
            <td className="v">{signedRs(drs)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

// ── Maiores desvios de alocação por recurso (C.4 · ranking R$ acum) ──────────────────────────────
// Coleção 100+ funções/equipamentos → toolkit canônico (busca + ordenação + paginação + contador).

/** Comparador numérico com null POR ÚLTIMO (pendente ≠ 0 — não inventa posição no ranking). */
function cmpNumNullLast(a: number | null, b: number | null, desc: boolean): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return desc ? b - a : a - b;
}

const ORD_DESVIOS: Ordenacao<RecursoDesvio>[] = [
  {
    value: "abs",
    label: "Maior |Δ|",
    cmp: (a, b) =>
      cmpNumNullLast(
        a.desvioRs == null ? null : Math.abs(a.desvioRs),
        b.desvioRs == null ? null : Math.abs(b.desvioRs),
        true,
      ),
  },
  {
    value: "over",
    label: "Δ+ · acima do plano",
    cmp: (a, b) => cmpNumNullLast(a.desvioRs, b.desvioRs, true),
  },
  {
    value: "under",
    label: "Δ− · abaixo do plano",
    cmp: (a, b) => cmpNumNullLast(a.desvioRs, b.desvioRs, false),
  },
  {
    value: "nome",
    label: "Nome (A–Z)",
    cmp: (a, b) => normTxt(a.recurso).localeCompare(normTxt(b.recurso)),
  },
];

function RecMaioresDesvios({
  desvios,
  cat,
  snapshot,
  fallbackGlobal,
}: {
  desvios: RecursoDesvio[];
  cat: CategoriaResumo;
  snapshot?: boolean;
  /** true = ranking global (obra_recursos_desvio) — sem detalhe por função da categoria. */
  fallbackGlobal: boolean;
}) {
  // No fallback global a lista mistura categorias → rótulo neutro "recurso(s)".
  const singular = fallbackGlobal ? "recurso" : cat.singular;
  const plural = fallbackGlobal ? "recursos" : cat.plural;
  const col = useColecao(desvios, {
    busca: (d) => d.recurso,
    ordenacoes: ORD_DESVIOS,
    perPage: 8,
    resetKey: cat.categoria,
  });
  const n = desvios.length;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            Maiores desvios de alocação{fallbackGlobal ? "" : ` · ${cat.label}`}
          </CardTitle>
          <CardSub>
            {n > 0 ? `${n} ${n === 1 ? singular : plural} · ` : ""}R$ acum até o BM · real −
            contratado
            {snapshot ? " · snapshot do último BM (não recorta por período)" : ""}
          </CardSub>
        </div>
      </CardHeader>
      {n === 0 ? (
        <EmptyState
          title="Ranking pendente"
          text="Os maiores desvios de alocação por recurso ainda não foram normalizados."
        />
      ) : (
        <>
          {col.showToolbar ? (
            <ColToolbar
              col={col}
              placeholder={`Buscar ${singular} — ex.: ${cat.categoria === "EQP" ? "escavadeira" : "encarregado"}…`}
            />
          ) : null}
          {col.visible.length === 0 ? (
            <ColVazio
              termo={col.debounced}
              rotulo={singular}
              onClear={() => col.setQuery("")}
              artigo={singular === "função" ? "Nenhuma" : "Nenhum"}
            />
          ) : (
            <table className="rec-md-tab">
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th className="v">Contr.</th>
                  <th className="v">Real</th>
                  <th className="v">Δ</th>
                </tr>
              </thead>
              <tbody>
                {col.visible.map((d, i) => (
                  <tr key={`${d.recurso}-${i}`}>
                    <td className="rec-md-rec" title={d.recurso}>
                      {d.recurso}
                    </td>
                    <td className="v">
                      {d.contratadoRs != null ? formatBRLAbbreviated(d.contratadoRs) : "—"}
                    </td>
                    <td className="v">{d.realRs != null ? formatBRLAbbreviated(d.realRs) : "—"}</td>
                    <td className={`v ${d.desvioRs != null && d.desvioRs > 0 ? "rec-md-pos" : ""}`}>
                      {d.desvioRs != null
                        ? `${d.desvioRs > 0 ? "+" : d.desvioRs < 0 ? "−" : ""}${formatBRLAbbreviated(Math.abs(d.desvioRs))}`
                        : "—"}
                    </td>
                  </tr>
                ))}
                {!fallbackGlobal && n > 1 ? (
                  <tr className="rec-md-totalrow">
                    <td>TOTAL · {cat.label}</td>
                    <td className="v">
                      {formatBRLAbbreviated(desvios.reduce((s, d) => s + (d.contratadoRs ?? 0), 0))}
                    </td>
                    <td className="v">
                      {formatBRLAbbreviated(desvios.reduce((s, d) => s + (d.realRs ?? 0), 0))}
                    </td>
                    <td className="v">
                      {(() => {
                        const t = desvios.reduce((s, d) => s + (d.desvioRs ?? 0), 0);
                        return `${t > 0 ? "+" : t < 0 ? "−" : ""}${formatBRLAbbreviated(Math.abs(t))}`;
                      })()}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
          <ColPag col={col} rotulo={plural} />
          {fallbackGlobal ? (
            <p className="rec-tabela-nota">
              Ranking global (todas as categorias): o detalhamento por {cat.singular} de {cat.label}{" "}
              ainda não foi normalizado — por isso a lista não troca com o seletor MOD/MOI/EQP.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ── Análise IA (pendente honesto — sem geração salva no v45) ─────────────────────────────────────

function RecIaStub() {
  return (
    <section className="rec-ia">
      <header className="rec-ia-head">
        <Badge tone="info" className="rec-ia-badge">
          IA
        </Badge>
        <span className="rec-ia-title">Análise do Período — gerada pelo Adm Contratual IA</span>
      </header>
      <p className="rec-ia-pend">
        Análise ainda não gerada para este BM. Aguardando o Adm Contratual IA cruzar alocação,
        produtividade e valor agregado do período.
      </p>
    </section>
  );
}

// ── Bloco Valor Agregado (AACE 25R-03 · earned value · D.4) ──────────────────────────────────────

const VA_FAROL: Record<string, FarolLevel> = {
  conforme: "conforme",
  observacao: "observacao",
  observação: "observacao",
  risco: "risco",
  critico: "critico",
  crítico: "critico",
};

function RecValorAgregado({ d4 }: { d4: ValorAgregadoResumo | null }) {
  if (!d4 || !d4.total) {
    return (
      <section className="rec-va">
        <header className="rec-sec-head">
          <h3 className="rec-sec">Valor Agregado · perda de produtividade</h3>
        </header>
        <Card>
          <EmptyState
            title="Valor Agregado pendente"
            text="A análise de earned value (D.4) ainda não foi normalizada para esta obra."
            hint={<Badge tone="info">Aguardando normalização</Badge>}
          />
        </Card>
      </section>
    );
  }
  const farolLevel = d4.farolTotal ? VA_FAROL[d4.farolTotal.trim().toLowerCase()] : null;
  const chart = d4.serieMensal.map((m) => ({
    bm: m.periodoLabel ?? `${m.mes}/${m.ano}`,
    va: m.vaAcumRs / 1e6,
    real: m.realAcumRs / 1e6,
    // Perda no ponto (real − VA) — o número que dá nome à seção, visível no tooltip.
    perda: (m.realAcumRs - m.vaAcumRs) / 1e6,
  }));
  const fmtMi = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  const cats: Array<{ key: "mod" | "eqp" | "total"; label: string }> = [
    { key: "mod", label: "MOD" },
    { key: "eqp", label: "EQP" },
    { key: "total", label: "TOTAL" },
  ];
  const linhas: Array<{
    rot: string;
    pick: (c: NonNullable<ValorAgregadoResumo["total"]>) => number | null;
    pct?: boolean;
  }> = [
    { rot: "Valor Agregado (medido)", pick: (c) => c.vaMedidoRs },
    { rot: "Real alocado", pick: (c) => c.realAlocadoRs },
    { rot: "Perda (Real − Medido)", pick: (c) => c.perdaRs },
    { rot: "% sobre o PV", pick: (c) => c.pctPv, pct: true },
  ];
  const fmtPv = (v: number | null) =>
    v != null ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—";

  return (
    <section className="rec-va">
      <header className="rec-sec-head">
        <h3 className="rec-sec">Valor Agregado (AACE 25R-03) · perda de produtividade</h3>
        {farolLevel ? (
          <Badge tone={FAROL_TONE[farolLevel]} className="rec-va-pill">
            {farolLabel[farolLevel]}
          </Badge>
        ) : null}
      </header>

      <div className="rec-va-grid">
        <div className="rec-va-chart-wrap">
          <ChartLegend
            className="rec-va-legend-row"
            items={[
              { label: "Custo real alocado", tipo: "linha", cor: CHART_SERIE_COR.real },
              { label: "Valor agregado (medido)", tipo: "linha", cor: "var(--info)" },
            ]}
          />
          {chart.length > 0 ? (
            <div className="rec-va-chart">
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="bm"
                    tick={{ fontSize: 10, fill: "var(--text-3)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-3)" }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")} mi`}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border-strong)" }}
                    content={<ChartTooltip formatter={fmtMi} />}
                  />
                  {/* Real / Executado = navy canônico (danger fica reservado a desvio/estouro). */}
                  <Line
                    type="monotone"
                    dataKey="real"
                    name="Custo real alocado"
                    stroke={CHART_SERIE_COR.real}
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="va"
                    name="Valor agregado (medido)"
                    stroke="var(--info)"
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                    isAnimationActive={false}
                  />
                  {/* Série invisível: injeta a Perda (real − VA) no payload do tooltip sem
                      desenhar nada — swatch neutro (a cor de veredito fica com o farol). */}
                  <Line
                    type="monotone"
                    dataKey="perda"
                    name="Perda (real − VA)"
                    stroke="var(--text-3)"
                    strokeWidth={0}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Card>
              <EmptyState title="Série mensal pendente" text="Sem medição mensal lançada ainda." />
            </Card>
          )}
        </div>

        <div className="rec-va-side">
          <table className="rec-va-tab">
            <thead>
              <tr>
                <th />
                {cats.map((c) => (
                  <th key={c.key} className="v">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((ln) => (
                <tr key={ln.rot}>
                  <td>{ln.rot}</td>
                  {cats.map((c) => {
                    const cell = d4[c.key];
                    const v = cell ? ln.pick(cell) : null;
                    return (
                      <td key={c.key} className="v">
                        {ln.pct ? fmtPv(v) : v != null ? formatBRL(v) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {d4.servicos.length > 0 ? (
            <div className="rec-va-serv">
              <div className="rec-va-serv-head">VA por serviço medido</div>
              <ul className="rec-va-serv-list">
                {d4.servicos.map((s) => (
                  <li key={s.servico} title={s.servico}>
                    <span className="rec-va-serv-nm">{s.servico}</span>
                    <span className="rec-va-serv-qt">
                      {fmtQtde(s.qtdMedida)} {s.unidade ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="rec-nota">
                Perda = custo alocado − valor agregado; normaliza conforme a produção entra na
                medição.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ── Cruzamento faturamento × recursos (sinal de improdutividade · doc §1) ────
// Compara a aderência acumulada do FATURAMENTO (avanço = real ÷ contratado, derivado do desvio do
// bridge) com a de RECURSOS por categoria (real ÷ contratado, qtde). Mesmo patamar → sem indício de
// perda de produtividade contemporânea; recursos acima do faturamento → indício. Real de recursos
// pendente (BR-101) → cruzamento honesto "não medido" (não fabrica veredito). M3 quantifica fino.

const CRUZ_CATS: RecursoTipo[] = ["MOD", "MOI", "EQP"];

// Folga (pp) entre aderência de recursos e de faturamento antes de sinalizar "indício" — qualitativo,
// NÃO é farol das 4 faixas. Futuro: virar régua por contrato (Settings), como os FAROL_THRESHOLDS.
const GAP_IMPRODUTIVIDADE_PP = 10;

type CorteMes = { ano: number; mes: number };

/** Acumula contratado/real de recursos ATÉ o mês de corte (Σ serieMensal ≤ corte) — mesmo horizonte
 *  do faturamento ("banana com banana"). real null quando a categoria não tem alocação medida. */
function acumRecAteCorte(cat: CategoriaResumo, corte: CorteMes) {
  let cq = 0;
  let cr = 0;
  let rq = 0;
  let rr = 0;
  for (const m of cat.serieMensal) {
    if (m.ano < corte.ano || (m.ano === corte.ano && m.mes <= corte.mes)) {
      cq += m.contratadoQtde;
      cr += m.contratadoRs;
      rq += m.realQtde ?? 0;
      rr += m.realRs ?? 0;
    }
  }
  return { cq, cr, rq: cat.temReal ? rq : null, rr: cat.temReal ? rr : null };
}

/** Aderência R$ de recursos ATÉ o corte (real ÷ contratado) — MESMA base e horizonte do faturamento
 *  (dimensionalmente sã, não mistura homens·mês com unid·mês). null quando pendente/sem contratado.
 *  Exige rr > 0: real medido === 0 até o corte é AMBÍGUO (categoria mobilizou depois × não medida) →
 *  "a medir" em vez de afirmar 0% (e um "Crítico" duro fabricado sobre dado incerto · erro = milhões). */
function aderenciaRsAteCorte(cat: CategoriaResumo, corte: CorteMes): number | null {
  const a = acumRecAteCorte(cat, corte);
  return a.rr != null && a.rr > 0 && a.cr > 0 ? a.rr / a.cr : null;
}

function RecCruzamento({
  contractId,
  categorias,
}: {
  contractId: string;
  categorias: Record<RecursoTipo, CategoriaResumo>;
}) {
  const { data: fatData } = useFaturamentoBm(contractId, useRmaCorte());
  const fatDesvio = fatData?.fat.desvioAcumuladoPct ?? null;
  const fatAderencia = fatDesvio != null && Number.isFinite(fatDesvio) ? 1 + fatDesvio / 100 : null;
  if (fatData == null || fatAderencia == null) return null; // sem faturamento → sem corte/avanço
  const corte = fatData.mesCorte;
  const fatPct = Math.round(fatAderencia * 100);

  // Aderência de recursos ATÉ o corte (mesmo horizonte do faturamento) — não a full-contract.
  const perCat = CRUZ_CATS.map((c) => {
    const p = aderenciaRsAteCorte(categorias[c], corte);
    return { label: categorias[c].label, pct: p != null ? Math.round(p * 100) : null };
  });

  // Consolidado em R$ até o corte (Σ real ÷ Σ contratado), só categorias com real > 0 até o corte.
  let sumReal = 0;
  let sumContr = 0;
  for (const c of CRUZ_CATS) {
    const a = acumRecAteCorte(categorias[c], corte);
    if (a.rr != null && a.rr > 0 && a.cr > 0) {
      sumReal += a.rr;
      sumContr += a.cr;
    }
  }
  const recAderencia = sumContr > 0 ? sumReal / sumContr : null;
  const recPct = recAderencia != null ? Math.round(recAderencia * 100) : null;
  const gap = recAderencia != null ? (recAderencia - fatAderencia) * 100 : null;
  const loss = gap != null && gap > GAP_IMPRODUTIVIDADE_PP;
  const tone = loss ? "warning" : "info";

  return (
    <aside className={`rec-cruz rec-cruz-${tone}`} role="note">
      <div className="rec-cruz-head">
        {I.trending({ size: 14 })} Cruzamento faturamento × recursos · indício de improdutividade?
      </div>
      {/* Camada 1 — os números do JTBD em pares rótulo→valor (tabular-nums), não afogados em prosa. */}
      <dl className="rec-cruz-stats">
        <div className="rec-cruz-stat">
          <dt>Faturamento</dt>
          <dd>{fatPct}%</dd>
        </div>
        {perCat.map((c) => (
          <div className="rec-cruz-stat" key={c.label}>
            <dt>{c.label}</dt>
            <dd>{c.pct != null ? `${c.pct}%` : "—"}</dd>
          </div>
        ))}
        <div className="rec-cruz-stat rec-cruz-stat-hero">
          <dt>Recursos · consolidado</dt>
          <dd>{recPct != null ? `${recPct}%` : "a medir"}</dd>
        </div>
      </dl>
      {/* Camada 2 — o veredito em UMA frase. */}
      <p className="rec-cruz-body">
        {recPct == null ? (
          <>
            A alocação de recursos ainda <strong>não foi medida</strong> — o indício de perda de
            produtividade entra quando a medição for lançada.
          </>
        ) : loss ? (
          <>
            Recursos <strong>{recPct}% acima</strong> do faturamento ({fatPct}%) →{" "}
            <strong>indício de perda de produtividade</strong> (mais recurso para o mesmo avanço).
          </>
        ) : (
          <>
            Recursos {recPct}% × faturamento {fatPct}% — dentro da faixa:{" "}
            <strong>sem indício de perda de produtividade</strong> contemporânea neste BM.
          </>
        )}
      </p>
      {/* Camada 3 — método + ponteiro pro M3. */}
      <p className="rec-cruz-m3">
        Aderência acumulada (real ÷ contratado) até o BM. A quantificação por Total Cost / Valor
        Agregado / Measured Mile fica no <strong>Módulo 3 · Painel de Desequilíbrio</strong>.
      </p>
    </aside>
  );
}

// ── Total Cost + ajuste pelo avanço (Valor Agregado · AACE 25R-03 · doc resumoCruzado) ──
// Por grupo (MOD/MOI/EQP × qtd/R$ + total R$), acum. ATÉ O BM (corte do faturamento): contratado ×
// real, e o AJUSTE: contratado × avanço (= real÷previsto do faturamento) = o que deveria ter sido
// alocado para o avanço efetivo (Valor Agregado). Desvio ajustado = real − ajustado: ≈0 = alocação
// coerente (sem perda de produtividade). Real pendente → real/desvio/farol "—" (o ajustado, que é o
// ALVO, já aparece). Farol pela régua oficial recursos_vs_faturamento (sem magic number).

function fvTc(v: number | null, unit: "qtd" | "rs"): string {
  if (v == null) return "—";
  return unit === "rs"
    ? formatBRLAbbreviated(v)
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

type TcRow = {
  grupo: string;
  unit: "qtd" | "rs";
  contr: number;
  real: number | null;
  ajust: number;
  total?: boolean;
};

function RecTotalCost({
  contractId,
  categorias,
}: {
  contractId: string;
  categorias: Record<RecursoTipo, CategoriaResumo>;
}) {
  const { data: fatData } = useFaturamentoBm(contractId, useRmaCorte());
  const fatDesvio = fatData?.fat.desvioAcumuladoPct ?? null;
  // Number.isFinite: NaN/Infinity NÃO podem vazar p/ o ajustado/farol (defesa em profundidade · pleito).
  const avanco = fatDesvio != null && Number.isFinite(fatDesvio) ? 1 + fatDesvio / 100 : null;
  if (fatData == null || avanco == null) return null; // sem faturamento → sem avanço/corte → sem tabela
  const corte = fatData.mesCorte;
  const avancoPct = Math.round(avanco * 100);

  const rows: TcRow[] = [];
  let totCr = 0;
  let totRr = 0;
  let totAjust = 0;
  for (const c of CRUZ_CATS) {
    const cat = categorias[c];
    const a = acumRecAteCorte(cat, corte);
    rows.push({
      grupo: `${cat.label} · qtd`,
      unit: "qtd",
      contr: a.cq,
      real: a.rq,
      ajust: a.cq * avanco,
    });
    rows.push({
      grupo: `${cat.label} · R$`,
      unit: "rs",
      contr: a.cr,
      real: a.rr,
      ajust: a.cr * avanco,
    });
    totCr += a.cr;
    totAjust += a.cr * avanco;
    if (a.rr != null) totRr += a.rr;
  }
  // Total real só quando TODAS as categorias estão medidas — senão o desvio do total seria artefato
  // da categoria não medida (ex.: MOI 0). Parcial → real/desvio/farol do total "—".
  const todosMedidos = CRUZ_CATS.every((c) => categorias[c].temReal);
  const algumReal = CRUZ_CATS.some((c) => categorias[c].temReal);
  rows.push({
    grupo: "TOTAL · R$",
    unit: "rs",
    contr: totCr,
    real: todosMedidos ? totRr : null,
    ajust: totAjust,
    total: true,
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Total Cost + ajuste pelo avanço</CardTitle>
          <CardSub>
            acum. até {fatData.bmLabel} · contratado × real · ajustado pelo avanço de faturamento (
            {avancoPct}%)
          </CardSub>
        </div>
      </CardHeader>
      <div className="rec-tc-wrap">
        <table className="rec-tc">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Contratado</th>
              <th>Real</th>
              <th>Desvio</th>
              <th>Contr. ajust.</th>
              <th>Desvio ajust.</th>
              <th>Farol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const desvio = r.real != null ? r.real - r.contr : null;
              const desvioAjust = r.real != null ? r.real - r.ajust : null;
              // Métrica do farol em PONTOS PERCENTUAIS: (real − ajust)/contr×100 = (aderência recurso −
              // avanço fat)×100 — a MESMA escala que calibrou a régua e que o painel de Indicadores usa
              // (consistência entre telas). Dividir por `ajust` daria %-do-alvo (1/avanço maior) e
              // acenderia farol mais severo que o de Indicadores p/ o mesmo dado.
              const farol =
                r.real != null && r.contr > 0
                  ? classificarPorRegra(
                      "recursos_vs_faturamento",
                      ((r.real - r.ajust) / r.contr) * 100,
                    )
                  : null;
              return (
                <tr key={r.grupo} className={r.total ? "rec-tc-total" : ""}>
                  <td className="rec-tc-grupo">{r.grupo}</td>
                  <td>{fvTc(r.contr, r.unit)}</td>
                  <td>{fvTc(r.real, r.unit)}</td>
                  {/* Desvio cru (real − contratado) é neutro: estar abaixo do plano no meio da obra é
                      esperado, não risco. O veredito de risco vive no Farol + no Desvio ajustado. */}
                  <td>{fvTc(desvio, r.unit)}</td>
                  <td>{fvTc(r.ajust, r.unit)}</td>
                  {/* Desvio ajustado: vermelho só no OVERSPEND (real acima do Valor Agregado = +) —
                      alinhado à direção do farol; negativo (abaixo do alvo) é Conforme, fica neutro. */}
                  <td className={desvioAjust != null && desvioAjust > 0.0001 ? "rec-tc-neg" : ""}>
                    {fvTc(desvioAjust, r.unit)}
                  </td>
                  <td className="rec-tc-farol">
                    {farol ? (
                      <Badge tone={FAROL_TONE[farol]}>
                        {alocLabel(farol, desvioAjust != null ? desvioAjust < 0 : null)}
                      </Badge>
                    ) : (
                      <span className="rec-tc-pend">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="rec-tc-nota">
        <strong>Contratado ajustado</strong> = contratado × avanço de faturamento (real ÷ previsto ={" "}
        {avancoPct}%) = o que deveria ter sido alocado para o avanço efetivo (Valor Agregado, AACE
        25R-03). <strong>Desvio ajustado</strong> = real − ajustado: ≈ 0 indica alocação coerente
        com o avanço (sem perda de produtividade).
        {!algumReal
          ? " Real por categoria pendente — entra com a medição; o ajustado já mostra o alvo do Valor Agregado."
          : ""}{" "}
        Quantificação completa no Módulo 3 · Painel de Desequilíbrio (D.4).
      </p>
    </Card>
  );
}

// ── Farol por categoria (desvio de alocação · real vs contratado até o BM) ──
// Distinto do farol do Total Cost (que é vs Valor Agregado): aqui é aderência ao PLANO (em torno de
// 100%), em bandas simétricas do mockup C.4. "Mede desvio de alocação (acima/abaixo), não
// criticidade contratual." Real pendente (BR-101) → "— a medir" + farol "—" (sem fabricar).

// Bandas simétricas de |aderência − 100%| (pp). Não cabem na régua monotônica do farol.ts (over E
// under são ruins); futura régua por contrato (Settings). Nomeadas p/ auditabilidade (sem magic solto).
const ALOC_DESVIO_PP = { conforme: 5, observacao: 15, risco: 30 };

function farolAlocacao(aderencia: number | null): FarolLevel | null {
  if (aderencia == null) return null;
  const desvioPp = Math.abs(aderencia * 100 - 100);
  if (desvioPp <= ALOC_DESVIO_PP.conforme) return "conforme";
  if (desvioPp <= ALOC_DESVIO_PP.observacao) return "observacao";
  if (desvioPp <= ALOC_DESVIO_PP.risco) return "risco";
  return "critico";
}

// Vocabulário canônico do farol (Regra do Farol §2/§8): Conforme/Observação/Risco/Crítico via
// farolLabel — o antigo mapa local "Em conformidade/Observar/Alerta/Defasado" foi vetado pelo
// revisor (viola os 4 níveis fixos). A direção do desvio (abaixo/acima do plano) segue como sufixo.
// rótulo + direção (abaixo/acima do plano) quando há desvio. "Conforme" dispensa direção.
function alocLabel(farol: FarolLevel, abaixo: boolean | null): string {
  const base = farolLabel[farol];
  if (farol === "conforme" || abaixo == null) return base;
  return `${base} · ${abaixo ? "abaixo" : "acima"}`;
}

// ── Composição da equipe (participação por quantidade até o BM · contratado × real) ──
// Por QUANTIDADE (cabeças/equip acumulados até o BM), como o mockup: participação de cada grupo na
// EQUIPE. % Real pendente até a medição. (A participação por custo em R$ vive no Total Cost; aqui é
// "composição da equipe" = quem é quantos, não quanto custa.)

function RecComposicao({
  contractId,
  categorias,
}: {
  contractId: string;
  categorias: Record<RecursoTipo, CategoriaResumo>;
}) {
  const { data: fatData } = useFaturamentoBm(contractId, useRmaCorte());
  if (fatData == null) return null;
  const corte = fatData.mesCorte;
  const acc = CRUZ_CATS.map((c) => {
    const a = acumRecAteCorte(categorias[c], corte);
    // por QUANTIDADE (cabeças), não R$ — "composição da equipe" = headcount, igual ao mockup.
    return { label: categorias[c].label, contr: a.cq, real: a.rq };
  });
  const totC = acc.reduce((s, x) => s + x.contr, 0);
  const totR = acc.reduce((s, x) => s + (x.real ?? 0), 0);
  // %Real só com TODAS as categorias medidas — parcial dividiria pelo subconjunto medido e inflaria
  // a participação de quem já foi medido (mesma defesa do total do RecTotalCost).
  const todosMedidos = CRUZ_CATS.every((c) => categorias[c].temReal);
  const pct = (v: number, tot: number) =>
    tot > 0 ? `${((v / tot) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Composição da equipe</CardTitle>
          <CardSub>participação por quantidade até o BM · contratado × real</CardSub>
        </div>
      </CardHeader>
      <div className="rec-comp-bars">
        {acc.map((x) => {
          const pc = totC > 0 ? (x.contr / totC) * 100 : 0;
          const pr = todosMedidos && x.real != null && totR > 0 ? (x.real / totR) * 100 : null;
          return (
            <div className="rec-comp-row" key={x.label}>
              <div className="rec-comp-head">
                <span className="rec-comp-cat">{x.label}</span>
                <span className="rec-comp-val">
                  {pct(x.contr, totC)}
                  {pr != null ? ` → ${pct(x.real ?? 0, totR)}` : ""}
                </span>
              </div>
              <div className="rec-comp-track">
                <span className="rec-comp-bar rec-comp-bar-c" style={{ width: `${pc}%` }} />
              </div>
              {pr != null ? (
                <div className="rec-comp-track">
                  <span className="rec-comp-bar rec-comp-bar-r" style={{ width: `${pr}%` }} />
                </div>
              ) : (
                <div className="rec-comp-pend">real — a medir</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="rec-comp-leg">
        <span>
          <i className="rec-comp-sw rec-comp-sw-c" /> Contratado
        </span>
        {todosMedidos ? (
          <span>
            <i className="rec-comp-sw rec-comp-sw-r" /> Real
          </span>
        ) : null}
      </div>
      {!todosMedidos ? (
        <p className="rec-tc-nota">
          % Contratado = participação de cada grupo na equipe planejada (cabeças) até o BM. % Real
          entra quando todas as categorias forem medidas (parcial distorceria a participação).
        </p>
      ) : null}
    </Card>
  );
}

// ── Curva de efetivo (barras mês + linhas acumuladas · toggle qtde/R$) ───────
// Espelha o mockup C.4: barras = efetivo do mês (contratado + real), linhas = acumulado no eixo
// direito. O toggle alterna o ACUMULADO entre quantidade e custo (R$) — só aparece quando há R$ no
// histograma. Real (barras + linha) só quando medido (temReal); senão, plano contratado honesto
// (sem fabricar real/farol sobre área cega).

type RecChartPonto = {
  periodoLabel: string;
  contratadoMes: number;
  /** null = mês não medido — recharts não desenha (linha/barra param no último medido). */
  realMes: number | null;
  contratadoAcum: number;
  realAcum: number | null;
};

function fmtRecVal(v: number | null | undefined, eixo: "qtde" | "rs"): string {
  if (v == null) return "—";
  return eixo === "rs"
    ? formatBRLAbbreviated(v)
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function RecCurvaEfetivo({ cat, corte }: { cat: CategoriaResumo; corte: CorteMes | null }) {
  const [eixo, setEixo] = useState<"qtde" | "rs">("qtde");
  const temRs = cat.serieMensal.some((m) => m.contratadoRs > 0);
  const eixoEff: "qtde" | "rs" = eixo === "rs" && temRs ? "rs" : "qtde";
  const temReal = cat.temReal;

  // Rótulo do mês de corte do BM na linha do tempo (último mês da série ≤ corte) — a âncora visual
  // que separa o passado medido do futuro planejado (a página inteira acumula "até o BM").
  let corteLabel: string | null = null;
  if (corte) {
    for (const m of cat.serieMensal) {
      if (m.ano < corte.ano || (m.ano === corte.ano && m.mes <= corte.mes)) {
        corteLabel = m.periodoLabel;
      }
    }
  }
  const temPico = cat.picoQtde > 0 && cat.picoLabel !== "—";

  // Acumula a série mês a mês. As BARRAS são sempre quantidade do mês; só as LINHAS (acumulado)
  // alternam entre qtde e R$. O REAL (barra + linha acum.) PARA no último mês MEDIDO — depois é
  // null e o recharts não desenha (PENDENTE ≠ 0; mesmo padrão do carry pós-BM → NULL das Curvas).
  const chartData = useMemo<RecChartPonto[]>(() => {
    let ultimoMedido = -1;
    cat.serieMensal.forEach((m, i) => {
      if (m.realQtde != null || m.realRs != null) ultimoMedido = i;
    });
    let cq = 0;
    let rq = 0;
    let cr = 0;
    let rr = 0;
    return cat.serieMensal.map((m, i) => {
      cq += m.contratadoQtde;
      rq += m.realQtde ?? 0;
      cr += m.contratadoRs;
      rr += m.realRs ?? 0;
      const medido = i <= ultimoMedido;
      return {
        periodoLabel: m.periodoLabel,
        contratadoMes: m.contratadoQtde,
        realMes: medido ? m.realQtde : null,
        contratadoAcum: eixoEff === "rs" ? cr : cq,
        realAcum: medido ? (eixoEff === "rs" ? rr : rq) : null,
      };
    });
  }, [cat, eixoEff]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Curva de efetivo · {cat.label}</CardTitle>
          <CardSub>
            Barras = efetivo do mês · linhas = acumulado (eixo direito) ·{" "}
            {eixoEff === "rs" ? "custo R$" : cat.unidade}
            {temPico ? ` · pico ${fmtQtde(cat.picoQtde)} em ${cat.picoLabel}` : ""}
            {!temReal ? " · real pendente — mostrando só o plano contratado" : ""}
          </CardSub>
        </div>
        {temRs ? (
          <Segmented<"qtde" | "rs">
            value={eixo}
            onChange={setEixo}
            items={[
              { value: "qtde", label: "Acum. (qtde)" },
              { value: "rs", label: "Custo (R$)" },
            ]}
            aria-label="Alternar acumulado entre quantidade e custo"
          />
        ) : null}
      </CardHeader>

      <div className="rec-legend-row">
        <ChartLegend
          items={
            [
              { label: "Contratado (mês)", tipo: "barra", cor: "var(--text-4)" },
              ...(temReal
                ? [{ label: "Real (mês)", tipo: "barra", cor: CHART_SERIE_COR.real }]
                : []),
              { label: "Contratado acum.", tipo: "linha", cor: CHART_SERIE_COR.contratado },
              ...(temReal
                ? [{ label: "Real acum.", tipo: "linha", cor: CHART_SERIE_COR.real }]
                : []),
            ] as ChartLegendItem[]
          }
        />
        <span className="rec-legend-hint">passe o mouse: efetivo + acumulado do mês</span>
      </div>

      <div className="rec-chart">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 18, right: 12, left: 6, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="periodoLabel"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              // série curta (≤14 meses) mostra todos os rótulos; longa desbasta p/ ~12 marcas
              interval={chartData.length <= 14 ? 0 : Math.floor(chartData.length / 12)}
            />
            {/* eixo esquerdo: barras MENSAIS (efetivo/mês) */}
            <YAxis
              yAxisId="mes"
              tick={{ fontSize: 11, fill: "var(--text-3)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${Number(v).toLocaleString("pt-BR")}`}
            />
            {/* eixo direito: linhas ACUMULADAS (qtde ou R$) */}
            <YAxis
              yAxisId="acum"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--text-4)" }}
              tickLine={false}
              axisLine={false}
              // R$ usa a MESMA abreviação adaptativa (k/mi/bi) do tooltip — eixo e tooltip na mesma
              // escala; evita "R$ 0 mi" em acumulado sub-milhão.
              tickFormatter={(v) =>
                eixoEff === "rs"
                  ? formatBRLAbbreviated(Number(v))
                  : `${Number(v).toLocaleString("pt-BR")}`
              }
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              content={
                <ChartTooltip
                  formatter={{
                    contratadoMes: (v) => fmtRecVal(v, "qtde"),
                    realMes: (v) => fmtRecVal(v, "qtde"),
                    contratadoAcum: (v) => fmtRecVal(v, eixoEff),
                    realAcum: (v) => fmtRecVal(v, eixoEff),
                  }}
                />
              }
            />
            {/* Corte do BM — onde o "acumulado até o BM" da página inteira para na linha do tempo. */}
            {corteLabel != null ? (
              <ReferenceLine
                yAxisId="mes"
                x={corteLabel}
                stroke="var(--text-3)"
                strokeDasharray="3 3"
                label={{
                  value: "corte do BM",
                  position: "top",
                  fontSize: 10,
                  fill: "var(--text-3)",
                }}
              />
            ) : null}
            <Bar
              yAxisId="mes"
              dataKey="contratadoMes"
              name="Contratado (mês)"
              fill="var(--text-4)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            {temReal ? (
              <Bar
                yAxisId="mes"
                dataKey="realMes"
                name="Real (mês)"
                fill={CHART_SERIE_COR.real}
                fillOpacity={0.85}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              yAxisId="acum"
              type="monotone"
              dataKey="contratadoAcum"
              name="Contratado acum."
              stroke={CHART_SERIE_COR.contratado}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            {temReal ? (
              <Line
                yAxisId="acum"
                type="monotone"
                dataKey="realAcum"
                name="Real acum."
                stroke={CHART_SERIE_COR.real}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
            {/* Pico de mobilização contratado (picoQtde/picoLabel do read-model) — a âncora que o
                gerente usa p/ dimensionar canteiro/alojamento. */}
            {temPico ? (
              <ReferenceDot
                yAxisId="mes"
                x={cat.picoLabel}
                y={cat.picoQtde}
                r={3.5}
                fill="var(--text-3)"
                stroke="var(--surface)"
                strokeWidth={1.5}
                isFront
                label={{ value: "pico", position: "top", fontSize: 10, fill: "var(--text-3)" }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
