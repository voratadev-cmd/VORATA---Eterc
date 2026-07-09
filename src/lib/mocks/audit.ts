// Mock log de auditoria · ações sensíveis rastreadas no produto.
// Quando o backend entrar, esse mock vira endpoint /audit com paginação + filtros.

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "generate"
  | "login"
  | "logout"
  | "export"
  | "share";

export type AuditEntityType =
  | "user"
  | "contract"
  | "bm"
  | "pleito"
  | "carta"
  | "claim"
  | "checklist"
  | "settings"
  | "session";

export const ACTION_LABEL: Record<AuditAction, string> = {
  create: "Criou",
  update: "Atualizou",
  delete: "Removeu",
  approve: "Aprovou",
  reject: "Rejeitou",
  generate: "Gerou",
  login: "Acessou",
  logout: "Saiu",
  export: "Exportou",
  share: "Compartilhou",
};

export const ENTITY_LABEL: Record<AuditEntityType, string> = {
  user: "Usuário",
  contract: "Contrato",
  bm: "BM",
  pleito: "Pleito",
  carta: "Carta",
  claim: "Claim",
  checklist: "Checklist",
  settings: "Configuração",
  session: "Sessão",
};

export type AuditEntry = {
  id: string;
  /** Timestamp ISO completo (com hora). */
  timestampISO: string;
  userId: string;
  /** Nome do usuário (denormalizado pra evitar lookup). */
  userName: string;
  userRole: "admin" | "diretor" | "gerente" | "juridico";
  action: AuditAction;
  entityType: AuditEntityType;
  /** ID da entidade afetada (ex.: contractId, bmId, userId). */
  entityId: string;
  /** Label legível (ex.: "Aeroporto Sorriso", "BM-03"). */
  entityLabel: string;
  /** Descrição textual: "Ana Costa aprovou BM-03 do Aeroporto Sorriso". */
  description: string;
  /** IP/contexto opcional. */
  meta?: string;
};

export const MOCK_AUDIT: AuditEntry[] = [];

/** Helper · ordena por timestamp desc (mais recente primeiro). */
export function getAuditOrdered(): AuditEntry[] {
  return [...MOCK_AUDIT].sort((a, b) =>
    a.timestampISO < b.timestampISO ? 1 : a.timestampISO > b.timestampISO ? -1 : 0,
  );
}

/** Valores únicos pros filtros. */
export function getAuditFilters() {
  const users = Array.from(new Set(MOCK_AUDIT.map((a) => a.userName))).sort();
  const actions = Array.from(new Set(MOCK_AUDIT.map((a) => a.action)));
  const entities = Array.from(new Set(MOCK_AUDIT.map((a) => a.entityType)));
  return { users, actions, entities };
}
