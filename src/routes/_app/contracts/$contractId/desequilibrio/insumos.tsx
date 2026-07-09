// D.5 — Reajuste e reequilíbrio dos insumos (v53 · cláusulas 6.2 + 8.8).
// SUBSTITUIÇÃO COMPLETA (Prompt_Devs_C06_D05_Insumos §0): dois mecanismos independentes —
// M1 Reajuste geral (IPCA sobre o saldo a executar = contrato CHEIO − medido, ⚠️ não usar a
// base de medição) com 3 cenários de data-base clicáveis; M2 Reequilíbrio dos insumos FD
// (mesma tabela multifonte da C.6, mesmo motor). O repasse real do M2 alimenta a D.0 como
// repasse direto à medição (fora do teto pleiteável). Layout 1:1 com D05_Insumos_BR101.html;
// números do Excel v53 (§9: M1 proposta 25.217.803,73 · repasse 10.246,94 · potencial 977.825).
//
// Refino UX Desequilíbrio (Onda 3 · próprio da D.5): (1) snapshot no topo com os KPIs-resposta do
// JTBD antes das faixas de texto; (2) gráfico da trajetória do IPCA (nº-índice) marcando as
// datas-base dos cenários M1; (3) memória de cálculo do M1 auditável — P decomposto em contrato
// cheio − medido com guard de reconciliação (<0,01); (4) linkbox de reconciliação com a D.0.

import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Banknote, Pencil, Percent, TrendingUp } from "lucide-react";

import {
  CHART_SERIE_COR,
  ChartLegend,
  ChartTooltip,
  EmptyState,
  ErroCard,
  Skeleton,
} from "@/components/ds";
import {
  CardsInsumosFd,
  PresetsInsumosFd,
  TabelaMultifonte,
  ValorLive,
  fmtBRL0,
  fmtBRL2,
  fmtNum,
  fmtPotencial,
  listaCap,
  mesCurtoIso,
  mesLongoIso,
  useSelecaoInsumosFd,
} from "@/components/InsumosFd/InsumosFdShared";
import { useInsumosFd } from "@/lib/hooks/useInsumosFd";
import { useObra } from "@/lib/hooks/useObra";
import { useSinteseContrato } from "@/lib/hooks/useSinteseContrato";
import { linhaCalc, m1Calc, type CenarioM1, type InsumosFd } from "@/lib/supabase/insumosFd";

import "./insumos.css";

export const Route = createFileRoute("/_app/contracts/$contractId/desequilibrio/insumos")({
  component: InsumosD5Page,
  head: () => ({ meta: [{ title: "3.7 Preço de Insumos (D.5) — RDM IA" }] }),
});

const fmtPct3Sinal = (frac: number) =>
  `${frac > 0 ? "+" : ""}${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
const fmtPct3 = (frac: number) =>
  `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
const fmtDataBr = (iso: string | null) => {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

// ── Gráfico · trajetória do IPCA (número-índice) com as datas-base dos cenários M1 ─────────────
// Plota a série JÁ CARREGADA (dados.serieIpca) — nenhum cálculo/agregação novo no front. Os
// ReferenceDot marcam os I₀ candidatos (cenariosM1) e o I atual (reeq.ipcaAtual), todos valores
// vindos da mesma normalização v53. Clicar num card de cenário destaca o dot correspondente.
function GraficoIpcaM1({ dados, cenAtivo }: { dados: InsumosFd; cenAtivo: CenarioM1 | undefined }) {
  const serie = dados.serieIpca;
  if (serie.length < 2) return null; // sem trajetória plotável — os cards/memória bastam
  const linhas = serie.map((s) => ({ rotulo: mesCurtoIso(s.mes) ?? s.mes, indice: s.indice }));
  const rotuloDe = (mes: string) => mesCurtoIso(mes) ?? mes;
  const mesAtual = serie.at(-1)?.mes ?? null;
  return (
    <div className="ifd-panel" style={{ marginTop: "var(--s-3)" }}>
      <div className="ifd-hint" style={{ margin: "0 0 8px" }}>
        Trajetória do <b>IPCA (número-índice · IBGE)</b> desde a data-base mais antiga. Cada ponto
        marcado é uma <b>data-base candidata</b> (I₀) do reajuste; o cenário ativo aparece
        destacado. Quanto mais cedo a data-base, maior a inflação acumulada até o I atual — é por
        isso que a diferença entre as candidatas chega a milhões.
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={linhas} margin={{ top: 14, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="rotulo"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
              width={54}
              tickFormatter={(v: number) => fmtNum(v, 0)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  nomes={{ indice: "IPCA (nº-índice)" }}
                  formatter={(v: number) => fmtNum(v, 2)}
                />
              }
            />
            <Line
              dataKey="indice"
              name="IPCA (nº-índice)"
              stroke={CHART_SERIE_COR.real}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
            {dados.cenariosM1.map((c) => {
              const on = c.id === (cenAtivo?.id ?? "");
              return (
                <ReferenceDot
                  key={c.id}
                  x={rotuloDe(c.mes)}
                  y={c.i0}
                  r={on ? 6 : 4}
                  fill={on ? "var(--brand)" : "var(--info)"}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                  label={
                    on
                      ? {
                          value: `${c.nome} (I₀)`,
                          position: "top",
                          style: { fontSize: 10, fill: "var(--brand-700)", fontWeight: 600 },
                        }
                      : undefined
                  }
                />
              );
            })}
            {mesAtual != null && (
              <ReferenceDot
                x={rotuloDe(mesAtual)}
                y={dados.reeq.ipcaAtual}
                r={5}
                fill={CHART_SERIE_COR.real}
                stroke="var(--surface)"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{
                  value: "I atual",
                  position: "top",
                  style: { fontSize: 10, fill: "var(--text-2)", fontWeight: 600 },
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        className="d5-chartlegend"
        items={[
          { label: "IPCA (número-índice · IBGE)", tipo: "linha", cor: CHART_SERIE_COR.real },
          { label: "data-base candidata (I₀)", tipo: "dot", cor: "var(--info)" },
          { label: "cenário ativo", tipo: "dot", cor: "var(--brand)" },
        ]}
      />
    </div>
  );
}

// ── Memória de cálculo do M1 (auditável para o Pleito) ─────────────────────────────────────────
// P = reeq.saldoAExecutar (o valor que a fórmula REALMENTE usa via m1Calc). A decomposição em
// contrato cheio − medido é apresentada como COMPONENTES; o "=" que a liga ao saldo só é impresso
// quando o guard de reconciliação fecha (<0,01, valores BRUTOS). Nunca substituímos o saldo
// canônico por uma subtração própria — se divergir, a memória revela em vez de mentir.
function MemoriaM1({ dados, cenAtivo }: { dados: InsumosFd; cenAtivo: CenarioM1 }) {
  const { reeq, serieIpca } = dados;
  const { variacao, reajuste } = m1Calc(reeq, cenAtivo);
  const mesIpcaAtual = serieIpca.at(-1)?.mes ?? null;
  const cheioMenosMedido = reeq.contratoCheioBdi - reeq.medidoAcumulado;
  const decomposicaoFecha = Math.abs(cheioMenosMedido - reeq.saldoAExecutar) < 0.01;
  return (
    <div className="d5-memo">
      <div className="d5-memo-hd">
        Memória de cálculo — cenário <b>{cenAtivo.nome}</b> ({cenAtivo.desc})
      </div>
      <div className="d5-memo-terms">
        <div className="d5-memo-term">
          <span className="k">I — IPCA {mesLongoIso(mesIpcaAtual) ?? "atual"}</span>
          <span className="v">{fmtNum(reeq.ipcaAtual, 2)}</span>
        </div>
        <div className="d5-memo-term">
          <span className="k">I₀ — IPCA {mesLongoIso(cenAtivo.mes) ?? cenAtivo.nome}</span>
          <span className="v">{fmtNum(cenAtivo.i0, 2)}</span>
        </div>
        <div className="d5-memo-term">
          <span className="k">P — saldo a executar</span>
          <span className="v">
            {decomposicaoFecha ? (
              <>
                contrato cheio {fmtBRL2(reeq.contratoCheioBdi)} − medido{" "}
                {fmtBRL2(reeq.medidoAcumulado)} = <b>{fmtBRL2(reeq.saldoAExecutar)}</b>
              </>
            ) : (
              <b>{fmtBRL2(reeq.saldoAExecutar)}</b>
            )}
          </span>
        </div>
      </div>
      {!decomposicaoFecha && (
        <div className="d5-memo-warn">
          Contrato cheio − medido ({fmtBRL2(cheioMenosMedido)}) diverge do saldo a executar
          armazenado ({fmtBRL2(reeq.saldoAExecutar)}). A fórmula usa o saldo armazenado (fonte
          canônica); a decomposição fica suspensa até a normalização reconciliar.
        </div>
      )}
      <div className="d5-memo-formula">
        R = [(I − I₀) × P] / I₀ = [({fmtNum(reeq.ipcaAtual, 2)} − {fmtNum(cenAtivo.i0, 2)}) ×{" "}
        {fmtBRL2(reeq.saldoAExecutar)}] / {fmtNum(cenAtivo.i0, 2)} = <b>{fmtBRL2(reajuste)}</b>
      </div>
      <div className="d5-memo-sub">
        Variação do IPCA de <b>{fmtPct3Sinal(variacao)}</b> sobre o saldo a executar (cláusula 6.2).
      </div>
    </div>
  );
}

// ── Mecanismo 1 · cards de cenário + gráfico do IPCA + memória de cálculo ───────────────────────
// Estado do cenário ativo é ELEVADO à tela (controlado por props) — o snapshot do topo precisa do
// reajuste do cenário selecionado, então a fonte da verdade não pode ficar presa neste componente.
function MecanismoUm({
  dados,
  cenAtivo,
  onAtivo,
}: {
  dados: InsumosFd;
  cenAtivo: CenarioM1 | undefined;
  onAtivo: (id: string) => void;
}) {
  const cenarios = dados.cenariosM1;
  const mesIpcaAtual = dados.serieIpca.at(-1)?.mes ?? null;
  return (
    <>
      <div className="d5-mecbar" id="d5-m1">
        <div className="num">1</div>
        <div className="tt">Reajuste geral — IPCA · escolha a data-base</div>
      </div>
      <div className="ifd-hint">
        A data-base define desde quando a inflação é medida. Há três candidatas, e a diferença é
        grande. Fórmula: <b>R = [(I − I₀) × P] / I₀</b>, com P = saldo a executar (
        <b>{fmtBRL2(dados.reeq.saldoAExecutar)}</b> = contrato cheio − medido acumulado) e I = IPCA
        de{" "}
        {/* rótulo = último mês da série IPCA; o VALOR (reeq.ipcaAtual) vem da mesma normalização
            v53 — se as tabelas dessincronizarem, o gate da normalização acusa antes da UI. */}
        {mesLongoIso(mesIpcaAtual) ?? "referência atual"}.
      </div>
      <div className="d5-m1cards">
        {cenarios.map((c) => {
          const { variacao, reajuste } = m1Calc(dados.reeq, c);
          const on = c.id === (cenAtivo?.id ?? "");
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              className={`d5-m1card${on ? " on" : ""}`}
              onClick={() => onAtivo(c.id)}
            >
              <div className="mc-t">{c.nome}</div>
              <div className="mc-d">{c.desc}</div>
              <div className="mc-v">
                I₀ {fmtNum(c.i0, 2)} → I {fmtNum(dados.reeq.ipcaAtual, 2)}
              </div>
              <div className="mc-v">variação {fmtPct3Sinal(variacao)}</div>
              <div className="mc-r">{fmtBRL0(reajuste)}</div>
            </button>
          );
        })}
      </div>
      <GraficoIpcaM1 dados={dados} cenAtivo={cenAtivo} />
      {cenAtivo && <MemoriaM1 dados={dados} cenAtivo={cenAtivo} />}
    </>
  );
}

// ── tela ──────────────────────────────────────────────────────────────────────
function InsumosD5Page() {
  const { contractId } = Route.useParams();
  const q = useInsumosFd(contractId);
  const sel = useSelecaoInsumosFd(q.data);
  // cenário M1 ativo elevado à tela (null = usa o oficial do banco reeq.cenarioM1Ativo)
  const [cenarioM1Ativo, setCenarioM1Ativo] = useState<string | null>(null);
  // identificador do contrato derivado (mesma fonte da C.6): síntese C.1 → nome interno → "—"
  const { data: obra } = useObra(contractId);
  const { data: sintese } = useSinteseContrato(contractId);
  const contratoLabel =
    [sintese?.identificacaoLegal?.["Nº do Contrato"], sintese?.documentos?.contratoInterno]
      .filter(Boolean)
      .join(" · ") ||
    obra?.nome_interno ||
    "—";

  if (q.isLoading) {
    return (
      <main className="page d5-page">
        <Skeleton style={{ height: 120, marginBottom: 16 }} />
        <Skeleton style={{ height: 220, marginBottom: 16 }} />
        <Skeleton style={{ height: 480 }} />
      </main>
    );
  }
  if (q.isError) {
    return (
      <main className="page d5-page">
        <ErroCard
          mensagem={String((q.error as Error)?.message ?? "Falha de leitura")}
          onRetry={() => void q.refetch()}
        />
      </main>
    );
  }
  const dados = q.data;
  if (!dados) {
    return (
      <main className="page d5-page">
        <EmptyState
          framed
          title="Insumos v53 ainda não normalizados"
          text="As tabelas obra_insumos_fd desta obra estão vazias — rode a normalização do workbook v53."
        />
      </main>
    );
  }

  const medidos = dados.insumos.filter((x) => x.valorMedidoBdi > 0).map((x) => x.nome);
  // insumo que domina o potencial NA SELEÇÃO ATUAL (deriva, não chumba — era "CBUQ" fixo)
  let dominantePotencial: string | null = null;
  let maxPotencial = 0;
  for (const i of dados.insumos) {
    const { potencial } = linhaCalc(i, sel.selecao);
    if (potencial > maxPotencial) {
      maxPotencial = potencial;
      dominantePotencial = i.nome;
    }
  }
  // cenário M1 ativo resolvido (simulação local ?? oficial do banco) + reajuste correspondente
  const ativoId = cenarioM1Ativo ?? dados.reeq.cenarioM1Ativo;
  const cenAtivo: CenarioM1 | undefined =
    dados.cenariosM1.find((c) => c.id === ativoId) ?? dados.cenariosM1[0] ?? undefined;
  const m1Reajuste = cenAtivo ? m1Calc(dados.reeq, cenAtivo).reajuste : 0;

  return (
    <main className="page d5-page">
      <h2 className="c6-titulo">Reajuste e reequilíbrio dos insumos</h2>
      <div className="c6-sub">
        Contrato: <b>{contratoLabel}</b> &nbsp;·&nbsp; OS: <b>{fmtDataBr(dados.reeq.dataOs)}</b>{" "}
        &nbsp;·&nbsp; Verificação reequilíbrio: <b>{fmtDataBr(dados.reeq.dataVerificacaoReeq)}</b>{" "}
        &nbsp;
        <span className="c6-pill">
          <span className="d5-pill-dot" aria-hidden /> valores c/ BDI
        </span>
      </div>

      {/* snapshot no topo: os números-resposta do JTBD antes de qualquer faixa de texto (refino UX).
          Cada card ancora à sua seção. Valores JÁ carregados/derivados — nenhum sai do lugar. */}
      <div className="d5-snapshot">
        <a className="d5-snap" href="#d5-m1">
          <div className="d5-snap-top">
            <span className="d5-snap-chip">
              <Percent size={16} aria-hidden />
            </span>
            <span className="d5-snap-l">M1 · Reajuste (cenário ativo)</span>
          </div>
          <div className="d5-snap-v">
            <ValorLive>{fmtBRL0(m1Reajuste)}</ValorLive>
          </div>
          <div className="d5-snap-s">
            {cenAtivo ? `IPCA · data-base ${cenAtivo.nome}` : "—"} · sobre o saldo a executar
          </div>
        </a>
        <a className="d5-snap" href="#d5-m2">
          <div className="d5-snap-top">
            <span className="d5-snap-chip">
              <Banknote size={16} aria-hidden />
            </span>
            <span className="d5-snap-l">M2 · Repasse real (→ D.0)</span>
          </div>
          <div className="d5-snap-v">
            <ValorLive>{fmtBRL2(sel.totais.repasseReal)}</ValorLive>
          </div>
          <div className="d5-snap-s">
            {medidos.length > 0 ? `medido · ${listaCap(medidos)}` : "sem medição até o corte"} ·
            fora do teto
          </div>
        </a>
        <a className="d5-snap" href="#d5-m2">
          <div className="d5-snap-top">
            <span className="d5-snap-chip">
              <TrendingUp size={16} aria-hidden />
            </span>
            <span className="d5-snap-l">M2 · Potencial (se tudo medido)</span>
          </div>
          <div className="d5-snap-v">
            <ValorLive>{fmtPotencial(sel.totais.potencial)}</ValorLive>
          </div>
          <div className="d5-snap-s">excedente × valor contratado</div>
        </a>
      </div>

      <div className="ifd-srcinfo">
        Dois mecanismos independentes. <b>M1 — Reajuste geral</b> (cláusula 6.2): todos os preços, a
        cada 12 meses, pelo IPCA. <b>M2 — Reequilíbrio</b> (cláusula 8.8): só os insumos de
        faturamento direto, por índices específicos, sendo o <b>IPCA a linha divisória</b> — o que
        varia até o IPCA a contratada absorve; o excedente a contratante paga. Os índices do M2 são
        os mesmos da tela de insumos (C.6), multifonte.
      </div>

      <MecanismoUm dados={dados} cenAtivo={cenAtivo} onAtivo={setCenarioM1Ativo} />

      <div className="d5-mecbar" id="d5-m2">
        <div className="num">2</div>
        <div className="tt">Reequilíbrio dos insumos — índices multifonte (= C.6)</div>
      </div>
      <PresetsInsumosFd
        hintIntro={
          <>
            Cada insumo de faturamento direto tem várias fontes de índice (SINAPI, SBC, EMOP, SCO,
            DNIT, ANP). Escolha a base por insumo ou use um preset. O <b>excedente</b> sobre o IPCA
            (<span className="d5-hot">{fmtPct3(dados.reeq.ipcaPeriodo)}</span>) é o que gera
            repasse. <span className="ifd-recdot" /> = sugestão da IA.
          </>
        }
        presetAtivo={sel.presetAtivo}
        onPreset={sel.aplicar}
      />
      <CardsInsumosFd
        totalFdBdi={dados.totalFdBdi}
        totais={sel.totais}
        repasseTitulo="Repasse M2 real (medido)"
        potencialTitulo="Potencial M2 (se tudo medido)"
        nInsumos={dados.insumos.length}
        repasseSub={
          medidos.length > 0 ? `${listaCap(medidos)} · c/ BDI` : "sem medição até o corte"
        }
      />

      <div className="ifd-secttl">Tabela M2 — reequilíbrio por insumo (c/ BDI)</div>
      <TabelaMultifonte
        dados={dados}
        selecao={sel.selecao}
        totais={sel.totais}
        onTrocarFonte={sel.trocarFonte}
        colunaOsLabel={dados.reeq.dataOs ? `OS ${mesCurtoIso(dados.reeq.dataOs)}` : "OS"}
        colunaAtualLabel={mesCurtoIso(dados.reeq.dataVerificacao) ?? "atual"}
        nota={
          <>
            <b>Excedente</b> = Δ% − IPCA ({fmtPct3(dados.reeq.ipcaPeriodo)}). <b>Repasse real</b> =
            excedente × valor medido (cláusula 6.2.3;{" "}
            {medidos.length > 0 ? `só ${listaCap(medidos)} até o corte` : "sem medição até o corte"}
            ); <b>Potencial</b> = excedente × valor contratado. O <b>total medido</b> hoje é{" "}
            {fmtBRL0(dados.totalMedidoBdi)}
            {dominantePotencial ? <> e o potencial é dominado por {dominantePotencial}</> : null}.
          </>
        }
      />

      {/* reconciliação com a âncora D.0 (o elo seguinte da cadeia C.6 → D.5 → D.0): o repasse M2
          real vira lançamento na D.0, fora do teto pleiteável. Valor JÁ carregado do motor. */}
      <div className="c6-linkbox">
        <div className="lt">
          O <b>repasse M2 real</b> (com as quantidades já medidas) vira lançamento na tela{" "}
          <b>D.0</b> — faturamento direto <b>fora do teto pleiteável</b>.
        </div>
        <div className="lv">
          <div className="it">
            <div className="il">Repasse M2 real</div>
            <div className="iv">
              <ValorLive>{fmtBRL2(sel.totais.repasseReal)}</ValorLive>
            </div>
          </div>
          <Link to="/contracts/$contractId/desequilibrio" params={{ contractId }} className="go">
            Abrir D.0 <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="c6-chat">
        <div className="ch">
          <div className="ia">
            <span className="badge">IA · Adm Contratual</span>
            <b>Leitura do reequilíbrio</b>
          </div>
          <span className="edit">
            <Pencil size={12} /> editar
          </span>
        </div>
        <p>
          O M2 usa os mesmos índices multifonte da C.6. Alterne a base de cada insumo ou use os
          presets. O <b>melhor cenário</b> empilha as fontes mais agressivas (teto do pleito); em
          arbitragem cada escolha precisa se sustentar sozinha —{" "}
          {dominantePotencial ?? "o insumo que domina o potencial"}, em especial, exige que a fonte
          escolhida se sustente frente a índices a 0% do outro lado.
        </p>
      </div>
    </main>
  );
}
