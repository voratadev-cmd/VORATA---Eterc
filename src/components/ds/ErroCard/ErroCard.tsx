// ErroCard — estado de ERRO padrão do produto (falha recuperável, com retry).
//
// REGRA: erro NUNCA renderiza como pendência/empty honesto. Pendência é ausência
// honesta de dado (não normalizado, aguardando extração) e usa EmptyState neutro;
// erro é falha de carregamento/rede e SEMPRE mostra Badge danger + botão de retry.
// Mascarar erro como pendência mente pro usuário que "ainda não tem dado" quando
// na verdade o fetch quebrou. (REFINO-UX-RMA · T8 / quick win 6.)
//
// Uso:  <ErroCard mensagem={error.message} onRetry={() => refetch()} />
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { EmptyState } from "../EmptyState/EmptyState";
import "./ErroCard.css";

export type ErroCardProps = {
  /** Título; default "Não foi possível carregar". */
  titulo?: ReactNode;
  /** Mensagem técnica discreta (ex.: error.message) — exibida em --text-4 / --fs-12. */
  mensagem?: ReactNode;
  /** Handler do retry (ex.: refetch do hook). Sem onRetry o botão não aparece. */
  onRetry?: () => void;
  /** Rótulo do botão de retry; default "Tentar novamente". */
  retryLabel?: string;
  /** Moldura tracejada de página (default true). false → inline, dentro de cards/painéis. */
  framed?: boolean;
  className?: string;
};

export function ErroCard({
  titulo = "Não foi possível carregar",
  mensagem,
  onRetry,
  retryLabel = "Tentar novamente",
  framed = true,
  className,
}: ErroCardProps) {
  return (
    <EmptyState
      framed={framed}
      className={cn("erro-card", className)}
      icon={<TriangleAlert size={40} strokeWidth={1.75} aria-hidden />}
      title={titulo}
      text={
        <span className="erro-card-body">
          {mensagem ? <span className="erro-card-msg">{mensagem}</span> : null}
          <Badge tone="danger">Erro</Badge>
        </span>
      }
      action={
        onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}
