// Central de Subcontratos (tela nova · abaixo do RMA Mensal) — spec "Central de Subcontratos
// (C.7)" SBSO. Tudo LIDO das tabelas já calculadas do RMA (ver subcontratos.ts); os totais
// exibidos são as âncoras validadas no gate (probe_subcontratos_gate). Corte 30/06/2026 · BM04.
// "Medido subs" (interno ETERC) ≠ "Medido BM04" (faturamento INFRAERO) — nunca somar/confundir.

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Link2,
  PiggyBank,
  Telescope,
} from "lucide-react";
import {
  Badge,
  Card,
  EmptyState,
  ErroCard,
  I,
  ProgressBar,
  Segmented,
  Skeleton,
} from "@/components/ds";
import { ColPag, ColToolbar, ColVazio, useColecao } from "@/lib/rma/colecao";
import { useSubcontratos } from "@/lib/hooks/useSubcontratos";
import type { SubContrato, SubMestre, Subcontratos } from "@/lib/supabase/subcontratos";
import "./subcontratos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/subcontratos")({
  component: SubcontratosPage,
  head: () => ({ meta: [{ title: "Central de Subcontratos — Adm Contratual IA" }] }),
});

const fmtBRL0 = (v: number | null) =>
  v != null ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : "—";
const fmtMi = (v: number | null) =>
  v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";
const fmtPct1 = (v: number | null) =>
  v != null
    ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "—";

// Farol duplo da tabela mestra (regras da spec — dot 8px, tokens semânticos).
function farolHoje(m: SubMestre): { cor: string; titulo: string } {
  if (!m.contratado) return { cor: "var(--text-4)", titulo: "sem contratação" };
  if ((m.economiaJa ?? 0) >= 0) return { cor: "var(--success)", titulo: "economia" };
  return { cor: "var(--danger)", titulo: "contratou acima da PSQ" };
}
function farolFuturo(m: SubMestre): { cor: string; titulo: string } {
  if (!m.saldoExecutar) return { cor: "var(--text-4)", titulo: "fechado" };
  const p = m.potencialFuturo ?? 0;
  if (p > 0) return { cor: "var(--success)", titulo: "potencial de ganho" };
  if (p < 0) return { cor: "var(--danger)", titulo: "risco de estouro" };
  return { cor: "var(--warning)", titulo: "atenção" };
}
const FAROL_CT: Record<
  SubContrato["farol"],
  { tone: "success" | "info" | "warning" | "danger" | "neutral"; label: string }
> = {
  critico: { tone: "danger", label: "Crítico" },
  atencao: { tone: "warning", label: "Observação" },
  emdia: { tone: "success", label: "Em dia" },
  concluido: { tone: "info", label: "Concluído" },
  cancelado: { tone: "neutral", label: "Cancelado" },
};

function SubcontratosPage() {
  const { contractId } = Route.useParams();
  const q = useSubcontratos(contractId);
  if (q.isLoading) {
    return (
      <main className="sub-main">
        <Skeleton style={{ height: 60, width: 520 }} />
        <div className="sub-cards">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 104 }} />
          ))}
        </div>
        <Skeleton style={{ height: 380 }} />
        <Skeleton style={{ height: 320 }} />
      </main>
    );
  }
  if (q.isError) {
    return (
      <main className="sub-main">
        <ErroCard
          titulo="Não foi possível carregar os subcontratos"
          mensagem={q.error instanceof Error ? q.error.message : undefined}
          onRetry={() => void q.refetch()}
        />
      </main>
    );
  }
  const d = q.data;
  if (!d) {
    return (
      <main className="sub-main">
        <Card>
          <EmptyState
            framed
            icon={I.doc({ size: 40 })}
            title="Subcontratos ainda não normalizados"
            text="Esta obra não tem as seções S (Subcontratados) do RMA no banco."
          />
        </Card>
      </main>
    );
  }
  return <SubcontratosView d={d} />;
}

function SubcontratosView({ d }: { d: Subcontratos }) {
  // Duas abas na MESMA tela (decisão de IA: mesmo domínio/fonte → não incha a sidebar):
  // Carteira (9 blocos da spec 1) · Timeline (vigência × avanço, spec 2).
  const [aba, setAba] = useState<"carteira" | "timeline">("carteira");
  return (
    <main className="sub-main">
      <header className="sub-head">
        <div className="sub-head-row">
          <h1 className="sub-titulo">
            <Link2 size={20} aria-hidden /> Central de Subcontratos
          </h1>
          <Segmented<"carteira" | "timeline">
            value={aba}
            onChange={setAba}
            aria-label="Visão dos subcontratos"
            items={[
              { value: "carteira", label: "Carteira" },
              { value: "timeline", label: "Timeline" },
            ]}
          />
        </div>
        <p className="sub-sub">
          carteira de subempreiteiros × PSQ reajustada · corte <b>30/06/2026</b> · <b>BM04</b> ·
          fonte: RMA (tabelas calculadas — lidas, não recalculadas)
        </p>
      </header>
      {aba === "timeline" ? <TimelineSubs d={d} /> : <CarteiraSubs d={d} />}
    </main>
  );
}

function CarteiraSubs({ d }: { d: Subcontratos }) {
  return (
    <>
      {/* ── Bloco 1 · cards ── */}
      <div className="sub-cards">
        <CardKpi
          icone={<Telescope size={15} aria-hidden />}
          label="Ganho total projetado"
          valor={fmtMi(d.tot.conclusaoRs)}
          sub="coluna Conclusão · realizado (fechadas) + projeção (abertas)"
        />
        <CardKpi
          icone={<PiggyBank size={15} aria-hidden />}
          label="Economia JÁ realizada"
          valor={fmtMi(d.tot.economiaJa)}
          sub="Perda/Economia em relação à PSQ (contratado × PSQ do item)"
        />
        <CardKpi
          icone={<CircleDollarSign size={15} aria-hidden />}
          label="Medido subs"
          valor={fmtMi(d.contratosTot.medido)}
          sub={`${fmtPct1(d.contratosTot.pctMed)} da carteira contratada`}
        />
        <CardKpi
          icone={<ClipboardList size={15} aria-hidden />}
          label="Faróis críticos"
          valor={String(d.criticos)}
          sub="medição acima do contrato ou parado com contrato relevante"
          tone={d.criticos > 0 ? "danger" : undefined}
        />
      </div>
      <p className="sub-nota">
        Regra de leitura: economia realizada e potencial futuro <b>não se somam</b> — cada
        disciplina entra uma vez (realizado se fechada, projeção se aberta). O{" "}
        <b>{fmtBRL0(d.tot.potencialFuturo)}</b> é só o saldo não contratado, não o resultado geral.
      </p>

      {/* ── Bloco 2 · tabela mestra ── */}
      <Secao titulo="Tabela mestra da carteira — economia atual × futuro por disciplina">
        <div className="sub-tab-wrap">
          <table className="sub-tab">
            <thead>
              <tr>
                <th>Farol</th>
                <th>Disciplina</th>
                <th className="r">Contratado</th>
                <th className="r">Valor PSQ</th>
                <th className="r">PSQ do item subc.</th>
                <th className="r">Economia já</th>
                <th className="r">Saldo a executar</th>
                <th className="r">Previsto p/ subc.</th>
                <th className="r">Potencial futuro</th>
                <th className="r">Conclusão (R$)</th>
              </tr>
            </thead>
            <tbody>
              {d.mestre.map((m) => {
                const h = farolHoje(m);
                const f = farolFuturo(m);
                return (
                  <tr key={m.n}>
                    <td className="sub-farol2">
                      <span
                        className="sub-dot"
                        style={{ background: h.cor }}
                        title={`hoje: ${h.titulo}`}
                      />
                      <span
                        className="sub-dot"
                        style={{ background: f.cor }}
                        title={`futuro: ${f.titulo}`}
                      />
                    </td>
                    <td className="sub-disc" title={m.conclusaoTxt ?? undefined}>
                      {m.disciplina ?? "—"}
                    </td>
                    <td className="r tabular">{fmtBRL0(m.contratado)}</td>
                    <td className="r tabular">{fmtBRL0(m.valorPsq)}</td>
                    <td className="r tabular">{fmtBRL0(m.psqItemSubc)}</td>
                    <td className={`r tabular ${sinal(m.economiaJa)}`}>{fmtBRL0(m.economiaJa)}</td>
                    <td className="r tabular">{fmtBRL0(m.saldoExecutar)}</td>
                    <td className="r tabular">{fmtBRL0(m.previstoSubc)}</td>
                    <td className={`r tabular ${sinal(m.potencialFuturo)}`}>
                      {fmtBRL0(m.potencialFuturo)}
                    </td>
                    <td className={`r tabular ${sinal(m.conclusaoRs)}`}>
                      {fmtBRL0(m.conclusaoRs)}
                    </td>
                  </tr>
                );
              })}
              <tr className="sub-total">
                <td />
                <td>Total</td>
                <td className="r tabular">{fmtBRL0(d.tot.contratado)}</td>
                <td className="r tabular">{fmtBRL0(d.tot.valorPsq)}</td>
                <td className="r tabular">{fmtBRL0(d.tot.psqItemSubc)}</td>
                <td className="r tabular">{fmtBRL0(d.tot.economiaJa)}</td>
                <td className="r tabular">{fmtBRL0(d.tot.saldoExecutar)}</td>
                <td className="r tabular">{fmtBRL0(d.tot.previstoSubc)}</td>
                <td className={`r tabular ${sinal(d.tot.potencialFuturo)}`}>
                  {fmtBRL0(d.tot.potencialFuturo)}
                </td>
                <td className="r tabular">{fmtBRL0(d.tot.conclusaoRs)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="sub-legenda">
          Farol duplo por linha — <b>hoje</b>: <Dot cor="var(--success)" /> economia ·{" "}
          <Dot cor="var(--danger)" /> contratou acima da PSQ · <Dot cor="var(--text-4)" /> sem
          contratação &nbsp;|&nbsp; <b>futuro</b>: <Dot cor="var(--success)" /> potencial ·{" "}
          <Dot cor="var(--warning)" /> atenção · <Dot cor="var(--danger)" /> risco ·{" "}
          <Dot cor="var(--text-4)" /> fechado
        </p>
      </Secao>

      {/* ── Bloco 3 · onde está a economia ── */}
      <Secao titulo="Onde está a economia — PSQ × Contratado (expanda para o item a item)">
        {d.mestre
          .filter((m) => (m.contratado ?? 0) > 0)
          .map((m) => (
            <details key={m.n} className="sub-exp">
              <summary>
                <span className="sub-exp-disc">{m.disciplina ?? "—"}</span>
                <span className="sub-exp-vals tabular">
                  PSQ do item {fmtBRL0(m.psqItemSubc)} × contratado {fmtBRL0(m.contratado)} →{" "}
                  <b className={sinal(m.economiaJa)}>{fmtBRL0(m.economiaJa)}</b>
                  {(m.saldoExecutar ?? 0) > 0 ? (
                    <span className="sub-exp-parcial">
                      {" "}
                      · +{fmtBRL0(m.saldoExecutar)} saldo não subcontratado (fora da economia)
                    </span>
                  ) : null}
                </span>
                <ChevronDown size={14} className="sub-exp-chev" aria-hidden />
              </summary>
              <DrillItens itens={d.drill.get(m.n) ?? []} />
            </details>
          ))}
        <p className="sub-nota">
          Validação: Σ economia = <b>{fmtBRL0(d.tot.economiaJa)}</b>.
        </p>
      </Secao>

      {/* ── Bloco 4 · onde está o potencial futuro ── */}
      <Secao titulo="Onde está o potencial futuro — Saldo × Projeção">
        {d.mestre
          .filter((m) => (m.saldoExecutar ?? 0) > 0)
          .map((m) => (
            <details key={m.n} className="sub-exp">
              <summary>
                <span className="sub-exp-disc">{m.disciplina ?? "—"}</span>
                <span className="sub-exp-vals tabular">
                  saldo {fmtBRL0(m.saldoExecutar)} × previsto {fmtBRL0(m.previstoSubc)} →{" "}
                  <b className={sinal(m.potencialFuturo)}>{fmtBRL0(m.potencialFuturo)}</b>
                </span>
                <ChevronDown size={14} className="sub-exp-chev" aria-hidden />
              </summary>
              <p className="sub-exp-txt">{m.oQueFalta ?? "—"}</p>
            </details>
          ))}
        <p className="sub-nota">
          Validação: saldo <b>{fmtBRL0(d.tot.saldoExecutar)}</b> · previsto{" "}
          <b>{fmtBRL0(d.tot.previstoSubc)}</b> · potencial{" "}
          <b className={sinal(d.tot.potencialFuturo)}>{fmtBRL0(d.tot.potencialFuturo)}</b>.
        </p>
      </Secao>

      {/* ── Bloco 5 · farol de contratos ── */}
      <FarolContratos contratos={d.contratos} tot={d.contratosTot} />

      {/* ── Bloco 6 · carteira por visão ── */}
      <CarteiraPorVisao d={d} />

      {/* ── Bloco 7 · acompanhamento de medição ── */}
      <Secao
        titulo="Acompanhamento de Medição — subempreiteiros × PSQ liberada"
        sub="“Medido subs” (interno ETERC) ≠ “Medido BM04” (faturamento INFRAERO): medições diferentes"
      >
        <div className="sub-tab-wrap">
          <table className="sub-tab">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th className="r">Contrato subs</th>
                <th className="r">Medido subs</th>
                <th className="r">Saldo a medir</th>
                <th className="r">Medido BM04</th>
                <th className="r">Saldo PSQ</th>
                <th className="r">Potencial liberado</th>
              </tr>
            </thead>
            <tbody>
              {d.medicao.map((m) => (
                <tr key={m.disciplina}>
                  <td className="sub-disc">{m.disciplina}</td>
                  <td className="r tabular">{fmtBRL0(m.totalContrato)}</td>
                  <td className="r tabular">{fmtBRL0(m.medidoSub)}</td>
                  <td className="r tabular">{fmtBRL0(m.saldoMedicao)}</td>
                  <td className="r tabular">{fmtBRL0(m.medidoBm04)}</td>
                  <td className="r tabular">{fmtBRL0(m.saldoPsq)}</td>
                  <td className="r tabular">{fmtBRL0(m.potencialLiberado)}</td>
                </tr>
              ))}
              {d.medicaoTot ? (
                <tr className="sub-total">
                  <td>Total</td>
                  <td className="r tabular">{fmtBRL0(d.medicaoTot.totalContrato)}</td>
                  <td className="r tabular">{fmtBRL0(d.medicaoTot.medidoSub)}</td>
                  <td className="r tabular">{fmtBRL0(d.medicaoTot.saldoMedicao)}</td>
                  <td className="r tabular">{fmtBRL0(d.medicaoTot.medidoBm04)}</td>
                  <td className="r tabular">{fmtBRL0(d.medicaoTot.saldoPsq)}</td>
                  <td className="r tabular">{fmtBRL0(d.medicaoTot.potencialLiberado)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="sub-nota">
          Ponte com o RMA: <b>Medido BM04 = {fmtBRL0(d.medicaoTot?.medidoBm04 ?? null)}</b> — casa
          exato com o faturamento INFRAERO da aba Faturamento.
        </p>
      </Secao>

      {/* ── Bloco 8 · leituras ── */}
      <Secao titulo="Leituras — administração contratual">
        <div className="sub-leituras">
          <Leitura n={1} titulo="Joule parada = pleito subcontratado">
            HVAC R$ 3,65 mi com medição zero e projeto sem aprovação INFRAERO — mesmo fato gerador
            do Módulo 3 (D). Documentar o standby como custo de espera potencial.
          </Leitura>
          <Leitura n={2} titulo="Dois estouros sem aditivo">
            CT011 Pavan &amp; Daron (+26%) e CT012 LM (+21%) mediram acima do contrato. Regularizar
            por aditivo antes do próximo BM.
          </Leitura>
          <Leitura n={3} titulo="Arquitetura exige gestão de perto">
            Ganho de R$ 3,8 mi já obtido, mas faltam R$ 7 mi a contratar contra custo previsto de R$
            7,97 mi — pode consumir o ganho.
          </Leitura>
          <Leitura n={4} titulo="Indireto ligado ao pleito de prazo">
            A folga de R$ 738 k só se mantém se a obra não alongar; cada mês extra consome ~R$ 79 k
            de adm local.
          </Leitura>
        </div>
      </Secao>

      {/* ── Bloco 9 · carteira por edificação ── */}
      <Secao titulo="Carteira por edificação">
        <div className="sub-tab-wrap sub-tab-estreita">
          <table className="sub-tab">
            <thead>
              <tr>
                <th>Edificação</th>
                <th className="r">Contratado subs</th>
                <th className="r">PSQ</th>
                <th className="r">%</th>
              </tr>
            </thead>
            <tbody>
              {d.frentes.map((f, i) => {
                const pct = f.psq ? ((f.contratado ?? 0) / f.psq) * 100 : null;
                return (
                  <tr key={f.frente ?? i}>
                    <td className="sub-disc">
                      <Building2 size={13} aria-hidden /> {f.frente ?? "—"}
                    </td>
                    <td className="r tabular">{fmtBRL0(f.contratado)}</td>
                    <td className="r tabular">{fmtBRL0(f.psq)}</td>
                    <td className={`r tabular ${pct != null && pct > 100 ? "sub-neg" : ""}`}>
                      {pct != null ? `${Math.round(pct)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="sub-total">
                <td>Total</td>
                <td className="r tabular">
                  {fmtBRL0(d.frentes.reduce((s, f) => s + (f.contratado ?? 0), 0))}
                </td>
                <td className="r tabular">
                  {fmtBRL0(d.frentes.reduce((s, f) => s + (f.psq ?? 0), 0))}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Secao>
    </>
  );
}

// ── Timeline (vigência × avanço) — spec 2: só S_SUBCONTRATADOS, sem cruzar com o C.5 ──────────
const TL_CORTE = "2026-06-30"; // hoje = corte BM04
const TL_CONTRATUAL = "2027-03-09"; // término contratual DOS TIMELINES (decisão do dono: manter 09/03)
const TL_ESTADO: Record<string, { cor: string; label: string }> = {
  andamento: { cor: "var(--success)", label: "Em andamento" },
  concluido: { cor: "var(--info)", label: "Concluído" },
  critico: { cor: "var(--danger)", label: "Crítico (estouro/parado)" },
  cancelado: { cor: "var(--text-4)", label: "Cancelado" },
  aprovacao: { cor: "var(--warning)", label: "Em aprovação" },
};
const tlMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

function TimelineSubs({ d }: { d: Subcontratos }) {
  const dataMin = d.timeline[0]?.inicioISO ?? TL_CORTE;
  const dataMax = d.timeline.reduce(
    (m, t) => ((t.terminoISO ?? "") > m ? t.terminoISO! : m),
    TL_CONTRATUAL,
  );
  // janela = 1º dia do mês do menor início → último dia do mês do maior término/contratual
  const ini = tlMs(`${dataMin.slice(0, 7)}-01`);
  const fimMes = new Date(Date.UTC(+dataMax.slice(0, 4), +dataMax.slice(5, 7), 1));
  const fim = fimMes.getTime();
  const pos = (iso: string) => Math.max(0, Math.min(100, ((tlMs(iso) - ini) / (fim - ini)) * 100));
  // ticks trimestrais
  const ticks: Array<{ pct: number; label: string }> = [];
  const MESES = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  for (let t = new Date(ini); t.getTime() < fim; t.setUTCMonth(t.getUTCMonth() + 3)) {
    ticks.push({
      pct: ((t.getTime() - ini) / (fim - ini)) * 100,
      label: `${MESES[t.getUTCMonth()]}/${String(t.getUTCFullYear()).slice(2)}`,
    });
  }
  return (
    <>
      <div className="sub-cards">
        <CardKpi
          icone={<CircleDollarSign size={15} aria-hidden />}
          label="Carteira contratada"
          valor={fmtMi(d.contratosTot.contratado)}
          sub={`${d.timeline.length + d.timelineSemVigencia.length} contratos`}
        />
        <CardKpi
          icone={<PiggyBank size={15} aria-hidden />}
          label="Medido total"
          valor={fmtMi(d.contratosTot.medido)}
          sub={`${fmtPct1(d.contratosTot.pctMed)} da carteira`}
        />
        <CardKpi
          icone={<ClipboardList size={15} aria-hidden />}
          label="Contratos ativos"
          valor={String(d.ativos)}
          sub="STATUS = Em andamento"
        />
        <CardKpi
          icone={<Telescope size={15} aria-hidden />}
          label="Críticos"
          valor={String(d.criticos)}
          sub="estouros CT011/CT012 + parado relevante"
          tone={d.criticos > 0 ? "danger" : undefined}
        />
      </div>

      <Secao
        titulo="Vigência × avanço — 1 barra por contrato"
        sub="início→término da vigência · preenchimento = % medido (satura em 100% no estouro)"
      >
        <div className="sub-tl-eixo">
          <span className="sub-tl-eixo-espaco" />
          <div className="sub-tl-eixo-track">
            {ticks.map((t) => (
              <span key={t.label} className="sub-tl-tick" style={{ left: `${t.pct}%` }}>
                {t.label}
              </span>
            ))}
          </div>
          <span className="sub-tl-eixo-espaco-r" />
        </div>
        <div className="sub-tl">
          {d.timeline.map((t) => {
            const e = TL_ESTADO[t.estado];
            const left = pos(t.inicioISO!);
            const width = Math.max(1.2, pos(t.terminoISO!) - left);
            const fill = Math.max(0, Math.min(100, t.pctMed ?? 0));
            return (
              <div className="sub-tl-row" key={t.numContrato}>
                <span className="sub-tl-label" title={`${t.numContrato} · ${t.nome}`}>
                  <span className="sub-dot" style={{ background: e.cor }} aria-hidden />
                  {t.numContrato.split(/[-/]/)[0]} · {t.nome}
                </span>
                <div className="sub-tl-track">
                  <span
                    className="sub-tl-ref sub-tl-ref-hoje"
                    style={{ left: `${pos(TL_CORTE)}%` }}
                  />
                  <span
                    className="sub-tl-ref sub-tl-ref-contratual"
                    style={{ left: `${pos(TL_CONTRATUAL)}%` }}
                  />
                  <span
                    className="sub-tl-bar"
                    style={{ left: `${left}%`, width: `${width}%`, borderColor: e.cor }}
                    title={`${t.inicioISO} → ${t.terminoISO}`}
                  >
                    <span
                      className="sub-tl-fill"
                      style={{ width: `${fill}%`, background: e.cor }}
                    />
                  </span>
                </div>
                <span className="sub-tl-vals tabular">
                  {t.pctMed != null ? `${Math.round(t.pctMed)}%` : "—"} · {fmtBRL0(t.contratado)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="sub-legenda">
          {Object.values(TL_ESTADO).map((e) => (
            <span key={e.label} className="sub-tl-leg">
              <Dot cor={e.cor} /> {e.label} &nbsp;
            </span>
          ))}
          &nbsp;|&nbsp; <span className="sub-tl-refleg sub-tl-refleg-hoje" /> hoje (corte BM04 ·
          30/06/2026) · <span className="sub-tl-refleg sub-tl-refleg-contratual" /> término
          contratual da obra (09/03/2027)
        </p>
        {d.timelineSemVigencia.length > 0 ? (
          <p className="sub-nota">
            Sem vigência cadastrada (sem barra):{" "}
            {d.timelineSemVigencia.map((t) => `${t.numContrato} (${t.nome})`).join(" · ")}
          </p>
        ) : null}
        <p className="sub-nota">
          Timeline das vigências dos subcontratos — não cruza com o cronograma da obra (C.5).
        </p>
      </Secao>
    </>
  );
}

// ── blocos auxiliares ────────────────────────────────────────────────────────────────────────
const sinal = (v: number | null) => (v == null ? "" : v < 0 ? "sub-neg" : v > 0 ? "sub-pos" : "");

function CardKpi({
  icone,
  label,
  valor,
  sub,
  tone,
}: {
  icone: React.ReactNode;
  label: string;
  valor: string;
  sub: string;
  tone?: "danger";
}) {
  return (
    <article className="sub-card">
      <div className="sub-card-top">
        <span className="sub-card-chip">{icone}</span>
        <span className="sub-card-label">{label}</span>
      </div>
      <div className={`sub-card-valor ${tone === "danger" ? "sub-neg" : ""}`}>{valor}</div>
      <div className="sub-card-sub">{sub}</div>
    </article>
  );
}

function Secao({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sub-secao">
      <div className="sub-secao-h">
        <h3 className="sub-secao-t">{titulo}</h3>
        {sub ? <span className="sub-secao-sub">{sub}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Dot({ cor }: { cor: string }) {
  return <span className="sub-dot" style={{ background: cor }} aria-hidden />;
}

function Leitura({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <article className="sub-leitura">
      <div className="sub-leitura-t">
        <span className="sub-leitura-n">{n}</span> {titulo}
      </div>
      <p className="sub-leitura-txt">{children}</p>
    </article>
  );
}

function DrillItens({
  itens,
}: {
  itens: Array<{ codigo: string | null; descricao: string; valorRs: number | null }>;
}) {
  if (!itens.length)
    return <p className="sub-exp-txt">Sem itens classificados na S-AUX2 para esta disciplina.</p>;
  return (
    <table className="sub-tab sub-tab-drill">
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição</th>
          <th className="r">Valor</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((x, i) => (
          <tr key={`${x.codigo}-${i}`}>
            <td className="tabular">{x.codigo ?? "—"}</td>
            <td>{x.descricao}</td>
            <td className="r tabular">{fmtBRL0(x.valorRs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FarolContratos({
  contratos,
  tot,
}: {
  contratos: SubContrato[];
  tot: { contratado: number; medido: number; saldo: number; pctMed: number | null };
}) {
  const col = useColecao(contratos, {
    busca: (x) => `${x.numContrato} ${x.nome}`,
    ordenacoes: [
      {
        value: "farol",
        label: "Farol (crítico 1º)",
        cmp: (a, b) => {
          const sev: Record<SubContrato["farol"], number> = {
            critico: 4,
            atencao: 3,
            emdia: 2,
            concluido: 1,
            cancelado: 0,
          };
          return sev[b.farol] - sev[a.farol] || (b.contratado ?? 0) - (a.contratado ?? 0);
        },
      },
      {
        value: "valor",
        label: "Maior contrato",
        cmp: (a, b) => (b.contratado ?? 0) - (a.contratado ?? 0),
      },
      {
        value: "ct",
        label: "Nº do contrato",
        cmp: (a, b) => a.numContrato.localeCompare(b.numContrato),
      },
    ],
    perPage: 10,
  });
  return (
    <Secao titulo={`Farol de contratos — ${contratos.length} CTs`}>
      {col.showToolbar ? (
        <ColToolbar col={col} placeholder="Buscar CT ou empresa — ex.: CT011, Joule…" />
      ) : null}
      {col.visible.length === 0 ? (
        <ColVazio termo={col.debounced} rotulo="contrato" onClear={() => col.setQuery("")} />
      ) : (
        <div className="sub-tab-wrap">
          <table className="sub-tab">
            <thead>
              <tr>
                <th>Farol</th>
                <th>Contrato</th>
                <th>Empresa</th>
                <th className="r">Contratado</th>
                <th className="r">Medido</th>
                <th className="r">% med.</th>
                <th className="r">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {col.visible.map((x) => {
                const f = FAROL_CT[x.farol];
                const pct =
                  x.contratado && x.medido != null ? (x.medido / x.contratado) * 100 : null;
                return (
                  <tr key={x.numContrato}>
                    <td>
                      <Badge tone={f.tone}>{f.label}</Badge>
                    </td>
                    <td className="tabular">{x.numContrato}</td>
                    <td className="sub-disc" title={x.nome}>
                      {x.nome}
                    </td>
                    <td className="r tabular">{fmtBRL0(x.contratado)}</td>
                    <td className="r tabular">{fmtBRL0(x.medido)}</td>
                    <td className={`r tabular ${pct != null && pct > 100 ? "sub-neg" : ""}`}>
                      {pct != null ? `${Math.round(pct)}%` : "—"}
                    </td>
                    <td className={`r tabular ${(x.saldo ?? 0) < 0 ? "sub-neg" : ""}`}>
                      {fmtBRL0(x.saldo)}
                    </td>
                  </tr>
                );
              })}
              <tr className="sub-total">
                <td />
                <td>Total</td>
                <td />
                <td className="r tabular">{fmtBRL0(tot.contratado)}</td>
                <td className="r tabular">{fmtBRL0(tot.medido)}</td>
                <td className="r tabular">{fmtPct1(tot.pctMed)}</td>
                <td className="r tabular">{fmtBRL0(tot.saldo)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <ColPag col={col} rotulo="contratos" />
    </Secao>
  );
}

function CarteiraPorVisao({ d }: { d: Subcontratos }) {
  const [visao, setVisao] = useState<"disc" | "sub">("disc");
  const linhas =
    visao === "disc"
      ? d.porDisciplina.map((x) => ({
          nome: x.disciplina,
          contratado: x.contratado,
          medido: x.medido,
        }))
      : d.porSub;
  return (
    <Secao titulo="Carteira por visão">
      <div className="sub-visao-toggle">
        <Segmented<"disc" | "sub">
          value={visao}
          onChange={setVisao}
          aria-label="Visão da carteira"
          items={[
            { value: "disc", label: "Disciplina" },
            { value: "sub", label: "Subempreiteiro" },
          ]}
        />
      </div>
      <div className="sub-visao">
        {linhas
          .filter((l) => l.contratado > 0)
          .map((l) => {
            const pct = l.contratado > 0 ? (l.medido / l.contratado) * 100 : 0;
            return (
              <div className="sub-visao-linha" key={l.nome}>
                <span className="sub-visao-nome" title={l.nome}>
                  {l.nome}
                </span>
                <ProgressBar
                  size="sm"
                  value={Math.max(0, Math.min(100, pct))}
                  aria-label={`% medido de ${l.nome}`}
                />
                <span className="sub-visao-vals tabular">
                  {fmtBRL0(l.medido)} / {fmtBRL0(l.contratado)} · {fmtPct1(pct)}
                </span>
              </div>
            );
          })}
      </div>
      {visao === "disc" ? (
        <p className="sub-nota">
          Medido por disciplina lido do Acompanhamento de Medição (a quebra oficial do Excel — o
          medido dos CTs multi-disciplina não vem quebrado na lista de contratos).
        </p>
      ) : null}
    </Secao>
  );
}
