// M2.1.9 · Controle Documental · Visão Geral (default da rota)
// Análise IA + 3 cards de Onboarding (3 fases do contrato).

import type { ReactNode } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { I } from "@/components/ds";
import {
  ControleDocumentalEmpty,
  ControleDocumentalShell,
} from "@/components/pages/ControleDocumentalShared";
import { getContract } from "@/lib/mocks/contracts";
import { type DocFase, getObra } from "@/lib/mocks/obras";
import "./geralzao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/controle-documental/")({
  component: ControleDocumentalGeralzaoPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, d: obra.controleDocumental ?? null };
  },
  head: () => ({ meta: [{ title: "Controle Documental — RDM IA" }] }),
});

const TOM_COLOR = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

function ControleDocumentalGeralzaoPage() {
  const { contract, d } = Route.useLoaderData();
  if (!d) return <ControleDocumentalEmpty contractNome={contract.nome} />;

  return (
    <ControleDocumentalShell d={d} contractId={contract.id} active="geralzao">
      <AnaliseAgente titulo={d.analiseTitulo} texto={d.analiseTexto} />
      <FasesOnboarding fases={d.fases} />
    </ControleDocumentalShell>
  );
}

function AnaliseAgente({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <aside className="cdg-analise">
      <header className="cdg-analise-head">
        <span className="cdg-analise-icon">{I.note({ size: 14 })}</span>
        <span className="cdg-analise-tag">{titulo.toUpperCase()}</span>
      </header>
      <p className="cdg-analise-texto">{renderBold(texto)}</p>
    </aside>
  );
}

function renderBold(texto: string): ReactNode {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .map((parte, i) =>
      parte.startsWith("**") && parte.endsWith("**") ? (
        <strong key={i}>{parte.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{parte}</span>
      ),
    );
}

function FasesOnboarding({ fases }: { fases: DocFase[] }) {
  return (
    <section className="cdg-secao">
      <header className="cdg-secao-head">
        <h3 className="cdg-secao-titulo">Onboarding · 3 fases do contrato</h3>
        <p className="cdg-secao-sub">
          documentos esperados em cada fase · barra de progresso por fase
        </p>
      </header>
      <div className="cdg-fases">
        {fases.map((f) => (
          <FaseCard key={f.id} f={f} />
        ))}
      </div>
    </section>
  );
}

function FaseCard({ f }: { f: DocFase }) {
  return (
    <article className="cdg-fase" style={{ borderLeftColor: TOM_COLOR[f.tom] }}>
      <header className="cdg-fase-head">
        <div className="cdg-fase-id">
          <span className="cdg-fase-letra">FASE {f.id}</span>
          <span className="cdg-fase-nome">· {f.nome.toUpperCase()}</span>
        </div>
      </header>
      <div className="cdg-fase-titulo">
        <span className="cdg-fase-titulo-icon">{I.doc({ size: 14 })}</span>
        {f.titulo}
      </div>
      <p className="cdg-fase-descricao">{f.descricao}</p>

      <div className="cdg-fase-progresso-line">
        <span className="cdg-fase-progresso-num">
          {f.completos}
          <span className="cdg-fase-progresso-total">/{f.total}</span>
        </span>
        <span className="cdg-fase-progresso-pct" style={{ color: TOM_COLOR[f.tom] }}>
          {f.progressoPct}%
        </span>
      </div>
      <div className="cdg-fase-progresso-bar">
        <div
          className="cdg-fase-progresso-fill"
          style={{ width: `${f.progressoPct}%`, background: TOM_COLOR[f.tom] }}
        />
      </div>
      <p className="cdg-fase-faltantes">{f.itensFaltantes}</p>
    </article>
  );
}
