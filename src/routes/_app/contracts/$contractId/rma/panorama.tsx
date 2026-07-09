// Aba "Panorama do Contrato" (RMA · C.10). Visão multidimensional do mês: snapshot de KPIs do
// obra_panorama + 6 dimensões de farol + matriz de nexo causal. Fiel ao mockup C10_Panorama.
// Lê o read-model getPanorama, que junta obra_panorama (faróis tipados + métricas) + obra_secoes
// C.10 (KPIs/análise/cláusulas por dimensão + matriz).
//
// HONESTIDADE: farol null = dimensão NÃO avaliada → "Sem dado" cinza, nunca verde sobre área cega;
// métrica null no snapshot → "—" com sub "sem dado" (pendente ≠ zero).
// DS: "Atenção" da fonte vira "Risco" (régua do farol não tem Atenção); ícones lucide (sem emoji de
// UI); cards SEM tarja de borda — farol por Badge + dot + tinta leve. Matriz 5+ desvios ganha
// busca/filtro/ordenação/paginação via useColecao (padrão canônico de coleção).

import { useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CloudRain,
  DollarSign,
  Link2,
  Mountain,
  Package,
  Ruler,
  ScrollText,
  Sparkles,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Card,
  EmptyState,
  ErroCard,
  FarolCard,
  FilterChip,
  I,
  Skeleton,
} from "@/components/ds";
import { listaCap, listaPt } from "@/components/InsumosFd/InsumosFdShared";
import { farolLabel, farolToBadge, type FarolLevel } from "@/lib/mocks/contracts";
import { usePanorama } from "@/lib/hooks/usePanorama";
import { ColPag, ColToolbar, ColVazio, useColecao } from "@/lib/rma/colecao";
import type { Panorama, PanoramaDim, PanoramaNexo } from "@/lib/supabase/panorama";
import "./panorama.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/panorama")({
  component: PanoramaAba,
});

const DIM_ICON: Record<string, LucideIcon> = {
  liberacoes: Mountain,
  projetos: Ruler,
  precos: DollarSign,
  interferencias: TriangleAlert,
  suprimentos: Package,
  clima: CloudRain,
};
// nível null = "Sem dado" (cinza neutro) — não é um nível do farol, é ausência de avaliação.
const nivelLabel = (n: FarolLevel | null) => (n ? farolLabel[n] : "Sem dado");
const nivelTone = (n: FarolLevel | null) => (n ? farolToBadge[n] : "neutral");
const nivelClasse = (n: FarolLevel | null) => n ?? "semdado";

// ── formatadores locais (snapshot) ─────────────────────────────────
const fmtInt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
// R$ compacto pro valor grande do KpiCard (o valor cheio não cabe sem quebrar a hierarquia).
const fmtRsCompacto = (v: number) =>
  Math.abs(v) >= 1e6
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
    : Math.abs(v) >= 1e3
      ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`
      : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// pct_areas_liberadas vem como fração 0..1 no workbook v11 (1 = 100%); tolera fonte já em %.
const fmtPct = (v: number) =>
  `${(v <= 1 ? v * 100 : v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function scrollDim(chave: string) {
  const el = document.getElementById(`pan-dim-${chave}`);
  if (!el) return;
  const semMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: semMotion ? "auto" : "smooth", block: "center" });
  // feedback de chegada: tinta brand transitória no card alvo (fecha o loop farol → detalhe).
  el.classList.add("pan-dim-alvo");
  window.setTimeout(() => el.classList.remove("pan-dim-alvo"), 1400);
}

function PanoramaAba() {
  const { contractId } = Route.useParams();
  const { data, isLoading, isError, error, refetch } = usePanorama(contractId);

  // ERRO ≠ PENDÊNCIA: falha de leitura mostra ErroCard com retry, nunca vira "aguardando" silencioso.
  if (isError) {
    return (
      <main className="pan-main">
        <ErroCard
          titulo="Não foi possível carregar o panorama"
          mensagem={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </main>
    );
  }
  if (isLoading) {
    // Skeleton com a forma REAL da página: header → snapshot (4) → farol row (7) → cards de
    // dimensão em 2 colunas → matriz — evita o "pulo" de layout na hidratação.
    return (
      <main className="pan-main">
        <Skeleton style={{ height: 64 }} />
        <div className="pan-kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 96 }} />
          ))}
        </div>
        <div className="pan-farolrow">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 92 }} />
          ))}
        </div>
        <div className="pan-dimlist">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 170 }} />
          ))}
        </div>
        <Skeleton style={{ height: 200 }} />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="pan-main">
        <Card>
          <EmptyState
            framed
            icon={I.flag({ size: 42 })}
            title="Panorama ainda não normalizado"
            text="A visão consolidada por dimensões aparece aqui quando a seção C.10 for normalizada (Camada A)."
            hint={<Badge tone="info">Aguardando normalização</Badge>}
          />
        </Card>
      </main>
    );
  }

  const nDesvios = data.nexo.length;
  return (
    <main className="pan-main">
      <header className="pan-head">
        <h2 className="pan-titulo">Panorama do Contrato · C.10</h2>
        <p className="pan-sub">
          Visão multidimensional do mês · <strong>6 dimensões + nexo causal</strong>. O farol
          consolidado é a <strong>pior</strong> das seis. Dimensões sem dado aparecem em cinza — não
          em verde, para não dar falso conforto.
        </p>
      </header>

      <SnapshotKpis data={data} />

      <div className="pan-sec pan-sec-flex">
        <span>Farol multidimensional consolidado</span>
        <FarolResumo dims={data.dimensoes} />
      </div>
      <FarolRow dims={data.dimensoes} consolidado={data.consolidado} nAvaliados={data.nAvaliados} />

      <div className="pan-sec">Detalhe por dimensão</div>
      <div className="pan-dimlist">
        {data.dimensoes.map((d) => (
          <DimensaoCard key={d.chave} dim={d} />
        ))}
      </div>

      <div className="pan-sec">
        Matriz de Nexo Causal · {nDesvios} {nDesvios === 1 ? "desvio" : "desvios"}
      </div>
      <p className="pan-note">
        Uma linha por desvio relevante (farol amarelo/vermelho):{" "}
        <strong>fato → documento que comprova → responsável → hipótese de desequilíbrio</strong>. A
        cláusula e o impacto (R$/dias) são quantificados no Módulo 3.
      </p>
      <NexoTable nexo={data.nexo} />

      <Diagnostico
        consolidado={data.consolidado}
        dims={data.dimensoes}
        nAvaliados={data.nAvaliados}
        temNexo={data.nexo.length > 0}
      />
    </main>
  );
}

// ── Snapshot de KPIs do obra_panorama (métricas que a query já paga) ─
// Cobertura + contexto do mês. Métrica null → "—" com "sem dado" (pendente ≠ zero); nenhuma
// recebe farol — são informativas, sem régua de desvio configurada (Regra do Farol §6).
function SnapshotKpis({ data }: { data: Panorama }) {
  const semDado = data.dimensoes.filter((d) => d.nivel == null).map((d) => d.label);
  return (
    <div className="pan-kpis">
      <FarolCard
        label="DIMENSÕES AVALIADAS"
        icon="flag"
        value={`${data.nAvaliados}/6`}
        info={
          semDado.length > 0
            ? `sem dado: ${listaCap(semDado, 2)}`
            : "cobertura completa das 6 dimensões"
        }
        accent="neutral"
      />
      <FarolCard
        label="ÁREAS LIBERADAS"
        icon="map"
        value={data.pctAreasLiberadas != null ? fmtPct(data.pctAreasLiberadas) : "—"}
        info={
          data.pctAreasLiberadas != null
            ? "% das áreas de trabalho liberadas"
            : "sem dado no C.10 normalizado"
        }
        accent="neutral"
      />
      <FarolCard
        label="DIAS PARADOS (ACUM.)"
        icon="clock"
        value={
          data.diasParadosAcum != null
            ? `${fmtInt(data.diasParadosAcum)} ${data.diasParadosAcum === 1 ? "dia" : "dias"}`
            : "—"
        }
        info={
          data.diasParadosAcum != null
            ? "acumulado por clima / força maior"
            : "sem dado no C.10 normalizado"
        }
        accent="neutral"
      />
      <FarolCard
        label="FRENTES IMPEDIDAS (HOJE)"
        icon="wallet"
        value={data.frentesImpedidasRs != null ? fmtRsCompacto(data.frentesImpedidasRs) : "—"}
        info={
          data.frentesImpedidasRs != null
            ? "R$ parados em frentes impedidas"
            : "sem dado no C.10 normalizado"
        }
        accent="neutral"
      />
    </div>
  );
}

// ── Resumo da distribuição do farol (dot + contagem, sem tarja) ────
// "Quantas conforme, quantas em risco, quantas cegas" de relance — deriva do que já está na tela.
const RESUMO_ORDEM: Array<FarolLevel | null> = ["critico", "risco", "observacao", "conforme", null];
function FarolResumo({ dims }: { dims: PanoramaDim[] }) {
  const grupos = RESUMO_ORDEM.map((nivel) => ({
    nivel,
    n: dims.filter((d) => d.nivel === nivel).length,
  })).filter((g) => g.n > 0);
  if (grupos.length <= 1) return null; // tudo num nível só → o row já comunica
  return (
    <span className="pan-sec-resumo">
      {grupos.map((g, i) => (
        <span
          key={g.nivel ?? "semdado"}
          className={`pan-resumo-item pan-f-${nivelClasse(g.nivel)}`}
        >
          {i > 0 ? <span className="pan-resumo-sep">·</span> : null}
          <span className="pan-dot" aria-hidden />
          {g.n} {nivelLabel(g.nivel)}
        </span>
      ))}
    </span>
  );
}

// ── Farol consolidado (6 dimensões + consolidado) ──────────────────
function FarolRow({
  dims,
  consolidado,
  nAvaliados,
}: {
  dims: PanoramaDim[];
  consolidado: FarolLevel | null;
  nAvaliados: number;
}) {
  return (
    <div className="pan-farolrow">
      {dims.map((d) => {
        const Icon = DIM_ICON[d.chave] ?? Target;
        return (
          <button
            key={d.chave}
            type="button"
            className={`pan-fcell pan-f-${nivelClasse(d.nivel)}`}
            onClick={() => scrollDim(d.chave)}
          >
            <Icon size={20} className="pan-fcell-ic" strokeWidth={1.75} />
            <span className="pan-fcell-nm">{d.label}</span>
            <span className="pan-fcell-fl">
              <span className="pan-dot" /> {nivelLabel(d.nivel)}
            </span>
          </button>
        );
      })}
      <div className={`pan-fcell pan-fcell-consol pan-f-${nivelClasse(consolidado)}`}>
        <Target size={20} strokeWidth={1.75} />
        <span className="pan-fcell-nm">CONSOLIDADO</span>
        <span className="pan-fcell-big">{nivelLabel(consolidado)}</span>
        {/* TODO(refino): exibir "· BM nn" quando o read-model expor o período — obra_panorama não
            tem bm_corrente e getPanorama (única fonte desta aba) não devolve; sem fetch novo.
            Não chumbar o BM: quebrava em qualquer outra obra/mês. */}
        <span className="pan-fcell-consol-sub">
          {nAvaliados < 6 ? `pior de ${nAvaliados}/6 avaliadas` : "pior das 6 dimensões"}
        </span>
      </div>
    </div>
  );
}

// ── Crosslinks navegáveis (refs C.x/D.x viram <Link> reais) ────────
// Só referências com rota viva viram link; o resto do texto permanece visível em --text-3
// (sem fingir link). C.10 (esta aba) e refs desconhecidas ficam como texto.
const REF_ROTA = {
  "C.2": "/contracts/$contractId/rma/indicadores",
  "C.3": "/contracts/$contractId/rma/faturamento",
  "C.4": "/contracts/$contractId/rma/recursos",
  "C.5": "/contracts/$contractId/rma/prazo",
  "C.6": "/contracts/$contractId/rma/insumos",
  "C.7": "/contracts/$contractId/rma/produtividade",
  "C.8": "/contracts/$contractId/rma/curvas",
  "C.9": "/contracts/$contractId/rma/chuvas",
  "C.11": "/contracts/$contractId/rma/responsabilidade",
  "C.13": "/contracts/$contractId/timeline",
  "C.14": "/contracts/$contractId/mapa",
  "D.1": "/contracts/$contractId/desequilibrio/indiretos",
  "D.2": "/contracts/$contractId/desequilibrio/bdi",
  "D.3": "/contracts/$contractId/desequilibrio/encargos",
  "D.4": "/contracts/$contractId/desequilibrio/valor-agregado",
  "D.5": "/contracts/$contractId/desequilibrio/insumos",
  "D.6": "/contracts/$contractId/desequilibrio/pontuais",
} as const;

function CrossLinks({ texto }: { texto: string }) {
  const { contractId } = Route.useParams();
  const re = /[CD]\.\d{1,2}/g;
  const partes: ReactNode[] = [];
  let ini = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const ref = m[0];
    const rota = ref in REF_ROTA ? REF_ROTA[ref as keyof typeof REF_ROTA] : undefined;
    if (!rota) continue; // ref sem rota (ex.: C.10, C.12) segue como texto no próximo segmento
    if (m.index > ini) partes.push(texto.slice(ini, m.index));
    partes.push(
      <Link
        key={`${ref}-${m.index}`}
        to={rota}
        params={{ contractId }}
        className="pan-dim-link"
        title={`Abrir ${ref}`}
      >
        {ref}
      </Link>,
    );
    ini = m.index + ref.length;
  }
  if (ini < texto.length) partes.push(texto.slice(ini));
  return <>{partes}</>;
}

// ── Card de dimensão (KPIs + análise + links + cláusulas) ──────────
function DimensaoCard({ dim }: { dim: PanoramaDim }) {
  const Icon = DIM_ICON[dim.chave] ?? Target;
  const semDado = dim.nivel == null;
  return (
    <Card className={`pan-dim${semDado ? " pan-dim-semdado" : ""}`} id={`pan-dim-${dim.chave}`}>
      <div className="pan-dim-head">
        <span className="pan-dim-titulo">
          <Icon size={17} strokeWidth={1.9} /> {dim.label}
        </span>
        <Badge tone={nivelTone(dim.nivel)}>{nivelLabel(dim.nivel)}</Badge>
      </div>
      {dim.kpis.length > 0 && (
        <div className="pan-dim-kpis">
          {dim.kpis.map((k, i) => (
            <div className="pan-dk" key={i}>
              <div className="pan-dk-l">{k.label}</div>
              <div className="pan-dk-v">{k.valor}</div>
              {k.fonte ? <div className="pan-dk-f">{k.fonte}</div> : null}
            </div>
          ))}
        </div>
      )}
      {dim.analise ? <div className="pan-dim-analise">{dim.analise}</div> : null}
      {dim.crosslinks ? (
        <div className="pan-dim-links">
          <Link2 size={12} strokeWidth={2} /> <CrossLinks texto={dim.crosslinks} />
        </div>
      ) : null}
      {dim.clausulas ? (
        <div className="pan-dim-clausula">
          <ScrollText size={12} strokeWidth={2} /> {dim.clausulas}
        </div>
      ) : null}
    </Card>
  );
}

// ── Matriz de Nexo Causal ──────────────────────────────────────────
const NIVEL_RANK: Record<FarolLevel, number> = { critico: 3, risco: 2, observacao: 1, conforme: 0 };
const rankNivel = (n: FarolLevel | null) => (n ? NIVEL_RANK[n] : -1);
type RespGrupo = "contratante" | "contratada" | "outros";
const respGrupo = (r: string): RespGrupo =>
  /contratante/i.test(r) ? "contratante" : /contratada/i.test(r) ? "contratada" : "outros";
const RESP_TONE: Record<RespGrupo, "danger" | "warning" | "info"> = {
  contratante: "danger",
  contratada: "warning",
  outros: "info",
};
const respTone = (resp: string) => RESP_TONE[respGrupo(resp)];

function NexoTable({ nexo }: { nexo: PanoramaNexo[] }) {
  // filtro por responsável — o eixo mais valioso pro Jurídico (desvio do Contratante = base de Pleito)
  const [resp, setResp] = useState<RespGrupo | "todos">("todos");
  const cmpFrente = (a: PanoramaNexo, b: PanoramaNexo) => a.frente.localeCompare(b.frente, "pt-BR");
  const col = useColecao(nexo, {
    busca: (n) => [n.frente, n.desvio, n.causa, n.responsavel, n.documento, n.hipotese].join(" "),
    ordenacoes: [
      {
        value: "farol",
        label: "Mais crítico primeiro",
        cmp: (a, b) => rankNivel(b.nivel) - rankNivel(a.nivel) || cmpFrente(a, b),
      },
      { value: "frente", label: "Frente (A–Z)", cmp: cmpFrente },
    ],
    filtro: resp === "todos" ? undefined : (n) => respGrupo(n.responsavel) === resp,
    resetKey: resp,
  });

  if (nexo.length === 0) {
    return (
      <Card>
        <EmptyState title="Sem desvios relevantes no período." />
      </Card>
    );
  }

  const nPor = (g: RespGrupo) => nexo.filter((n) => respGrupo(n.responsavel) === g).length;
  const chips = (
    <span className="pan-nexo-chips">
      <FilterChip
        label="Todos"
        value={nexo.length}
        active={resp === "todos"}
        onClick={() => setResp("todos")}
      />
      {(["contratante", "contratada", "outros"] as const).map((g) =>
        nPor(g) > 0 ? (
          <FilterChip
            key={g}
            label={g === "outros" ? "Outros" : g === "contratante" ? "Contratante" : "Contratada"}
            value={nPor(g)}
            active={resp === g}
            onClick={() => setResp(resp === g ? "todos" : g)}
          />
        ) : null,
      )}
    </span>
  );

  return (
    <div className="pan-nexo-bloco">
      {nexo.length >= 5 ? (
        <ColToolbar col={col} placeholder="Buscar por frente, causa, documento…" extra={chips} />
      ) : null}
      {col.total === 0 ? (
        col.debounced ? (
          <ColVazio termo={col.debounced} rotulo="desvio" onClear={() => col.setQuery("")} />
        ) : (
          <div className="col-vazia">
            Nenhum desvio com esse filtro.{" "}
            <button type="button" className="col-vazia-clear" onClick={() => setResp("todos")}>
              Limpar filtro
            </button>
          </div>
        )
      ) : (
        <div className="pan-nexo">
          <div className="pan-nexo-head">
            <span>Frente / disciplina</span>
            <span>Desvio</span>
            <span>Causa</span>
            <span>Responsável</span>
            <span>Documento</span>
            <span>Hipótese</span>
            <span>Farol</span>
          </div>
          {col.visible.map((n, i) => (
            <div className="pan-nexo-row" key={`${n.frente}-${i}`}>
              <strong className="pan-nexo-frente">{n.frente}</strong>
              <span>{n.desvio}</span>
              <span>{n.causa}</span>
              <span>
                <Badge tone={respTone(n.responsavel)}>{n.responsavel}</Badge>
              </span>
              <span className="pan-nexo-doc">{n.documento}</span>
              <span className="pan-nexo-doc">{n.hipotese}</span>
              <span>
                <Badge tone={nivelTone(n.nivel)}>{nivelLabel(n.nivel)}</Badge>
              </span>
            </div>
          ))}
        </div>
      )}
      <ColPag col={col} rotulo="desvios" />
    </div>
  );
}

// ── Diagnóstico (card escuro · visão executiva, derivado dos dados) ─
function Diagnostico({
  consolidado,
  dims,
  nAvaliados,
  temNexo,
}: {
  consolidado: FarolLevel | null;
  dims: PanoramaDim[];
  nAvaliados: number;
  temNexo: boolean;
}) {
  const emRisco = dims
    .filter((d) => d.nivel === "risco" || d.nivel === "critico")
    .map((d) => d.label);
  const conformes = dims.filter((d) => d.nivel === "conforme").map((d) => d.label);
  const semDado = dims.filter((d) => d.nivel == null).map((d) => d.label);

  return (
    <aside className="pan-diag">
      <div className="pan-diag-head">
        <Sparkles size={15} strokeWidth={2} /> Diagnóstico — visão executiva
      </div>
      <p className="pan-diag-texto">
        O panorama do mês fecha em <strong>{nivelLabel(consolidado)}</strong> (
        {nAvaliados < 6
          ? `pior das ${nAvaliados} dimensões avaliadas de 6`
          : "pior das seis dimensões"}
        ).{" "}
        {emRisco.length > 0 ? (
          <>
            Os focos de atenção são <strong>{listaPt(emRisco)}</strong>.{" "}
          </>
        ) : null}
        {semDado.length > 0 ? (
          <>
            <strong>
              {semDado.length} {semDado.length === 1 ? "dimensão está" : "dimensões estão"} sem dado
            </strong>{" "}
            ({listaPt(semDado)}) — aparecem em cinza, não em verde, para não dar falso
            conforto.{" "}
          </>
        ) : null}
        {conformes.length > 0 ? <>As dimensões {listaPt(conformes)} estão conformes. </> : null}
        {temNexo ? (
          <>
            Cada desvio do nexo causal já aponta <strong>responsável e documento</strong> — base
            para o Módulo 3 quantificar (impacto em R$ e dias).
          </>
        ) : null}
      </p>
    </aside>
  );
}
