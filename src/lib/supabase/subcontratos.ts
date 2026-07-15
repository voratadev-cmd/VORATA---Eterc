// Read-model da CENTRAL DE SUBCONTRATOS (tela nova · spec "Central de Subcontratos (C.7)" SBSO).
// REGRA-MÃE da spec: onde o Excel já calculou, LER o valor — não recalcular; onde faltar, "—".
// Fontes (obra_secoes · captura do RMA):
//   • "S — Subcontratados · Perda/Economia vs PSQ por disciplina"  → tabela mestra (blocos 1–4)
//   • "S — Acompanhamento de Medição por disciplina"               → bloco 7 (ponte Medido BM04)
//   • "S — Acompanhamento de Medição por contrato"                 → bloco 5 (20 CTs JÁ agregados)
//   • "S — Subcontratados · Lista de contratos"                    → bloco 6 + STATUS do bloco 5
//   • "S — Subcontratados × PSQ por frente"                        → bloco 9 (edificação)
//   • "S-AUX2 — Curva ABC de insumos/subempreiteiros"              → drill item a item (bloco 3)
// RÓTULOS: as colunas Disciplina (D) e Conclusão-R$ (AC) do Excel não têm cabeçalho e a captura
// antiga as dropou. Preferimos o rótulo do banco quando existir; senão usamos o rótulo VERIFICADO
// célula a célula contra o Excel, com GUARDA de pareamento (o "Valor Contratado" da linha tem de
// bater com o verificado — divergiu → linha sem rótulo/conclusão, nunca rótulo errado).
// Σ das linhas = totais exibidos, validados contra as âncoras da spec no gate (probe_subcontratos).

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

async function getSecao(contractId: string, frag: string): Promise<Row[] | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${frag}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  return Array.isArray(dados) && dados.length > 0 ? (dados as Row[]) : null;
}

// Rótulos + Conclusão (R$) verificados contra S_SUBCONTRATADOS (L84–92 · col D/AC · 15/jul/2026).
// `contratado` é a âncora do pareamento com a linha capturada.
const MESTRE_VERIF: Array<{ d: string; contratado: number; conclusaoRs: number | null }> = [
  {
    d: "GERENCIAMENTO, SERVIÇOS PRELIMINARES E CANTEIRO",
    contratado: 1224322.32,
    conclusaoRs: 738722.095158116,
  },
  { d: "PROJETOS DE ARQUITETURA E ENGENHARIA", contratado: 683000, conclusaoRs: 601776.4777400775 },
  { d: "ARQUITETURA - OBRA CIVIL", contratado: 2813414.52, conclusaoRs: 2966355.185003163 },
  { d: "FUNDAÇÕES E ESTRUTURAS", contratado: 5004185.48, conclusaoRs: 3170563.327882829 },
  { d: "SISTEMAS ELÉTRICOS", contratado: 0, conclusaoRs: -2417424.5258159908 },
  { d: "SISTEMAS ELETRÔNICOS E TELEMÁTICA", contratado: 0, conclusaoRs: 168961.39610776794 },
  { d: "SISTEMAS HIDROSSANITÁRIOS", contratado: 0, conclusaoRs: -420065.59539215174 },
  { d: "SISTEMAS MECÂNICOS", contratado: 3650000, conclusaoRs: 5143626.114848034 },
  { d: "SERVIÇOS FINAIS", contratado: 0, conclusaoRs: null },
];
const FRENTES_VERIF = ["Geral", "TPS", "CUT", "CRS", "Subestação", "Guarita"];

export type SubMestre = {
  n: number;
  disciplina: string | null;
  contratado: number | null;
  valorPsq: number | null;
  psqItemSubc: number | null;
  economiaJa: number | null;
  saldoExecutar: number | null;
  previstoSubc: number | null;
  potencialFuturo: number | null;
  oQueFalta: string | null;
  conclusaoTxt: string | null;
  conclusaoRs: number | null;
};
export type SubContrato = {
  numContrato: string;
  nome: string;
  contratado: number | null;
  medido: number | null;
  saldo: number | null;
  status: string | null;
  farol: "critico" | "atencao" | "emdia" | "concluido" | "cancelado";
};
export type SubMedicaoDisc = {
  disciplina: string;
  totalContrato: number | null;
  medidoSub: number | null;
  saldoMedicao: number | null;
  medidoBm04: number | null;
  saldoPsq: number | null;
  potencialLiberado: number | null;
};
export type SubDrillItem = { codigo: string | null; descricao: string; valorRs: number | null };

export type Subcontratos = {
  mestre: SubMestre[];
  tot: {
    contratado: number;
    valorPsq: number;
    psqItemSubc: number;
    economiaJa: number;
    saldoExecutar: number;
    previstoSubc: number;
    potencialFuturo: number;
    conclusaoRs: number;
  };
  contratos: SubContrato[];
  contratosTot: { contratado: number; medido: number; saldo: number; pctMed: number | null };
  medicao: SubMedicaoDisc[];
  medicaoTot: SubMedicaoDisc | null;
  porDisciplina: Array<{ disciplina: string; contratado: number; medido: number }>;
  porSub: Array<{ nome: string; contratado: number; medido: number }>;
  frentes: Array<{ frente: string | null; contratado: number | null; psq: number | null }>;
  /** drill do bloco 3: itens SUBEMPREITEIROS da S-AUX2 por nº de disciplina (Classificação). */
  drill: Map<number, SubDrillItem[]>;
  criticos: number;
};

const soma = (xs: Array<number | null>) =>
  Math.round(xs.reduce((s: number, v) => s + (v ?? 0), 0) * 100) / 100;

/** Central de Subcontratos. null quando a obra não tem as seções S (fica fora do menu-fluxo). */
export async function getSubcontratos(contractId: string): Promise<Subcontratos | null> {
  const [mestreRaw, medDiscRaw, medCtRaw, listaRaw, frenteRaw, aux2Raw] = await Promise.all([
    getSecao(contractId, "S — Subcontratados · Perda/Economia"),
    getSecao(contractId, "S — Acompanhamento de Medição por disciplina"),
    getSecao(contractId, "S — Acompanhamento de Medição por contrato"),
    getSecao(contractId, "S — Subcontratados · Lista de contratos"),
    getSecao(contractId, "S — Subcontratados × PSQ por frente"),
    getSecao(contractId, "S-AUX2 — Curva ABC"),
  ]);
  if (!mestreRaw || !medCtRaw || !listaRaw) return null;

  // ── Tabela mestra (rótulo do banco > verificado, sempre com guarda de pareamento) ──
  const mestre: SubMestre[] = mestreRaw.map((r, i) => {
    const contratado = num(r["Valor Contratado Subempreiteiro"]);
    const verif = MESTRE_VERIF[i];
    const casa = verif != null && Math.abs((contratado ?? 0) - verif.contratado) < 0.02;
    return {
      n: i + 1,
      disciplina: str(r["Disciplina"]) ?? (casa ? verif.d : null),
      contratado,
      valorPsq: num(r["Valor PSQ"]),
      psqItemSubc: num(r["Valor na PSQ do Item Subcontratado"]),
      economiaJa: num(r["Perda/Economia em relação à PSQ"]),
      saldoExecutar: num(r["Saldo a ser executado na PSQ"]),
      previstoSubc: num(r["Valor Previsto Subcontratação/Gastos"]),
      potencialFuturo: num(r["Potencial Perda/Economica Futuro"]),
      oQueFalta: str(r["O que falta contratar"]),
      conclusaoTxt: str(r["Conclusão"]),
      conclusaoRs: num(r["Conclusão (R$)"]) ?? (casa ? verif.conclusaoRs : null),
    };
  });
  const tot = {
    contratado: soma(mestre.map((m) => m.contratado)),
    valorPsq: soma(mestre.map((m) => m.valorPsq)),
    psqItemSubc: soma(mestre.map((m) => m.psqItemSubc)),
    economiaJa: soma(mestre.map((m) => m.economiaJa)),
    saldoExecutar: soma(mestre.map((m) => m.saldoExecutar)),
    previstoSubc: soma(mestre.map((m) => m.previstoSubc)),
    potencialFuturo: soma(mestre.map((m) => m.potencialFuturo)),
    conclusaoRs: soma(mestre.map((m) => m.conclusaoRs)),
  };

  // ── Bloco 5: 20 CTs (já agregados na captura) + STATUS via Lista (47 linhas) ──
  const statusPorCt = new Map<string, string>();
  for (const r of listaRaw) {
    const ct = str(r["Num. Contrato"]);
    const st = str(r["STATUS"]);
    if (ct && st && !statusPorCt.has(ct)) statusPorCt.set(ct, st);
  }
  const contratos: SubContrato[] = medCtRaw.map((r) => {
    const contratado = num(r["valorContrato"]);
    const medido = num(r["medidoAcumuladoBM04"]);
    const status = statusPorCt.get(str(r["numContrato"]) ?? "") ?? null;
    const stNorm = (status ?? "").toLowerCase();
    // Farol da spec: 🔴 medido>contratado OU (contratado≥500k e medido=0) · 🟡 %med<20% e
    // contratado≥100k · ✅/⚫ por STATUS · 🟢 em dia. Precedência: cancelado silencia tudo
    // (medido 0 é natural); o CRÍTICO vence "concluído" — estouro sem aditivo não deixa de
    // ser vermelho porque o contrato foi dado por encerrado.
    const estouro = medido != null && contratado != null && medido > contratado;
    const paradoRelevante = (contratado ?? 0) >= 500_000 && (medido ?? 0) === 0;
    const lento = contratado != null && contratado >= 100_000 && (medido ?? 0) / contratado < 0.2;
    let farol: SubContrato["farol"] = "emdia";
    if (stNorm.startsWith("cancel")) farol = "cancelado";
    else if (estouro || (paradoRelevante && !stNorm.startsWith("conclu"))) farol = "critico";
    else if (stNorm.startsWith("conclu")) farol = "concluido";
    else if (lento) farol = "atencao";
    return {
      numContrato: str(r["numContrato"]) ?? "—",
      nome: str(r["nomeFornecedor"]) ?? "—",
      contratado,
      medido,
      saldo: num(r["saldoAMedir"]),
      status,
      farol,
    };
  });
  const ctTotC = soma(contratos.map((x) => x.contratado));
  const ctTotM = soma(contratos.map((x) => x.medido));
  const contratosTot = {
    contratado: ctTotC,
    medido: ctTotM,
    saldo: soma(contratos.map((x) => x.saldo)),
    pctMed: ctTotC > 0 ? (ctTotM / ctTotC) * 100 : null,
  };

  // ── Bloco 7: acompanhamento por disciplina (rótulo próprio na captura) ──
  const medicao: SubMedicaoDisc[] = (medDiscRaw ?? []).map((r) => ({
    disciplina: str(r["Acompanhamento Medição"]) ?? "—",
    totalContrato: num(r["Total contrato Subempreiteiro"]),
    medidoSub: num(r["Medido Subempreteiro"]),
    saldoMedicao: num(r["Saldo Medição"]),
    medidoBm04: num(r["Medido BM 04"]),
    saldoPsq: num(r["Saldo de Medição PSQ"]),
    potencialLiberado: num(r["Potencial Medição do Item - Liberado"]),
  }));
  const medicaoTot: SubMedicaoDisc | null = medicao.length
    ? {
        disciplina: "Total",
        totalContrato: soma(medicao.map((m) => m.totalContrato)),
        medidoSub: soma(medicao.map((m) => m.medidoSub)),
        saldoMedicao: soma(medicao.map((m) => m.saldoMedicao)),
        medidoBm04: soma(medicao.map((m) => m.medidoBm04)),
        saldoPsq: soma(medicao.map((m) => m.saldoPsq)),
        potencialLiberado: soma(medicao.map((m) => m.potencialLiberado)),
      }
    : null;

  // ── Bloco 6 · visão Disciplina: LER do acompanhamento (bloco 7) — a agregação crua da Lista
  // NÃO fecha nas âncoras (o medido do CT004/CT015 não vem quebrado por linha de disciplina;
  // agrupar dava 1.936.734 num lump). O Excel já resolveu essa quebra no acompanhamento
  // (Gerenciamento 712.532 · Arquitetura 801.633 · Fundações 1.144.701 — as âncoras da spec). ──
  const porDisciplina = medicao.map((m) => ({
    disciplina: m.disciplina,
    contratado: m.totalContrato ?? 0,
    medido: m.medidoSub ?? 0,
  }));
  // Visão Subempreiteiro: agregação da Lista por Nome (sem âncora própria; medido = col O).
  const accSub = new Map<string, { contratado: number; medido: number }>();
  for (const r of listaRaw) {
    const k = str(r["Nome Fantasia/Social"]);
    if (!k) continue;
    const g = accSub.get(k) ?? { contratado: 0, medido: 0 };
    g.contratado += num(r["VALOR DO CONTRATO"]) ?? 0;
    g.medido += num(r["ACUMULADO ATÉ O PERIODO"]) ?? 0;
    accSub.set(k, g);
  }
  const porSub = [...accSub.entries()]
    .map(([nome, v]) => ({
      nome,
      contratado: Math.round(v.contratado * 100) / 100,
      medido: Math.round(v.medido * 100) / 100,
    }))
    .sort((a, b) => b.contratado - a.contratado);

  // ── Bloco 9: frentes (rótulo do banco > verificado por posição, com guarda de nº de linhas) ──
  const frentes = (frenteRaw ?? []).map((r, i) => ({
    frente:
      str(r["Frente"]) ??
      ((frenteRaw ?? []).length === FRENTES_VERIF.length ? FRENTES_VERIF[i] : null),
    contratado: num(r["Valor Contratado Subempreiteiro"]),
    psq: num(r["PSQ"]),
  }));

  // ── Drill do bloco 3: S-AUX2 itens do grupo SUBEMPREITEIROS por nº da disciplina ──
  const drill = new Map<number, SubDrillItem[]>();
  for (const r of aux2Raw ?? []) {
    if (str(r["Grupo de Custo"]) !== "SUBEMPREITEIROS") continue;
    const n = num(r["Classificação"]);
    if (n == null) continue;
    const item: SubDrillItem = {
      codigo: str(r["Código"] ?? r["Codigo"]),
      descricao: str(r["Descrição"] ?? r["Descricao"]) ?? "—",
      valorRs: num(r["Valor"]),
    };
    (drill.get(n) ?? drill.set(n, []).get(n)!).push(item);
  }
  for (const itens of drill.values()) itens.sort((a, b) => (b.valorRs ?? 0) - (a.valorRs ?? 0));

  const criticos = contratos.filter((x) => x.farol === "critico").length;

  return {
    mestre,
    tot,
    contratos,
    contratosTot,
    medicao,
    medicaoTot,
    porDisciplina,
    porSub,
    frentes,
    drill,
    criticos,
  };
}
