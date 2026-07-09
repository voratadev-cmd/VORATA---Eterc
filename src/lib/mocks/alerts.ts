// Mock data — alertas da IA mostrados na Dashboard.
// Em produção, virão dos agentes (Camada de IA) consultando documentos do contrato em tempo real.

import type { FarolLevel } from "./contracts";

export type Alert = {
  id: string;
  level: FarolLevel;
  contractId: string;
  contractName: string;
  title: string;
  description: string;
  agent: string;
  /** ISO datetime — quando o agente detectou */
  detectedAtISO: string;
};

/** Data de "agora" fixa para os mocks renderizarem com tempos previsíveis. */
const NOW_ISO = "2026-05-15T10:00:00Z";

export const MOCK_ALERTS: Alert[] = [];

/**
 * Formato relativo ao "agora" fixo dos mocks: "há 2 dias" / "há 3 horas" / "agora".
 * Mantém referência estável independente da data real do navegador.
 */
export function formatRelative(iso: string, nowIso: string = NOW_ISO): string {
  const then = new Date(iso).getTime();
  const now = new Date(nowIso).getTime();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  return `há ${months} mês${months === 1 ? "" : "es"}`;
}
