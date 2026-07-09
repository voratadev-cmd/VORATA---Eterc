// M-Contábil · aba Análise por Capítulo
// Tabela hierárquica · Receita Bruta → Impostos → Receita Líquida → Custo da Obra
// → Lucro Bruto → Despesas Indiretas → Resultado Operacional → Resultado Líquido.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContabilEmpty, ContabilShell } from "@/components/pages/ContabilShared";
import { getContract } from "@/lib/mocks/contracts";
import { type ContabilFarol, type ContabilLinhaCapitulo, getObra } from "@/lib/mocks/obras";
import "./capitulo.css";

export const Route = createFileRoute("/_app/contracts/$contractId/contabil/capitulo")({
  component: ContabilCapituloPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, c: obra.contabil ?? null };
  },
  head: () => ({ meta: [{ title: "Contábil · Análise por Capítulo — RDM IA" }] }),
});

const FAROL_COLOR: Record<ContabilFarol, string> = {
  conforme: "var(--success)",
  atencao: "var(--warning)",
  risco: "var(--warning)",
  critico: "var(--danger)",
  favoravel: "var(--success)",
  construcao: "var(--info)",
};

function ContabilCapituloPage() {
  const { contract, c } = Route.useLoaderData();
  if (!c) return <ContabilEmpty contractNome={contract.nome} />;

  return (
    <ContabilShell d={c} contractId={contract.id} active="capitulo">
      <section className="ctc-secao">
        <header className="ctc-secao-head">
          <h3 className="ctc-secao-titulo">Análise Mensal · Custo Real por Capítulo</h3>
          <p className="ctc-secao-sub">
            Estrutura espelhada do AGM oficial · base ETERC · realizado vs. previsto para a produção
            realizada
          </p>
        </header>
        <div className="ctc-tabela-wrap">
          <div className="ctc-tabela">
            <div className="ctc-tabela-head">
              <span>CÓD</span>
              <span>CAPÍTULO</span>
              <span className="ctc-col-right">REALIZADO ATÉ HOJE</span>
              <span className="ctc-col-right">PREVISTO P/ PRODUÇÃO</span>
              <span className="ctc-col-right">DESVIO</span>
              <span className="ctc-col-center">FAROL</span>
            </div>
            {c.tabelaLinhas.map((l) => (
              <Linha key={l.id} l={l} />
            ))}
          </div>
        </div>
      </section>
    </ContabilShell>
  );
}

function Linha({ l }: { l: ContabilLinhaCapitulo }) {
  if (l.cabecalho) {
    return (
      <div className={`ctc-tabela-cab ctc-tabela-cab-${l.cabecalhoTone ?? "neutral"}`}>
        <span className="ctc-cab-titulo">{l.capitulo}</span>
        {l.realizadoPagoLabel && <span className="ctc-cab-valor">{l.realizadoPagoLabel}</span>}
        {l.realizadoApagarLabel && <span className="ctc-cab-extra">{l.realizadoApagarLabel}</span>}
        {l.cabecalhoExtra && <span className="ctc-cab-desvio">{l.cabecalhoExtra}</span>}
      </div>
    );
  }
  return (
    <div className="ctc-tabela-linha">
      <span className="ctc-linha-codigo">{l.codigo}</span>
      <span className="ctc-linha-cap">{l.capitulo}</span>
      <span className="ctc-col-right ctc-linha-celula">
        <span className="ctc-linha-pago">{l.realizadoPagoLabel}</span>
        {l.realizadoApagarLabel && l.realizadoApagarLabel !== "—" && (
          <span className="ctc-linha-apagar">{l.realizadoApagarLabel}</span>
        )}
      </span>
      <span className="ctc-col-right">{l.previstoLabel}</span>
      <span className="ctc-col-right ctc-linha-desvio">
        {l.desvioLabel}
        {l.observacao && <span className="ctc-linha-obs">{l.observacao}</span>}
      </span>
      <span className="ctc-col-center">
        {l.farol && <span className="ctc-linha-dot" style={{ background: FAROL_COLOR[l.farol] }} />}
      </span>
    </div>
  );
}
