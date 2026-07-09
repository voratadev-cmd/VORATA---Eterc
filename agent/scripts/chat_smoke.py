"""Smoke-test do chat por OBRA — valida que as ferramentas do Adm Contratual IA acham o dado
normalizado da obra (genericidade · sem crash) e mostra o número-chave de cada uma. Use a CADA obra
nova depois da normalização: roda em segundos e dá pra bater o olho vs as telas.

    python -m scripts.chat_smoke                 # lista as obras
    python -m scripts.chat_smoke <obra_id>       # roda as 25 tools p/ a obra
    python -m scripts.chat_smoke --all           # roda em TODAS as obras

PENDENTE ≠ erro: 'pendente' = dimensão não normalizada nessa obra (honesto). 'ERRO' = bug a investigar.
"""

from __future__ import annotations

import asyncio
import json
import sys

import mcp.types as t

from agents.adm_contratual.tools import ADM_TOOL_NAMES, build_adm_tools_server
from services.supabase_client import supabase


def _obras() -> list[dict]:
    return supabase.table("obras").select("id, nome_interno").order("nome_interno").execute().data or []


def _headline(name: str, o: dict) -> str:
    """Pega 1 número-chave por tool p/ conferência rápida vs a tela."""
    for k in ("total_rs", "contratado_total_rs", "total_delta_rs", "desequilibrio_total_rs",
              "desequilibrio_total", "markup_total", "nMarcos", "n_servicos", "n_condutas",
              "n_eventos", "soma_valor_rs", "valor_orcado_total_rs", "rs_por_hh_real",
              "liberacao_pct", "consolidado_label"):
        if o.get(k) is not None:
            return f"{k}={o[k]}"
    if isinstance(o.get("total"), dict) and o["total"].get("perda_rs") is not None:
        return f"perda_rs={o['total']['perda_rs']}"
    if isinstance(o.get("categorias"), dict):
        return f"categorias={list(o['categorias'].keys())}"
    if isinstance(o.get("resumo"), dict):
        return f"plano total={o['resumo'].get('total')}"
    return "ok"


async def _run(obra_id: str, nome: str) -> None:
    srv = build_adm_tools_server(obra_id)
    h = srv["instance"].request_handlers[t.CallToolRequest]
    ok = pend = err = 0
    print(f"\n=== {nome}  ({obra_id[:8]}) ===")
    for n in ADM_TOOL_NAMES:
        if n == "buscar_secoes":
            continue  # precisa de arg (consulta)
        try:
            r = await h(t.CallToolRequest(method="tools/call",
                                          params=t.CallToolRequestParams(name=n, arguments={})))
            o = json.loads(r.root.content[0].text if hasattr(r, "root") else r.content[0].text)
            if o.get("disponivel") is False:
                pend += 1
                print(f"  · {n:32} pendente")
            else:
                ok += 1
                print(f"  ✓ {n:32} {_headline(n, o)}")
        except Exception as e:  # noqa: BLE001
            err += 1
            print(f"  ✗ {n:32} ERRO {type(e).__name__}: {str(e)[:60]}")
    print(f"  → {ok} com dado · {pend} pendente · {err} erro  (de {len(ADM_TOOL_NAMES) - 1} tools)")


async def _main() -> None:
    args = sys.argv[1:]
    if not args:
        print("Obras:")
        for o in _obras():
            print(f"  {o['id']}  {o['nome_interno']}")
        print("\nUse: python -m scripts.chat_smoke <obra_id>  |  --all")
        return
    alvos = _obras() if args[0] == "--all" else [{"id": args[0], "nome_interno": args[0]}]
    for o in alvos:
        await _run(o["id"], o["nome_interno"])


if __name__ == "__main__":
    asyncio.run(_main())
