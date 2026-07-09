// Tipos de autenticação e o MODELO DE PAPÉIS (RBAC) da plataforma.
//
// 3 papéis, por poder: master > admin > regular.
//  • master  — convida e gerencia usuários, define quais telas cada um vê
//              (seleção de telas vem depois) e faz tudo que o admin faz.
//  • admin   — cadastra e administra obras.
//  • regular — só vê as telas/obras que o master liberou.
//
// As CAPACIDADES (ROLE_CAPABILITIES) são a fonte única de verdade — guards de
// rota e UI condicional consultam `can(role, "...")`, nunca comparam string de
// role solta. Assim, mudar o que cada papel pode fazer é um lugar só.

export type UserRole = "master" | "admin" | "regular";

/** Ordem de poder (índice maior = mais poder). Usado pra escolher o papel mais alto. */
export const ROLE_RANK: Record<UserRole, number> = {
  regular: 0,
  admin: 1,
  master: 2,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  master: "Master",
  admin: "Administrador",
  regular: "Usuário",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  master: "Convida e gerencia usuários, define o acesso de cada um e administra obras",
  admin: "Cadastra e administra obras",
  regular: "Acessa apenas as telas e obras liberadas pelo master",
};

/** Capacidades por papel — consulte via `can(role, capability)`. */
export type Capability = "manageUsers" | "registerObras" | "viewAdmin";

export const ROLE_CAPABILITIES: Record<UserRole, Record<Capability, boolean>> = {
  master: { manageUsers: true, registerObras: true, viewAdmin: true },
  admin: { manageUsers: false, registerObras: true, viewAdmin: false },
  regular: { manageUsers: false, registerObras: false, viewAdmin: false },
};

/** O papel pode realizar a capacidade? Fonte única de verdade pra guards/UI. */
export function can(role: UserRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role][capability];
}

/** Dado um conjunto de papéis (um usuário pode ter mais de um), retorna o mais alto. */
export function highestRole(roles: readonly UserRole[]): UserRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best), roles[0]!);
}

/** Type guard — string vinda do banco é um UserRole válido? */
export function isUserRole(v: unknown): v is UserRole {
  return v === "master" || v === "admin" || v === "regular";
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** 2 letras pra avatar (ex.: "MM"). */
  initials: string;
  /** Subtítulo na sidebar (ex.: "Construtora Aurora"). */
  subtitle: string;
  /** ISO date — quando o usuário foi criado/convidado. */
  createdAtISO: string;
  /** ISO date — última atividade registrada (null se nunca acessou). */
  lastSeenISO: string | null;
  /** true = pode logar; false = desativado. */
  ativo: boolean;
};
