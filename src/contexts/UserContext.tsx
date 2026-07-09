// Estado de autenticação da app — agora REAL (Supabase Auth), não mais mock.
//
// Dois hooks:
//  • useAuth()        — estado bruto: { user|null, status, signIn, logout }. Use
//                       em rota pública (login) e no guard do _app.
//  • useCurrentUser() — User GARANTIDO (lança se chamado fora de área logada) +
//                       atalhos de papel (isMaster/isAdmin/can). Use dentro do
//                       app shell, onde o guard já garante que há sessão.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { type Capability, type User, can } from "@/lib/auth/types";
import {
  fetchMe,
  onAuthChange,
  signIn as authSignIn,
  signOut as authSignOut,
} from "@/lib/auth/supabaseAuth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  /** Faz login e carrega o perfil. Retorna erro PT-BR pronto pra exibir. */
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Encerra a sessão. */
  logout: () => Promise<void>;
  /** Recarrega o usuário corrente (ex.: após o master mudar seu papel). */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const mounted = useRef(true);

  const load = useCallback(async (session?: Session | null) => {
    try {
      const me = await fetchMe(session);
      if (!mounted.current) return;
      setUser(me);
      setStatus(me ? "authenticated" : "unauthenticated");
    } catch {
      // Sem env Supabase ou falha de rede → trata como deslogado (mostra login).
      if (!mounted.current) return;
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!isSupabaseConfigured()) {
      setStatus("unauthenticated");
      return () => {
        mounted.current = false;
      };
    }
    // Restaura a sessão persistida + escuta login/logout/refresh (inclusive entre abas).
    void load();
    let unsub = () => {};
    try {
      unsub = onAuthChange((session) => void load(session));
    } catch {
      /* sem env — ignora */
    }
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [load]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await authSignIn(email, password);
      if (!res.ok) return { ok: false, error: res.error };
      await load(res.session);
      return { ok: true };
    },
    [load],
  );

  const logout = useCallback(async () => {
    try {
      await authSignOut();
    } finally {
      if (mounted.current) {
        setUser(null);
        setStatus("unauthenticated");
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signIn, logout, refresh: () => load() }),
    [user, status, signIn, logout, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <UserProvider>");
  return ctx;
}

/** Usuário GARANTIDO + atalhos de papel. Só use dentro do app shell (pós-guard). */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) {
    throw new Error(
      "useCurrentUser foi chamado sem usuário logado — em rota pública use useAuth() e trate o estado.",
    );
  }
  return {
    user,
    role: user.role,
    isMaster: user.role === "master",
    isAdmin: user.role === "admin",
    /** O usuário corrente pode realizar a capacidade? (manageUsers/registerObras/viewAdmin) */
    can: (capability: Capability) => can(user.role, capability),
  };
}
