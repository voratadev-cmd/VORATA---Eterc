// 2.1.7 · Plano de Ação · 5W2H (top-level via Sidebar).
// Mesma renderização da aba do RMA · compartilhada via PlanoAcaoView (dado real · obra_secoes C.12).

import { createFileRoute } from "@tanstack/react-router";
import { PlanoAcaoView } from "@/components/pages/PlanoAcaoView";

export const Route = createFileRoute("/_app/contracts/$contractId/plano-acao")({
  component: PlanoAcaoPage,
  head: () => ({ meta: [{ title: "2.1.7 Plano de Ação — RDM IA" }] }),
});

function PlanoAcaoPage() {
  const { contractId } = Route.useParams();
  return <PlanoAcaoView contractId={contractId} />;
}
