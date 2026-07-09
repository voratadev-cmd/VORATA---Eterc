// Stub contextual reutilizado pelas rotas dos módulos M1.2–M5 enquanto não são
// implementadas. Garante que o título da tela aparece junto com o nome da obra
// ativa, o farol e a localização — pra dar sentido de contexto mesmo sem dados.

import { notFound, useParams } from "@tanstack/react-router";
import { Badge, Card, EmptyState, type IconName, I, PageHeader } from "@/components/ds";
import { farolLabel, farolToBadge, getContract } from "@/lib/mocks/contracts";

export type ContractStubPageProps = {
  /** Título do módulo (ex.: "1.2 Bases do Negócio"). */
  title: string;
  /** Subtítulo curto descrevendo o que a tela vai conter. */
  subtitle?: string;
  /** Ícone do EmptyState (default: doc). */
  iconName?: IconName;
  /** Texto do EmptyState. Sobrescreve o default. */
  emptyText?: string;
};

export function ContractStubPage({
  title,
  subtitle,
  iconName = "doc",
  emptyText,
}: ContractStubPageProps) {
  const { contractId } = useParams({ strict: false }) as { contractId?: string };
  const contract = contractId ? getContract(contractId) : undefined;
  if (contractId && !contract) throw notFound();

  const sub = contract
    ? `${contract.nome} · ${contract.localizacao}${subtitle ? ` — ${subtitle}` : ""}`
    : subtitle;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={sub}
        actions={
          contract ? (
            <Badge tone={farolToBadge[contract.farol]}>{farolLabel[contract.farol]}</Badge>
          ) : null
        }
      />
      <Card>
        <EmptyState
          icon={I[iconName]({ size: 42 })}
          title="Em construção"
          text={
            emptyText ??
            (contract
              ? `Esta tela será construída em uma próxima iteração e exibirá os dados de ${contract.nome}.`
              : "Esta tela será construída em uma próxima iteração.")
          }
        />
      </Card>
    </>
  );
}
