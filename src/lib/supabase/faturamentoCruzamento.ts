// Cruzamento Frente × Disciplina do C.3 Faturamento (filhos do drill) — lê a captura genérica
// `auxiliar_C.3` (Cronograma físico-financeiro Previsto × Realizado por atividade · obra_secoes JSONB).
// Cada linha é uma ATIVIDADE com Frente + Disciplina + Bloco (Contratado/Real) + Métrica + AcumBM.
// Agrega por (Frente, Disciplina): Contratado = Σ Valor[Contratado] · Acum.BM = Σ AcumBM[Contratado]
// (previsto até o corte) · Real = Σ AcumBM[Real] (medido até o corte). Aderência = Real ÷ Acum.BM,
// farol pela régua oficial faturamento_aderencia_acumulada (90/85/70, configurável por contrato).
// Bate o oráculo ao centavo (ex.: Trecho 01 · Terraplenagem = 28,94 / 3,23 / 1,02 / 32% Crítico).

import { getSupabase } from "./client";
import { getObraById } from "./obras";
import {
  classificarMaiorMelhor,
  farolOverridesDe,
  type FarolLevel,
  mesclarRegras,
} from "@/lib/rma/farol";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
function normTxt(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export type CruzCelula = {
  contratado: number | null;
  previstoAcum: number | null;
  realAcum: number | null;
  aderencia: number | null; // fração real ÷ previsto (null se nada previsto)
  farol: FarolLevel | null;
};
export type CruzItem = CruzCelula & { nome: string };
export type FaturamentoCruzamento = {
  /** filhos por disciplina (key = nome normalizado da disciplina) → frentes daquela disciplina. */
  porDisciplina: Record<string, CruzItem[]>;
  /** filhos por frente (key = nome normalizado da frente) → disciplinas daquela frente. */
  porFrente: Record<string, CruzItem[]>;
};

/** Cross Frente × Disciplina do C.3 (filhos do drill). null se a obra não tem a aba auxiliar_C.3. */
export async function getFaturamentoCruzamento(
  contractId: string,
): Promise<FaturamentoCruzamento | null> {
  const [secRes, obra] = await Promise.all([
    untypedTable("obra_secoes")
      .select("dados")
      .eq("contrato_id", contractId)
      .ilike("titulo", "%auxiliar_C.3%")
      .limit(1),
    getObraById(contractId),
  ]);
  if (secRes.error) throw new Error(secRes.error.message); // erro de leitura ≠ ausência (erro = milhões)
  const dados = ((secRes.data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  if (!Array.isArray(dados) || dados.length === 0) return null;

  const cortes = mesclarRegras(farolOverridesDe(obra?.farol_regras)).faturamento_aderencia_acumulada
    .cortes;

  // matriz [frente][disciplina] = {contratado, previstoAcum, realAcum} · só a métrica em R$/mês.
  type Acc = { contratado: number; previstoAcum: number; realAcum: number };
  const matriz = new Map<string, Map<string, Acc & { frente: string; disciplina: string }>>();
  for (const r of dados as Row[]) {
    if (String(r["Métrica"] ?? "") !== "R$ Mês") continue;
    const frente = String(r["Frente"] ?? "").trim();
    const disciplina = String(r["Disciplina"] ?? "").trim();
    if (!frente || !disciplina) continue;
    const bloco = String(r["Bloco"] ?? "");
    const valor = num(r["Valor (R$)"]) ?? 0;
    const acumBM = num(r["AcumBM"]) ?? 0;
    const fk = normTxt(frente);
    if (!matriz.has(fk)) matriz.set(fk, new Map());
    const linha = matriz.get(fk)!;
    const dk = normTxt(disciplina);
    if (!linha.has(dk))
      linha.set(dk, { frente, disciplina, contratado: 0, previstoAcum: 0, realAcum: 0 });
    const cell = linha.get(dk)!;
    if (bloco === "Contratado") {
      cell.contratado += valor;
      cell.previstoAcum += acumBM;
    } else if (bloco === "Real") {
      cell.realAcum += acumBM;
    }
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const finaliza = (a: Acc): CruzCelula => {
    const aderencia = a.previstoAcum > 0 ? a.realAcum / a.previstoAcum : null;
    return {
      contratado: r2(a.contratado),
      previstoAcum: r2(a.previstoAcum),
      realAcum: r2(a.realAcum),
      aderencia,
      farol: aderencia != null ? classificarMaiorMelhor(aderencia * 100, cortes) : null,
    };
  };

  const porFrente: Record<string, CruzItem[]> = {};
  const porDisciplina: Record<string, CruzItem[]> = {};
  for (const [fk, linha] of matriz) {
    const itens = [...linha.values()]
      .map((c) => ({ nome: c.disciplina, ...finaliza(c) }))
      .sort((a, b) => (b.contratado ?? 0) - (a.contratado ?? 0));
    porFrente[fk] = itens;
    for (const c of linha.values()) {
      const dk = normTxt(c.disciplina);
      (porDisciplina[dk] ??= []).push({ nome: c.frente, ...finaliza(c) });
    }
  }
  for (const dk of Object.keys(porDisciplina)) {
    porDisciplina[dk].sort((a, b) => (b.contratado ?? 0) - (a.contratado ?? 0));
  }

  return { porDisciplina, porFrente };
}
