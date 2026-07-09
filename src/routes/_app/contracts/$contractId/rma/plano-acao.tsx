// Aba "Plano de Ação" (RMA · 5.3.11).
// Wrapper fino · renderização compartilhada via PlanoAcaoView (dado real · obra_secoes C.12).

import { createFileRoute } from "@tanstack/react-router";
import { PlanoAcaoView } from "@/components/pages/PlanoAcaoView";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/plano-acao")({
  component: PlanoAcaoAba,
});

function PlanoAcaoAba() {
  const { contractId } = Route.useParams();
  return <PlanoAcaoView contractId={contractId} />;
}
