import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Cross-fade nativo do browser (View Transitions API) entre rotas, em vez de
    // remontar a árvore e animar a partir de opacity:0 (que piscava). O browser
    // segura o snapshot antigo até o novo estar pronto → sem frame em branco.
    // Fallback automático p/ troca instantânea onde a API não existe.
    defaultViewTransition: true,
  });

  return router;
};
