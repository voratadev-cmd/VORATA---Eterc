// M2.1.9 · Controle Documental · aba Áreas Responsáveis
// 8 cards em grid 4×2: cada área com responsável + contagem + CTA.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { I, type IconName } from "@/components/ds";
import {
  ControleDocumentalEmpty,
  ControleDocumentalShell,
} from "@/components/pages/ControleDocumentalShared";
import { getContract } from "@/lib/mocks/contracts";
import { type DocAreaResponsavel, getObra } from "@/lib/mocks/obras";
import "./areas.css";

export const Route = createFileRoute("/_app/contracts/$contractId/controle-documental/areas")({
  component: ControleDocumentalAreasPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, d: obra.controleDocumental ?? null };
  },
  head: () => ({ meta: [{ title: "Controle Documental · Áreas — RDM IA" }] }),
});

const TOM_COLOR = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  neutral: "var(--text-3)",
} as const;

function ControleDocumentalAreasPage() {
  const { contract, d } = Route.useLoaderData();
  if (!d) return <ControleDocumentalEmpty contractNome={contract.nome} />;

  return (
    <ControleDocumentalShell d={d} contractId={contract.id} active="areas">
      <section className="cda-secao">
        <header className="cda-secao-head">
          <h3 className="cda-secao-titulo">Áreas Responsáveis na ETERC</h3>
          <p className="cda-secao-sub">
            quem arquiva e mantém cada tipo de documento · qual agente da IA confere automaticamente
          </p>
        </header>
        <div className="cda-grid">
          {d.areas.map((a) => (
            <AreaCard key={a.id} a={a} />
          ))}
        </div>
      </section>
    </ControleDocumentalShell>
  );
}

function AreaCard({ a }: { a: DocAreaResponsavel }) {
  const IconFn = I[a.iconKey as IconName] ?? I.doc;
  return (
    <article className="cda-area" style={{ borderLeftColor: TOM_COLOR[a.tom] }}>
      <header className="cda-area-head">
        <span className="cda-area-icon" style={{ color: TOM_COLOR[a.tom] }}>
          {IconFn({ size: 16 })}
        </span>
        <div className="cda-area-titulo-wrap">
          <div className="cda-area-titulo">{a.nome}</div>
          <div className="cda-area-resp">{a.responsavel}</div>
        </div>
      </header>
      <div className="cda-area-counts">
        <CountBox valor={a.completos} label="COMPLETOS" tom="success" />
        <CountBox valor={a.parciais} label="PARCIAIS" tom="warning" />
        <CountBox valor={a.pendentes} label="PENDENTES" tom="danger" />
      </div>
      <button type="button" className="cda-area-cta">
        <span className="cda-area-cta-icon">{I.check({ size: 11 })}</span>
        {a.ctaLabel}
      </button>
    </article>
  );
}

function CountBox({
  valor,
  label,
  tom,
}: {
  valor: number;
  label: string;
  tom: "success" | "warning" | "danger";
}) {
  return (
    <div className="cda-count">
      <div className={`cda-count-valor cda-count-valor-${tom}`}>{valor}</div>
      <div className="cda-count-label">{label}</div>
    </div>
  );
}
