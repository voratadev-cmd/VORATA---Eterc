import { createFileRoute } from "@tanstack/react-router";
import { Card, EmptyState, I, PageHeader } from "@/components/ds";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — RDM IA" }] }),
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Critérios de farol, integrações, equipe." />
      <Card>
        <EmptyState
          icon={I.settings({ size: 42 })}
          title="Configurações em construção"
          text="Em breve: critérios numéricos do farol por contrato, integrações (Jusbrasil, Orsafáscio, e-mail da obra), gestão de equipe, permissões."
        />
      </Card>
    </>
  );
}
