// Read-model da tela D.3 Encargos Sociais — lê as seções obra_secoes D.3 (Composição alíquota
// Proposta × Real, 27 rubricas · Totais/desequilíbrio/parâmetros). O desequilíbrio de encargos só
// aparece quando a alíquota REAL muda (tipicamente mudança legislativa · reoneração Lei 14.973/24);
// hoje Real = Proposta → desequilíbrio R$ 0 (Aderente · Conforme). PV vem do contexto de desequilíbrio.

import { getSupabase } from "./client";
import { getDeseqContexto } from "./deseqContexto";
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
const normC = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const MESES_ABBR: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};
/** "jan-26" / "mar/2026" / "jan de 2026" → [ano, mes]. null quando não parseável (rótulo cru mantido). */
function parseMesAbbr(label: string | null): [number, number] | null {
  if (!label) return null;
  const m = normC(label).match(/([a-z]{3})[a-z]*[\s\-/]*?(\d{2,4})/);
  if (!m) return null;
  const mes = MESES_ABBR[m[1]];
  if (!mes) return null;
  const y = Number(m[2]);
  return [y < 100 ? y + 2000 : y, mes];
}
function pick(row: Row | null | undefined, ...frags: string[]): unknown {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const f of frags) {
    const k = keys.find((kk) => normC(kk) === normC(f));
    if (k) return row[k];
  }
  for (const f of frags) {
    const k = keys.find((kk) => normC(kk).includes(normC(f)));
    if (k) return row[k];
  }
  return null;
}
async function getSecaoDados(contractId: string, tituloFrag: string): Promise<unknown> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message); // erro de leitura ≠ ausência silenciosa (erro = milhões)
  return ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados ?? null;
}

export type EncargoNivel = "conforme" | "observacao" | "risco" | "critico" | null;

export type EncargoRubrica = {
  cod: string;
  descricao: string;
  /** linha-cabeçalho de grupo (A/B/D) — sem alíquotas. */
  isGrupo: boolean;
  /** alíquotas em FRAÇÃO (0,20 = 20%). */
  modProposta: number | null;
  modReal: number | null;
  moiProposta: number | null;
  moiReal: number | null;
  /** Real ≠ Proposta em qualquer eixo. */
  divergente: boolean;
};

export type Encargos = {
  nome: string | null;
  composicao: EncargoRubrica[];
  /** totais (fração): TOTAL ENCARGOS Mensalista. */
  modTotalProposta: number | null;
  modTotalReal: number | null;
  moiTotalProposta: number | null;
  moiTotalReal: number | null;
  /** folha-base (MOD + MOI · sem encargos) · seletor Histograma (default gravado). */
  baseFolhaRs: number | null;
  /** split da folha-base: MOD (seletor Histograma/CPU) + MOI (Adm Local). Derivado das fontes reais
   * (CPU Check "Cruzamento histograma de recursos × CPU" ÷ alíquota TOTAL MOD); reconcilia ao centavo
   * com baseFolhaRs (modFolhaHist + moiFolha = baseFolhaRs). null se a obra não tem a CPU Check. */
  modFolhaHist: number | null; // MOD via histograma de recursos mobilizados
  modFolhaCpu: number | null; // MOD via CPU precificada no contrato
  moiFolha: number | null; // MOI (Adm Local)
  /** Distribuição temporal da folha-base MOD (Histograma) — cada mês = "MOD Contr.(R$)" da C.4 ÷
   * (1 + alíquota TOTAL MOD), i.e. a folha-base SEM encargos do mês. Reconciliação-neutro:
   * Σ folhaBaseRs = modFolhaHist por construção (divisão linear pelo mesmo fator). Serve ao gráfico
   * de exposição no tempo da simulação de reoneração (Lei 14.973/24) — NUNCA soma ao desequilíbrio
   * apurado. null quando a C.4 (Σ mensal) não está disponível ou o fator MOD é desconhecido. */
  folhaModMensal:
    | { label: string; ano: number | null; mes: number | null; folhaBaseRs: number }[]
    | null;
  /** fontes do split (COM encargos · R$), p/ a nota explicativa do card. */
  recursosMobMod: number | null; // histograma de recursos MOD (≈ R$ 70,13 mi)
  modCpuContrato: number | null; // MOD precificada na CPU (≈ R$ 51,45 mi)
  desequilibrioRs: number | null;
  pctSobrePV: number | null; // fração
  deltaAliquotaMod: number | null; // p.p.
  regime: string | null;
  farol: EncargoNivel;
  statusLabel: string | null; // "Aderente"
  baseModSeletor: string | null; // "Histograma"
  cprbCronograma: string | null;
  /** PV (denominador do "% sobre o PV"). */
  valorContratado: number | null;
};

function farolNivel(raw: string | null): EncargoNivel {
  const s = normC(raw ?? "");
  if (s.includes("conform")) return "conforme";
  if (s.includes("observ") || s.includes("atenc")) return "observacao";
  if (s.includes("risco")) return "risco";
  if (s.includes("critic")) return "critico";
  return null;
}

/** D.3 Encargos a partir das seções. null se a obra não tem a composição normalizada. */
export async function getEncargos(contractId: string): Promise<Encargos | null> {
  const [compRaw, totRaw, cruzRaw, c4Raw, ctx] = await Promise.all([
    getSecaoDados(contractId, "D.3 Encargos Sociais — Bloco 1"),
    getSecaoDados(contractId, "D.3 Encargos Sociais — Totais"),
    getSecaoDados(contractId, "Cruzamento histograma de recursos"),
    getSecaoDados(contractId, "C.4 — Histograma mensal MOD"),
    getDeseqContexto(contractId),
  ]);
  const compArr = Array.isArray(compRaw) ? (compRaw as Row[]) : null;
  if (!compArr || compArr.length === 0) return null;

  const composicao: EncargoRubrica[] = compArr.map((r) => {
    const modProposta = num(pick(r, "mod proposta"));
    const modReal = num(pick(r, "mod real"));
    const moiProposta = num(pick(r, "moi proposta"));
    const moiReal = num(pick(r, "moi real"));
    const isGrupo = modProposta == null && moiProposta == null;
    return {
      cod: str(pick(r, "cod")) ?? "",
      descricao: str(pick(r, "descricao", "descrição")) ?? "",
      isGrupo,
      modProposta,
      modReal,
      moiProposta,
      moiReal,
      divergente: !isGrupo && (modProposta !== modReal || moiProposta !== moiReal),
    };
  });

  const t = totRaw && typeof totRaw === "object" && !Array.isArray(totRaw) ? (totRaw as Row) : null;
  const regimeRaw = str(pick(t, "regime"));
  const modTotalReal = num(pick(t, "mod real (fracao", "mod real"));
  const baseFolhaRs = num(pick(t, "folha base (sem encargos", "folha base"));

  // Split da folha-base (sem encargos). A MOD COM encargos vem de duas fontes reais:
  //  · Histograma = recursos mobilizados → Σ dos 52 meses de "MOD Contr.(R$)" da C.4 (precisão cheia;
  //    a CPU Check "Cruzamento" arredonda esse total a inteiro → drift de R$ 1 no total CPU);
  //  · CPU expandido = MOD precificada no contrato → CPU Check "Cruzamento histograma de recursos × CPU".
  // Converte p/ folha-base ÷ (1 + alíquota TOTAL MOD). A MOI (Adm Local) = folha-base total gravada
  // − MOD (Histograma), reconciliando ao centavo com baseFolhaRs (cross-check: Σ "MOI Contr.(R$)" da
  // C.4 ÷ (1 + alíquota MOI) bate o mesmo valor). Reconcilia exato com os 3 constantes do mockup.
  const cruzArr = Array.isArray(cruzRaw) ? (cruzRaw as Row[]) : [];
  const modCruz = cruzArr.find((r) => normC(str(pick(r, "recurso")) ?? "") === "mod");
  const c4Arr = Array.isArray(c4Raw) ? (c4Raw as Row[]) : [];
  const modContrSum = c4Arr.reduce((acc, r) => acc + (num(pick(r, "mod contr.(r$)")) ?? 0), 0);
  const recursosMobMod = modContrSum > 0 ? modContrSum : num(pick(modCruz, "histograma"));
  const modCpuContrato = num(pick(modCruz, "cpu expandido", "cpu"));
  const fatorMod = modTotalReal != null ? 1 + modTotalReal : null;
  const modFolhaHist = recursosMobMod != null && fatorMod ? recursosMobMod / fatorMod : null;
  const modFolhaCpu = modCpuContrato != null && fatorMod ? modCpuContrato / fatorMod : null;
  const moiFolha = baseFolhaRs != null && modFolhaHist != null ? baseFolhaRs - modFolhaHist : null;

  // Série temporal da folha-base MOD (Histograma) p/ o gráfico de exposição da simulação. Cada mês
  // é a folha-base SEM encargos = "MOD Contr.(R$)" do mês ÷ (1 + alíquota TOTAL MOD). Por construção,
  // Σ folhaBaseRs = (Σ MOD Contr.(R$)) ÷ fator = recursosMobMod ÷ fator = modFolhaHist (guard no front).
  // Só existe quando a Σ mensal veio da C.4 (não do fallback "Cruzamento", que não tem meses).
  const folhaModMensal =
    fatorMod && modContrSum > 0
      ? c4Arr
          .map((r) => {
            const modContrRs = num(pick(r, "mod contr.(r$)", "mod contr. r$"));
            if (modContrRs == null) return null;
            const ym = parseMesAbbr(
              str(pick(r, "período", "periodo", "mês", "mes", "competência")),
            );
            return {
              label: str(pick(r, "período", "periodo", "mês", "mes", "competência")) ?? "",
              ano: ym?.[0] ?? null,
              mes: ym?.[1] ?? null,
              folhaBaseRs: modContrRs / fatorMod,
            };
          })
          .filter((m): m is NonNullable<typeof m> => m != null)
      : null;

  return {
    nome: ctx.nome,
    composicao,
    modTotalProposta: num(pick(t, "mod proposta (fracao", "mod proposta")),
    modTotalReal,
    moiTotalProposta: num(pick(t, "moi proposta (fracao", "moi proposta")),
    moiTotalReal: num(pick(t, "moi real (fracao", "moi real")),
    baseFolhaRs,
    modFolhaHist,
    modFolhaCpu,
    moiFolha,
    folhaModMensal: folhaModMensal && folhaModMensal.length > 0 ? folhaModMensal : null,
    recursosMobMod,
    modCpuContrato,
    desequilibrioRs: num(pick(t, "desequilibrio encargos")),
    pctSobrePV: num(pick(t, "% sobre pv")),
    deltaAliquotaMod: num(pick(t, "delta aliquota mod", "δ aliquota mod")),
    regime: regimeRaw ? regimeRaw.replace(/\s*\(input\)\s*/i, "").trim() : null,
    farol: farolNivel(str(pick(t, "farol"))),
    statusLabel: str(pick(t, "status (desequilibrio", "status (desequil")),
    baseModSeletor: str(pick(t, "base de mod para a folha")),
    cprbCronograma: str(pick(t, "cronograma lei 14.973")),
    valorContratado: ctx.valorContratado,
  };
}
