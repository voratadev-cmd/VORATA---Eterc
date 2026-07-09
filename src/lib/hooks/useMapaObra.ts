// Hook da tela C.14 Mapa da Obra · modelo v46 por FRENTE. Combina o dado REAL normalizado:
//  - getMapaFrentes      (obra_mapa_segmentos · 16 frentes físicas: 5 trechos + 11 pontuais)
//  - getMapaTransversais (obra_secoes · Admin Local + Materiais FD, sem km)
// e expõe os totais + os 46 rótulos de mês (janela contratual mar/2026 → dez/2029). O cálculo de
// impedimento mês a mês fica na TELA (é input do usuário · simulador). Null se não normalizado.

import { useQuery } from "@tanstack/react-query";
import { getObraById } from "@/lib/supabase/obras";
import {
  type FrenteMapa,
  type TransversalMapa,
  getMapaFrentes,
  getMapaTransversais,
} from "@/lib/supabase/mapaSegmentos";

const MESES_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
// Horizonte do mapa = janela contratual da BR-101 (mar/2026 → dez/2029 = 46 meses), igual ao workbook.
const MES0 = { ano: 2026, mes: 3 }; // mar/2026 = ordinal 0
const N_MESES = 46;
/** BM corrente = mai/2026 = 3º mês (índice 2). */
const BM_CORRENTE_IDX = 2;

function labelMes(idx: number): string {
  const m = MES0.mes - 1 + idx;
  const ano = MES0.ano + Math.floor(m / 12);
  return `${MESES_PT[((m % 12) + 12) % 12]}-${String(ano).slice(2)}`;
}

export type MapaObraView = {
  nome: string | null;
  /** 16 frentes físicas (5 trechos de pista + 11 pontuais). */
  frentes: FrenteMapa[];
  transversais: TransversalMapa[];
  /** Σ frentes físicas (= obra física). */
  somaFisica: number;
  somaTransversal: number;
  /** físicas + transversais (= PV do contrato). */
  pv: number;
  meses: string[];
  bmCorrenteIdx: number;
  kmMin: number;
  kmMax: number;
};

export function useMapaObra(contractId: string) {
  return useQuery<MapaObraView | null>({
    queryKey: ["mapa-obra-c14", contractId],
    staleTime: 30_000,
    queryFn: async () => {
      const [frentes, transversais, obra] = await Promise.all([
        getMapaFrentes(contractId),
        getMapaTransversais(contractId),
        getObraById(contractId),
      ]);
      if (!frentes || frentes.length === 0) return null;

      const somaFisica = frentes.reduce((a, f) => a + f.valorRs, 0);
      const somaTransversal = transversais.reduce((a, t) => a + t.valorRs, 0);
      const pistas = frentes.filter((f) => f.ehPista);
      const kmMin = Math.min(...pistas.map((p) => p.kmInicio));
      const kmMax = Math.max(...pistas.map((p) => p.kmFim));

      return {
        nome: obra?.nome_interno ?? null,
        frentes,
        transversais,
        somaFisica,
        somaTransversal,
        pv: somaFisica + somaTransversal,
        meses: Array.from({ length: N_MESES }, (_, j) => labelMes(j)),
        bmCorrenteIdx: BM_CORRENTE_IDX,
        kmMin,
        kmMax,
      };
    },
  });
}
