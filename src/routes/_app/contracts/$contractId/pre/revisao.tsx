import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  Badge,
  Card,
  CardHeader,
  CardSub,
  CardTitle,
  Col,
  Grid,
  I,
  PageHeader,
} from "@/components/ds";
import { type Contract, formatBRL, getContract } from "@/lib/mocks/contracts";
import {
  type Analise,
  type ConcorrenciaDocument,
  type DocTipo,
  type PontoCritico,
  type RevisaoDocumental,
  diasAteDataLimite,
  getRevisao,
} from "@/lib/mocks/obras";
import "./revisao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/pre/revisao")({
  component: RevisaoPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const revisao = getRevisao(params.contractId);
    if (!revisao) throw notFound();
    return { contract, revisao };
  },
  head: () => ({ meta: [{ title: "Revisão Documental — RDM IA" }] }),
});

function RevisaoPage() {
  const { contract, revisao } = Route.useLoaderData();

  return (
    <>
      <Breadcrumb contract={contract} />

      <PageHeader
        title="Revisão Documental · Análise da Concorrência"
        subtitle="Adm Contratual IA · Análise multidimensional dos documentos da fase de concorrência · Base: contrato, projetos, planilha, procedimentos"
      />

      <HeroStrip revisao={revisao} />

      <Grid>
        <Col span={3}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Documentos da Concorrência</CardTitle>
                <CardSub>Upload e processamento pelo agente</CardSub>
              </div>
            </CardHeader>
            <DocList documentos={revisao.documentos} />
            <button type="button" className="doc-add">
              {I.plus({ size: 14 })} Adicionar Documento
            </button>
          </Card>
        </Col>

        <Col span={5}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  Análises Produzidas pelo Agente{" "}
                  <span className="analises-hint">expandir para detalhe</span>
                </CardTitle>
              </div>
            </CardHeader>
            <div className="analise-list">
              {revisao.analises.map((a) => (
                <AnaliseCard key={a.tipo} analise={a} contractId={contract.id} />
              ))}
            </div>
          </Card>
        </Col>

        <Col span={4}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Pontos Críticos Destacados</CardTitle>
              </div>
            </CardHeader>
            <div className="pcrits-list">
              {revisao.pontosCriticos.map((p) => (
                <PontoCriticoRow key={p.id} ponto={p} />
              ))}
            </div>
          </Card>
        </Col>
      </Grid>

      <SinteseStrip revisao={revisao} />
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
      <span className="crumb-current">Revisão Documental</span>
    </nav>
  );
}

// ── Hero Strip (KPIs em card escuro) ─────────────────────────────────

function HeroStrip({ revisao }: { revisao: RevisaoDocumental }) {
  const { pontosAtencao } = revisao;
  return (
    <div className="rev-hero">
      <div className="rev-hero-cell">
        <div className="rev-hero-label">Pontos de Atenção Identificados</div>
        <div className="rev-hero-value">{pontosAtencao.total}</div>
        <div className="rev-hero-sub">
          <span>
            <span className="rev-hero-dot" style={{ background: "var(--danger)" }} />
            {pontosAtencao.criticos} Críticos
          </span>
          <span>
            <span className="rev-hero-dot" style={{ background: "var(--warning)" }} />
            {pontosAtencao.risco} Risco
          </span>
          <span>
            <span className="rev-hero-dot" style={{ background: "var(--info)" }} />
            {pontosAtencao.observacao} Observação
          </span>
          <span>
            <span className="rev-hero-dot" style={{ background: "var(--success)" }} />
            {pontosAtencao.conforme} Conforme
          </span>
        </div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Documentos Carregados</div>
        <div className="rev-hero-value">{revisao.documentosCarregados}</div>
        <div className="rev-hero-sub">
          {revisao.paginasIndexadas.toLocaleString("pt-BR")} páginas indexadas
        </div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Análises Concluídas</div>
        <div className="rev-hero-value">
          {revisao.analisesConcluidas} / {revisao.analisesTotal}
        </div>
        <div className="rev-hero-sub">Última: {revisao.ultimaAnalise}</div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Próximo Passo</div>
        <div className="rev-hero-action-title">Gerar Relatório de Revisão</div>
        <button type="button" className="rev-hero-action-btn">
          {I.doc({ size: 14 })} Gerar com 1 clique
        </button>
      </div>
    </div>
  );
}

// ── Documentos da Concorrência ───────────────────────────────────────

const DOC_ICON: Record<DocTipo, (size: number) => React.ReactNode> = {
  edital: (s) => I.doc({ size: s }),
  contrato: (s) => I.doc({ size: s }),
  projeto: (s) => I.map({ size: s }),
  planilha: (s) => I.pkg({ size: s }),
  procedimento: (s) => I.check({ size: s }),
  anexo: (s) => I.link({ size: s }),
  cronograma: (s) => I.calendar({ size: s }),
  memorial: (s) => I.book({ size: s }),
};

function DocList({ documentos }: { documentos: ConcorrenciaDocument[] }) {
  return (
    <ul className="doc-list">
      {documentos.map((d) => (
        <li key={d.id} className="doc-item">
          <span className="doc-item-icon">{DOC_ICON[d.tipo](14)}</span>
          <span className="doc-item-name" title={d.nome}>
            {d.nome}
          </span>
          {d.status === "processado" ? <span className="doc-item-status">processado</span> : null}
        </li>
      ))}
    </ul>
  );
}

// ── Cartão de análise ────────────────────────────────────────────────

const NIVEL_LABEL: Record<Analise["nivel"], string> = {
  critico: "CRÍTICO",
  risco: "RISCO",
  observacao: "OBSERVAÇÃO",
  conforme: "CONFORME",
  pronto: "PRONTO",
};

function AnaliseCard({ analise, contractId }: { analise: Analise; contractId: string }) {
  return (
    <Link
      to="/contracts/$contractId/pre/revisao"
      params={{ contractId }}
      className={`analise-card ${analise.nivel}`}
    >
      <div className="analise-card-head">
        <div className="analise-card-titulo">{analise.titulo}</div>
        <div className="analise-card-right">
          <span className="analise-card-nivel">{NIVEL_LABEL[analise.nivel]}</span>
          <span className="analise-card-ver">→ ver</span>
        </div>
      </div>
      <div className="analise-card-desc">{analise.descricao}</div>
    </Link>
  );
}

// ── Pontos Críticos ──────────────────────────────────────────────────

const PCRIT_TONE: Record<PontoCritico["nivel"], "danger" | "warning" | "info" | "success"> = {
  critico: "danger",
  risco: "warning",
  observacao: "info",
  conforme: "success",
};

function PontoCriticoRow({ ponto }: { ponto: PontoCritico }) {
  return (
    <div className="pcrit-item">
      <Badge tone={PCRIT_TONE[ponto.nivel]} className="pcrit-tag">
        {NIVEL_LABEL[ponto.nivel]}
      </Badge>
      <span className="pcrit-text">{ponto.texto}</span>
    </div>
  );
}

// ── Síntese do contrato (rodapé) ─────────────────────────────────────

function SinteseStrip({ revisao }: { revisao: RevisaoDocumental }) {
  const { sintese } = revisao;
  const diasRestantes = diasAteDataLimite(sintese.dataLimitePropostaISO);
  const dataLimiteFmt = new Date(sintese.dataLimitePropostaISO).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <section className="sintese">
      <div className="sintese-head">
        <div className="sintese-title">Síntese do Contrato em Análise</div>
        <div className="sintese-sub">{revisao.estadoContrato}</div>
      </div>
      <div className="sintese-grid">
        <div>
          <div className="sintese-cell-label">Valor Estimado</div>
          <div className="sintese-cell-value">{formatBRL(sintese.valorEstimado)}</div>
          <div className="sintese-cell-foot">orçamento de referência</div>
        </div>
        <div>
          <div className="sintese-cell-label">Prazo Proposto</div>
          <div className="sintese-cell-value">{sintese.prazoPropostoDias} dias</div>
          <div className="sintese-cell-foot">cronograma básico</div>
        </div>
        <div>
          <div className="sintese-cell-label">Data-Limite da Proposta</div>
          <div className="sintese-cell-value">{dataLimiteFmt}</div>
          <div className="sintese-cell-foot">
            {diasRestantes > 0 ? `Faltam ${diasRestantes} dias` : "Encerrado"}
          </div>
        </div>
        <div>
          <div className="sintese-cell-label">Documentos Processados</div>
          <div className="sintese-cell-value">{sintese.documentosProcessados} itens</div>
          <div className="sintese-cell-foot">
            {sintese.paginasIndexadas.toLocaleString("pt-BR")} páginas indexadas
          </div>
        </div>
      </div>
    </section>
  );
}
