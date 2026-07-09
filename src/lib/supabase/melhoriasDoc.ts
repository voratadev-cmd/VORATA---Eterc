// Read-model da C.15 Melhorias Documentais (tela INTERNA da Contratada · "arrumar a própria casa").
// Conteúdo qualitativo (achados/melhorias/desvios) autorado pelo Adm Contratual IA na revisão dos
// documentos da obra (RDOs, Atas, Relatórios), v46 fiel ao mockup C15_MelhoriasDoc. Duas fontes em
// obra_secoes: "Análise narrativa" (payload estruturado) + "Desvios do previsto" (tabela · 9 cards).
// Só leitura; null se a obra ainda não foi normalizada para a C.15.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

export type MelhoriasKpi = { label: string; valor: string; sub: string; farol?: string | null };
export type MelhoriasExemplo = { comoEsta: string; comoDeveria: string };
export type MelhoriasRdo = {
  titulo: string;
  farol: string | null;
  achados: string[];
  melhorias: string[];
  exemplo: MelhoriasExemplo | null;
};
export type MelhoriasAderencia = {
  titulo: string;
  semRegistro: string[];
  noPrazo: string[];
  iniciando: string[];
};
export type MelhoriasHistogramas = {
  titulo: string;
  gapsCriticos: number | null;
  naoMobilizado: string[];
  semPrevisao: string[];
  impossivel: string[];
};
export type MelhoriasAtas = {
  titulo: string;
  farol: string | null;
  achados: string[];
  melhorias: string[];
};
export type MelhoriasRelatorios = { titulo: string; notas: string[] };
export type MelhoriasNovoDoc = { titulo: string; nota: string };
export type MelhoriasDesviosHeader = { titulo: string; cff: string; nota: string };

export type MelhoriasDesvio = {
  sev: string; // "Crítico" | "Risco"
  item: string;
  previsto: string;
  real: string;
  justif: string;
  acao: string;
  fonte: string;
};

export type MelhoriasDocView = {
  subtitle: string;
  pageFarol: string | null;
  kpis: MelhoriasKpi[];
  rdo: MelhoriasRdo;
  aderencia: MelhoriasAderencia;
  histogramas: MelhoriasHistogramas;
  atas: MelhoriasAtas;
  relatorios: MelhoriasRelatorios;
  proximosRDO: string[];
  proximaAta: string[];
  horizonte: string[];
  novoDoc: MelhoriasNovoDoc;
  sintese: string;
  desviosHeader: MelhoriasDesviosHeader;
  ressalva: string;
  desvios: MelhoriasDesvio[];
};

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const str = (v: unknown): string => (v == null ? "" : String(v));

async function getSecaoDados(contractId: string, tituloLike: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", tituloLike)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.dados ?? null;
}

/** Melhorias Documentais (C.15) de uma obra. Null se ainda não normalizado. */
export async function getMelhoriasDoc(contractId: string): Promise<MelhoriasDocView | null> {
  const [narRaw, dvRaw] = await Promise.all([
    getSecaoDados(contractId, "%C.15%Análise narrativa%"),
    getSecaoDados(contractId, "%C.15%Desvios do previsto%"),
  ]);
  if (!narRaw || typeof narRaw !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = narRaw as any;

  const kpis: MelhoriasKpi[] = Array.isArray(n.kpis)
    ? n.kpis.map((k: Record<string, unknown>) => ({
        label: str(k.label),
        valor: str(k.valor),
        sub: str(k.sub),
        farol: k.farol != null ? String(k.farol) : null,
      }))
    : [];

  const desvios: MelhoriasDesvio[] = Array.isArray(dvRaw)
    ? (dvRaw as Array<Record<string, unknown>>).map((r) => ({
        sev: str(r["Sev."]),
        item: str(r["Item previsto"]),
        previsto: str(r["Previsto"]),
        real: str(r["Real / medido"]),
        justif: str(r["Justif.?"]),
        acao: str(r["Ação a tratar"]),
        fonte: str(r["Fonte"]),
      }))
    : [];

  return {
    subtitle: str(n.subtitle),
    pageFarol: n.pageFarol != null ? String(n.pageFarol) : null,
    kpis,
    rdo: {
      titulo: str(n.rdo?.titulo),
      farol: n.rdo?.farol != null ? String(n.rdo.farol) : null,
      achados: arr(n.rdo?.achados),
      melhorias: arr(n.rdo?.melhorias),
      exemplo: n.rdo?.exemplo
        ? { comoEsta: str(n.rdo.exemplo.comoEsta), comoDeveria: str(n.rdo.exemplo.comoDeveria) }
        : null,
    },
    aderencia: {
      titulo: str(n.aderencia?.titulo),
      semRegistro: arr(n.aderencia?.semRegistro),
      noPrazo: arr(n.aderencia?.noPrazo),
      iniciando: arr(n.aderencia?.iniciando),
    },
    histogramas: {
      titulo: str(n.histogramas?.titulo),
      gapsCriticos:
        typeof n.histogramas?.gapsCriticos === "number" ? n.histogramas.gapsCriticos : null,
      naoMobilizado: arr(n.histogramas?.naoMobilizado),
      semPrevisao: arr(n.histogramas?.semPrevisao),
      impossivel: arr(n.histogramas?.impossivel),
    },
    atas: {
      titulo: str(n.atas?.titulo),
      farol: n.atas?.farol != null ? String(n.atas.farol) : null,
      achados: arr(n.atas?.achados),
      melhorias: arr(n.atas?.melhorias),
    },
    relatorios: { titulo: str(n.relatorios?.titulo), notas: arr(n.relatorios?.notas) },
    proximosRDO: arr(n.proximosRDO),
    proximaAta: arr(n.proximaAta),
    horizonte: arr(n.horizonte),
    novoDoc: { titulo: str(n.novoDoc?.titulo), nota: str(n.novoDoc?.nota) },
    sintese: str(n.sintese),
    desviosHeader: {
      titulo: str(n.desviosHeader?.titulo),
      cff: str(n.desviosHeader?.cff),
      nota: str(n.desviosHeader?.nota),
    },
    ressalva: str(n.ressalva),
    desvios,
  };
}
