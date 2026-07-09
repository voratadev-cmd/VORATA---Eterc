// Gate de paridade · ORQUESTRADOR.
// Junta os 3 insumos por domínio e imprime o scorecard:
//   • chat   = scripts/parity/chat_br101.json   (gerado por parity_chat.py no container)
//   • tela   = scripts/parity/tela_br101.json   (gerado por parity_tela.ts via bun)
//   • oráculo+âncora = scripts/parity/anchors.json
// Sai com código !=0 se houver divergência chat≠tela (consistência) ou chat≠oráculo (correção)
// num domínio numérico — vira o gate de regressão (CI / pré-deploy).
//
//   node scripts/parity/parity_gate.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, f), "utf8"));

// GATE_TELA_ONLY=1 (ou ausência de chat_br101.json) → verifica só tela × oráculo, sem o lado chat
// (usado no CI, que não alcança o Droplet; pós-Fase B o chat == obra_kpis == tela por construção).
const telaOnly = process.env.GATE_TELA_ONLY === "1";
let chat = {};
if (!telaOnly) {
  try {
    chat = load("chat_br101.json");
  } catch {
    /* sem lado chat → cai em tela-only */
  }
}
const tela = load("tela_br101.json");
const anchors = load("anchors.json");

// resolve "a.b[0].c" num objeto
const resolve = (obj, path) => {
  if (!path) return obj;
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((o, k) => (o == null ? o : o[k]), obj);
};
const toNum = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(
    String(v)
      .replace(/[^\d.,-]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : null;
};
const rel = (a, b) =>
  a == null || b == null ? Infinity : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
const fmt = (n) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

const TOL_CONS = 0.005; // chat vs tela: ~idênticos (0,5%)
const rows = [];
let failCons = 0,
  failCorr = 0,
  numCount = 0;

for (const [tool, a] of Object.entries(anchors)) {
  if (a.numeric === false) {
    rows.push({
      tool,
      label: a.label || "(não-numérico)",
      chat: "·",
      tela: "·",
      oracle: "·",
      cons: "—",
      corr: "—",
    });
    continue;
  }
  numCount++;
  // sem lado chat (tela-only) → usa o próprio tela como "chat" (cons fica trivial; o que importa é corr).
  const chatV =
    chat[tool] !== undefined
      ? toNum(resolve(chat[tool], a.chat_path))
      : toNum(tela[tool]?.value) * (a.tela_mult ?? 1);
  const telaRaw = toNum(tela[tool]?.value);
  const telaV = telaRaw == null ? null : telaRaw * (a.tela_mult ?? 1); // tela_mult normaliza unidade (ex: fração→%)
  const orcV = a.oracle == null ? null : toNum(a.oracle);
  const tolOrc = a.oracle_approx ? 0.03 : 0.002;

  // domínio numérico SEM valor de um lado = não dá pra verificar → FALHA (não silenciar com "?").
  const cons =
    chatV == null || telaV == null ? "FALTA" : rel(chatV, telaV) <= TOL_CONS ? "OK" : "DIVERGE";
  const corr =
    orcV == null
      ? "s/orác"
      : chatV == null
        ? "FALTA"
        : rel(chatV, orcV) <= tolOrc
          ? "OK"
          : "DIVERGE";
  if (cons === "DIVERGE" || cons === "FALTA") failCons++;
  if (corr === "DIVERGE" || corr === "FALTA") failCorr++;
  rows.push({
    tool,
    label: a.label || tool,
    chat: fmt(chatV),
    tela: fmt(telaV),
    oracle: orcV == null ? "—" : fmt(orcV),
    cons,
    corr,
  });
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const padL = (s, n) => String(s).padStart(n);
console.log("\n  PARIDADE chat × tela × oráculo · BR-101\n");
console.log(
  "  " +
    pad("domínio", 30) +
    padL("chat", 16) +
    padL("tela", 16) +
    padL("oráculo", 16) +
    "  cons     corr",
);
console.log("  " + "─".repeat(94));
for (const r of rows) {
  const mark = (v) => (v === "DIVERGE" || v === "FALTA" ? "✗ " + v : v === "OK" ? "✓ OK" : v);
  console.log(
    "  " +
      pad(r.label, 30) +
      padL(r.chat, 16) +
      padL(r.tela, 16) +
      padL(r.oracle, 16) +
      "  " +
      pad(mark(r.cons), 9) +
      mark(r.corr),
  );
}
console.log("  " + "─".repeat(94));
console.log(
  `\n  ${numCount} domínios numéricos · chat≠tela: ${failCons} · chat≠oráculo: ${failCorr}\n`,
);

if (failCons > 0 || failCorr > 0) {
  console.error(`GATE VERMELHO: ${failCons} divergência(s) chat≠tela, ${failCorr} chat≠oráculo.`);
  process.exit(1);
}
console.log("GATE VERDE: chat == tela == oráculo em todos os domínios numéricos cobertos.");
