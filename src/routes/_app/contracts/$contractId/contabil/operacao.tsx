// M-Contábil · aba Operação
// Documentos pendentes de upload · Próximas ações.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { I } from "@/components/ds";
import { ContabilEmpty, ContabilShell } from "@/components/pages/ContabilShared";
import { getContract } from "@/lib/mocks/contracts";
import { type ContabilDocumento, type ContabilProximaAcao, getObra } from "@/lib/mocks/obras";
import "./operacao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/contabil/operacao")({
  component: ContabilOperacaoPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, c: obra.contabil ?? null };
  },
  head: () => ({ meta: [{ title: "Contábil · Operação — RDM IA" }] }),
});

function ContabilOperacaoPage() {
  const { contract, c } = Route.useLoaderData();
  if (!c) return <ContabilEmpty contractNome={contract.nome} />;

  return (
    <ContabilShell d={c} contractId={contract.id} active="operacao">
      <div className="cto-grid">
        <DocumentosCard documentos={c.documentos} totalLabel={c.documentosTotalLabel} />
        <ProximasAcoesCard acoes={c.proximasAcoes} nota={c.proximasAcoesNota} />
      </div>
    </ContabilShell>
  );
}

function DocumentosCard({
  documentos,
  totalLabel,
}: {
  documentos: ContabilDocumento[];
  totalLabel: string;
}) {
  return (
    <section className="cto-card">
      <header className="cto-card-head">
        <h3 className="cto-card-titulo">
          <span className="cto-card-icon">{I.doc({ size: 14 })}</span>
          Documentos para Upload
        </h3>
        <p className="cto-card-sub">{totalLabel}</p>
      </header>
      <ul className="cto-docs">
        {documentos.map((d) => (
          <DocumentoLi key={d.id} d={d} />
        ))}
      </ul>
    </section>
  );
}

function DocumentoLi({ d }: { d: ContabilDocumento }) {
  return (
    <li className="cto-doc">
      <div className="cto-doc-corpo">
        <div className="cto-doc-titulo">{d.titulo}</div>
        <div className="cto-doc-meta">{d.origem}</div>
      </div>
      <span className={`cto-doc-pill cto-doc-pill-${d.prazoTone}`}>{d.prazoLabel}</span>
    </li>
  );
}

function ProximasAcoesCard({ acoes, nota }: { acoes: ContabilProximaAcao[]; nota: string }) {
  return (
    <section className="cto-card">
      <header className="cto-card-head">
        <h3 className="cto-card-titulo">
          <span className="cto-card-icon">{I.clock({ size: 14 })}</span>
          Próximas Ações · Equipe Contábil
        </h3>
        <p className="cto-card-sub">{nota}</p>
      </header>
      <ul className="cto-acoes">
        {acoes.map((a) => (
          <li key={a.id} className="cto-acao">
            <div className="cto-acao-corpo">
              <div className="cto-acao-titulo">{a.titulo}</div>
              <div className="cto-acao-meta">{a.meta}</div>
            </div>
            <span className="cto-acao-prazo">{a.prazoLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
