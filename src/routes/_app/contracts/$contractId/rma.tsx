// Layout pai do RMA (M2.1.2). Compartilha entre as 12 abas: Breadcrumb + PageHeader + RmaTabs +
// <Outlet />. REAL-TOLERANTE: lê o nome da obra do banco (useObra) em vez do mock — não dá mais
// 404 quando o registry de mock está vazio. O seletor de período (BmSeletor) volta quando houver
// a lista de BMs real; por ora cada aba mostra o BM corrente do seu próprio read-model.

import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import {
  AnaliseActions,
  type AnaliseEscopo,
  type AnaliseModo,
  AnaliseProvider,
  AnaliseSwitch,
  AnaliseView,
  EmptyState,
  I,
  PageHeader,
  Skeleton,
  useAnalise,
} from "@/components/ds";
import { RmaTabs } from "@/components/RmaTabs";
import { RmaPeriodoPicker } from "@/components/RmaPeriodoPicker/RmaPeriodoPicker";
import { EmConstrucao } from "@/components/EmConstrucao";
import { useObra } from "@/lib/hooks/useObra";
import { useRelatorio } from "@/lib/hooks/useRelatorio";
import "./rma.css";

type RmaSearch = { analise?: AnaliseEscopo; bm?: string };

export const Route = createFileRoute("/_app/contracts/$contractId/rma")({
  component: RmaLayout,
  // Estado da análise vive na URL (?analise=tela|geral). Necessário porque o RmaLayout REMONTA a cada
  // troca de aba (rotas-filhas) — estado local zeraria. Na URL ele sobrevive e fica compartilhável.
  // bm: mantido pro futuro seletor de período (preservado entre abas).
  validateSearch: (search: Record<string, unknown>): RmaSearch => ({
    analise: search.analise === "tela" || search.analise === "geral" ? search.analise : undefined,
    bm: typeof search.bm === "string" ? search.bm : undefined,
  }),
  head: () => ({ meta: [{ title: "RMA — RDM IA" }] }),
  // Abas do RMA sem dado normalizado jogam notFound(). Captura AQUI (ancestral mais próximo
  // que o _app) pra renderizar "Em construção" dentro do <Outlet/> — abaixo do breadcrumb e
  // da barra de abas, que continuam visíveis. withHeader=false: o RmaLayout já tem PageHeader.
  notFoundComponent: () => <EmConstrucao withHeader={false} />,
});

function RmaLayout() {
  const { contractId } = Route.useParams();
  const { analise } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: obra } = useObra(contractId);
  const nome = obra?.nome_interno ?? "Obra";

  // Aba ativa → decide se o seletor de período fica ativo (Recursos, Faturamento e Indicadores
  // respondem ao corte; nas demais ele aparece desabilitado com tooltip honesto).
  const { pathname } = useLocation();
  const seg = pathname.split("/").filter(Boolean).pop() ?? "";
  const bmAware = seg === "recursos" || seg === "faturamento" || seg === "indicadores";

  const modo: AnaliseModo = analise ? "analise" : "tela";
  const escopo: AnaliseEscopo = analise === "geral" ? "geral" : "tela";

  return (
    // RMA é o único com escopo duplo (esta aba × RMA inteiro) → temGeral. Controlado pela URL (ver
    // validateSearch). onBaixar (PDF) entra na próxima fase; sem ele, "Baixar Análise" fica desabilitado.
    <AnaliseProvider
      temGeral
      modo={modo}
      escopo={escopo}
      onChange={({ modo: m, escopo: e }) =>
        navigate({ search: (prev) => ({ ...prev, analise: m === "analise" ? e : undefined }) })
      }
      // Baixar = imprimir o relatório (o @media print isola o .rel → PDF idêntico à tela). Se a
      // análise não estiver aberta, abre primeiro e imprime após o render. PDF "de verdade" = fase 3.
      onBaixar={(esc) => {
        if (!analise) {
          navigate({ search: (prev) => ({ ...prev, analise: esc }) });
          window.setTimeout(() => window.print(), 450);
        } else {
          window.print();
        }
      }}
    >
      <Breadcrumb contractId={contractId} nome={nome} />

      <PageHeader
        title={`RMA · ${nome}`}
        subtitle="Relatório Mensal de Acompanhamento · dados normalizados (Camada A/B)"
        actions={
          <>
            <RmaPeriodoPicker contractId={contractId} disabled={!bmAware} />
            <AnaliseActions />
          </>
        }
      />

      <RmaTabs contractId={contractId} />

      {/* "Ver Análise da Tela" troca o <Outlet/> (aba ativa) pela análise. key por obra: trocar de
          contrato no picker REMONTA a aba — busca/página/sub-tab/frente não vazam de uma obra p/ outra. */}
      <AnaliseSwitch tela={<Outlet key={contractId} />} analise={<RmaAnalise nome={nome} />} />
    </AnaliseProvider>
  );
}

// ── Análise do RMA — rótulo por escopo (aba ativa × RMA inteiro). Placeholder na fase de layout. ──
const RMA_TAB_LABELS: Record<string, string> = {
  "visao-geral": "Visão Geral",
  indicadores: "Indicadores e Farol",
  faturamento: "Faturamento",
  recursos: "Recursos",
  produtividade: "Produtividade",
  prazo: "Prazo",
  insumos: "Insumos",
  curvas: "Curvas e Responsabilidade",
  chuvas: "Chuvas",
  panorama: "Panorama",
};

function RmaAnalise({ nome }: { nome: string }) {
  const { contractId } = Route.useParams();
  const { escopo } = useAnalise();
  const { pathname } = useLocation();
  const seg = pathname.split("/").filter(Boolean).pop() ?? "";
  const abaLabel = RMA_TAB_LABELS[seg] ?? "Visão Geral";
  // chave do relatório: a aba ativa (escopo "tela") ou "rma-geral" (escopo "RMA inteiro").
  const aba = escopo === "geral" ? "rma-geral" : seg || "visao-geral";
  const contexto = escopo === "geral" ? `RMA completo · ${nome}` : `Aba · ${abaLabel}`;
  const { data, isLoading, isError } = useRelatorio(contractId, aba);

  // Geração sob demanda (go-live): coleta os dados da aba (read-models) e POST /agents/adm/relatorios/gerar.
  // Backend pronto (agent/.../relatorio.py); falta a migration aplicada + o data-adapter por aba (F0 wire-up).
  const onGerar = () => {
    console.log("[relatorio] TODO go-live: coletar dados da aba + POST /relatorios/gerar", {
      contractId,
      aba,
    });
  };

  if (isLoading) {
    return (
      <div className="rel">
        <Skeleton variant="block" style={{ height: 520, maxWidth: 820, margin: "0 auto" }} />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rel">
        <EmptyState
          framed
          title="Não foi possível carregar a análise"
          text="Erro ao ler o relatório desta aba. Tente recarregar a página."
        />
      </div>
    );
  }
  return <AnaliseView relatorio={data ?? null} contexto={contexto} onGerar={onGerar} />;
}

// ── Breadcrumb ───────────────────────────────────────────────────────

function Breadcrumb({ contractId, nome }: { contractId: string; nome: string }) {
  return (
    <nav className="crumb" aria-label="Caminho">
      <Link to="/">Dashboard</Link>
      <span className="crumb-sep">{I.chevRight({ size: 12 })}</span>
      <span>Gestão Contratual</span>
      <span className="crumb-sep">{I.chevRight({ size: 12 })}</span>
      <Link to="/contracts/$contractId" params={{ contractId }} className="crumb-link">
        {nome}
      </Link>
      <span className="crumb-sep">{I.chevRight({ size: 12 })}</span>
      <span className="crumb-current">RMA</span>
    </nav>
  );
}
