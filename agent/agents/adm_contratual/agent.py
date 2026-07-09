"""Wrapper do claude-agent-sdk · o coração do agente.

Auth: o SDK escolhe sozinho entre API key (se ANTHROPIC_API_KEY no ambiente,
= prod) e OAuth do Claude Code CLI (se ausente, = dev local). Não setamos nada
aqui — só não forçamos a key.

Gotcha (guia §14): system prompt grande como string estoura ARG_MAX no Linux.
Por isso gravamos em arquivo e usamos SystemPromptFile.
"""

from __future__ import annotations

import hashlib
import os
import sys
import tempfile
from typing import AsyncGenerator

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
    query,
)

from agents.adm_contratual.tools import ADM_TOOL_NAMES, build_adm_tools_server
from config import AGENT_MODEL

_PROMPT_DIR = tempfile.gettempdir()


def _write_system_prompt(resolved: str) -> str:
    # Arquivo POR CONTEÚDO (hash) — com várias obras/chats concorrentes, um caminho fixo seria
    # sobrescrito por outra requisição entre o write e a leitura do SDK (prompt trocado). O hash
    # dá um arquivo por prompt distinto e reaproveita se já existir (idempotente).
    content = resolved.encode("utf-8")
    h = hashlib.sha256(content).hexdigest()[:16]
    path = os.path.join(_PROMPT_DIR, f"adm_system_prompt_{h}.txt")
    if not (os.path.exists(path) and os.path.getsize(path) == len(content)):
        with open(path, "wb") as f:
            f.write(content)
    return path


def _build_options(system_prompt_text: str, obra_id: str | None = None) -> ClaudeAgentOptions:
    # Com obra em foco, liga o TOOLBOX da obra (tool-calling sobre o normalizado) — mesmo padrão do
    # extrator (extractor.py:134-142). Sem obra (pergunta geral / sínteses) = texto puro, sem tools.
    mcp_servers: dict = {}
    allowed_tools: list[str] = []
    if obra_id:
        mcp_servers = {"admtools": build_adm_tools_server(obra_id)}
        allowed_tools = [f"mcp__admtools__{n}" for n in ADM_TOOL_NAMES]
    return ClaudeAgentOptions(
        model=AGENT_MODEL,
        system_prompt={"type": "file", "path": _write_system_prompt(system_prompt_text)},
        mcp_servers=mcp_servers,
        allowed_tools=allowed_tools,
        permission_mode="acceptEdits",
        max_turns=16,  # tool-calling em cadeia: turnos suficientes p/ overview→resumo→detalhe→texto
        cwd=tempfile.gettempdir(),
    )


def _tool_result_text(block) -> str | None:  # noqa: ANN001
    """Texto (JSON) que a tool devolveu, de um ToolResultBlock (content pode ser str ou lista de blocos)."""
    c = getattr(block, "content", None)
    if isinstance(c, str):
        return c or None
    if isinstance(c, list):
        parts = [
            (item.get("text", "") if isinstance(item, dict) and item.get("type") == "text" else item)
            for item in c
            if isinstance(item, (str, dict))
        ]
        joined = "".join(p for p in parts if isinstance(p, str))
        return joined or None
    return None


async def stream_response(
    user_prompt: str,
    system_prompt_text: str,
    obra_id: str | None = None,
) -> AsyncGenerator[dict, None]:
    """Streama eventos {'type': 'thinking'|'text'|'tool_use'|'tool_result'|'done'|'error', 'content': str}.
    `obra_id` liga o toolbox da obra (tool-calling); None = texto puro (sínteses/pergunta geral).
    O 'tool_result' carrega o JSON que a tool devolveu — insumo dos insights e do gate de ancoragem."""
    options = _build_options(system_prompt_text, obra_id)
    try:
        async for msg in query(prompt=user_prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, ThinkingBlock):
                        yield {"type": "thinking", "content": block.thinking[:300]}
                    elif isinstance(block, TextBlock):
                        yield {"type": "text", "content": block.text}
                    elif isinstance(block, ToolUseBlock):
                        yield {"type": "tool_use", "content": f"Usando: {block.name}"}
            elif isinstance(msg, UserMessage):
                # Resultado das tools volta como ToolResultBlock numa UserMessage — captura o JSON cru.
                for block in getattr(msg, "content", None) or []:
                    if isinstance(block, ToolResultBlock):
                        txt = _tool_result_text(block)
                        if txt:
                            yield {"type": "tool_result", "content": txt}
            elif isinstance(msg, ResultMessage):
                # max_turns/erro NÃO pode virar 'done' truncado em silêncio (anti-resposta-cortada).
                sub = getattr(msg, "subtype", "") or ""
                if getattr(msg, "is_error", False) or "error" in sub:
                    yield {"type": "error", "content": f"agente interrompido ({sub or 'erro'})"}
                yield {"type": "done", "content": ""}
    except Exception as e:  # noqa: BLE001
        print(f"[AGENT_ERROR] {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        yield {"type": "error", "content": str(e)[:500]}


async def collect_text(user_prompt: str, system_prompt_text: str) -> str:
    """Versão não-streaming · junta todo o texto. Útil pra insights em lote."""
    out: list[str] = []
    async for ev in stream_response(user_prompt, system_prompt_text):
        if ev["type"] == "text":
            out.append(ev["content"])
        elif ev["type"] == "error":
            raise RuntimeError(ev["content"])
    return "".join(out).strip()
