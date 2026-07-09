// Análise da Tela — feature transversal: troca o conteúdo da tela pela análise do Adm Contratual IA
// e permite baixá-la em PDF. Os botões vivem ao lado do título (slot de actions do header).
//
// Dois cenários, um mesmo mecanismo (estado em Context — ver analiseContext.ts):
//  · Tela standalone  → <AnaliseProvider> envolve a tela inteira; Actions no header; Switch no conteúdo.
//  · RMA (layout+abas) → <AnaliseProvider> no layout; Actions no header do layout; Switch envolve o
//    <Outlet/> (a rota-filha da aba ativa). RMA é o único com escopo duplo: "tela" (aba ativa) + "geral".
//
// FASE ATUAL = LAYOUT. A <AnaliseView> é um placeholder premium; o conteúdo real da IA e a geração de
// PDF (o onBaixar) entram nas próximas fases. Sem onBaixar, "Baixar Análise" fica honesto (desabilitado).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { I } from "../icons";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import type {
  RelatorioAba,
  RelatorioGrafico,
  RelatorioSecao,
  RelatorioTabela,
} from "@/lib/relatorio/schema";
import {
  AnaliseCtx,
  useAnalise,
  type AnaliseContexto,
  type AnaliseEscopo,
  type AnaliseModo,
  type AnaliseProviderProps,
  type AnaliseViewProps,
} from "./analiseContext";
import "./Analise.css";

export function AnaliseProvider({
  temGeral = false,
  onBaixar,
  modo: modoProp,
  escopo: escopoProp,
  onChange,
  children,
}: AnaliseProviderProps) {
  const controlado = onChange != null;
  const [localModo, setLocalModo] = useState<AnaliseModo>("tela");
  const [localEscopo, setLocalEscopo] = useState<AnaliseEscopo>("tela");
  const modo = controlado ? (modoProp ?? "tela") : localModo;
  const escopo = controlado ? (escopoProp ?? "tela") : localEscopo;

  const aplicar = useCallback(
    (m: AnaliseModo, e: AnaliseEscopo) => {
      if (onChange) onChange({ modo: m, escopo: e });
      else {
        setLocalModo(m);
        setLocalEscopo(e);
      }
    },
    [onChange],
  );
  const abrir = useCallback((e: AnaliseEscopo = "tela") => aplicar("analise", e), [aplicar]);
  const voltar = useCallback(() => aplicar("tela", "tela"), [aplicar]);
  const setEscopo = useCallback((e: AnaliseEscopo) => aplicar("analise", e), [aplicar]);
  const baixar = useCallback(() => onBaixar?.(escopo), [onBaixar, escopo]);

  const value = useMemo<AnaliseContexto>(
    () => ({
      modo,
      escopo,
      temGeral,
      podeBaixar: Boolean(onBaixar),
      abrir,
      voltar,
      setEscopo,
      baixar,
    }),
    [modo, escopo, temGeral, onBaixar, abrir, voltar, setEscopo, baixar],
  );

  return <AnaliseCtx.Provider value={value}>{children}</AnaliseCtx.Provider>;
}

// ── Botões (drop-in no slot de actions de qualquer header) ───────────────────────────────────────
export function AnaliseActions() {
  const { modo, escopo, temGeral, podeBaixar, abrir, voltar, setEscopo, baixar } = useAnalise();

  const baixarBtn = (
    <button
      type="button"
      className="analise-btn analise-btn-baixar"
      onClick={baixar}
      disabled={!podeBaixar}
      title={podeBaixar ? "Baixar a análise em PDF" : "Geração de PDF — próxima fase"}
    >
      {I.download({ size: 15 })} Baixar Análise
    </button>
  );

  if (modo === "tela") {
    return (
      <div className="analise-actions">
        <button type="button" className="analise-btn analise-btn-ver" onClick={() => abrir("tela")}>
          <span className="analise-ic">{I.trending({ size: 16 })}</span>
          Ver Análise da Tela
        </button>
        {baixarBtn}
      </div>
    );
  }

  return (
    <div className="analise-actions">
      <button type="button" className="analise-btn analise-btn-voltar" onClick={voltar}>
        <span className="analise-back-icon">{I.arrowLeft({ size: 15 })}</span>
        Voltar para a tela
      </button>
      {temGeral ? (
        <div className="analise-escopo" role="tablist" aria-label="Escopo da análise">
          <button
            type="button"
            role="tab"
            aria-selected={escopo === "tela"}
            className={escopo === "tela" ? "on" : ""}
            onClick={() => setEscopo("tela")}
          >
            Esta aba
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={escopo === "geral"}
            className={escopo === "geral" ? "on" : ""}
            onClick={() => setEscopo("geral")}
          >
            RMA inteiro
          </button>
        </div>
      ) : null}
      {baixarBtn}
    </div>
  );
}

// ── Switch: troca o conteúdo da tela pela análise (crossfade) ────────────────────────────────────
// A `tela` permanece MONTADA (só escondida) no modo análise. No RMA isso é essencial: o <Outlet/>
// precisa continuar na árvore p/ a navegação entre abas funcionar sem remontar o layout — senão o
// estado (modo/escopo) zeraria a cada troca de aba. Bônus: preserva scroll/sub-tabs ao voltar.
export function AnaliseSwitch({ tela, analise }: { tela: ReactNode; analise: ReactNode }) {
  const { modo } = useAnalise();
  const emAnalise = modo === "analise";
  return (
    <>
      <div hidden={emAnalise}>{tela}</div>
      {emAnalise ? <div className="analise-pane-in">{analise}</div> : null}
    </>
  );
}

// ── Relatório-documento da análise (renderiza um RelatorioAba REAL gerado pela IA) ───────────────
// Layout de documento de consultoria: capa → sumário → indicadores → leitura c/ gráfico → detalhamento
// → atenção → recomendações → rodapé. O MESMO DOM vira PDF (ver @media print no Analise.css). Os DADOS
// (indicadores, série do gráfico, tabela) vêm do read-model real; a NARRATIVA, da IA (ancorada).

function fmtData(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function n2(n: number): string {
  return String(n).padStart(2, "0");
}

function ChartTooltip({
  active,
  payload,
  label,
  unidade = "%",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  unidade?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rel-tip">
      <div className="rel-tip-m">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="rel-tip-row">
          <span className="rel-tip-dot" style={{ background: p.color }} />
          {p.name}:{" "}
          <b>
            {p.value}
            {unidade}
          </b>
        </div>
      ))}
    </div>
  );
}

// Blocos do relatório (reaproveitados na folha cheia e na miniatura do rail) ──────────────────────

// Gráfico (curva previsto × real) — extraído p/ reuso na Leitura e em cada seção de bloco do
// consolidado. No rail (mini) vira só um placeholder de moldura (recharts não escala em miniatura).
function RelChart({
  grafico,
  mini,
  altura = 260,
}: {
  grafico: RelatorioGrafico | null;
  mini?: boolean;
  altura?: number;
}) {
  if (!grafico || !grafico.serie.length) return null;
  const unidade = grafico.unidade ?? "%";
  return (
    <figure className="rel-fig">
      {mini ? (
        <div className="rel-fig-chart rel-fig-ph" aria-hidden />
      ) : (
        <div className="rel-fig-chart">
          <ResponsiveContainer width="100%" height={altura}>
            <ComposedChart data={grafico.serie} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="relReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="m"
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={34}
                unit={unidade}
              />
              <Tooltip content={<ChartTooltip unidade={unidade} />} />
              <Area
                type="monotone"
                dataKey="real"
                name="Real"
                stroke="var(--brand)"
                strokeWidth={2}
                fill="url(#relReal)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="previsto"
                name="Previsto"
                stroke="var(--text-3)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {grafico.legenda ? <figcaption className="rel-fig-cap">{grafico.legenda}</figcaption> : null}
    </figure>
  );
}

function Capa({ rel, contexto }: { rel: RelatorioAba; contexto?: ReactNode }) {
  const m = rel.meta;
  return (
    <header className="rel-capa">
      <div className="rel-capa-top">
        <span className="rel-brand">
          <span className="rel-brand-medal" aria-hidden>
            {I.sparkle({ size: 16 })}
          </span>
          ADM CONTRATUAL IA
        </span>
        {m.status === "needs_review" ? <span className="rel-prevtag">Revisar citações</span> : null}
      </div>
      <h1 className="rel-titulo">
        Análise da Tela{contexto ? <span className="rel-titulo-ctx"> · {contexto}</span> : null}
      </h1>
      <p className="rel-meta">
        Gerado pelo Adm Contratual IA
        {m.geradoEm ? ` · ${fmtData(m.geradoEm)}` : ""}
        {m.modelo ? ` · ${m.modelo}` : ""}
      </p>
    </header>
  );
}

function SecSumario({ rel, num }: { rel: RelatorioAba; num: string }) {
  const paras = rel.sumarioExecutivo.split("\n\n").filter((p) => p.trim());
  const badge = { tone: farolToBadge[rel.farol], label: farolLabel[rel.farol] };
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> Sumário executivo
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </h2>
      {paras.map((p, i) => (
        <p key={i} className={i === 0 ? "rel-prosa rel-prosa-lead" : "rel-prosa"}>
          {p}
        </p>
      ))}
    </section>
  );
}

function SecIndicadores({ rel, num }: { rel: RelatorioAba; num: string }) {
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> Indicadores-chave
      </h2>
      <div className="rel-kpis">
        {rel.indicadores.map((k) => (
          <div className="rel-kpi" key={k.label}>
            <div className="rel-kpi-label">{k.label}</div>
            <div className="rel-kpi-valor tabular">{k.valor}</div>
            {k.hint ? <div className="rel-kpi-hint">{k.hint}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function SecLeitura({
  rel,
  num,
  mini,
  titulo = "Leitura dos números",
}: {
  rel: RelatorioAba;
  num: string;
  mini?: boolean;
  titulo?: string;
}) {
  const { prosa, grafico } = rel.leitura;
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> {titulo}
      </h2>
      {prosa[0] ? <p className="rel-prosa">{prosa[0]}</p> : null}
      <RelChart grafico={grafico} mini={mini} />
      {prosa.slice(1).map((p, i) => (
        <p key={i} className="rel-prosa">
          {p}
        </p>
      ))}
    </section>
  );
}

// Tabela do relatório (markup puro, reusado no detalhamento principal e nas tabelas extras).
function RelTabela({ t }: { t: RelatorioTabela }) {
  return (
    <table className="rel-tabela">
      <thead>
        <tr>
          {t.colunas.map((c, i) => (
            <th key={i} className={i === 0 ? undefined : "r"}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {t.linhas.map((row, ri) => {
          const isTot = ri === t.linhas.length - 1 && /acum|total/i.test(String(row[0] ?? ""));
          return (
            <tr key={ri} className={isTot ? "rel-tr-tot" : undefined}>
              {row.map((cell, ci) => {
                const cls = [ci === 0 ? "" : "r tabular", ci === t.colDesvio ? "rel-td-neg" : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={ci} className={cls || undefined}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SecDetalhamento({ rel, num }: { rel: RelatorioAba; num: string }) {
  const t = rel.detalhamento;
  if (!t) return null;
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> {t.titulo ?? "Detalhamento mensal"}
      </h2>
      <RelTabela t={t} />
    </section>
  );
}

// Tabela ADICIONAL (após o detalhamento principal) — usada no relatório por-aba para os quadros
// complementares (marcos do cronograma, ranking de desvios, série mensal…).
function SecTabela({ t, num }: { t: RelatorioTabela; num: string }) {
  if (!t.linhas.length) return null;
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> {t.titulo ?? "Detalhamento complementar"}
      </h2>
      <RelTabela t={t} />
    </section>
  );
}

function SecAtencao({ rel, num }: { rel: RelatorioAba; num: string }) {
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> Pontos de atenção
      </h2>
      <ul className="rel-pontos">
        {rel.pontosAtencao.map((p) => (
          <li className="rel-ponto" key={p.titulo}>
            <span className={`rel-ponto-dot rel-dot-${p.tom}`} aria-hidden />
            <div>
              <b className="rel-ponto-ttl">{p.titulo}</b>
              <span className="rel-ponto-txt">{p.texto}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SecRecomendacoes({ rel, num }: { rel: RelatorioAba; num: string }) {
  return (
    <section className="rel-sec">
      <h2 className="rel-sec-ttl">
        <span className="rel-sec-num">{num}</span> Recomendações
      </h2>
      <ol className="rel-recs">
        {rel.recomendacoes.map((r, i) => (
          <li className="rel-rec" key={i}>
            <span className="rel-rec-num">{i + 1}</span>
            <span className="rel-rec-txt">{r}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Página de UM bloco no consolidado (RMA inteiro): cabeçalho com farol + KPIs + gráfico + a análise
// da IA daquele bloco + seus pontos de atenção. Reusa o conteúdo do relatório por-aba (paridade).
function SecaoBloco({
  s,
  num,
  mini,
  kicker,
}: {
  s: RelatorioSecao;
  num: string;
  mini?: boolean;
  kicker?: string;
}) {
  const badge = { tone: farolToBadge[s.farol], label: farolLabel[s.farol] };
  return (
    <section className="rel-sec rel-bloco">
      <div className="rel-bloco-head">
        {kicker ? <p className="rel-bloco-kicker">{kicker}</p> : null}
        <h2 className="rel-sec-ttl">
          <span className="rel-sec-num">{num}</span> {s.titulo}
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </h2>
        {s.resumo ? <p className="rel-bloco-resumo">{s.resumo}</p> : null}
      </div>
      {s.indicadores.length ? (
        <div className="rel-kpis rel-kpis-bloco">
          {s.indicadores.map((k) => (
            <div className="rel-kpi" key={k.label}>
              <div className="rel-kpi-label">{k.label}</div>
              <div className="rel-kpi-valor tabular">{k.valor}</div>
              {k.hint ? <div className="rel-kpi-hint">{k.hint}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      <RelChart grafico={s.grafico} mini={mini} altura={220} />
      {s.prosa.map((p, i) => (
        <p key={i} className={i === 0 ? "rel-prosa rel-prosa-lead" : "rel-prosa"}>
          {p}
        </p>
      ))}
      {s.detalhamento && s.detalhamento.linhas.length ? <RelTabela t={s.detalhamento} /> : null}
      {s.detalhamentoNota ? <p className="rel-fig-cap">{s.detalhamentoNota}</p> : null}
      {(s.tabelas ?? []).map((t, i) =>
        t.linhas.length ? (
          <div className="rel-bloco-tab" key={i}>
            {t.titulo ? <p className="rel-bloco-tab-ttl">{t.titulo}</p> : null}
            <RelTabela t={t} />
          </div>
        ) : null,
      )}
      {s.pontosAtencao.length ? (
        <ul className="rel-pontos rel-pontos-bloco">
          {s.pontosAtencao.map((p) => (
            <li className="rel-ponto" key={p.titulo}>
              <span className={`rel-ponto-dot rel-dot-${p.tom}`} aria-hidden />
              <div>
                <b className="rel-ponto-ttl">{p.titulo}</b>
                <span className="rel-ponto-txt">{p.texto}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Rodape({ rel }: { rel: RelatorioAba }) {
  const m = rel.meta;
  return (
    <footer className="rel-foot">
      <span>
        {I.shield({ size: 13 })} Fontes: read-models normalizados da obra (Camada A/B) · Adm
        Contratual IA
      </span>
      <span className="rel-foot-note">
        {m.status === "needs_review"
          ? "Sinalizado — revisar citação não ancorada"
          : m.geradoEm
            ? `Gerado em ${fmtData(m.geradoEm)}`
            : ""}
      </span>
    </footer>
  );
}

// Páginas A4 do documento (split manual; pagina-se de verdade no PDF via @media print).
// A numeração das seções se adapta. Dois formatos:
//  · por-aba  → 2 folhas (capa+leitura · detalhamento+pontos+recs).
//  · CONSOLIDADO (rel.secoes) → grande documento: capa+síntese · painel geral · 1 folha/bloco · fecho.
type PaginaRender = (o: { rel: RelatorioAba; contexto?: ReactNode; mini?: boolean }) => ReactNode;

function paginasPorAba(rel: RelatorioAba): PaginaRender[] {
  const tabelas = (rel.tabelas ?? []).filter((t) => t.linhas.length);
  const temDet = !!rel.detalhamento;
  const temDados = temDet || tabelas.length > 0;
  // numeração: 01 sumário · 02 indicadores · 03 leitura · 04 detalhamento · 05.. tabelas extras · pontos · recs
  let n = 4;
  const numDet = temDet ? n2(n++) : "";
  const numsTab = tabelas.map(() => n2(n++));
  const numPontos = n2(n++);
  const numRecs = n2(n++);

  const pages: PaginaRender[] = [
    ({ rel, contexto, mini }) => (
      <>
        <Capa rel={rel} contexto={contexto} />
        <SecSumario rel={rel} num="01" />
        {rel.indicadores.length ? <SecIndicadores rel={rel} num="02" /> : null}
        <SecLeitura rel={rel} num="03" mini={mini} />
      </>
    ),
  ];
  if (temDados) {
    pages.push(({ rel }) => (
      <>
        {temDet ? <SecDetalhamento rel={rel} num={numDet} /> : null}
        {(rel.tabelas ?? [])
          .filter((t) => t.linhas.length)
          .map((t, i) => (
            <SecTabela key={i} t={t} num={numsTab[i]} />
          ))}
      </>
    ));
  }
  pages.push(({ rel }) => (
    <>
      {rel.pontosAtencao.length ? <SecAtencao rel={rel} num={numPontos} /> : null}
      {rel.recomendacoes.length ? <SecRecomendacoes rel={rel} num={numRecs} /> : null}
      <Rodape rel={rel} />
    </>
  ));
  return pages;
}

function paginasConsolidado(secoes: RelatorioSecao[]): PaginaRender[] {
  const total = secoes.length;
  return [
    // 1 · Capa + síntese executiva + indicadores-chave do contrato.
    ({ rel, contexto }) => (
      <>
        <Capa rel={rel} contexto={contexto} />
        <SecSumario rel={rel} num="01" />
        {rel.indicadores.length ? <SecIndicadores rel={rel} num="02" /> : null}
      </>
    ),
    // 2 · Panorama geral — curva de faturamento + placar de farol de todos os blocos.
    ({ rel, mini }) => (
      <>
        <SecLeitura rel={rel} num="03" mini={mini} titulo="Panorama geral" />
        {rel.detalhamento ? <SecDetalhamento rel={rel} num="04" /> : null}
      </>
    ),
    // 3..N · Uma folha por bloco do RMA (KPIs + gráfico + análise da IA + pontos do bloco).
    ...secoes.map(
      (s, i): PaginaRender =>
        ({ mini }) => (
          <SecaoBloco
            s={s}
            num={n2(i + 5)}
            mini={mini}
            kicker={`Bloco ${i + 1} de ${total} · detalhamento por frente`}
          />
        ),
    ),
    // Fecho · pontos de atenção consolidados + recomendações do Diretor.
    ({ rel }) => (
      <>
        {rel.pontosAtencao.length ? <SecAtencao rel={rel} num={n2(total + 5)} /> : null}
        {rel.recomendacoes.length ? <SecRecomendacoes rel={rel} num={n2(total + 6)} /> : null}
        <Rodape rel={rel} />
      </>
    ),
  ];
}

function buildPaginas(rel: RelatorioAba): PaginaRender[] {
  return rel.secoes && rel.secoes.length ? paginasConsolidado(rel.secoes) : paginasPorAba(rel);
}

export function AnaliseView({ relatorio, contexto, onGerar }: AnaliseViewProps) {
  const [ativa, setAtiva] = useState(0);

  // Scroll-spy: destaca no rail a página visível no centro da viewport. Re-observa quando o relatório
  // chega (null → dado), pois aí as folhas passam a existir no DOM.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-rel-page]"));
    if (els.length < 2) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setAtiva(Number((e.target as HTMLElement).dataset.relPage));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [relatorio]);

  const irPara = (i: number) => {
    document
      .querySelector(`[data-rel-page="${i}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Ainda não gerado → empty state premium com ação de gerar.
  if (!relatorio) {
    return (
      <div className="rel">
        <div className="rel-empty">
          <span className="rel-empty-medal" aria-hidden>
            {I.sparkle({ size: 30 })}
          </span>
          <h2 className="rel-empty-ttl">Análise ainda não gerada</h2>
          <p className="rel-empty-txt">
            O Adm Contratual IA lê os números desta tela e escreve o relatório completo — sumário,
            leitura dos dados, pontos de atenção e recomendações, pronto para baixar em PDF.
          </p>
          {onGerar ? (
            <Button variant="primary" onClick={onGerar}>
              <span className="rel-empty-ic">{I.sparkle({ size: 15 })}</span> Gerar análise
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const paginas = buildPaginas(relatorio);
  return (
    <div className="rel" aria-label="Relatório de análise da tela">
      <div className="rel-doc">
        <div className="rel-pages">
          {paginas.map((render, i) => (
            <article className="rel-page" data-rel-page={i} key={i}>
              {render({ rel: relatorio, contexto, mini: false })}
            </article>
          ))}
        </div>
        <nav className="rel-rail" aria-label="Páginas do relatório">
          {paginas.map((render, i) => (
            <button
              type="button"
              key={i}
              className={`rel-thumb${ativa === i ? " on" : ""}`}
              onClick={() => irPara(i)}
              aria-current={ativa === i}
              aria-label={`Ir para a página ${i + 1}`}
            >
              <span className="rel-thumb-sheet">
                <span className="rel-thumb-scale" aria-hidden>
                  {render({ rel: relatorio, contexto, mini: true })}
                </span>
              </span>
              <span className="rel-thumb-num">{i + 1}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
