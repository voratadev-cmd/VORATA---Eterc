// @lovable.dev/vite-tanstack-config já inclui tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, componentTagger (dev), VITE_* env, @ alias e SSR error logger.
// O plugin do Cloudflare é peer optional — desligado pra produzir build estático
// (SPA com prerender) que roda em Vercel, Netlify, Cloudflare Pages e qualquer
// host de assets estáticos sem precisar de Workers.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Sem adapter de Workers — output 100% estático.
  cloudflare: false,
  tanstackStart: {
    // SPA mode: prerender estático do shell + fallback client-side para rotas dinâmicas.
    // maskPath '/' faz com que qualquer rota não prerenderizada caia no shell e o router
    // do TanStack hidrate a partir dali.
    spa: {
      enabled: true,
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
    },
  },
});
