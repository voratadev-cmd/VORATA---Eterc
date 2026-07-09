// Farol de marco contratual (C.5) DERIVADO de data-limite × corte + % concluído — fonte ÚNICA p/ as
// abas Prazo (C.5) e Indicadores (C.2). Substitui a confiança na coluna `farol` gravada na ingestão
// (migration 20260607000005), que usou janela ~6m e partia clusters (ex.: 3 dos 5 Sinistros de Talude
// "em risco" e 2 idênticos "no prazo"). Sem % medido (input por BM pendente), o risco é proximidade:
// marco não concluído que vence dentro do horizonte → Em risco. Horizonte configurável por contrato.

/** Próximos N meses (a partir do corte) em que um marco não-concluído conta como "Em risco".
 *  12 meses cai no gap natural dos dados da BR-101 (5 Sinistros venc. set–dez/26; o próximo é +15m). */
export const MARCO_RISCO_HORIZONTE_MESES = 12;

export type MarcoStatus = "cumprido" | "atrasado" | "em-risco" | "no-prazo" | "pendente";

export const MARCO_STATUS_LABEL: Record<MarcoStatus, string> = {
  cumprido: "Cumprido",
  atrasado: "Atrasado",
  "em-risco": "Em risco",
  "no-prazo": "No prazo",
  pendente: "—",
};

function mesesEntre(corteISO: string, alvoISO: string): number {
  const [cy, cm, cd] = corteISO.split("-").map(Number);
  const [ay, am, ad] = alvoISO.split("-").map(Number);
  return (ay - cy) * 12 + (am - cm) + (ad - cd) / 30.44;
}

/** Status do marco no corte. `dataLimite`/`corteISO` em ISO (YYYY-MM-DD). */
export function statusMarco(
  dataLimite: string | null,
  corteISO: string | null,
  pctConcluido: number | null,
): MarcoStatus {
  if (pctConcluido != null && pctConcluido >= 100) return "cumprido";
  if (!dataLimite) return "pendente";
  if (!corteISO) return "no-prazo";
  const meses = mesesEntre(corteISO, dataLimite);
  if (meses < 0) return "atrasado";
  if (meses <= MARCO_RISCO_HORIZONTE_MESES) return "em-risco";
  return "no-prazo";
}

/** ISO do corte (último dia do mês de corte) — referência temporal do status. */
export function corteMesParaISO(ano: number, mes: number): string {
  const last = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
