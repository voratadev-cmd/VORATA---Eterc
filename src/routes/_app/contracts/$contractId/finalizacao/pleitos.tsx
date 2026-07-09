// M5.2 · Negociação de Pleitos
// Suporte às tratativas amigáveis · sugestão de argumentos · calibragem
// de valores · monitoramento de prescrição.

import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { FarolCard, I } from "@/components/ds";
import { getContract } from "@/lib/mocks/contracts";
import type { FarolLevel } from "@/lib/mocks/contracts";
import {
  type Argumentario,
  type NegTimelineTipoTone,
  type NegociacaoPleitosData,
  type NegociacaoTimelineEvento,
  type PleitoCard,
  type PleitoStatus,
  getObra,
} from "@/lib/mocks/obras";
import "./pleitos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/finalizacao/pleitos")({
  component: PleitosPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, np: obra.finalizacao?.negociacaoPleitos ?? null };
  },
  head: () => ({ meta: [{ title: "5.2 Negociação de Pleitos — RDM IA" }] }),
});

type TabKey = "licoes" | "pleitos" | "judicial";

const TAB_FAROL: Record<TabKey, FarolLevel> = {
  licoes: "conforme",
  pleitos: "risco",
  judicial: "critico",
};

const FAROL_COLOR: Record<FarolLevel, string> = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
};

const PLEITO_BORDER: Record<PleitoStatus, string> = {
  acordado: "var(--success)",
  "em-negociacao": "var(--warning)",
  "prescricao-proxima": "var(--danger)",
  "travado-arbitragem": "var(--danger)",
};

const PLEITO_BADGE_BG: Record<PleitoStatus, string> = {
  acordado: "var(--success-bg)",
  "em-negociacao": "var(--warning-bg)",
  "prescricao-proxima": "var(--danger-bg)",
  "travado-arbitragem": "var(--danger-bg)",
};

const PLEITO_BADGE_COLOR: Record<PleitoStatus, string> = {
  acordado: "var(--success)",
  "em-negociacao": "var(--warning)",
  "prescricao-proxima": "var(--danger)",
  "travado-arbitragem": "var(--danger)",
};

const TIPO_TONE_BG: Record<NegTimelineTipoTone, string> = {
  success: "var(--success-bg)",
  danger: "var(--danger-bg)",
  warning: "var(--warning-bg)",
  info: "var(--info-bg)",
  neutral: "var(--surface-2)",
};

const TIPO_TONE_COLOR: Record<NegTimelineTipoTone, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
  neutral: "var(--text-3)",
};

const TABS: { key: TabKey; label: string; to: string }[] = [
  { key: "licoes", label: "Lições Aprendidas", to: "licoes" },
  { key: "pleitos", label: "Negociação de Pleitos", to: "pleitos" },
  { key: "judicial", label: "Análise Judicial / Arbitral", to: "judicial" },
];

function PleitosPage() {
  const { contract, np } = Route.useLoaderData();

  return (
    <main className="np-main">
      <TabBar contractId={contract.id} active="pleitos" />

      {!np ? (
        <div className="np-empty">
          {I.book({ size: 36 })}
          <p>Não há pleitos em negociação para {contract.nome}.</p>
          <p className="np-empty-sub">
            Contratos sem desequilíbrio acumulado ou ainda em execução não geram pleitos pós-obra.
          </p>
        </div>
      ) : (
        <>
          <NPHeader contratoNome={contract.nome} />
          <KpisStrip d={np} />
          <AlertaPrescricao texto={np.alertaPrescricaoTexto} />
          <PleitosLista d={np} />
          <div className="np-grid">
            <TimelineCard d={np} />
            <div className="np-col-right">
              <ArgumentarioCard d={np} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

// ── TabBar ───────────────────────────────────────────────────────────

function TabBar({ contractId, active }: { contractId: string; active: TabKey }) {
  return (
    <nav className="np-tabs" aria-label="Etapas da Finalização">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const to = `/contracts/${contractId}/finalizacao/${t.to}`;
        return (
          <Link
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico
            to={to as any}
            className={`np-tab ${isActive ? "np-tab-active" : ""}`}
          >
            <span
              className="np-tab-dot"
              style={{ background: FAROL_COLOR[TAB_FAROL[t.key]] }}
              aria-hidden="true"
            />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function NPHeader({ contratoNome }: { contratoNome: string }) {
  return (
    <header className="np-head">
      <h2 className="np-titulo">M5 · Negociação de Pleitos · {contratoNome}</h2>
      <p className="np-sub">
        Suporte às tratativas amigáveis · sugestão de argumentos · calibragem de valores ·
        monitoramento de prescrição
      </p>
    </header>
  );
}

// ── KPIs strip ink ───────────────────────────────────────────────────

function KpisStrip({ d }: { d: NegociacaoPleitosData }) {
  return (
    <div className="np-kpis">
      <FarolCard
        label="PLEITOS EM NEGOCIAÇÃO"
        icon="book"
        value={d.totalPleitosLabel}
        info={d.totalPleitosNota}
        accent="ink"
      />
      <FarolCard
        label="VALOR JÁ ACEITO"
        icon="check"
        value={d.valorAceitoLabel}
        info={d.valorAceitoNota}
        accent="ink"
      />
      <FarolCard
        label="PRESCRIÇÃO + PRÓXIMA"
        icon="clock"
        value={d.prescricaoProximaLabel}
        info={d.prescricaoProximaNota}
        accent="ink"
      />
      <article className="np-kpi-cta">
        <div className="np-kpi-label">PRÓXIMA AÇÃO</div>
        <div className="np-kpi-acao">{d.proximaAcaoTitulo}</div>
        <button type="button" className="np-kpi-btn">
          → {d.proximaAcaoCtaLabel}
        </button>
      </article>
    </div>
  );
}

// ── Alerta de prescrição ─────────────────────────────────────────────

function AlertaPrescricao({ texto }: { texto: string }) {
  return (
    <aside className="np-alerta">
      <div className="np-alerta-label">
        <span className="np-alerta-icone">{I.fire({ size: 12 })}</span>
        ALERTA DE PRESCRIÇÃO · ADM CONTRATUAL IA
      </div>
      <p className="np-alerta-texto">{texto}</p>
    </aside>
  );
}

// ── Pleitos lista ────────────────────────────────────────────────────

function PleitosLista({ d }: { d: NegociacaoPleitosData }) {
  return (
    <section className="np-secao">
      <header className="np-secao-head">
        <h3 className="np-secao-titulo">Pleitos em Negociação</h3>
        <p className="np-secao-sub">{d.pleitosSubtitulo}</p>
      </header>
      <ul className="np-pleitos">
        {d.pleitos.map((p) => (
          <PleitoItem key={p.id} p={p} />
        ))}
      </ul>
    </section>
  );
}

function PleitoItem({ p }: { p: PleitoCard }) {
  return (
    <li className="np-pleito" style={{ borderLeftColor: PLEITO_BORDER[p.status] }}>
      <header className="np-pleito-head">
        <div className="np-pleito-titulo-line">
          <span className="np-pleito-titulo">{p.titulo}</span>
          <span
            className="np-pleito-badge"
            style={{
              background: PLEITO_BADGE_BG[p.status],
              color: PLEITO_BADGE_COLOR[p.status],
            }}
          >
            {p.statusLabel}
          </span>
        </div>
        <span
          className={`np-pleito-header-right ${p.headerRightTone === "danger" ? "np-pleito-header-right-danger" : ""}`}
        >
          {p.headerRightLabel}
        </span>
      </header>
      <p className="np-pleito-sub">{p.subtitulo}</p>

      <div className="np-pleito-grid">
        <ValorCol label="PRETENSÃO ORIGINAL" valor={p.pretensaoOriginalLabel} />
        <ValorCol
          label="CONTRAPROP. CTNTE"
          valor={p.contrapropCtnteLabel}
          destaque={p.contrapropDestaque}
        />
        <ValorCol label={p.col3Label} valor={p.col3ValorLabel} tone="info" />
        <ValorCol
          label={p.col4Label}
          valor={p.col4ValorLabel}
          destaque={p.col4Destaque}
          tone="info"
        />
        <PleitoRodape p={p} />
      </div>
    </li>
  );
}

function ValorCol({
  label,
  valor,
  destaque,
  tone,
}: {
  label: string;
  valor: string;
  destaque?: "success" | "danger" | "muted";
  tone?: "info";
}) {
  const colorClass =
    destaque === "success"
      ? "np-valor-success"
      : destaque === "danger"
        ? "np-valor-danger"
        : destaque === "muted"
          ? "np-valor-muted"
          : tone === "info"
            ? "np-valor-info"
            : "";
  return (
    <div className="np-valor">
      <div className="np-valor-label">{label}</div>
      <div className={`np-valor-num ${colorClass}`}>{valor}</div>
    </div>
  );
}

function PleitoRodape({ p }: { p: PleitoCard }) {
  const tone = p.rodapeFarol;
  const className = `np-pleito-rodape ${tone ? `np-pleito-rodape-${tone}` : ""}`;
  return (
    <div className={className}>
      {p.rodapeBoldPrefix && <strong>{p.rodapeBoldPrefix}</strong>}
      {p.rodapeBoldPrefix ? " " : ""}
      {p.rodapeTexto}
      {p.rodapeBoldSuffix && <strong> {p.rodapeBoldSuffix}</strong>}
    </div>
  );
}

// ── Bottom Grid ──────────────────────────────────────────────────────

function TimelineCard({ d }: { d: NegociacaoPleitosData }) {
  return (
    <section className="np-card">
      <header className="np-card-head">
        <h3 className="np-card-titulo">{d.timelineTitulo}</h3>
        <p className="np-card-sub">{d.timelineSubtitulo}</p>
      </header>
      <div className="np-tabela-wrap">
        <div className="np-tabela">
          <div className="np-tabela-head">
            <span>DATA</span>
            <span>EVENTO</span>
            <span>PLEITO</span>
            <span>TIPO</span>
          </div>
          {d.timeline.map((e) => (
            <TimelineLinha key={e.id} e={e} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineLinha({ e }: { e: NegociacaoTimelineEvento }) {
  return (
    <div className="np-tl">
      <span className="np-tl-data">{e.dataLabel}</span>
      <span className="np-tl-evento">{e.evento}</span>
      <span className="np-tl-pleito">{e.pleito}</span>
      <span
        className="np-tl-tipo"
        style={{
          background: TIPO_TONE_BG[e.tipoTone],
          color: TIPO_TONE_COLOR[e.tipoTone],
        }}
      >
        {e.tipoLabel}
      </span>
    </div>
  );
}

function ArgumentarioCard({ d }: { d: NegociacaoPleitosData }) {
  return (
    <section className="np-card">
      <header className="np-card-head">
        <h3 className="np-card-titulo">Argumentário Disponível · IA</h3>
        <p className="np-card-sub">{d.argumentarioSubtitulo}</p>
      </header>
      <ul className="np-args">
        {d.argumentario.map((a) => (
          <ArgItem key={a.id} a={a} />
        ))}
      </ul>
    </section>
  );
}

function ArgItem({ a }: { a: Argumentario }) {
  return (
    <li className="np-arg">
      <div className="np-arg-corpo">
        <div className="np-arg-fonte">{a.fonte}</div>
        <div className="np-arg-resumo">{a.resumo}</div>
      </div>
      <span className="np-arg-pleitos">{a.pleitos}</span>
    </li>
  );
}
