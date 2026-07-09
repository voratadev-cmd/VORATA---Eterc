// M2.1.9 · Controle Documental · aba Operação
// Dica do Agente Documental sobre cruzamento automático de pendências.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { I } from "@/components/ds";
import {
  ControleDocumentalEmpty,
  ControleDocumentalShell,
} from "@/components/pages/ControleDocumentalShared";
import { getContract } from "@/lib/mocks/contracts";
import { getObra } from "@/lib/mocks/obras";
import "./operacao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/controle-documental/operacao")({
  component: ControleDocumentalOperacaoPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, d: obra.controleDocumental ?? null };
  },
  head: () => ({ meta: [{ title: "Controle Documental · Operação — RDM IA" }] }),
});

function ControleDocumentalOperacaoPage() {
  const { contract, d } = Route.useLoaderData();
  if (!d) return <ControleDocumentalEmpty contractNome={contract.nome} />;

  return (
    <ControleDocumentalShell d={d} contractId={contract.id} active="operacao">
      <aside className="cdo-dica">
        <span className="cdo-dica-icon">{I.bell({ size: 14 })}</span>
        <p className="cdo-dica-texto">
          <strong>Dica:</strong> o Agente Documental cruza automaticamente os RDOs, projetos
          recebidos, atas e e-mails arquivados pra identificar lacunas. Quando uma pendência fica
          mais de 7 dias sem resposta, ele sugere uma carta de cobrança formal protocolável.
        </p>
      </aside>
    </ControleDocumentalShell>
  );
}
