// Hook direto do C.10 Panorama · lê obra_panorama via getPanorama.
import { useQuery } from "@tanstack/react-query";
import { getPanorama, type Panorama } from "@/lib/supabase/panorama";

export function usePanorama(contractId: string) {
  return useQuery<Panorama | null>({
    queryKey: ["panorama", contractId],
    queryFn: () => getPanorama(contractId),
    staleTime: 30_000,
  });
}
