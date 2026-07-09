// Read-model do PANORAMA (C.10). Junta três fontes:
//  • obra_panorama (1 row, TIPADA) — os 6 faróis de dimensão + consolidado + métricas (fonte do farol).
//  • obra_secoes "C.10 — Dimensão X" — KPIs/análise/crosslinks/cláusulas por dimensão (v46).
//  • obra_secoes "C.10 — Matriz de Nexo Causal" — desvios documentados (fato→doc→responsável→hipótese).
// HONESTIDADE: farol null = dimensão NÃO avaliada (pendente/sem dado) — nunca verde sobre área cega.

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { FarolLevel } from "@/lib/mocks/contracts";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type PanoramaKpi = { label: string; valor: string; fonte: string | null };
export type PanoramaDim = {
  chave: string;
  icone: string;
  label: string;
  nivel: FarolLevel | null;
  kpis: PanoramaKpi[];
  analise: string | null;
  crosslinks: string | null;
  clausulas: string | null;
};
export type PanoramaNexo = {
  frente: string;
  desvio: string;
  causa: string;
  responsavel: string;
  documento: string;
  hipotese: string;
  nivel: FarolLevel | null;
};
export type Panorama = {
  consolidado: FarolLevel | null;
  dimensoes: PanoramaDim[];
  nexo: PanoramaNexo[];
  nAvaliados: number;
  pctAreasLiberadas: number | null;
  diasParadosAcum: number | null;
  frentesImpedidasRs: number | null;
  status: string;
};

// ordem do mockup · col (obra_panorama, fonte do farol) → seção obra_secoes (keyword dentro de C.10).
// label/ícone são fallback — o real vem da seção (nome/icone do v46).
const DIMS: Array<{ col: string; chave: string; kw: string; label: string; icone: string }> = [
  {
    col: "farol_liberacoes_area",
    chave: "liberacoes",
    kw: "Liberações",
    label: "Liberações de Área",
    icone: "🏞️",
  },
  { col: "farol_projetos", chave: "projetos", kw: "Projetos", label: "Projetos", icone: "📐" },
  {
    col: "farol_precos_quantidades",
    chave: "precos",
    kw: "Preços",
    label: "Preços e Quantidades",
    icone: "💰",
  },
  {
    col: "farol_interferencias",
    chave: "interferencias",
    kw: "Interferências",
    label: "Interferências div./pontuais",
    icone: "⚠️",
  },
  {
    col: "farol_suprimentos_material",
    chave: "suprimentos",
    kw: "Suprimentos",
    label: "Suprimentos / Material",
    icone: "📦",
  },
  { col: "farol_clima_forca_maior", chave: "clima", kw: "Clima", label: "Clima", icone: "🌧️" },
];

const NIVEIS: FarolLevel[] = ["conforme", "observacao", "risco", "critico"];
function asNivel(v: unknown): FarolLevel | null {
  const s = String(v ?? "");
  return (NIVEIS as string[]).includes(s) ? (s as FarolLevel) : null;
}
// vocabulário do mockup/planilha → níveis fixos do DS (Regra do Farol: "Atenção"→risco; "Sem dado"→null).
function farolMockup(v: unknown): FarolLevel | null {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("crit")) return "critico";
  if (s.includes("aten") || s.includes("risco")) return "risco";
  if (s.includes("observ")) return "observacao";
  if (s.includes("conform")) return "conforme";
  return null;
}

type Secao = { titulo: string; dados: unknown; colunas: unknown };
const str = (v: unknown) => (v != null && v !== "" ? String(v) : null);

/** Panorama (C.10) de uma obra. Null se obra_panorama ainda não normalizado. */
export async function getPanorama(contractId: string): Promise<Panorama | null> {
  const [panRes, secRes] = await Promise.all([
    untypedTable("obra_panorama")
      .select("*")
      .eq("contrato_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    untypedTable("obra_secoes")
      .select("titulo, dados, colunas")
      .eq("contrato_id", contractId)
      .ilike("titulo", "C.10%"),
  ]);
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  if (panRes.error) throw new Error(panRes.error.message);
  if (secRes.error) throw new Error(secRes.error.message);
  if (!panRes.data) return null;
  const r = panRes.data as Record<string, unknown>;
  const secoes = (secRes.data ?? []) as Secao[];
  const num = (v: unknown) => (v != null ? Number(v) : null);

  const dimensoes: PanoramaDim[] = DIMS.map((d) => {
    const sec = secoes.find((s) => s.titulo.includes("Dimensão") && s.titulo.includes(d.kw));
    const dd = (sec?.dados ?? {}) as Record<string, unknown>;
    const kpisRaw = Array.isArray(dd.kpis) ? (dd.kpis as Array<Record<string, unknown>>) : [];
    return {
      chave: d.chave,
      icone: str(dd.icone) ?? d.icone,
      label: str(dd.nome) ?? d.label,
      nivel: asNivel(r[d.col]),
      kpis: kpisRaw.map((k) => ({
        label: String(k.label ?? ""),
        valor: String(k.valor ?? "—"),
        fonte: str(k.fonte),
      })),
      analise: str(dd.analise),
      crosslinks: str(dd.crosslinks),
      clausulas: str(dd.clausulas),
    };
  });

  const matriz = secoes.find((s) => s.titulo.includes("Matriz de Nexo"));
  const nexoRaw = Array.isArray(matriz?.dados)
    ? (matriz!.dados as Array<Record<string, unknown>>)
    : [];
  const nexo: PanoramaNexo[] = nexoRaw.map((n) => ({
    frente: String(n["Frente / disciplina"] ?? n.frente ?? ""),
    desvio: String(n["Desvio"] ?? n.desvio ?? ""),
    causa: String(n["Causa"] ?? n.causa ?? ""),
    responsavel: String(n["Responsável"] ?? n.responsavel ?? ""),
    documento: String(n["Documento"] ?? n.documento ?? ""),
    hipotese: String(n["Hipótese"] ?? n.hipotese ?? ""),
    nivel: farolMockup(n["Farol"] ?? n.farol),
  }));

  return {
    consolidado: asNivel(r.consolidado),
    dimensoes,
    nexo,
    nAvaliados: dimensoes.filter((d) => d.nivel != null).length,
    pctAreasLiberadas: num(r.pct_areas_liberadas),
    diasParadosAcum: num(r.dias_parados_acum),
    frentesImpedidasRs: num(r.frentes_impedidas_rs),
    status: String(r.status ?? "ok"),
  };
}
