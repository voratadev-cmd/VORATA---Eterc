// Hooks do C.8 · curvas Lib×Cap×Aloc (obra_curvas_c8) + matriz por frente (obra_curvas_frentes).
import { useQuery } from "@tanstack/react-query";
import {
  getCurvasC8,
  getCurvasFrentes,
  type CurvasC8,
  type FrenteC8,
} from "@/lib/supabase/curvasC8";

export function useCurvasC8(contractId: string) {
  return useQuery<CurvasC8 | null>({
    queryKey: ["curvas-c8", contractId],
    queryFn: () => getCurvasC8(contractId),
    staleTime: 30_000,
  });
}

export function useCurvasFrentes(contractId: string) {
  return useQuery<FrenteC8[]>({
    queryKey: ["curvas-frentes", contractId],
    queryFn: () => getCurvasFrentes(contractId),
    staleTime: 30_000,
  });
}
