// Sonda read-only p/ análise da SPEC 3 (ajustes-REVISADO-v3.docx) · obra SBSO.
// bun run scripts/parity/probe_spec3.ts > /tmp/spec3_db.json
import { getSupabase } from "../../src/lib/supabase/client";

const supabase = getSupabase();
const ID = "2187f2e1-c39e-42ff-adc0-f3ce79382ef1";
const out: Record<string, unknown> = {};

// 1 — marcos (contaminação trecho × natureza)
{
  const { data, error } = await supabase
    .from("obra_prazo_marcos")
    .select("ordem, categoria, trecho, data_limite, pct_concluido, status, farol")
    .eq("contrato_id", ID)
    .order("ordem");
  out.marcos = error ? { error: error.message } : data;
}

// 2 — cronograma (início 01/10?)
{
  const { data, error } = await supabase
    .from("obra_cronogramas")
    .select("inicio_obra, termino_obra, data_base, custo_total_obra")
    .eq("contrato_id", ID);
  out.cronogramas = error ? { error: error.message } : data;
}

// 3 — insumos: reeq + fontes fd + ipca_serie (regime INCC)
{
  const { data, error } = await supabase
    .from("obra_insumos_reeq")
    .select("*")
    .eq("contrato_id", ID);
  out.insumos_reeq = error ? { error: error.message } : data;
}
{
  const { data, error } = await supabase
    .from("obra_insumos_fd_fontes")
    .select("*")
    .eq("contrato_id", ID)
    .limit(8);
  out.insumos_fd_fontes = error ? { error: error.message } : data;
}
{
  const { data, error } = await supabase
    .from("obra_ipca_serie")
    .select("cenario_id, cenario_nome, mes, indice")
    .eq("contrato_id", ID)
    .order("mes");
  out.ipca_serie = error ? { error: error.message } : data;
}

// 4 — títulos de seções relevantes à spec
{
  const { data, error } = await supabase
    .from("obra_secoes")
    .select("titulo, n_linhas")
    .eq("contrato_id", ID);
  out.secoes_titulos = error
    ? { error: error.message }
    : (data ?? [])
        .filter((s) =>
          /c\.1|c\.4|c\.5|identifica|premissa|equipe|contato|segmenta|documento|natureza|marco|card/i.test(
            s.titulo ?? "",
          ),
        )
        .map((s) => `${s.titulo} (${s.n_linhas})`);
}

// 5 — seção C.4 cards por categoria (qtde)
{
  const { data, error } = await supabase
    .from("obra_secoes")
    .select("titulo, dados")
    .eq("contrato_id", ID)
    .ilike("titulo", "%CARDS POR CATEGORIA%");
  out.c4_cards_qtde = error ? { error: error.message } : data;
}

// 6 — natureza do avanço (seção fonte)
{
  const { data, error } = await supabase
    .from("obra_secoes")
    .select("titulo, dados")
    .eq("contrato_id", ID)
    .ilike("titulo", "%NATUREZA%");
  out.c5_natureza = error ? { error: error.message } : data;
}

// 7 — timeline params (datas OS/término em uso)
{
  const { data, error } = await supabase
    .from("obra_timeline_params")
    .select(
      "os_original, os_real, inicio_execucao, termino_previsto, termino_contratual, mes_corte_indice, marcos_total, marcos_em_risco, marcos_cumpridos",
    )
    .eq("contrato_id", ID);
  out.timeline_params = error ? { error: error.message } : data;
}

console.log(JSON.stringify(out, null, 2));
