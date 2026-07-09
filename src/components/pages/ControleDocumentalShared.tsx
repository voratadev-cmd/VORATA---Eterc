// Shell compartilhado do M2.1.9 Controle Documental: Header + 4 KPIs + TabBar.
// Cada aba (geralzao · areas · documentos · operacao) renderiza seu próprio
// conteúdo dentro deste shell.

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FarolCard, I } from "@/components/ds";
import type { ControleDocumentalData } from "@/lib/mocks/obras";
import "./ControleDocumentalShared.css";

export type ControleDocumentalTabKey = "geralzao" | "areas" | "documentos" | "operacao";

const TABS: { key: ControleDocumentalTabKey; label: string; sub: string }[] = [
  { key: "geralzao", label: "Visão Geral", sub: "Análise IA · 3 fases" },
  { key: "areas", label: "Áreas Responsáveis", sub: "8 áreas da ETERC" },
  { key: "documentos", label: "Documentos Esperados", sub: "Tabela 28 docs" },
  { key: "operacao", label: "Operação", sub: "Documentos · Pendências" },
];

export function ControleDocumentalShell({
  d,
  contractId,
  active,
  children,
}: {
  d: ControleDocumentalData;
  contractId: string;
  active: ControleDocumentalTabKey;
  children: ReactNode;
}) {
  return (
    <main className="cd-main">
      <Header d={d} />
      <KpisStrip d={d} />
      <TabBar contractId={contractId} active={active} />
      {children}
    </main>
  );
}

function Header({ d }: { d: ControleDocumentalData }) {
  return (
    <header className="cd-head">
      <div className="cd-head-titulo">
        <h2 className="cd-titulo">Controle Documental · {d.contratoNome}</h2>
        <p className="cd-sub">
          Documentos da obra · {d.contratoCodigo} · {d.contratante} · {d.totalDocsEsperados} tipos
          esperados · {d.completudePct}% de completude · data-corte {d.dataCorteLabel}
        </p>
      </div>
      <div className="cd-head-actions">
        <button type="button" className="cd-btn cd-btn-sec">
          {I.share({ size: 14 })} Importar onboarding
        </button>
        <button type="button" className="cd-btn cd-btn-sec">
          {I.bell({ size: 14 })} Solicitar pendências
        </button>
        <button type="button" className="cd-btn cd-btn-ink">
          {I.arrowDown({ size: 14 })} Exportar relatório
        </button>
      </div>
    </header>
  );
}

function KpisStrip({ d }: { d: ControleDocumentalData }) {
  return (
    <div className="cd-kpis">
      <FarolCard
        label="COMPLETUDE GERAL"
        icon="check"
        value={d.completudeGeralLabel}
        info={d.completudeNota}
        accent="neutral"
      />
      <FarolCard
        label="DOCS CRÍTICOS PENDENTES"
        icon="fire"
        value={d.docsCriticosCount}
        info={d.docsCriticosNota}
        farol={d.docsCriticosCount > 0 ? "critico" : "conforme"}
      />
      <FarolCard
        label="ÚLTIMA SOLICITAÇÃO"
        icon="clock"
        value={d.ultimaSolicLabel}
        info={d.ultimaSolicNota}
        accent="neutral"
      />
      {/* CTA card — visualmente alinha com FarolCard mas tem botão de ação. */}
      <article className="cd-kpi-cta">
        <div className="cd-kpi-cta-label">PRIORIDADE</div>
        <div className="cd-kpi-cta-valor">{d.prioridadeTitulo}</div>
        <button type="button" className="cd-kpi-cta-btn">
          ▲ {d.prioridadeCtaLabel}
        </button>
      </article>
    </div>
  );
}

function TabBar({ contractId, active }: { contractId: string; active: ControleDocumentalTabKey }) {
  return (
    <nav className="cd-tabs" aria-label="Abas do Controle Documental">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const to = `/contracts/${contractId}/controle-documental/${t.key === "geralzao" ? "" : t.key}`;
        return (
          <Link
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico
            to={to as any}
            className={`cd-tab ${isActive ? "cd-tab-active" : ""}`}
          >
            <span className="cd-tab-label">{t.label}</span>
            <span className="cd-tab-sub">{t.sub}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

export function ControleDocumentalEmpty({ contractNome }: { contractNome: string }) {
  return (
    <main className="cd-main">
      <header className="cd-head">
        <div className="cd-head-titulo">
          <h2 className="cd-titulo">Controle Documental</h2>
          <p className="cd-sub">Documentos da obra · {contractNome}</p>
        </div>
      </header>
      <div className="cd-empty">
        {I.doc({ size: 36 })}
        <p>Controle Documental não configurado para {contractNome}.</p>
        <p className="cd-empty-sub">
          O onboarding documental será iniciado após a primeira semana de execução. O Agente
          Documental mapeia automaticamente os 28 tipos esperados de documentos do contrato e
          monitora a completude por fase.
        </p>
      </div>
    </main>
  );
}
