#!/usr/bin/env bash
# Gate de paridade chat × tela × oráculo. Regenera os dois lados e roda o scorecard.
# Uso: scripts/parity/run.sh [obra_id]   (default = BR-101)
set -euo pipefail

ID="${1:-fe288319-ff4f-4564-a459-139dfb021265}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
SSH_ALIAS="${PARITY_SSH:-agente-rdm-ia}"   # host do Droplet (ver ~/.ssh/config); override por env

echo "→ lado chat (container no Droplet '$SSH_ALIAS')…"
ssh "$SSH_ALIAS" "cd /opt/agente && docker compose exec -T api python scripts/parity_chat.py $ID" > "$DIR/chat_${ID:0:8}.json"
cp "$DIR/chat_${ID:0:8}.json" "$DIR/chat_br101.json"   # nome estável que o gate lê

echo "→ lado tela (bun)…"
( cd "$ROOT" && bun run scripts/parity/parity_tela.ts "$ID" ) > "$DIR/tela_br101.json"

echo "→ scorecard…"
node "$DIR/parity_gate.mjs"
