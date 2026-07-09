// Camada B · painel de INDICADORES (puro, sem I/O). Agrega os faróis das abas já calculadas
// (Faturamento, Prazo) nos 6 blocos que a aba Indicadores/Visão Geral consome, conta por nível
// e deriva a SITUAÇÃO GERAL consolidada. A tela é só apresentação — a regra de consolidação
// (que não existe em lugar nenhum) é definida AQUI, na função pura `consolidar` (testada).
//
// HONESTIDADE (erro = milhões): a "Situação Geral" só é confiável quando TODOS os blocos têm
// dado. Hoje só Faturamento tem farol firme; Prazo (físico) e os 4 demais blocos estão PENDENTES
// por falta de dado bruto. Então `farolGeral` fica null (pendente) — NUNCA um verde que sugira
// "tudo certo" com 5 áreas cegas. Quem quiser o sinal parcial usa `farolDisponiveis` (pior nível
// entre os blocos que TÊM dado), cujo nome já avisa que é parcial.

import type { ProdutividadeReal } from "@/lib/supabase/produtividade";
import type { ProdutividadeEconomica } from "@/lib/supabase/produtividadeEconomica";
import type { Desequilibrio } from "@/lib/supabase/desequilibrio";
import type { RecursosResumo } from "@/lib/supabase/recursos";
import type { InsumosResumo } from "@/lib/supabase/insumos";
import type { ExcedenteResumo } from "@/lib/supabase/insumoExcedente";
import type { FaturamentoCalc } from "./calcFaturamento";
import type { PrazoCalc } from "./calcPrazo";
import { classificarPorRegra, FAROL_LABEL, type FarolLevel, type FarolRegra } from "./farol";

/** Cobertura mínima (nº de blocos com dado) para a Situação Geral ser confiável. Provisório:
 * exige cobertura COMPLETA — um consolidado com áreas cegas engana. Ajustar quando o domínio
 * definir (ex.: aceitar maioria). Total de blocos = 6.
 * ⚠️ A UI NUNCA deve pintar verde com `farolGeral=null`; se afrouxar este limiar, revisar o gate
 * de cor no card. O teste-invariante trava `farolGeral != null ⇒ cobertura completa`. */
const COBERTURA_MINIMA_CONSOLIDADO = 6;

export type IndicadorChave =
  | "faturamento"
  | "recursos"
  | "produtividade"
  | "prazo"
  | "insumos"
  | "desequilibrio";

/** Nível de um bloco: classificado ou null (PENDENTE). */
export type FarolNivelInput = FarolLevel | null;

/** Espelha o `BlocoFarol` da tela, mas com `nivel` nullable (null = PENDENTE). */
export type BlocoIndicador = {
  chave: IndicadorChave;
  label: string;
  nivel: FarolLevel | null;
  valor: string;
  descricao: string;
  nota: string;
  disponivel: boolean;
};

export type ContagemFarol = {
  conforme: number;
  observacao: number;
  risco: number;
  critico: number;
  pendente: number;
};

export type Consolidado = {
  contagem: ContagemFarol;
  cobertura: { disponiveis: number; total: number };
  /** Pior nível entre os blocos DISPONÍVEIS (referência PARCIAL). null se nenhum tem dado. */
  farolDisponiveis: FarolLevel | null;
  /** Situação Geral CONFIÁVEL: só com cobertura completa; senão null (pendente). */
  farolGeral: FarolLevel | null;
  consolidadoConfiavel: boolean;
  situacaoLabel: string;
};

export type IndicadoresCalc = Consolidado & {
  blocos: BlocoIndicador[];
  /** Aderência do mês (hero) — vem do Faturamento. */
  aderenciaMesPct: number | null;
};

const RANK: Record<FarolLevel, number> = { conforme: 0, observacao: 1, risco: 2, critico: 3 };

/** Pior (maior rank) entre os níveis informados. null se vazio. */
function piorNivel(niveis: FarolLevel[]): FarolLevel | null {
  if (niveis.length === 0) return null;
  return niveis.reduce((pior, n) => (RANK[n] > RANK[pior] ? n : pior), niveis[0]);
}

/** Arredonda a 1 casa e elimina o zero-negativo (evita "-0.0" cosmético). */
function fix1(n: number): number {
  const r = Number(n.toFixed(1));
  return Object.is(r, -0) ? 0 : r;
}
/** Número com vírgula decimal (produto é PT-BR — "94,6", nunca "94.6"). */
const numBR = (n: number, casas: number) => n.toFixed(casas).replace(".", ",");
const pctStr = (n: number | null | undefined) => (n == null ? "—" : `${numBR(fix1(n), 1)}%`);
const ppStr = (n: number | null | undefined) => {
  if (n == null) return "—";
  const r = fix1(n);
  return `${r > 0 ? "+" : ""}${numBR(r, 1)} pp`;
};

type BlocoSemDisp = Omit<BlocoIndicador, "disponivel">;
const PENDENTE = (chave: IndicadorChave, label: string, nota: string): BlocoSemDisp => ({
  chave,
  label,
  nivel: null,
  valor: "—",
  descricao: "Pendente",
  nota,
});

/**
 * Consolida os 6 blocos: conta por nível, mede cobertura, e decide a Situação Geral. PURA e
 * exportada para ser testada com cobertura completa (o caminho que hoje a montagem não alcança).
 */
export function consolidar(blocos: BlocoIndicador[]): Consolidado {
  const contagem: ContagemFarol = { conforme: 0, observacao: 0, risco: 0, critico: 0, pendente: 0 };
  for (const b of blocos) {
    if (b.nivel == null) contagem.pendente += 1;
    else contagem[b.nivel] += 1;
  }
  const total = blocos.length;
  const disponiveis = blocos.filter((b) => b.nivel != null).length;
  // "com dado" = bloco com VALOR real (não "—"); "classificado" = bloco com FAROL (nivel != null).
  // Distinguir os dois: Recursos/Produtividade/Insumos/Desequilíbrio TÊM valor mas farol pendente —
  // contá-los como "sem dado" subdimensionava a normalização real (era "1/6", o certo é "5/6 com dado").
  const comValor = blocos.filter((b) => b.valor !== "—").length;
  const farolDisponiveis = piorNivel(
    blocos.map((b) => b.nivel).filter((n): n is FarolLevel => n != null),
  );
  const consolidadoConfiavel = disponiveis >= COBERTURA_MINIMA_CONSOLIDADO;
  const farolGeral = consolidadoConfiavel ? farolDisponiveis : null;
  const situacaoLabel =
    consolidadoConfiavel && farolGeral
      ? FAROL_LABEL[farolGeral]
      : `Parcial — ${comValor}/${total} com dado · ${disponiveis}/${total} classificado`;
  return {
    contagem,
    cobertura: { disponiveis, total },
    farolDisponiveis,
    farolGeral,
    consolidadoConfiavel,
    situacaoLabel,
  };
}

/**
 * Monta o painel de indicadores a partir dos cálculos já prontos. Puro. Os 6 blocos saem na
 * ordem da tela; os ainda sem dado bruto entram como PENDENTES (nivel null), não como verde.
 */
export function calcularIndicadores(
  fat: FaturamentoCalc | null,
  prazo: PrazoCalc | null,
  produtividade: ProdutividadeReal | null = null,
  insumos: InsumosResumo | null = null,
  produtividadeEcon: ProdutividadeEconomica | null = null,
  desequilibrio: Desequilibrio | null = null,
  recursos: RecursosResumo | null = null,
  regras?: Record<string, FarolRegra>,
  excedente: ExcedenteResumo | null = null,
): IndicadoresCalc {
  // 1 · Faturamento — a C.2 (executiva) classifica por DESVIO em p.p. do contrato. DISTINTO do farol
  // da C.3 (operacional · aderência real÷previsto): o MESMO faturamento pode ser Observação aqui e
  // Crítico lá — métricas diferentes DE PROPÓSITO (não unificar). Por isso NÃO reusa `fat.farol`
  // (que virou o farol da C.3 = aderência) e classifica o desvio aqui, explicitamente.
  const farolDesvioFat = classificarPorRegra(
    "faturamento_desvio_acumulado",
    fat?.desvioAcumPct,
    regras,
  );
  const blocoFat: BlocoSemDisp =
    fat && farolDesvioFat
      ? {
          chave: "faturamento",
          label: "Faturamento",
          nivel: farolDesvioFat,
          valor: pctStr(fat.aderenciaAcum),
          descricao: `Aderência ${pctStr(fat.aderenciaAcum)} · desvio ${ppStr(fat.desvioAcumPct)}`,
          nota: "Realizado ÷ contratado no corte",
        }
      : PENDENTE("faturamento", "Faturamento", "Requer curva de faturamento normalizada");

  // 4 · Prazo — aderência FÍSICA pendente (BM sem % executado). Sem valor headline (evita ler o
  // previsto do plano como realização); plano + referência financeira ficam na NOTA.
  const blocoPrazo: BlocoSemDisp = prazo
    ? {
        chave: "prazo",
        label: "Prazo e Cronograma",
        nivel: null, // aderência física = o farol que o bloco pede → pendente
        valor: "—",
        descricao: "Aderência física pendente (BM sem % executado)",
        nota: `Plano previa ${pctStr(prazo.previstoFisicoPct)} físico · ref. financeira ${pctStr(prazo.aderenciaFinanceiraPct)}${prazo.farolFinanceiro ? ` (${FAROL_LABEL[prazo.farolFinanceiro]})` : ""}`,
      }
    : PENDENTE("prazo", "Prazo e Cronograma", "Requer cronograma + % físico executado");

  // 3 · Produtividade — CPI (régua 3): índice R$/HH real ÷ R$/HH contratado (= cost performance).
  // ≥1,0 Conforme · 0,90–1,0 Obs · 0,80–0,90 Risco · <0,80 Crítico. Usa o CPI do último BM medido.
  // A FÍSICA (kg/Hh) fica sem farol (não é CPI). Sem real → pendente (dado, não régua).
  const blocoProd: BlocoSemDisp = (() => {
    if (produtividadeEcon && !produtividadeEcon.eixoRealVazio) {
      const medidos = produtividadeEcon.meses.filter((m) => (m.hhReal ?? 0) > 0);
      const hhReal = medidos.reduce((a, m) => a + (m.hhReal ?? 0), 0);
      const hhPrev = medidos.reduce((a, m) => a + (m.hhPrevisto ?? 0), 0);
      const aderenciaHh = hhPrev > 0 ? (hhReal / hhPrev) * 100 : null; // mobilização (HH real÷previsto)
      const cpi = [...medidos].reverse().find((m) => m.aderencia != null)?.aderencia ?? null; // CPI
      const ultimoRsHh = [...medidos].reverse().find((m) => m.rsPorHh != null)?.rsPorHh ?? null;
      return {
        chave: "produtividade",
        label: "Produtividade",
        nivel: classificarPorRegra("produtividade_cpi", cpi, regras),
        valor: ultimoRsHh != null ? `R$ ${ultimoRsHh.toFixed(0)}/HH` : pctStr(aderenciaHh),
        descricao: `Produtividade econômica · CPI ${cpi != null ? numBR(cpi, 2) : "—"} (R$/HH real ÷ contratado)`,
        nota: `CPI ${cpi != null ? numBR(cpi, 2) : "—"} · mobilização HH ${pctStr(aderenciaHh)} · ${medidos.length} ${medidos.length === 1 ? "mês medido" : "meses medidos"}`,
      };
    }
    if (produtividade?.produtividadeRealKgPh != null) {
      return {
        chave: "produtividade",
        label: "Produtividade",
        nivel: null,
        valor: `${produtividade.produtividadeRealKgPh.toFixed(2).replace(".", ",")} kg/Hh`,
        descricao: "Produtividade física da armação (kg de aço por person-hora)",
        nota: `avanço ${pctStr(produtividade.avancoFisicoPct)}${
          produtividade.perdaAnomalia
            ? ` · perda ${produtividade.indicePerdaRaw?.toFixed(0)}% (anomalia de origem)`
            : ""
        } · benchmark/farol pendente`,
      };
    }
    return PENDENTE("produtividade", "Produtividade", "Requer HH real por frente (RDO)");
  })();

  // 5 · Insumos (v53 multifonte · PQ C.04) — Curva ABC por valor de CONTRATO + farol pela regra
  // da C.6/D.5: excedente ao IPCA (fonte recomendada) aciona repasse (cl. 8.8) → Observação.
  // Sem o lado do excedente (chamador antigo), o farol fica pendente (não fabricar).
  const paretoNota =
    insumos && insumos.nPareto80 && insumos.totalValor
      ? `${insumos.nPareto80} insumos = 80% do contrato FD (~R$ ${numBR(insumos.totalValor / 1e6, 1)} mi, PQ C.04)`
      : insumos
        ? `ABC ${insumos.porClasse.map((c) => `${c.classe}:${c.nInsumos}`).join(" · ")}`
        : "";
  const nAcimaIpca = excedente?.acimaTeto?.length ?? null;
  const blocoIns: BlocoSemDisp =
    insumos && insumos.nInsumos > 0
      ? {
          chave: "insumos",
          label: "Insumos",
          nivel: nAcimaIpca == null ? null : nAcimaIpca > 0 ? "observacao" : "conforme",
          valor: `${insumos.nInsumos} insumos`,
          descricao: "Faturamento direto (PQ C.04 c/ BDI) + Curva ABC por valor",
          nota: `${paretoNota}${
            nAcimaIpca != null
              ? ` · ${nAcimaIpca} acima do IPCA (repasse cl. 8.8${
                  excedente?.totalDeltaRs ? ` R$ ${numBR(excedente.totalDeltaRs, 0)}` : ""
                })`
              : " · excedente ao IPCA pendente"
          }`,
        }
      : PENDENTE("insumos", "Insumos", "Requer insumos FD normalizados (v53)");

  // 6 · Desequilíbrio (régua 8) — % do contrato: ≤1% Conforme · 1–5% Obs · 5–10% Risco · >10%
  // Crítico (alto ruim). Valor REAL + farol pela régua oficial. (BR-101: 5,4% → Risco.)
  const deseqPctPv =
    desequilibrio && fat?.custoTotal ? (desequilibrio.totalRs / fat.custoTotal) * 100 : null;
  const blocoDeseq: BlocoSemDisp =
    desequilibrio && desequilibrio.totalRs > 0
      ? {
          chave: "desequilibrio",
          label: "Desequilíbrio Acumulado",
          nivel: classificarPorRegra("desequilibrio_acumulado", deseqPctPv, regras),
          valor: `R$ ${numBR(desequilibrio.totalRs / 1e6, 1)} mi`,
          descricao:
            deseqPctPv != null ? `${pctStr(deseqPctPv)} do contrato` : "composição por categoria",
          nota: `${desequilibrio.nComValor} categoria(s) com valor · ${pctStr(deseqPctPv)} do contrato (régua de desequilíbrio)`,
        }
      : PENDENTE("desequilibrio", "Desequilíbrio Acumulado", "Requer M3 quantificado");

  // 2 · Recursos (régua 2) — RELAÇÃO recurso × faturamento, não o desvio do recurso sozinho:
  // (queda de faturamento − queda de recurso) em pp. Faturamento cair ≤ recurso = bom (cortou recurso
  // sem perder faturamento). ≤0 Conforme · 0–5 Obs · 5–10 Risco · >10 Crítico (alto ruim). As quedas
  // são medidas vs o PREVISTO-ATÉ-O-CORTE (faturamento da aderência; recurso do histograma ≤ corte).
  const CATS_REC = ["MOD", "MOI", "EQP"] as const;
  const recReal = recursos
    ? CATS_REC.reduce((a, c) => a + (recursos.categorias[c]?.realRs ?? 0), 0)
    : 0;
  const recCatsComReal = recursos
    ? CATS_REC.filter((c) => (recursos.categorias[c]?.realRs ?? 0) > 0)
    : [];
  // recurso contratado ATÉ O CORTE (histograma alinhado ao mês-corte do faturamento)
  const corte = fat?.mesCorte;
  const recContratadoCorte =
    recursos && corte
      ? CATS_REC.reduce(
          (a, c) =>
            a +
            (recursos.categorias[c]?.serieMensal ?? [])
              .filter((m) => m.ano < corte.ano || (m.ano === corte.ano && m.mes <= corte.mes))
              .reduce((s, m) => s + (m.contratadoRs ?? 0), 0),
          0,
        )
      : 0;
  // quedas vs previsto-até-corte (pp). faturamento: 100 − aderência acum.
  const quedaFat = fat?.aderenciaAcum != null ? 100 - fat.aderenciaAcum : null;
  const quedaRec = recContratadoCorte > 0 ? 100 - (recReal / recContratadoCorte) * 100 : null;
  const recRelacao = quedaFat != null && quedaRec != null ? quedaFat - quedaRec : null;
  const blocoRec: BlocoSemDisp =
    recursos?.temRealGlobal && recReal > 0
      ? {
          chave: "recursos",
          label: "Recursos",
          nivel: classificarPorRegra("recursos_vs_faturamento", recRelacao, regras),
          valor: `R$ ${numBR(recReal / 1e6, 1)} mi alocado`,
          descricao:
            recRelacao != null
              ? `relação recurso×faturamento ${ppStr(recRelacao)} (fat. ${ppStr(quedaFat != null ? -quedaFat : null)} × recurso ${ppStr(quedaRec != null ? -quedaRec : null)})`
              : `real ${recCatsComReal.join("+")} · alocação medida`,
          nota: `${recCatsComReal.join("+")} real ${numBR(recReal / 1e6, 1)}M vs contratado-até-corte ${numBR(recContratadoCorte / 1e6, 1)}M · ${ppStr(recRelacao)} (régua: fat. cair ≤ recurso é bom)`,
        }
      : PENDENTE("recursos", "Recursos", "Requer HH real (MOD/MOI/EQP) do RDO");

  const raw: BlocoSemDisp[] = [blocoFat, blocoRec, blocoProd, blocoPrazo, blocoIns, blocoDeseq];
  // invariante num só lugar: disponivel ⇔ tem nível classificado
  const blocos: BlocoIndicador[] = raw.map((b) => ({ ...b, disponivel: b.nivel != null }));

  return {
    blocos,
    ...consolidar(blocos),
    aderenciaMesPct: fat?.aderenciaAcum ?? null,
  };
}
