// Surgical normalização C.1 (Tela 1 · cadastral) — preenche os painéis legais/prazos do contrato
// (dados fixos do instrumento, fora do workbook financeiro) + corrige o contador de segmentos do
// Estaqueamento (16 → 10, resíduo do refresh C.14). Idempotente: DELETE-por-título + INSERT.
// Uso: SUPABASE_DB_URL='...' node scripts/normalize-c1-cadastral.mjs
import pg from "pg";

const OBRA = "fe288319-ff4f-4564-a459-139dfb021265";
const ARQUIVO = "6f511b40-2c64-4387-9cf5-480d03a6f80d";
const BASE = {
  contrato_id: OBRA,
  arquivo_id: ARQUIVO,
  extracao_version: 1,
  config_version: "workbook_motor@1.0.0",
  codigo: "C.1",
  modulo: "M2",
  tipo: "chave_valor",
  colunas: [],
  n_linhas: 0,
  tem_dado: true,
  coberta: false,
  status: "ok",
};

const SECOES = [
  {
    ordem: 313,
    titulo: "C.1 Síntese — Painel 1: Identificação Legal",
    dados: {
      "Nome do Negócio": "Duplicação BR-101/RJ — Macaé",
      Objeto: "Duplicação da rodovia BR-101/RJ, km 144+600 ao km 190+300, e obras de arte",
      "Nº do Contrato": "AFL-GOE-147/2024",
      "Nº do Processo Administrativo": "Não se aplica",
      "Regime de Execução": "Empreitada por preço unitário",
      "Licitação Vinculada": "Carta-Convite CC nº AFL-GOE-147/2024",
      Contratante: "AUTOPISTA FLUMINENSE S.A.",
      "CNPJ Contratante": "09.324.949/0001-11",
      "Trecho / Localização": "BR-101/RJ · km 144+600 a 190+300 · Macaé/RJ",
      Contratada: "Construtora ATERPA S.A.",
      "CNPJ Contratada": "17.162.983/0001-65",
      Consórcio: "Não — ATERPA 100%",
      "Subcontratação permitida": "Sim",
      "Foro Contratual": "Arbitragem — São Paulo · CAM-CCBC (Câmara de Comércio Brasil-Canadá)",
    },
  },
  {
    ordem: 314,
    titulo: "C.1 Síntese — Painel 2: Prazos e Marcos Contratuais",
    dados: {
      "OS Original": "02/01/2026",
      "OS Real": "09/03/2026 (deslocamento de 66 dias)",
      "Prazo de Execução": "46 meses",
      "Início da Execução": "mar/2026",
      "Término Previsto": "dez/2029",
      "Término Contratual": "05/01/2030",
      "Aceitação Provisória (TAP)": "Não emitido — formaliza a aceitação provisória das OBRAS",
      "Aceitação Definitiva (TAD)":
        "Não emitido — formaliza a aceitação definitiva e inicia o PERÍODO DE GARANTIA",
      "Período Chuvoso (baseline)": "Conforme baseline INMET Macaé A608 (ver C.9)",
      "Aniversário de Reajuste": "dez/2025 – dez/2026",
      "Índices de Reajuste": "(a cadastrar — fórmula paramétrica/SICRO)",
    },
  },
];

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  await c.query("begin");

  // 1) Estaqueamento: numeroSegmentosTrechos 16 → 10
  const upd = await c.query(
    `update obra_secoes set dados = jsonb_set(dados, '{numeroSegmentosTrechos}', '10'::jsonb)
       where contrato_id=$1 and titulo ilike '%Estaqueamento%'`,
    [OBRA],
  );
  console.log(`estaqueamento nSegmentos→10: ${upd.rowCount} row(s)`);

  // 2) Inserir/refrescar os 2 painéis cadastrais
  for (const s of SECOES) {
    await c.query("delete from obra_secoes where contrato_id=$1 and titulo=$2", [OBRA, s.titulo]);
    const row = { ...BASE, ...s };
    await c.query(
      `insert into obra_secoes
        (contrato_id,arquivo_id,extracao_version,config_version,ordem,codigo,modulo,titulo,tipo,colunas,dados,n_linhas,tem_dado,coberta,status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        row.contrato_id,
        row.arquivo_id,
        row.extracao_version,
        row.config_version,
        row.ordem,
        row.codigo,
        row.modulo,
        row.titulo,
        row.tipo,
        JSON.stringify(row.colunas),
        JSON.stringify(row.dados),
        row.n_linhas,
        row.tem_dado,
        row.coberta,
        row.status,
      ],
    );
    console.log(`inserida: ${s.titulo} (ordem ${s.ordem}, ${Object.keys(s.dados).length} campos)`);
  }

  await c.query("commit");
  console.log("OK · commit");
} catch (e) {
  await c.query("rollback");
  console.error("ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
