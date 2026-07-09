// Tela NORMALIZAÇÃO — painel de CONTROLE da etapa 4 do pipeline (não vitrine de amostras).
// Snapshot: qual MOTOR processou a obra + KPIs reais do banco. Tabs:
//   · Motor & Contribuições — explica o motor, lista as extrações (escolher qual re-normalizar:
//     a contribuição re-normalizada vira a VIGENTE — os upserts substituem por obra) e as rotas
//     do workbook-motor com o estado de cada entidade.
//   · Cobertura do RMA — o que cada aba consome e se está populado (com link pra aba real).
//   · Seções do Workbook — a régua de completude do splitter (tipadas × capturadas) com busca.
//   · Tabelas do Banco — TUDO que foi populado, tabela a tabela (contagem via RPC dinâmica).
// Dados 100% reais (RPC normalizacao_contagens + obra_secoes + obra_arquivos/extracoes).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FarolCard,
  I,
  PageHeader,
  Segmented,
  Skeleton,
  Stepper,
  Tabs,
  Tag,
} from "@/components/ds";
import { ColPag, ColToolbar, ColVazio, normTxt, useColecao } from "@/lib/rma/colecao";
import { useObraArquivos } from "@/lib/hooks/useObraArquivos";
import {
  useApproveExtraction,
  useObraExtracoes,
  useRequestReNormalization,
} from "@/lib/hooks/useObraExtracoes";
import { useNormalizacaoContagens, useObraSecoes } from "@/lib/hooks/useNormalizacao";
import { useMedicoesByObra } from "@/lib/hooks/useMedicoes";
import type { ContagemTabela, SecaoWorkbook } from "@/lib/supabase/normalizacao";
import { getDisplayName, type ObraArquivo } from "@/lib/supabase/obraArquivos";
import type { ObraArquivoExtracao } from "@/lib/supabase/extracoes";
import "./normalizacao.css";

export const Route = createFileRoute("/_app/contracts/$contractId/normalizacao")({
  component: NormalizacaoPage,
  head: () => ({ meta: [{ title: "Normalização — RDM IA" }] }),
});

const fmtInt = (n: number) => n.toLocaleString("pt-BR");

// ── Catálogo das tabelas (rótulo + grupo + descrição) ───────────────────────
// Tabela que não estiver aqui ainda aparece no painel (a RPC é dinâmica) com rótulo cru.
type InfoTabela = { label: string; grupo: string; desc: string };
const TABELAS_INFO: Record<string, InfoTabela> = {
  obra_arquivos: {
    label: "Arquivos da obra",
    grupo: "Pipeline",
    desc: "documentos subidos + status da fila",
  },
  obra_secoes: {
    label: "Seções do workbook",
    grupo: "Pipeline",
    desc: "rede de completude do splitter (JSONB)",
  },
  obra_medicoes: {
    label: "Medições (BM)",
    grupo: "Medições",
    desc: "cabeçalho por BM · vigente por (obra, BM)",
  },
  obra_cronogramas: {
    label: "Cronograma · header",
    grupo: "Prazo",
    desc: "curva física prevista (header + meses)",
  },
  obra_cronograma_tarefas: {
    label: "Cronograma · tarefas",
    grupo: "Prazo",
    desc: "EDT do cronograma-fonte (MS Project)",
  },
  obra_cronograma_frente_mes: {
    label: "Matriz física disciplina×mês",
    grupo: "Prazo",
    desc: "% previsto acum. por frente (C.5)",
  },
  obra_prazo_marcos: {
    label: "Marcos contratuais",
    grupo: "Prazo",
    desc: "24 marcos com data-limite e farol",
  },
  obra_faturamento_curvas: {
    label: "Curva S · header",
    grupo: "Faturamento",
    desc: "contratado × real × projeção (header + meses)",
  },
  obra_faturamento_disciplina_mes: {
    label: "Matriz financeira disciplina×mês",
    grupo: "Faturamento",
    desc: "heatmap R$ previsto (C.3)",
  },
  obra_faturamento_frentes: {
    label: "Faturamento por disciplina",
    grupo: "Faturamento",
    desc: "resumo por disciplina (C.3)",
  },
  obra_faturamento_frente_trecho: {
    label: "Frente × Trecho (drill-down)",
    grupo: "Faturamento",
    desc: "deficit/aderência por local (C.3)",
  },
  obra_recursos: {
    label: "Recursos · itens",
    grupo: "Recursos",
    desc: "plano MOD/MOI/EQP função a função (C.4)",
  },
  obra_recursos_meses: {
    label: "Recursos · histograma",
    grupo: "Recursos",
    desc: "curva mensal de mobilização (C.4)",
  },
  obra_produtividade: {
    label: "Produtividade física",
    grupo: "Produtividade",
    desc: "kg/HH por doc de armação/concreto",
  },
  obra_produtividade_economica: {
    label: "Produtividade econômica",
    grupo: "Produtividade",
    desc: "R$/HH mês a mês (C.7)",
  },
  obra_insumos: {
    label: "Insumos · Curva ABC",
    grupo: "Insumos",
    desc: "take-off físico + preço orçado (C.6)",
  },
  obra_insumo_meses: {
    label: "Insumos · meses",
    grupo: "Insumos",
    desc: "distribuição mensal do take-off",
  },
  obra_insumo_excedente: {
    label: "Excedente IPCA (8.8)",
    grupo: "Insumos",
    desc: "Δ% real × teto por insumo relevante (D.5)",
  },
  obra_insumo_excedente_params: {
    label: "Excedente · parâmetros",
    grupo: "Insumos",
    desc: "consolidação da cláusula 8.8",
  },
  obra_curvas_c8: {
    label: "Curvas · cards (corte)",
    grupo: "Curvas & Mapa",
    desc: "Lib×Cap×Aloc no BM corrente (C.8)",
  },
  obra_curvas_frentes: {
    label: "Curvas · matriz por frente",
    grupo: "Curvas & Mapa",
    desc: "responsabilidade preliminar (C.8)",
  },
  obra_curvas_serie_mes: {
    label: "Curvas · série mensal",
    grupo: "Curvas & Mapa",
    desc: "4 curvas R$ acum. + toggle Produção (C.8×C.3)",
  },
  obra_mapa_segmentos: {
    label: "Mapa da obra por km",
    grupo: "Curvas & Mapa",
    desc: "segmentos liberados/impedidos (C.14)",
  },
  obra_chuvas: { label: "Chuvas · header", grupo: "Chuvas", desc: "resumo pluviométrico (C.9)" },
  obra_chuvas_meses: {
    label: "Chuvas · meses",
    grupo: "Chuvas",
    desc: "baseline INMET × real por mês (C.9)",
  },
  obra_bdi_rubricas: {
    label: "BDI · rubricas",
    grupo: "Desequilíbrio (M3)",
    desc: "fonte-mãe econômica (C.1)",
  },
  obra_desequilibrio: {
    label: "Painel Desequilíbrio",
    grupo: "Desequilíbrio (M3)",
    desc: "composição por categoria (D.0)",
  },
  obra_indiretos_base: {
    label: "Indiretos · base",
    grupo: "Desequilíbrio (M3)",
    desc: "base contratual (D.1)",
  },
  obra_indiretos_metodos: {
    label: "Indiretos · métodos",
    grupo: "Desequilíbrio (M3)",
    desc: "M1–M4 paralelos (D.1)",
  },
  obra_cpu_coeficientes: {
    label: "CPU · coeficientes",
    grupo: "Base de custo",
    desc: "558 composições (MOD/EQP/material)",
  },
  obra_condutas: {
    label: "Condutas",
    grupo: "Síntese",
    desc: "catálogo de ações do Adm Contratual IA (C.11)",
  },
  obra_panorama: {
    label: "Panorama do contrato",
    grupo: "Síntese",
    desc: "faróis multidimensionais (C.10)",
  },
  obra_sinteses: { label: "Sínteses da IA", grupo: "Síntese", desc: "textos ancorados em fatos" },
  obra_orcamentos: {
    label: "Orçamento · header",
    grupo: "Base de custo",
    desc: "preço de venda por EAP + BDI",
  },
};
const infoDe = (t: string): InfoTabela =>
  TABELAS_INFO[t] ?? { label: t, grupo: "Outros", desc: "—" };

// ── Rotas do workbook-motor (espelho de agent/agents/normalizacao/workbook_motor.py) ──
const ROTAS_MOTOR: { rota: string; fonte: string; tabelas: string[] }[] = [
  { rota: "Curva ABC de insumos", fonte: "C.6", tabelas: ["obra_insumos"] },
  {
    rota: "Recursos MOD/MOI/EQP + histograma",
    fonte: "C.4",
    tabelas: ["obra_recursos", "obra_recursos_meses"],
  },
  { rota: "Curva mensal Previsto × Real", fonte: "C.3", tabelas: ["obra_faturamento_curvas"] },
  { rota: "Curva física prevista", fonte: "C.5", tabelas: ["obra_cronogramas"] },
  {
    rota: "Produtividade econômica (R$/HH)",
    fonte: "C.7",
    tabelas: ["obra_produtividade_economica"],
  },
  { rota: "BDI · rubricas (fonte-mãe)", fonte: "C.1", tabelas: ["obra_bdi_rubricas"] },
  { rota: "Painel Desequilíbrio", fonte: "D.0", tabelas: ["obra_desequilibrio"] },
  {
    rota: "Indiretos · base + métodos",
    fonte: "D.1",
    tabelas: ["obra_indiretos_base", "obra_indiretos_metodos"],
  },
  {
    rota: "Curvas · cards + matriz por frente",
    fonte: "C.8",
    tabelas: ["obra_curvas_c8", "obra_curvas_frentes"],
  },
  { rota: "Panorama do contrato", fonte: "C.10", tabelas: ["obra_panorama"] },
  { rota: "Faturamento por disciplina", fonte: "C.3", tabelas: ["obra_faturamento_frentes"] },
  {
    rota: "Frente × Trecho (drill-down)",
    fonte: "C.3",
    tabelas: ["obra_faturamento_frente_trecho"],
  },
  {
    rota: "Matriz financeira disciplina×mês",
    fonte: "C.3",
    tabelas: ["obra_faturamento_disciplina_mes"],
  },
  { rota: "Matriz física disciplina×mês", fonte: "C.5", tabelas: ["obra_cronograma_frente_mes"] },
  { rota: "Série mensal das 4 curvas", fonte: "C.8×C.3", tabelas: ["obra_curvas_serie_mes"] },
  { rota: "Mapa da obra por km", fonte: "C.14", tabelas: ["obra_mapa_segmentos"] },
  { rota: "Excedente ao IPCA (cl. 8.8)", fonte: "D.5", tabelas: ["obra_insumo_excedente"] },
  {
    rota: "Chuvas · baseline + resumo",
    fonte: "C.9",
    tabelas: ["obra_chuvas", "obra_chuvas_meses"],
  },
  { rota: "Condutas", fonte: "C.11", tabelas: ["obra_condutas"] },
  { rota: "Marcos contratuais", fonte: "C.5", tabelas: ["obra_prazo_marcos"] },
  { rota: "CPU · coeficientes", fonte: "CPU", tabelas: ["obra_cpu_coeficientes"] },
  { rota: "Captura genérica (nada se perde)", fonte: "todas", tabelas: ["obra_secoes"] },
];

// ── Cobertura por aba do RMA (entidades REAIS que cada aba consome + rota navegável) ──
const RMA_COBERTURA: {
  id: string;
  label: string;
  entidades: string[];
  derivada?: boolean;
}[] = [
  { id: "visao-geral", label: "Visão Geral", entidades: [], derivada: true },
  { id: "indicadores", label: "Indicadores e Farol", entidades: [], derivada: true },
  {
    id: "faturamento",
    label: "Faturamento",
    entidades: [
      "obra_faturamento_curvas",
      "obra_faturamento_disciplina_mes",
      "obra_faturamento_frentes",
      "obra_faturamento_frente_trecho",
    ],
  },
  { id: "recursos", label: "Recursos", entidades: ["obra_recursos", "obra_recursos_meses"] },
  { id: "produtividade", label: "Produtividade", entidades: ["obra_produtividade_economica"] },
  {
    id: "prazo",
    label: "Prazo e Cronograma",
    entidades: ["obra_cronogramas", "obra_cronograma_frente_mes", "obra_prazo_marcos"],
  },
  { id: "insumos", label: "Insumos", entidades: ["obra_insumos", "obra_insumo_excedente"] },
  {
    id: "curvas",
    label: "Curvas e Responsabilidade",
    entidades: [
      "obra_curvas_c8",
      "obra_curvas_serie_mes",
      "obra_curvas_frentes",
      "obra_mapa_segmentos",
    ],
  },
  { id: "chuvas", label: "Análise de Chuvas", entidades: ["obra_chuvas_meses"] },
  { id: "panorama", label: "Panorama", entidades: ["obra_panorama"] },
];

type NormTab = "motor" | "cobertura" | "secoes" | "tabelas";

function NormalizacaoPage() {
  const { contractId } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<NormTab>("motor");

  const { data: contagens, isLoading: l1, isError: e1 } = useNormalizacaoContagens(contractId);
  const { data: secoes, isLoading: l2 } = useObraSecoes(contractId);
  const { data: arquivos, isLoading: l3 } = useObraArquivos(contractId);
  const { data: extracoes } = useObraExtracoes(contractId);
  const { data: meds } = useMedicoesByObra(contractId);

  const porTabela = useMemo(() => {
    const m = new Map<string, ContagemTabela>();
    for (const c of contagens ?? []) m.set(c.tabela, c);
    return m;
  }, [contagens]);

  const resumo = useMemo(() => {
    const entidades = (contagens ?? []).filter(
      (c) => c.tabela !== "obra_arquivos" && c.tabela !== "obra_secoes",
    );
    const populadas = entidades.filter((c) => c.n > 0);
    const linhas = populadas.reduce((s, c) => s + c.n, 0);
    const review = entidades.reduce((s, c) => s + c.nReview, 0);
    const tabelasPop = (contagens ?? []).filter((c) => c.n > 0).length;
    const sec = secoes ?? [];
    const cobertas = sec.filter((s) => s.coberta).length;
    const temWorkbook = sec.length > 0;
    const temMedicoes = (meds ?? []).length > 0;
    const motor = temWorkbook
      ? temMedicoes
        ? "Workbook-motor + Multi-doc"
        : "Workbook-motor (splitter)"
      : temMedicoes
        ? "Multi-doc (por competência)"
        : null;
    return {
      populadas: populadas.length,
      total: entidades.length,
      tabelasPop,
      linhas,
      review,
      cobertas,
      nSecoes: sec.length,
      motor,
    };
  }, [contagens, secoes, meds]);

  const steps = [
    { id: "cadastro", label: "Cadastro", hint: "concluído", status: "done" as const },
    { id: "mapeamento", label: "Mapeamento", hint: "concluído", status: "done" as const },
    { id: "extracao", label: "Extração", hint: "concluído", status: "done" as const },
    {
      id: "normalizacao",
      label: "Normalização",
      hint: "painel de controle",
      status: "current" as const,
    },
  ];

  if (l1 || l2 || l3) {
    return (
      <>
        <PageHeader title="Normalização" subtitle="Carregando o painel de controle…" />
        <div className="norm-kpis-hero">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 88 }} />
          ))}
        </div>
        <Skeleton style={{ height: 420, marginTop: "var(--s-4)" }} />
      </>
    );
  }
  if (e1) {
    return (
      <>
        <PageHeader title="Normalização" subtitle="Painel de controle do dado normalizado" />
        <Card>
          <EmptyState
            framed
            icon={I.close({ size: 40 })}
            title="Não foi possível carregar as contagens"
            text="Erro ao consultar o banco (RPC normalizacao_contagens). Tente recarregar."
            hint={<Badge tone="danger">Erro de leitura</Badge>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Normalização"
        subtitle="A Extração preserva o envelope fiel de cada documento; a Normalização promove cada seção a entidade TIPADA no banco (resolver + gate de conservação). Este painel mostra o motor usado, as contribuições e tudo o que está populado."
        back={{
          label: "Extração",
          onClick: () =>
            navigate({ to: "/contracts/$contractId/extracao", params: { contractId } }),
        }}
      />

      <div className="norm-stepper">
        <Stepper
          steps={steps}
          onStepClick={(id) => {
            if (id === "extracao")
              navigate({ to: "/contracts/$contractId/extracao", params: { contractId } });
            if (id === "mapeamento")
              navigate({ to: "/contracts/$contractId/mapeamento", params: { contractId } });
          }}
        />
      </div>

      {/* ── Snapshot · motor + KPIs reais do banco ─────────────────────────── */}
      <div className="norm-kpis-hero">
        <FarolCard
          label="MOTOR DE NORMALIZAÇÃO"
          icon="settings"
          value={resumo.motor ?? "—"}
          info={
            resumo.motor
              ? resumo.nSecoes > 0
                ? `${resumo.nSecoes} seções capturadas do workbook`
                : `${(meds ?? []).length} medições por competência`
              : "nenhum documento normalizado ainda"
          }
          accent="ink"
        />
        <FarolCard
          label="ENTIDADES POPULADAS"
          icon="pkg"
          value={`${resumo.populadas} de ${resumo.total}`}
          info={`${fmtInt(resumo.linhas)} linhas normalizadas no total`}
          accent="neutral"
        />
        <FarolCard
          label="SEÇÕES TIPADAS"
          icon="shield"
          value={resumo.nSecoes > 0 ? `${resumo.cobertas} de ${resumo.nSecoes}` : "—"}
          info={
            resumo.nSecoes > 0
              ? "o resto está CAPTURADO em JSONB (nada se perde)"
              : "obra sem workbook consolidado"
          }
          accent="neutral"
        />
        <FarolCard
          label="EM REVISÃO (GATES)"
          icon="flag"
          value={String(resumo.review)}
          info={
            resumo.review > 0
              ? "linhas com gate de conservação reprovado"
              : "todos os gates de conservação fecharam"
          }
          accent={resumo.review > 0 ? "warning" : "success"}
        />
      </div>

      <Tabs<NormTab>
        className="norm-tabs"
        value={tab}
        onChange={setTab}
        aria-label="Painéis da normalização"
        items={[
          { value: "motor", label: "Motor & Contribuições" },
          { value: "cobertura", label: "Cobertura do RMA" },
          { value: "secoes", label: `Seções do Workbook · ${resumo.nSecoes}` },
          { value: "tabelas", label: `Tabelas do Banco · ${resumo.tabelasPop}` },
        ]}
      />

      {tab === "motor" && (
        <div className="norm-tab-painel">
          <MotorCard temWorkbook={resumo.nSecoes > 0} temMedicoes={(meds ?? []).length > 0} />
          <ContribuicoesCard
            contractId={contractId}
            arquivos={arquivos ?? []}
            extracoes={extracoes}
          />
          {resumo.nSecoes > 0 && <RotasMotorCard porTabela={porTabela} />}
        </div>
      )}

      {tab === "cobertura" && (
        <div className="norm-tab-painel">
          <CoberturaRmaCard contractId={contractId} porTabela={porTabela} />
        </div>
      )}

      {tab === "secoes" && (
        <div className="norm-tab-painel">
          {resumo.nSecoes > 0 ? (
            <SecoesCard secoes={secoes ?? []} />
          ) : (
            <Card>
              <EmptyState
                framed
                icon={I.pkg({ size: 40 })}
                title="Obra sem workbook consolidado"
                text="A régua de seções vale para obras com XLSX-motor. Esta obra usa o trilho multi-documento (por competência)."
              />
            </Card>
          )}
        </div>
      )}

      {tab === "tabelas" && (
        <div className="norm-tab-painel">
          <TabelasCard contagens={contagens ?? []} />
        </div>
      )}
    </>
  );
}

// ── Tab 1 · Motor & Contribuições ────────────────────────────────────────────
function MotorCard({ temWorkbook, temMedicoes }: { temWorkbook: boolean; temMedicoes: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Como o motor funciona</CardTitle>
        {temWorkbook && <Badge tone="info">Workbook-motor</Badge>}
        {!temWorkbook && temMedicoes && <Badge tone="info">Multi-doc</Badge>}
      </CardHeader>
      <div className="norm-motor-grid">
        <div className={`norm-motor-trilho${temWorkbook ? " ativo" : ""}`}>
          <div className="norm-motor-trilho-head">
            {I.doc({ size: 16 })} <strong>Workbook-motor (splitter)</strong>
            {temWorkbook && <Badge tone="success">em uso nesta obra</Badge>}
          </div>
          <p>
            A obra sobe <strong>1 XLSX consolidado</strong> (80+ abas). A extração lê as células{" "}
            <strong>em código</strong> (determinística — o modelo só identifica regiões, nunca
            transcreve número) e gera um envelope de seções. O splitter roteia{" "}
            <strong>seção a seção</strong>: cada uma com resolver próprio + gate de conservação ao
            centavo. O que ainda não tem resolver fica <strong>capturado</strong> em JSONB
            (auditável, nada se perde). Re-normalizar substitui a contribuição{" "}
            <strong>vigente por obra</strong> — nunca soma em dobro.
          </p>
        </div>
        <div className={`norm-motor-trilho${!temWorkbook && temMedicoes ? " ativo" : ""}`}>
          <div className="norm-motor-trilho-head">
            {I.copy({ size: 16 })} <strong>Multi-documento (por competência)</strong>
            {temMedicoes && (
              <Badge tone="success">{temWorkbook ? "também em uso" : "em uso nesta obra"}</Badge>
            )}
          </div>
          <p>
            Cada documento (BM, cronograma, RDO, NF…) entra <strong>individualmente</strong>; a
            competência é resolvida pelo nº do BM (falha-alto se ambígua) e a medição vigente é{" "}
            <strong>por (obra, BM)</strong> — re-enviar o BM corrigido substitui o anterior. É o
            trilho do <strong>fluxo mensal incremental</strong>: manda só o pacote do mês, sem
            re-extrair o histórico.
          </p>
        </div>
      </div>
      <p className="norm-motor-nota">
        Gates de qualidade na extração (cobertura célula-a-célula + números digitados) e na
        normalização (conservação ao centavo) — nada entra errado em silêncio: vira{" "}
        <strong>needs_review</strong> com o motivo apontado.
      </p>
    </Card>
  );
}

function ContribuicoesCard({
  contractId,
  arquivos,
  extracoes,
}: {
  contractId: string;
  arquivos: ObraArquivo[];
  extracoes: Map<string, ObraArquivoExtracao> | undefined;
}) {
  const navigate = useNavigate();
  const approve = useApproveExtraction(contractId);
  const reNorm = useRequestReNormalization(contractId);

  const tone = (s: string): "success" | "info" | "warning" | "danger" | "neutral" =>
    s === "normalized"
      ? "success"
      : s === "needs_review"
        ? "warning"
        : s.includes("error")
          ? "danger"
          : ["extracted", "verified"].includes(s)
            ? "info"
            : "neutral";
  const rotulo = (s: string) =>
    ({
      normalized: "Normalizado (vigente)",
      needs_review: "Em revisão (gate)",
      extracted: "Extraído · na fila de normalização",
      verified: "Verificado · na fila de normalização",
      normalizacao_error: "Erro na normalização",
      extraction_error: "Erro na extração",
    })[s] ?? s;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribuições · qual extração alimenta o banco</CardTitle>
        <Badge tone="neutral">
          {arquivos.length} arquivo{arquivos.length === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <p className="norm-sub">
        A normalização roda sobre <strong>uma extração</strong> de cada arquivo. Re-normalizar uma
        contribuição a torna <strong>vigente</strong> (substitui a anterior por obra). Arquivo em
        revisão precisa de decisão humana: aprovar mesmo assim ou re-extrair na tela de Extração.
      </p>
      {arquivos.length === 0 ? (
        <EmptyState
          title="Nenhum arquivo nesta obra"
          text="Suba os documentos no cadastro da obra para o pipeline começar."
        />
      ) : (
        <ul className="norm-contrib-list">
          {arquivos.map((a) => {
            const ext = extracoes?.get(a.id);
            return (
              <li key={a.id} className="norm-contrib-item">
                <div className="norm-contrib-main">
                  <span className="norm-contrib-nome" title={getDisplayName(a)}>
                    {getDisplayName(a)}
                  </span>
                  <span className="norm-contrib-meta">
                    {ext ? (
                      <>
                        extração v{ext.version}
                        {ext.doc_type ? ` · ${ext.doc_type}` : ""}
                      </>
                    ) : (
                      "sem extração ainda"
                    )}
                    {a.last_error && a.status === "needs_review" && (
                      <span className="norm-contrib-erro" title={a.last_error}>
                        {" "}
                        · motivo: {a.last_error.slice(0, 90)}…
                      </span>
                    )}
                  </span>
                </div>
                <div className="norm-contrib-acoes">
                  <Badge tone={tone(a.status)}>{rotulo(a.status)}</Badge>
                  {a.status === "needs_review" && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={approve.isPending}
                      onClick={() => {
                        const ok = window.confirm(
                          "Aprovar esta extração MESMO com o gate reprovado? O motivo fica " +
                            "registrado e a normalização roda em cima dela.",
                        );
                        if (ok) approve.mutate(a.id);
                      }}
                    >
                      {approve.isPending ? "Aprovando…" : "Aprovar mesmo assim"}
                    </Button>
                  )}
                  {["normalized", "normalizacao_error"].includes(a.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reNorm.isPending}
                      onClick={() => reNorm.mutate(a.id)}
                    >
                      {I.repeat({ size: 13 })}{" "}
                      {reNorm.isPending ? "Reenfileirando…" : "Re-normalizar"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigate({ to: "/contracts/$contractId/extracao", params: { contractId } })
                    }
                  >
                    ver extração
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RotasMotorCard({ porTabela }: { porTabela: Map<string, ContagemTabela> }) {
  const linhas = ROTAS_MOTOR.map((r) => {
    const ns = r.tabelas.map((t) => porTabela.get(t)?.n ?? 0);
    const review = r.tabelas.reduce((s, t) => s + (porTabela.get(t)?.nReview ?? 0), 0);
    const total = ns.reduce((s, n) => s + n, 0);
    return { ...r, total, review, populada: total > 0 };
  });
  const nPop = linhas.filter((l) => l.populada).length;
  const cols: DataTableColumn<(typeof linhas)[number]>[] = [
    {
      key: "rota",
      label: "Rota do motor",
      width: "2fr",
      render: (l) => (
        <div>
          <div className="norm-rota-nome">{l.rota}</div>
          <div className="norm-rota-tabelas">{l.tabelas.join(" · ")}</div>
        </div>
      ),
    },
    { key: "fonte", label: "Fonte", width: "90px", render: (l) => <Tag>{l.fonte}</Tag> },
    {
      key: "linhas",
      label: "Linhas",
      width: "110px",
      align: "right",
      render: (l) => <span className="tabular">{l.populada ? fmtInt(l.total) : "—"}</span>,
    },
    {
      key: "estado",
      label: "Estado",
      width: "150px",
      render: (l) =>
        l.review > 0 ? (
          <Badge tone="warning">{l.review} em revisão</Badge>
        ) : l.populada ? (
          <Badge tone="success">populada</Badge>
        ) : (
          <Tag>aguardando seção</Tag>
        ),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rotas do workbook-motor</CardTitle>
        <Badge tone={nPop === linhas.length ? "success" : "info"}>
          {nPop} de {linhas.length} populadas
        </Badge>
      </CardHeader>
      <p className="norm-sub">
        Cada rota = resolver + gate de conservação + tabela própria. Rota "aguardando seção" só
        acende quando a extração trouxer a seção correspondente do workbook.
      </p>
      <DataTable columns={cols} rows={linhas} getRowId={(l) => l.rota} />
    </Card>
  );
}

// ── Tab 2 · Cobertura do RMA ─────────────────────────────────────────────────
function CoberturaRmaCard({
  contractId,
  porTabela,
}: {
  contractId: string;
  porTabela: Map<string, ContagemTabela>;
}) {
  const navigate = useNavigate();
  const linhas = RMA_COBERTURA.map((t) => {
    const ents = t.entidades.map((e) => ({
      tabela: e,
      n: porTabela.get(e)?.n ?? 0,
      label: infoDe(e).label,
    }));
    const populadas = ents.filter((e) => e.n > 0);
    const estado: "derivada" | "normalizado" | "parcial" | "pendente" = t.derivada
      ? "derivada"
      : populadas.length === ents.length && ents.length > 0
        ? "normalizado"
        : populadas.length > 0
          ? "parcial"
          : "pendente";
    return { ...t, ents, populadas, estado };
  });
  const nOk = linhas.filter((l) => l.estado === "normalizado").length;
  const nPrim = linhas.filter((l) => !l.derivada).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobertura das abas do RMA</CardTitle>
        <Badge tone={nOk === nPrim ? "success" : "info"}>
          {nOk} de {nPrim} abas completas
        </Badge>
      </CardHeader>
      <p className="norm-sub">
        Cada aba consome entidades canônicas do banco — abaixo, o que cada uma tem de dado real e o
        que ainda falta. Clique para abrir a aba.
      </p>
      <ul className="norm-cob-list">
        {linhas.map((l) => (
          <li key={l.id} className={`norm-cob-item is-${l.estado}`}>
            <div className="norm-cob-main">
              <span className="norm-cob-nome">{l.label}</span>
              <span className="norm-cob-det">
                {l.derivada
                  ? "calculada a partir das outras abas"
                  : l.ents.map((e) => `${e.label}: ${e.n > 0 ? fmtInt(e.n) : "—"}`).join(" · ")}
              </span>
            </div>
            <div className="norm-cob-acoes">
              <Badge
                tone={
                  l.estado === "normalizado"
                    ? "success"
                    : l.estado === "parcial"
                      ? "warning"
                      : l.estado === "derivada"
                        ? "info"
                        : "neutral"
                }
              >
                {l.estado === "normalizado"
                  ? "Completa"
                  : l.estado === "parcial"
                    ? `${l.populadas.length}/${l.ents.length} entidades`
                    : l.estado === "derivada"
                      ? "Derivada"
                      : "Pendente"}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  navigate({
                    to: `/contracts/$contractId/rma/${l.id}` as "/contracts/$contractId/rma/faturamento",
                    params: { contractId },
                  })
                }
              >
                abrir {I.chevRight({ size: 13 })}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Tab 3 · Seções do workbook (régua de completude) ─────────────────────────
type FiltroSecao = "todas" | "tipadas" | "capturadas";

function SecoesCard({ secoes }: { secoes: SecaoWorkbook[] }) {
  const [filtro, setFiltro] = useState<FiltroSecao>("todas");
  const filtradas = useMemo(
    () =>
      secoes.filter((s) =>
        filtro === "todas" ? true : filtro === "tipadas" ? s.coberta : !s.coberta,
      ),
    [secoes, filtro],
  );
  const col = useColecao(filtradas, {
    busca: (s) => `${s.codigo ?? ""} ${s.titulo} ${s.modulo ?? ""}`,
    ordenacoes: [
      { value: "ordem", label: "Ordem do workbook", cmp: (a, b) => a.ordem - b.ordem },
      {
        value: "linhas",
        label: "Mais linhas",
        cmp: (a, b) => (b.nLinhas ?? 0) - (a.nLinhas ?? 0),
      },
      {
        value: "codigo",
        label: "Código (A–Z)",
        cmp: (a, b) => normTxt(a.codigo ?? "").localeCompare(normTxt(b.codigo ?? "")),
      },
    ],
    perPage: 15,
  });
  const nTipadas = secoes.filter((s) => s.coberta).length;

  const cols: DataTableColumn<SecaoWorkbook>[] = [
    {
      key: "codigo",
      label: "Código",
      width: "90px",
      render: (s) => <Tag>{s.codigo ?? "—"}</Tag>,
    },
    {
      key: "titulo",
      label: "Seção",
      width: "3fr",
      render: (s) => (
        <span className="norm-sec-titulo" title={s.titulo}>
          {s.titulo}
        </span>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      width: "110px",
      render: (s) => <span className="norm-sec-tipo">{s.tipo ?? "—"}</span>,
    },
    {
      key: "linhas",
      label: "Linhas",
      width: "90px",
      align: "right",
      render: (s) => <span className="tabular">{s.nLinhas != null ? fmtInt(s.nLinhas) : "—"}</span>,
    },
    {
      key: "estado",
      label: "Estado",
      width: "130px",
      render: (s) => (s.coberta ? <Badge tone="success">tipada</Badge> : <Tag>capturada</Tag>),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Seções capturadas do workbook</CardTitle>
        </div>
        <div className="norm-sec-toolbar">
          <Segmented<FiltroSecao>
            value={filtro}
            onChange={setFiltro}
            aria-label="Filtrar seções"
            items={[
              { value: "todas", label: `Todas · ${secoes.length}` },
              { value: "tipadas", label: `Tipadas · ${nTipadas}` },
              { value: "capturadas", label: `Capturadas · ${secoes.length - nTipadas}` },
            ]}
          />
        </div>
      </CardHeader>
      <p className="norm-sub">
        <strong>Tipada</strong> = virou entidade própria com gate de conservação.{" "}
        <strong>Capturada</strong> = preservada em JSONB esperando rota (auditável — nada foi
        descartado). A régua é recalculada a cada re-normalização.
      </p>
      {col.showToolbar ? (
        <ColToolbar col={col} placeholder="Buscar por código, título ou módulo…" />
      ) : null}
      {col.visible.length === 0 && col.debounced ? (
        <ColVazio termo={col.debounced} rotulo="seção" onClear={() => col.setQuery("")} />
      ) : (
        <DataTable columns={cols} rows={col.visible} getRowId={(s) => String(s.ordem)} />
      )}
      <ColPag col={col} rotulo="seções" />
    </Card>
  );
}

// ── Tab 4 · Tabelas do banco (tudo que populamos) ────────────────────────────
function TabelasCard({ contagens }: { contagens: ContagemTabela[] }) {
  const linhas = useMemo(
    () =>
      [...contagens]
        .map((c) => ({ ...c, info: infoDe(c.tabela) }))
        .sort(
          (a, b) =>
            a.info.grupo.localeCompare(b.info.grupo) ||
            b.n - a.n ||
            a.tabela.localeCompare(b.tabela),
        ),
    [contagens],
  );
  const col = useColecao(linhas, {
    busca: (t) => `${t.tabela} ${t.info.label} ${t.info.grupo} ${t.info.desc}`,
    ordenacoes: [
      { value: "grupo", label: "Por grupo", cmp: () => 0 },
      { value: "linhas", label: "Mais linhas", cmp: (a, b) => b.n - a.n },
      { value: "nome", label: "Tabela (A–Z)", cmp: (a, b) => a.tabela.localeCompare(b.tabela) },
    ],
    perPage: 15,
  });
  const populadas = linhas.filter((l) => l.n > 0);
  const totalLinhas = populadas.reduce((s, l) => s + l.n, 0);

  const cols: DataTableColumn<(typeof linhas)[number]>[] = [
    {
      key: "entidade",
      label: "Entidade",
      width: "2.2fr",
      render: (t) => (
        <div>
          <div className="norm-tbl-label">{t.info.label}</div>
          <div className="norm-tbl-code">
            {t.tabela} · {t.info.desc}
          </div>
        </div>
      ),
    },
    {
      key: "grupo",
      label: "Grupo",
      width: "150px",
      render: (t) => <Tag>{t.info.grupo}</Tag>,
    },
    {
      key: "n",
      label: "Linhas",
      width: "110px",
      align: "right",
      render: (t) =>
        t.n > 0 ? (
          <span className="tabular norm-tbl-n">{fmtInt(t.n)}</span>
        ) : (
          <span className="norm-tbl-zero">vazia</span>
        ),
    },
    {
      key: "review",
      label: "Em revisão",
      width: "110px",
      align: "right",
      render: (t) =>
        t.nReview > 0 ? (
          <Badge tone="warning">{fmtInt(t.nReview)}</Badge>
        ) : (
          <span className="norm-tbl-zero">—</span>
        ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tudo que está populado no banco</CardTitle>
        <Badge tone="success">
          {populadas.length} tabelas · {fmtInt(totalLinhas)} linhas
        </Badge>
      </CardHeader>
      <p className="norm-sub">
        Contagem ao vivo por tabela da obra (RPC dinâmica — entidade nova aparece aqui sozinha). "Em
        revisão" = linhas cujo gate de conservação não fechou.
      </p>
      {col.showToolbar ? (
        <ColToolbar col={col} placeholder="Buscar por entidade, tabela ou grupo…" />
      ) : null}
      {col.visible.length === 0 && col.debounced ? (
        <ColVazio termo={col.debounced} rotulo="tabela" onClear={() => col.setQuery("")} />
      ) : (
        <DataTable columns={cols} rows={col.visible} getRowId={(t) => t.tabela} />
      )}
      <ColPag col={col} rotulo="tabelas" />
    </Card>
  );
}
