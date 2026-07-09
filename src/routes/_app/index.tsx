// Home (/) — o Dashboard agora é POR OBRA (/contracts/$id/dashboard). Esta rota só redireciona pra
// obra ativa (a primeira da carteira); sem obra, mostra o onboarding de cadastro. A lista/portfólio
// de obras vive em /contracts.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button, EmptyState, I, PageHeader } from "@/components/ds";
import { useObras } from "@/lib/hooks/useObras";

export const Route = createFileRoute("/_app/")({
  component: HomeRedirect,
  head: () => ({ meta: [{ title: "Dashboard — RDM IA" }] }),
});

function HomeRedirect() {
  const navigate = useNavigate();
  const { data: obras, isLoading, error } = useObras();
  const primeira = obras?.[0];

  useEffect(() => {
    if (primeira) {
      navigate({
        to: "/contracts/$contractId/dashboard",
        params: { contractId: primeira.id },
        replace: true,
      });
    }
  }, [primeira, navigate]);

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Falha ao carregar o portfólio." />
        <EmptyState
          framed
          icon={I.close({ size: 44 })}
          title="Não foi possível carregar as obras"
          text={error.message}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          }
        />
      </>
    );
  }

  if (!isLoading && !primeira) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Nenhuma obra cadastrada ainda." />
        <EmptyState
          framed
          icon={I.doc({ size: 44 })}
          title="O dashboard executivo aparece por obra"
          text="Cadastre a primeira obra para começar. O dashboard de cada obra — faróis, faturamento, prazo, desequilíbrio e os riscos da IA — fica disponível conforme o pipeline processa os documentos."
          hint="Aguardando primeira obra"
          action={
            <Button size="md" onClick={() => navigate({ to: "/contracts/new" })}>
              {I.plus({ size: 16 })} Cadastrar nova obra
            </Button>
          }
        />
      </>
    );
  }

  // carregando ou redirecionando
  return <PageHeader title="Dashboard" subtitle="Abrindo a obra…" />;
}
