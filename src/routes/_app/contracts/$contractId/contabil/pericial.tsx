// M-Contábil · aba Apuração Pericial
// Custo Realizado Acumulado − Receita Líquida Realizada = Resultado real do mês.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { I } from "@/components/ds";
import { ContabilEmpty, ContabilShell } from "@/components/pages/ContabilShared";
import { getContract } from "@/lib/mocks/contracts";
import { getObra } from "@/lib/mocks/obras";
import "./pericial.css";

export const Route = createFileRoute("/_app/contracts/$contractId/contabil/pericial")({
  component: ContabilPericialPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, c: obra.contabil ?? null };
  },
  head: () => ({ meta: [{ title: "Contábil · Apuração Pericial — RDM IA" }] }),
});

function ContabilPericialPage() {
  const { contract, c } = Route.useLoaderData();
  if (!c) return <ContabilEmpty contractNome={contract.nome} />;
  const a = c.apuracao;

  return (
    <ContabilShell d={c} contractId={contract.id} active="pericial">
      <section className="cpr-secao">
        <header className="cpr-secao-head">
          <div className="cpr-secao-icon">{I.book({ size: 18 })}</div>
          <div>
            <h3 className="cpr-secao-titulo">Apuração de Prejuízo Real (perícia / claim)</h3>
            <p className="cpr-secao-sub">
              Confronto entre custo realizado e receita líquida realizada · base oficial para
              perícia técnica futura
            </p>
          </div>
        </header>

        <div className="cpr-metodologia">
          <span className="cpr-metod-label">METODOLOGIA APLICADA</span>
          <span className="cpr-metod-valor">{a.metodologiaLabel}</span>
        </div>

        <div className="cpr-grid">
          <article className="cpr-card cpr-card-custo">
            <div className="cpr-card-label">CUSTO REAL ACUMULADO</div>
            <div className="cpr-card-valor">{a.custoRealAcumuladoLabel}</div>
            <div className="cpr-card-nota">{a.custoRealNota}</div>
          </article>

          <article className="cpr-card cpr-card-receita">
            <div className="cpr-card-label">RECEITA LÍQUIDA REAL</div>
            <div className="cpr-card-valor">{a.receitaLiquidaRealLabel}</div>
            <div className="cpr-card-nota">{a.receitaLiquidaNota}</div>
          </article>
        </div>

        <article className={`cpr-resultado cpr-resultado-${a.resultadoRealFarol}`}>
          <div className="cpr-resultado-label">RESULTADO REAL DO MÊS (LUCRO)</div>
          <div className="cpr-resultado-valor">{a.resultadoRealLabel}</div>
          <div className="cpr-resultado-nota">{a.resultadoRealNota}</div>
        </article>

        <aside className="cpr-observacao">
          <span className="cpr-observacao-icon">{I.note({ size: 14 })}</span>
          <span className="cpr-observacao-texto">
            <strong>Observação contábil:</strong> {a.observacaoContabil}
          </span>
        </aside>
      </section>
    </ContabilShell>
  );
}
