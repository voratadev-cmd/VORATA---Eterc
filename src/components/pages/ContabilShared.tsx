// Shell compartilhado do M-Contábil: Header + KPIs strip + TabBar.
// Cada aba (geralzao · capitulo · pericial · operacao) renderiza seu
// próprio conteúdo dentro deste shell.

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FarolCard, I } from "@/components/ds";
import type { ContabilData } from "@/lib/mocks/obras";
import "./ContabilShared.css";

export type ContabilTabKey = "geralzao" | "capitulo" | "pericial" | "operacao";

const TABS: { key: ContabilTabKey; label: string; sub: string }[] = [
  { key: "geralzao", label: "Visão Geral", sub: "Painel multidimensional" },
  { key: "capitulo", label: "Análise por Capítulo", sub: "Tabela detalhada" },
  { key: "pericial", label: "Apuração Pericial", sub: "Custo × Receita" },
  { key: "operacao", label: "Operação", sub: "Documentos · Ações" },
];

export function ContabilShell({
  d,
  contractId,
  active,
  children,
}: {
  d: ContabilData;
  contractId: string;
  active: ContabilTabKey;
  children: ReactNode;
}) {
  return (
    <main className="ct-main">
      <Header d={d} />
      <KpisStrip d={d} />
      <TabBar contractId={contractId} active={active} />
      {children}
    </main>
  );
}

function Header({ d }: { d: ContabilData }) {
  return (
    <header className="ct-head">
      <div className="ct-head-titulo">
        <h2 className="ct-titulo">
          Geralzão · AGM · {d.contratoNome} · <span className="ct-mes">{d.mesReferencia}</span>
        </h2>
        <p className="ct-sub">
          Análise Gerencial Mensal · {d.contratoCodigo} · {d.contratante} · data-corte{" "}
          {d.dataCorteLabel} · {d.mesExecucaoNota}
        </p>
      </div>
      <div className="ct-head-actions">
        <button type="button" className="ct-btn ct-btn-sec">
          {I.share({ size: 14 })} Upload NFs/Banco
        </button>
        <button type="button" className="ct-btn ct-btn-sec">
          {I.arrowDown({ size: 14 })} Exportar AGM
        </button>
        <button type="button" className="ct-btn ct-btn-warning">
          {I.fire({ size: 14 })} Fechar mês
        </button>
      </div>
    </header>
  );
}

function KpisStrip({ d }: { d: ContabilData }) {
  return (
    <div className="ct-kpis">
      <FarolCard
        label="VALOR DO CONTRATO (PJ)"
        icon="wallet"
        value={d.valorContratoLabel}
        info={d.valorContratoNota}
        accent="neutral"
      />
      <FarolCard
        label="RECEITA BRUTA ACUMULADA"
        icon="trending"
        value={d.receitaBrutaLabel}
        info={d.receitaBrutaNota}
        accent="neutral"
      />
      <FarolCard
        label="CUSTO REAL ACUMULADO"
        icon="pkg"
        value={d.custoRealLabel}
        info={d.custoRealNota}
        accent="neutral"
      />
      <FarolCard
        label="RESULTADO LÍQUIDO MÊS"
        icon="fire"
        value={`+ ${d.resultadoLiquidoLabel}`}
        info={d.resultadoLiquidoMargem}
        accent="success"
      />
    </div>
  );
}

function TabBar({ contractId, active }: { contractId: string; active: ContabilTabKey }) {
  return (
    <nav className="ct-tabs" aria-label="Abas do módulo Contábil">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const to = `/contracts/${contractId}/contabil/${t.key === "geralzao" ? "" : t.key}`;
        return (
          <Link
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico
            to={to as any}
            className={`ct-tab ${isActive ? "ct-tab-active" : ""}`}
          >
            <span className="ct-tab-label">{t.label}</span>
            <span className="ct-tab-sub">{t.sub}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Empty state pra Hospital (sem AGM) ───────────────────────────────

export function ContabilEmpty({ contractNome }: { contractNome: string }) {
  return (
    <main className="ct-main">
      <header className="ct-head">
        <div className="ct-head-titulo">
          <h2 className="ct-titulo">Contábil · AGM</h2>
          <p className="ct-sub">Análise Gerencial Mensal · {contractNome}</p>
        </div>
      </header>
      <div className="ct-empty">
        {I.book({ size: 36 })}
        <p>Módulo Contábil não disponível para {contractNome}.</p>
        <p className="ct-empty-sub">
          Esta obra ainda não passou pelo 1º fechamento contábil. O AGM é gerado automaticamente
          após a primeira medição liberada e a configuração do plano de contas do contrato.
        </p>
      </div>
    </main>
  );
}
