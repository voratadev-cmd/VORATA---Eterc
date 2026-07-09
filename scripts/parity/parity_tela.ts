// Gate de paridade · LADO TELA.
// Importa cada probe em scripts/parity/probes/<tool>.ts (cada um exporta telaValue(id) + anchorLabel),
// roda contra a obra e despeja {tool: {anchorLabel, value}} JSON no stdout. bun carrega o .env.local
// sozinho → os read-models leem o banco como a tela faz.
//
//   bun run scripts/parity/parity_tela.ts [obra_id] > scripts/parity/tela_br101.json
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ID = process.argv[2] ?? "fe288319-ff4f-4564-a459-139dfb021265";
const here = dirname(fileURLToPath(import.meta.url));
const probesDir = join(here, "probes");

const out: Record<string, unknown> = {};
for (const f of readdirSync(probesDir).filter((n) => n.endsWith(".ts"))) {
  const tool = f.replace(/\.ts$/, "");
  try {
    const mod = await import(join(probesDir, f));
    out[tool] = {
      anchorLabel: mod.anchorLabel ?? null,
      value: typeof mod.telaValue === "function" ? await mod.telaValue(ID) : null,
    };
  } catch (e) {
    out[tool] = { error: (e as Error).message };
  }
}
console.log(JSON.stringify(out, null, 2));
