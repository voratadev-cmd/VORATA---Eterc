// Placeholder "Em construção" — renderizado no lugar do 404 quando uma tela de módulo
// ainda não foi implementada (loader joga notFound) OU quando uma aba do RMA não tem dado
// normalizado. Ligado como `notFoundComponent` em `_app.tsx` (dentro do AppShell, sidebar
// preservada) e em `rma.tsx` (dentro do breadcrumb + barra de abas). Real-tolerante: lê o
// nome da obra do banco via useObra, nunca quebra.
//
// HONESTIDADE: não é um spinner infinito (isso prometeria dado que não vem). É um estado
// vazio explícito — "esta tela ainda será construída" — com o contexto da obra.

import { useLocation, useParams } from "@tanstack/react-router";
import { Badge, Card, EmptyState, I, PageHeader } from "@/components/ds";
import { useObra } from "@/lib/hooks/useObra";

// Rótulos amigáveis por segmento de rota. O que não estiver aqui cai no prettify do
// último segmento (capitaliza + troca hífens) — sem ficar stale silenciosamente.
const ROTULO_SEGMENTO: Record<string, string> = {
  // RMA
  recursos: "Recursos",
  produtividade: "Produtividade",
  insumos: "Insumos",
  curvas: "Curvas",
  panorama: "Panorama",
  responsabilidade: "Responsabilidade",
  condutas: "Condutas",
  "plano-acao": "Plano de Ação",
  // Pré-Contrato
  bases: "Bases do Negócio",
  diagnostico: "Diagnóstico do Contrato",
  transpasse: "Transpasse e Documentos",
  // Gestão Contratual
  timeline: "Timeline",
  mapa: "Mapa / Retigráfico",
  "melhorias-doc": "Melhorias Documentais",
  "vistoria-imagem": "Vistoria por Imagem",
  biblioteca: "Biblioteca de Documentos",
  // Desequilíbrio
  desequilibrio: "Desequilíbrio",
  indiretos: "Indiretos",
  bdi: "BDI",
  encargos: "Encargos Sociais",
  "valor-agregado": "Valor Agregado",
  pontuais: "Análises Pontuais",
  "gerador-claim": "Gerador de Claim",
  // Finalização
  licoes: "Lições Aprendidas",
  pleitos: "Negociação de Pleitos",
  judicial: "Judicial / Arbitral",
  // Check-list / Contábil / Controle Documental
  checklist: "Check-list da Obra",
  contabil: "Contábil · AGM",
  "controle-documental": "Controle Documental",
};

function prettify(seg: string): string {
  const s = seg.replace(/-/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Tela";
}

/** Deriva um rótulo legível da tela a partir do último segmento de path significativo. */
function rotuloDaRota(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  // ignora ids de obra e o prefixo "contracts"
  const last = [...segs]
    .reverse()
    .find((s) => s !== "contracts" && s.length > 0 && !/^[0-9a-f-]{16,}$/i.test(s));
  if (!last) return "Tela";
  return ROTULO_SEGMENTO[last] ?? prettify(last);
}

export type EmConstrucaoProps = {
  /** Mostra PageHeader próprio. false quando o layout pai (ex.: RMA) já renderiza um. */
  withHeader?: boolean;
};

export function EmConstrucao({ withHeader = true }: EmConstrucaoProps) {
  const { contractId } = useParams({ strict: false }) as { contractId?: string };
  const location = useLocation();
  const { data: obra } = useObra(contractId ?? "");

  const tela = rotuloDaRota(location.pathname);
  const nome = obra?.nome_interno;

  return (
    <>
      {withHeader ? (
        <PageHeader
          title={tela}
          subtitle={nome ? `${nome} — tela em construção` : "Tela em construção"}
        />
      ) : null}
      <Card>
        <EmptyState
          framed
          icon={I.settings({ size: 42 })}
          title="Em construção"
          text={
            nome
              ? `Esta tela faz parte do RMA de ${nome} e será construída em uma próxima iteração. Os dados aparecerão aqui assim que a fonte for normalizada.`
              : "Esta tela será construída em uma próxima iteração. Os dados aparecerão aqui assim que a fonte for normalizada."
          }
          hint={<Badge tone="info">Em breve</Badge>}
        />
      </Card>
    </>
  );
}
