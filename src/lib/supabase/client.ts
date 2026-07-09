// Cliente Supabase singleton (lazy). Não inicializa até a primeira chamada —
// permite que a UI carregue mesmo sem env vars (erros aparecem só ao tentar
// usar o storage, dando margem pra fallback ou stub no dev local).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Nome do bucket de documentos do RMA. */
export const RMA_BUCKET = "rma-docs";

/** Tamanho máximo por arquivo em bytes (50 MB). */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

let cached: SupabaseClient<Database> | null = null;

/**
 * Retorna o cliente Supabase tipado, criando-o na primeira chamada. Lança erro
 * descritivo quando as env vars estão ausentes — não chama em tempo de
 * render, só em handlers (onClick/submit).
 */
export function getSupabase(): SupabaseClient<Database> {
  if (cached) return cached;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local (veja .env.example).",
    );
  }
  cached = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // Auth real: persistir a sessão (localStorage) + refresh automático do token,
    // pra o usuário continuar logado entre reloads e a sessão não expirar no uso.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return cached;
}

/** Indica se as env vars estão presentes — usar pra mostrar banner de aviso na UI. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
