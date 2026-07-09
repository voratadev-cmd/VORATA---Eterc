// M2.1.9 · Controle Documental · aba Documentos Esperados
// Tabela hierárquica · 28 docs agrupados em 3 fases (A, B, C).

import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  ControleDocumentalEmpty,
  ControleDocumentalShell,
} from "@/components/pages/ControleDocumentalShared";
import { getContract } from "@/lib/mocks/contracts";
import { type DocEsperado, type ControleDocStatus, getObra } from "@/lib/mocks/obras";
import "./documentos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/controle-documental/documentos")({
  component: ControleDocumentalDocumentosPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, d: obra.controleDocumental ?? null };
  },
  head: () => ({ meta: [{ title: "Controle Documental · Documentos — RDM IA" }] }),
});

const STATUS_LABEL: Record<ControleDocStatus, string> = {
  completo: "✓ Completo",
  parcial: "⚠ Parcial",
  pendente: "✗ Pendente",
  "nao-aplica": "— N/A",
};

const STATUS_BG: Record<ControleDocStatus, string> = {
  completo: "var(--success-bg)",
  parcial: "var(--warning-bg)",
  pendente: "var(--danger-bg)",
  "nao-aplica": "var(--surface-2)",
};

const STATUS_COLOR: Record<ControleDocStatus, string> = {
  completo: "var(--success)",
  parcial: "var(--warning)",
  pendente: "var(--danger)",
  "nao-aplica": "var(--text-3)",
};

const FASE_TOM: Record<"A" | "B" | "C", "success" | "warning" | "danger"> = {
  A: "success",
  B: "warning",
  C: "warning",
};

function ControleDocumentalDocumentosPage() {
  const { contract, d } = Route.useLoaderData();
  if (!d) return <ControleDocumentalEmpty contractNome={contract.nome} />;

  // Agrupa por fase preservando a ordem dos documentos.
  const fases: Array<"A" | "B" | "C"> = ["A", "B", "C"];

  return (
    <ControleDocumentalShell d={d} contractId={contract.id} active="documentos">
      <section className="cdd-secao">
        <header className="cdd-secao-head">
          <h3 className="cdd-secao-titulo">Documentos Esperados</h3>
          <p className="cdd-secao-sub">
            {d.totalDocsEsperados} tipos · agrupados por fase do contrato · clique para abrir o
            documento ou ver detalhes
          </p>
        </header>

        <div className="cdd-tabela-wrap">
          <div className="cdd-tabela">
            <div className="cdd-tabela-head">
              <span>ID</span>
              <span>DOCUMENTO</span>
              <span>ÁREA NA ETERC</span>
              <span>ÚLTIMA VERSÃO</span>
              <span>STATUS</span>
              <span>OBSERVAÇÃO</span>
              <span>CONFERIDO POR</span>
            </div>

            {fases.map((fase) => (
              <FaseGrupo
                key={fase}
                fase={fase}
                titulo={d.faseTitulos[fase]}
                docs={d.documentos.filter((doc) => doc.fase === fase)}
              />
            ))}
          </div>
        </div>
      </section>
    </ControleDocumentalShell>
  );
}

function FaseGrupo({
  fase,
  titulo,
  docs,
}: {
  fase: "A" | "B" | "C";
  titulo: string;
  docs: DocEsperado[];
}) {
  const tom = FASE_TOM[fase];
  return (
    <>
      <div className={`cdd-fase-row cdd-fase-row-${tom}`}>
        <span className="cdd-fase-pill">FASE {fase}</span>
        <span className="cdd-fase-titulo">{titulo}</span>
      </div>
      {docs.map((doc) => (
        <DocRow key={doc.id} doc={doc} />
      ))}
    </>
  );
}

function DocRow({ doc }: { doc: DocEsperado }) {
  return (
    <div className={`cdd-row ${doc.critico ? "cdd-row-critico" : ""}`}>
      <span className="cdd-row-id">{doc.id}</span>
      <span className="cdd-row-doc">
        <span className="cdd-row-doc-nome">{doc.documento}</span>
        <span className="cdd-row-doc-desc">{doc.descricao}</span>
      </span>
      <span className="cdd-row-area">
        <span className="cdd-row-area-nome">{doc.area}</span>
        <span className="cdd-row-area-resp">{doc.responsavelInicial}</span>
      </span>
      <span className="cdd-row-versao">{doc.versaoLabel}</span>
      <span className="cdd-row-status">
        <span
          className="cdd-status-pill"
          style={{
            background: STATUS_BG[doc.status],
            color: STATUS_COLOR[doc.status],
          }}
        >
          {STATUS_LABEL[doc.status]}
        </span>
      </span>
      <span className="cdd-row-obs">{doc.observacao}</span>
      <span className="cdd-row-conferido">
        <span className="cdd-row-conferido-pill">{doc.conferidoPor}</span>
      </span>
    </div>
  );
}
