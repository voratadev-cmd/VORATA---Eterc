// Hook da tela 3.4 Valor Agregado (M3 · D.4 · método AACE 25R-03) · agrega:
// - getRecursos (obra_recursos · MOD/MOI/EQP contratado×real, base do efetivo)
// - getProdutividadeEconomica (obra_produtividade_economica · HH previsto/real + aderência R$/HH)
// - getDeseqContexto (D.0 · valor do D.4 + total + denominador do farol acumulado)
// HONESTIDADE: o real é PARCIAL (poucos meses medidos) → a tela mostra cobertura explícita e nunca
// crava "sem perda". Null quando os recursos não foram normalizados (base ausente).

import { useQuery } from "@tanstack/react-query";
import { getDeseqContexto } from "@/lib/supabase/deseqContexto";
import { type PerdaProdutividade, getPerdaProdutividade } from "@/lib/supabase/perdaProdutividade";
import {
  type ProdutividadeEconomica,
  getProdutividadeEconomica,
} from "@/lib/supabase/produtividadeEconomica";
import { type RecursosResumo, getRecursos } from "@/lib/supabase/recursos";
import { type TotalCostFuncoes, getTotalCostFuncoes } from "@/lib/supabase/totalCostFuncoes";
import { type ValorAgregadoResumo, getValorAgregado } from "@/lib/supabase/valorAgregado";

export type ValorAgregadoView = {
  recursos: RecursosResumo | null;
  /** Série HH/aderência. null se a produtividade econômica não foi normalizada. */
  prod: ProdutividadeEconomica | null;
  nome: string | null;
  /** Desequilíbrio do D.4 (Perda de Produtividade) lido do painel D.0. null se ausente. */
  desequilibrioVA: number | null;
  totalDesequilibrio: number | null;
  valorContratado: number | null;
  /** Earned value first-class (D.4 · obra_valor_agregado): VA × Alocado → Perda por categoria +
   *  VA por serviço. null se a aba D.4 Valor Agregado ainda não foi normalizada. */
  d4: ValorAgregadoResumo | null;
  /** Os 3 métodos da D.4 — Total Cost (ativo) + Milha Aferida (pendente). null se não normalizada. */
  perda: PerdaProdutividade | null;
  /** Detalhe do Total Cost função a função (MOD/EQP). null = seções ausentes OU gate não conservou
   *  → o detalhe cai pro nível CATEGORIA (não fabrica). */
  totalCostFuncoes: TotalCostFuncoes | null;
};

/** Hook enxuto só do read-model first-class do D.4 (sem recursos/prod/ctx) — p/ o bloco Valor
 *  Agregado da tela Recursos (C04). null se a aba D.4 ainda não foi normalizada. */
export function useValorAgregadoD4(contractId: string) {
  return useQuery<ValorAgregadoResumo | null>({
    queryKey: ["valor-agregado-d4", contractId],
    queryFn: () => getValorAgregado(contractId),
    staleTime: 30_000,
  });
}

export function useValorAgregado(contractId: string) {
  return useQuery<ValorAgregadoView | null>({
    queryKey: ["valor-agregado-view", contractId],
    queryFn: async () => {
      const [recursos, prod, ctx, d4, perda] = await Promise.all([
        getRecursos(contractId),
        getProdutividadeEconomica(contractId),
        getDeseqContexto(contractId),
        getValorAgregado(contractId),
        getPerdaProdutividade(contractId),
      ]);
      // A tela é a D.4 (3 métodos) — núcleo = perda (Total Cost) OU d4 (VA). recursos é coadjuvante.
      if (!perda && !d4 && !recursos) return null;

      // Detalhe por função do Total Cost — só faz sentido se há `perda` (avanço + canônico do sem ajuste).
      // O gate de conservação (Σ totalCostSem das funções == canônico C.4) vive dentro de
      // getTotalCostFuncoes: se falhar, retorna null e a tela cai pro detalhe por categoria.
      let totalCostFuncoes = null;
      if (perda?.avancoServicos != null) {
        totalCostFuncoes = await getTotalCostFuncoes(contractId, {
          avanco: perda.avancoServicos,
          gateSemTotal: perda.semAjuste.totalRs ?? undefined,
        });
      }

      return {
        recursos,
        prod,
        nome: ctx.nome,
        desequilibrioVA: ctx.categoriaRs("D.4"),
        totalDesequilibrio: ctx.totalDesequilibrio,
        valorContratado: ctx.valorContratado,
        d4,
        perda,
        totalCostFuncoes,
      };
    },
    staleTime: 30_000,
  });
}
