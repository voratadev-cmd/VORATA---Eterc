// Condutas REAIS (C.11 · obra_condutas) — fiel ao mockup C11_Condutas. Catálogo de condutas
// dirigidas à Arteris (cartas, esclarecimentos, pedidos formais): cada conduta tem destinatário,
// documento a protocolar, base contratual, motivo/contexto e resultado esperado. Aceita → vira
// tarefa no Plano de Ação (C.12).
//
// DS: prioridade por Badge + dot (sem tarja de borda) · coleção canônica (useColecao: busca +
// ordenação + paginação 8/pág) · KPIs com chip lucide (padrão canônico) · barra de distribuição
// por prioridade · ícones lucide · diag escuro. O status do footer vem do dado (obra_condutas.
// status — Sugerida/Em redação/Aceita; null → "Sugerida", estágio default do catálogo). O botão
// "Enviar ao Plano" fica DESABILITADO (workflow de envio entra depois).

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Send,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  EmptyState,
  ErroCard,
  I,
  Select,
  Skeleton,
  Tag,
} from "@/components/ds";
import {
  ColPag,
  ColToolbar,
  ColVazio,
  normTxt,
  type Ordenacao,
  useColecao,
} from "@/lib/rma/colecao";
import { useCondutas } from "@/lib/hooks/useCondutas";
import type { Conduta } from "@/lib/supabase/condutas";
import "./CondutasRealView.css";

const PRIO_TONE: Record<string, "danger" | "warning" | "info"> = {
  urgente: "danger",
  importante: "warning",
  preventiva: "info",
};
const PRIO_SEV: Record<string, number> = { urgente: 3, importante: 2, preventiva: 1 };

// Estágio operacional do workbook (obra_condutas.status). null → "Sugerida": toda linha da
// C.11 é, por definição, uma conduta SUGERIDA pelo Adm Contratual IA — tom neutro (não afirma
// andamento que o dado não tem). Valores desconhecidos exibem o texto cru em tom neutro.
const STATUS_TONE: Record<string, BadgeTone> = {
  sugerida: "info",
  "em redacao": "warning",
  aceita: "success",
};
function statusInfo(status: string | null): { label: string; tone: BadgeTone } {
  if (!status) return { label: "Sugerida", tone: "neutral" };
  return { label: status, tone: STATUS_TONE[normTxt(status)] ?? "neutral" };
}

// destinatário "Interno → …" vs "Arteris (Contratante)" → tipo p/ KPI e filtro
const destTipo = (d: string | null): "Interno" | "Arteris" | "" =>
  /^interno/i.test(d ?? "") ? "Interno" : /arteris/i.test(d ?? "") ? "Arteris" : "";

export function CondutasRealView({ contractId }: { contractId: string }) {
  const { data, isLoading, isError, error, refetch } = useCondutas(contractId);
  const lista = useMemo(() => data ?? [], [data]);
  const [fPrio, setFPrio] = useState("");
  const [fDest, setFDest] = useState("");

  const kpis = useMemo(
    () => ({
      total: lista.length,
      urgentes: lista.filter((c) => normTxt(c.prioridade ?? "") === "urgente").length,
      arteris: lista.filter((c) => destTipo(c.destinatario) === "Arteris").length,
      internas: lista.filter((c) => destTipo(c.destinatario) === "Interno").length,
      outras: lista.filter((c) => destTipo(c.destinatario) === "").length,
      // Derivado do status (era 0 cravado): "Aceita" = virou tarefa na C.12.
      noPlano: lista.filter((c) => normTxt(c.status ?? "") === "aceita").length,
    }),
    [lista],
  );

  const temDias = useMemo(() => lista.some((c) => c.diasAberto != null), [lista]);
  const ordenacoes = useMemo(() => {
    const ord: Ordenacao<Conduta>[] = [
      { value: "ordem", label: "Ordem sugerida", cmp: (a, b) => a.ordem - b.ordem },
      {
        value: "prio",
        label: "Prioridade (urgente 1º)",
        cmp: (a, b) =>
          (PRIO_SEV[normTxt(b.prioridade ?? "")] ?? 0) -
            (PRIO_SEV[normTxt(a.prioridade ?? "")] ?? 0) || a.ordem - b.ordem,
      },
    ];
    // Só oferece a ordenação quando o workbook popula dias_aberto (senão é controle morto).
    if (temDias) {
      ord.push({
        value: "dias",
        label: "Dias em aberto",
        cmp: (a, b) => (b.diasAberto ?? -1) - (a.diasAberto ?? -1) || a.ordem - b.ordem,
      });
    }
    return ord;
  }, [temDias]);

  const col = useColecao(lista, {
    busca: (c) =>
      [
        c.gatilho,
        c.documento,
        c.clausula,
        c.categoria,
        c.motivo,
        c.destinatario,
        c.responsavel,
        c.resultadoEsperado,
      ]
        .filter(Boolean)
        .join(" "),
    ordenacoes,
    // normTxt dos dois lados: a grafia do workbook varia (o Badge já normaliza) — o filtro
    // não pode esvaziar em silêncio por case/acentos.
    filtro: (c) =>
      (!fPrio || normTxt(c.prioridade ?? "") === normTxt(fPrio)) &&
      (!fDest || destTipo(c.destinatario) === fDest),
    perPage: 8,
    resetKey: `${fPrio}|${fDest}`,
  });

  if (isLoading) {
    // Skeleton com a forma real: header → 4 KPIs → toolbar → 3 cards de conduta.
    return (
      <div className="cnd">
        <Skeleton style={{ height: 64, maxWidth: 620 }} />
        <div className="cnd-kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 84 }} />
          ))}
        </div>
        <Skeleton style={{ height: 38 }} />
        <div className="cnd-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 200 }} />
          ))}
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <ErroCard
        titulo="Não foi possível carregar as condutas"
        mensagem={
          error instanceof Error ? error.message : "Erro ao consultar o banco (obra_condutas)."
        }
        onRetry={() => void refetch()}
      />
    );
  }
  if (lista.length === 0) {
    return (
      <Card>
        <EmptyState
          framed
          icon={I.note({ size: 40 })}
          title="Nenhuma conduta normalizada"
          text="O catálogo de condutas (C.11) ainda não foi normalizado para esta obra."
        />
      </Card>
    );
  }

  return (
    <div className="cnd">
      <header className="cnd-head-page">
        <h2 className="cnd-titulo-page">Condutas e Documentos · C.11</h2>
        <p className="cnd-sub-page">
          Condutas dirigidas ao <strong>contratante (Arteris)</strong> — cartas, esclarecimentos,
          pedidos formais. Cada conduta aponta o <strong>destinatário</strong>, o documento a
          protocolar e a base contratual. Aceita uma conduta → ela vira tarefa no Plano de Ação
          (C.12).
        </p>
      </header>

      <div className="cnd-sec">Panorama das condutas</div>
      <div className="cnd-kpis">
        <CondKpi
          icone={<ClipboardList size={14} strokeWidth={2} />}
          label="Total de condutas"
          valor={kpis.total}
          sub={`${kpis.arteris} à Arteris · ${kpis.internas} interna${kpis.internas === 1 ? "" : "s"}${kpis.outras > 0 ? ` · ${kpis.outras} outra${kpis.outras === 1 ? "" : "s"}` : ""}`}
        />
        <CondKpi
          icone={<TriangleAlert size={14} strokeWidth={2} />}
          label="Urgentes"
          valor={kpis.urgentes}
          sub="ação imediata"
          tone="danger"
        />
        <CondKpi
          icone={<ArrowUpRight size={14} strokeWidth={2} />}
          label="À Arteris (externo)"
          valor={kpis.arteris}
          sub="cartas / protocolos"
          tone="warning"
        />
        <CondKpi
          icone={<CheckCircle2 size={14} strokeWidth={2} />}
          label="No Plano de Ação"
          valor={kpis.noPlano}
          sub="vinculadas à C.12"
          tone="success"
        />
      </div>
      <DistPrioridade lista={lista} />

      <div className="cnd-sec">Catálogo de condutas</div>
      <ColToolbar
        col={col}
        placeholder="Buscar por gatilho, documento ou cláusula…"
        extra={
          <>
            <Select
              value={fPrio}
              onChange={setFPrio}
              size="sm"
              items={[
                { value: "", label: "Todas as prioridades" },
                { value: "Urgente", label: "Urgente" },
                { value: "Importante", label: "Importante" },
                { value: "Preventiva", label: "Preventiva" },
              ]}
            />
            <Select
              value={fDest}
              onChange={setFDest}
              size="sm"
              items={[
                { value: "", label: "Todos os destinatários" },
                { value: "Arteris", label: "À Arteris (externo)" },
                { value: "Interno", label: "Interno (subsídio)" },
              ]}
            />
            <span className="cnd-filtros-cont tabular">
              {col.total} de {col.nItens}
            </span>
          </>
        }
      />

      {col.visible.length === 0 ? (
        col.debounced ? (
          <ColVazio
            termo={col.debounced}
            rotulo="conduta"
            artigo="Nenhuma"
            onClear={() => col.setQuery("")}
          />
        ) : (
          <div className="col-vazia">
            Nenhuma conduta com esse filtro.{" "}
            <button
              type="button"
              className="col-vazia-clear"
              onClick={() => {
                setFPrio("");
                setFDest("");
              }}
            >
              Limpar filtros
            </button>
          </div>
        )
      ) : (
        <div className="cnd-list">
          {col.visible.map((c) => (
            <CondutaCard key={c.ordem} c={c} />
          ))}
        </div>
      )}
      <ColPag col={col} rotulo="condutas" />

      <Diagnostico total={kpis.total} urgentes={kpis.urgentes} arteris={kpis.arteris} />
    </div>
  );
}

// ── KPI (padrão canônico: chip lucide + valor tabular · sem tarja) ──
function CondKpi({
  icone,
  label,
  valor,
  sub,
  tone,
}: {
  icone: ReactNode;
  label: string;
  valor: number;
  sub: string;
  tone?: "danger" | "warning" | "success";
}) {
  const cor =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
        ? "color-mix(in srgb, var(--warning) 82%, var(--text))"
        : tone === "success"
          ? "var(--success)"
          : "var(--text)";
  return (
    <div className="cnd-kpi">
      <div className="cnd-kpi-top">
        <span className={`cnd-kpi-chip${tone ? ` t-${tone}` : ""}`} aria-hidden>
          {icone}
        </span>
        <span className="cnd-kpi-l">{label}</span>
      </div>
      <div className="cnd-kpi-v tabular" style={{ color: cor }}>
        {valor}
      </div>
      <div className="cnd-kpi-s">{sub}</div>
    </div>
  );
}

// ── Distribuição por prioridade (barra empilhada CSS · dado já em memória) ──
function DistPrioridade({ lista }: { lista: Conduta[] }) {
  const cont = { urgente: 0, importante: 0, preventiva: 0, outra: 0 };
  for (const c of lista) {
    const k = normTxt(c.prioridade ?? "");
    if (k === "urgente" || k === "importante" || k === "preventiva") cont[k] += 1;
    else cont.outra += 1;
  }
  const segs = [
    {
      n: cont.urgente,
      cor: "var(--danger)",
      rotulo: `${cont.urgente} urgente${cont.urgente === 1 ? "" : "s"}`,
    },
    {
      n: cont.importante,
      cor: "var(--warning)",
      rotulo: `${cont.importante} importante${cont.importante === 1 ? "" : "s"}`,
    },
    {
      n: cont.preventiva,
      cor: "var(--info)",
      rotulo: `${cont.preventiva} preventiva${cont.preventiva === 1 ? "" : "s"}`,
    },
    { n: cont.outra, cor: "var(--border-strong)", rotulo: `${cont.outra} sem prioridade` },
  ].filter((s) => s.n > 0);
  if (lista.length === 0 || segs.length === 0) return null;
  return (
    <div className="cnd-dist">
      <div
        className="cnd-dist-bar"
        role="img"
        aria-label={`Distribuição por prioridade: ${segs.map((s) => s.rotulo).join(" · ")}`}
      >
        {segs.map((s) => (
          <span
            key={s.rotulo}
            className="cnd-dist-seg"
            title={s.rotulo}
            style={{ width: `${(s.n / lista.length) * 100}%`, background: s.cor }}
          />
        ))}
      </div>
      <div className="cnd-dist-leg tabular">
        {segs.map((s) => (
          <span key={s.rotulo} className="cnd-dist-leg-it">
            <span className="cnd-dist-dot" style={{ background: s.cor }} aria-hidden />
            {s.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Card de conduta ────────────────────────────────────────────────
function CondutaCard({ c }: { c: Conduta }) {
  const prioN = normTxt(c.prioridade ?? "");
  const tone = PRIO_TONE[prioN] ?? "neutral";
  const externo = destTipo(c.destinatario) === "Arteris";
  const status = statusInfo(c.status);
  return (
    <Card className="cnd-card">
      <div className="cnd-card-head">
        <div className="cnd-card-tit-wrap">
          <div className="cnd-card-titulo">
            <span className={`cnd-dot t-${tone}`} aria-hidden />
            {c.gatilho}
          </div>
          <div className="cnd-card-meta">
            {externo ? (
              <ArrowUpRight size={12} strokeWidth={2} />
            ) : (
              <ClipboardList size={12} strokeWidth={2} />
            )}
            destinatário: {c.destinatario ?? "—"} · responsável: {c.responsavel ?? "a definir"}
            {c.categoria ? <Tag>{c.categoria}</Tag> : null}
          </div>
        </div>
        {c.prioridade ? <Badge tone={tone}>{c.prioridade}</Badge> : null}
      </div>

      <div className="cnd-card-body">
        <div className="cnd-field">
          <div className="cnd-field-l">Documento a protocolar</div>
          <div className="cnd-field-v">{c.documento ?? "—"}</div>
        </div>
        <div className="cnd-field">
          <div className="cnd-field-l">Base contratual</div>
          <div className="cnd-field-v">{c.clausula ?? "—"}</div>
        </div>
      </div>

      {c.motivo ? (
        <div className="cnd-motivo">
          <div className="cnd-motivo-tit">
            <Target size={12} strokeWidth={2.2} /> Motivo / contexto
          </div>
          {c.motivo}
        </div>
      ) : null}

      {c.resultadoEsperado ? (
        <div className="cnd-resultado">
          <span className="cnd-resultado-tit">resultado esperado:</span> {c.resultadoEsperado}
        </div>
      ) : null}

      <div className="cnd-card-foot">
        <div className="cnd-prazo">
          prazo: <strong>{c.dataSugerida ?? "a definir"}</strong>
          <Badge tone={status.tone}>{status.label}</Badge>
          {c.diasAberto != null ? (
            <span className="cnd-dias tabular">
              aberta há {c.diasAberto} dia{c.diasAberto === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="cnd-foot-acao">
          <span className="cnd-hint">workflow de envio em breve</span>
          <Button variant="ink" size="sm" disabled>
            <Send size={13} strokeWidth={2} /> Enviar ao Plano de Ação
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Diagnóstico (card escuro · derivado dos dados) ─────────────────
function Diagnostico({
  total,
  urgentes,
  arteris,
}: {
  total: number;
  urgentes: number;
  arteris: number;
}) {
  return (
    <aside className="cnd-diag">
      <div className="cnd-diag-head">
        <Sparkles size={15} strokeWidth={2} /> Leitura das condutas
      </div>
      <p className="cnd-diag-texto">
        São <strong>{total} condutas</strong> da <strong>fase inicial da obra</strong>,{" "}
        <strong>{urgentes} urgentes</strong>, sendo <strong>{arteris} dirigidas à Arteris</strong>{" "}
        (cartas e protocolos). A lógica é encadeada:{" "}
        <strong>
          analisar o projeto → esclarecer dúvidas → fechar a lista mestra → checar áreas por
          topografia → comunicar o panorama → tratar o atraso da OS
        </strong>
        . Cada conduta produz um documento formal que protege a posição da ATERPA. Distinção
        importante: aqui ficam as ações <strong>para o contratante</strong>; as melhorias internas
        (RDO, registro) estão em Melhorias Documentais (C.15). Aceite uma conduta para ela virar
        tarefa no Plano de Ação (C.12).
      </p>
    </aside>
  );
}
