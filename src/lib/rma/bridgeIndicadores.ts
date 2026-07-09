// Bridge §7.1 · Indicadores — materializa a view da aba Indicadores (painel consolidado) a partir
// do IndicadoresCalc (Camada B). Tipo ESTREITO (Pick) — só os campos que a aba lê, sem stubar o
// BmSnapshot inteiro. REAIS: 6 blocos de farol (faturamento firme, resto pela cobertura), contagem,
// aderência do mês. HONESTO: a Situação Geral fica NEUTRA (não verde "Conforme") enquanto a
// cobertura for parcial — nunca declara o contrato conforme com 1/6 blocos. PENDENTES: força no
// mérito, ação recomendada, diagnóstico (IA), curvas Lib×Cap×Aloc, marcos, responsabilidade.

import type { FarolLevel } from "@/lib/mocks/contracts";
import type { BlocoFarol, BmSnapshot } from "@/lib/mocks/obras";
import type { CurvasC8 } from "@/lib/supabase/curvasC8";
import type { PrazoMarco } from "@/lib/supabase/prazoMarcos";
import type { DiagnosticoIA } from "@/lib/supabase/sinteses";
import type { BlocoIndicador, IndicadoresCalc } from "./calcIndicadores";
import { classificarPorRegra, FAROL_LABEL, type FarolRegra } from "./farol";
import { MARCO_STATUS_LABEL, type MarcoStatus, statusMarco } from "./marcoFarol";

/** Nível de farol de um marco: os 4 do DS ou "pendente" (sem data-limite → status indefinido). */
export type MarcoFarol = FarolLevel | "pendente";

/** Status do marco (data-limite × corte, regra única em ./marcoFarol) → nível do DS. Mesma classe
 * da aba Prazo. Sem data-limite ⇒ "pendente" — NUNCA verde fabricado. */
function marcoStatusNivel(status: MarcoStatus): MarcoFarol {
  switch (status) {
    case "atrasado":
      return "critico";
    case "em-risco":
      return "risco";
    case "cumprido":
    case "no-prazo":
      return "conforme";
    default:
      return "pendente";
  }
}

/** Só os campos que a aba Indicadores consome — evita materializar o BmSnapshot completo.
 * Overrides: marcos podem ser "pendente" (sem farol na fonte) e a contagem expõe os pendentes
 * (omiti-los faria "0 críticos · 1 conforme" parecer cobertura total com 5/6 blocos pendentes). */
export type IndicadoresView = Omit<
  Pick<
    BmSnapshot,
    | "numero"
    | "situacao"
    | "situacaoLabel"
    | "blocosContagem"
    | "aderenciaMesPct"
    | "forcaNoMerito"
    | "forcaNoMeritoNota"
    | "acaoRecomendada"
    | "diagnostico"
    | "diagnosticoHora"
    | "blocoFaturamento"
    | "blocoRecursos"
    | "blocoProdutividade"
    | "blocoPrazo"
    | "blocoInsumos"
    | "blocoDesequilibrio"
    | "curvas"
    | "marcos"
    | "responsabilidade"
  >,
  "marcos" | "blocosContagem"
> & {
  marcos: Array<Omit<BmSnapshot["marcos"][number], "statusFarol"> & { statusFarol: MarcoFarol }>;
  blocosContagem: BmSnapshot["blocosContagem"] & { pendentes: number };
};

/** BlocoIndicador (Camada B) → BlocoFarol (view). Sem nível disponível → PENDENTE (tom neutro, NÃO
 *  azul de observação — área cega não é "monitoramento ativo"). */
export function toBlocoFarol(b: BlocoIndicador | undefined): BlocoFarol {
  if (!b || b.nivel == null) {
    return {
      valor: b?.valor && b.valor !== "" ? b.valor : "—",
      nivel: "observacao", // tom-base; a UI usa `pendente` p/ pintar neutro (não o azul de observação)
      pendente: true,
      descricao: b?.descricao || "Pendente",
      nota: b?.nota || "aguardando normalização",
    };
  }
  return { valor: b.valor, nivel: b.nivel, descricao: b.descricao, nota: b.nota };
}

const RESP_PENDENTE = { valor: "—", pct: 0, eventos: 0 };

export type IndicadoresBridge = { view: IndicadoresView; bmLabel: string };

/** Monta a view de Indicadores real. null se não há cálculo (sem dado normalizado). */
export function buildIndicadoresView(
  calc: IndicadoresCalc | null,
  bmLabel: string,
  curvasC8: CurvasC8 | null = null,
  marcos: PrazoMarco[] = [],
  corteISO: string | null = null,
  regras?: Record<string, FarolRegra>,
  diagnosticoIA: DiagnosticoIA | null = null,
): IndicadoresBridge | null {
  if (!calc) return null;
  const byChave = new Map(calc.blocos.map((b) => [b.chave, b]));
  const c = calc.contagem;

  // Gap Capacidade − Liberação (régua 9) — capacidade OCIOSA por falta de liberação: só existe quando
  // a capacidade SUPERA a liberação (clamp em 0, espelha a coluna 'Cap−Lib (ociosa)' da fonte, que é
  // max(0, cap−lib)). BR-101: cap 17,7% < lib 100% → 0pp → Conforme (não há ociosa). Sem o clamp o
  // indicador mostrava −82pp (cap menor que lib NÃO é capacidade ociosa). null se C.8 não normalizado.
  const gapCapLib =
    curvasC8 && curvasC8.capacidadePct != null && curvasC8.liberacaoPct != null
      ? Math.max(0, curvasC8.capacidadePct - curvasC8.liberacaoPct)
      : null;
  const gapNivel = classificarPorRegra("capacidade_gap", gapCapLib, regras);

  const view: IndicadoresView = {
    numero: bmLabel,
    // HONESTO: só verde/farol firme com cobertura completa; parcial → neutro (observação).
    situacao: calc.farolGeral ?? "observacao",
    situacaoLabel: calc.situacaoLabel,
    // resumo de 4 níveis (os blocos pendentes não entram na contagem — aparecem "—" no grid)
    blocosContagem: {
      criticos: c.critico,
      risco: c.risco,
      observacao: c.observacao,
      conforme: c.conforme,
      pendentes: c.pendente,
    },
    aderenciaMesPct:
      calc.aderenciaMesPct != null ? Math.round(calc.aderenciaMesPct * 10) / 10 : null,
    // ── PENDENTES (IA / dado não normalizado) ──
    forcaNoMerito: 0,
    forcaNoMeritoNota: "Pendente — solidez documental/jurídica (IA)",
    acaoRecomendada: { titulo: "Aguardando análise do Adm Contratual IA", cta: "—" },
    // mesma fonte (obra_sinteses) que a Visão Geral lê — duas abas vizinhas não podem divergir
    // sobre a EXISTÊNCIA do diagnóstico ("Pendente" numa, texto real na outra)
    diagnostico:
      diagnosticoIA?.situacaoGeral ||
      "Pendente — diagnóstico do Adm Contratual IA a partir dos números normalizados.",
    diagnosticoHora: "—",
    blocoFaturamento: toBlocoFarol(byChave.get("faturamento")),
    blocoRecursos: toBlocoFarol(byChave.get("recursos")),
    blocoProdutividade: toBlocoFarol(byChave.get("produtividade")),
    blocoPrazo: toBlocoFarol(byChave.get("prazo")),
    blocoInsumos: toBlocoFarol(byChave.get("insumos")),
    blocoDesequilibrio: toBlocoFarol(byChave.get("desequilibrio")),
    // C.8 normalizado → mostra Lib×Cap×Aloc reais; senão pendente (UI mostra "—", nunca "0%").
    curvas:
      curvasC8 && curvasC8.alocadoPct != null
        ? {
            pendente: false,
            liberacaoPct: curvasC8.liberacaoPct,
            liberacaoNota: "liberado ÷ contratado no corte",
            capacidadePct: curvasC8.capacidadePct,
            capacidadeNota: "capacidade produtiva ÷ contratado",
            alocadoPct: curvasC8.alocadoPct,
            alocadoNota: "executado ÷ contratado (= faturamento)",
            diagnostico:
              (curvasC8.maiorGapRs != null
                ? `Maior gap entre as curvas: ${(curvasC8.maiorGapRs / 1e6).toFixed(1).replace(".", ",")} mi (origem do gargalo). `
                : "Curvas normalizadas (C.8). ") +
              (gapNivel && gapCapLib != null
                ? `Gap Capacidade−Liberação ${gapCapLib.toFixed(0)}pp → ${FAROL_LABEL[gapNivel]}.`
                : ""),
          }
        : {
            // PENDENTE ≠ ZERO: C.8 não normalizado → "—", nunca "0%" (não afirma zero sobre área cega).
            pendente: true,
            liberacaoPct: null,
            liberacaoNota: "pendente — RS §1.1",
            capacidadePct: null,
            capacidadeNota: "pendente — Histograma DGB",
            alocadoPct: null,
            alocadoNota: "pendente — Medição/Armação",
            diagnostico: "Pendente — depende de RS + histogramas normalizados (§1/§2).",
          },
    // Marcos contratuais REAIS (C.5 · obra_prazo_marcos). statusFarol DERIVADO de data-limite × corte
    // (regra única em ./marcoFarol — mesma da aba Prazo); % concluído é input por BM (pendente) → o
    // status reflete a posição temporal, não conclusão.
    marcos: marcos.map((m) => {
      const status = statusMarco(m.dataLimite, corteISO, m.pctConcluido);
      return {
        id: String(m.ordem),
        titulo: m.categoria ?? m.trecho ?? "Marco",
        descricao:
          [m.categoria ? m.trecho : null, m.dataLimite ? `data-limite ${m.dataLimite}` : null]
            .filter(Boolean)
            .join(" · ") || "—",
        statusLabel: MARCO_STATUS_LABEL[status],
        statusFarol: marcoStatusNivel(status),
      };
    }),
    responsabilidade: {
      contratante: { ...RESP_PENDENTE },
      contratada: { ...RESP_PENDENTE },
      terceiro: { ...RESP_PENDENTE },
      forcaMaior: { valor: "—", pct: 0, descricao: "pendente — matriz de eventos (§7 gap #7)" },
    },
  };

  return { view, bmLabel };
}
