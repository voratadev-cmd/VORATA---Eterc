// M3 · D.0 Painel de Desequilíbrio (tela-mãe) — consolida as parcelas D.1–D.9 e abre o Gerador de Claim.
// Dado REAL das seções obra_secoes (composição, resumo, quitação, memo, leitura IA). Total e % vêm da
// coluna "Valor (R$)" da Bloco 2, SEM override: total = D.2 BDI + D.1 Indiretos + D.4 Perda (= o que o
// workbook declara). Pendências (prorrogação, força no mérito, contrapleitos, chuva D.6) = "a definir".
//
// EXIBIÇÃO ONDA A: três estados distintos (pendente ≠ zero apurado ≠ não apurado); chuva pendente
// ancorada FORA do total; navegação/escala da composição via src/lib/deseqNav.ts (magnitude navy, sem
// farol); quitação = card do trimestre aberto + cronograma colapsado; erro via ErroCard (≠ pendência);
// glifos → lucide. NENHUM valor renderizado muda — teto/composição/percentuais idênticos.

import { ChevronRight, ArrowRight } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Badge, EmptyState, ErroCard, I, Skeleton } from "@/components/ds";
import { useDesequilibrioPainel } from "@/lib/hooks/useDesequilibrioPainel";
import type { DesequilibrioPainel } from "@/lib/supabase/desequilibrioPainel";
import { type DeseqTela, TELA_DEST, deseqRota, escalaMagnitude } from "@/lib/deseqNav";
import { formatBRL, formatBRLCompact, formatPct } from "@/lib/format";
import "./index.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/")({
  component: DesequilibrioPainelPage,
  head: () => ({ meta: [{ title: "Painel de Desequilíbrio — Adm Contratual IA" }] }),
});

// destino tipado + nº do menu (3.x) por tela D.x — fundação compartilhada em src/lib/deseqNav.ts.
const destOf = (tela: string | null): DeseqTela | undefined =>
  tela ? (TELA_DEST as Record<string, DeseqTela | undefined>)[tela] : undefined;

// procedência do denominador (PV) — só rótulo, o denominador não muda.
const PV_FONTE_LABEL: Record<string, string> = {
  obra: "PV: valor contratual da obra",
  faturamento: "PV: curva de faturamento",
};

function DesequilibrioPainelPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = useDesequilibrioPainel(contractId);

  return (
    <main className="dq-main">
      <header className="dq-head">
        <h2 className="dq-titulo">D.0 — Painel de Desequilíbrio</h2>
        <p className="dq-sub">
          Porta de entrada do Módulo 3. Consolida as parcelas de D.1 a D.9 e abre o Gerador de
          Claim.
        </p>
      </header>
      {isLoading ? (
        <DqSkeleton />
      ) : isError ? (
        <ErroCard
          titulo="Não foi possível carregar o desequilíbrio"
          mensagem={error instanceof Error ? error.message : "Erro ao ler o painel D.0 desta obra."}
          onRetry={() => refetch()}
        />
      ) : !data ? (
        <EmptyState
          framed
          title="Desequilíbrio ainda não calculado"
          text="Esta obra não tem o painel de desequilíbrio (D.0) normalizado no banco ainda."
          hint="Aguardando o módulo M3"
        />
      ) : (
        <DqConteudo p={data} contractId={contractId} />
      )}
    </main>
  );
}

function DqConteudo({ p, contractId }: { p: DesequilibrioPainel; contractId: string }) {
  return (
    <>
      <ResumoHero p={p} />
      <ComposicaoSection p={p} />
      <CenariosSection p={p} contractId={contractId} />
      <AcoesSection contractId={contractId} />
      <QuitacaoSection p={p} />
      {p.leituraIA && <LeituraIA texto={p.leituraIA} />}
    </>
  );
}

// ── Resumo (hero) ───────────────────────────────────────────────────────────────────────────────
function ResumoHero({ p }: { p: DesequilibrioPainel }) {
  const { resumo, valorContratado, valorContratadoFonte } = p;
  const pvFonte = valorContratadoFonte ? PV_FONTE_LABEL[valorContratadoFonte] : null;
  return (
    <section>
      <div className="dq-sec">Resumo do desequilíbrio</div>
      <div className="dq-hero">
        <div className="dq-hero-primary">
          <div className="dq-hero-label">Desequilíbrio total pleiteável (teto)</div>
          <div className="dq-hero-total tabular">{formatBRL(resumo.totalRs)}</div>
          <div className="dq-hero-pct">
            {resumo.pctValorContratual != null
              ? `${formatPct(resumo.pctValorContratual * 100)} do Valor Contratual${
                  valorContratado ? ` · ${formatBRLCompact(valorContratado)}` : ""
                }${pvFonte ? ` · ${pvFonte}` : ""}`
              : "% do Valor Contratual — indisponível (PV não normalizado)"}
          </div>
        </div>
        <div className="dq-hero-stats">
          <div className="dq-hero-stat dq-hero-stat-prov">
            <div className="dq-hero-stat-label">Resultado provável</div>
            <div className="dq-hero-stat-valor tabular">
              {resumo.resultadoProvavelRs != null ? formatBRL(resumo.resultadoProvavelRs) : "—"}
            </div>
            <div className="dq-hero-stat-meta">
              {resumo.pctRecuperacao != null
                ? `${formatPct(resumo.pctRecuperacao * 100)} recuperável · fator do bloco D.11 · Pleitos`
                : "fator de recuperação — bloco D.11 · Pleitos"}
            </div>
          </div>
          <div className="dq-hero-stat">
            <div className="dq-hero-stat-label">Vigente (trimestres em aberto)</div>
            <div className="dq-hero-stat-valor tabular">{formatBRL(resumo.vigenteRs)}</div>
          </div>
          <div className="dq-hero-stat">
            <div className="dq-hero-stat-label">Já quitado</div>
            <div className="dq-hero-stat-valor tabular">{formatBRL(resumo.quitadoRs)}</div>
          </div>
        </div>
      </div>
      <div className="dq-merito">
        <div className="dq-merito-label">Contexto de mérito</div>
        <div className="dq-merito-chips">
          <HeroDef label="Prorrogação estimada (dias)" hint="vem da D.4 / Windows Analysis" />
          <HeroDef label="Força no mérito" hint="base documental + jurídica" />
          <HeroDef label="Exposição a contrapleitos" hint="vem da D.9" />
        </div>
      </div>
    </section>
  );
}

function HeroDef({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="dq-merito-chip">
      <div className="dq-merito-chip-label">{label}</div>
      <div className="dq-merito-chip-valor">a definir</div>
      <div className="dq-merito-chip-hint">{hint}</div>
    </div>
  );
}

// ── Composição por categoria ──────────────────────────────────────────────────────────────────────
function ComposicaoSection({ p }: { p: DesequilibrioPainel }) {
  const cats = [...p.composicao].sort((a, b) => (b.valorRs ?? 0) - (a.valorRs ?? 0));
  // Três estados distintos: apurada com desequilíbrio (>0), zero apurado (=0) e não apurado (null).
  const apuradas = cats.filter((c) => c.valorRs != null && c.valorRs > 0);
  const semDeseq = cats.filter((c) => !(c.valorRs != null && c.valorRs > 0));
  const total = p.resumo.totalRs; // teto canônico — soma SÓ categorias com valor.
  // magnitude (navy, NÃO farol): intensidade relativa à maior parcela apurada.
  const maxApurada = apuradas.reduce((m, c) => Math.max(m, c.valorRs ?? 0), 0);
  const chuvaRs = p.pendentes.chuvaPendenteRs;
  const chuvaMes = p.pendentes.chuvaMesRef;
  return (
    <section>
      <div className="dq-sec">Composição por categoria</div>
      <div className="dq-barwrap">
        {apuradas.map((c) => {
          const valor = c.valorRs ?? 0;
          const pct = total > 0 ? (valor / total) * 100 : 0;
          // 45%..100% de navy conforme a magnitude — matiz único, dark-safe, sem tom semântico.
          const mix = 45 + escalaMagnitude(valor, maxApurada) * 55;
          const tone = `color-mix(in srgb, var(--ink) ${mix}%, var(--surface))`;
          return (
            <div key={`${c.tela ?? ""}-${c.categoria}`} className="dq-barrow">
              <span className="dq-bar-nome">{c.categoria}</span>
              <span className="dq-bar-tela">{c.tela}</span>
              <div className="dq-bar-track">
                {pct > 0 ? (
                  <div className="dq-bar-fill" style={{ width: `${pct}%`, background: tone }} />
                ) : null}
              </div>
              <span className="dq-bar-val tabular">{formatBRL(valor)}</span>
              <span className="dq-bar-pct tabular">{formatPct(pct)}</span>
            </div>
          );
        })}
        {semDeseq.length > 0 ? (
          <details className="dq-sem-deseq">
            <summary className="dq-sem-deseq-sum">
              <ChevronRight size={12} className="dq-sem-deseq-caret" aria-hidden />
              {semDeseq.length} categoria{semDeseq.length > 1 ? "s" : ""} sem desequilíbrio apurado
              nesta obra
            </summary>
            <div className="dq-sem-deseq-lista">
              {semDeseq.map((c) => {
                const isChuvaPend = c.tela === "D.6" && chuvaRs != null;
                return (
                  <div className="dq-sem-deseq-row" key={`${c.tela ?? ""}-${c.categoria}`}>
                    <span className="dq-sem-deseq-nome">{c.categoria}</span>
                    <span className="dq-sem-deseq-tela">{c.tela}</span>
                    {isChuvaPend ? (
                      <Badge tone="warning" className="dq-sem-deseq-badge">
                        {formatBRL(chuvaRs as number)} pendente
                      </Badge>
                    ) : c.valorRs === 0 ? (
                      <span className="dq-sem-deseq-val">R$ 0 · apurado, sem desequilíbrio</span>
                    ) : (
                      <span className="dq-sem-deseq-val">não apurado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}
        <div className="dq-totrow">
          <span className="dq-bar-nome">TOTAL</span>
          <span className="dq-bar-val tabular">{formatBRL(total)}</span>
          <span className="dq-bar-pct tabular">100,0%</span>
        </div>
        {/* Chuva pendente (D.6): ancorada FORA do map e FORA do total — sempre visível. */}
        {chuvaRs != null ? (
          <div className="dq-pendrow">
            <Badge tone="warning">Pendente · D.6</Badge>
            <span className="dq-pendrow-txt tabular">
              {formatBRL(chuvaRs)} de ociosidade por chuva
              {chuvaMes ? ` (${chuvaMes})` : ""} — fora do total pleiteável até validar na D.6
            </span>
          </div>
        ) : null}
      </div>
      {p.memoInsumos?.valorRs != null ? (
        <div className="dq-apart">
          <span>
            {I.plus({ size: 13 })} Excedente de Insumos (D.5) — faturamento direto, fora do teto
            pleiteável
          </span>
          <span className="tabular">{formatBRL(p.memoInsumos.valorRs)}</span>
        </div>
      ) : null}
      {p.memoInsumos?.observacao ? (
        <div className="dq-apart-obs">{p.memoInsumos.observacao}</div>
      ) : null}
    </section>
  );
}

// ── Cenários e métodos ─────────────────────────────────────────────────────────────────────────
function CenariosSection({ p, contractId }: { p: DesequilibrioPainel; contractId: string }) {
  // ordena por valor desc (ecoa a composição); pendentes/fora-do-teto (valor null) ao fim.
  const cenarios = [...p.cenariosMetodos].sort((a, b) => (b.valorRs ?? -1) - (a.valorRs ?? -1));
  return (
    <section>
      <div className="dq-sec">Cenários e métodos calculados</div>
      <div className="dq-mgrid">
        {cenarios.map((c) => {
          const dest = destOf(c.tela);
          const rota = deseqRota(c.tela, contractId);
          // recua (surface-2 + valor text-4) o que está fora do teto ou pendente de validação
          const recuado = c.foraDoTeto || c.pendenteRs != null;
          return (
            <div
              key={c.tela}
              className={`dq-mcard${c.foraDoTeto ? " dq-mcard-apart" : ""}${
                recuado ? " dq-mcard-recuado" : ""
              }`}
            >
              <div className="dq-mcard-top">
                <span className="dq-mcard-cat">{c.categoria}</span>
                <span className="dq-mcard-tela">{c.tela}</span>
              </div>
              <div className="dq-mcard-metodo">{c.metodo}</div>
              <div className="dq-mcard-desc">{c.descricao}</div>
              <div className="dq-mcard-valor tabular">
                {c.valorRs != null ? formatBRL(c.valorRs) : "—"}
              </div>
              {/* Três estados: pendente (Badge warning) · zero apurado · não apurado · nota da parcela. */}
              {c.pendenteRs != null ? (
                <Badge tone="warning" className="dq-mcard-badge">
                  {formatBRL(c.pendenteRs)} pendente de validação
                </Badge>
              ) : c.valorRs === 0 ? (
                <div className="dq-mcard-nota">apurado, sem desequilíbrio</div>
              ) : c.valorRs == null ? (
                <div className="dq-mcard-nota">não apurado</div>
              ) : (
                <div className="dq-mcard-nota">{c.nota}</div>
              )}
              {dest && rota ? (
                <Link {...rota} className="dq-mcard-link">
                  Ver {dest.numero} <ArrowRight size={13} aria-hidden />
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Quitação trimestral (Cláusula 30) ────────────────────────────────────────────────────────────
function QuitacaoSection({ p }: { p: DesequilibrioPainel }) {
  const aberto = p.quitacaoTrimestral.find((t) => t.aberto) ?? p.quitacaoTrimestral[0];
  return (
    <section>
      <div className="dq-sec">
        Quitação trimestral — Cláusula 30: Reivindicações e Quitação Trimestral
      </div>
      <div className="dq-rito">
        {[
          {
            n: "1",
            t: "Reunião trimestral",
            s: "até o 5º dia útil após o fim do trimestre (30.1)",
          },
          {
            n: "2",
            t: "Termo de Quitação Parcial",
            s: "sem pleitos: quitação plena (30.2) · com pleitos: assina com ressalva (30.3)",
          },
          {
            n: "3",
            t: "Relatório pormenorizado",
            s: "cronograma de até 90 dias por ressalva (30.4)",
          },
        ].map((r, i) => (
          <div className="dq-rito-step" key={r.n}>
            <div className="dq-rito-n">{r.n}</div>
            <div>
              <div className="dq-rito-t">{r.t}</div>
              <div className="dq-rito-s">{r.s}</div>
            </div>
            {i < 2 ? <ArrowRight size={16} className="dq-rito-arrow" aria-hidden /> : null}
          </div>
        ))}
      </div>

      {/* Card do trimestre ABERTO — "tenho ação agora?" SEMPRE visível, acima do cronograma. */}
      {aberto ? <TrimestreAbertoCard t={aberto} /> : null}

      {/* Cronograma completo (8 trimestres) — colapsado, a 1 clique. */}
      <details className="dq-crono">
        <summary className="dq-crono-sum">
          <ChevronRight size={12} className="dq-crono-caret" aria-hidden />
          Cronograma completo — {p.quitacaoTrimestral.length} trimestres (Cláusula 30)
        </summary>
        <div className="dq-tabela dq-qtable" role="table">
          <div className="dq-tabela-head" role="row">
            <span role="columnheader">Trim.</span>
            <span role="columnheader">Período</span>
            <span className="r" role="columnheader">
              Valor deseq.
            </span>
            <span role="columnheader">Fim do trim.</span>
            <span role="columnheader">Prazo reunião</span>
            <span role="columnheader">Reunião</span>
            <span role="columnheader">Termo de Quitação</span>
          </div>
          {p.quitacaoTrimestral.map((t) => (
            <div
              className={`dq-tabela-row${t.aberto ? " dq-row-open" : ""}`}
              role="row"
              key={t.trimestre}
            >
              <span className="dq-cell-forte" role="cell">
                {t.trimestre}
              </span>
              <span role="cell">
                {t.periodo ?? "—"}
                {t.bms ? <span className="dq-cell-sub">BMs {t.bms}</span> : null}
              </span>
              <span className="r tabular" role="cell">
                {formatBRL(t.valorDeseqRs ?? 0)}
              </span>
              <span className="tabular" role="cell">
                {fmtData(t.fimTrimestre)}
              </span>
              <span className="tabular" role="cell">
                {fmtData(t.prazoReuniao)}
              </span>
              <span role="cell">
                {t.aberto ? (
                  <span className="dq-badge-due">
                    <span className="dq-dot" aria-hidden />
                    {stripGlyph(t.reuniaoStatus) ?? "Reunião devida"}
                  </span>
                ) : (
                  <span className="dq-cell-pend">aguardando</span>
                )}
              </span>
              <span role="cell">
                {t.aberto ? (
                  (t.termoQuitacao ?? "Pendente — com ressalva")
                ) : (
                  <span className="dq-cell-pend">aguardando</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="dq-tacita">
        {I.lock({ size: 15 })}
        <div>
          <strong>Quitação tácita (30.7):</strong> a Parte que não comparecer à reunião ou recusar
          assinar o Termo concorda tacitamente com a quitação parcial — só as ressalvas notificadas
          sobrevivem; pleitos não notificados não cabem mais.
        </div>
      </div>
    </section>
  );
}

// Card do trimestre em aberto — prazo/status/ressalvas SEMPRE visíveis (rito acionável do momento).
function TrimestreAbertoCard({ t }: { t: DesequilibrioPainel["quitacaoTrimestral"][number] }) {
  return (
    <div className="dq-tab-card">
      <div className="dq-tab-card-head">
        <span className="dq-tab-card-trim">{t.trimestre}</span>
        <span className="dq-tab-card-rotulo">Trimestre em aberto · reunião devida</span>
        <span className="dq-tab-card-status">
          <span className="dq-dot" aria-hidden />
          {stripGlyph(t.reuniaoStatus) ?? "Reunião devida"}
        </span>
      </div>
      <div className="dq-tab-card-grid">
        <div>
          <div className="dq-tab-card-k">Valor do desequilíbrio</div>
          <div className="dq-tab-card-v tabular">{formatBRL(t.valorDeseqRs ?? 0)}</div>
        </div>
        <div>
          <div className="dq-tab-card-k">Fim do trimestre</div>
          <div className="dq-tab-card-v tabular">{fmtData(t.fimTrimestre)}</div>
        </div>
        <div>
          <div className="dq-tab-card-k">Prazo da reunião (5º dia útil)</div>
          <div className="dq-tab-card-v tabular">{fmtData(t.prazoReuniao)}</div>
        </div>
        <div>
          <div className="dq-tab-card-k">Status do trimestre</div>
          <div className="dq-tab-card-v">{t.status ?? "—"}</div>
        </div>
      </div>
      <div className="dq-tab-card-ressalvas">
        <strong>
          {t.termoQuitacao ?? "Termo de Quitação Parcial — pendente, assinar com ressalva"}
        </strong>{" "}
        — notificar e ressalvar os pontos do período; para cada ressalva, acordar cronograma de até
        90 dias para o relatório pormenorizado (30.4).
        {t.periodo ? (
          <div className="dq-tab-card-linha">
            Período: {t.periodo}
            {t.bms ? ` · BMs ${t.bms}` : ""}
          </div>
        ) : null}
        {t.relatorio ? (
          <div className="dq-tab-card-linha">Relatório pormenorizado: {t.relatorio}</div>
        ) : null}
        {t.ressalvas ? (
          <div className="dq-tab-card-linha">Pontos a ressalvar: {t.ressalvas}</div>
        ) : null}
      </div>
    </div>
  );
}

// ── Ações ────────────────────────────────────────────────────────────────────────────────────────
function AcoesSection({ contractId }: { contractId: string }) {
  return (
    <section>
      <div className="dq-sec">Ações</div>
      <div className="dq-acoes">
        <button type="button" className="dq-abtn dq-abtn-primary">
          {I.doc({ size: 14 })} Gerar Relatório de Desequilíbrio
        </button>
        <Link
          to="/contracts/$contractId/desequilibrio/gerador-claim"
          params={{ contractId }}
          className="dq-abtn dq-abtn-claim"
        >
          {I.fire({ size: 14 })} Iniciar Claim Consolidado <ArrowRight size={14} aria-hidden /> 3.10
        </Link>
        <button type="button" className="dq-abtn">
          {I.share({ size: 14 })} Exportar Composição
        </button>
        <button type="button" className="dq-abtn">
          {I.chat({ size: 14 })} Conversar com a Adm Contratual IA
        </button>
      </div>
    </section>
  );
}

// ── Leitura IA ───────────────────────────────────────────────────────────────────────────────────
function LeituraIA({ texto }: { texto: string }) {
  return (
    <section className="dq-ia">
      <div className="dq-ia-tag">{I.note({ size: 12 })} IA · Leitura do painel</div>
      <p className="dq-ia-texto">{texto}</p>
    </section>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

// Remove um glifo de bullet ("●"/"•") que possa vir prefixado no dado — o ponto vira <span> lucide-style.
function stripGlyph(s: string | null): string | null {
  if (s == null) return null;
  const clean = s.replace(/^[●•▸►]\s*/, "").trim();
  return clean === "" ? null : clean;
}

function DqSkeleton() {
  return (
    <>
      <Skeleton variant="block" className="dq-sk-hero" />
      <Skeleton variant="block" className="dq-sk-card" />
      <Skeleton variant="block" className="dq-sk-card" />
    </>
  );
}
