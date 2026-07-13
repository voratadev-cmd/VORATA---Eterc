// Detalhamento por FUNÇÃO/EQUIPAMENTO dos Recursos (C.4) — lê a captura genérica (obra_secoes JSONB)
// das 3 abas-detalhe do workbook, que a normalização tipada (obra_recursos) ainda não cobre:
//   • MOD = "auxiliar_C.4 MOD Detalhe"  (histograma por função · pares Contratado/Real)
//   • EQP = "auxiliar_C.4 EQP Detalhe"  (histograma por equipamento)
//   • MOI = "D.1 Adm Local Detalhe"     (pessoal indireto) — a aba MISTURA MOI + EQP indireto; só a
//     MOI entra aqui: data rows cujo GRUPO corrente (último FUNÇÃO com STATUS=null) NÃO começa com
//     "[EQUIP]" (os grupos "[EQUIP] GOL 1.6/SAVEIRO/..." são veículos de apoio = EQP indireto, fora).
// Cada recurso vem em par STATUS="Contratado"/"Real"; linhas STATUS=null são subtotais/totais (fora).
// Valores: contratadoRs = CUSTO TOTAL/VALOR full-contrato; realRs/contratadoRsBM = custo "até o BM"
// (CUSTO PERÍODO / VALOR NO PERÍODO). desvioRsBM = real − contratado até o BM (= ranking de alocação,
// bate a obra_recursos_desvio: EQP GUINDASTE 500T −835k, ESCAVADEIRA +635k, …).

import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { RecursoTipo } from "./recursos";

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
/** Pega valor por nome de coluna: tenta match EXATO (normalizado), depois por fragmento. */
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

export type RecursoDetalheItem = {
  categoria: RecursoTipo;
  funcao: string;
  unidade: string;
  contratadoQtde: number | null;
  realQtde: number | null;
  /** custo contratado full-contrato (CUSTO TOTAL / VALOR). */
  contratadoRs: number | null;
  /** custo contratado acumulado até o BM (CUSTO PERÍODO / VALOR NO PERÍODO). */
  contratadoRsBM: number | null;
  /** custo real medido acumulado até o BM. */
  realRs: number | null;
  /** real − contratado até o BM (desvio de alocação). null quando o real não foi medido (par Real
   *  ausente) — PENDENTE ≠ 0, não fabrica desvio negando o contratado. */
  desvioRsBM: number | null;
};
export type RecursosDetalhe = Record<RecursoTipo, RecursoDetalheItem[]>;

async function getDados(contractId: string, tituloFrag: string): Promise<Row[] | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message); // erro de leitura ≠ ausência silenciosa (erro = milhões)
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  return Array.isArray(dados) && dados.length > 0 ? (dados as Row[]) : null;
}

type ColMap = {
  qtd: string[];
  rsFull: string[];
  rsBM: string[];
  realQtd: string[];
  /** qtd acumulada até o BM (homem·mês / equip·mês) — base para DERIVAR o R$ por recurso. */
  qtdBM?: string[];
  /** custo unitário (R$/h) por recurso — quando presente, deriva o R$ em vez de copiar o pré-calc. */
  unit?: string[];
  /** jornada (h/mês) por recurso. */
  jorn?: string[];
};

/** Agrupa pares Contratado/Real por recurso (descarta STATUS=null = subtotais/totais). */
function parsePares(
  rows: Row[] | null,
  categoria: RecursoTipo,
  nomeCol: string[],
  unidade: string,
  cols: ColMap,
  incluir: (grupo: string | null) => boolean = () => true,
): RecursoDetalheItem[] {
  if (!rows) return [];
  let grupo: string | null = null;
  const byKey = new Map<string, { c?: Row; r?: Row; nome: string }>();
  const ordem: string[] = [];
  for (const row of rows) {
    const status = str(row["STATUS"]);
    if (!status) {
      grupo = str(pick(row, ...nomeCol)); // linha-cabeçalho de grupo
      continue;
    }
    if (!incluir(grupo)) continue; // ex.: MOI exclui grupos "[EQUIP]"
    const nome = str(pick(row, ...nomeCol));
    if (!nome) continue;
    // Alguns agregados vêm com STATUS≠null (ex.: "TOTAL MÃO DE OBRA DIRETA" qtde=7.109) — fora.
    const nn = normC(nome);
    if (/^(total|subtotal)\b/.test(nn) || /diferenca|acumulad/.test(nn)) continue;
    const key = `${grupo ?? ""}|${nome}`;
    if (!byKey.has(key)) {
      byKey.set(key, { nome });
      ordem.push(key);
    }
    const g = byKey.get(key)!;
    if (normC(status).startsWith("contratado")) g.c = row;
    else if (normC(status).startsWith("real")) g.r = row;
  }
  // R$ por recurso: DERIVA de qtd(até o BM) × custo unit × jornada em vez de copiar a coluna
  // pré-calculada da fonte ("CUSTO PERÍODO"), que tem células corrompidas (ex.: OPERADOR DE PLACA
  // VIBRATORIA = R$ 4 em vez de 81.575). A derivação É a própria fórmula do workbook (CUSTO PERÍODO
  // = Período × Jorn × Unit), então reproduz ao centavo TODOS os valores íntegros (41 MOD + 66 EQP
  // batem) e só conserta a célula com lixo. Sem custo unitário (operador embutido no EQP, MOI sem
  // unitário) cai no valor pré-calculado.
  const rsAteBM = (row: Row | undefined): number | null => {
    const u = cols.unit ? num(pick(row, ...cols.unit)) : null;
    const j = cols.jorn ? num(pick(row, ...cols.jorn)) : null;
    const qBM = cols.qtdBM ? num(pick(row, ...cols.qtdBM)) : null;
    if (u != null && u > 0 && j != null && j > 0 && qBM != null) return qBM * u * j;
    return num(pick(row, ...cols.rsBM)); // fallback: coluna pré-calculada da fonte
  };
  return ordem.map((key) => {
    const { c, r, nome } = byKey.get(key)!;
    const contratadoRsBM = rsAteBM(c);
    const realRs = r ? rsAteBM(r) : null;
    return {
      categoria,
      funcao: nome,
      unidade,
      contratadoQtde: num(pick(c, ...cols.qtd)),
      realQtde: num(pick(r, ...cols.realQtd)),
      contratadoRs: num(pick(c, ...cols.rsFull)),
      contratadoRsBM,
      realRs,
      desvioRsBM: realRs != null && contratadoRsBM != null ? realRs - contratadoRsBM : null,
    };
  });
}

/** Detalhamento por função das 3 abas. null se a obra não tem nenhuma delas. */
export async function getRecursosDetalhe(contractId: string): Promise<RecursosDetalhe | null> {
  const [mod, eqp, moi] = await Promise.all([
    getDados(contractId, "auxiliar_C.4 MOD Detalhe"),
    getDados(contractId, "auxiliar_C.4 EQP Detalhe"),
    getDados(contractId, "D.1 Adm Local Detalhe"),
  ]);
  if (!mod && !eqp && !moi) {
    // Dialeto SBSO (workbook-motor): sem histogramas auxiliares BR-101, o detalhe por função vive
    // nos "C.4 — Comparativo MOD/MOI/EQP (Contratado × Real … totais do contrato)". Eixo de
    // quantidade = PESSOAS/EQUIP ("(q)_2" · L59 O/V da aba) — o "(q)" simples é Hh e NÃO é o
    // rótulo QTD que a tela mostra. R$ = acumulado até o BM (Contratado/Real/Δ prontos na fonte).
    const [cMod, cMoi, cEqp] = await Promise.all([
      getDados(contractId, "Comparativo MOD"),
      getDados(contractId, "Comparativo MOI"),
      getDados(contractId, "Comparativo EQP"),
    ]);
    if (!cMod && !cMoi && !cEqp) return null;
    const doCmp = (rows: Row[] | null, categoria: RecursoTipo): RecursoDetalheItem[] =>
      (rows ?? [])
        .map((r) => {
          const funcao = str(pick(r, "recurso / função", "recurso", "equipamento", "função"));
          // eixo-qtde por dialeto: "(q)_2" = pessoas (MOD/EQP) · "(Hh)" = único eixo do MOI ·
          // "(q)" cru por último (no MOD é Hh — nunca preferir).
          const cq =
            num(pick(r, "contratado (q)_2")) ??
            num(pick(r, "contratado (hh)")) ??
            num(pick(r, "contratado (q)"));
          const rq =
            num(pick(r, "real (q)_2")) ?? num(pick(r, "real (hh)")) ?? num(pick(r, "real (q)"));
          const cr = num(pick(r, "contratado (r$)", "contratado (r"));
          const rr = num(pick(r, "real (r$)", "real (r"));
          const d = num(pick(r, "δ (r$)", "δ (r")) ?? (rr != null && cr != null ? rr - cr : null);
          return {
            categoria,
            funcao: funcao ?? "",
            unidade: "qtd",
            contratadoQtde: cq,
            realQtde: rq,
            contratadoRs: null,
            contratadoRsBM: cr,
            realRs: rr,
            desvioRsBM: d,
          };
        })
        .filter((i) => i.funcao && !/^total/i.test(i.funcao));
    return { MOD: doCmp(cMod, "MOD"), MOI: doCmp(cMoi, "MOI"), EQP: doCmp(cEqp, "EQP") };
  }

  return {
    MOD: parsePares(mod, "MOD", ["FUNÇÃO", "FUNCAO"], "h×mês", {
      qtd: ["QTD (h"],
      rsFull: ["CUSTO TOTAL"],
      rsBM: ["CUSTO PERÍODO", "CUSTO PERIODO"],
      realQtd: ["TOTAL NO PER"],
      qtdBM: ["TOTAL NO PER"],
      unit: ["CUSTO UNIT (R$/h)", "CUSTO UNIT (R$"], // NÃO o "CUSTO UNIT REF" (operador embutido)
      jorn: ["JORNADA (h/mês)", "JORNADA"],
    }),
    EQP: parsePares(eqp, "EQP", ["EQUIPAMENTO"], "equip×mês", {
      qtd: ["TOTAL (equip"],
      rsFull: ["CUSTO TOTAL"],
      rsBM: ["CUSTO PERÍODO", "CUSTO PERIODO"],
      realQtd: ["TOTAL NO PER"],
      qtdBM: ["TOTAL NO PER"],
      unit: ["CUSTO UNIT PRODUTIVO (R$/h)", "CUSTO UNIT PRODUTIVO"], // PRODUTIVO (a fórmula H usa este)
      jorn: ["JORNADA (h/mês)", "JORNADA"],
    }),
    // MOI: só pessoal indireto — exclui grupos "[EQUIP]" (veículos de apoio = EQP indireto).
    MOI: parsePares(
      moi,
      "MOI",
      ["FUNÇÃO", "FUNCAO"],
      "un x mês",
      {
        qtd: ["QTD"],
        rsFull: ["VALOR (R$)", "VALOR (R"],
        rsBM: ["VALOR NO PERÍODO", "VALOR NO PERIODO"],
        realQtd: ["QTD NO PERÍODO", "QTD NO PERIODO"],
      },
      (grupo) => !grupo || !normC(grupo).startsWith("[equip]"),
    ),
  };
}
