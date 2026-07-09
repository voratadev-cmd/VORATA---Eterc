"""Gate de paridade · LADO CHAT.

Chama CADA tool da obra isolada (sem subir o MCP nem a LLM — só a função que lê o banco)
e despeja {tool: data} JSON no stdout. É um dos três insumos do scorecard de paridade
(chat × tela × oráculo); o read-model da tela é coletado por scripts/parity_tela.ts e o
join/veredito por scripts/parity_gate.mjs.

Roda DENTRO do container (env + service key já presentes):
    docker compose exec -T api python scripts/parity_chat.py <obra_id>
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

# Permite rodar como `python scripts/parity_chat.py` de qualquer cwd (põe a raiz do app no path).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.adm_contratual.tools import build_adm_tools_server  # noqa: E402


def _extract(mcp_result: object) -> object:
    """A tool devolve {"content":[{"type":"text","text": "<json>"}]} — extrai e parseia o JSON."""
    try:
        blocks = (mcp_result or {}).get("content") or []  # type: ignore[union-attr]
        text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict))
        return json.loads(text) if text else None
    except Exception as e:  # noqa: BLE001
        return {"_parse_error": f"{type(e).__name__}: {e}"}


async def main(obra_id: str) -> None:
    callables = build_adm_tools_server(obra_id, return_callables=True)
    out: dict[str, object] = {}
    for name, handler in callables.items():
        try:
            res = await handler({})
            out[name] = _extract(res)
        except Exception as e:  # noqa: BLE001
            out[name] = {"_error": f"{type(e).__name__}: {e}"}
    print(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: python scripts/parity_chat.py <obra_id>", file=sys.stderr)
        sys.exit(2)
    asyncio.run(main(sys.argv[1]))
