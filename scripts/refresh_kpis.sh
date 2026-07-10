#!/usr/bin/env bash
# Fase B · automação — refresca obra_kpis (o canônico das telas) p/ TODAS as obras.
# QUANDO rodar: após mudar um read-model (deploy/CI) OU após (re)normalizar uma obra (dado mudou).
# Sem isto o chat lê canônico stale — o gate de paridade pega, mas o certo é manter fresco.
#
#   SUPABASE_DB_URL='postgresql://…@aws-0-us-east-1.pooler.supabase.com:5432/postgres' \
#     bash scripts/refresh_kpis.sh
#   (LEITURA das telas = .env.local/anon · ESCRITA = pooler. Precisa de bun.)
set -euo pipefail
: "${SUPABASE_DB_URL:?defina SUPABASE_DB_URL (pooler) — ver CLAUDE.md}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
BR101="fe288319-ff4f-4564-a459-139dfb021265" # obra de referência (tem oráculos em anchors.json)

echo "→ verifica BR-101 (tela × oráculo) ANTES de persistir (não grava canônico errado)…"
bun run scripts/parity/parity_tela.ts "$BR101" > scripts/parity/tela_br101.json
GATE_TELA_ONLY=1 node scripts/parity/parity_gate.mjs

echo "→ persiste obra_kpis (todas as obras)…"
OBRAS=$(bun -e "import{SQL}from'bun';const s=new SQL(process.env.SUPABASE_DB_URL);const r=await s\`select id from public.obras\`;process.stdout.write(r.map(x=>x.id).join('\n'));await s.end()")
while IFS= read -r id; do
  [ -z "$id" ] && continue
  bun run scripts/persist_kpis.ts "$id"
done <<<"$OBRAS"

echo "✓ refresh_kpis concluído — obra_kpis sincronizado com as telas."
