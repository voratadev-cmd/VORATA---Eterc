import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  Card,
  CardHeader,
  CardSub,
  CardTitle,
  Col,
  Grid,
  I,
  type IconName,
  PageHeader,
} from "@/components/ds";
import { type Contract, formatBRL, formatBRLAbbreviated, getContract } from "@/lib/mocks/contracts";
import {
  type ClausulaRenegociacao,
  type DiagnosticoData,
  type ModeloRecomendado,
  type RecomendacaoFinal,
  getDiagnostico,
} from "@/lib/mocks/obras";
import "./diagnostico.css";

export const Route = createFileRoute("/_app/contracts/$contractId/pre/diagnostico")({
  component: DiagnosticoPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const diagnostico = getDiagnostico(params.contractId);
    if (!diagnostico) throw notFound();
    return { contract, diagnostico };
  },
  head: () => ({ meta: [{ title: "Diagnóstico do Contrato — RDM IA" }] }),
});

function DiagnosticoPage() {
  const { contract, diagnostico } = Route.useLoaderData();

  return (
    <>
      <Breadcrumb contract={contract} />

      <PageHeader
        title="Diagnóstico do Contrato · Consolidação para Decisão"
        subtitle="Adm Contratual IA · Consolida Revisão Documental + Bases do Negócio · Recomendação final: assinar / renegociar / recusar"
      />

      <HeroStrip diagnostico={diagnostico} />

      <MetaBar diagnostico={diagnostico} />

      <Grid>
        <Col span={8}>
          <PreviewCard diagnostico={diagnostico} />
        </Col>

        <Col span={4}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Modelos Recomendados pela IA</CardTitle>
                <CardSub>
                  Documentos que a Contratada deve emitir obrigatoriamente · baseado no tipo de
                  contrato
                </CardSub>
              </div>
            </CardHeader>
            <ModelosList modelos={diagnostico.modelosRecomendados} />
          </Card>
        </Col>
      </Grid>
    </>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────

function Breadcrumb({ contract }: { contract: Contract }) {
  return (
    <nav className="crumb" aria-label="Caminho">
      <Link to="/">Dashboard</Link>
      <span className="crumb-sep">{I.chevRight({ size: 12 })}</span>
      <span>Pré-Contrato</span>
      <span className="crumb-sep">{I.chevRight({ size: 12 })}</span>
      <Link to="/contracts/$contractId" params={{ contractId: contract.id }} className="crumb-link">
        {contract.nome}
      </Link>
      <span className="crumb-sep">{I.chevRight({ size: 12 })}</span>
      <span className="crumb-current">Diagnóstico do Contrato</span>
    </nav>
  );
}

// ── Hero Strip ───────────────────────────────────────────────────────

const RECOMENDACAO_COLOR: Record<RecomendacaoFinal, string> = {
  ASSINAR: "var(--success)",
  RENEGOCIAR: "var(--warning)",
  RECUSAR: "var(--danger)",
};

function HeroStrip({ diagnostico }: { diagnostico: DiagnosticoData }) {
  const cor = RECOMENDACAO_COLOR[diagnostico.recomendacao];
  return (
    <div className="rev-hero">
      <div className="rev-hero-cell diag-cell-recom">
        <div className="rev-hero-label">Recomendação do Adm Contratual IA</div>
        <div className="diag-recom-row">
          <span className="diag-recom-icon" style={{ color: cor }} aria-hidden>
            {I.bell({ size: 18 })}
          </span>
          <span className="diag-recom-text" style={{ color: cor }}>
            {diagnostico.recomendacao}
          </span>
        </div>
        <div className="rev-hero-sub diag-recom-sub">
          {diagnostico.recomendacaoResumo} · força no mérito{" "}
          <Stars filled={diagnostico.forcaNoMerito} />
        </div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Potencial de Desequilíbrio</div>
        <div className="rev-hero-value">
          {formatBRLAbbreviated(diagnostico.potencialDesequilibrio)}
        </div>
        <div className="rev-hero-sub">
          {diagnostico.potencialDesequilibrioPct.toLocaleString("pt-BR")}% do valor ·{" "}
          {diagnostico.cenarioDescricao}
        </div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Modelo Aplicado</div>
        <div className="rev-hero-action-title">{diagnostico.modeloAplicado}</div>
        <div className="rev-hero-sub">
          templates: {diagnostico.templatesDisponiveis} disponíveis
        </div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Ação</div>
        <div className="rev-hero-action-title">Gerar Diagnóstico</div>
        <button type="button" className="rev-hero-action-btn">
          {I.arrowRight({ size: 14 })} 1 clique
        </button>
      </div>
    </div>
  );
}

function Stars({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <span className="diag-stars" aria-label={`${filled} de ${total} estrelas`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? "diag-star on" : "diag-star"}>
          ★
        </span>
      ))}
    </span>
  );
}

// ── Meta bar ─────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function MetaBar({ diagnostico }: { diagnostico: DiagnosticoData }) {
  return (
    <div className="diag-meta">
      <div className="diag-meta-info">
        <div className="diag-meta-title">
          {I.doc({ size: 14 })} Diagnóstico gerado em{" "}
          {DATE_FMT.format(new Date(diagnostico.geradoEmISO))} · versão {diagnostico.versao}
        </div>
        <div className="diag-meta-sub">{diagnostico.modeloDescricao}</div>
      </div>
      <div className="diag-meta-actions">
        <button type="button" className="diag-btn diag-btn-outline">
          Trocar Modelo
        </button>
        <button type="button" className="diag-btn diag-btn-ink">
          Versionar
        </button>
        <button type="button" className="diag-btn diag-btn-danger">
          {I.arrowRight({ size: 12 })} Exportar → Transpasse
        </button>
      </div>
    </div>
  );
}

// ── Preview do documento ─────────────────────────────────────────────

function PreviewCard({ diagnostico }: { diagnostico: DiagnosticoData }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Preview do Diagnóstico · editável inline</CardTitle>
        </div>
        <span className="diag-preview-meta">{diagnostico.paginas} páginas · Word · PDF</span>
      </CardHeader>

      <article className="diag-preview">
        <section className="diag-secao">
          <h3 className="diag-secao-titulo">1. Resumo Executivo</h3>
          <p className="diag-secao-texto">
            <FormattedText text={diagnostico.resumoExecutivo} />
          </p>
        </section>

        <section className="diag-secao">
          <h3 className="diag-secao-titulo">2. Cláusulas para Renegociação</h3>
          <ul className="diag-clausulas">
            {diagnostico.clausulasRenegociacao.map((c) => (
              <ClausulaRow key={c.id} clausula={c} />
            ))}
            {diagnostico.clausulasRestantes > 0 ? (
              <li className="diag-clausula-mais">
                + {diagnostico.clausulasRestantes} outras cláusulas — ver detalhamento
              </li>
            ) : null}
          </ul>
        </section>

        <section className="diag-secao">
          <h3 className="diag-secao-titulo">3. Premissas a Formalizar</h3>
          <p className="diag-secao-texto">
            <FormattedText text={diagnostico.premissasFormalizar} />
          </p>
        </section>

        <section className="diag-secao">
          <h3 className="diag-secao-titulo">4. Estimativa de Desequilíbrio</h3>
          <ul className="diag-cenarios">
            <li>
              <span className="diag-cenario-rotulo">Cenário baixo</span>
              <span className="diag-cenario-valor">
                {formatBRLAbbreviated(diagnostico.cenarios.baixo)}
              </span>
              <span className="diag-cenario-desc">{diagnostico.cenarios.baixoDescricao}</span>
            </li>
            <li>
              <span className="diag-cenario-rotulo">Cenário médio</span>
              <span className="diag-cenario-valor">
                {formatBRLAbbreviated(diagnostico.cenarios.medio)}
              </span>
              <span className="diag-cenario-desc">{diagnostico.cenarios.medioDescricao}</span>
            </li>
            <li>
              <span className="diag-cenario-rotulo">Cenário alto</span>
              <span className="diag-cenario-valor">
                {formatBRLAbbreviated(diagnostico.cenarios.alto)}
              </span>
              <span className="diag-cenario-desc">{diagnostico.cenarios.altoDescricao}</span>
            </li>
          </ul>
        </section>

        <aside className="diag-recom-final">
          <span className="diag-recom-final-label">Recomendação Final:</span>{" "}
          {diagnostico.recomendacaoFinal}
        </aside>
      </article>
    </Card>
  );
}

function ClausulaRow({ clausula }: { clausula: ClausulaRenegociacao }) {
  return (
    <li className="diag-clausula">
      <span className="diag-clausula-codigo">{clausula.codigo}</span>
      <span className="diag-clausula-text">
        <strong>{clausula.titulo}</strong>
        <span className="diag-clausula-sugestao"> — sugerir {clausula.sugestao}</span>
      </span>
    </li>
  );
}

/** Renderiza texto com marcação **negrito** simples (sem libs de markdown). */
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

void formatBRL; // mantido pra usos futuros do mesmo módulo

// ── Modelos Recomendados ─────────────────────────────────────────────

function ModelosList({ modelos }: { modelos: ModeloRecomendado[] }) {
  return (
    <ul className="diag-modelos">
      {modelos.map((m) => (
        <li key={m.id} className="diag-modelo">
          <span className="diag-modelo-icon" aria-hidden>
            {I[m.icon as IconName]({ size: 16 })}
          </span>
          <div className="diag-modelo-text">
            <div className="diag-modelo-titulo">{m.titulo}</div>
            <div className="diag-modelo-desc">{m.descricao}</div>
          </div>
          <button type="button" className="diag-modelo-btn">
            Gerar template
          </button>
        </li>
      ))}
    </ul>
  );
}
