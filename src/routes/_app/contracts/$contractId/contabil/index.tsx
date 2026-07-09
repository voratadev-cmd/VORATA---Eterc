// M-Contábil · Visão Geral (Geralzão) · default da rota /contabil
// Painel multidimensional com 8 dimensões + Análise do Agente Contábil.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { I, type IconName } from "@/components/ds";
import { ContabilEmpty, ContabilShell } from "@/components/pages/ContabilShared";
import { getContract } from "@/lib/mocks/contracts";
import { type ContabilDimensao, type ContabilFarol, getObra } from "@/lib/mocks/obras";
import "./geralzao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/contabil/")({
  component: ContabilGeralzaoPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, c: obra.contabil ?? null };
  },
  head: () => ({ meta: [{ title: "Contábil · AGM — RDM IA" }] }),
});

const FAROL_LABEL: Record<ContabilFarol, string> = {
  conforme: "CONFORME",
  atencao: "ATENÇÃO",
  risco: "RISCO",
  critico: "CRÍTICO",
  favoravel: "FAVORÁVEL",
  construcao: "EM CONSTRUÇÃO",
};

const FAROL_COLOR: Record<ContabilFarol, string> = {
  conforme: "var(--success)",
  atencao: "var(--warning)",
  risco: "var(--warning)",
  critico: "var(--danger)",
  favoravel: "var(--success)",
  construcao: "var(--info)",
};

const FAROL_BG: Record<ContabilFarol, string> = {
  conforme: "var(--success-bg)",
  atencao: "var(--warning-bg)",
  risco: "var(--warning-bg)",
  critico: "var(--danger-bg)",
  favoravel: "var(--success-bg)",
  construcao: "var(--info-bg)",
};

function ContabilGeralzaoPage() {
  const { contract, c } = Route.useLoaderData();

  if (!c) return <ContabilEmpty contractNome={contract.nome} />;

  return (
    <ContabilShell d={c} contractId={contract.id} active="geralzao">
      <PainelMultidimensional dimensoes={c.dimensoes} />
      <AnaliseAgente d={c} />
    </ContabilShell>
  );
}

function PainelMultidimensional({ dimensoes }: { dimensoes: ContabilDimensao[] }) {
  return (
    <section className="ctg-secao">
      <header className="ctg-secao-head">
        <h3 className="ctg-secao-titulo">Painel Multidimensional Contábil</h3>
        <p className="ctg-secao-sub">8 dimensões de acompanhamento gerencial</p>
      </header>
      <div className="ctg-grid">
        {dimensoes.map((d) => (
          <Dimensao key={d.id} d={d} />
        ))}
      </div>
    </section>
  );
}

function Dimensao({ d }: { d: ContabilDimensao }) {
  const IconFn = I[d.iconKey as IconName] ?? I.note;
  return (
    <article className="ctg-dim">
      <header className="ctg-dim-head">
        <span className="ctg-dim-icon" style={{ color: FAROL_COLOR[d.farol] }}>
          {IconFn({ size: 14 })}
        </span>
        <span
          className="ctg-dim-farol"
          style={{ background: FAROL_BG[d.farol], color: FAROL_COLOR[d.farol] }}
        >
          {FAROL_LABEL[d.farol]}
        </span>
      </header>
      <div className="ctg-dim-titulo">{d.titulo}</div>
      <div className="ctg-dim-valor">{d.valorLabel}</div>
      <div className="ctg-dim-desc">{d.descricao}</div>
      <div className="ctg-dim-sep" />
      <div className="ctg-dim-acao">
        <span className="ctg-dim-acao-label">próx. ação:</span> {d.proximaAcao}
      </div>
    </article>
  );
}

function AnaliseAgente({
  d,
}: {
  d: {
    analiseTitulo: string;
    analiseTexto: string;
    pontosAtencao: string[];
  };
}) {
  return (
    <aside className="ctg-analise">
      <header className="ctg-analise-head">
        <span className="ctg-analise-icon">{I.note({ size: 14 })}</span>
        <span className="ctg-analise-tag">{d.analiseTitulo.toUpperCase()}</span>
      </header>
      <p className="ctg-analise-texto">{d.analiseTexto}</p>
      <h4 className="ctg-analise-subtitulo">Pontos de atenção</h4>
      <ol className="ctg-analise-pontos">
        {d.pontosAtencao.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
    </aside>
  );
}
