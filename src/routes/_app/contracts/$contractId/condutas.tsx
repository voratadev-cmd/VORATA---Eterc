// 2.1.6 · Condutas Sugeridas e Geração de Documentos (top-level via Sidebar).
// REAL-TOLERANTE: obra do registry de demonstração → CondutasView (dataset rico);
// obra real do banco → CondutasRealView (obra_condutas · C.11). Sem notFound 404.

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ds";
import { CondutasView } from "@/components/pages/CondutasView";
import { CondutasRealView } from "@/components/pages/CondutasRealView";
import { getContract } from "@/lib/mocks/contracts";
import { getVisaoGeral } from "@/lib/mocks/obras";
import { useObra } from "@/lib/hooks/useObra";

type CondSearch = { bm?: string };

export const Route = createFileRoute("/_app/contracts/$contractId/condutas")({
  component: CondutasPage,
  validateSearch: (s: Record<string, unknown>): CondSearch => ({
    bm: typeof s.bm === "string" ? s.bm : undefined,
  }),
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    const visao = contract ? getVisaoGeral(params.contractId) : null;
    return { visao: visao ?? null };
  },
  head: () => ({ meta: [{ title: "2.1.6 Condutas e Documentos — RDM IA" }] }),
});

function CondutasPage() {
  const { visao } = Route.useLoaderData();
  const { contractId } = Route.useParams();
  const search = Route.useSearch();
  const { data: obra } = useObra(contractId);
  if (visao) return <CondutasView visao={visao} bmId={search.bm} />;
  return (
    <>
      <PageHeader
        title={`Condutas e Documentos · ${obra?.nome_interno ?? "Obra"}`}
        subtitle="Catálogo de condutas sugeridas pelo Adm Contratual IA (C.11) — dado normalizado do workbook"
      />
      <CondutasRealView contractId={contractId} />
    </>
  );
}
