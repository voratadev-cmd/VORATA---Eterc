// M3.10 · Gerador de Claim Consolidado (ápice do M3)
// Wizard de 4 etapas (Stepper do DS): Dossiê → Fundamentação → Quantificação → Documento.
// HONESTIDADE: só a Etapa 3 (Quantificação) é REAL hoje — consolida o desequilíbrio do Painel D.0
// (getDesequilibrio) por categoria + total + farol. As Etapas 1/2/4 dependem de agentes/APIs/pipeline
// .docx → ficam explicitamente pendentes, nunca com dado fabricado. Cenários alto/baixo dependem da
// estratégia do pleito e da defensabilidade → também pendentes (não invento ±%).
//
// REFINO ONDA 3: parcela navega para a tela-fonte (deseqNav · TELA_DEST/deseqRota); barra de composição
// com a MESMA escala de magnitude navy do D.0 (escalaMagnitude, magnitude ≠ farol); categorias sem valor
// nos três estados auditáveis do D.0 (apurado R$ 0 · não apurado) em <details>, não em prosa; guard de
// reconciliação Σ parcelas vs. teto (tolerância <0,01, revela divergência, nunca substitui o canônico).
// NENHUM valor renderizado muda — total/parcelas/percentuais idênticos ao Painel D.0.

import { type ReactNode, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, FileText, FolderSearch, Scale } from "lucide-react";
import { Badge, Button, EmptyState, ErroCard, I, Skeleton, Stepper } from "@/components/ds";
import { type DesequilibrioView, useDesequilibrio } from "@/lib/hooks/useDesequilibrio";
import { classificarPorRegra } from "@/lib/rma/farol";
import { farolLabel, farolToBadge } from "@/lib/mocks/contracts";
import type { DesequilibrioCategoriaReal } from "@/lib/supabase/desequilibrio";
import { TELA_DEST, deseqRota, escalaMagnitude } from "@/lib/deseqNav";
import { formatBRL, formatBRLCents, formatBRLCompact, formatPct } from "@/lib/format";
import "./gerador-claim.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/gerador-claim")({
  component: GeradorClaimPage,
  head: () => ({ meta: [{ title: "3.10 Gerador de Claim — RDM IA" }] }),
});

type EtapaNum = 1 | 2 | 3 | 4;

const ETAPAS: { n: EtapaNum; label: string; hint: string }[] = [
  { n: 1, label: "Dossiê Probatório", hint: "aguardando agente" },
  { n: 2, label: "Fundamentação", hint: "aguardando jurídico" },
  { n: 3, label: "Quantificação", hint: "dado real do D.0" },
  { n: 4, label: "Documento", hint: "aguardando geração" },
];

// Procedência do denominador (PV) — só rótulo, o denominador não muda. Alinha com o D.0.
const PV_FONTE_LABEL: Record<string, string> = {
  obra: "PV: valor contratual da obra",
  faturamento: "PV: curva de faturamento",
};

function GeradorClaimPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = useDesequilibrio(contractId);
  // abre na Quantificação — a única etapa com dado real hoje.
  const [etapa, setEtapa] = useState<EtapaNum>(3);

  return (
    <main className="gc-main">
      <GCHeader nome={data?.nome ?? null} />
      {isLoading ? (
        <GCSkeleton />
      ) : isError ? (
        <ErroCard mensagem={error?.message} onRetry={() => refetch()} />
      ) : !data ? (
        <EmptyState
          framed
          title="Gerador de Claim ainda não disponível"
          text="Esta obra não tem o painel de desequilíbrio (D.0) calculado — sem ele não há o que consolidar."
          hint="Aguardando o módulo M3"
        />
      ) : (
        <GCConteudo v={data} contractId={contractId} etapa={etapa} setEtapa={setEtapa} />
      )}
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function GCHeader({ nome }: { nome: string | null }) {
  return (
    <header className="gc-head">
      <h2 className="gc-titulo">3.10 Gerador de Claim Consolidado</h2>
      <p className="gc-sub">
        Reúne as análises em um pleito completo — dossiê, fundamentação, quantificação e documento
        {nome ? ` · ${nome}` : ""}
      </p>
    </header>
  );
}

// ── Conteúdo ─────────────────────────────────────────────────────────

function GCConteudo({
  v,
  contractId,
  etapa,
  setEtapa,
}: {
  v: DesequilibrioView;
  contractId: string;
  etapa: EtapaNum;
  setEtapa: (n: EtapaNum) => void;
}) {
  // Status por prontidão real: Quantificação (dado do D.0) é a única PRONTA → "done" quando não é a
  // etapa corrente; a etapa aberta é "current"; as demais (agentes/APIs/.docx) seguem "upcoming".
  const steps = ETAPAS.map((e) => ({
    id: String(e.n),
    label: e.label,
    hint: e.hint,
    status: (e.n === etapa ? "current" : e.n === 3 ? "done" : "upcoming") as
      | "done"
      | "current"
      | "upcoming",
  }));

  return (
    <>
      <Stepper
        steps={steps}
        onStepClick={(id) => setEtapa(Number(id) as EtapaNum)}
        ariaLabel="Etapas do gerador de claim"
      />

      {etapa === 1 && (
        <EtapaPendente
          num={1}
          icon={<FolderSearch size={18} aria-hidden />}
          titulo="Dossiê Probatório"
          sub="Varredura e indexação de documentos + Matriz de Nexo Causal"
          texto="A IA varre RDOs, atas, cartas, e-mails e fotos, indexa cada documento, classifica por evento e monta a Matriz de Nexo Causal. Esta etapa entra com os agentes setoriais (M2/M3)."
          itens={[
            "Indexação de cada documento",
            "Classificação por evento",
            "Matriz de Nexo Causal (M2.5.3.9)",
          ]}
        />
      )}
      {etapa === 2 && (
        <EtapaPendente
          num={2}
          icon={<Scale size={18} aria-hidden />}
          titulo="Fundamentação"
          sub="Cláusulas contratuais, jurisprudência e normas técnicas"
          texto="Mapeia as cláusulas aplicáveis, cita doutrina e jurisprudência (Jusbrasil), referencia normas (AACE, IBAPE) e busca precedentes em câmaras arbitrais. Depende do agente jurídico + APIs externas."
          itens={[
            "Cláusulas contratuais aplicáveis",
            "Jurisprudência (Jusbrasil)",
            "Normas AACE/IBAPE + precedentes",
          ]}
        />
      )}
      {etapa === 3 && <EtapaQuantificacao v={v} contractId={contractId} />}
      {etapa === 4 && <EtapaDocumento total={v.deseq.totalRs} />}

      <GCNav etapa={etapa} setEtapa={setEtapa} />
    </>
  );
}

// ── Etapa pendente (1, 2) ───────────────────────────────────────────

function EtapaPendente({
  num,
  icon,
  titulo,
  sub,
  texto,
  itens,
}: {
  num: number;
  icon: ReactNode;
  titulo: string;
  sub: string;
  texto: string;
  itens: string[];
}) {
  return (
    <section className="gc-etapa">
      <EtapaHead num={num} titulo={titulo} sub={sub} />
      <div className="gc-pend">
        <span className="gc-pend-icon">{icon}</span>
        <div className="gc-pend-body">
          <p className="gc-pend-texto">{texto}</p>
          <ul className="gc-pend-list">
            {itens.map((it) => (
              <li key={it}>
                <span className="gc-pend-dot" aria-hidden />
                {it}
                <span className="gc-pend-tag">pendente</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Etapa 3 · Quantificação (REAL · Painel D.0) ─────────────────────

function EtapaQuantificacao({ v, contractId }: { v: DesequilibrioView; contractId: string }) {
  const total = v.deseq.totalRs;
  const pctContrato =
    v.valorContratado && v.valorContratado > 0 ? (total / v.valorContratado) * 100 : null;
  const farol =
    pctContrato != null ? classificarPorRegra("desequilibrio_acumulado", pctContrato) : null;
  const pvFonte = v.valorContratadoFonte ? PV_FONTE_LABEL[v.valorContratadoFonte] : null;

  const comValor = v.deseq.categorias
    .filter((c) => (c.valorRs ?? 0) > 0)
    .sort((a, b) => (b.valorRs ?? 0) - (a.valorRs ?? 0));
  const semValor = v.deseq.categorias.filter((c) => !((c.valorRs ?? 0) > 0));
  // magnitude (navy, NÃO farol): intensidade relativa à maior parcela apurada — igual ao D.0.
  const maxApurada = comValor.reduce((m, c) => Math.max(m, c.valorRs ?? 0), 0);

  // Guard de reconciliação: Σ parcelas (bruto) deve fechar com o teto canônico do D.0 (tolerância
  // <0,01). NUNCA substitui o total — só revela a divergência se ela existir. Por construção do
  // read-model (total = Σ valorRs) fecha; o guard é a rede de segurança contra regressão da fonte.
  const somaParcelas = v.deseq.categorias.reduce((a, c) => a + (c.valorRs ?? 0), 0);
  const reconciliaOk = Math.abs(somaParcelas - total) < 0.01;

  return (
    <section className="gc-etapa">
      <EtapaHead
        num={3}
        titulo="Quantificação"
        sub="Consolidação do desequilíbrio por método · dado do Painel D.0"
        action={
          <Link
            to="/contracts/$contractId/desequilibrio"
            params={{ contractId }}
            className="gc-d0-link"
          >
            Ver Painel D.0 <ArrowRight size={13} aria-hidden />
          </Link>
        }
      />

      <div className="gc-quant-hero">
        <div className="gc-quant-hero-cell">
          <span className="gc-quant-label">VALOR CONSOLIDADO DO PLEITO</span>
          <span className="gc-quant-total">{formatBRL(total)}</span>
          <span className="gc-quant-sub">
            {pctContrato != null ? (
              <>
                {formatPct(pctContrato)} do Valor Contratual
                {v.valorContratado != null ? ` · ${formatBRLCompact(v.valorContratado)}` : ""}
                {pvFonte ? ` · ${pvFonte}` : ""}{" "}
                {farol && <Badge tone={farolToBadge[farol]}>{farolLabel[farol]}</Badge>}
              </>
            ) : (
              "% do Valor Contratual — indisponível (PV não normalizado)"
            )}
          </span>
        </div>
      </div>

      {/* Composição do pleito — barra por método, magnitude navy (escalaMagnitude), NÃO farol. */}
      {comValor.length > 0 && (
        <div className="gc-comp">
          <div className="gc-comp-head">Composição do pleito por método</div>
          <div className="gc-comp-bar" role="img" aria-label="Composição do pleito por método">
            {comValor.map((c) => {
              const valor = c.valorRs ?? 0;
              const pct = total > 0 ? (valor / total) * 100 : 0;
              const mix = 45 + escalaMagnitude(valor, maxApurada) * 55;
              const tone = `color-mix(in srgb, var(--ink) ${mix}%, var(--surface))`;
              return (
                <div
                  key={`seg-${c.tela ?? ""}-${c.categoria}`}
                  className="gc-comp-seg"
                  style={{ width: `${pct}%`, background: tone }}
                  title={`${c.categoria}: ${formatBRLCents(valor)} (${formatPct(pct)})`}
                />
              );
            })}
          </div>
          <div className="gc-comp-legend">
            {comValor.map((c) => {
              const valor = c.valorRs ?? 0;
              const pct = total > 0 ? (valor / total) * 100 : 0;
              const mix = 45 + escalaMagnitude(valor, maxApurada) * 55;
              const tone = `color-mix(in srgb, var(--ink) ${mix}%, var(--surface))`;
              return (
                <span key={`leg-${c.tela ?? ""}-${c.categoria}`} className="gc-comp-leg">
                  <span className="gc-comp-dot" style={{ background: tone }} aria-hidden />
                  {c.categoria}
                  {c.tela ? <span className="gc-comp-leg-tela">{c.tela}</span> : null}
                  <span className="gc-comp-leg-pct tabular">{formatPct(pct)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="gc-quant-tab" role="table" aria-label="Quantificação por método">
        <div className="gc-quant-head" role="row">
          <span role="columnheader">Método / Categoria</span>
          <span className="center" role="columnheader">
            Origem
          </span>
          <span className="right" role="columnheader">
            Valor (R$)
          </span>
          <span className="right" role="columnheader">
            % do total
          </span>
        </div>
        {comValor.map((c) => (
          <QuantRow
            key={`${c.tela ?? ""}-${c.categoria}`}
            c={c}
            total={total}
            contractId={contractId}
          />
        ))}
        <div className="gc-quant-total-row" role="row">
          <span role="cell">TOTAL CONSOLIDADO</span>
          <span className="center" role="cell" />
          <span className="right tabular gc-quant-total-valor" role="cell">
            {formatBRLCents(total)}
          </span>
          <span className="right tabular" role="cell">
            100%
          </span>
        </div>
      </div>

      {/* Guard de reconciliação — só aparece se Σ parcelas divergir do teto (revela, não corrige). */}
      {!reconciliaOk && (
        <p className="gc-recon-alerta" role="alert">
          Divergência de reconciliação: a Σ das parcelas ({formatBRLCents(somaParcelas)}) não fecha
          com o total consolidado do D.0 ({formatBRLCents(total)}). Auditar a fonte antes de emitir
          o claim.
        </p>
      )}

      {/* Categorias sem desequilíbrio apurado — três estados auditáveis (D.0), não prosa. */}
      {semValor.length > 0 && (
        <details className="gc-sem">
          <summary className="gc-sem-sum">
            <ChevronRight size={12} className="gc-sem-caret" aria-hidden />
            {semValor.length} categoria{semValor.length > 1 ? "s" : ""} sem desequilíbrio apurado
            nesta obra
          </summary>
          <div className="gc-sem-lista">
            {semValor.map((c) => (
              <div className="gc-sem-row" key={`sem-${c.tela ?? ""}-${c.categoria}`}>
                <span className="gc-sem-nome">{c.categoria}</span>
                <span className="gc-sem-tela">{c.tela ?? "—"}</span>
                {c.valorRs === 0 ? (
                  <span className="gc-sem-val">R$ 0 · apurado, sem desequilíbrio</span>
                ) : (
                  <span className="gc-sem-val">não apurado</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="gc-quant-nota">
        Cenários alto/baixo dependem da estratégia do pleito e da defensabilidade de cada método —
        entram com o Gerador completo, sem ±% fabricado.
      </p>
    </section>
  );
}

function QuantRow({
  c,
  total,
  contractId,
}: {
  c: DesequilibrioCategoriaReal;
  total: number;
  contractId: string;
}) {
  const valor = c.valorRs ?? 0;
  const pct = total > 0 ? (valor / total) * 100 : null;
  return (
    <div className="gc-quant-row" role="row">
      <span className="gc-quant-cat" role="cell">
        {c.categoria}
      </span>
      <span className="center" role="cell">
        <OrigemLink tela={c.tela} contractId={contractId} />
      </span>
      <span className="right tabular gc-quant-val" role="cell">
        {formatBRLCents(valor)}
      </span>
      <span className="right tabular" role="cell">
        {pct != null ? formatPct(pct) : "—"}
      </span>
    </div>
  );
}

// Chip Origem navegável — resolve a tela-fonte (D.x) da parcela via deseqNav. Sem destino → "—".
function OrigemLink({ tela, contractId }: { tela: string | null; contractId: string }) {
  const rota = deseqRota(tela ?? "", contractId);
  const dest = tela
    ? (TELA_DEST as Record<string, { numero: string } | undefined>)[tela]
    : undefined;
  if (!tela || !rota || !dest) return <span className="gc-quant-tela-off">—</span>;
  return (
    <Link
      {...rota}
      className="gc-quant-tela gc-quant-tela-link"
      title={`Ver ${dest.numero} na tela de origem`}
    >
      {tela}
      <ArrowRight size={11} aria-hidden />
    </Link>
  );
}

// ── Etapa 4 · Documento (pendente) ──────────────────────────────────

function EtapaDocumento({ total }: { total: number }) {
  return (
    <section className="gc-etapa">
      <EtapaHead
        num={4}
        titulo="Geração do Documento"
        sub="Word final formatado · capa, sumário, anexos"
      />
      <div className="gc-pend">
        <span className="gc-pend-icon">
          <FileText size={18} aria-hidden />
        </span>
        <div className="gc-pend-body">
          <p className="gc-pend-texto">
            Produz o Word final a partir de templates de pleitos vencedores em casos similares, com
            capa, sumário, índice e anexos. Depende do pipeline de geração <strong>.docx</strong> —
            ainda não disponível. O valor consolidado a documentar é{" "}
            <strong>{formatBRL(total)}</strong>.
          </p>
          <Button variant="primary" disabled>
            {I.fire({ size: 14 })} Gerar Claim (.docx) — em breve
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Navegação entre etapas ──────────────────────────────────────────

function GCNav({ etapa, setEtapa }: { etapa: EtapaNum; setEtapa: (n: EtapaNum) => void }) {
  return (
    <div className="gc-nav">
      <Button
        variant="outline"
        disabled={etapa <= 1}
        onClick={() => setEtapa((etapa - 1) as EtapaNum)}
      >
        <ChevronLeft size={16} aria-hidden /> Voltar
      </Button>
      <span className="gc-nav-info">Etapa {etapa} de 4</span>
      <Button variant="ink" disabled={etapa >= 4} onClick={() => setEtapa((etapa + 1) as EtapaNum)}>
        Próxima <ChevronRight size={16} aria-hidden />
      </Button>
    </div>
  );
}

// ── Etapa head ───────────────────────────────────────────────────────

function EtapaHead({
  num,
  titulo,
  sub,
  action,
}: {
  num: number;
  titulo: string;
  sub: string;
  action?: ReactNode;
}) {
  return (
    <header className="gc-etapa-head">
      <span className="gc-etapa-num">{num}</span>
      <div className="gc-etapa-head-main">
        <h3 className="gc-etapa-titulo">{titulo}</h3>
        <p className="gc-etapa-sub">{sub}</p>
      </div>
      {action ? <div className="gc-etapa-head-action">{action}</div> : null}
    </header>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────

function GCSkeleton() {
  return (
    <>
      <Skeleton variant="block" className="gc-sk-stepper" />
      <Skeleton variant="block" className="gc-sk-etapa" />
    </>
  );
}
