import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  Badge,
  type BadgeTone,
  Card,
  CardHeader,
  CardLink,
  CardSub,
  CardTitle,
  Col,
  Grid,
  I,
  PageHeader,
  ProgressBar,
} from "@/components/ds";
import { type Contract, getContract } from "@/lib/mocks/contracts";
import {
  type AcaoFaseInicial,
  type ChecklistItem,
  type DocumentoObrigatorio,
  type ModeloPreformatado,
  type RiscoPlano,
  type TranspasseData,
  getTranspasse,
} from "@/lib/mocks/obras";
import "./transpasse.css";

export const Route = createFileRoute("/_app/contracts/$contractId/pre/transpasse")({
  component: TranspassePage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const transpasse = getTranspasse(params.contractId);
    if (!transpasse) throw notFound();
    return { contract, transpasse };
  },
  head: () => ({ meta: [{ title: "Transpasse Orçamentário — RDM IA" }] }),
});

// ── Helpers de mapeamento ────────────────────────────────────────────

const RISCO_COLOR: Record<RiscoPlano["nivel"], string> = {
  alto: "var(--danger)",
  medio: "var(--warning)",
  baixo: "var(--info)",
};
const RISCO_LABEL: Record<RiscoPlano["nivel"], string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

const DOC_STATUS_TONE: Record<DocumentoObrigatorio["status"], BadgeTone> = {
  pendente: "warning",
  emitido: "success",
  vencido: "danger",
};
const DOC_STATUS_LABEL: Record<DocumentoObrigatorio["status"], string> = {
  pendente: "PENDENTE",
  emitido: "EMITIDO",
  vencido: "VENCIDO",
};

const FORMATO_TONE: Record<ModeloPreformatado["formato"], BadgeTone> = {
  DOCX: "info",
  XLSX: "success",
  PDF: "danger",
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmt = (iso: string) => DATE_FMT.format(new Date(iso));

// ── Página ───────────────────────────────────────────────────────────

function TranspassePage() {
  const { contract, transpasse } = Route.useLoaderData();

  return (
    <>
      <Breadcrumb contract={contract} />

      <PageHeader
        title="Transpasse Orçamentário"
        subtitle="Passagem formal do time de Orçamento para o time de Execução"
      />

      <HeroStrip transpasse={transpasse} />

      <Grid>
        <Col span={8}>
          <ResumoContratoCard transpasse={transpasse} />
          <div style={{ marginTop: "var(--s-4)" }}>
            <RiscosCard riscos={transpasse.riscos} />
          </div>
          <div style={{ marginTop: "var(--s-4)" }}>
            <PlanoAcaoCard acoes={transpasse.acoesFaseInicial} />
          </div>
          <div style={{ marginTop: "var(--s-4)" }}>
            <DocumentosObrigatoriosCard
              docs={transpasse.documentosObrigatorios}
              total={transpasse.documentosObrigatoriosTotal}
            />
          </div>
        </Col>

        <Col span={4}>
          <ModelosCard modelos={transpasse.modelos} total={transpasse.modelosTotal} />
          <div style={{ marginTop: "var(--s-4)" }}>
            <ChecklistCard checklist={transpasse.checklist} progresso={transpasse.progressoPct} />
          </div>
          <div style={{ marginTop: "var(--s-4)" }}>
            <ObservacoesCard observacoes={transpasse.observacoes} />
          </div>
        </Col>
      </Grid>

      <FooterActions liberacao={transpasse.liberacaoStatus} />
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
      <span className="crumb-current">Transpasse Orçamentário</span>
    </nav>
  );
}

// ── Hero Strip (5 cells) ─────────────────────────────────────────────

function HeroStrip({ transpasse }: { transpasse: TranspasseData }) {
  const liberado = transpasse.liberacaoStatus === "liberado";
  return (
    <div className="tr-hero">
      <div className="tr-hero-cell">
        <div className="tr-hero-label">Status do Transpasse</div>
        <div className="tr-hero-value tr-hero-status">{transpasse.statusLabel}</div>
        <div className="tr-hero-progress">
          <div className="tr-hero-progress-bar">
            <div
              className="tr-hero-progress-fill"
              style={{ width: `${transpasse.progressoPct}%` }}
            />
          </div>
          <div className="tr-hero-sub">{transpasse.progressoPct}% concluído</div>
        </div>
      </div>

      <div className="tr-hero-cell">
        <div className="tr-hero-label">Contrato</div>
        <div className="tr-hero-value-sm">{transpasse.contratoLocalizacao}</div>
        <div className="tr-hero-sub">{transpasse.contratoNumero}</div>
      </div>

      <div className="tr-hero-cell">
        <div className="tr-hero-label">Gestor Designado</div>
        <div className="tr-hero-value-sm">{transpasse.gestor.nome}</div>
        <div className="tr-hero-sub">Designado em {fmt(transpasse.gestor.designadoEmISO)}</div>
      </div>

      <div className="tr-hero-cell">
        <div className="tr-hero-label">Reunião de Transpasse</div>
        <div className="tr-hero-value-sm">
          {fmt(transpasse.reuniao.dataISO)} · {transpasse.reuniao.horario}
        </div>
        <div className="tr-hero-sub">
          {transpasse.reuniao.participantes} participantes confirmados
        </div>
      </div>

      <div className={`tr-hero-cell tr-hero-action ${liberado ? "ok" : ""}`}>
        <div className="tr-hero-label">Liberar para Execução</div>
        <div className="tr-hero-action-title">{liberado ? "Liberado" : "Bloqueado"}</div>
        <button type="button" className="tr-hero-action-btn">
          {liberado ? I.check({ size: 14 }) : I.lock({ size: 14 })}{" "}
          {liberado ? "Pronto" : "Aguardando itens"}
        </button>
      </div>
    </div>
  );
}

// ── Card 1: Resumo do Contrato e da Proposta ─────────────────────────

function ResumoContratoCard({ transpasse }: { transpasse: TranspasseData }) {
  const r = transpasse.resumoContrato;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>1. Resumo do Contrato e da Proposta</CardTitle>
          <CardSub>Informações principais e premissas formalizadas</CardSub>
        </div>
      </CardHeader>

      <div className="tr-resumo-grid">
        <ResumoItem label="Cliente" value={r.cliente} />
        <ResumoItem label="Contrato" value={r.contrato} />
        <ResumoItem label="Data Assinatura" value={fmt(r.dataAssinaturaISO)} />
        <ResumoItem label="Prazo Contratual" value={r.prazoContratual} />
        <ResumoItem label="Valor Contratual" value={r.valorContratual} />
        <ResumoItem label="Regime" value={r.regime} />
        <ResumoItem label="Data Base" value={r.dataBase} />
        <ResumoItem label="Reajuste" value={r.reajuste} />
      </div>

      <div className="tr-premissas-block">
        <div className="tr-premissas-label">Premissas Formalizadas</div>
        <ul className="tr-premissas">
          {transpasse.premissasFormalizadas.map((p, idx) => (
            <li key={idx} className="tr-premissa">
              <span className="tr-premissa-check" aria-hidden>
                {I.check({ size: 12 })}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <CardLink>Ver todas as premissas ({transpasse.premissasTotal})</CardLink>
      </div>
    </Card>
  );
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="tr-resumo-item">
      <div className="tr-resumo-item-label">{label}</div>
      <div className="tr-resumo-item-value">{value}</div>
    </div>
  );
}

// ── Card 2: Riscos Principais e Plano de Mitigação ───────────────────

function RiscosCard({ riscos }: { riscos: RiscoPlano[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>2. Riscos Principais e Plano de Mitigação</CardTitle>
          <CardSub>Riscos identificados na proposta e ações de mitigação</CardSub>
        </div>
      </CardHeader>

      <div className="tr-tabela tr-tabela-riscos" role="table">
        <div className="tr-tabela-head" role="row">
          <div role="columnheader">Risco</div>
          <div role="columnheader">Nível</div>
          <div role="columnheader">Impacto</div>
          <div role="columnheader">Plano de Mitigação</div>
        </div>
        {riscos.map((r) => (
          <div key={r.id} className="tr-tabela-row" role="row">
            <div role="cell" className="tr-cell-risco">
              {r.risco}
            </div>
            <div role="cell" className="tr-cell-nivel">
              <span className="tr-nivel-dot" style={{ background: RISCO_COLOR[r.nivel] }} />
              {RISCO_LABEL[r.nivel]}
            </div>
            <div role="cell" className="tr-cell-impacto">
              {r.impacto}
            </div>
            <div role="cell" className="tr-cell-plano">
              {r.planoMitigacao}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "var(--s-3)" }}>
        <CardLink>Ver matriz completa de riscos</CardLink>
      </div>
    </Card>
  );
}

// ── Card 3: Plano de Ação – Timeline ─────────────────────────────────

function PlanoAcaoCard({ acoes }: { acoes: AcaoFaseInicial[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>3. Plano de Ação – Fase Inicial (Mobilização e Primeiros 90 Dias)</CardTitle>
          <CardSub>Principais ações e marcos para o início da execução</CardSub>
        </div>
      </CardHeader>

      <ol className="tr-acoes-timeline">
        {acoes.map((a) => (
          <li key={a.id} className="tr-acao">
            <span className="tr-acao-num" aria-hidden>
              {a.ordem}
            </span>
            <div className="tr-acao-text">
              <div className="tr-acao-row">
                <span className="tr-acao-titulo">{a.titulo}</span>
                <span className="tr-acao-prazo">{a.prazo}</span>
              </div>
              <div className="tr-acao-desc">{a.descricao}</div>
            </div>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: "var(--s-3)" }}>
        <CardLink>Ver plano completo</CardLink>
      </div>
    </Card>
  );
}

// ── Card 4: Documentos Obrigatórios ──────────────────────────────────

function DocumentosObrigatoriosCard({
  docs,
  total,
}: {
  docs: DocumentoObrigatorio[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>4. Documentos Obrigatórios nos Primeiros Meses</CardTitle>
          <CardSub>Documentos que a Contratada deve emitir e registrar</CardSub>
        </div>
      </CardHeader>

      <div className="tr-tabela tr-tabela-docs" role="table">
        <div className="tr-tabela-head" role="row">
          <div role="columnheader">Documento</div>
          <div role="columnheader">Prazo</div>
          <div role="columnheader">Referência</div>
          <div role="columnheader" className="center">
            Status
          </div>
        </div>
        {docs.map((d) => (
          <div key={d.id} className="tr-tabela-row" role="row">
            <div role="cell" className="tr-cell-doc">
              {d.documento}
            </div>
            <div role="cell" className="tr-cell-prazo">
              {d.prazo}
            </div>
            <div role="cell" className="tr-cell-ref">
              {d.referencia}
            </div>
            <div role="cell" className="center">
              <Badge tone={DOC_STATUS_TONE[d.status]} className="tr-doc-tag">
                {DOC_STATUS_LABEL[d.status]}
              </Badge>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "var(--s-3)" }}>
        <CardLink>Ver todos os documentos obrigatórios ({total})</CardLink>
      </div>
    </Card>
  );
}

// ── Card 5: Modelos Pré-formatados ───────────────────────────────────

function ModelosCard({ modelos, total }: { modelos: ModeloPreformatado[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>5. Modelos de Documentos Pré-formatados</CardTitle>
          <CardSub>Modelos prontos para uso e preenchimento</CardSub>
        </div>
      </CardHeader>
      <ul className="tr-modelos">
        {modelos.map((m) => (
          <li key={m.id} className="tr-modelo">
            <span className="tr-modelo-icon" aria-hidden>
              {I.doc({ size: 18 })}
            </span>
            <div className="tr-modelo-text">
              <div className="tr-modelo-titulo">{m.titulo}</div>
              <Badge tone={FORMATO_TONE[m.formato]} className="tr-modelo-tag">
                {m.formato}
              </Badge>
            </div>
            <button type="button" className="tr-modelo-btn">
              {I.arrowDown({ size: 12 })} Baixar
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "var(--s-3)" }}>
        <CardLink>Ver todos os modelos ({total})</CardLink>
      </div>
    </Card>
  );
}

// ── Card 6: Checklist do Transpasse ──────────────────────────────────

function ChecklistCard({
  checklist,
  progresso,
}: {
  checklist: ChecklistItem[];
  progresso: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Checklist do Transpasse</CardTitle>
          <CardSub>Itens verificados para liberação à execução</CardSub>
        </div>
      </CardHeader>
      <ul className="tr-checklist">
        {checklist.map((c) => (
          <li key={c.id} className={`tr-check tr-check-${c.status}`}>
            <span className="tr-check-box" aria-hidden>
              {c.status === "concluido" ? I.check({ size: 12 }) : null}
            </span>
            <span className="tr-check-label">{c.label}</span>
            {c.progresso ? <span className="tr-check-progresso">{c.progresso}</span> : null}
          </li>
        ))}
      </ul>
      <div className="tr-checklist-footer">
        <div className="tr-checklist-footer-label">Progresso geral</div>
        <ProgressBar value={progresso} tone="success" size="md" aria-label="Progresso geral" />
        <div className="tr-checklist-footer-pct">{progresso}%</div>
      </div>
    </Card>
  );
}

// ── Card 7: Observações (dark) ───────────────────────────────────────

function ObservacoesCard({ observacoes }: { observacoes: string[] }) {
  return (
    <div className="tr-observacoes">
      <div className="tr-observacoes-head">
        <div className="tr-observacoes-title">Observações do Transpasse</div>
        <div className="tr-observacoes-sub">Registro de pontos relevantes</div>
      </div>
      <ul className="tr-observacoes-list">
        {observacoes.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Footer (3 botões) ────────────────────────────────────────────────

function FooterActions({ liberacao }: { liberacao: TranspasseData["liberacaoStatus"] }) {
  const liberado = liberacao === "liberado";
  return (
    <div className="tr-footer">
      <button type="button" className="tr-btn tr-btn-ghost">
        Salvar rascunho
      </button>
      <button type="button" className="tr-btn tr-btn-outline">
        {I.calendar({ size: 14 })} Agendar / Registrar Reunião de Transpasse
      </button>
      <button
        type="button"
        className={`tr-btn tr-btn-primary ${liberado ? "" : "tr-btn-disabled"}`}
        disabled={!liberado}
      >
        {I.lock({ size: 14 })} Liberar para Execução
      </button>
    </div>
  );
}
