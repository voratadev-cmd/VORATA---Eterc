// Mock users · placeholder da tela de gestão de usuários (/admin) enquanto o
// wiring real (ler `profiles`) não entra. O usuário LOGADO agora vem do Supabase
// Auth (UserContext) — este mock NÃO controla mais a sessão.
// Papéis: master (1) · admin (1) · regular (7).

import type { User } from "../auth/types";

export const MOCK_USERS: User[] = [
  {
    id: "u-001",
    name: "Mateus Milagre",
    email: "mateus@aurora.com.br",
    role: "master",
    initials: "MM",
    subtitle: "Construtora Aurora",
    createdAtISO: "2024-08-01",
    lastSeenISO: "2026-05-25",
    ativo: true,
  },
  {
    id: "u-002",
    name: "Carlos Diretor",
    email: "carlos.diretor@aurora.com.br",
    role: "admin",
    initials: "CD",
    subtitle: "Diretor de Operações",
    createdAtISO: "2024-08-01",
    lastSeenISO: "2026-05-24",
    ativo: true,
  },
  {
    id: "u-003",
    name: "Ana Costa",
    email: "ana.costa@aurora.com.br",
    role: "regular",
    initials: "AC",
    subtitle: "Gerente · Aeroporto Uberlândia",
    createdAtISO: "2024-09-15",
    lastSeenISO: "2026-05-25",
    ativo: true,
  },
  {
    id: "u-004",
    name: "Bruno Lima",
    email: "bruno.lima@aurora.com.br",
    role: "regular",
    initials: "BL",
    subtitle: "Gerente · Aeroporto Sorriso",
    createdAtISO: "2025-09-10",
    lastSeenISO: "2026-05-25",
    ativo: true,
  },
  {
    id: "u-005",
    name: "Patrícia Souza",
    email: "patricia.souza@aurora.com.br",
    role: "regular",
    initials: "PS",
    subtitle: "Gerente · Hospital Juréia",
    createdAtISO: "2026-01-08",
    lastSeenISO: "2026-05-23",
    ativo: true,
  },
  {
    id: "u-006",
    name: "Dr. Roberto Pereira",
    email: "roberto.pereira@aurora.com.br",
    role: "regular",
    initials: "RP",
    subtitle: "Coordenador Jurídico",
    createdAtISO: "2024-10-01",
    lastSeenISO: "2026-05-25",
    ativo: true,
  },
  {
    id: "u-007",
    name: "Dra. Marina Andrade",
    email: "marina.andrade@aurora.com.br",
    role: "regular",
    initials: "MA",
    subtitle: "Advogada · Claims",
    createdAtISO: "2025-03-20",
    lastSeenISO: "2026-05-22",
    ativo: true,
  },
  {
    id: "u-008",
    name: "João Silva",
    email: "joao.silva@aurora.com.br",
    role: "regular",
    initials: "JS",
    subtitle: "Gerente de Contrato",
    createdAtISO: "2025-02-14",
    lastSeenISO: "2025-12-10",
    ativo: false, // desativado
  },
  {
    id: "u-009",
    name: "Renata Vasconcelos",
    email: "renata.vasc@aurora.com.br",
    role: "regular",
    initials: "RV",
    subtitle: "Advogada · Pleitos",
    createdAtISO: "2026-04-01",
    lastSeenISO: null, // nunca acessou
    ativo: true,
  },
];

export function findUserById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}
