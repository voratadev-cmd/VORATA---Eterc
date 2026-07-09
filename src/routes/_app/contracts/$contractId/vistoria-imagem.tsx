// M2.1.8 · Vistoria por Imagem
// Estimativa de avanço físico por visão computacional · 8 frentes ativas.
// Aceita vídeos de celular, voos de drone e fotos avulsas.

import type { ReactNode } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FarolCard, I } from "@/components/ds";
import { getContract } from "@/lib/mocks/contracts";
import {
  type VistoriaFrente,
  type VistoriaImagemData,
  type VistoriaSemanaComp,
  type VistoriaSensor,
  type VistoriaStatus,
  getObra,
} from "@/lib/mocks/obras";
import "./vistoria-imagem.css";

export const Route = createFileRoute("/_app/contracts/$contractId/vistoria-imagem")({
  component: VistoriaImagemPage,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra) throw notFound();
    return { contract, vi: obra.vistoriaImagem ?? null };
  },
  head: () => ({ meta: [{ title: "Vistoria por Imagem — RDM IA" }] }),
});

const STATUS_LABEL: Record<VistoriaStatus, string> = {
  "em-dia": "EM DIA",
  adiantada: "ADIANTADA",
  atencao: "ATENÇÃO",
  critica: "CRÍTICA",
};

const STATUS_COLOR: Record<VistoriaStatus, string> = {
  "em-dia": "var(--success)",
  adiantada: "var(--info)",
  atencao: "var(--warning)",
  critica: "var(--danger)",
};

function VistoriaImagemPage() {
  const { contract, vi } = Route.useLoaderData();

  if (!vi) {
    return (
      <main className="vi-main">
        <header className="vi-head">
          <div className="vi-head-titulo">
            <h2 className="vi-titulo">Vistoria por Imagem</h2>
            <p className="vi-sub">
              Estimativa de avanço físico por visão computacional · {contract.nome}
            </p>
          </div>
        </header>
        <div className="vi-empty">
          {I.tag({ size: 36 })}
          <p>Vistoria por Imagem não configurada para {contract.nome}.</p>
          <p className="vi-empty-sub">
            Conecte vídeos de celular ou voos de drone para que o agente comece a estimar o avanço
            físico das frentes por visão computacional.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="vi-main">
      <HeaderPrincipal d={vi} />
      <HeroEnvio />
      <KpisStrip d={vi} />
      <AnaliseCallout texto={vi.analiseTexto} />
      <Galeria frentes={vi.frentes} />
      <ComparativoTemporal d={vi} />
    </main>
  );
}

function HeaderPrincipal({ d }: { d: VistoriaImagemData }) {
  return (
    <header className="vi-head">
      <div className="vi-head-titulo">
        <h2 className="vi-titulo">Vistoria por Imagem · {d.contratoNome}</h2>
        <p className="vi-sub">
          Estimativa de avanço físico por visão computacional · {d.frentesAtivas} frentes ativas ·
          última atualização {d.ultimaAtualizacao}
        </p>
      </div>
      <div className="vi-head-actions">
        <button type="button" className="vi-btn-sec">
          Histórico de vistorias
        </button>
        <button type="button" className="vi-btn-sec">
          Configurar drone
        </button>
        <button type="button" className="vi-btn-ink">
          Nova vistoria
        </button>
      </div>
    </header>
  );
}

function HeroEnvio() {
  return (
    <section className="vi-hero">
      <div className="vi-hero-info">
        <span className="vi-hero-icon">{I.tag({ size: 22 })}</span>
        <div>
          <div className="vi-hero-titulo">Envie um vídeo rápido da frente</div>
          <div className="vi-hero-sub">
            Pelo celular: 30s a 2min andando pela frente · Drone: voo programado semanal · Análise
            IA em ~2 min
          </div>
        </div>
      </div>
      <div className="vi-hero-actions">
        <button type="button" className="vi-hero-btn">
          <span className="vi-hero-btn-icon">{I.tag({ size: 12 })}</span>
          Vídeo do celular
        </button>
        <button type="button" className="vi-hero-btn">
          <span className="vi-hero-btn-icon">{I.plane({ size: 12 })}</span>
          Subir voo de drone
        </button>
        <button type="button" className="vi-hero-btn">
          <span className="vi-hero-btn-icon">{I.eye({ size: 12 })}</span>
          Fotos avulsas
        </button>
      </div>
    </section>
  );
}

function KpisStrip({ d }: { d: VistoriaImagemData }) {
  return (
    <div className="vi-kpis">
      <FarolCard
        label="VISTORIAS NO MÊS"
        icon="calendar"
        value={d.vistoriasMesLabel}
        info={d.vistoriasMesNota}
        accent="neutral"
      />
      <FarolCard
        label="AVANÇO FÍSICO MÉDIO"
        icon="trending"
        value={d.avancoFisicoLabel}
        info={d.avancoFisicoNota}
        accent="success"
      />
      <FarolCard
        label="FRENTES DETECTADAS"
        icon="eye"
        value={d.frentesDetectadasLabel}
        info={d.frentesDetectadasNota}
        accent="neutral"
      />
      <article className="vi-kpi-cta">
        <div className="vi-kpi-label">PRÓXIMA VISTORIA</div>
        <div className="vi-kpi-valor">{d.proximaVistoriaTipo}</div>
        <button type="button" className="vi-kpi-btn">
          {I.calendar({ size: 12 })} {d.proximaVistoriaCtaLabel}
        </button>
      </article>
    </div>
  );
}

function AnaliseCallout({ texto }: { texto: string }) {
  return (
    <aside className="vi-analise">
      <div className="vi-analise-head">
        <span className="vi-analise-icon">{I.note({ size: 12 })}</span>
        ANÁLISE DO AGENTE VISTORIA POR IMAGEM
      </div>
      <p className="vi-analise-texto">{renderBold(texto)}</p>
    </aside>
  );
}

/** Renderiza texto destacando trechos entre `**` em negrito. */
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

function Galeria({ frentes }: { frentes: VistoriaFrente[] }) {
  return (
    <section className="vi-secao">
      <header className="vi-secao-head">
        <h3 className="vi-secao-titulo">Galeria de Frentes Ativas</h3>
        <p className="vi-secao-sub">
          vídeo mais recente de cada frente · análise IA por cima da mídia
        </p>
      </header>
      <div className="vi-galeria">
        {frentes.map((f) => (
          <FrenteCard key={f.id} f={f} />
        ))}
      </div>
    </section>
  );
}

function SensorBadge({ sensor }: { sensor: VistoriaSensor }) {
  if (sensor === "drone") {
    return <>{I.plane({ size: 11 })} Drone</>;
  }
  if (sensor === "foto") {
    return <>{I.eye({ size: 11 })} Foto</>;
  }
  return <>{I.tag({ size: 11 })} Celular</>;
}

function FrenteCard({ f }: { f: VistoriaFrente }) {
  return (
    <article className={`vi-frente vi-frente-${f.status}`}>
      <div className={`vi-frente-video vi-frente-video-${f.tom}`}>
        <div className="vi-frente-video-head">
          <span className="vi-frente-sensor">
            <SensorBadge sensor={f.sensor} />
          </span>
          <span className="vi-frente-data">{f.dataHora}</span>
        </div>
        <span className="vi-frente-play" aria-hidden>
          ▶
        </span>
      </div>
      <div className="vi-frente-corpo">
        <div className="vi-frente-titulo">{f.titulo}</div>
        <div className="vi-frente-meta">{f.meta}</div>
        <div className="vi-frente-rodape">
          <div className="vi-frente-ia">
            <div className="vi-frente-ia-label">IA: AVANÇO ESTIMADO</div>
            <div className="vi-frente-ia-valor">
              {f.avancoIaLabel} / {f.avancoPrevistoLabel}
            </div>
          </div>
          <div className="vi-frente-status-wrap">
            <div className="vi-frente-status-label">STATUS</div>
            <div className="vi-frente-status" style={{ color: STATUS_COLOR[f.status] }}>
              {STATUS_LABEL[f.status]}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ComparativoTemporal({ d }: { d: VistoriaImagemData }) {
  return (
    <section className="vi-secao">
      <header className="vi-secao-head">
        <h3 className="vi-secao-titulo">{d.comparativoTitulo}</h3>
        <p className="vi-secao-sub">{d.comparativoSubtitulo}</p>
      </header>
      <div className="vi-comp">
        {d.comparativoSemanas.map((s) => (
          <SemanaCard key={s.id} s={s} />
        ))}
      </div>
      <aside className="vi-alerta">
        <span className="vi-alerta-icon">⚠</span>
        <p className="vi-alerta-texto">{renderBold(d.alertaComparativoTexto)}</p>
      </aside>
    </section>
  );
}

function SemanaCard({ s }: { s: VistoriaSemanaComp }) {
  return (
    <article className={`vi-semana vi-semana-${s.tom}`}>
      <div className="vi-semana-label">{s.label}</div>
      <div className="vi-semana-visual">{s.descricaoVisual}</div>
      <div className="vi-semana-resumo">{s.resumoLabel}</div>
      <div className="vi-semana-obs">{s.observacao}</div>
    </article>
  );
}
