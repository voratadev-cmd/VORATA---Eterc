// AdminGuard · protege a área de gestão de usuários (/admin) — só MASTER entra.
// Delega ao guard genérico por capacidade (viewAdmin = master).

import { RequireCapability } from "./RequireCapability";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  return <RequireCapability cap="viewAdmin">{children}</RequireCapability>;
}
