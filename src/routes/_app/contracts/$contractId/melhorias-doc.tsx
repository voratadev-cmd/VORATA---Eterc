// C.15 — Melhorias Documentais. Tela INTERNA da Contratada (ATERPA) — "arrumar a própria casa".
// Duas frentes: ① corrigir os documentos existentes (RDOs, atas, relatórios) e ② registrar daqui
// pra frente. (Ações voltadas ao Contratante ficam no Plano de Ação, C.12.) 100% do dado REAL
// normalizado (obra_secoes · narrativa estruturada + tabela de desvios) via useMelhoriasDoc.
// Tokens-only; ícones lucide (sem emoji); farol canônico via Badge (Atenção→Risco).

import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  Equal,
  FileText,
  Gauge,
  Plus,
  Scale,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge, Card, EmptyState, I, Skeleton } from "@/components/ds";
import type { BadgeProps } from "@/components/ds";
import { type MelhoriasDesvio, type MelhoriasDocView } from "@/lib/supabase/melhoriasDoc";
import { type MelhoriasDocResult, useMelhoriasDoc } from "@/lib/hooks/useMelhoriasDoc";
import { useMelhoriasSbso } from "@/lib/hooks/useMelhoriasSbso";
import { MelhoriasSbsoView } from "@/components/pages/MelhoriasSbsoView";
import "./melhorias-doc.css";

export const Route = createFileRoute("/_app/contracts/$contractId/melhorias-doc")({
  component: MelhoriasRoute,
  head: () => ({ meta: [{ title: "Melhorias Documentais — RDM IA" }] }),
});

// ── Farol → Badge (vocab canônico) ───────────────────────────────────────────
const FAROL_TONE: Record<string, BadgeProps["tone"]> = {
  critico: "danger",
  risco: "warning",
  observacao: "info",
  conforme: "success",
};
const FAROL_LABEL: Record<string, string> = {
  critico: "Crítico",
  risco: "Risco",
  observacao: "Observação",
  conforme: "Conforme",
};
function FarolBadge({ farol }: { farol: string | null }) {
  if (!farol) return null;
  return <Badge tone={FAROL_TONE[farol] ?? "info"}>{FAROL_LABEL[farol] ?? farol}</Badge>;
}

function MelhoriasRoute() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError } = useMelhoriasDoc(contractId);
  // dialeto SBSO (painel + desvios + defasagem + achados): view própria; BR-101 segue narrativa.
  const sbso = useMelhoriasSbso(contractId);
  if (sbso.data) return <MelhoriasSbsoView d={sbso.data} />;

  if (isLoading) {
    return (
      <div className="md-page">
        <Skeleton style={{ height: 28, width: 360, marginBottom: 12 }} />
        <Skeleton style={{ height: 72, marginBottom: 16 }} />
        <Skeleton style={{ height: 280 }} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="md-page">
        <EmptyState
          icon={I.doc({ size: 40 })}
          title="Melhorias documentais ainda não disponíveis"
          text="A análise dos documentos da obra (C.15) ainda não foi normalizada para este contrato. Assim que o Adm Contratual IA processar os RDOs, atas e relatórios, os achados e recomendações aparecem aqui."
          framed
        />
      </div>
    );
  }
  return <MelhoriasView d={data} />;
}

// ── Marcadores de lista (lucide · cor por tom) ───────────────────────────────
type Mk = "x" | "v" | "w" | "a" | "up" | "eq" | "plus";
const MARK: Record<Mk, { Icon: typeof Check; cls: string }> = {
  x: { Icon: X, cls: "md-mk-danger" },
  v: { Icon: Check, cls: "md-mk-success" },
  w: { Icon: AlertTriangle, cls: "md-mk-warning" },
  a: { Icon: ChevronRight, cls: "md-mk-info" },
  up: { Icon: TrendingUp, cls: "md-mk-info" },
  eq: { Icon: Equal, cls: "md-mk-neutral" },
  plus: { Icon: Plus, cls: "md-mk-success" },
};
function MkList({ items, mk }: { items: string[]; mk: Mk }) {
  const { Icon, cls } = MARK[mk];
  return (
    <ul className="md-list">
      {items.map((t, i) => (
        <li key={i} className="md-li">
          <Icon size={13} className={`md-mk ${cls}`} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// coluna com cabeçalho colorido + lista
function ColList({
  label,
  tone,
  items,
  mk,
}: {
  label: string;
  tone: "danger" | "success" | "warning" | "info" | "neutral";
  items: string[];
  mk: Mk;
}) {
  const { Icon } = MARK[mk];
  return (
    <div className="md-col">
      <div className={`md-colhd md-colhd-${tone}`}>
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <MkList items={items} mk={mk} />
    </div>
  );
}

function Panel({
  icon,
  title,
  badge,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="md-pan">
      <div className="md-panhd">
        <div className="md-pt">
          {icon && <span className="md-pt-ic">{icon}</span>}
          {title}
        </div>
        {badge}
      </div>
      {children}
    </Card>
  );
}

function SecBand({
  mark,
  title,
  danger,
}: {
  mark: React.ReactNode;
  title: string;
  danger?: boolean;
}) {
  return (
    <div className="md-secband">
      <span className={`md-secn${danger ? " md-secn-danger" : ""}`}>{mark}</span>
      <span className="md-sect">{title}</span>
    </div>
  );
}

function MelhoriasView({ d }: { d: MelhoriasDocResult }) {
  return (
    <div className="md-page">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <header className="md-head">
        <div>
          <h1 className="md-title">Melhorias Documentais</h1>
          <p className="md-sub">{d.subtitle}</p>
        </div>
        <FarolBadge farol={d.pageFarol} />
      </header>

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className="md-kpis">
        <Kpc icon={<FileText size={17} />} k={d.kpis[0]} />
        <Kpc icon={<ClipboardList size={17} />} k={d.kpis[1]} />
        <Kpc icon={<BarChart3 size={17} />} k={d.kpis[2]} />
        <Kpc icon={<Gauge size={17} />} k={d.kpis[3]} />
      </div>

      {/* ── ① Corrigir o existente ──────────────────────────────────── */}
      <SecBand mark="1" title="Corrigir o existente" />

      <Panel
        icon={<FileText size={15} />}
        title={d.rdo.titulo}
        badge={<FarolBadge farol={d.rdo.farol} />}
      >
        <div className="md-grid2">
          <ColList label="Achados" tone="danger" items={d.rdo.achados} mk="x" />
          <ColList label="Melhorias recomendadas" tone="success" items={d.rdo.melhorias} mk="v" />
        </div>
        {d.rdo.exemplo && (
          <div className="md-ex">
            <div className="md-exbox md-exbox-bad">
              <span className="md-extag">Exemplo · como está</span>
              {d.rdo.exemplo.comoEsta}
            </div>
            <div className="md-exbox md-exbox-good">
              <span className="md-extag">Como deveria ser</span>
              {d.rdo.exemplo.comoDeveria}
            </div>
          </div>
        )}
      </Panel>

      <Panel icon={<Scale size={15} />} title={d.aderencia.titulo}>
        <div className="md-grid3">
          <ColList
            label="Previstas sem registro"
            tone="warning"
            items={d.aderencia.semRegistro}
            mk="w"
          />
          <ColList label="No prazo" tone="success" items={d.aderencia.noPrazo} mk="v" />
          <ColList label="Iniciando" tone="info" items={d.aderencia.iniciando} mk="a" />
        </div>
      </Panel>

      <Panel
        icon={<BarChart3 size={15} />}
        title={d.histogramas.titulo}
        badge={
          d.histogramas.gapsCriticos != null && d.histogramas.gapsCriticos > 0 ? (
            <Badge tone="danger">{d.histogramas.gapsCriticos} gaps críticos</Badge>
          ) : undefined
        }
      >
        <div className="md-grid3">
          <ColList
            label="Previsto e não mobilizado"
            tone="warning"
            items={d.histogramas.naoMobilizado}
            mk="w"
          />
          <ColList
            label="Mobilizado sem previsão"
            tone="info"
            items={d.histogramas.semPrevisao}
            mk="up"
          />
          <ColList
            label="Impossível verificar"
            tone="neutral"
            items={d.histogramas.impossivel}
            mk="eq"
          />
        </div>
      </Panel>

      <Panel
        icon={<ClipboardList size={15} />}
        title={d.atas.titulo}
        badge={<FarolBadge farol={d.atas.farol} />}
      >
        <div className="md-grid2">
          <ColList label="Achados" tone="danger" items={d.atas.achados} mk="x" />
          <ColList label="Melhorias recomendadas" tone="success" items={d.atas.melhorias} mk="v" />
        </div>
      </Panel>

      <Panel icon={<FileText size={15} />} title={d.relatorios.titulo}>
        <MkList items={d.relatorios.notas} mk="a" />
      </Panel>

      {/* ── ② Registrar daqui pra frente ────────────────────────────── */}
      <SecBand mark="2" title="Registrar daqui pra frente" />

      <div className="md-grid2">
        <Panel icon={<FileText size={15} />} title="Próximos RDOs — registros sugeridos">
          <MkList items={d.proximosRDO} mk="a" />
        </Panel>
        <Panel icon={<ClipboardList size={15} />} title="Próxima ATA (ROS 15/06)">
          <MkList items={d.proximaAta} mk="a" />
        </Panel>
      </div>
      <div className="md-grid2">
        <Panel icon={<ChevronRight size={15} />} title="Horizonte 30–60 dias">
          <MkList items={d.horizonte} mk="a" />
        </Panel>
        <Panel icon={<Plus size={15} />} title={d.novoDoc.titulo}>
          <div className="md-list">
            <div className="md-li">
              <Plus size={13} className="md-mk md-mk-success" />
              <span>{d.novoDoc.nota}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Síntese IA (card escuro · div p/ não herdar o fundo branco do .card) ── */}
      <div className="md-ia">
        <div className="md-ia-h">
          <span className="md-ia-badge">
            <Sparkles size={12} /> IA
          </span>
          <span className="md-pt">Síntese</span>
        </div>
        <p>{d.sintese}</p>
      </div>

      {/* ── Desvios do previsto ─────────────────────────────────────── */}
      <SecBand mark={<AlertTriangle size={15} />} title={d.desviosHeader.titulo} danger />
      <Card className="md-pan md-cff">
        <p className="md-cff-line">{d.desviosHeader.cff}</p>
        <p className="md-cff-nota">{d.desviosHeader.nota}</p>
      </Card>
      <div className="md-desvios">
        {d.desvios.map((dv, i) => (
          <DesvioCard key={i} d={dv} />
        ))}
      </div>
      <p className="md-ressalva">{d.ressalva}</p>
    </div>
  );
}

// ── KPI card (padrão canônico: chip de ícone, sem tarja) ─────────────────────
function Kpc({
  icon,
  k,
}: {
  icon: React.ReactNode;
  k: MelhoriasDocView["kpis"][number] | undefined;
}) {
  if (!k) return null;
  return (
    <div className="md-kpc">
      <div className="md-kpc-hd">
        <span className="md-kpc-chip">{icon}</span>
        <span className="md-kpc-l">{k.label}</span>
      </div>
      <div className="md-kpc-v">{k.farol ? <FarolBadge farol={k.farol} /> : k.valor}</div>
      <div className="md-kpc-s">{k.sub}</div>
    </div>
  );
}

// ── Card de desvio (Badge no header, SEM tarja de borda) ─────────────────────
function DesvioCard({ d }: { d: MelhoriasDesvio }) {
  const tone: BadgeProps["tone"] = d.sev === "Crítico" ? "danger" : "warning";
  return (
    <Card className="md-dv">
      <div className="md-dvhd">
        <Badge tone={tone}>{d.sev}</Badge>
        <span className="md-dvt">{d.item}</span>
        <span className="md-dvfonte">{d.fonte}</span>
      </div>
      <div className="md-dvgrid">
        <div>
          <span className="md-k">Previsto:</span> {d.previsto}
        </div>
        <div>
          <span className="md-k">Real / medido:</span> {d.real}
        </div>
        <div className="md-wide">
          <span className="md-k">Justificativa?</span> {d.justif}
        </div>
        <div className="md-wide">
          <span className="md-k">Ação a tratar:</span> {d.acao}
        </div>
      </div>
    </Card>
  );
}
