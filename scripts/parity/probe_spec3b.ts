// Sonda 2 — conteúdo das seções KV da C.1 + títulos completos (SPEC 3).
// bun run scripts/parity/probe_spec3b.ts > /tmp/spec3b_db.json
import { getSupabase } from "../../src/lib/supabase/client";

const supabase = getSupabase();
const ID = "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const out: Record<string, unknown> = {};

// 1 — todos os títulos de seção (p/ achar Identificação/Prazos sob outro nome)
{
  const { data, error } = await supabase
    .from("obra_secoes")
    .select("titulo, n_linhas, tipo")
    .eq("contrato_id", ID)
    .order("ordem");
  out.todos_titulos = error
    ? { error: error.message }
    : (data ?? []).map((s) => `${s.titulo} · ${s.tipo ?? "?"} · ${s.n_linhas}`);
}

// 2 — dados das seções C.1 relevantes à spec
for (const [key, like] of [
  ["painel3", "%Painel 3: Informações Econômico%"],
  ["painel_adm", "%Painel Administração Contratual%"],
  ["area_escopo", "%Área / Escopo Físico%"],
  ["docs_chave", "C.1%Documentos-chave%"],
  ["segmentacao", "%Segmentação física por edificação%"],
  ["resumo_disciplina", "%Resumo por Disciplina%"],
  ["c5_painel", "%C.5 — Painel de Prazo Físico%"],
  ["c6_cards", "C.6 Insumos — Cards%"],
] as const) {
  const { data, error } = await supabase
    .from("obra_secoes")
    .select("titulo, dados")
    .eq("contrato_id", ID)
    .ilike("titulo", like)
    .limit(1);
  out[key] = error ? { error: error.message } : (data?.[0] ?? null);
}

console.log(JSON.stringify(out, null, 2));
