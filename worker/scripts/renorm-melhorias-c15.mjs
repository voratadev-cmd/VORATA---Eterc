// Re-normalização C.15 Melhorias Documentais (BR-101) — narrativa ESTRUTURADA do mockup
// C15_MelhoriasDoc_BR101.html (fonte da verdade). Substitui o blob flat por JSON estruturado,
// limpa o Sev da tabela de Desvios (Crítico/Risco, sem emoji) e fixa o farol da KPI. Idempotente.
import pg from "pg";

const NARRATIVE = {
  subtitle:
    "Tela interna da ATERPA — arrumar a própria casa. Duas frentes: corrigir o existente e registrar daqui pra frente. (As ações voltadas ao contratante ficam no Plano de Ação, C.12.)",
  pageFarol: "risco",
  kpis: [
    { label: "RDOs analisados", valor: "90 dias (10/03→07/06)", sub: "565 atividades · 41 dias" },
    { label: "Atas (ROS)", valor: "1 (08/06 · 16 demandas)", sub: "5 pendentes · 11 ok" },
    { label: "Relatórios", valor: "aguardando", sub: "periodicidade e padrão" },
    { label: "Farol geral", valor: "Risco", sub: "documentação a reforçar", farol: "risco" },
  ],
  rdo: {
    titulo: "RDO — 90 dias · 565 atividades · 41 dias c/ efetivo",
    farol: "risco",
    achados: [
      'Pluviometria (mm) em só 27 de 90 dias — 25 dias c/ "chuva" e 5 de impraticabilidade sem mm; série incompleta enfraquece o pleito de chuvas (C.9).',
      'Coluna "ID CRONOGRAMA" usada em 17 de 565 atividades (3%) — atividades soltas, sem vínculo com cronograma.',
      'Campo "Contratado" do histograma = "Realizado" em 100% dos dias — é cópia, não vem da proposta. Some a base de comparação.',
      'Nomenclatura genérica ("OPERADOR PESADO", "Escavadeira 35T") — a proposta usa nomes específicos; quebra o de-para.',
      "MOD e MOI misturados nas duas colunas do formulário (ENGENHEIRO/FAXINEIRO ao lado de GREIDISTA/MECÂNICO), sem subtotais.",
      "Paralisações genéricas (18/05, 20–21/05, 25/05, 04–05/06): sem período acumulado, qtde executada ou efetivo parado.",
      "Retificação de efetivo de um RDO em RDO posterior (14/05) — corrigir no dia fragiliza menos que retificar depois.",
      "Veículo leve lançado como balde genérico, sem separar administração de produção — impede medir o real da frota indireta do Adm Local ([EQUIP] ficam com real=0; ~R$1,2 mi subestimado e distorce o contratado×real dos indiretos).",
    ],
    melhorias: [
      "Separar MOD de MOI no campo real do histograma (subtotais próprios).",
      '"Contratado" = histograma da proposta (previsto do mês), nunca cópia do realizado.',
      'Mesma nomenclatura da proposta (de-para de funções/equipamentos: "Operador Pesado" → "Op. de Escavadeira Hidráulica").',
      "Toda atividade vinculada ao cronograma/PQ: item/subitem + km específico como localização.",
      "Alerta de aderência: atividade anotada não prevista, ou prevista que não aparece → comentário obrigatório.",
      "Registrar o mm de chuva todos os dias (mesmo 0) — alimenta o C.9 automaticamente. Reforço contratual: a cláusula 8.26 só admite chuva como força maior se o evento exceder o histórico de 50 anos; sem a série diária registrada, o pleito não se sustenta.",
      "Paralisação/evento pontual sempre completo: período e HORÁRIO (início→fim), qtde executada, EFETIVO NOMINAL parado (funções + qtde) e atividade/item — não 'paralisado a pedido da fiscalização', mas 'das 08h às 14h, 1 escavadeira + 6 serventes parados na drenagem item __'.",
      "Separar veículo leve por centro de custo (administração / engenharia / produção / QSMR / manutenção) no RDO — permite alocar a frota indireta ao Adm Local e fechar o banana-com-banana dos indiretos.",
    ],
    exemplo: {
      comoEsta:
        'Como está: "A ATERPA informa que a atividade de tratamento de fundação com manta geotêxtil e areia, no trecho entre o KM 147+280 e o KM 147+740, encontra-se paralisada a pedido da fiscalização da AFL."',
      comoDeveria:
        'Como deveria ser: "A ATERPA registra que a atividade Tratamento de fundação c/ manta geotêxtil e areia (cronograma item __ · PQ item __), KM 147+280→147+740, paralisada desde __/__ (Nº dias) a pedido da AFL (ofício nº __). Executado: __ de __ m²."',
    },
  },
  aderencia: {
    titulo: "Aderência RDO × Cronograma físico-financeiro × Histogramas (BM 4)",
    semRegistro: [
      "Vistorias cautelares — 0 de 60: o histograma da adm local prevê 20/mês em M1–M3 (R$ 135 mil) e não há registro em RDO/C.18. Prova de estado-zero não se reconstitui — urgência máxima.",
      "Geodrenos: curva previa 12,5% em mai e 25% em jun — nenhuma anotação nos 90 RDOs.",
      "Mobilização: prevista desde mar/26; atividades de canteiro só aparecem nos RDOs a partir de ~25/04.",
    ],
    noPrazo: [
      "Supressão vegetal — prevista mai, anotada desde 25/04.",
      "Terraplenagem — prevista mai, iniciou 08/05.",
      "Drenagem — prevista mai; BSTC, berços e descidas d'água desde 07/05.",
      "Recuperação de sinistros — retaludamento 27/04 → 30/05 (frentes em execução, sem impedimento registrado).",
    ],
    iniciando: [
      "Pavimentação — prevista jun/26; 1º sinal no RDO: BGS em 03–05/06 — acompanhar ritmo.",
      "OAE / Pontes — prevista jul/26; mobilizar formas e central de armação.",
      'Verificar enquadramento (PQ × extra-escopo): "recuperação/manutenção de acesso", "transporte/posicionamento de barreiras".',
    ],
  },
  histogramas: {
    titulo:
      "Histogramas — previsto × mobilizado (M1–M3) · adm local (D.1) · MOD · EQP × real do RDO",
    gapsCriticos: 3,
    naoMobilizado: [
      "Guindaste 500 t (OAE) — previsto desde mai/26, não mobilizado. Longo lead time e OAE inicia jul/26: confirmar mobilização.",
      "Frota de pavimentação prevista p/ mai: rolos (pneus ×2, liso, tandem), placas vibratórias ×7, espargidor, distribuidor.",
      "Equipe de saúde/SMS prevista desde mar: médico, enfermeira, ambulância + motorista — sem registro. Obrigação legal.",
      "Equipe técnica desde mar: eng. medição, geólogo, eng. qualidade, eng. mecânico, almoxarife, téc. planejamento.",
      "Vistorias cautelares 0/60 · bombeiro hidráulico (1/4/4) · vigias 5 de 20 (segurança patrimonial).",
    ],
    semPrevisao: [
      "Escavadeira EC210 22t ×4 e trator agrícola ×4 — antecipação ou substituição de especificação? Confirmar contra M4+.",
      "Caminhão c/ guindauto ×2 e carregadeira 924G — idem.",
      "Rigger ×2 (MOI) sem linha na proposta.",
      "Se for antecipação a pedido da fiscalização ou por impedimento, registrar a causa — recurso antecipado sem frente é ociosidade potencial.",
    ],
    impossivel: [
      "6 motosserristas reais e 0 motosserras no EQP do RDO — a MO aparece, o equipamento não: falha de registro.",
      '4 motoniveladoras reais sem operador específico — o "OPERADOR PESADO (25)" genérico engole a verificação.',
      'Veículos leves por setor (Gol/Renegade/Hilux/Saveiro) × "VEÍCULO LEVE (21)" do RDO — sem de-para.',
      'Caminhão pipa ×2 real sem "motorista de pipa" anotado.',
    ],
  },
  atas: {
    titulo: "Atas — ROS 08/06 · 16 demandas (5 pend · 4 atras · 7 final)",
    farol: "risco",
    achados: [
      'Todas as demandas com "Frente: --Geral--" — sem km/frente, mesmo com local exato (ex.: erosão km 148+600).',
      'Prorrogações de prazo concedidas verbalmente ("solicita prorrogação... de acordo") sem formalização por ofício.',
      'Itens de impacto físico parados na ata: "Mudança da estrutura de pavimento perfil A" (laudo ATO pendente desde 21/05).',
      'Respostas da ATERPA às vezes ausentes ou genéricas ("mantém o mesmo status") — sem fundamento em cronograma/contrato.',
    ],
    melhorias: [
      "Sempre haver resposta da ATERPA, fundamentada em cronograma/contrato (cláusula, item, prazo).",
      'Registrar km/frente em toda demanda (acabar com o "--Geral--").',
      "Formalizar por ofício toda prorrogação de prazo combinada em reunião.",
      "Promover itens de impacto físico (pavimento perfil A, leiras) para a Timeline (C.13) como eventos, com cláusula e quantificação.",
      'Exemplo positivo a manter: resposta do bota-fora ("premissas da contratação; condicionantes serão avaliadas").',
    ],
  },
  relatorios: {
    titulo: "Relatórios (mensais / semanais) · nenhum recebido ainda — aguardando",
    notas: [
      "O que será analisado: periodicidade e padronização; aderência ao cronograma; consistência com RDOs e medições; registro de eventos.",
      "Recomendação desde já: estruturar o relatório mensal espelhando o RMA (faturamento · recursos · prazo · eventos), citando itens de cronograma/PQ.",
    ],
  },
  proximosRDO: [
    'Os 5 taludes sinistrados (km 148–152), impedidos (retigráfico): registrar o impedimento todos os dias — "Nº dias de impedimento, frente parada".',
    "Pavimentação iniciando (jun/26): registrar o marco — data, km da 1ª frente de base/BGS, equipe.",
    "Geodrenos não iniciados (previstos mai): registrar o motivo do não-início (projeto? área? sequência?).",
    "Vistorias cautelares (histograma adm local): registrar o início da campanha — imóveis, km, laudo nº — até zerar as 60.",
    "Chuva (mm) todo dia, mesmo 0 — junho já tem 108,5 mm em 5 dias medidos; série incompleta derruba o pleito de chuvas.",
    "Materiais ARTERIS (rachão, barreiras): registrar quantidades recebidas/movimentadas e horas de equipe dedicadas.",
  ],
  proximaAta: [
    'Responder "Mudança da estrutura de pavimento perfil A" (atrasada desde 21/05, laudo ATO pendente): consignar o impacto na frente.',
    "Cobrar a liberação dos taludes sinistrados (km 148–152) em ata (além da carta) — registrar dias de impedimento acumulados.",
    "Formalizar as prorrogações combinadas verbalmente (efluentes 15/06, inventário 15/06, câmeras de ré) — citar/anexar ofícios.",
    'Registrar km/frente em cada demanda nova (acabar com o "--Geral--").',
    "Inventário das barreiras ARTERIS: apresentar o levantamento iniciado e propor vistoria conjunta com data.",
  ],
  horizonte: [
    "OAE / Pontes iniciam jul/26: preparar o registro do marco (km 144+805 Rio dos Quarenta), recebimento de projetos.",
    "Liberação prevista do S3 (km 156+400 → 162+080) em ago/26: se não vier, o padrão de atraso (+1,3 mês) vira o 3º caso.",
    "Dispositivos de retorno (ago/26): conferir projetos e PQ antes do início — divergência aqui é pedido de preço novo.",
    "Janela de impedimento dos taludes vence (M5–M6): se persistir, o escalonamento (30 dias) promove o caso a claim.",
  ],
  novoDoc: {
    titulo: "Novo documento sugerido: Apropriação de Efetivo Paralisado",
    nota: "Formulário diário acionado em toda paralisação (chuva, fiscalização, falta de frente). Calcula sozinho o custo do efetivo parado. Campos: Data · RDO nº · Atividade+item · km início→fim · Causa · Hora início/fim · Efetivo parado.",
  },
  sintese:
    "Síntese: os RDOs têm boa disciplina diária (90/90) e localização por km — a base é boa; faltam o de-para de nomenclatura, separar MOD/MOI e registrar impedimentos/paralisações de forma completa.",
  desviosHeader: {
    titulo: "Desvios do previsto — varredura completa (CFF · Histogramas · Prazos)",
    cff: "CFF até mai/26: previsto acum R$ 28,1 mi · faturado R$ 12,9 mi · execução 45,8% → R$ 15,2 mi previsto e NÃO faturado (11 itens com real zero).",
    nota: "Toda divergência do previsto sem justificativa contemporânea em RDO/ata vira PLEITO (causa da Contratante) ou GAP PROBATÓRIO (causa da Contratada). Sem registro, é prejuízo silencioso. Regra: o que não saiu conforme o previsto, trata-se — medindo, registrando ou formalizando, no dia.",
  },
  ressalva:
    "Ressalva da varredura: o histograma de Adm Local acusa ~59 funções 'sem real', mas boa parte é artefato de nomenclatura (de-para proposta×RDO quebrado) e do Contratado vir como cópia do Realizado. Leitura confiável é sistêmica: corrigir o de-para, separar MOD/MOI e usar o Contratado da proposta antes de cobrar função por função.",
};

// Desvios — 9 cards (Sev limpo: Crítico/Risco). Colunas iguais à seção existente.
const DESVIOS_COLS = [
  "Sev.",
  "Item previsto",
  "Previsto",
  "Real / medido",
  "Justif.?",
  "Ação a tratar",
  "Fonte",
];
const D = (sev, item, prev, real, just, acao, fonte) => ({
  "Sev.": sev,
  "Item previsto": item,
  Previsto: prev,
  "Real / medido": real,
  "Justif.?": just,
  "Ação a tratar": acao,
  Fonte: fonte,
});
const DESVIOS = [
  D(
    "Crítico",
    "Vistorias cautelares (Adm Local)",
    "60 em M1–M3 (20/mês) · R$135 mil",
    "0 medido · sem linha na medição · 0 no RDO/C.18",
    "nenhuma",
    "Urgência máxima — prova de estado-zero não se reconstitui. Iniciar a campanha já; registrar imóvel, km e laudo nº até zerar as 60.",
    "Histograma",
  ),
  D(
    "Crítico",
    "Administração Local — medição",
    "desde mar/26 · R$2,84 mi/mês (R$130,8 mi)",
    "M1 (01/04) = ZERO · M2 (10/05) = só 1 mês",
    "nenhuma",
    "Medir mar/26 (retroativo) ou justificar. Banana-com-banana exige Adm Local nos dois lados; separar a frota indireta por centro de custo no RDO.",
    "Medição",
  ),
  D(
    "Crítico",
    "Solo Mole KM 144 — fundação c/ manta",
    "faturar até mai R$1,03 mi",
    "0 faturado",
    "PARCIAL — RDO 18/05 diz 'paralisado a pedido da AFL', mas sem ofício, dias ou m²",
    "Formalizar a paralisação (ofício, dias, executado/total) e quantificar — potencial pleito da Contratante. Sem isso, R$1,03 mi fica órfão.",
    "CFF",
  ),
  D(
    "Crítico",
    "Mobilização + Trecho 02 (km 156+400→162+080)",
    "mobilização R$5,33 mi · início contratual 03/04/26",
    "0% · 0 faturado · liberação real só ~set/26",
    "nenhuma em RDO/ata",
    "Registrar o motivo do não-início (liberação? projeto? sequência?). Se impedimento da Contratante, formalizar e cobrar — senão o atraso fica órfão.",
    "CFF + Crono",
  ),
  D(
    "Risco",
    "Sinistro Talude km 148+700",
    "prazo-limite 30/06/26 (17 dias!) · reprog. 04/09/26",
    "recuperação 6% faturada (aterro R$50k de R$790k) · talude ainda impedido (até M6)",
    "impedimento não quantificado no RDO",
    "Registrar dias de impedimento todo dia + formalizar a causa. O prazo vence dentro da janela de impedimento → base de prorrogação, mas só se registrado.",
    "Prazo",
  ),
  D(
    "Risco",
    "Drenagem Profunda KM 144",
    "faturar até mai R$626 mil",
    "0 faturado",
    "nenhuma",
    "Registrar o motivo do não-início (liberado? projeto? sequência?).",
    "CFF",
  ),
  D(
    "Risco",
    "Insumos — faturamento direto",
    "R$2,69 mi (materiais ARTERIS)",
    "0 medido",
    "nenhuma",
    "Medir/registrar quantidades recebidas e movimentadas e horas de equipe dedicadas.",
    "CFF",
  ),
  D(
    "Risco",
    "Geodrenos",
    "mai R$193 mil (12,5%) · jun 25%",
    "0 registro nos 90 RDOs · 0 faturado",
    "nenhuma",
    "Registrar o motivo do não-início (projeto / área / sequência).",
    "CFF + Histograma",
  ),
  D(
    "Risco",
    "Equipe de saúde/SMS e técnica",
    "desde mar/26 (médico, enfermeira, ambulância — obrigação legal; eng. medição, geólogo, qualidade, mecânico)",
    "0",
    "nenhuma",
    "Mobilizar e registrar — a equipe de saúde é obrigação legal (NR). Registrar a mobilização real da equipe técnica.",
    "Histograma",
  ),
];

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const obraId = (await c.query("select id from obras where id::text like 'fe288319%' limit 1"))
  .rows[0].id;
await c.query("begin");

const upd = async (tituloLike, patch) => {
  const r = await c.query(
    `update obra_secoes set dados=$1, colunas=$2, n_linhas=$3, tem_dado=true, extracao_version=46, config_version='v46_surgical'
     where contrato_id=$4 and titulo like $5`,
    [
      JSON.stringify(patch.dados),
      JSON.stringify(patch.colunas ?? []),
      patch.n_linhas ?? 0,
      obraId,
      tituloLike,
    ],
  );
  if (r.rowCount !== 1) throw new Error(`esperava 1 update em "${tituloLike}", veio ${r.rowCount}`);
};

await upd("C.15%Análise narrativa%", { dados: NARRATIVE, colunas: [], n_linhas: 0 });
await upd("C.15%Desvios do previsto%", {
  dados: DESVIOS,
  colunas: DESVIOS_COLS,
  n_linhas: DESVIOS.length,
});

// assertions
const nar = (
  await c.query(
    "select dados from obra_secoes where contrato_id=$1 and titulo like 'C.15%Análise narrativa%'",
    [obraId],
  )
).rows[0].dados;
const dv = (
  await c.query(
    "select dados from obra_secoes where contrato_id=$1 and titulo like 'C.15%Desvios do previsto%'",
    [obraId],
  )
).rows[0].dados;
const crit = dv.filter((x) => x["Sev."] === "Crítico").length;
const risco = dv.filter((x) => x["Sev."] === "Risco").length;
if (nar.rdo.achados.length !== 8 || nar.rdo.melhorias.length !== 8)
  throw new Error("RDO achados/melhorias != 8");
if (nar.kpis.length !== 4) throw new Error("kpis != 4");
if (dv.length !== 9 || crit !== 4 || risco !== 5)
  throw new Error(`desvios ${dv.length} (crit ${crit}, risco ${risco}) != 9 (4+5)`);
await c.query("commit");
console.log(
  `OK: narrativa estruturada (rdo 8/8, kpis 4) + desvios 9 (${crit} crít + ${risco} risco).`,
);
await c.end();
