// Painel C.9 Chuvas (dias >5 mm proposta × real · "dias a cobrar") — lê as seções obra_secoes do
// workbook C.9/auxiliar_D.6. O REAL de dias >5 mm NÃO está em obra_chuvas_meses (só a proposta); foi
// normalizado nestas seções (acompanhamento mensal com REAL/RDO + apuração sem-compensação + totais).
// Headline "dias a cobrar = 2" (mai/26 · real 5 vs prop 3) — bate o oráculo; pleiteável R$ 279.804,80.

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
const normC = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** valor por coluna: match exato (normalizado) e depois por fragmento (cuidado com "mm" colidir). */
function pick(row: Row | undefined, ...frags: string[]): unknown {
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

async function getSecao(
  contractId: string,
  tituloFrag: string,
): Promise<{ colunas: string[] | null; dados: unknown } | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("colunas, dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message); // erro de leitura ≠ ausência silenciosa (erro = milhões)
  return ((data ?? [])[0] as { colunas: string[] | null; dados: unknown } | undefined) ?? null;
}
const arr = (s: { dados: unknown } | null): Row[] =>
  s && Array.isArray(s.dados) ? (s.dados as Row[]) : [];
const obj = (s: { dados: unknown } | null): Row | null =>
  s && s.dados && typeof s.dados === "object" && !Array.isArray(s.dados) ? (s.dados as Row) : null;

const MESES_CAL = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

export type ChuvaSerieMes = {
  mesAno: string; // "mar/26"
  diasProp: number | null;
  diasReal: number | null; // null = mês ainda não medido (RDO)
  delta: number | null;
  cobrarAcum: number | null;
  chuvaMmReal: number | null;
  farol: string | null;
};
export type ChuvaBaselineMes = { mes: string; mm: number | null };
export type ChuvaDiasMes = {
  mes: string;
  total: number | null; // dias de chuva (todos)
  impeditivos: number | null; // dias > 5 mm
  cal: Array<number | null>; // CAL 1..6
};
export type ChuvaApuracaoMes = {
  mes: string;
  real: number | null;
  prev: number | null;
  excedente: number | null;
  pleiteavel: number | null;
  total: number | null;
};
export type ChuvasPainel = {
  serieMensal: ChuvaSerieMes[];
  kpis: {
    diasPropostaAcum: number;
    diasRealAcum: number;
    deltaNet: number;
    diasACobrar: number;
    pleiteavelRs: number | null;
    nMesesReais: number;
  };
  baselineMm: ChuvaBaselineMes[]; // 12 meses-calendário (média histórica)
  diasChuva: ChuvaDiasMes[]; // 12 meses (total × >5mm × CAL 1-6)
  calTotais: number[]; // Σ ano por CAL (6 valores)
  apuracao: ChuvaApuracaoMes[];
  totais: {
    pleiteavelRs: number | null;
    mod: number | null;
    eqp: number | null;
    excedenteDias: number | null;
    hhOciosas: number | null;
  } | null;
  sintese: {
    veredito: string | null;
    diasACobrar: string | null;
    deltaNet: string | null;
    realVsProposta: string | null;
  } | null;
  leituraIA: string | null;
};

/** Painel C.9 a partir das seções. null se a obra não tem a C.9 normalizada. */
export async function getChuvasPainel(contractId: string): Promise<ChuvasPainel | null> {
  const [acompS, q1S, q2S, sintS, iaS, apurS, totS] = await Promise.all([
    getSecao(contractId, "C.9 — Acompanhamento mensal"),
    getSecao(contractId, "C.9 — Quadro 1"),
    getSecao(contractId, "C.9 — Quadro 2"),
    getSecao(contractId, "C.9 — Painel síntese"),
    getSecao(contractId, "C.9 — Leitura IA"),
    getSecao(contractId, "auxiliar_D.6 Chuva — Apuração"),
    getSecao(contractId, "auxiliar_D.6 Chuva — Totais"),
  ]);

  const acomp = arr(acompS);
  if (acomp.length === 0) return null;

  // série mensal (52) — proposta sempre; real só nos meses já lançados (RDO)
  const serieMensal: ChuvaSerieMes[] = acomp.map((r) => ({
    mesAno: String(pick(r, "mês/ano", "mes/ano", "mês", "mes") ?? "").trim(),
    diasProp: num(pick(r, "proposta")),
    diasReal: num(pick(r, "real (rdo", "real (r", ">5mm real")),
    delta: num(pick(r, "Δ dias", "delta")),
    cobrarAcum: num(pick(r, "cobrar")),
    // "chuva mm" é específico — "mm real" colidiria com "Dias >5mm REAL (RDO)".
    chuvaMmReal: num(pick(r, "chuva mm")),
    farol: str(pick(r, "farol")),
  }));

  // KPIs: só os meses COM real medido entram no acumulado (PENDENTE ≠ 0)
  const comReal = serieMensal.filter((m) => m.diasReal != null);
  const diasPropostaAcum = comReal.reduce((a, m) => a + (m.diasProp ?? 0), 0);
  const diasRealAcum = comReal.reduce((a, m) => a + (m.diasReal ?? 0), 0);
  const diasACobrar = comReal.reduce(
    (a, m) => a + Math.max(0, (m.diasReal ?? 0) - (m.diasProp ?? 0)),
    0,
  );

  // baseline histórico (Quadro 1): média 2020–2024 por mês. Usa a linha "MÉDIA" se houver; senão
  // calcula das linhas-ano numéricas.
  const q1 = arr(q1S);
  const linhaMedia = q1.find((r) => /m[ée]dia/i.test(String(pick(r, "ano") ?? "")));
  const anos = q1.filter((r) => num(pick(r, "ano")) != null);
  const baselineMm: ChuvaBaselineMes[] = MESES_CAL.map((mes) => {
    if (linhaMedia) return { mes, mm: num(linhaMedia[mes]) };
    const vals = anos.map((r) => num(r[mes])).filter((v): v is number => v != null);
    return {
      mes,
      mm: vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : null,
    };
  });

  // Quadro 2: dias de chuva total × >5mm × CAL 1-6 (por mês-calendário)
  const q2 = arr(q2S);
  const calTotais = [0, 0, 0, 0, 0, 0];
  const diasChuva: ChuvaDiasMes[] = MESES_CAL.map((mes) => {
    const r = q2.find((x) => normC(String(pick(x, "mês", "mes") ?? "")) === normC(mes));
    const cal = [1, 2, 3, 4, 5, 6].map((i) => num(pick(r ?? {}, `cal ${i}`)));
    cal.forEach((v, i) => (calTotais[i] += v ?? 0));
    return {
      mes,
      total: num(pick(r ?? {}, "dias de chuva", "med. dias de chuva", "dias chuva")),
      impeditivos: num(pick(r ?? {}, "> 5 mm", ">5 mm", "5 mm")),
      cal,
    };
  });

  // apuração mês a mês (excedente → pleiteável)
  const apuracao: ChuvaApuracaoMes[] = arr(apurS).map((r) => ({
    mes: String(pick(r, "mês", "mes") ?? "").trim(),
    real: num(pick(r, "real >5mm", "real >5")),
    prev: num(pick(r, "prev >5mm", "prev >5")),
    excedente: num(pick(r, "excedente")),
    pleiteavel: num(pick(r, "pleiteável mês", "pleiteavel mes")),
    total: num(pick(r, "total mês", "total mes")),
  }));

  const tot = obj(totS);
  const totais = tot
    ? {
        pleiteavelRs: num(pick(tot, "pleiteável (mod + eqp)", "(mod + eqp)")),
        mod: num(pick(tot, "pleiteável mod", "pleiteavel mod")),
        eqp: num(pick(tot, "pleiteável eqp", "pleiteavel eqp")),
        excedenteDias: num(pick(tot, "excedente (dias)", "excedente")),
        hhOciosas: num(pick(tot, "hh ociosas")),
      }
    : null;

  const sint = obj(sintS);
  const sintese = sint
    ? {
        veredito: str(pick(sint, "veredito")),
        diasACobrar: str(pick(sint, "diasacobrar", "cobrar")),
        deltaNet: str(pick(sint, "deltaacumuladonet", "delta")),
        realVsProposta: str(pick(sint, "diasreal5mmvsproposta", "vsproposta")),
      }
    : null;

  const ia = obj(iaS);

  return {
    serieMensal,
    kpis: {
      diasPropostaAcum,
      diasRealAcum,
      deltaNet: diasRealAcum - diasPropostaAcum,
      diasACobrar,
      pleiteavelRs: totais?.pleiteavelRs ?? null,
      nMesesReais: comReal.length,
    },
    baselineMm,
    diasChuva,
    calTotais: calTotais.map((v) => Math.round(v)),
    apuracao,
    totais,
    sintese,
    leituraIA: ia ? str(pick(ia, "conteudo", "conteúdo")) : null,
  };
}
