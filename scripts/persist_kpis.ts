// Fase B · PERSISTE os KPIs canônicos das TELAS em obra_kpis.
// Roda os read-models (via os probes de scripts/parity/probes/) e grava o headline de cada domínio.
// O CHAT (tools.py) passa a LER de obra_kpis → chat == tela por construção. Reexecutar após mudar um
// read-model (senão o chat lê canônico stale; o gate de paridade pega se esquecer).
//
//   SUPABASE_DB_URL='postgresql://…@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
//     bun run scripts/persist_kpis.ts [obra_id]
//   (LEITURA via read-models = .env.local/anon; ESCRITA via pooler = pg, bypassa RLS como as migrations)
import { SQL } from "bun";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ID = process.argv[2] ?? "fe288319-ff4f-4564-a459-139dfb021265";
const DB = process.env.SUPABASE_DB_URL;
if (!DB) {
  console.error("defina SUPABASE_DB_URL (pooler) — ver CLAUDE.md");
  process.exit(2);
}

// unidade por tool — define arredondamento e semântica. Só os domínios numéricos canonizados entram.
const UNIDADE: Record<string, string> = {
  get_faturamento_resumo: "BRL",
  get_desequilibrio_resumo: "BRL",
  get_indiretos_detalhe: "BRL",
  get_bdi_desequilibrio: "BRL",
  get_encargos_detalhe: "BRL",
  get_valor_agregado: "BRL",
  get_pontuais: "BRL",
  get_insumos_resumo: "BRL",
  get_insumos_excedente: "BRL",
  get_bdi_buildup: "BRL",
  get_curvas_resumo: "BRL",
  get_mapa_liberacao_resumo: "BRL",
  get_recursos_resumo: "count",
  get_marcos_contratuais: "count",
  get_marcos_cronograma_fonte: "count",
  get_curva_fisica_por_frente: "count",
  get_panorama: "count",
  get_chuvas_resumo: "dias",
};
const roundU = (v: number, u: string) =>
  u === "BRL" ? Math.round(v * 100) / 100 : u === "count" ? Math.round(v) : v;

const here = dirname(fileURLToPath(import.meta.url));
const probesDir = join(here, "parity", "probes");

type Row = { key: string; valor: number; unidade: string; label: string | null };
const rows: Row[] = [];
for (const f of readdirSync(probesDir).filter((n) => n.endsWith(".ts"))) {
  const tool = f.replace(/\.ts$/, "");
  const unidade = UNIDADE[tool];
  if (!unidade) continue;
  try {
    const mod = await import(join(probesDir, f));
    const v = await mod.telaValue(ID);
    if (v == null || typeof v !== "number" || !Number.isFinite(v)) {
      console.warn(`· pulado ${tool}: valor não-numérico (${v})`);
      continue;
    }
    rows.push({ key: tool, valor: roundU(v, unidade), unidade, label: mod.anchorLabel ?? null });
  } catch (e) {
    console.warn(`· pulado ${tool}: ${(e as Error).message}`);
  }
}

const sql = new SQL(DB);
for (const r of rows) {
  await sql`
    insert into public.obra_kpis (contrato_id, kpi_key, valor, unidade, label, fonte, updated_at)
    values (${ID}, ${r.key}, ${r.valor}, ${r.unidade}, ${r.label}, ${r.key}, now())
    on conflict (contrato_id, kpi_key) do update
      set valor = excluded.valor, unidade = excluded.unidade, label = excluded.label,
          fonte = excluded.fonte, updated_at = now()`;
}
await sql.end();
console.log(`✓ obra_kpis: ${rows.length} KPIs gravados p/ ${ID.slice(0, 8)}`);
for (const r of rows) console.log(`  ${r.key} = ${r.valor} (${r.unidade})`);
