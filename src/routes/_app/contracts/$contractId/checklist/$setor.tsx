// M4 · Página de uma engenharia setorial (SASBY). HONESTO: o diagnóstico/checklist preenchido é
// output do agente setorial daquela engenharia (backend · fase final, ainda não existe). Mostramos
// o ESCOPO da varredura (o que o agente vai cobrir, do doc) com status "aguardando agente", sem
// fabricar farol nem resultado. Quando o agente entrar, esta página exibe o checklist real.

import { Link, createFileRoute } from "@tanstack/react-router";
import { Button, EmptyState, I, type IconName, Skeleton } from "@/components/ds";
import { SETORES_SASBY, useChecklist } from "@/lib/hooks/useChecklist";
import "./index.css";

export const Route = createFileRoute("/_app/contracts/$contractId/checklist/$setor")({
  component: SetorPage,
  head: () => ({ meta: [{ title: "Engenharia setorial — RDM IA" }] }),
});

function SetorPage() {
  const { contractId, setor: slug } = Route.useParams();
  const { isLoading, isError } = useChecklist(contractId);
  const setor = SETORES_SASBY.find((s) => s.slug === slug);

  return (
    <main className="cl-main">
      <Link to="/contracts/$contractId/checklist" params={{ contractId }} className="cl-voltar">
        {I.chevLeft({ size: 14 })} Voltar ao check-list
      </Link>

      {isLoading ? (
        <Skeleton style={{ height: 320 }} />
      ) : isError ? (
        <EmptyState
          framed
          title="Não foi possível carregar o setor"
          text="Erro ao ler os dados normalizados desta obra. Tente recarregar."
        />
      ) : !setor ? (
        <EmptyState
          framed
          title="Engenharia não encontrada"
          text="Este setor não faz parte da varredura SASBY."
          action={
            <Link to="/contracts/$contractId/checklist" params={{ contractId }}>
              <Button variant="outline" size="sm">
                Ver as 8 engenharias
              </Button>
            </Link>
          }
        />
      ) : (
        <article className="cl-det">
          <header className="cl-det-head">
            <span className="cl-det-icon" aria-hidden>
              {I[setor.icon as IconName]?.({ size: 22 })}
            </span>
            <div className="cl-det-id">
              <div className="cl-det-codigo">
                <span className="cl-setor-num">{setor.codigo}</span> Engenharia
              </div>
              <h2 className="cl-det-titulo">{setor.nome}</h2>
            </div>
            <span className="cl-det-status">Aguardando agente</span>
          </header>

          <p className="cl-det-escopo">{setor.escopo}</p>
          {setor.alimenta ? (
            <p className="cl-det-alimenta">
              {I.share({ size: 13 })} {setor.alimenta}
            </p>
          ) : null}

          <section className="cl-det-bloco">
            <h3 className="cl-det-bloco-titulo">O que o agente desta engenharia vai varrer</h3>
            <ul className="cl-det-itens">
              {setor.itens.map((it) => (
                <li key={it} className="cl-det-item">
                  <span className="cl-det-item-dot" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </section>

          <aside className="cl-det-nota">
            <span className="cl-det-nota-icon" aria-hidden>
              {I.sparkle({ size: 16 })}
            </span>
            <p>
              <strong>Agente em mobilização.</strong> O diagnóstico desta engenharia — farol,
              achados e conduta sugerida — é gerado pelo agente setorial especialista (24/7) e
              publicado após a varredura inicial do BM-01. Sem o agente, não fabricamos resultado.
            </p>
          </aside>
        </article>
      )}
    </main>
  );
}
