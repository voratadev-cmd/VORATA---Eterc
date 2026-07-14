// Aba "Prazo e Cronograma" (RMA · C.5) — controle de prazo FÍSICO (avanço de serviços, não financeiro),
// fiel ao mockup do idealizador. O físico previsto/real é DERIVADO sem normalização nova:
//   • % real por disciplina = faturamento real ÷ contratado (faturamentoDisciplinaResumo) — bate o XLSX.
//   • físico real overall = Σ(real dos serviços) ÷ Σ(contratado dos serviços) (flag `servico`) = 0,50%.
//   • % previsto por disciplina e a curva = cronogramaFrenteMes.previsto_pct, ponderado pelos serviços.
// O `bridgePrazo` (usePrazoBm) entra só p/ o CALENDÁRIO (decorrido, prazo, marcadores) — o físico dele
// fica "em reconciliação" (baseline .mpp), então NÃO o usamos para o avanço físico. Marcos reais (24).
// Projeção por ritmo: suprimida (o mockup também suprime) — "—". Caminho crítico: pendente (.mpp).

import { useMemo, useState, type ReactElement } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Card,
  CHART_SERIE_COR,
  ChartLegend,
  type ChartLegendItem,
  ChartTooltip,
  EmptyState,
  ErroCard,
  I,
  ProgressBar,
  Skeleton,
} from "@/components/ds";
import { usePrazoBm } from "@/lib/hooks/usePrazoBm";
import { usePrazoMarcos } from "@/lib/hooks/usePrazoMarcos";
import { usePrazoC5 } from "@/lib/hooks/usePrazoC5";
import { useObra } from "@/lib/hooks/useObra";
import { formatBRL } from "@/lib/format";
import type {
  PrazoC5CurvaMes,
  PrazoC5Disciplina,
  PrazoC5Natureza,
  PrazoC5Painel,
} from "@/lib/supabase/prazoC5";
import { useFaturamentoDisciplinaResumo } from "@/lib/hooks/useFaturamentoDisciplinaResumo";
import { useFaturamentoDisciplinaMes } from "@/lib/hooks/useFaturamentoDisciplinaMes";
import { useFaturamentoBm } from "@/lib/hooks/useFaturamentoBm";
import { useFaturamentoCruzamento } from "@/lib/hooks/useFaturamentoCruzamento";
import { useIndiretos } from "@/lib/hooks/useIndiretos";
import type { FaturamentoCruzamento } from "@/lib/supabase/faturamentoCruzamento";
import { ColPag, ColToolbar, ColVazio, normTxt, useColecao } from "@/lib/rma/colecao";
import {
  corteMesParaISO,
  MARCO_STATUS_LABEL,
  type MarcoStatus,
  statusMarco,
} from "@/lib/rma/marcoFarol";
import type { PrazoMarco } from "@/lib/supabase/prazoMarcos";
import type { FaturamentoDisciplinaResumo } from "@/lib/supabase/faturamentoDisciplinaResumo";
import type { FaturamentoDisciplinaMes } from "@/lib/supabase/faturamentoDisciplinaMes";
import type { PrazoBM } from "@/lib/mocks/obras/types";
import "./prazo.css";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/prazo")({
  component: PrazoAba,
});

// ── Parâmetro de OBRA (config · D.2 G12 não normalizado · feed do Módulo 3 pendente) ────────────────
// BDI-prazo/mês = Adm Central + garantias/seguros que correm por mês de prorrogação. Vem da D.2 G12,
// ainda não normalizada (só o total acumulado existe no obra_desequilibrio — dividir fabricaria). Fica
// como config por obra até o read-model existir. Adm Local (D.1) já vem do banco (getIndiretos).
const BR101_ID = "fe288319-ff4f-4564-a459-139dfb021265";
const BDI_PRAZO_MENSAL: Record<string, number> = { [BR101_ID]: 1505731 };

// ── Formatadores ────────────────────────────────────────────────────────────────────────────────
const fmtPct = (v: number | null, d = 2) =>
  v != null
    ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`
    : "—";
const fmtPp = (v: number | null) =>
  v != null
    ? `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pp`
    : "—";
const fmtNum = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";
const fmtMi = (v: number | null) =>
  v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";
function formatBRDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Farol do desvio físico (pp). A régua REAL do mockup é −1/−5/−15 (reproduz 30/30 status do oráculo
// por disciplina/frente e bate a análise-prose: Geodreno −12,5 = Risco, Mobilização −45 = Crítico).
// A legenda impressa no mockup ("−3 / −8") é um erro de texto; os dados usam −5/−15. "Só pune queda".
// Régua configurável por contrato (CLAUDE.md) — constantes nomeadas, sem magic numbers espalhados.
const FAROL_FISICO_PP = { observacao: -1, risco: -5, critico: -15 } as const;
type FarolNivel = { tone: "success" | "info" | "warning" | "danger"; label: string };
// Status declarado da fonte C.5 → farol da tela (labels canônicos do produto).
const STATUS_C5_FAROL: Record<string, FarolNivel> = {
  cumprido: { tone: "success", label: "Conforme" },
  "no prazo": { tone: "info", label: "No prazo" },
  "em risco": { tone: "warning", label: "Em risco" },
  atrasado: { tone: "danger", label: "Atrasado" },
};

function farolDesvioFisico(desvioPp: number | null): FarolNivel | null {
  if (desvioPp == null) return null;
  if (desvioPp >= FAROL_FISICO_PP.observacao) return { tone: "success", label: "Conforme" };
  if (desvioPp >= FAROL_FISICO_PP.risco) return { tone: "info", label: "Observação" };
  if (desvioPp >= FAROL_FISICO_PP.critico) return { tone: "warning", label: "Risco" };
  return { tone: "danger", label: "Crítico" };
}

// Farol do marco (Badge): deriva o status compartilhado (data-limite × corte + %) e mapeia p/ tom/label
// do DS. Lógica única em @/lib/rma/marcoFarol — a aba Indicadores usa o mesmo helper.
const MARCO_STATUS_TONE: Record<MarcoStatus, FarolNivel["tone"]> = {
  cumprido: "info",
  atrasado: "danger",
  "em-risco": "warning",
  "no-prazo": "success",
  pendente: "info",
};
function farolMarco(
  dataLimite: string | null,
  corteISO: string | null,
  pctConcluido: number | null,
): FarolNivel {
  const s = statusMarco(dataLimite, corteISO, pctConcluido);
  return { tone: MARCO_STATUS_TONE[s], label: MARCO_STATUS_LABEL[s] };
}

// ── Derivação do FÍSICO (faturamento: contratadoAcum/realAcum ÷ contratadoTotal, apenas serviços) ──
// Previsto físico = % do físico-financeiro CONTRATUAL planejado até o corte (contratadoAcum ÷ total);
// Real físico = medição acumulada (realAcum ÷ total). Mesmo read-model de faturamento → bate o oráculo
// ao centésimo (overall 1,65% prev / 0,50% real). O overall pondera só disciplinas de SERVIÇO (flag
// `servico`) — exclui Mobilização, Adm Local e Insumos. Curva mensal e drill por frente: idem.
type DiscFisico = {
  disciplina: string;
  servico: boolean;
  prevPct: number | null; // contratadoAcum ÷ contratadoTotal (físico-financeiro planejado no corte)
  realPct: number | null; // realAcum ÷ contratadoTotal (medido acumulado)
  deltaPp: number | null; // real − prev (atraso = negativo)
  farol: FarolNivel | null;
};
type Fisico = {
  realOverallPct: number | null; // físico real overall (serviços) — 0,50%
  prevOverallPct: number | null; // físico previsto overall no corte — 1,65%
  atrasoPp: number | null; // real − prev
  farol: FarolNivel | null;
  curva: Array<{ mesNum: number; mesLabel: string; prevPct: number; realPct: number | null }>; // % físico acum/mês
  porDisciplina: DiscFisico[];
  porFrente: DiscFisico[]; // mesmo físico, agregado por frente (apenas serviços) — toggle do mockup
  ritmoNecMes: number | null; // (100 − real) ÷ meses restantes
  ritmoRecMes: number | null; // real ÷ meses decorridos
};

function pctDiv(num: number | null | undefined, den: number | null | undefined): number | null {
  return den && den > 0 && num != null ? (num / den) * 100 : null;
}

function derivarFisico(
  discFat: FaturamentoDisciplinaResumo,
  dmes: FaturamentoDisciplinaMes | null,
  cruz: FaturamentoCruzamento | null,
  corteMesNum: number | null,
  decorridoMeses: number | null,
  mesesTotais: number | null,
): Fisico {
  // Overall (apenas serviços): Σ contratadoAcum ÷ Σ contratadoTotal (prev) · Σ realAcum ÷ Σ ... (real).
  const servicoDiscs = discFat.disciplinas.filter((d) => d.servico);
  const totalServ = servicoDiscs.reduce((a, d) => a + (d.contratadoTotal ?? 0), 0);
  const prevServ = servicoDiscs.reduce((a, d) => a + (d.contratadoAcum ?? 0), 0);
  const realServ = servicoDiscs.reduce((a, d) => a + (d.realAcum ?? 0), 0);
  const prevOverallPct = pctDiv(prevServ, totalServ);
  const realOverallPct = pctDiv(realServ, totalServ);
  const atrasoPp =
    prevOverallPct != null && realOverallPct != null ? realOverallPct - prevOverallPct : null;

  // Por disciplina (todas, inclusive não-serviço p/ a tabela): prev/real ÷ contratadoTotal da disciplina.
  const porDisciplina: DiscFisico[] = discFat.disciplinas.map((d) => {
    const prev = pctDiv(d.contratadoAcum, d.contratadoTotal);
    const real = pctDiv(d.realAcum, d.contratadoTotal);
    const delta = prev != null && real != null ? real - prev : null;
    return {
      disciplina: d.disciplina,
      servico: !!d.servico,
      prevPct: prev,
      realPct: real,
      deltaPp: delta,
      farol: farolDesvioFisico(delta),
    };
  });

  // Curva física acum/mês (apenas serviços) = Σ(servico previstoAcumRs no mês) ÷ Σ servico contratado.
  // Real congela no corte (mês corrente); pré/pós-corte ficam null (não plota 0% fabricado).
  const servNomes = new Set(servicoDiscs.map((d) => normTxt(d.disciplina)));
  const curva: Fisico["curva"] = [];
  if (dmes && totalServ > 0) {
    for (const mx of dmes.mesesAxis) {
      let acum = 0;
      for (const s of dmes.disciplinas) {
        if (!servNomes.has(normTxt(s.disciplina))) continue;
        const cel = s.celulas.find((c) => c.mesNum === mx.mesNum);
        if (cel) acum += cel.previstoAcumRs;
      }
      curva.push({
        mesNum: mx.mesNum,
        mesLabel: mx.label, // calendário ("mar/26") já vem pronto do read-model — nada de "M3" seco
        prevPct: (acum / totalServ) * 100,
        realPct: corteMesNum != null && mx.mesNum === corteMesNum ? realOverallPct : null,
      });
    }
  }

  // Por frente (apenas serviços) — Σ servico (contratado/previstoAcum/realAcum) por frente, do cruzamento
  // auxiliar_C.3. Mesmo físico das disciplinas, agregado por frente. Bate o oráculo do mockup
  // (Trecho 01 = 6,56/1,70/−4,86). Nome original da frente vem de porDisciplina (porFrente é por chave).
  const porFrente: DiscFisico[] = [];
  if (cruz) {
    const frenteNome = new Map<string, string>();
    for (const itens of Object.values(cruz.porDisciplina))
      for (const it of itens) frenteNome.set(normTxt(it.nome), it.nome);
    for (const [fk, disciplinas] of Object.entries(cruz.porFrente)) {
      let c = 0;
      let p = 0;
      let r = 0;
      for (const d of disciplinas) {
        if (!servNomes.has(normTxt(d.nome))) continue; // só serviços (exclui Mob/Adm/Insumos)
        c += d.contratado ?? 0;
        p += d.previstoAcum ?? 0;
        r += d.realAcum ?? 0;
      }
      if (c <= 0) continue; // frente sem serviços contratados → fora
      const prev = (p / c) * 100;
      const real = (r / c) * 100;
      const delta = real - prev;
      porFrente.push({
        disciplina: frenteNome.get(fk) ?? fk,
        servico: true,
        prevPct: prev,
        realPct: real,
        deltaPp: delta,
        farol: farolDesvioFisico(delta),
      });
    }
  }

  const restMeses =
    mesesTotais != null && decorridoMeses != null ? mesesTotais - decorridoMeses : null;
  const ritmoNecMes =
    realOverallPct != null && restMeses != null && restMeses > 0
      ? (100 - realOverallPct) / restMeses
      : null;
  const ritmoRecMes =
    realOverallPct != null && decorridoMeses != null && decorridoMeses > 0
      ? realOverallPct / decorridoMeses
      : null;

  return {
    realOverallPct,
    prevOverallPct,
    atrasoPp,
    farol: farolDesvioFisico(atrasoPp),
    curva,
    porDisciplina,
    porFrente,
    ritmoNecMes,
    ritmoRecMes,
  };
}

function PrazoAba() {
  const { contractId } = Route.useParams();
  const {
    data: prazoBridge,
    isLoading: l1,
    isError: e1,
    error: err1,
    refetch,
  } = usePrazoBm(contractId);
  const { data: discFat, isLoading: l2 } = useFaturamentoDisciplinaResumo(contractId);
  const { data: dmes } = useFaturamentoDisciplinaMes(contractId);
  const { data: cruz } = useFaturamentoCruzamento(contractId);
  const { data: marcos } = usePrazoMarcos(contractId);
  const { data: fatBridge } = useFaturamentoBm(contractId);
  const { data: indiretos } = useIndiretos(contractId);

  const prazo = prazoBridge?.prazo ?? null;
  const corte = fatBridge?.mesCorte ?? null;
  // corte mes_num do cronograma = meses desde o início da obra (1-based) — robusto, não depende do
  // rótulo do BM. inicio mar/26 → mai/26 = mês 3 (alinha o previsto 1,65% validado).
  const corteMesNum = useMemo(() => {
    if (!prazo?.inicioISO || !corte) return null;
    const [iy, im] = prazo.inicioISO.split("-").map(Number);
    return (corte.ano - iy) * 12 + (corte.mes - im) + 1;
  }, [prazo?.inicioISO, corte]);
  const mesesTotais = prazo ? Math.round(prazo.prazoContratualDias / 30.4) : null;
  const decorridoMeses = corteMesNum;

  const c5 = usePrazoC5(contractId).data ?? null;
  const fisicoDerivado = useMemo(
    () =>
      discFat
        ? derivarFisico(
            discFat,
            dmes ?? null,
            cruz ?? null,
            corteMesNum,
            decorridoMeses,
            mesesTotais,
          )
        : null,
    [discFat, dmes, cruz, corteMesNum, decorridoMeses, mesesTotais],
  );
  // Calendário OFICIAL de nível contrato (spec ajustes-REVISADO-v3 §C.5.3): decorrido/restantes
  // são CALCULADOS (corte − OS · término − corte · % sobre o prazo), nunca chumbados. Precedência
  // das âncoras: premissas declaradas (obras.premissas.datas_oficiais, sobrevive re-normalização)
  // → obras row → painel C.5 da fonte. Sem as âncoras → cards seguem no bridge (BR-101 intocada).
  const { data: obra } = useObra(contractId);
  const calOficial = useMemo<CalendarioOficial | null>(() => {
    const painel = c5?.painel ?? null;
    const premissas = (
      obra as {
        premissas?: { datas_oficiais?: { termino_execucao?: string; prazo_dias?: number } };
      } | null
    )?.premissas;
    const inicio = obra?.data_inicio ?? painel?.inicioOsISO ?? null;
    const termino =
      premissas?.datas_oficiais?.termino_execucao ??
      obra?.data_termino ??
      painel?.terminoContratual?.slice(0, 10) ??
      null;
    const corteISO = painel?.dataCorteISO ?? (corte ? corteMesParaISO(corte.ano, corte.mes) : null);
    if (!inicio || !termino || !corteISO) return null;
    const diasEntre = (a: string, b: string): number => {
      const [ay, am, ad] = a.split("-").map(Number);
      const [by, bm, bd] = b.split("-").map(Number);
      return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
    };
    // prazo em dias: o DECLARADO no contrato quando cadastrado (540); senão a diferença de datas.
    const prazoDias = premissas?.datas_oficiais?.prazo_dias ?? diasEntre(inicio, termino);
    if (!(prazoDias > 0)) return null;
    const decorridoDias = diasEntre(inicio, corteISO);
    if (decorridoDias < 0) return null;
    return {
      inicioISO: inicio,
      terminoISO: termino,
      prazoDias,
      decorridoDias,
      restantesDias: diasEntre(corteISO, termino),
      decorridoPct: (decorridoDias / prazoDias) * 100,
    };
  }, [obra, c5, corte]);

  // Físico DECLARADO da aba C.5 (painel + marcos por disciplina) vence o proxy financeiro derivado
  // do faturamento — a spec manda exibir o que a fonte declara. Obras sem as seções → derivado.
  const fisico = useMemo<Fisico | null>(() => {
    if (!c5?.painel && !c5?.disciplinas.length) return fisicoDerivado;
    const pn = c5.painel;
    const atraso = pn?.atrasoAcumPp != null ? -pn.atrasoAcumPp : (fisicoDerivado?.atrasoPp ?? null);
    const porDisc: DiscFisico[] = c5.disciplinas.length
      ? c5.disciplinas.map((d) => ({
          disciplina: d.disciplina,
          servico: true,
          prevPct: d.prevPct,
          realPct: d.realPct,
          deltaPp: d.deltaPp,
          farol: d.status ? (STATUS_C5_FAROL[d.status.toLowerCase()] ?? null) : null,
        }))
      : (fisicoDerivado?.porDisciplina ?? []);
    return {
      realOverallPct: pn?.fisicoRealPct ?? fisicoDerivado?.realOverallPct ?? null,
      prevOverallPct: pn?.fisicoPrevistoPct ?? fisicoDerivado?.prevOverallPct ?? null,
      atrasoPp: atraso,
      farol: farolDesvioFisico(atraso),
      curva: fisicoDerivado?.curva ?? [],
      porDisciplina: porDisc,
      porFrente: fisicoDerivado?.porFrente ?? [],
      ritmoNecMes: pn?.ritmoNecessarioPctMes ?? fisicoDerivado?.ritmoNecMes ?? null,
      ritmoRecMes: pn?.ritmoRecentePctMes ?? fisicoDerivado?.ritmoRecMes ?? null,
    };
  }, [c5, fisicoDerivado]);

  if (l1 || l2) {
    // Skeleton com a FORMA real da tela (regra 4 do CLAUDE.md): header + 3 decks +
    // par curva/donut (1.55fr/1fr) + bloco da tabela de marcos — sem retângulo genérico.
    return (
      <main className="prz-main">
        <div className="prz-head">
          <Skeleton style={{ height: 24, width: 340 }} />
          <Skeleton style={{ height: 14, width: 480, maxWidth: "100%" }} />
        </div>
        <div className="prz-decks">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 210 }} />
          ))}
        </div>
        <div className="prz-grow">
          <Skeleton style={{ height: 320 }} />
          <Skeleton style={{ height: 280 }} />
        </div>
        <Skeleton style={{ height: 260 }} />
      </main>
    );
  }
  // ERRO ≠ PENDÊNCIA: falha de leitura mostra ErroCard (Badge danger + retry do react-query);
  // obra sem cronograma normalizado é ausência honesta → EmptyState neutro, sem retry.
  if (e1) {
    return (
      <main className="prz-main">
        <ErroCard
          titulo="Não foi possível carregar o prazo"
          mensagem={err1 instanceof Error ? err1.message : undefined}
          onRetry={() => void refetch()}
        />
      </main>
    );
  }
  if (!prazo) {
    return (
      <main className="prz-main">
        <Card>
          <EmptyState
            framed
            icon={I.clock({ size: 40 })}
            title="Prazo ainda não normalizado"
            text="Esta obra não tem cronograma e medições normalizados no banco ainda."
          />
        </Card>
      </main>
    );
  }

  const bmLabel = corteMesNum ? `BM ${corteMesNum}` : "BM —";
  const bmMes = fatBridge?.bmLabel ?? "";
  const corteDataISO = corte ? corteMesParaISO(corte.ano, corte.mes) : null;

  return (
    <main className="prz-main">
      <header className="prz-head">
        <h2 className="prz-titulo">Prazo e Cronograma · C.5</h2>
        <div className="prz-subrow">
          <div className="prz-subrow-meta">
            <span>
              Data de corte: <b>{formatBRDate(corteDataISO)}</b>
            </span>
            <span>
              BM:{" "}
              <b>
                {corteMesNum ?? "—"}
                {bmMes ? ` (${bmMes})` : ""}
              </b>
            </span>
          </div>
          {fisico?.farol ? (
            <Badge tone={fisico.farol.tone}>{fisico.farol.label}</Badge>
          ) : (
            <Badge tone="info">Pendente</Badge>
          )}
        </div>
        <p className="prz-sub">
          Controle de prazo <strong>FÍSICO</strong> (avanço de serviços, não financeiro) · fonte:
          cronograma físico-financeiro contratual × medição
        </p>
      </header>

      <Decks
        prazo={prazo}
        fisico={fisico}
        bmLabel={bmLabel}
        mesesTotais={mesesTotais}
        painel={c5?.painel ?? null}
        cal={calOficial}
      />

      <div className="prz-grow">
        <CurvaCard
          fisico={fisico}
          prazo={prazo}
          bmLabel={bmLabel}
          corteMesNum={corteMesNum}
          curva4={c5?.curva ?? null}
        />
        <MarcosResumo marcos={marcos ?? []} corteISO={corteDataISO} />
      </div>

      <MarcosDetalhe marcos={marcos ?? []} corteISO={corteDataISO} c5Disc={c5?.disciplinas ?? []} />

      <div className="prz-grow prz-grow-atr">
        {/* FarolLegenda mora no rodapé do AtrasadosCard — junto da única tabela que usa esse farol */}
        <AtrasadosCard fisico={fisico} bmLabel={bmLabel} />
        <NaturezaAvanco
          naturezas={c5?.naturezas ?? []}
          totalRs={c5?.naturezaTotalRs ?? null}
          achado={c5?.naturezaAchado ?? null}
        />
      </div>

      {fisico && <AnaliseCard fisico={fisico} prazo={prazo} bmLabel={bmLabel} />}

      <CalcExtensao contractId={contractId} admLocalMensal={indiretos?.admLocalMensal ?? null} />
    </main>
  );
}

// ── 3 decks ───────────────────────────────────────────────────────────────────────────────────
function fmtDataISO(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Calendário de nível CONTRATO calculado das âncoras oficiais (OS · término · prazo declarado). */
type CalendarioOficial = {
  inicioISO: string;
  terminoISO: string;
  prazoDias: number;
  decorridoDias: number;
  restantesDias: number;
  decorridoPct: number;
};

function Decks({
  prazo,
  fisico,
  bmLabel,
  mesesTotais,
  painel,
  cal,
}: {
  prazo: PrazoBM;
  fisico: Fisico | null;
  bmLabel: string;
  mesesTotais: number | null;
  painel: PrazoC5Painel | null;
  cal: CalendarioOficial | null;
}) {
  // Aderência = real ÷ previsto (mesmos campos já carregados) — substitui a duplicata literal do
  // atraso que ocupava dois stats ("Atraso acum." e "Desvio" eram o MESMO número).
  const aderenciaPct =
    fisico?.realOverallPct != null && fisico?.prevOverallPct != null && fisico.prevOverallPct > 0
      ? (fisico.realOverallPct / fisico.prevOverallPct) * 100
      : null;
  const fmtRitmo = (v: number | null) =>
    v != null ? `${v.toFixed(2).replace(".", ",")}%/mês` : "—";
  const ritmoAbaixo =
    fisico?.ritmoNecMes != null &&
    fisico?.ritmoRecMes != null &&
    fisico.ritmoRecMes < fisico.ritmoNecMes;
  // projeção declarada só aparece com painel presente e ≥20% do prazo decorrido (regra da fonte)
  const projecaoVisivel = painel != null && (painel.decorridoPct ?? 0) >= 20;
  // Término planejado do cronograma (tendenciaTerminoISO) — só vira stat quando DIVERGE do contratual.
  const terminoContratualExib = cal?.terminoISO ?? prazo.fimContratualISO;
  const terminoPlanejadoDivergente =
    prazo.tendenciaTerminoISO && prazo.tendenciaTerminoISO !== terminoContratualExib
      ? prazo.tendenciaTerminoISO
      : null;
  return (
    <div className="prz-decks">
      <div className="prz-deck">
        <div className="prz-deck-head">
          {I.clock({ size: 15 })} <span className="prz-deck-titulo">Decorrido</span>
        </div>
        {/* Base OFICIAL de contrato quando as âncoras existem (OS/término/prazo) — os valores são
            fórmula (corte − OS · ÷ prazo · término − corte), nunca copiados da aba (spec v3). */}
        <div className="prz-deck-big">{fmtPct(cal?.decorridoPct ?? prazo.decorridoPct, 1)}</div>
        <ProgressBar
          size="sm"
          value={Math.max(0, Math.min(100, cal?.decorridoPct ?? prazo.decorridoPct))}
          aria-label="Prazo contratual decorrido"
        />
        <div className="prz-deck-sub">do prazo contratual</div>
        <div className="prz-deck-stats">
          <Stat
            k="Prazo"
            v={`${cal ? Math.round(cal.prazoDias / 30.4) : (mesesTotais ?? "—")} meses`}
          />
          <Stat k="= dias" v={`${fmtNum(cal?.prazoDias ?? prazo.prazoContratualDias)} d`} />
          <Stat k="Início (OS)" v={formatBRDate(cal?.inicioISO ?? prazo.inicioISO)} />
          <Stat k="Término" v={formatBRDate(cal?.terminoISO ?? prazo.fimContratualISO)} />
          <Stat k="Decorrido" v={`${cal?.decorridoDias ?? prazo.decorridoDias} dias`} />
          <Stat k="Restantes" v={`${fmtNum(cal?.restantesDias ?? prazo.restantesDias)} dias`} />
          {terminoPlanejadoDivergente ? (
            <Stat
              k="Término planejado (cronograma)"
              v={formatBRDate(terminoPlanejadoDivergente)}
              wide
            />
          ) : null}
        </div>
      </div>

      <div className="prz-deck">
        <div className="prz-deck-head">
          {I.trending({ size: 15 })} <span className="prz-deck-titulo">Avanço físico</span>
          {fisico?.farol ? <Badge tone={fisico.farol.tone}>{fisico.farol.label}</Badge> : null}
        </div>
        <div className="prz-deck-big">{fmtPct(fisico?.realOverallPct ?? null)}</div>
        <div className="prz-deck-sub">
          real até o {bmLabel} · previsto {fmtPct(fisico?.prevOverallPct ?? null)}
        </div>
        <div className="prz-deck-stats">
          <Stat k="Previsto" v={fmtPct(fisico?.prevOverallPct ?? null)} />
          <Stat k="Real" v={fmtPct(fisico?.realOverallPct ?? null)} />
          <Stat k="Atraso acum." v={fmtPp(fisico?.atrasoPp ?? null)} tone="neg" />
          <Stat k="Aderência" v={fmtPct(aderenciaPct, 1)} />
        </div>
      </div>

      <div className="prz-deck">
        <div className="prz-deck-head">
          {I.trending({ size: 15 })} <span className="prz-deck-titulo">Projeção &amp; ritmo</span>
        </div>
        {/* O herói do deck é o dado decisório REAL (ritmo), não o travessão da projeção suprimida —
            a supressão honesta continua dita no stat "Projeção término" e na nota abaixo. */}
        <div className="prz-deck-big">{fmtRitmo(fisico?.ritmoNecMes ?? null)}</div>
        <div className="prz-deck-sub">
          ritmo necessário p/ 100% no prazo · recente{" "}
          <span className={ritmoAbaixo ? "prz-sub-alerta" : undefined}>
            {fmtRitmo(fisico?.ritmoRecMes ?? null)}
          </span>
        </div>
        <div className="prz-deck-stats">
          <Stat
            k="Ritmo recente"
            v={fmtRitmo(fisico?.ritmoRecMes ?? null)}
            tone={ritmoAbaixo ? "neg" : undefined}
          />
          <Stat
            k="Projeção término"
            v={projecaoVisivel ? fmtDataISO(painel?.terminoProjetado ?? null) : "—"}
          />
          <Stat
            k="Δ vs contratual"
            v={
              projecaoVisivel && painel?.deltaVsContratualDias != null
                ? `+${painel.deltaVsContratualDias.toLocaleString("pt-BR")} dias`
                : "—"
            }
            tone={projecaoVisivel && (painel?.deltaVsContratualDias ?? 0) > 0 ? "neg" : undefined}
          />
          <Stat
            k="Prorrogação"
            v={
              projecaoVisivel && painel?.prorrogacaoEstimadaMeses != null
                ? `${painel.prorrogacaoEstimadaMeses.toLocaleString("pt-BR")} meses (${
                    painel.impactoFinalDias != null
                      ? `${painel.impactoFinalDias.toLocaleString("pt-BR")} dias`
                      : "—"
                  })`
                : "—"
            }
            tone={
              projecaoVisivel && (painel?.prorrogacaoEstimadaMeses ?? 0) > 0 ? "neg" : undefined
            }
          />
        </div>
        <p className="prz-deck-nota">
          {projecaoVisivel
            ? `Projeção pelo cenário-tendência da fonte (ritmo ${painel?.ritmoVsNecessario ?? "—"}).`
            : `Projeção de término suprimida no início (estabiliza após ~20% do prazo; hoje ${fmtPct(prazo.decorridoPct, 1)}).`}
        </p>
      </div>
    </div>
  );
}

function Stat({ k, v, wide, tone }: { k: string; v: string; wide?: boolean; tone?: "neg" }) {
  return (
    <div className={`prz-stat${wide ? " prz-stat-wide" : ""}`}>
      <span>{k}</span>
      <b className={tone === "neg" ? "prz-stat-neg" : ""}>{v}</b>
    </div>
  );
}

// ── Curva física (previsto × real) ──────────────────────────────────────────────────────────────
// Dot custom do Real: com UM único ponto medido (0,50%) num eixo 0–100%, o dot default r=3 some no
// canto — reforça (r 4.5 + stroke da surface) e rotula o valor ao lado, pra "onde a obra está" ser
// encontrável no gráfico principal da aba.
type DotProps = { cx?: number; cy?: number; value?: number | null; index?: number };
function realDot(props: DotProps): ReactElement<SVGElement> {
  const { cx, cy, value, index } = props;
  if (value == null || cx == null || cy == null) return <g key={`rd-${index}`} />;
  return (
    <g key={`rd-${index}`}>
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill={CHART_SERIE_COR.real}
        stroke="var(--surface)"
        strokeWidth={1.5}
      />
      <text
        x={cx + 9}
        y={cy - 9}
        fontSize={11}
        fontWeight={600}
        fill="var(--text-2)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {fmtPct(value)}
      </text>
    </g>
  );
}

function CurvaCard({
  fisico,
  prazo,
  bmLabel,
  corteMesNum,
  curva4,
}: {
  fisico: Fisico | null;
  prazo: PrazoBM;
  bmLabel: string;
  corteMesNum: number | null;
  curva4: PrazoC5CurvaMes[] | null;
}) {
  // Curva DECLARADA da aba C.5 (4 séries: físico + financeiro, prev × real) quando existe;
  // senão a curva física derivada (2 séries). O físico continua o protagonista (prev/real).
  const tem4 = (curva4?.length ?? 0) > 0;
  const dados = tem4
    ? curva4!.map((m, i) => ({
        mes: i + 1,
        mesLabel: m.mesLabel,
        prev: m.fisPrevPct,
        real: m.fisRealPct,
        finPrev: m.finPrevPct,
        finReal: m.finRealPct,
      }))
    : (fisico?.curva.map((p) => ({
        mes: p.mesNum,
        mesLabel: p.mesLabel,
        prev: p.prevPct,
        real: p.realPct as number | null,
        finPrev: null as number | null,
        finReal: null as number | null,
      })) ?? []);
  const corteLabel = dados.find((d) => d.mes === corteMesNum)?.mesLabel ?? null;
  // Convenção única do ChartKit: Previsto = info (tracejado) · Real = navy (sólido).
  const legenda: ChartLegendItem[] = tem4
    ? [
        { label: "Físico previsto", tipo: "tracejada", cor: CHART_SERIE_COR.contratado },
        { label: "Físico real", tipo: "linha", cor: CHART_SERIE_COR.real },
        { label: "Financeiro previsto", tipo: "tracejada", cor: CHART_SERIE_COR.meta },
        { label: "Financeiro real", tipo: "linha", cor: CHART_SERIE_COR.meta },
      ]
    : [
        { label: "Previsto acum.", tipo: "tracejada", cor: CHART_SERIE_COR.contratado },
        { label: "Real acum.", tipo: "linha", cor: CHART_SERIE_COR.real },
      ];
  return (
    <section className="prz-section">
      <header className="prz-section-head">
        <div>
          <h3 className="prz-section-title">Curva física — Previsto × Real</h3>
          <div className="prz-section-sub">% acumulado · apenas serviços</div>
        </div>
        <ChartLegend items={legenda} />
      </header>
      {dados.length === 0 ? (
        <EmptyState
          title="Curva física pendente"
          text="Aguardando o cronograma físico normalizado."
        />
      ) : (
        <div className="prz-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              {/* rótulos de CALENDÁRIO ("mar/26") do read-model — cruzam direto com as datas-limite
                  dos marcos; o Recharts afina pela largura (preserveStartEnd + minTickGap). */}
              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
                minTickGap={28}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v: number) => fmtPct(v)}
                    nomes={
                      tem4
                        ? {
                            prev: "Físico previsto",
                            real: "Físico real",
                            finPrev: "Financeiro previsto",
                            finReal: "Financeiro real",
                          }
                        : { prev: "Previsto acum.", real: "Real acum." }
                    }
                    titulo={(label, payload) => {
                      const p = payload?.[0]?.payload as { mes?: number } | undefined;
                      // nº do mês continua visível ("M3 · mai/26") — calendário não apaga o índice
                      return p?.mes != null && label !== `M${p.mes}`
                        ? `M${p.mes} · ${label}`
                        : label;
                    }}
                  />
                }
              />
              {corteLabel != null ? (
                <ReferenceLine
                  x={corteLabel}
                  stroke="var(--text-3)"
                  strokeDasharray="3 3"
                  label={{
                    value: "data de corte",
                    position: "top",
                    fontSize: 11,
                    fill: "var(--text-3)",
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="prev"
                name="Previsto acum."
                stroke={CHART_SERIE_COR.contratado}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Real acum."
                stroke={CHART_SERIE_COR.real}
                strokeWidth={2.6}
                dot={tem4 ? false : realDot}
                connectNulls={false}
                isAnimationActive={false}
              />
              {tem4 ? (
                <Line
                  type="monotone"
                  dataKey="finPrev"
                  name="Financeiro previsto"
                  stroke={CHART_SERIE_COR.meta}
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              {tem4 ? (
                <Line
                  type="monotone"
                  dataKey="finReal"
                  name="Financeiro real"
                  stroke={CHART_SERIE_COR.meta}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="prz-curva-info">
        <strong>{bmLabel}</strong> — físico previsto {fmtPct(fisico?.prevOverallPct ?? null)} · real{" "}
        {fmtPct(fisico?.realOverallPct ?? null)} · atraso {fmtPp(fisico?.atrasoPp ?? null)}. Real
        congela após o BM corrente; previsto segue até 100%.
      </p>
    </section>
  );
}

// ── Marcos · donut por status + resumo ──────────────────────────────────────────────────────────
function MarcosResumo({ marcos, corteISO }: { marcos: PrazoMarco[]; corteISO: string | null }) {
  const counts = useMemo(() => {
    // Init defensivo + incremento `?? 0`: marco com dataLimite null vira status "pendente" (label
    // "—") — sem o bucket, `c["—"]++` daria NaN e o marco sumiria do donut em silêncio (o centro
    // diria N e a legenda somaria menos). O read-model (prazoMarcos) permite null.
    const c: Record<string, number> = { "No prazo": 0, "Em risco": 0, Atrasado: 0, Cumprido: 0 };
    marcos.forEach((m) => {
      const label = farolMarco(m.dataLimite, corteISO, m.pctConcluido).label;
      c[label] = (c[label] ?? 0) + 1;
    });
    return c;
  }, [marcos, corteISO]);
  const semData = counts["—"] ?? 0;
  const segs = [
    { label: "Em risco", n: counts["Em risco"], color: "var(--warning)" },
    { label: "No prazo", n: counts["No prazo"], color: "var(--success)" },
    { label: "Atrasados", n: counts["Atrasado"], color: "var(--danger)" },
    { label: "Cumpridos", n: counts["Cumprido"], color: "var(--info)" },
    { label: "Sem data-limite", n: semData, color: "var(--text-4)" }, // = swatch da legenda
  ].filter((s) => s.n > 0);
  const prox = useMemo(() => {
    const ref = corteISO ?? "0000-00-00";
    const datas = marcos
      .map((m) => m.dataLimite)
      .filter((d): d is string => !!d && d >= ref)
      .sort();
    return datas.length ? formatBRDate(datas[0]) : "—";
  }, [marcos, corteISO]);

  return (
    <section className="prz-section">
      <header className="prz-section-head">
        <div>
          <h3 className="prz-section-title">Marcos contratuais — resumo</h3>
          <div className="prz-section-sub">{marcos.length} marcos · data-limite contratual</div>
        </div>
      </header>
      <div className="prz-donut-wrap">
        <DonutStatus segments={segs} total={marcos.length} />
        <ul className="prz-mcounts">
          {[
            { label: "Em risco", n: counts["Em risco"], color: "var(--warning)" },
            { label: "No prazo", n: counts["No prazo"], color: "var(--success)" },
            { label: "Atrasados", n: counts["Atrasado"], color: "var(--danger)" },
            { label: "Cumpridos", n: counts["Cumprido"], color: "var(--info)" },
            // aparece só quando existir marco sem data (n>0) — hoje a BR-101 tem todas as datas
            ...(semData > 0
              ? [{ label: "Sem data-limite", n: semData, color: "var(--text-4)" }]
              : []),
          ].map((x) => (
            <li key={x.label}>
              <span>
                <span className="prz-dot" style={{ background: x.color }} /> {x.label}
              </span>
              <b className="tabular">{x.n}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="prz-mnext">
        Próximo vencimento: <strong>{prox}</strong>
      </div>
    </section>
  );
}

function DonutStatus({
  segments,
  total,
}: {
  segments: Array<{ label: string; n: number; color: string }>;
  total: number;
}) {
  const r = 56;
  const C = 2 * Math.PI * r;
  const soma = segments.reduce((a, s) => a + s.n, 0) || 1;
  let offset = 0;
  return (
    <div className="prz-donut">
      <svg viewBox="0 0 150 150" width="150" height="150">
        <circle cx="75" cy="75" r={r} stroke="var(--surface-2)" strokeWidth="16" fill="none" />
        {segments.map((s) => {
          const len = (s.n / soma) * C;
          const el = (
            <circle
              key={s.label}
              cx="75"
              cy="75"
              r={r}
              stroke={s.color}
              strokeWidth="16"
              fill="none"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset + C / 4}
              transform="rotate(-90 75 75)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="prz-donut-center">
        <div className="prz-donut-n tabular">{total}</div>
        <div className="prz-donut-l">marcos</div>
      </div>
    </div>
  );
}

// ── Marcos · detalhe (busca + filtro + paginação) ───────────────────────────────────────────────
// A coluna "Trecho / Obra" foi REMOVIDA (spec v3 §C.5.1): a tabela de marcos por disciplina da
// fonte não tem essa coluna — o campo `trecho` do banco veio contaminado com os textos da tabela
// vizinha "Natureza do avanço" (fundidas na captura). No lugar, "Em execução (RDO)", que EXISTE
// na fonte (lida da seção C.5 via prazoC5, casada por nome de disciplina).
function MarcosDetalhe({
  marcos,
  corteISO,
  c5Disc,
}: {
  marcos: PrazoMarco[];
  corteISO: string | null;
  c5Disc: PrazoC5Disciplina[];
}) {
  const emExecPorDisc = useMemo(
    () => new Map(c5Disc.map((d) => [normTxt(d.disciplina), d.emExecucao])),
    [c5Disc],
  );
  const categorias = useMemo(
    () => ["TODAS", ...Array.from(new Set(marcos.map((m) => m.categoria ?? "—")))],
    [marcos],
  );
  // Contagem por categoria — o chip diz quantos marcos filtra ("Sinistros de Talude · 5"),
  // ninguém filtra no escuro.
  const catCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of marcos) {
      const k = m.categoria ?? "—";
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return c;
  }, [marcos]);
  const [cat, setCat] = useState("TODAS");
  const col = useColecao(marcos, {
    busca: (m) =>
      `${m.categoria ?? ""} ${emExecPorDisc.get(normTxt(m.categoria ?? "")) ?? ""} ${m.dataLimite ?? ""}`,
    filtro: (m) => cat === "TODAS" || (m.categoria ?? "—") === cat,
    ordenacoes: [
      {
        value: "data",
        label: "Data-limite",
        cmp: (a, b) => (a.dataLimite ?? "").localeCompare(b.dataLimite ?? ""),
      },
      {
        value: "status",
        label: "Status (risco 1º)",
        cmp: (a, b) => {
          const sev = (m: PrazoMarco) =>
            // chaves = labels REAIS do farolMarco (MARCO_STATUS_LABEL); "—" (pendente) fica acima
            // de No prazo/Cumprido — área cega não é "ok".
            ({ Atrasado: 3, "Em risco": 2, "—": 1, "No prazo": 0, Cumprido: 0 })[
              farolMarco(m.dataLimite, corteISO, m.pctConcluido).label
            ] ?? 0;
          return sev(b) - sev(a);
        },
      },
    ],
    perPage: 8,
    resetKey: cat,
  });
  if (marcos.length === 0) {
    return (
      <section className="prz-section">
        <EmptyState
          title="Marcos contratuais pendentes"
          text="Dependem do cronograma-fonte (.mpp R0/R1)."
        />
      </section>
    );
  }
  return (
    <section className="prz-section">
      <header className="prz-section-head">
        <div>
          <h3 className="prz-section-title">Marcos contratuais — detalhe</h3>
          <div className="prz-section-sub">
            {marcos.length} {marcos.length === 1 ? "marco" : "marcos"} · % concluído por marco ainda
            não medido (input por BM)
          </div>
        </div>
      </header>
      <div className="prz-chips">
        {categorias.map((c) => (
          <button
            key={c}
            type="button"
            className={`prz-chip${c === cat ? " on" : ""}`}
            onClick={() => setCat(c)}
          >
            {c} · {c === "TODAS" ? marcos.length : (catCount.get(c) ?? 0)}
          </button>
        ))}
      </div>
      {col.showToolbar ? <ColToolbar col={col} placeholder="Buscar marco / disciplina…" /> : null}
      <div className="prz-tabela prz-tabela-marcos" role="table">
        <div className="prz-tabela-head" role="row">
          <span role="columnheader">Categoria</span>
          <span role="columnheader">Em execução (RDO)</span>
          <span role="columnheader">Data-limite</span>
          <span className="r" role="columnheader">
            % concl.
          </span>
          <span role="columnheader">Farol</span>
        </div>
        {col.visible.length === 0 ? (
          col.debounced ? (
            <ColVazio termo={col.debounced} rotulo="marco" onClear={() => col.setQuery("")} />
          ) : (
            <div className="col-vazia">Nenhum marco nesta categoria.</div>
          )
        ) : (
          col.visible.map((m) => {
            const n = farolMarco(m.dataLimite, corteISO, m.pctConcluido);
            return (
              <div className="prz-tabela-row" role="row" key={m.ordem}>
                <span className="prz-cell-forte" role="cell">
                  {m.categoria ?? "—"}
                </span>
                <span role="cell">{emExecPorDisc.get(normTxt(m.categoria ?? "")) ?? "—"}</span>
                <span className="tabular" role="cell">
                  {formatBRDate(m.dataLimite)}
                </span>
                <span
                  className="r tabular prz-cell-pend"
                  role="cell"
                  title={
                    m.pctConcluido == null
                      ? "Medição por marco pendente — entra com o BM"
                      : undefined
                  }
                >
                  {m.pctConcluido != null ? fmtPct(m.pctConcluido, 0) : "—"}
                </span>
                <span role="cell">
                  <Badge tone={n.tone}>{n.label}</Badge>
                </span>
              </div>
            );
          })
        )}
      </div>
      <ColPag col={col} rotulo="marcos" />
    </section>
  );
}

// ── Atrasados por disciplina/frente ─────────────────────────────────────────────────────────────
function AtrasadosCard({ fisico, bmLabel }: { fisico: Fisico | null; bmLabel: string }) {
  // Por disciplina (todas) × por frente (apenas serviços, do cruzamento auxiliar_C.3) — toggle do
  // mockup. % conclusão dentro de cada grupo = previstoAcum/realAcum ÷ contratado. Frente bate o
  // oráculo (Trecho 01 = 6,56/1,70/−4,86).
  const [view, setView] = useState<"disc" | "frente">("disc");
  const temFrente = (fisico?.porFrente ?? []).length > 0;
  const base = view === "frente" && temFrente ? fisico?.porFrente : fisico?.porDisciplina;
  const linhas = useMemo(
    () => (base ?? []).filter((d) => d.prevPct != null || d.realPct != null),
    [base],
  );
  // Coleção canônica (CLAUDE.md: 5+ itens = busca/ordenação; 10+ = paginação) — mesmo padrão dos
  // marcos acima. Default mantém a leitura do mockup: pior Δ primeiro. resetKey zera a página ao
  // alternar Disciplina/Frente.
  const rotuloItem = view === "frente" ? "frente" : "disciplina";
  const col = useColecao(linhas, {
    busca: (d) => d.disciplina,
    ordenacoes: [
      { value: "delta", label: "Pior Δ (pp)", cmp: (a, b) => (a.deltaPp ?? 0) - (b.deltaPp ?? 0) },
      {
        value: "nome",
        label: "Nome (A–Z)",
        cmp: (a, b) => normTxt(a.disciplina).localeCompare(normTxt(b.disciplina)),
      },
      { value: "real", label: "% real", cmp: (a, b) => (b.realPct ?? -1) - (a.realPct ?? -1) },
    ],
    perPage: 8,
    resetKey: view,
  });
  return (
    <section className="prz-section">
      <header className="prz-section-head">
        <div>
          <h3 className="prz-section-title">
            O que está atrasado — por {view === "frente" ? "frente" : "disciplina"}
          </h3>
          <div className="prz-section-sub">% de conclusão dentro de cada grupo · {bmLabel}</div>
        </div>
        {temFrente ? (
          <div className="prz-gtoggle">
            <button
              type="button"
              className={view === "disc" ? "on" : ""}
              onClick={() => setView("disc")}
            >
              Disciplina
            </button>
            <button
              type="button"
              className={view === "frente" ? "on" : ""}
              onClick={() => setView("frente")}
            >
              Frente
            </button>
          </div>
        ) : null}
      </header>
      {linhas.length === 0 ? (
        <EmptyState title="Avanço por grupo pendente" text="Aguardando faturamento normalizado." />
      ) : (
        <>
          {col.showToolbar ? (
            <ColToolbar col={col} placeholder="Buscar disciplina ou frente…" />
          ) : null}
          <div className="prz-tabela prz-tabela-atr" role="table">
            <div className="prz-tabela-head" role="row">
              <span role="columnheader">
                {view === "frente" ? "Frente / Trecho" : "Disciplina"}
              </span>
              <span className="r" role="columnheader">
                % Prev.
              </span>
              <span className="r" role="columnheader">
                % Real
              </span>
              <span className="r" role="columnheader">
                Δ (pp)
              </span>
              <span role="columnheader">Status</span>
            </div>
            {col.visible.length === 0 ? (
              <ColVazio
                termo={col.debounced}
                rotulo={rotuloItem}
                artigo="Nenhuma"
                onClear={() => col.setQuery("")}
              />
            ) : (
              col.visible.map((d) => (
                <div className="prz-tabela-row" role="row" key={d.disciplina}>
                  <span className="prz-cell-forte" role="cell">
                    {d.disciplina}
                  </span>
                  <span className="r tabular" role="cell">
                    {fmtPct(d.prevPct)}
                  </span>
                  <span className="r tabular" role="cell">
                    {fmtPct(d.realPct)}
                  </span>
                  <span
                    className={`r tabular ${(d.deltaPp ?? 0) < 0 ? "prz-neg" : (d.deltaPp ?? 0) > 0 ? "prz-pos" : ""}`}
                    role="cell"
                  >
                    {fmtPp(d.deltaPp)}
                  </span>
                  <span role="cell">
                    {d.farol ? <Badge tone={d.farol.tone}>{d.farol.label}</Badge> : "—"}
                  </span>
                </div>
              ))
            )}
          </div>
          <ColPag col={col} rotulo={view === "frente" ? "frentes" : "disciplinas"} />
        </>
      )}
      <p className="prz-obs">
        % de conclusão DENTRO de cada grupo (não % do total). Δ em pontos percentuais (real −
        previsto).
      </p>
      <FarolLegenda />
    </section>
  );
}

// Windows Analysis saiu da tela por decisão do idealizador (spec 4.5): sem cronograma .mpp
// importado não há caminho crítico documentado — o bloco volta condicionado ao dado existir.
// "Natureza do avanço" (spec v3 §C.5.2) é a COMPOSIÇÃO do avanço medido (4 fatias + TOTAL) — a
// tabela da fonte NÃO é por disciplina (a versão anterior colava natureza×disciplina porque a
// captura fundiu as duas tabelas vizinhas). O "Achado" é texto de leitura, fora da tabela.
function NaturezaAvanco({
  naturezas,
  totalRs,
  achado,
}: {
  naturezas: PrazoC5Natureza[];
  totalRs: number | null;
  achado: string | null;
}) {
  if (naturezas.length === 0) return null;
  const fmtPctMedido = (v: number | null) =>
    v != null
      ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : "—";
  return (
    <section className="prz-section">
      <header className="prz-section-head">
        <div>
          <h3 className="prz-section-title">Natureza do avanço</h3>
          <div className="prz-section-sub">
            composição do avanço medido · {naturezas.length} naturezas · fonte C.5
          </div>
        </div>
      </header>
      <div className="prz-tabela prz-tabela-nat" role="table">
        <div className="prz-tabela-head" role="row">
          <span role="columnheader">Natureza</span>
          <span className="r" role="columnheader">
            Valor medido (R$)
          </span>
          <span className="r" role="columnheader">
            % do medido
          </span>
        </div>
        {naturezas.map((f) => (
          <div className="prz-tabela-row" role="row" key={f.natureza}>
            <span className="prz-cell-forte" role="cell">
              {f.natureza}
            </span>
            <span className="r tabular" role="cell">
              {formatBRL(f.valorRs)}
            </span>
            <span className="r tabular" role="cell">
              {fmtPctMedido(f.pctDoMedido)}
            </span>
          </div>
        ))}
        {totalRs != null ? (
          <div className="prz-tabela-row prz-nat-total" role="row">
            <span className="prz-cell-forte" role="cell">
              TOTAL medido
            </span>
            <span className="r tabular" role="cell">
              {formatBRL(totalRs)}
            </span>
            <span className="r tabular" role="cell">
              100,0%
            </span>
          </div>
        ) : null}
      </div>
      {achado ? (
        <p className="prz-obs">
          <strong>Leitura:</strong> {achado}
        </p>
      ) : null}
    </section>
  );
}

// Legenda do farol do desvio físico — mora no rodapé do AtrasadosCard (a única tabela que usa esse
// farol além do deck). Faixas espelham FAROL_FISICO_PP sem ambiguidade de limite: cada faixa inclui
// o próprio piso (≥), então −5 é Observação e −15 é Risco — exatamente como o código decide.
function FarolLegenda() {
  return (
    <div className="prz-farol-leg">
      <span className="prz-farol-leg-titulo">Farol do desvio físico (pp, real − previsto):</span>
      <span>
        <span className="prz-dot" style={{ background: "var(--success)" }} /> Conforme ≥ −1
      </span>
      <span>
        <span className="prz-dot" style={{ background: "var(--info)" }} /> Observação de −1 a −5
        (incl.)
      </span>
      <span>
        <span className="prz-dot" style={{ background: "var(--warning)" }} /> Risco de −5 a −15
        (incl.)
      </span>
      <span>
        <span className="prz-dot" style={{ background: "var(--danger)" }} /> Crítico abaixo de −15
      </span>
    </div>
  );
}

// ── Análise IA (ancorada nos dados) ─────────────────────────────────────────────────────────────
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function AnaliseCard({
  fisico,
  prazo,
  bmLabel,
}: {
  fisico: Fisico;
  prazo: PrazoBM;
  bmLabel: string;
}) {
  const crit = fisico.porDisciplina
    .filter((d) => d.farol && (d.farol.tone === "danger" || d.farol.tone === "warning"))
    .sort((a, b) => (a.deltaPp ?? 0) - (b.deltaPp ?? 0))
    .slice(0, 3)
    .map((d) => `${d.disciplina} (${d.farol!.label})`)
    .join(", ");
  // narrativa do ritmo CONDICIONAL à relação real (mesma regra ritmoAbaixo do Deck — a análise
  // não pode afirmar "abaixo do necessário" quando o ritmo já cobre).
  const fmtRitmoTx = (v: number | null) =>
    v != null ? `${v.toFixed(2).replace(".", ",")}%/mês` : "—";
  const fraseRitmo = (rec: number | null, nec: number | null) =>
    rec != null && nec != null
      ? rec < nec
        ? ` o ritmo recente (${fmtRitmoTx(rec)}) está abaixo do necessário (${fmtRitmoTx(nec)}) por ser fase de mobilização, não perda de produtividade.`
        : ` o ritmo recente (${fmtRitmoTx(rec)}) já cobre o necessário (${fmtRitmoTx(nec)}).`
      : ` ritmo recente ${fmtRitmoTx(rec)} · necessário ${fmtRitmoTx(nec)}.`;
  const texto =
    `Obra no ${bmLabel} (${fmtPct(prazo.decorridoPct, 1)} do prazo). O avanço físico real é de ` +
    `**${fmtPct(fisico.realOverallPct)}** contra **${fmtPct(fisico.prevOverallPct)}** previsto — atraso de ` +
    `**${fmtPp(fisico.atrasoPp)}** (${fisico.farol?.label ?? "—"} no agregado). ` +
    (crit ? `As disciplinas que mais puxam o atraso: ${crit}. ` : "") +
    `A projeção de término ainda está suprimida (estabiliza após ~20% do prazo decorrido);${fraseRitmo(fisico.ritmoRecMes, fisico.ritmoNecMes)}`;
  return (
    <section className="prz-section">
      <div className="prz-analise-tag">
        {I.note({ size: 12 })} ANÁLISE DE PRAZO · ADM CONTRATUAL IA
      </div>
      <p className="prz-analise-texto">
        <FormattedText text={texto} />
      </p>
    </section>
  );
}

// ── Calc de impacto de extensão ─────────────────────────────────────────────────────────────────
function CalcExtensao({
  contractId,
  admLocalMensal,
}: {
  contractId: string;
  admLocalMensal: number | null;
}) {
  const [meses, setMeses] = useState(1);
  const bdiPrazo = BDI_PRAZO_MENSAL[contractId] ?? null;
  const mensal = admLocalMensal != null ? admLocalMensal + (bdiPrazo ?? 0) : null;
  const total = mensal != null ? mensal * Math.max(0, meses) : null;
  return (
    <section className="prz-calc">
      <div className="prz-calc-head">
        {I.clock({ size: 14 })} Impacto estimado da extensão
        <span className="prz-calc-sub">· conforme a apuração vigente · atualiza a cada BM</span>
      </div>
      <div className="prz-calc-row">
        <div className="prz-calc-in">
          Atraso{" "}
          <input
            type="number"
            min={0}
            step={1}
            value={meses}
            onChange={(e) => setMeses(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
          />{" "}
          meses
        </div>
        <div className="prz-calc-eq">
          × <strong>{fmtMi(mensal)}/mês</strong>{" "}
          <span className="prz-calc-bd">
            (Adm Local {fmtMi(admLocalMensal)}
            {bdiPrazo != null ? ` + BDI-prazo ${fmtMi(bdiPrazo)}` : " + BDI-prazo a normalizar"})
          </span>
        </div>
        <div className="prz-calc-tot">
          Impacto estimado: <strong>{fmtMi(total)}</strong>
        </div>
      </div>
      <p className="prz-calc-nota">
        Custos de tempo que correm por mês de prorrogação: Adm Local mobilizada (D.1) + verbas de
        prazo do BDI (D.2 · Adm Central, garantias, seguros). A improdutividade de MOD/EQP é apurada
        à parte (perda única) na D.4.
        {bdiPrazo == null ? " BDI-prazo/mês pende de normalização (D.2 G12)." : ""}
      </p>
    </section>
  );
}
