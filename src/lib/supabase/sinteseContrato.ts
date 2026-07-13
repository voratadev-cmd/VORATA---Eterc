// Read-model da SÍNTESE DO CONTRATO (C.1 · entry point M2.1.1) — lê a CAPTURA GENÉRICA (obra_secoes ·
// JSONB) dos painéis C.1 do workbook + o resumo do Dashboard. Os KPIs financeiros (PV, BDI, custo
// direto/indireto, prazo) NÃO vêm daqui — vêm dos read-models tipados (curva, indiretos, prazo) na tela.
// Aqui é leitura para exibição: Equipe, Trechos, Premissas, BDI rubricas, Estaqueamento, Documentos,
// painel Admin Contratual e a identidade (contratante/objeto/valor) do resumo do Dashboard.
// Resíduo legal (CNPJs, regime, foro, datas OS, etc.) NÃO está no workbook → fica "a cadastrar" na tela.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

type Row = Record<string, unknown>;

/** Seção cuja captura é uma TABELA (dados = array de linhas). null se ausente/vazia. */
async function getSecaoTabela(contractId: string, tituloFrag: string): Promise<Row[] | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message); // falha de leitura ≠ ausência silenciosa (erro = milhões)
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  return Array.isArray(dados) && dados.length > 0 ? (dados as Row[]) : null;
}

/** Seção cuja captura é um OBJETO de campos (dados = {chave: valor}). null se ausente. */
async function getSecaoObj(contractId: string, tituloFrag: string): Promise<Row | null> {
  const { data, error } = await untypedTable("obra_secoes")
    .select("dados")
    .eq("contrato_id", contractId)
    .ilike("titulo", `%${tituloFrag}%`)
    .limit(1);
  if (error) throw new Error(error.message);
  const dados = ((data ?? [])[0] as { dados?: unknown } | undefined)?.dados;
  return dados && typeof dados === "object" && !Array.isArray(dados) ? (dados as Row) : null;
}

/** Segmentos/trechos × valor (obra_mapa_segmentos · 10 linhas com o carve-out de sinistros). */
async function getSegmentos(contractId: string): Promise<Row[] | null> {
  const { data, error } = await untypedTable("obra_mapa_segmentos")
    .select("ordem, item_nome, km_inicio, km_fim, valor_contrato_rs")
    .eq("contrato_id", contractId)
    .order("ordem");
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0 ? (data as Row[]) : null;
}

const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
/** "(a cadastrar)" / "(link a cadastrar)" da fonte → null (a tela trata como amarelo "a cadastrar"). */
const strCad = (v: unknown): string | null => {
  const s = str(v);
  return s && /a cadastrar/i.test(s) ? null : s;
};
const pick = (r: Row, ...frags: string[]): unknown => {
  const key = Object.keys(r).find((k) =>
    frags.some((f) => k.toLowerCase().includes(f.toLowerCase())),
  );
  return key ? r[key] : null;
};

export type SinteseEquipe = {
  funcao: string;
  nome: string;
  documento: string | null;
  designacao: string | null;
};
export type SinteseTrecho = { trecho: string; km: string | null; valor: number | null };
export type SintesePremissa = { frente: string; valor: number | null; pctPV: number | null };
export type SinteseBdiRubrica = {
  descricao: string;
  pctReceita: number | null;
  pctCustoDireto: number | null;
  valor: number | null;
};
export type SinteseEstaqueamento = {
  kmInicial: number | null;
  kmFinal: number | null;
  extensaoKm: number | null;
  nSegmentos: number | null;
};
export type SinteseDocumentos = {
  contratoInterno: string | null;
  contratoLink: string | null;
  anexos: string | null;
  proposta: string | null;
};
export type SinteseAdmin = {
  gestorDoContrato: string | null;
  prepostoDaContratada: string | null;
  fiscalTecnico: string | null;
  fiscalAdministrativo: string | null;
  comissaoDeFiscalizacao: string | null;
  contatoEmail: string | null;
};
export type SinteseIdentidade = {
  contratante: string | null;
  objeto: string | null;
  valor: number | null;
  prazoMeses: number | null;
};
/** Painel cadastral (Identificação Legal / Prazos): labels do contrato → valor. "(a cadastrar)" → null
 *  (vira o amarelo "a cadastrar" na tela). Valores legais/datas que vivem no PDF, fora do workbook. */
export type SinteseCadastro = Record<string, string | null>;

export type SinteseContrato = {
  identidade: SinteseIdentidade | null;
  identificacaoLegal: SinteseCadastro | null;
  prazosContratuais: SinteseCadastro | null;
  estaqueamento: SinteseEstaqueamento | null;
  premissas: SintesePremissa[];
  premissasTotal: number;
  equipe: SinteseEquipe[];
  trechos: SinteseTrecho[];
  trechosTotal: number;
  bdiRubricas: SinteseBdiRubrica[];
  documentos: SinteseDocumentos | null;
  admin: SinteseAdmin | null;
  dataBaseOrcamento: string | null;
  financeiro: {
    pvInicialRs: number | null;
    valorAtualizadoRs: number | null;
    orcamentoInternoRs: number | null;
    margemPct: number | null;
    bdiPct: number | null;
    ciRs: number | null;
    reajustesAplicados: string | null;
    reequilibriosAplicados: string | null;
    aditivos: string | null;
    aniversarioReajuste: string | null;
    indicesReajuste: string | null;
  };
  orcamentoGrupos: {
    itens: Array<{ grupo: string; valorRs: number | null; pct: number | null }>;
    totalRs: number | null;
  };
};

/** Síntese do contrato (C.1) a partir da captura genérica. null se a obra não tem seções. */
export async function getSinteseContrato(contractId: string): Promise<SinteseContrato | null> {
  const [
    resumo,
    equipeRows,
    trechoSecao,
    segRows,
    premissaRows,
    bdiRows,
    estaq,
    docs,
    admin,
    insumoParams,
    idLegal,
    prazosObj,
    painel3Obj,
    bdiResumoObj,
    grupoRows,
  ] = await Promise.all([
    getSecaoTabela(contractId, "Resumo dos contratos"),
    getSecaoTabela(contractId, "Painel 5: Equipe e Contatos"),
    getSecaoTabela(contractId, "Trechos × Valor").then(
      (v) => v ?? getSecaoTabela(contractId, "Segmentação física por edificação"),
    ),
    getSegmentos(contractId),
    getSecaoTabela(contractId, "Painel 4: Premissas de Orçamento"),
    getSecaoTabela(contractId, "BDI Detalhe — Rubricas"),
    getSecaoObj(contractId, "Estaqueamento / Extensão"),
    getSecaoObj(contractId, "Painel 6: Documentos-chave").then(
      (v) => v ?? getSecaoObj(contractId, "%Documentos-chave"),
    ),
    getSecaoObj(contractId, "Painel Administração Contratual"),
    getSecaoObj(contractId, "D.5 Insumos — Parâmetros").then(
      (v) => v ?? getSecaoObj(contractId, "D.5%Parâmetros e Resumo"),
    ),
    getSecaoObj(contractId, "Painel 1: Identificação Legal"),
    getSecaoObj(contractId, "Painel 2: Prazos"),
    getSecaoObj(contractId, "Painel 3"),
    getSecaoObj(contractId, "BDI Detalhe — Resumo"),
    getSecaoTabela(contractId, "Orçamento interno por grupo"),
  ]);

  // Sem nenhuma seção C.1 nem resumo → obra sem síntese normalizada (empty state honesto).
  if (!resumo && !equipeRows && !premissaRows && !segRows && !trechoSecao) return null;

  // Painéis cadastrais (Identificação Legal / Prazos): aplica strCad por campo ("(a cadastrar)" → null).
  const cadastroMap = (obj: Row | null): SinteseCadastro | null => {
    if (!obj) return null;
    const out: SinteseCadastro = {};
    for (const [k, v] of Object.entries(obj)) out[k] = strCad(v);
    return out;
  };
  const identificacaoLegal = cadastroMap(idLegal);
  const prazosContratuais = cadastroMap(prazosObj);

  const r0 = resumo?.[0] ?? null;
  const identidade: SinteseIdentidade | null = r0
    ? {
        contratante: str(pick(r0, "cliente", "contratante")),
        objeto: str(pick(r0, "contrato")),
        valor: num(pick(r0, "valor")),
        prazoMeses: num(pick(r0, "prazo")),
      }
    : null;

  const equipe: SinteseEquipe[] = (equipeRows ?? []).map((r) => ({
    funcao: String(pick(r, "função", "funcao") ?? "").trim(),
    nome: String(pick(r, "nome") ?? "").trim(),
    documento: str(pick(r, "documento", "crea")),
    designacao: str(pick(r, "designação", "designacao")),
  }));

  // Trechos × valor: a seção C.1 "Trechos × Valor (fonte C.14)" — 9 trechos da Duplicação, total =
  // 611.357.315 (o PV inteiro, é o que o contrato pede). NÃO mais obra_mapa_segmentos: o refresh v46
  // do C.14 reescreveu aquela tabela p/ 16 frentes físicas (Σ 381,6mi, decomposição do MAPA, não do
  // contrato) — usá-la aqui mostrava 16/381mi. Fallback p/ obra_mapa_segmentos só p/ obras sem a seção.
  const fmtKm = (v: number | null) =>
    v == null ? null : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const trechos: SinteseTrecho[] = trechoSecao
    ? trechoSecao
        .map((r) => ({
          trecho: String(pick(r, "trecho", "item", "edifica", "frente") ?? "").trim(),
          km: str(pick(r, "km")),
          valor: num(pick(r, "valor")),
        }))
        .filter((t) => t.trecho.toLowerCase() !== "total")
    : (segRows ?? []).map((r) => {
        const ki = fmtKm(num(pick(r, "km_inicio")));
        const kf = fmtKm(num(pick(r, "km_fim")));
        return {
          trecho: String(pick(r, "item_nome", "item") ?? "").trim(),
          km: ki && kf ? `${ki}–${kf}` : (ki ?? kf),
          valor: num(pick(r, "valor_contrato_rs", "valor")),
        };
      });
  const trechosTotal = trechos.reduce((a, t) => a + (t.valor ?? 0), 0);

  const premissas: SintesePremissa[] = (premissaRows ?? []).map((r) => {
    const frac = num(pick(r, "% do pv", "% do PV", "pv"));
    return {
      frente: String(pick(r, "frente", "disciplina") ?? "").trim(),
      valor: num(pick(r, "valor contratado", "valor")),
      pctPV: frac != null ? frac * 100 : null, // fonte = fração → %
    };
  });
  const premissasTotal = premissas.reduce((a, p) => a + (p.valor ?? 0), 0);

  const bdiRubricas: SinteseBdiRubrica[] = (bdiRows ?? []).map((r) => {
    const pr = num(pick(r, "% s/ receita (fonte)", "% s/ RECEITA"));
    const pcd = num(pick(r, "% s/ custo direto", "% s/ CUSTO"));
    return {
      descricao: String(pick(r, "descrição", "descricao") ?? "").trim(),
      pctReceita: pr != null ? pr * 100 : null,
      pctCustoDireto: pcd != null ? pcd * 100 : null,
      valor: num(pick(r, "valor")),
    };
  });

  const estaqueamento: SinteseEstaqueamento | null = estaq
    ? {
        kmInicial: num(pick(estaq, "kminicial")),
        kmFinal: num(pick(estaq, "kmfinal")),
        extensaoKm: num(pick(estaq, "extensao", "extensão")),
        nSegmentos: num(pick(estaq, "numerosegmentos", "segmentos")),
      }
    : null;

  const documentos: SinteseDocumentos | null = docs
    ? {
        contratoInterno: str(pick(docs, "contratonumerointerno", "numerointerno")),
        contratoLink: strCad(pick(docs, "contratolink")),
        anexos: strCad(pick(docs, "anexos")),
        proposta: strCad(pick(docs, "proposta")),
      }
    : null;

  const adminObj = admin ?? null;
  const adminMapped: SinteseAdmin | null = adminObj
    ? {
        gestorDoContrato: strCad(pick(adminObj, "gestordocontrato", "gestor")),
        prepostoDaContratada: strCad(pick(adminObj, "preposto")),
        fiscalTecnico: strCad(pick(adminObj, "fiscaltecnico", "fiscal tec")),
        fiscalAdministrativo: strCad(pick(adminObj, "fiscaladministrativo", "fiscal adm")),
        comissaoDeFiscalizacao: strCad(pick(adminObj, "comissao", "comissão")),
        contatoEmail: strCad(pick(adminObj, "contatoemail", "email")),
      }
    : null;

  const dataBaseOrcamento = insumoParams ? str(pick(insumoParams, "data-base", "data base")) : null;

  // ── Financeiro (cards novos) — Anexo XIV (PV preço global) + Painel 3 (atualizado/reajuste) ──
  const p3: Row = (painel3Obj as Row | null) ?? {};
  const bdiR: Row = (bdiResumoObj as Row | null) ?? {};
  const gruposBrutos: Row[] = Array.isArray(grupoRows) ? (grupoRows as Row[]) : [];
  const gruposItens = gruposBrutos
    .map((r) => ({
      grupo: String(pick(r, "grupo") ?? "").trim(),
      valorRs: num(pick(r, "valor")),
      pct: num(pick(r, "percentual", "% do total")),
    }))
    .filter((g) => g.grupo && !g.grupo.toLowerCase().startsWith("total") && g.valorRs != null);
  const orcamentoInternoRs = gruposItens.length
    ? Math.round(gruposItens.reduce((acc, g) => acc + (g.valorRs ?? 0), 0) * 100) / 100
    : null;
  const pvInicialRs =
    num(pick(bdiR, "valorContratoPrecoGlobal")) ?? num(pick(p3, "valorInicialContratoPV"));
  const valorAtualizadoRs = num(pick(p3, "valorTotalAtualizado"));
  const financeiro = {
    pvInicialRs,
    valorAtualizadoRs,
    orcamentoInternoRs,
    margemPct:
      valorAtualizadoRs && orcamentoInternoRs != null
        ? ((valorAtualizadoRs - orcamentoInternoRs) / valorAtualizadoRs) * 100
        : null,
    bdiPct:
      (num(pick(bdiR, "bdiAplicadoPredominanteObras")) ?? num(pick(p3, "bdi")) ?? 0) * 100 || null,
    ciRs: num(pick(bdiR, "bdiEmValor")) ?? num(pick(p3, "custoIndiretoBDI")),
    reajustesAplicados: str(pick(p3, "reajustesAplicados")),
    reequilibriosAplicados: str(pick(p3, "reequilibriosAplicados")),
    aditivos: str(pick(p3, "aditivos")),
    aniversarioReajuste: str(pick(p3, "aniversarioReajuste")),
    indicesReajuste: str(pick(p3, "indicesReajuste")),
  };

  return {
    identidade,
    identificacaoLegal,
    prazosContratuais,
    estaqueamento,
    premissas,
    premissasTotal,
    equipe,
    trechos,
    trechosTotal,
    bdiRubricas,
    documentos,
    admin: adminMapped,
    dataBaseOrcamento,
    financeiro,
    orcamentoGrupos: { itens: gruposItens, totalRs: orcamentoInternoRs },
  };
}
