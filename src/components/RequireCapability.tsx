// RequireCapability · guard de rota por CAPACIDADE de papel (master/admin/regular).
// Quem não tem a capacidade é redirecionado pra "/" (silencioso). Renderiza null
// durante o redirect (evita flash do conteúdo restrito). É client-side — a barreira
// dura (RLS/servidor) entra na fase de RBAC granular; aqui é o controle de UI/MVP.
//
// Uso: <RequireCapability cap="registerObras"><NovaObra/></RequireCapability>

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import type { Capability } from "@/lib/auth/types";

export function RequireCapability({
  cap,
  children,
}: {
  cap: Capability;
  children: React.ReactNode;
}) {
  const { can } = useCurrentUser();
  const navigate = useNavigate();
  const allowed = can(cap);

  useEffect(() => {
    if (!allowed) void navigate({ to: "/" });
  }, [allowed, navigate]);

  if (!allowed) return null;
  return <>{children}</>;
}
