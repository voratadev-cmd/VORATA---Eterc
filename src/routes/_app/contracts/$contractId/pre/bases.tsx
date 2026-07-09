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
  type BDIComponente,
  type BasesData,
  type ItemComparativo,
  type PremissaFragilFormalizar,
  type PremissaItem,
  getBases,
} from "@/lib/mocks/obras";
import "./bases.css";

export const Route = createFileRoute("/_app/contracts/$contractId/pre/bases")({
  component: BasesPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const bases = getBases(params.contractId);
    if (!bases) throw notFound();
    return { contract, bases };
  },
  head: () => ({ meta: [{ title: "Bases do Negócio — RDM IA" }] }),
});

const FAROL_COLOR = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
} as const;

function BasesPage() {
  const { contract, bases } = Route.useLoaderData();

  return (
    <>
      <Breadcrumb contract={contract} />

      <PageHeader
        title="Bases do Negócio · Validação da Proposta"
        subtitle="Agente Orçamento · Premissas, produtividades, preços, BDI · Base referencial: Orsafáscio API · SINAPI · Histórico de contratos similares"
      />

      <HeroStrip bases={bases} />

      <Grid>
        <Col span={8}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Comparativo de Produtividades e Preços</CardTitle>
                <CardSub>
                  Top desvios vs. bases referenciais · ordenação: maior desvio negativo
                </CardSub>
              </div>
            </CardHeader>
            <ComparativoTable itens={bases.comparativoPrecos} />
            <div className="bases-tabela-foot">
              Desvio negativo = preço proposto abaixo da referência (risco de subdimensionamento) ·{" "}
              {bases.itensComDesvio.fora} de {bases.itensComDesvio.total} itens fora do intervalo
              aceitável
            </div>
          </Card>
        </Col>

        <Col span={4}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Composição do BDI</CardTitle>
                <CardSub>
                  {bases.bdiTotalPct.toLocaleString("pt-BR")}% sobre custo direto · validado vs.
                  tabela CNI/IBAPE
                </CardSub>
              </div>
            </CardHeader>
            <BDIList componentes={bases.bdiComponentes} />
          </Card>
        </Col>

        <Col span={12}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Premissas da Proposta · Validação</CardTitle>
                <CardSub>
                  Analisado pelo Agente Orçamento · base referencial: contratos similares na região
                </CardSub>
              </div>
            </CardHeader>
            <PremissasTable premissas={bases.premissas} />
          </Card>
        </Col>
      </Grid>

      <PremissasFrageisCard
        premissas={bases.premissasFrageis}
        restantes={bases.premissasFrageisRestantes}
      />
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
      <span className="crumb-current">Bases do Negócio</span>
    </nav>
  );
}

// ── Hero Strip ───────────────────────────────────────────────────────

function HeroStrip({ bases }: { bases: BasesData }) {
  return (
    <div className="rev-hero">
      <div className="rev-hero-cell">
        <div className="rev-hero-label">Risco Orçamentário Estimado</div>
        <div className="rev-hero-value">{formatBRL(bases.riscoOrcamentarioEstimado)}</div>
        <div className="rev-hero-sub">
          {bases.riscoOrcamentarioPct.toLocaleString("pt-BR")}% do valor proposto · com base nas
          premissas frágeis identificadas
        </div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Premissas Frágeis</div>
        <div className="rev-hero-value">{bases.premissasFrageisCount}</div>
        <div className="rev-hero-sub">a formalizar no Transpasse</div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Itens com Desvio</div>
        <div className="rev-hero-value">
          {bases.itensComDesvio.fora} / {bases.itensComDesvio.total}
        </div>
        <div className="rev-hero-sub">vs. bases referenciais</div>
      </div>

      <div className="rev-hero-cell">
        <div className="rev-hero-label">Próximo Passo</div>
        <div className="rev-hero-action-title">Compilar para Diagnóstico</div>
        <button type="button" className="rev-hero-action-btn">
          {I.arrowRight({ size: 14 })} Enviar análises
        </button>
      </div>
    </div>
  );
}

// ── Tabela: Comparativo de Produtividades e Preços ───────────────────

function ComparativoTable({ itens }: { itens: ItemComparativo[] }) {
  return (
    <div className="bases-tabela bases-tabela-precos" role="table">
      <div className="bases-tabela-head" role="row">
        <div role="columnheader">Item</div>
        <div role="columnheader">Und</div>
        <div role="columnheader" className="num">
          Qtde
        </div>
        <div role="columnheader" className="num">
          Preço proposto
        </div>
        <div role="columnheader" className="num">
          Referência
        </div>
        <div role="columnheader">Fonte</div>
        <div role="columnheader" className="num">
          Desvio
        </div>
        <div role="columnheader" className="center">
          Farol
        </div>
      </div>
      {itens.map((i) => (
        <div key={i.id} className="bases-tabela-row" role="row">
          <div role="cell" className="bases-cell-item">
            {i.item}
          </div>
          <div role="cell" className="bases-cell-und">
            {i.und}
          </div>
          <div role="cell" className="num tabular">
            {i.qtde.toLocaleString("pt-BR")}
          </div>
          <div role="cell" className="num tabular">
            {formatBRL(i.precoProposto)}
          </div>
          <div role="cell" className="num tabular bases-cell-ref">
            {formatBRL(i.referencia)}
          </div>
          <div role="cell" className="bases-cell-fonte">
            {i.fonte}
          </div>
          <div
            role="cell"
            className="num tabular bases-cell-desvio"
            style={{ color: FAROL_COLOR[i.farol] }}
          >
            {i.desvioPct > 0 ? "+" : ""}
            {i.desvioPct.toLocaleString("pt-BR")}%
          </div>
          <div role="cell" className="center">
            <span className="bases-farol-dot" style={{ background: FAROL_COLOR[i.farol] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Composição do BDI ────────────────────────────────────────────────

function BDIList({ componentes }: { componentes: BDIComponente[] }) {
  return (
    <ul className="bdi-list">
      {componentes.map((c) => (
        <li key={c.id} className="bdi-item">
          <span className="bdi-bar" style={{ background: FAROL_COLOR[c.farol] }} aria-hidden />
          <div className="bdi-text">
            <div className="bdi-name">
              {c.nome} · {c.pct.toLocaleString("pt-BR")}%
            </div>
            <div className="bdi-status">{c.status}</div>
          </div>
          <Badge tone={c.farol === "conforme" ? "success" : "warning"} className="bdi-tag">
            {c.farol === "conforme" ? "OK" : "RISCO"}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

// ── Tabela: Premissas da Proposta ────────────────────────────────────

function PremissasTable({ premissas }: { premissas: PremissaItem[] }) {
  return (
    <div className="bases-tabela bases-tabela-premissas" role="table">
      <div className="bases-tabela-head" role="row">
        <div role="columnheader">Premissa</div>
        <div role="columnheader">Valor proposto</div>
        <div role="columnheader">Referência</div>
        <div role="columnheader">Análise</div>
        <div role="columnheader" className="center">
          Farol
        </div>
      </div>
      {premissas.map((p) => (
        <div key={p.id} className="bases-tabela-row" role="row">
          <div role="cell" className="bases-cell-item">
            {p.premissa}
          </div>
          <div role="cell" className="tabular">
            {p.valorProposto}
          </div>
          <div role="cell" className="tabular bases-cell-ref">
            {p.referencia}
          </div>
          <div role="cell" className="bases-cell-desvio" style={{ color: FAROL_COLOR[p.farol] }}>
            {p.analise}
          </div>
          <div role="cell" className="center">
            <span className="bases-farol-dot" style={{ background: FAROL_COLOR[p.farol] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Premissas Frágeis a Formalizar (card warning) ────────────────────

function PremissasFrageisCard({
  premissas,
  restantes,
}: {
  premissas: PremissaFragilFormalizar[];
  restantes: number;
}) {
  return (
    <section className="frageis">
      <header className="frageis-head">
        <span className="frageis-icon" aria-hidden>
          {I.flag({ size: 16 })}
        </span>
        <div>
          <div className="frageis-title">Premissas Frágeis a Formalizar no Transpasse</div>
          <div className="frageis-sub">
            Itens que precisam virar registro formal (carta, ata, e-mail) para preservar direito
            futuro de pleito
          </div>
        </div>
      </header>
      <div className="frageis-grid">
        {premissas.map((p) => (
          <div key={p.id} className="frageis-item">
            <div className="frageis-item-title">{p.titulo}</div>
            <div className="frageis-item-desc">{p.descricao}</div>
          </div>
        ))}
        {restantes > 0 ? (
          <div className="frageis-item frageis-item-more">
            <div className="frageis-item-title">+ {restantes} outras premissas</div>
            <div className="frageis-item-desc">
              ver lista completa no Diagnóstico do Contrato (M1.3).
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
