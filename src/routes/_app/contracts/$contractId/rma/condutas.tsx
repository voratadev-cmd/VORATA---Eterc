// Aba "Condutas Sugeridas e Geração de Documentos" (RMA · 5.3.10).
// REAL-TOLERANTE: obra do registry de demonstração → CondutasView (dataset rico);
// obra real do banco → CondutasRealView (obra_condutas · C.11). Sem notFound 404.

import { createFileRoute } from "@tanstack/react-router";
import { CondutasView } from "@/components/pages/CondutasView";
import { CondutasRealView } from "@/components/pages/CondutasRealView";
import { getContract } from "@/lib/mocks/contracts";
import { getVisaoGeral } from "@/lib/mocks/obras";

type CondSearch = { bm?: string };

export const Route = createFileRoute("/_app/contracts/$contractId/rma/condutas")({
  component: CondutasAba,
  validateSearch: (s: Record<string, unknown>): CondSearch => ({
    bm: typeof s.bm === "string" ? s.bm : undefined,
  }),
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    const visao = contract ? getVisaoGeral(params.contractId) : null;
    return { visao: visao ?? null };
  },
});

function CondutasAba() {
  const { visao } = Route.useLoaderData();
  const { contractId } = Route.useParams();
  const search = Route.useSearch();
  if (visao) return <CondutasView visao={visao} bmId={search.bm} />;
  return <CondutasRealView contractId={contractId} />;
}
