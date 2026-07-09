// M5.1 · Relatório de Lições Aprendidas
// Documento gerado ao final do contrato · alimenta a base de conhecimento
// da plataforma e melhora as análises de Pré-Contrato (M1) futuras.

import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { FarolCard, I } from "@/components/ds";
import { getContract } from "@/lib/mocks/contracts";
import type { FarolLevel } from "@/lib/mocks/contracts";
import {
  type LicaoItem,
  type LicoesData,
  type PremissasResumo,
  type RecomendacaoFuturo,
  type RiscoMaterializado,
  getObra,
} from "@/lib/mocks/obras";
import "./licoes.css";

export const Route = createFileRoute("/_app/contracts/$contractId/finalizacao/licoes")({
  component: LicoesPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, lc: obra.finalizacao?.licoes ?? null };
  },
  head: () => ({ meta: [{ title: "5.1 Lições Aprendidas — RDM IA" }] }),
});

const FAROL_COLOR: Record<FarolLevel, string> = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
};

type TabKey = "licoes" | "pleitos" | "judicial";

const TABS: { key: TabKey; label: string; farol: FarolLevel; to: string }[] = [
  { key: "licoes", label: "Lições Aprendidas", farol: "conforme", to: "licoes" },
  { key: "pleitos", label: "Negociação de Pleitos", farol: "risco", to: "pleitos" },
  { key: "judicial", label: "Análise Judicial / Arbitral", farol: "critico", to: "judicial" },
];

function LicoesPage() {
  const { contract, lc } = Route.useLoaderData();

  return (
    <main className="lc-main">
      <TabBar contractId={contract.id} active="licoes" />

      {!lc ? (
        <div className="lc-empty">
          {I.book({ size: 36 })}
          <p>Contrato {contract.nome} ainda em execução.</p>
          <p className="lc-empty-sub">
            O Relatório de Lições Aprendidas é gerado automaticamente após o encerramento (entrega
            de TR + ASBuilt aprovado).
          </p>
        </div>
      ) : (
        <>
          <LCHeader d={lc} />
          <KpisStrip d={lc} />
          <ResumoExecutivo texto={lc.resumoExecutivo} />
          <div className="lc-grid">
            <div className="lc-col-left">
              <FuncionouBlock d={lc} />
              <NaoFuncionouBlock d={lc} />
              <RiscosBlock d={lc} />
            </div>
            <div className="lc-col-right">
              <PremissasBlock d={lc.premissas} subtitulo={lc.premissasSubtitulo} />
              <RecomendacoesBlock d={lc} />
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
    <nav className="lc-tabs" aria-label="Etapas da Finalização">
      {TABS.map((t) => {
        const isActive = t.key === active;
        const to = `/contracts/${contractId}/finalizacao/${t.to}`;
        return (
          <Link
            key={t.key}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico
            to={to as any}
            className={`lc-tab ${isActive ? "lc-tab-active" : ""}`}
          >
            <span
              className="lc-tab-dot"
              style={{ background: FAROL_COLOR[t.farol] }}
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

function LCHeader({ d }: { d: LicoesData }) {
  return (
    <header className="lc-head">
      <div className="lc-head-titulo">
        <h2 className="lc-titulo">M5 · Lições Aprendidas · {d.contratoNome}</h2>
        <p className="lc-sub">
          Contrato encerrado em {d.encerradoDataLabel} · {d.diasExecutados} dias executados ·{" "}
          {d.subtituloMeta}
        </p>
      </div>
      <div className="lc-head-actions">
        <button type="button" className="lc-btn-sec">
          Exportar Word
        </button>
        <button type="button" className="lc-btn-ink">
          Versionar
        </button>
        <button type="button" className="lc-btn-danger">
          Publicar na Base
        </button>
      </div>
    </header>
  );
}

// ── KPIs strip (ink) ─────────────────────────────────────────────────

function KpisStrip({ d }: { d: LicoesData }) {
  return (
    <div className="lc-kpis">
      <FarolCard
        label="RESULTADO FINAL DO CONTRATO"
        icon="trending"
        value={d.resultadoFinalLabel}
        info={d.resultadoFinalNota}
        accent="danger"
      />
      <FarolCard
        label="VALOR FINAL FATURADO"
        icon="wallet"
        value={d.valorFaturadoLabel}
        info={d.valorFaturadoNota}
        accent="ink"
      />
      <FarolCard
        label="PLEITOS A NEGOCIAR"
        icon="book"
        value={d.pleitosValorLabel}
        info={d.pleitosNota}
        accent="ink"
      />
      <article className="lc-kpi-cta">
        <div className="lc-kpi-label">BASE DE CONHECIMENTO</div>
        <div className="lc-kpi-valor lc-kpi-valor-small">{d.baseConhecimentoLabel}</div>
        <button type="button" className="lc-kpi-btn">
          → {d.baseConhecimentoCtaLabel}
        </button>
      </article>
    </div>
  );
}

// ── Resumo Executivo (callout brand) ─────────────────────────────────

function ResumoExecutivo({ texto }: { texto: string }) {
  return (
    <aside className="lc-resumo">
      <div className="lc-resumo-label">
        <span className="lc-resumo-icone">{I.edit({ size: 12 })}</span>
        RESUMO EXECUTIVO · ADM CONTRATUAL IA
      </div>
      <p className="lc-resumo-texto">{texto}</p>
    </aside>
  );
}

// ── Funcionou bem ────────────────────────────────────────────────────

function FuncionouBlock({ d }: { d: LicoesData }) {
  return (
    <section className="lc-card lc-card-success">
      <header className="lc-card-head">
        <h3 className="lc-card-titulo">
          <span className="lc-card-icone lc-card-icone-success">{I.check({ size: 14 })}</span>O que
          funcionou bem
        </h3>
        <p className="lc-card-sub">{d.funcionouSubtitulo}</p>
      </header>
      <ol className="lc-itens">
        {d.funcionouItens.map((i) => (
          <ItemLicao key={i.id} i={i} tone="success" />
        ))}
      </ol>
    </section>
  );
}

// ── Não funcionou ────────────────────────────────────────────────────

function NaoFuncionouBlock({ d }: { d: LicoesData }) {
  return (
    <section className="lc-card lc-card-danger">
      <header className="lc-card-head">
        <h3 className="lc-card-titulo">
          <span className="lc-card-icone lc-card-icone-danger">{I.close({ size: 14 })}</span>O que
          não funcionou
        </h3>
        <p className="lc-card-sub">{d.naoFuncionouSubtitulo}</p>
      </header>
      <ol className="lc-itens">
        {d.naoFuncionouItens.map((i) => (
          <ItemLicao key={i.id} i={i} tone="danger" />
        ))}
      </ol>
    </section>
  );
}

function ItemLicao({ i, tone }: { i: LicaoItem; tone: "success" | "danger" }) {
  return (
    <li className="lc-item">
      <div className="lc-item-titulo">
        <span className={`lc-item-numero lc-item-numero-${tone}`}>{i.numero}</span>· {i.titulo}
      </div>
      <p className="lc-item-desc">{i.descricao}</p>
    </li>
  );
}

// ── Riscos materializados ────────────────────────────────────────────

function RiscosBlock({ d }: { d: LicoesData }) {
  return (
    <section className="lc-card lc-card-warning">
      <header className="lc-card-head">
        <h3 className="lc-card-titulo">
          <span className="lc-card-icone lc-card-icone-warning">{I.flag({ size: 14 })}</span>
          Riscos materializados
        </h3>
        <p className="lc-card-sub">{d.riscosSubtitulo}</p>
      </header>
      <div className="lc-tabela-wrap">
        <div className="lc-tabela">
          <div className="lc-tabela-head">
            <span>RISCO</span>
            <span>MAPEADO NO M1?</span>
            <span>IMPACTO R$</span>
            <span>MITIGAÇÃO</span>
          </div>
          {d.riscos.map((r) => (
            <RiscoLinha key={r.id} r={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RiscoLinha({ r }: { r: RiscoMaterializado }) {
  return (
    <div className="lc-risco">
      <span className="lc-risco-titulo">{r.risco}</span>
      <span className={`lc-risco-map ${r.mapeado ? "lc-risco-map-sim" : "lc-risco-map-nao"}`}>
        {r.mapeadoLabel}
      </span>
      <span className="lc-risco-impacto">{r.impactoLabel}</span>
      <span className="lc-risco-mit" style={{ color: FAROL_COLOR[r.mitigacaoFarol] }}>
        {r.mitigacaoLabel}
      </span>
    </div>
  );
}

// ── Premissas ────────────────────────────────────────────────────────

function PremissasBlock({ d, subtitulo }: { d: PremissasResumo; subtitulo: string }) {
  return (
    <section className="lc-card">
      <header className="lc-card-head">
        <h3 className="lc-card-titulo">Premissas do Transpasse · Validação Final</h3>
        <p className="lc-card-sub">{subtitulo}</p>
      </header>
      <div className="lc-premissas-grid">
        <PremissaStat
          numero={d.corretas}
          label="CORRETAS"
          pct={d.corretasPctLabel}
          tone="success"
        />
        <PremissaStat
          numero={d.incorretas}
          label="INCORRETAS"
          pct={d.incorretasPctLabel}
          tone="danger"
        />
        <PremissaStat
          numero={d.inconclusivas}
          label="INCONCL."
          pct={d.inconclusivasPctLabel}
          tone="info"
        />
      </div>
      <div className="lc-premissas-erradas">
        <h4 className="lc-premissas-erradas-titulo">Premissas que se mostraram erradas:</h4>
        <ul className="lc-premissas-list">
          {d.premissasErradas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PremissaStat({
  numero,
  label,
  pct,
  tone,
}: {
  numero: number;
  label: string;
  pct: string;
  tone: "success" | "danger" | "info";
}) {
  return (
    <div className={`lc-premissa-stat lc-premissa-stat-${tone}`}>
      <div className="lc-premissa-num">{numero}</div>
      <div className="lc-premissa-label">{label}</div>
      <div className="lc-premissa-pct">{pct}</div>
    </div>
  );
}

// ── Recomendações ────────────────────────────────────────────────────

function RecomendacoesBlock({ d }: { d: LicoesData }) {
  return (
    <section className="lc-card">
      <header className="lc-card-head">
        <h3 className="lc-card-titulo">
          <span className="lc-card-icone lc-card-icone-brand">{I.flag({ size: 14 })}</span>
          Recomendações para Contratos Futuros Similares
        </h3>
        <p className="lc-card-sub">{d.recomendacoesSubtitulo}</p>
      </header>
      <ul className="lc-recomendacoes">
        {d.recomendacoes.map((r) => (
          <RecomendacaoItem key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

function RecomendacaoItem({ r }: { r: RecomendacaoFuturo }) {
  return (
    <li className="lc-recomendacao">
      <div className="lc-recomendacao-titulo">
        <span className="lc-recomendacao-codigo">{r.id}</span>· {r.titulo}
      </div>
      <p className="lc-recomendacao-desc">{r.descricao}</p>
    </li>
  );
}
