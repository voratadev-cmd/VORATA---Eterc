// Read-model EXTRA da tela D.0 Painel de Desequilíbrio (a composição/total vem de getDesequilibrio via
// getDeseqContexto; aqui ficam os blocos próprios da tela-mãe): resumo (teto/vigente/quitado/provável),
// cenários & métodos por categoria, Quitação Trimestral (Cláusula 30), memo de insumos (à parte) e a
// leitura IA. Tudo das seções `obra_secoes` (D.0 Bloco 1/3, Memo, Leitura IA) + a chuva pendente (D.6).
// Pendências honestas (prorrogação, força no mérito, contrapleitos) = null — a tela mostra "a definir".

import { getSupabase } from "./client";
import { getDeseqContexto } from "./deseqContexto";
import type { DesequilibrioCategoriaReal } from "./desequilibrio";
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
const asObj = (v: unknown): Row | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
const asArr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

// Método + descrição (copy de domínio, igual ao mockup) por tela. O VALOR vem do dado real.
const CENARIO_META: Record<string, { metodo: string; descricao: string; nota: string }> = {
  "D.1": {
    metodo: "M2.2 — Gasto × Medido",
    descricao: "Incorrência plena de canteiro/adm local menos o boletim medido.",
    nota: "3 métodos lado a lado na D.1",
  },
  "D.2": {
    metodo: "M2 — Real × Contratado",
    descricao: "Diferença do BDI real apropriado contra o contratado (RDO × histograma).",
    nota: "Cenários na D.2",
  },
  "D.3": {
    metodo: "M2.1 — Real × Medido",
    descricao: "Encargos reais sobre a folha medida.",
    nota: "Sem desequilíbrio apurado",
  },
  "D.4": {
    metodo: "M3 — Total Cost sem ajuste (método ativo)",
    descricao:
      "Real − previsto no período (bate a C.4). Valor Agregado e Milha aferida alternativos.",
    nota: "Consistente com a C.4",
  },
  "D.6": {
    metodo: "Ociosidade por chuva (dias > 5 mm)",
    // Fallback genérico: a descrição real é derivada do dado (mês/dias) em `descreverChuva`.
    descricao:
      "Ociosidade da equipe nos dias de chuva acima de 5 mm — excedente sobre a série prevista.",
    nota: "pendente de validação",
  },
  "D.5": {
    metodo: "Faturamento direto (à parte do teto)",
    descricao: "Reajuste do excedente de insumos ao IPCA — fatura direto, não entra no claim.",
    nota: "Fora do total pleiteável",
  },
};
// Ordem dos cards de cenário (D.5 e D.6 incluídos).
const CENARIO_ORDEM = ["D.1", "D.2", "D.3", "D.4", "D.6", "D.5"];

const fmtDias = (n: number): string => `${n} dia${n === 1 ? "" : "s"}`;

/**
 * Descrição da parcela de chuva (D.6) DERIVADA do dado da seção Totais — sem literal chumbado.
 * Preferência: dias reais × previstos (se a seção os trouxer) → só excedente (dias) → copy genérica.
 * Mês só entra quando a seção o declara; ausente = copy sem mês (fallback honesto).
 */
function descreverChuva(
  mes: string | null,
  diasReais: number | null,
  diasPrevistos: number | null,
  excedenteDias: number | null,
): string {
  const pref = mes ? `Ociosidade por chuva ${mes}: ` : "Ociosidade por chuva: ";
  if (diasReais != null && diasPrevistos != null) {
    return `${pref}${fmtDias(diasReais)} reais × ${diasPrevistos} previstos (> 5 mm) — excedente pleiteável.`;
  }
  if (excedenteDias != null) {
    return `${pref}${fmtDias(excedenteDias)} de excedente (> 5 mm) sobre a série prevista.`;
  }
  return "Ociosidade da equipe nos dias de chuva acima de 5 mm — excedente sobre a série prevista.";
}

export type DesequilibrioResumo = {
  totalRs: number;
  pctValorContratual: number | null; // total ÷ PV
  pctRecuperacao: number | null; // fator D.11 (provável recuperação)
  resultadoProvavelRs: number | null; // total × pctRecuperacao
  vigenteRs: number; // T em aberto (= total, nada quitado)
  quitadoRs: number; // já liquidado
};
export type CenarioMetodo = {
  tela: string;
  categoria: string;
  metodo: string;
  descricao: string;
  valorRs: number | null;
  nota: string;
  pendenteRs: number | null; // ex.: D.6 chuva (279.805) — pendente, fora do total
  foraDoTeto: boolean; // D.5 (faturamento direto)
};
export type QuitacaoTrimestre = {
  trimestre: string;
  periodo: string | null;
  bms: string | null;
  status: string | null;
  valorDeseqRs: number | null;
  fimTrimestre: string | null;
  prazoReuniao: string | null;
  reuniaoStatus: string | null;
  ressalvas: string | null;
  termoQuitacao: string | null;
  relatorio: string | null;
  aberto: boolean;
};
export type MemoInsumos = { valorRs: number | null; observacao: string | null };

export type DesequilibrioPainel = {
  nome: string | null;
  resumo: DesequilibrioResumo;
  composicao: DesequilibrioCategoriaReal[];
  cenariosMetodos: CenarioMetodo[];
  quitacaoTrimestral: QuitacaoTrimestre[];
  memoInsumos: MemoInsumos | null;
  leituraIA: string | null;
  pendentes: {
    prorrogacaoDias: number | null;
    forcaNoMerito: string | null;
    exposicaoContrapleitos: number | null;
    chuvaPendenteRs: number | null; // ociosidade por chuva — pendente de validação (fora do total)
    chuvaMesRef: string | null; // mês de referência da chuva, se a seção o declara (senão null → copy genérica)
    chuvaExcedenteDias: number | null; // dias de excedente > 5 mm (seção Totais)
    chuvaDiasReais: number | null; // dias reais > 5 mm, se declarados
    chuvaDiasPrevistos: number | null; // dias previstos > 5 mm, se declarados
  };
  valorContratado: number | null;
  valorContratadoFonte: "obra" | "faturamento" | null;
};

/** Painel D.0 completo (extras da tela-mãe). null se a obra não tem o M3 normalizado. */
export async function getDesequilibrioPainel(
  contractId: string,
): Promise<DesequilibrioPainel | null> {
  const [ctx, bloco1, bloco3, memoSec, leituraSec, chuvaTotais] = await Promise.all([
    getDeseqContexto(contractId),
    getSecaoDados(contractId, "D.0 — Bloco 1"),
    getSecaoDados(contractId, "D.0 — Bloco 3"),
    getSecaoDados(contractId, "D.0 — Memo"),
    getSecaoDados(contractId, "D.0 — Leitura IA"),
    getSecaoDados(contractId, "auxiliar_D.6 Chuva — Totais"),
  ]);
  if (!ctx.deseq) return null;

  const deseq = ctx.deseq;
  const totalRs = deseq.totalRs;
  const valorContratado = ctx.valorContratado;

  const b1 = asObj(bloco1);
  const pctRecuperacao = num(pick(b1, "percentProvavelRecuperacao", "recuperacao"));
  const resultadoProvavelRs = pctRecuperacao != null ? totalRs * pctRecuperacao : null;
  const resumo: DesequilibrioResumo = {
    totalRs,
    pctValorContratual: valorContratado && valorContratado > 0 ? totalRs / valorContratado : null,
    pctRecuperacao,
    resultadoProvavelRs,
    vigenteRs: totalRs,
    quitadoRs: 0,
  };

  // memo insumos (à parte do teto)
  const memoObj = asObj(memoSec);
  const memoInsumos: MemoInsumos | null = memoObj
    ? {
        valorRs: num(pick(memoObj, "excedente", "valor")),
        observacao: str(pick(memoObj, "observacao", "observação")),
      }
    : null;

  // chuva pendente (D.6) — TOTAL PLEITEÁVEL declarado (MOD + EQP = 279.805), fora do total enquanto
  // não validado. A seção lista "PLEITEÁVEL EQP" (202.752) ANTES do consolidado → priorizar o MOD+EQP
  // (senão o pick por fragmento pega só o EQP e subdeclara o pleito em R$ 77.053).
  const chuvaObj = asObj(chuvaTotais);
  const chuvaPendenteRs = num(
    pick(chuvaObj, "total pleiteavel (mod + eqp)", "mod + eqp", "total pleiteavel"),
  );
  // Mês/dias DERIVADOS da MESMA seção Totais (já buscada) — para a copy da chuva sem literal chumbado.
  const chuvaMesRef = str(
    pick(
      chuvaObj,
      "mês de referência",
      "mes de referencia",
      "mês pleiteável",
      "mes pleiteavel",
      "mês de apuração",
      "mes de apuracao",
      "competência",
      "competencia",
    ),
  );
  const chuvaExcedenteDias = num(pick(chuvaObj, "excedente (dias)", "excedente dias", "excedente"));
  const chuvaDiasReais = num(
    pick(chuvaObj, "dias reais > 5 mm", "dias reais >5mm", "dias reais", "real >5mm", "real >5"),
  );
  const chuvaDiasPrevistos = num(
    pick(
      chuvaObj,
      "dias previstos > 5 mm",
      "dias previstos >5mm",
      "dias previstos",
      "prev >5mm",
      "prev >5",
    ),
  );
  const chuvaDescricao = descreverChuva(
    chuvaMesRef,
    chuvaDiasReais,
    chuvaDiasPrevistos,
    chuvaExcedenteDias,
  );

  // cenários & métodos: valor real do deseq por tela; D.5 = memo; D.6 = pendente chuva
  const valorPorTela = (tela: string): number | null =>
    deseq.categorias.find((c) => c.tela === tela)?.valorRs ?? null;
  const catNome = (tela: string): string =>
    deseq.categorias.find((c) => c.tela === tela)?.categoria ?? CAT_FALLBACK[tela] ?? tela;
  const cenariosMetodos: CenarioMetodo[] = CENARIO_ORDEM.map((tela) => {
    const meta = CENARIO_META[tela];
    const isInsumo = tela === "D.5";
    const isChuva = tela === "D.6";
    return {
      tela,
      categoria: isInsumo ? "Excedente de Insumos" : catNome(tela),
      metodo: meta.metodo,
      descricao: isChuva ? chuvaDescricao : meta.descricao,
      valorRs: isInsumo ? (memoInsumos?.valorRs ?? null) : valorPorTela(tela),
      nota: meta.nota,
      pendenteRs: isChuva ? chuvaPendenteRs : null,
      foraDoTeto: isInsumo,
    };
  });

  // quitação trimestral (Bloco 3); T1 carrega o TOTAL do painel (mockup) — a seção traz o valor com
  // o D.4 pequeno (inconsistência interna do workbook); o painel usa o total canônico.
  const b3 = asArr(bloco3);
  const quitacaoTrimestral: QuitacaoTrimestre[] = b3.map((r, i) => {
    // "Aberto" (= trimestre ATUAL/devido) = a reunião está vencida/devida, NÃO "aguardando fim do
    // trimestre". A seção marca Status="Aberto" em TODOS os 8 (nenhum quitado ainda); usar isso pintaria
    // T2..T8 como devidos. O discriminador certo é o status da reunião — só T1 (vencido) é o atual.
    const reuniaoStr = normC(str(pick(r, "reuniao (status)", "reunião (status)")) ?? "");
    const aberto = reuniaoStr !== "" && !reuniaoStr.includes("aguardando");
    const valorSecao = num(pick(r, "valor deseq", "valor desequil"));
    return {
      trimestre: str(pick(r, "trimestre")) ?? `T${i + 1}`,
      periodo: str(pick(r, "periodo", "período")),
      bms: str(pick(r, "bms")),
      status: str(pick(r, "status")),
      valorDeseqRs: i === 0 ? totalRs : (valorSecao ?? 0),
      fimTrimestre: str(pick(r, "fim do trimestre", "fim do trim")),
      prazoReuniao: str(pick(r, "prazo da reuniao", "prazo da reunião")),
      reuniaoStatus: str(pick(r, "reuniao (status)", "reunião (status)")),
      ressalvas: str(pick(r, "ressalvas")),
      termoQuitacao: str(pick(r, "termo de quitacao", "termo de quitação")),
      relatorio: str(pick(r, "relatorio pormenorizado", "relatório")),
      aberto,
    };
  });

  const leituraIA = str(pick(asObj(leituraSec), "conteudo", "conteúdo", "texto"));

  return {
    nome: ctx.nome,
    resumo,
    composicao: deseq.categorias,
    cenariosMetodos,
    quitacaoTrimestral,
    memoInsumos,
    leituraIA,
    pendentes: {
      prorrogacaoDias: null, // Windows Analysis (M2/D.4) — não normalizado
      forcaNoMerito: null, // base documental+jurídica — não normalizado
      exposicaoContrapleitos: null, // D.9 — não normalizado
      chuvaPendenteRs,
      chuvaMesRef,
      chuvaExcedenteDias,
      chuvaDiasReais,
      chuvaDiasPrevistos,
    },
    valorContratado,
    valorContratadoFonte: ctx.valorContratadoFonte,
  };
}

const CAT_FALLBACK: Record<string, string> = {
  "D.1": "Custos Indiretos",
  "D.2": "BDI",
  "D.3": "Encargos Sociais",
  "D.4": "Perda de Produtividade",
  "D.6": "Eventos Pontuais",
};
