// Blocos COMPARTILHADOS das telas C.6 Insumos e D.5 Insumos (v53 · mesma tabela, mesmos números —
// Prompt_Devs_C06_D05_Insumos §1). Presets, 4 KPI live, tabela multifonte com visão ABC/Ordem da PQ
// e rodapé "✓ bate com a PQ". A seleção de fonte por insumo vive na TELA (useSelecaoInsumosFd) e
// desce por props — os totais recalculam em tempo real via o motor puro de insumosFd.ts.
// Fidelidade: mockups mandam no layout; adaptações mandatórias do DS: lucide no lugar de emoji,
// KPI com chip tingido (sem tarja de borda — regra do projeto).

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  BarChart3,
  Banknote,
  Check,
  ClipboardList,
  ListOrdered,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { ColPag, ColToolbar, ColVazio, useColecao, type Ordenacao } from "@/lib/rma/colecao";
import {
  LIMIAR_EXCEDENTE,
  aplicarPreset,
  fonteSelecionada,
  linhaCalc,
  selecaoRecomendada,
  totaisDe,
  type InsumoFd,
  type InsumosFd,
  type PresetId,
  type SelecaoFontes,
  type TotaisInsumos,
} from "@/lib/supabase/insumosFd";

import "./insumos-fd.css";

// ── formatadores (PT-BR · tabular) ────────────────────────────────────────────
export const fmtBRL2 = (n: number | null | undefined) =>
  n != null && Number.isFinite(n)
    ? `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
export const fmtBRL0 = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? `R$ ${Math.round(n).toLocaleString("pt-BR")}` : "—";
export const fmtMi2 = (n: number | null | undefined) =>
  n != null && Number.isFinite(n)
    ? `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
    : "—";
export const fmtNum = (n: number | null | undefined, d = 2) =>
  n != null && Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
export const fmtPctSinal = (frac: number | null | undefined, d = 2) =>
  frac != null && Number.isFinite(frac)
    ? `${frac > 0 ? "+" : ""}${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`
    : "—";
/** Potencial grande vira "R$ X,XX mi" (rodapé/cards do mockup). */
export const fmtPotencial = (n: number) => (n > 1e6 ? fmtMi2(n) : fmtBRL0(n));

// ── datas ISO → PT-BR (deriva rótulos de marco/corte do read-model, sem literal chumbado) ─────
const MES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-05-31" | "2026-05" → "mai/26" (inválido → null). */
export const mesCurtoIso = (iso: string | null | undefined): string | null => {
  if (!iso || iso.length < 7) return null;
  const m = Number(iso.slice(5, 7));
  return m >= 1 && m <= 12 ? `${MES_PT[m - 1]}/${iso.slice(2, 4)}` : null;
};
/** "2026-05-31" | "2026-05" → "mai/2026" (inválido → null). */
export const mesLongoIso = (iso: string | null | undefined): string | null => {
  if (!iso || iso.length < 7) return null;
  const m = Number(iso.slice(5, 7));
  return m >= 1 && m <= 12 ? `${MES_PT[m - 1]}/${iso.slice(0, 4)}` : null;
};
/** "2026-05-31" → "31/05/2026" (inválido → null). */
export const fmtDataBrIso = (iso: string | null | undefined): string | null =>
  iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null;
/** Lista PT-BR: ["a","b","c"] → "a, b e c". */
export const listaPt = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "—") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
/** listaPt com teto: acima de `max` nomes vira "a, b e c +N" (sub de KPI não pode virar parágrafo). */
export const listaCap = (xs: string[], max = 3): string =>
  xs.length <= max ? listaPt(xs) : `${listaPt(xs.slice(0, max))} +${xs.length - max}`;
/** Nome curto do insumo p/ narrativa: 1º token significativo em minúscula ("CBUQ - MASSA…" → "CBUQ"). */
export const nomeCurtoInsumo = (nome: string): string => {
  const t = nome.split(/[\s—–-]+/).filter(Boolean)[0] ?? nome;
  return t.length > 2 && t === t.toUpperCase() ? t : nome.slice(0, 18);
};

// ── estado compartilhado (seleção + preset ativo) ─────────────────────────────
export function useSelecaoInsumosFd(dados: InsumosFd | null | undefined) {
  const [sel, setSel] = useState<SelecaoFontes | null>(null);
  const [preset, setPreset] = useState<PresetId | null>("rec");
  useEffect(() => {
    if (dados && sel === null) setSel(selecaoRecomendada(dados.insumos));
  }, [dados, sel]);
  const selecao = sel ?? (dados ? selecaoRecomendada(dados.insumos) : {});
  const totais: TotaisInsumos = dados
    ? totaisDe(dados.insumos, selecao)
    : { acimaDoIpca: 0, repasseReal: 0, potencial: 0 };
  return {
    selecao,
    totais,
    presetAtivo: preset,
    trocarFonte: (ordemAbc: number, fonteId: string) => {
      setSel({ ...selecao, [ordemAbc]: fonteId });
      setPreset(null);
    },
    aplicar: (p: PresetId) => {
      if (!dados) return;
      setSel(aplicarPreset(dados.insumos, p));
      setPreset(p);
    },
  };
}

// ── valor "live" com flash ao mudar (mockup .flash) ───────────────────────────
export function ValorLive({ children, className }: { children: string; className?: string }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(children);
  useEffect(() => {
    if (prev.current !== children) {
      prev.current = children;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 350);
      return () => clearTimeout(t);
    }
  }, [children]);
  return <span className={`${className ?? ""}${flash ? " ifd-flash" : ""}`}>{children}</span>;
}

// ── presets (5 botões + hints · texto exato do mockup) ────────────────────────
export function PresetsInsumosFd({
  hintIntro,
  presetAtivo,
  onPreset,
}: {
  /** Texto de introdução acima dos botões (varia C.6/D.5). */
  hintIntro: ReactNode;
  presetAtivo: PresetId | null;
  onPreset: (p: PresetId) => void;
}) {
  const cls = (p: PresetId, extra = "") =>
    `ifd-preset${extra ? ` ${extra}` : ""}${presetAtivo === p ? " on" : ""}`;
  return (
    <>
      <div className="ifd-hint" style={{ margin: 0 }}>
        {hintIntro}
      </div>
      <div className="ifd-presets" role="group" aria-label="Presets de base de índice">
        <button type="button" className={cls("mercado")} onClick={() => onPreset("mercado")}>
          Tudo mercado
        </button>
        <button type="button" className={cls("dnit")} onClick={() => onPreset("dnit")}>
          Tudo DNIT
        </button>
        <button type="button" className={cls("rec")} onClick={() => onPreset("rec")}>
          Recomendado (por insumo) <span className="ifd-recdot" />
        </button>
        <button type="button" className={cls("melhor", "best")} onClick={() => onPreset("melhor")}>
          <TrendingUp size={13} aria-hidden /> Melhor cenário
        </button>
        <button type="button" className={cls("pior", "worst")} onClick={() => onPreset("pior")}>
          <TrendingDown size={13} aria-hidden /> Pior cenário
        </button>
      </div>
      <div className="ifd-presethint">
        “Melhor / pior cenário” = para cada insumo, a base de <b>maior</b> / <b>menor</b> Δ% (teto e
        piso do repasse possível). Não é recomendação — é o intervalo entre as fontes.
      </div>
    </>
  );
}

// ── 4 KPI cards (labels variam entre C.6 e D.5) ───────────────────────────────
export function CardsInsumosFd({
  totalFdBdi,
  totais,
  repasseTitulo,
  potencialTitulo,
  nInsumos,
  repasseSub,
}: {
  totalFdBdi: number;
  totais: TotaisInsumos;
  repasseTitulo: string;
  potencialTitulo: string;
  /** Nº de insumos FD (derivado de dados.insumos.length pela tela). */
  nInsumos?: number;
  /** Sub do KPI de repasse (derivado dos insumos medidos pela tela). */
  repasseSub?: ReactNode;
}) {
  return (
    <div className="ifd-kpis">
      <div className="ifd-kpi blue">
        <div className="kt">
          <span className="chip">
            <Wallet size={13} />
          </span>
          Contrato FD (c/ BDI)
        </div>
        <div className="kv">{fmtMi2(totalFdBdi)}</div>
        <div className="kf">{nInsumos ?? "—"} insumos · Anexo C.04</div>
      </div>
      <div className="ifd-kpi amber">
        <div className="kt">
          <span className="chip">
            <ClipboardList size={13} />
          </span>
          Acima do IPCA
        </div>
        <div className="kv">
          <ValorLive>{String(totais.acimaDoIpca)}</ValorLive>
        </div>
        {/* denominador explícito: "30" só alarma se o leitor souber que o universo é 30 (refino UX) */}
        <div className="kf">
          {nInsumos != null
            ? `de ${nInsumos} insumos · conforme as bases escolhidas`
            : "conforme as bases escolhidas"}
        </div>
      </div>
      <div className="ifd-kpi blue">
        <div className="kt">
          <span className="chip">
            <Banknote size={13} />
          </span>
          {repasseTitulo}
        </div>
        <div className="kv">
          <ValorLive>{fmtBRL2(totais.repasseReal)}</ValorLive>
        </div>
        <div className="kf">{repasseSub ?? "medido até o corte · c/ BDI"}</div>
      </div>
      <div className="ifd-kpi amber">
        <div className="kt">
          <span className="chip">
            <TrendingUp size={13} />
          </span>
          {potencialTitulo}
        </div>
        <div className="kv">
          <ValorLive>{fmtPotencial(totais.potencial)}</ValorLive>
        </div>
        <div className="kf">excedente × valor contratado</div>
      </div>
    </div>
  );
}

// ── tabela multifonte (15 colunas · visão ABC ou Ordem da PQ) ─────────────────
const CATS_ORDEM_PQ = ["COMBUSTÍVEL", "CBUQ", "AGREGADOS", "AÇO", "CONCRETO"];

// Ordenação única (a ordem VISUAL é do toggle ABC/PQ, não do Select — que fica oculto com 1 opção).
const ORDENACOES_INSUMOS: Ordenacao<InsumoFd>[] = [
  { value: "abc", label: "Curva ABC (valor)", cmp: (a, b) => a.ordemAbc - b.ordemAbc },
];

function CelIndiceOuPreco({
  fonte,
  campo,
}: {
  fonte: ReturnType<typeof fonteSelecionada>;
  campo: "os" | "atual";
}) {
  if (!fonte) return <>—</>;
  const v = campo === "os" ? fonte.valorOs : fonte.valorAtual;
  if (v == null) return <>—</>;
  if (fonte.tipo === "indice") {
    return (
      <span className="ifd-idxval" title="índice setorial (dez/2000=100)">
        {fmtNum(v, 3)}
      </span>
    );
  }
  return <>{fmtBRL2(v)}</>;
}

function LinhaInsumo({
  insumo,
  numero,
  selecao,
  onTrocarFonte,
}: {
  insumo: InsumoFd;
  numero: number | null;
  selecao: SelecaoFontes;
  onTrocarFonte: (ordemAbc: number, fonteId: string) => void;
}) {
  const { fonte, delta, excedente, potencial, repasseReal } = linhaCalc(insumo, selecao);
  const excCls =
    excedente == null
      ? ""
      : excedente > LIMIAR_EXCEDENTE
        ? "pos"
        : excedente < -LIMIAR_EXCEDENTE
          ? "neg"
          : "lin";
  const deltaCls = delta == null ? "" : delta > 0 ? "pos" : delta < 0 ? "neg" : "";
  const trCls = insumo.nome.includes("CBUQ") ? "cbuq" : insumo.qtdMedida > 0 ? "medido" : undefined;
  return (
    <tr className={trCls}>
      <td className="num">{numero ?? ""}</td>
      <td className="nm">
        {insumo.nome}
        {insumo.opcoes.length > 2 && (
          <span className="ifd-dualtag">{insumo.opcoes.length} bases</span>
        )}
      </td>
      <td className="qpq r">
        {fmtNum(insumo.qtdPq, 2)} {insumo.unidade}
      </td>
      <td className="r">{fmtBRL2(insumo.precoUnitBdi)}</td>
      <td className="r">{fmtBRL0(insumo.valorContratoBdi)}</td>
      <td className="c">
        <span className={`ifd-cls ifd-cls${insumo.classe}`}>{insumo.classe}</span>
      </td>
      <td className="c">
        <select
          className={`ifd-selbase${fonte?.recomendada ? " rec" : ""}`}
          value={selecao[insumo.ordemAbc] ?? ""}
          onChange={(e) => onTrocarFonte(insumo.ordemAbc, e.target.value)}
          aria-label={`Base do índice de ${insumo.nome}`}
        >
          {insumo.opcoes.map((o) => (
            // marcador textual da recomendada: <option> nativo não aceita span/ícone (exceção
            // consciente da varredura de glifos — o dot vira .ifd-recdot fora do select).
            <option key={o.id} value={o.id}>
              {o.rotulo}
              {o.recomendada ? " ●" : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="r pmar">
        <CelIndiceOuPreco fonte={fonte} campo="os" />
      </td>
      <td className="r pmai">
        <CelIndiceOuPreco fonte={fonte} campo="atual" />
      </td>
      <td className={`r ${deltaCls}`}>{fmtPctSinal(delta)}</td>
      <td className={`r ${excCls}`}>{fmtPctSinal(excedente)}</td>
      <td className="qmed r">
        {insumo.qtdMedida > 0 ? `${fmtNum(insumo.qtdMedida, 2)} ${insumo.unidade}` : "—"}
      </td>
      <td className="vmed r">{insumo.valorMedidoBdi > 0 ? fmtBRL2(insumo.valorMedidoBdi) : "—"}</td>
      <td className="rep r">{insumo.valorMedidoBdi > 0 ? fmtBRL2(repasseReal) : "—"}</td>
      <td className={`r ${potencial > 1000 ? "potf" : "pot0"}`}>
        {potencial > 0 ? fmtBRL0(potencial) : "—"}
      </td>
    </tr>
  );
}

export function TabelaMultifonte({
  dados,
  selecao,
  totais,
  onTrocarFonte,
  colunaOsLabel,
  colunaAtualLabel,
  nota,
}: {
  dados: InsumosFd;
  selecao: SelecaoFontes;
  totais: TotaisInsumos;
  onTrocarFonte: (ordemAbc: number, fonteId: string) => void;
  /** Cabeçalho da coluna do marco: "mar/26" na C.6 · "OS mar/26" na D.5. */
  colunaOsLabel: string;
  /** Cabeçalho da coluna atual (mês do corte, derivado de reeq.dataVerificacao pela tela). */
  colunaAtualLabel?: string;
  nota: ReactNode;
}) {
  const [visao, setVisao] = useState<"abc" | "pq">("abc");
  const insumos = dados.insumos;
  // Busca canônica (useColecao/ColToolbar) SEM paginação: os subtotais por categoria e o rodapé
  // "✓ bate com a PQ" dependem do corpo contínuo — perPage = tamanho da lista (ColPag some sozinho).
  const col = useColecao(insumos, {
    busca: (x) => `${x.nome} ${x.categoria ?? ""}`,
    ordenacoes: ORDENACOES_INSUMOS,
    perPage: Math.max(insumos.length, 1),
  });
  const filtrando = col.debounced.trim() !== "";
  const visiveis = new Set(col.visible.map((x) => x.ordemAbc));
  const porAbc = [...insumos].sort((a, b) => b.valorContratoBdi - a.valorContratoBdi);
  // rank ABC fixo (posição na lista cheia): filtrar a vista não renumera a âncora da linha
  const rankAbc = new Map(porAbc.map((x, i) => [x.ordemAbc, i + 1]));
  const porAbcVis = filtrando ? porAbc.filter((x) => visiveis.has(x.ordemAbc)) : porAbc;
  const totMedido = dados.totalMedidoBdi;
  const pctMedido = dados.totalFdBdi > 0 ? (totMedido / dados.totalFdBdi) * 100 : 0;
  return (
    <div className="ifd-panel">
      <div className="ifd-tblhead">
        <div className="ifd-viewtoggle" role="tablist" aria-label="Visão da tabela">
          <button
            type="button"
            role="tab"
            aria-selected={visao === "pq"}
            className={`ifd-vbtn${visao === "pq" ? " on" : ""}`}
            onClick={() => setVisao("pq")}
          >
            <ListOrdered size={13} /> Ordem da PQ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={visao === "abc"}
            className={`ifd-vbtn${visao === "abc" ? " on" : ""}`}
            onClick={() => setVisao("abc")}
          >
            <BarChart3 size={13} /> Curva ABC
          </button>
        </div>
        <div className="ifd-hint" style={{ margin: 0 }}>
          {visao === "abc"
            ? "Ordenado por valor (maior → menor), com classe ABC."
            : "Na ordem da PQ (Anexo C.04), agrupado por categoria com subtotais."}
          {filtrando ? (
            <>
              {" "}
              ·{" "}
              <b>
                {col.total} de {col.nItens}
              </b>{" "}
              {col.total === 1 ? "insumo" : "insumos"} — os totais do rodapé seguem sobre os{" "}
              {col.nItens}.
            </>
          ) : null}
        </div>
      </div>
      <ColToolbar col={col} placeholder="Buscar insumo ou categoria… ex.: CBUQ" />
      <div className="ifd-wraptable">
        <table className="ifd-t">
          <thead>
            <tr>
              <th>{visao === "abc" ? "#" : ""}</th>
              <th>Insumo</th>
              <th>Qtd PQ</th>
              <th>
                R$ unit
                <br />
                (c/ BDI)
              </th>
              <th>
                Valor contrato
                <br />
                (c/ BDI)
              </th>
              <th>Cl.</th>
              <th>Base do índice</th>
              <th>{colunaOsLabel}</th>
              <th>{colunaAtualLabel ?? mesCurtoIso(dados.reeq.dataVerificacao) ?? "atual"}</th>
              <th>Δ%</th>
              <th>Exc.</th>
              <th>Qtd medida</th>
              <th>
                Valor medido
                <br />
                (c/ BDI)
              </th>
              <th>Repasse real</th>
              <th>Potencial R$</th>
            </tr>
          </thead>
          <tbody>
            {filtrando && col.total === 0 ? (
              <tr>
                <td colSpan={15}>
                  <ColVazio termo={col.query} rotulo="insumo" onClear={() => col.setQuery("")} />
                </td>
              </tr>
            ) : visao === "abc" ? (
              porAbcVis.map((x) => (
                <LinhaInsumo
                  key={x.ordemAbc}
                  insumo={x}
                  numero={rankAbc.get(x.ordemAbc) ?? null}
                  selecao={selecao}
                  onTrocarFonte={onTrocarFonte}
                />
              ))
            ) : (
              CATS_ORDEM_PQ.flatMap((cat) => {
                const itensAll = insumos
                  .filter((x) => x.categoria === cat)
                  .sort((a, b) => (a.ordemPq ?? 0) - (b.ordemPq ?? 0));
                const itens = filtrando
                  ? itensAll.filter((x) => visiveis.has(x.ordemAbc))
                  : itensAll;
                if (!itens.length) return [];
                // subtotais sobre o que está VISÍVEL (com filtro ativo, subtotal do exibido —
                // o rodapé TOTAL continua sempre sobre a lista cheia)
                const vsum = itens.reduce((s, x) => s + x.valorContratoBdi, 0);
                const vmedsum = itens.reduce((s, x) => s + x.valorMedidoBdi, 0);
                const psum = itens.reduce((s, x) => {
                  const o = fonteSelecionada(x, selecao);
                  return o?.excedente != null && o.excedente > LIMIAR_EXCEDENTE
                    ? s + o.excedente * x.valorContratoBdi
                    : s;
                }, 0);
                return [
                  <tr key={`cat-${cat}`} className="ifd-catrow">
                    <td />
                    <td>
                      <span className="ifd-catname">{cat}</span>{" "}
                      <span className="ifd-catmeta">
                        {filtrando && itens.length < itensAll.length
                          ? `${itens.length} de ${itensAll.length} insumos`
                          : `${itens.length} ${itens.length > 1 ? "insumos" : "insumo"}`}
                      </span>
                    </td>
                    <td />
                    <td />
                    <td className="r">
                      <span className="ifd-catval">{fmtBRL0(vsum)}</span>
                    </td>
                    <td colSpan={7} />
                    <td className="r ifd-catmed">{vmedsum > 0 ? fmtBRL0(vmedsum) : "—"}</td>
                    <td className="r ifd-catmeta" style={{ fontSize: "9.5px" }}>
                      subtotal <ArrowDown size={9} aria-label="das linhas abaixo" />
                    </td>
                    <td className="r ifd-catpot">{psum > 0 ? fmtBRL0(psum) : "—"}</td>
                  </tr>,
                  ...itens.map((x) => (
                    <LinhaInsumo
                      key={x.ordemAbc}
                      insumo={x}
                      numero={null}
                      selecao={selecao}
                      onTrocarFonte={onTrocarFonte}
                    />
                  )),
                ];
              })
            )}
          </tbody>
          <tfoot>
            <tr className="ifd-totrow">
              <td />
              <td>
                TOTAL — {insumos.length} insumos{" "}
                <span className="ifd-matchpill">
                  <Check size={10} aria-hidden /> bate com a PQ
                </span>
              </td>
              <td />
              <td />
              <td className="r">{fmtBRL2(dados.totalFdBdi)}</td>
              <td colSpan={7} />
              <td className="r tmed">
                {fmtBRL2(totMedido)}
                {/* mês do corte derivado do read-model (nº do BM não existe em obra_insumos_reeq) */}
                <div className="tsub">
                  medido ({mesCurtoIso(dados.reeq.dataVerificacao) ?? "BM corrente"}) ·{" "}
                  {pctMedido.toLocaleString("pt-BR", {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}
                  %
                </div>
              </td>
              <td className="r">
                <ValorLive>{fmtBRL2(totais.repasseReal)}</ValorLive>
              </td>
              <td className="r">
                <ValorLive>{fmtPotencial(totais.potencial)}</ValorLive>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* sem paginação por design (subtotais + rodapé pedem corpo contínuo) — ColPag some com 1 página */}
      <ColPag col={col} rotulo="insumos" />
      <div className="ifd-note">{nota}</div>
    </div>
  );
}
