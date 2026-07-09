// Camada de autenticação REAL via Supabase Auth.
// Encapsula signIn/signOut/getSession + a montagem do `User` da app a partir de
// auth.users + profiles + user_roles. O UserContext consome só estas funções —
// trocar de provedor no futuro mexe aqui, não nos consumers.

import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { type User, type UserRole, highestRole, isUserRole } from "./types";

export type SignInResult = { ok: true; session: Session } | { ok: false; error: string };

/** Traduz erros do Supabase Auth pra mensagens PT-BR amigáveis (sem vazar detalhe técnico). */
function traduzErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("network") || m.includes("fetch")) return "Falha de conexão. Tente de novo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um instante.";
  return "Não foi possível entrar. Tente de novo.";
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.session) {
    return { ok: false, error: traduzErro(error?.message ?? "") };
  }
  return { ok: true, session: data.session };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session ?? null;
}

/** Inscreve mudanças de sessão (login/logout/refresh). Retorna unsubscribe. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

function iniciais(nome: string, email: string): string {
  const base = (nome || email || "").trim();
  if (!base) return "?";
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0]![0]! + partes[1]![0]!).toUpperCase();
  return (
    base
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/**
 * Monta o `User` da app a partir da sessão: lê profiles + user_roles (RLS deixa
 * cada um ler o próprio). Sem nenhum papel atribuído → "regular" (acesso mínimo).
 * Retorna null se não houver sessão.
 */
export async function fetchMe(session?: Session | null): Promise<User | null> {
  const supabase = getSupabase();
  const sess = session ?? (await getSession());
  if (!sess) return null;

  const uid = sess.user.id;
  const email = sess.user.email ?? "";

  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("nome, empresa, created_at").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
  ]);

  const profile = profileRes.data;
  const roles: UserRole[] = (rolesRes.data ?? []).map((r) => String(r.role)).filter(isUserRole);
  const role = highestRole(roles) ?? "regular";

  const nome = profile?.nome?.trim() || email.split("@")[0] || "Usuário";

  return {
    id: uid,
    name: nome,
    email,
    role,
    initials: iniciais(nome, email),
    subtitle: profile?.empresa?.trim() || "",
    createdAtISO: profile?.created_at ?? sess.user.created_at ?? new Date().toISOString(),
    lastSeenISO: null,
    ativo: true,
  };
}
