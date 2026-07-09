// M4 · Check-list da Obra · Varredura Setorial Completa (SASBY).
// HONESTO: o diagnóstico por engenharia é output dos 8 agentes setoriais de IA (backend · fase
// final, ainda não existem). Não fabricamos farol/diagnóstico — mostramos a metodologia (8
// engenharias + o que cada agente varre) com status "aguardando agente", sobre a obra REAL.

import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyState, FarolCard, I, type IconName, Skeleton } from "@/components/ds";
import { type SetorSasby, useChecklist } from "@/lib/hooks/useChecklist";
import type { VgViewMeta } from "@/lib/rma/bridgeVisaoGeral";
import "./index.css";

export const Route = createFileRoute("/_app/contracts/$contractId/checklist/")({
  component: ChecklistPage,
  head: () => ({ meta: [{ title: "Check-list da Obra — RDM IA" }] }),
});

// timeZone UTC: as datas ISO (yyyy-mm-dd) são meia-noite UTC; sem isso, em UTC-3 a data
// renderiza 1 dia a menos (ex.: 2029-12-31 → "30 de dez."). Igual às telas-âncora C.1/C.5.
const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtDate = (iso: string) => DATE_FMT.format(new Date(iso));

function ChecklistPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, setores } = useChecklist(contractId);

  return (
    <main className="cl-main">
      <CLHeader />
      {isLoading ? (
        <CLSkeleton />
      ) : isError ? (
        <EmptyState
          framed
          title="Não foi possível carregar o check-list"
          text="Erro ao ler os dados normalizados desta obra. Tente recarregar."
        />
      ) : !data ? (
        <EmptyState
          framed
          title="Check-list ainda não disponível"
          text="Esta obra não tem dado normalizado no banco ainda."
          hint="Aguardando normalização da Camada A"
        />
      ) : (
        <>
          <DiagnosticoGeral />
          <section className="cl-secao">
            <h3 className="cl-secao-titulo">As 8 Engenharias — varredura por agente setorial</h3>
            <div className="cl-grid">
              {setores.map((s) => (
                <SetorCard key={s.slug} s={s} contractId={contractId} />
              ))}
            </div>
          </section>
          <SinteseContrato sintese={data.visao.sinteseResumida} visao={data.visao} />
        </>
      )}
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function CLHeader() {
  return (
    <header className="cl-head">
      <h2 className="cl-titulo">Check-list da Obra · Varredura Setorial Completa</h2>
      <p className="cl-sub">
        Metodologia SASBY · cada engenharia diagnosticada 24/7 por um agente especialista próprio —
        o consultor sênior olhando todos os setores ao mesmo tempo
      </p>
    </header>
  );
}

// ── Diagnóstico Geral (honesto · agentes em mobilização) ─────────────

function DiagnosticoGeral() {
  return (
    <section className="cl-diag">
      <span className="cl-diag-icon" aria-hidden>
        {I.sparkle({ size: 18 })}
      </span>
      <div className="cl-diag-body">
        <h3 className="cl-diag-titulo">Diagnóstico Geral · 8 engenharias monitoradas</h3>
        <p className="cl-diag-texto">
          Os agentes setoriais estão <strong>em mobilização</strong>. A varredura inicial — farol,
          diagnóstico e conduta sugerida de cada engenharia — é publicada após o{" "}
          <strong>BM-01</strong>. Abaixo, o escopo que cada agente acompanha; clique para abrir a
          página do setor.
        </p>
      </div>
      <span className="cl-diag-status">Aguardando varredura</span>
    </section>
  );
}

// ── Setor Card (pendente · sem farol fabricado) ──────────────────────

function SetorCard({ s, contractId }: { s: SetorSasby; contractId: string }) {
  return (
    <Link
      to="/contracts/$contractId/checklist/$setor"
      params={{ contractId, setor: s.slug }}
      className={`cl-setor${s.destaque ? " cl-setor-destaque" : ""}`}
    >
      <header className="cl-setor-head">
        <span className="cl-setor-icon" aria-hidden>
          {I[s.icon as IconName]?.({ size: 18 })}
        </span>
        <div className="cl-setor-codigo">
          <span className="cl-setor-num">{s.codigo}</span> {s.nome}
        </div>
        {s.destaque ? <span className="cl-setor-tag">TRANSVERSAL</span> : null}
      </header>
      <p className="cl-setor-escopo">{s.escopo}</p>
      {s.alimenta ? <p className="cl-setor-alimenta">{s.alimenta}</p> : null}
      <div className="cl-setor-foot">
        <span className="cl-setor-status">
          <span className="cl-setor-dot" aria-hidden />
          Aguardando agente setorial
        </span>
        <span className="cl-setor-link">Abrir setor →</span>
      </div>
    </Link>
  );
}

// ── Síntese do Contrato (real) ───────────────────────────────────────

function SinteseContrato({
  sintese,
  visao,
}: {
  sintese: VgViewMeta["sinteseResumida"];
  visao: VgViewMeta;
}) {
  return (
    <section className="cl-sintese">
      <header className="cl-sintese-head">
        <h3 className="cl-sintese-titulo">
          Síntese do Contrato{" "}
          <span className="cl-sintese-sub">(compartilhada com a Gestão Contratual)</span>
        </h3>
        <p className="cl-sintese-meta">
          Cliente: {sintese.cliente} · {sintese.modalidade} · Assinatura:{" "}
          {fmtDate(sintese.assinaturaISO)}
        </p>
      </header>
      <div className="cl-sintese-kpis">
        <FarolCard
          label="VALOR CONTRATADO"
          icon="wallet"
          value={sintese.valorContratado}
          info="saldo a faturar e BDI na Gestão Contratual"
          accent="neutral"
        />
        <FarolCard
          label="PRAZO CONTRATUAL"
          icon="clock"
          value={sintese.prazoLabel}
          info={`${visao.prazoTotalDias} dias · término ${fmtDate(visao.terminoPrevistoISO)}`}
          accent="neutral"
        />
        <FarolCard
          label="DOCUMENTOS INDEXADOS"
          icon="doc"
          value={sintese.documentosIndexados != null ? `${sintese.documentosIndexados}` : "—"}
          info="acervo processado para a varredura"
          accent="neutral"
        />
        <FarolCard
          label="TACs"
          icon="note"
          value={
            sintese.tacsEmNegociacao == null
              ? "—"
              : sintese.tacsEmNegociacao > 0
                ? `${sintese.tacsEmNegociacao} em negociação`
                : "nenhum"
          }
          info="termos de aditamento contratual"
          accent="neutral"
        />
      </div>
    </section>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────

function CLSkeleton() {
  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      <Skeleton style={{ height: 84 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--s-3)" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 150 }} />
        ))}
      </div>
    </div>
  );
}
