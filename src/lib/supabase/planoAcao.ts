// Read-model do PLANO DE AÇÃO (C.12) — lê a captura genérica (obra_secoes JSONB) das seções C.12:
// Quadro de Tarefas (5W2H · consolida as condutas da C.11 em tarefas com responsável/prazo/urgência/
// status), Resumo/Cards (contagens + farol da aba) e Leitura IA. As tarefas nascem das condutas (C.11
// #N) — origem rastreável. null se a obra não tem as seções C.12 normalizadas.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
function pick(row: Row | null | undefined, ...frags: string[]): unknown {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const f of frags) {
    const k = keys.find((kk) => kk.toLowerCase() === f.toLowerCase());
    if (k) return row[k];
  }
  for (const f of frags) {
    const k = keys.find((kk) => kk.toLowerCase().includes(f.toLowerCase()));
    if (k) return row[k];
  }
  return null;
}

async function getSecaoTabela(contractId: string, frag: string): Promise<Row[] | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${frag}%`)
    .limit(1);
  if (error) throw new Error(error.message); // erro de leitura ≠ ausência silenciosa
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  return Array.isArray(dados) && dados.length > 0 ? (dados as Row[]) : null;
}
async function getSecaoObj(contractId: string, frag: string): Promise<Row | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${frag}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  return dados && typeof dados === "object" && !Array.isArray(dados) ? (dados as Row) : null;
}

export type FarolNivel = "conforme" | "observacao" | "risco" | "critico";

export type PlanoTarefa = {
  id: string;
  titulo: string;
  origem: string | null; // "C.11 #2"
  responsavel: string | null;
  prazo: string | null; // ISO "2026-06-10"
  urgencia: string | null; // "Crítica" / "Média" (sem o ●)
  frenteTrecho: string | null;
  status: string | null; // "Em Andamento" / "A Fazer" / "Concluída"
  vinculacao: string | null;
  porQue: string | null;
  esforco: string | null;
};
export type PlanoResumo = {
  total: number;
  aFazer: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
  vencendo: number; // < 7 dias
  criticasAtrasadas: number;
  slaMedioDias: number | null;
  vinculadasAC11: number | null;
  pctConcluidas: number | null; // 0..1
  farolNivel: FarolNivel;
  farolLabel: string; // label canônico do DS
  farolCriterio: string | null;
};
export type PlanoAcao = {
  tarefas: PlanoTarefa[];
  resumo: PlanoResumo | null;
  leituraIA: string | null;
};

// Vocabulário do workbook → níveis fixos do DS (Regra do Farol: sem "Atenção").
function mapFarol(raw: string | null): { nivel: FarolNivel; label: string } {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("crític") || s.includes("critic")) return { nivel: "critico", label: "Crítico" };
  if (s.includes("atenç") || s.includes("risco")) return { nivel: "risco", label: "Risco" };
  if (s.includes("observ")) return { nivel: "observacao", label: "Observação" };
  return { nivel: "conforme", label: "Conforme" };
}

/** Plano de Ação (C.12) a partir das seções obra_secoes. null se a obra não tem C.12 normalizada. */
export async function getPlanoAcao(contractId: string): Promise<PlanoAcao | null> {
  const [tarefasRows, resumoObj, leituraObj] = await Promise.all([
    getSecaoTabela(contractId, "C.12 Plano de Ação — Quadro"),
    getSecaoObj(contractId, "C.12 Plano de Ação — Resumo"),
    getSecaoObj(contractId, "C.12 Plano de Ação — Leitura"),
  ]);
  if (!tarefasRows && !resumoObj) return null;

  const tarefas: PlanoTarefa[] = (tarefasRows ?? []).map((r) => ({
    id: str(pick(r, "id (t", "id")) ?? "",
    titulo: str(pick(r, "título", "titulo")) ?? "",
    origem: str(pick(r, "origem")),
    responsavel: str(pick(r, "responsável", "responsavel")),
    prazo: str(pick(r, "prazo")),
    urgencia: (str(pick(r, "urgência", "urgencia")) ?? "").replace(/^[●○•]\s*/, "") || null,
    frenteTrecho: str(pick(r, "frente/trecho", "frente")),
    status: str(pick(r, "status")),
    vinculacao: str(pick(r, "vinculação", "vinculacao")),
    porQue: str(pick(r, "por quê", "por que", "justificativa")),
    esforco: str(pick(r, "esforço", "esforco")),
  }));

  const resumo: PlanoResumo | null = resumoObj
    ? (() => {
        const farol = mapFarol(str(pick(resumoObj, "faroldaaba", "farol")));
        return {
          total: num(pick(resumoObj, "totaldeacoes", "total")) ?? tarefas.length,
          aFazer: num(pick(resumoObj, "afazer")) ?? 0,
          emAndamento: num(pick(resumoObj, "emandamento")) ?? 0,
          concluidas: num(pick(resumoObj, "concluidas")) ?? 0,
          atrasadas: num(pick(resumoObj, "tarefasatrasadas", "atrasadas")) ?? 0,
          vencendo: num(pick(resumoObj, "vencendoemmenos7", "vencendo")) ?? 0,
          criticasAtrasadas: num(pick(resumoObj, "criticasatrasadas")) ?? 0,
          slaMedioDias: num(pick(resumoObj, "slamediodias", "sla")),
          vinculadasAC11: num(pick(resumoObj, "vinculadasac11", "vinculadas")),
          pctConcluidas: num(pick(resumoObj, "percentualavancoconcluidas", "percentual")),
          farolNivel: farol.nivel,
          farolLabel: farol.label,
          farolCriterio: str(pick(resumoObj, "farolcriterio", "criterio")),
        };
      })()
    : null;

  // o conteúdo da Leitura IA vem com prefixo "📝 LEITURA IA (...): " — limpa p/ exibição.
  const leituraIA = (str(pick(leituraObj, "conteudo", "leitura")) ?? "")
    .replace(/^📝?\s*LEITURA IA[^:]*:\s*/i, "")
    .trim();

  return { tarefas, resumo, leituraIA: leituraIA || null };
}
