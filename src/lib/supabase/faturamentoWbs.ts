// Read-model do drill Disciplina × Frente no dialeto SBSO (workbook-motor) — a hierarquia WBS
// COMPLETA do "auxiliar_C.3 — Cronograma Físico-Financeiro (Baseline)" (colunas Cód./Nível/Folha/
// Disciplina/Frente · Bloco Contratado|Real · Métrica "R$ Mês" · Mês 1..18).
//
// REGRAS VALIDADAS AO CENTAVO contra o "C.3 — Resumo por Frente" da própria fonte:
//   • a árvore NÃO é confiável linha a linha: no bloco Real as linhas-pai vêm sub-agregadas
//     (a 1.1 carrega só o 1.1.1 → real 2,13 mi em vez de 2.453.151,38 — defeito da fonte,
//     spec ajustes-REVISADO-v3). E somar NÍVEIS conta o mesmo real várias vezes. Por isso
//     TODA célula exibida é agregada de FOLHAS (Folha='S'):
//     – disciplinas = nível 2 (1.1..1.9), célula = Σ folhas do prefixo · filhos = nível 3,
//       célula = Σ folhas do prefixo (há folhas nível 4 — filho n3 também não é confiável cru);
//     – frentes = folhas agregadas pela coluna Frente
//       (TPS Σ folhas = 30.639.182,94 = o Contratado que o Resumo por Frente declara).
//     Invariante v3 nº1: TOTAL Real por Disciplina == por Frente == 10.219.922,61 (BM-9).
//   • contratado = Σ Mês 1..18 · até período = Σ Mês 1..n · real = Σ Mês 1..n do bloco Real,
//     onde n = último mês com Real > 0 em qualquer folha (SBSO: 9 = jun/26; confere
//     TPS até-período 11.216.431,88 e real 6.612.480,49 exatos).
//   • filhos: por disciplina = WBS nível 3 (spec: "descer até 1.3.1"); por frente = folhas
//     (até 1.3.3.1), rotuladas "cód descrição · disciplina", maiores primeiro.
// Obras sem as colunas Nível/Folha (BR-101) → null (o drill continua no fluxo atual).

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
const r2 = (v: number): number => Math.round(v * 100) / 100;

export type WbsCel = {
  contratado: number | null;
  acum: number | null;
  real: number | null;
};
export type WbsFilho = WbsCel & { nome: string };
export type WbsLinha = WbsCel & { nome: string; filhos: WbsFilho[] };
export type FaturamentoWbs = {
  disciplinas: WbsLinha[];
  frentes: WbsLinha[];
  /** nº de meses da janela "até o período" (último mês com Real > 0). */
  mesesAtePeriodo: number;
};

type No = {
  cod: string;
  nivel: number;
  folha: boolean;
  nome: string;
  disciplina: string | null;
  frente: string | null;
  contratadoMeses: number[];
  realMeses: number[];
};

/** Drill WBS (dialeto SBSO). null se o auxiliar não tem a hierarquia (Nível/Folha). */
export async function getFaturamentoWbs(contractId: string): Promise<FaturamentoWbs | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", "auxiliar_C.3%")
    .limit(1);
  if (error) throw new Error(error.message);
  const rows = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Dois blocos empilhados na planilha (Contratado × Real), MESMA sequência de atividades. As
  // linhas do bloco Real vêm com Cód. NULO e headers deslocados (defeito de merge da fonte) —
  // o pareamento é POSICIONAL (k-ésima linha ↔ k-ésima linha), validado por Nível+Frente+Folha;
  // par que não valida é descartado (nunca chuta o real de outra atividade).
  const contraRows: Row[] = [];
  const realRows: Row[] = [];
  for (const raw of rows as Row[]) {
    if (str(raw["Métrica"]) !== "R$ Mês") continue;
    const bloco = str(raw["Bloco"]);
    if (bloco === "Contratado") contraRows.push(raw);
    else if (bloco === "Real") realRows.push(raw);
  }
  // slots POSICIONAIS 1:1 com contraRows (linha inválida vira null e preserva o alinhamento
  // com o bloco Real — uma linha sem Cód. no meio não pode deslocar todos os pares seguintes)
  const slots: (No | null)[] = [];
  const nos = new Map<string, No>();
  for (const raw of contraRows) {
    const cod = str(raw["Cód."]);
    const nivel = num(raw["Nível"]);
    if (!cod || nivel == null) {
      slots.push(null);
      continue;
    }
    const no: No = {
      cod,
      nivel,
      folha: str(raw["Folha"]) === "S",
      nome: str(raw["Descrição da Atividade"]) ?? cod,
      disciplina: str(raw["Disciplina"]),
      frente: str(raw["Frente"]),
      contratadoMeses: Array(18).fill(0),
      realMeses: Array(18).fill(0),
    };
    for (let g = 1; g <= 18; g++) {
      const v = num(raw[`Mês ${g}`]);
      if (v != null) no.contratadoMeses[g - 1] = v;
    }
    slots.push(no);
    nos.set(cod, no);
  }
  const nosOrdenados: No[] = slots.filter((x): x is No => x != null);
  if (nosOrdenados.length === 0) return null;
  if (realRows.length === slots.length) {
    for (let i = 0; i < realRows.length; i++) {
      const raw = realRows[i];
      const no = slots[i];
      if (!no) continue;
      const nivelOk = num(raw["Nível"]) === no.nivel;
      const frenteOk = (str(raw["Frente"]) ?? "") === (no.frente ?? "");
      const folhaOk = (str(raw["Folha"]) === "S") === no.folha;
      if (!nivelOk || !frenteOk || !folhaOk) continue;
      for (let g = 1; g <= 18; g++) {
        const v = num(raw[`Mês ${g}`]);
        if (v != null) no.realMeses[g - 1] = v;
      }
    }
  }

  // n = último mês com Real > 0 em qualquer folha (a janela "até o período" da fonte)
  let n = 0;
  for (const no of nos.values()) {
    if (!no.folha) continue;
    for (let g = 18; g > n; g--) {
      if (no.realMeses[g - 1] > 0) {
        n = g;
        break;
      }
    }
  }
  if (n === 0) n = 18; // sem real medido → janela cheia (não fabrica corte)

  const soma = (xs: number[], ate: number): number => {
    let t = 0;
    for (let i = 0; i < ate; i++) t += xs[i];
    return r2(t);
  };
  const celDe = (no: No): WbsCel => ({
    contratado: soma(no.contratadoMeses, 18),
    acum: soma(no.contratadoMeses, n),
    real: soma(no.realMeses, n),
  });

  const lista = nosOrdenados;
  const ordCod = (a: No, b: No) =>
    a.cod.localeCompare(b.cod, undefined, { numeric: true, sensitivity: "base" });

  // Célula agregada das FOLHAS de um prefixo WBS (inclui o próprio nó quando ele é folha).
  // É a única agregação confiável: as linhas-pai do bloco Real vêm sub-agregadas da fonte.
  const celDeFolhas = (prefixo: string): WbsCel => {
    const fs = lista.filter(
      (f) => f.folha && (f.cod === prefixo || f.cod.startsWith(`${prefixo}.`)),
    );
    if (!fs.length) return { contratado: null, acum: null, real: null };
    return {
      contratado: r2(fs.reduce((s, f) => s + soma(f.contratadoMeses, 18), 0)),
      acum: r2(fs.reduce((s, f) => s + soma(f.contratadoMeses, n), 0)),
      real: r2(fs.reduce((s, f) => s + soma(f.realMeses, n), 0)),
    };
  };

  // ── Por disciplina: pais = nível 2 · filhos = nível 3 do mesmo prefixo (spec: até 1.3.1);
  //    células SEMPRE Σ folhas do prefixo (linha-pai da fonte herda só o 1º filho no Real) ──
  const disciplinas: WbsLinha[] = lista
    .filter((no) => no.nivel === 2)
    .sort(ordCod)
    .map((no) => ({
      nome: no.disciplina ?? no.nome,
      ...celDeFolhas(no.cod),
      filhos: lista
        .filter((f) => f.nivel === 3 && f.cod.startsWith(`${no.cod}.`))
        .sort(ordCod)
        .map((f) => ({ nome: `${f.cod} ${f.nome}`, ...celDeFolhas(f.cod) })),
    }));

  // ── Por frente: pais = agregado das FOLHAS pela coluna Frente · filhos = as folhas ──
  const porFrente = new Map<string, No[]>();
  for (const no of lista) {
    if (!no.folha) continue;
    const fr = no.frente ?? "—";
    (porFrente.get(fr) ?? porFrente.set(fr, []).get(fr)!).push(no);
  }
  const frentes: WbsLinha[] = [...porFrente.entries()]
    .map(([frente, folhas]) => {
      const cel: WbsCel = {
        contratado: r2(folhas.reduce((s, f) => s + soma(f.contratadoMeses, 18), 0)),
        acum: r2(folhas.reduce((s, f) => s + soma(f.contratadoMeses, n), 0)),
        real: r2(folhas.reduce((s, f) => s + soma(f.realMeses, n), 0)),
      };
      return {
        nome: frente,
        ...cel,
        filhos: folhas
          .sort((a, b) => soma(b.contratadoMeses, 18) - soma(a.contratadoMeses, 18))
          .map((f) => ({
            nome: `${f.cod} ${f.nome}${f.disciplina ? ` · ${f.disciplina}` : ""}`,
            ...celDe(f),
          })),
      };
    })
    .sort((a, b) => (b.contratado ?? 0) - (a.contratado ?? 0));

  return { disciplinas, frentes, mesesAtePeriodo: n };
}
