// M5.3 · Análise Judicial / Arbitral
// Suporte ao litígio · petições · estratégia · prova documental · peritos
// · quesitos · pareceres · Jusbrasil + base probatória já indexada.

import type { ReactNode } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { FarolCard, I } from "@/components/ds";
import { getContract } from "@/lib/mocks/contracts";
import type { FarolLevel } from "@/lib/mocks/contracts";
import {
  type AnaliseArbitralData,
  type AndamentoItem,
  type AndamentoStatus,
  type DossieStat,
  type JurisprudenciaLinha,
  type JurisprudenciaTipo,
  type Perito,
  getObra,
} from "@/lib/mocks/obras";
import "./judicial.css";

export const Route = createFileRoute("/_app/contracts/$contractId/finalizacao/judicial")({
  component: JudicialPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, aa: obra.finalizacao?.analiseArbitral ?? null };
  },
  head: () => ({ meta: [{ title: "5.3 Análise Judicial / Arbitral — RDM IA" }] }),
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

const ANDAMENTO_BORDER: Record<AndamentoStatus, string> = {
  concluido: "var(--success)",
  "em-curso": "var(--info)",
  proximo: "var(--warning)",
  previsto: "var(--text-4)",
};

const ANDAMENTO_LABEL_COLOR: Record<AndamentoStatus, string> = {
  concluido: "var(--success)",
  "em-curso": "var(--info)",
  proximo: "var(--warning)",
  previsto: "var(--text-3)",
};

const JURIS_COLOR: Record<JurisprudenciaTipo, string> = {
  "favoravel-forte": "var(--success)",
  favoravel: "var(--success)",
  distinguished: "var(--warning)",
};

const TABS: { key: TabKey; label: string; to: string }[] = [
  { key: "licoes", label: "Lições Aprendidas", to: "licoes" },
  { key: "pleitos", label: "Negociação de Pleitos", to: "pleitos" },
  { key: "judicial", label: "Análise Judicial / Arbitral", to: "judicial" },
];

function JudicialPage() {
  const { contract, aa } = Route.useLoaderData();

  return (
    <main className="aj-main">
      <TabBar contractId={contract.id} active="judicial" />

      {!aa ? (
        <div className="aj-empty">
          {I.shield({ size: 36 })}
          <p>Nenhum pleito de {contract.nome} migrou para arbitragem ou judicial.</p>
          <p className="aj-empty-sub">
            Quando uma negociação se inviabilizar (ou já existir cláusula compromissória ativa), a
            plataforma instrumenta toda a fase contenciosa a partir do dossiê do M3.
          </p>
        </div>
      ) : (
        <>
          <AJHeader d={aa} />
          <KpisStrip d={aa} />
          <EstrategiaCallout texto={aa.estrategiaTexto} />
          <div className="aj-grid">
            <div className="aj-col-left">
              <DossieCard d={aa} />
              <JurisprudenciaCard d={aa} />
            </div>
            <div className="aj-col-right">
              <AndamentoCard d={aa} />
              <PeritosCard d={aa} />
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
    <nav className="aj-tabs" aria-label="Etapas da Finalização">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const to = `/contracts/${contractId}/finalizacao/${t.to}`;
        return (
          <Link
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico
            to={to as any}
            className={`aj-tab ${isActive ? "aj-tab-active" : ""}`}
          >
            <span
              className="aj-tab-dot"
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

function AJHeader({ d }: { d: AnaliseArbitralData }) {
  return (
    <header className="aj-head">
      <h2 className="aj-titulo">
        M5 · Análise Arbitral · {d.procedimentoTitulo} · Pleito {d.pleitoLabel}
      </h2>
      <p className="aj-sub">{d.subtitulo}</p>
    </header>
  );
}

// ── KPIs strip (ink) ─────────────────────────────────────────────────

function KpisStrip({ d }: { d: AnaliseArbitralData }) {
  return (
    <div className="aj-kpis">
      <FarolCard
        label="PROCEDIMENTO ARBITRAL"
        icon="shield"
        value={d.procedimentoNumero}
        info={d.procedimentoNota}
        accent="ink"
      />
      <FarolCard
        label="VALOR DA CAUSA"
        icon="wallet"
        value={d.valorCausaLabel}
        info={d.valorCausaNota}
        accent="ink"
      />
      <FarolCard
        label="PRÓXIMO PRAZO"
        icon="clock"
        value={d.proximoPrazoLabel}
        info={d.proximoPrazoNota}
        accent="ink"
      />
      <article className="aj-kpi-cta">
        <div className="aj-kpi-label">PROBABILIDADE DE ÊXITO</div>
        <div className="aj-kpi-valor">{d.probabilidadeExitoLabel}</div>
        <button type="button" className="aj-kpi-btn">
          → {d.probabilidadeCtaLabel}
        </button>
      </article>
    </div>
  );
}

// ── Estratégia Jurídica callout ──────────────────────────────────────

function EstrategiaCallout({ texto }: { texto: string }) {
  return (
    <aside className="aj-estrategia">
      <div className="aj-estrategia-label">
        <span className="aj-estrategia-icone">{I.flag({ size: 12 })}</span>
        ESTRATÉGIA JURÍDICA · ADM CONTRATUAL IA
      </div>
      <p className="aj-estrategia-texto">{renderBold(texto)}</p>
    </aside>
  );
}

/** Renderiza texto, marcando trechos entre asteriscos `*foo*` em negrito. */
function renderBold(texto: string): ReactNode {
  const partes = texto.split(/(\*[^*]+\*)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <strong key={i}>{parte.slice(1, -1)}</strong>;
    }
    return <span key={i}>{parte}</span>;
  });
}

// ── Dossiê ───────────────────────────────────────────────────────────

function DossieCard({ d }: { d: AnaliseArbitralData }) {
  return (
    <section className="aj-card">
      <header className="aj-card-head">
        <h3 className="aj-card-titulo">
          <span className="aj-card-icone aj-card-icone-warning">{I.book({ size: 14 })}</span>
          Dossiê Probatório Indexado
        </h3>
        <p className="aj-card-sub">{d.dossieSubtitulo}</p>
      </header>
      <div className="aj-dossie-stats">
        {d.dossieStats.map((s) => (
          <DossieStatBox key={s.label} s={s} />
        ))}
      </div>
      <div className="aj-provas">
        <h4 className="aj-provas-titulo">{d.provasChaveTitulo}</h4>
        <ul className="aj-provas-list">
          {d.provasChave.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DossieStatBox({ s }: { s: DossieStat }) {
  return (
    <div className="aj-stat">
      <div className="aj-stat-num">{s.numero}</div>
      <div className="aj-stat-label">{s.label}</div>
      <div className="aj-stat-nota">{s.nota}</div>
    </div>
  );
}

// ── Jurisprudência ───────────────────────────────────────────────────

function JurisprudenciaCard({ d }: { d: AnaliseArbitralData }) {
  return (
    <section className="aj-card">
      <header className="aj-card-head">
        <h3 className="aj-card-titulo">
          <span className="aj-card-icone aj-card-icone-brand">{I.flag({ size: 14 })}</span>
          Jurisprudência Aplicável
          <span className="aj-card-titulo-sub">· consulta Jusbrasil</span>
        </h3>
        <p className="aj-card-sub">{d.jurisprudenciaSubtitulo}</p>
      </header>
      <div className="aj-tabela-wrap">
        <div className="aj-tabela">
          <div className="aj-tabela-head">
            <span>FONTE</span>
            <span>EMENTA RESUMIDA</span>
            <span>RELAÇÃO</span>
            <span className="aj-col-center">★</span>
          </div>
          {d.jurisprudencia.map((j) => (
            <JurisLinha key={j.id} j={j} />
          ))}
        </div>
      </div>
    </section>
  );
}

function JurisLinha({ j }: { j: JurisprudenciaLinha }) {
  return (
    <div className="aj-juris">
      <span className="aj-juris-fonte">{j.fonte}</span>
      <span className="aj-juris-ementa">{j.ementa}</span>
      <span className="aj-juris-relacao" style={{ color: JURIS_COLOR[j.relacaoTipo] }}>
        {j.relacao}
      </span>
      <span className="aj-col-center">
        <Estrelas n={j.estrelas} cor={JURIS_COLOR[j.relacaoTipo]} />
      </span>
    </div>
  );
}

function Estrelas({ n, cor }: { n: number; cor: string }) {
  return (
    <span className="aj-estrelas" style={{ color: cor }} aria-label={`${n} de 5 estrelas`}>
      {"★".repeat(n)}
      <span className="aj-estrelas-vazias">{"☆".repeat(5 - n)}</span>
    </span>
  );
}

// ── Andamento ────────────────────────────────────────────────────────

function AndamentoCard({ d }: { d: AnaliseArbitralData }) {
  return (
    <section className="aj-card">
      <header className="aj-card-head">
        <h3 className="aj-card-titulo">
          <span className="aj-card-icone aj-card-icone-info">{I.calendar({ size: 14 })}</span>
          Andamento Processual
        </h3>
        <p className="aj-card-sub">{d.andamentoSubtitulo}</p>
      </header>
      <ul className="aj-andamento">
        {d.andamento.map((a) => (
          <AndamentoItemRow key={a.id} a={a} />
        ))}
      </ul>
    </section>
  );
}

function AndamentoItemRow({ a }: { a: AndamentoItem }) {
  return (
    <li className="aj-andamento-item" style={{ borderLeftColor: ANDAMENTO_BORDER[a.status] }}>
      <div className="aj-andamento-corpo">
        <div className="aj-andamento-titulo">{a.titulo}</div>
        <div className="aj-andamento-meta">{a.meta}</div>
      </div>
      <span className="aj-andamento-status" style={{ color: ANDAMENTO_LABEL_COLOR[a.status] }}>
        {a.status === "concluido" ? "✓" : a.statusLabel}
      </span>
    </li>
  );
}

// ── Peritos ──────────────────────────────────────────────────────────

function PeritosCard({ d }: { d: AnaliseArbitralData }) {
  return (
    <section className="aj-card">
      <header className="aj-card-head">
        <h3 className="aj-card-titulo">
          <span className="aj-card-icone aj-card-icone-info">{I.search({ size: 14 })}</span>
          Peritos e Quesitos Sugeridos
        </h3>
        <p className="aj-card-sub">{d.peritosSubtitulo}</p>
      </header>
      <h4 className="aj-mini-titulo">Peritos sugeridos (3 nomes):</h4>
      <ul className="aj-peritos-list">
        {d.peritos.map((p) => (
          <PeritoItem key={p.id} p={p} />
        ))}
      </ul>
      <h4 className="aj-mini-titulo aj-mini-titulo-spaced">5 quesitos principais sugeridos:</h4>
      <ol className="aj-quesitos-list">
        {d.quesitos.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </section>
  );
}

function PeritoItem({ p }: { p: Perito }) {
  return (
    <li>
      <strong>{p.nome}</strong> · {p.qualificacao}
    </li>
  );
}
