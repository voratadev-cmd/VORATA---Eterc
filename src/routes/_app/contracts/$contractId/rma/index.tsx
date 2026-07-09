// Entry default do /rma — redireciona pra Visão Geral (overview executivo, agora ligado ao dado
// real via Bridge §7.1 com cobertura parcial honesta). Mantém o ?bm=BM-XX se vier na URL.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/contracts/$contractId/rma/")({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/contracts/$contractId/rma/visao-geral",
      params: { contractId: params.contractId },
      search, // preserva ?bm= e ?analise= ao cair na Visão Geral
    });
  },
});
