"""Diagnóstico · isola a causa da falha 'error result: success' na extração.

Roda a MESMA extração do Cronograma, mas SEM output_format: o modelo devolve o
envelope como TEXTO (bloco ```json). Assim conseguimos medir:
  · tamanho da saída + output_tokens (causa A · saída grande demais)
  · se o JSON é válido e valida contra ENVELOPE_SCHEMA (causa B · schema)
  · subtype/is_error/num_turns do ResultMessage (sem o raise do output_format)

Uso: python -m scripts.debug_extract "<nome_original do doc>"
"""

from __future__ import annotations

import json
import sys
import tempfile

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, query

from agents.extracao.doc_tools import TOOL_NAMES, DocContext, build_doc_tools_server
from agents.extracao.envelope import ENVELOPE_SCHEMA
from agents.extracao.extractor import _ensure_sys
from config import EXTRACTOR_MODEL
from services.queue import download_file, load_latest_contexto
from services.supabase_client import supabase


def _p(msg):
    print(msg, flush=True)


async def main():
    nome = sys.argv[1] if len(sys.argv) > 1 else "Cronograma Fisico-financeiro - SBSO - 2025-10-07.pdf"
    row = supabase.table("obra_arquivos").select("*").eq("nome_original", nome).execute().data[0]
    ctx = load_latest_contexto(row["id"]) or {}
    data = download_file(row["path"])
    doc = DocContext(nome, data)
    _p(f"=== {nome} · {len(data)/1024:.0f} KB · ext={doc.ext} ===")

    server = build_doc_tools_server(doc)
    options = ClaudeAgentOptions(
        model=EXTRACTOR_MODEL,
        system_prompt={"type": "file", "path": _ensure_sys()},
        mcp_servers={"doctools": server},
        allowed_tools=[f"mcp__doctools__{n}" for n in TOOL_NAMES],
        # SEM output_format de propósito
        permission_mode="acceptEdits",
        max_turns=60,
        cwd=tempfile.gettempdir(),
    )
    prompt = f"""Extraia TODOS os dados do documento "{nome}".
Use o MAPA abaixo só pra saber ONDE olhar; os VALORES leia do doc pelas tools.

═══ TEXTO-MAPA ═══
{(ctx.get('context_md') or '')[:6000]}
══════════════════
Chame `dimensoes`, leia TUDO, e ao final responda APENAS com o envelope num único bloco:
```json
{{ ...envelope completo... }}
```
linhas = array de OBJETOS, números como número, NUNCA invente."""

    text_parts = []
    result = None
    n_assist = 0
    async for msg in query(prompt=prompt, options=options):
        if isinstance(msg, AssistantMessage):
            n_assist += 1
            for b in msg.content:
                if isinstance(b, TextBlock):
                    text_parts.append(b.text)
        elif isinstance(msg, ResultMessage):
            result = msg

    full = "\n".join(text_parts)
    _p(f"\n--- ResultMessage ---")
    if result:
        for attr in ("subtype", "is_error", "num_turns", "duration_ms", "total_cost_usd"):
            _p(f"  {attr} = {getattr(result, attr, None)}")
        u = getattr(result, "usage", None)
        _p(f"  usage = {u}")
    _p(f"\n--- Saída de texto ---")
    _p(f"  mensagens assistant: {n_assist}")
    _p(f"  chars de texto total: {len(full)}")

    # tenta isolar o bloco json
    js = full
    if "```json" in js:
        js = js.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in js:
        js = js.split("```", 1)[1].split("```", 1)[0]
    js = js.strip()
    _p(f"  chars do bloco json: {len(js)}")
    try:
        obj = json.loads(js)
        _p(f"  ✓ json.loads OK · top-level keys: {list(obj.keys())}")
        secoes = obj.get("secoes", [])
        _p(f"  seções: {len(secoes)}")
        for s in secoes:
            n = len(s.get("linhas", [])) if isinstance(s.get("linhas"), list) else "-"
            _p(f"    · {str(s.get('titulo'))[:40]} [{s.get('tipo')}] linhas={n}")
        try:
            import jsonschema

            jsonschema.validate(obj, ENVELOPE_SCHEMA)
            _p("  ✓ valida contra ENVELOPE_SCHEMA → causa B (schema) DESCARTADA")
        except ImportError:
            _p("  (jsonschema não instalado · pulei validação)")
        except Exception as e:
            _p(f"  ✗ NÃO valida contra ENVELOPE_SCHEMA → causa B PROVÁVEL: {e}")
    except Exception as e:
        _p(f"  ✗ json.loads FALHOU (truncado?) → causa A PROVÁVEL: {e}")
        _p(f"  …últimos 200 chars: {js[-200:]!r}")

    doc.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
