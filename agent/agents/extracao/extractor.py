"""Extractor · o modelo lê o doc pelas tools e MONTA o envelope incrementalmente
pelas tools de escrita (definir_documento/abrir_secao/anexar_linhas/…).

Não usamos mais `output_format` (devolver o envelope inteiro num único
structured_output estoura o teto de tokens de SAÍDA em docs tabulares — ver
auditoria: Cronograma exigiu 54k+ tokens e truncou). Agora a saída é fatiada em
chamadas de tool bounded; o envelope acumula no `EnvelopeBuilder` (do runner).
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

from config import EXTRACTOR_MAX_TURNS, EXTRACTOR_MODEL

from .doc_tools import TOOL_NAMES as DOC_TOOL_NAMES
from .doc_tools import DocContext, build_doc_tools_server
from .envelope import EnvelopeBuilder
from .persona import EXTRACTOR_SYSTEM
from .submit_tools import SUBMIT_TOOL_NAMES, build_submit_tools_server

_SYS_PATH = os.path.join(tempfile.gettempdir(), "extracao_extractor_system.txt")

_ALLOWED_TOOLS = [f"mcp__doctools__{n}" for n in DOC_TOOL_NAMES] + [
    f"mcp__envelope__{n}" for n in SUBMIT_TOOL_NAMES
]


@dataclass
class PassResult:
    usage: Any
    cost: float | None
    num_turns: int | None = None


def _ensure_sys() -> str:
    content = EXTRACTOR_SYSTEM.encode("utf-8")
    if os.path.exists(_SYS_PATH) and os.path.getsize(_SYS_PATH) == len(content):
        return _SYS_PATH
    with open(_SYS_PATH, "wb") as f:
        f.write(content)
    return _SYS_PATH


def _scope_instr(scope: dict | None) -> str:
    """Texto que diz ao modelo O QUE extrair nesta chamada (doc inteiro ou fatia)."""
    if not scope or scope.get("kind") == "whole":
        return "ESCOPO desta chamada: o documento INTEIRO. Leia tudo e monte o envelope completo."
    kind = scope.get("kind")
    if kind == "sheet":
        return (
            f"ESCOPO desta chamada: SOMENTE a sheet '{scope.get('sheet')}'. As outras sheets são "
            f"tratadas em chamadas separadas — NÃO as leia. Use secao_id baseado na sheet "
            f"(ex.: '{scope.get('sheet')}'). O cabeçalho (definir_documento) pode já ter sido definido "
            "antes; pode complementar identificacao/totais_declarados que você vir aqui."
        )
    if kind == "sheets":
        lista = ", ".join(f"'{s}'" for s in (scope.get("sheets") or []))
        return (
            f"ESCOPO desta chamada: SOMENTE as sheets {lista}. As demais são tratadas em chamadas "
            "separadas — NÃO as leia nem abra seção delas. Extraia TODAS as regiões com dado de "
            "CADA sheet do escopo (tabelas via ingerir_planilha; cards/KPIs via chave_valor com "
            "fonte 'aba ... Lx-Ly'). Use secao_id PREFIXADO pela sheet (ex.: 'c3_curva') — nunca "
            "reutilize um secao_id de outra sheet. O cabeçalho (definir_documento) pode já ter "
            "sido definido antes; complemente identificacao/totais_declarados que você vir aqui."
        )
    if kind == "sheet_rows":
        return (
            f"ESCOPO desta chamada: SOMENTE as linhas {scope.get('de')}–{scope.get('ate')} da sheet "
            f"'{scope.get('sheet')}'. Abra/reabra a seção dessa sheet (mesmo secao_id das outras fatias "
            "dela) e ANEXE só as linhas desta janela. Não duplique linhas de outras janelas."
        )
    if kind == "pages":
        return (
            f"ESCOPO desta chamada: SOMENTE as páginas {scope.get('de')}–{scope.get('ate')}. "
            "Anexe o que estiver nessas páginas; as outras vêm em chamadas separadas."
        )
    return "ESCOPO desta chamada: o documento INTEIRO."


_CONTEXT_MD_LIMIT = 8000  # teto do texto-mapa injetado por fatia (bound de entrada)


def _user_prompt(doc: DocContext, doc_type, context_md, structure, scope, pass_no, is_last) -> str:  # noqa: ANN001
    context_md = context_md or ""
    if len(context_md) > _CONTEXT_MD_LIMIT:
        context_md = context_md[:_CONTEXT_MD_LIMIT] + "\n…(texto-mapa truncado · use as tools p/ ler o doc real)"
    struct = json.dumps(structure or {}, ensure_ascii=False)
    if len(struct) > 1500:
        struct = struct[:1500] + "…"
    fim = (
        "Quando tiver lido e anexado TUDO do escopo, chame finalizar_extracao."
        if is_last
        else "NÃO chame finalizar_extracao nesta chamada (há mais fatias depois) — só anexe os dados do escopo."
    )
    from .doc_schemas import expected_structure_hint

    dominio = expected_structure_hint(doc_type, doc.filename)
    return f"""Extraia os dados do documento "{doc.filename}" (tipo detectado: {doc_type}).{dominio}

Um agente anterior MAPEOU este documento. Use o MAPA abaixo para saber ONDE estão os dados e como ler — mas LEIA o documento de verdade pelas tools (os VALORES você lê do doc, não do mapa).

═══════════ TEXTO-MAPA ═══════════
{context_md}
══════════════════════════════════
Estrutura detectada (resumo): {struct}

{_scope_instr(scope)}

Fluxo: `dimensoes` primeiro → leia o conteúdo (tabelas grandes em janelas com ler_planilha; tabela complexa de PDF com ler_pdf_pagina_imagem) → MONTE o envelope pelas tools de escrita: definir_documento, abrir_secao, anexar_linhas (lotes), definir_dados/definir_conteudo, anexar_alerta. {fim}
LEMBRE: números como NÚMERO (1.234,56→1234.56), `linhas` = OBJETOS {{coluna: valor}}, capture 100%, NUNCA invente (ausente → anexar_alerta)."""


async def extract_into(
    builder: EnvelopeBuilder,
    doc: DocContext,
    doc_type: str,
    context_md: str,
    structure: dict | None,
    *,
    scope: dict | None = None,
    pass_no: int = 1,
    is_last: bool = True,
    scope_order: int = 0,
) -> PassResult:
    """Uma chamada query(): o modelo lê o escopo e ANEXA ao `builder` pelas tools.
    `scope_order` (índice da fatia no plano) é gravado em cada seção aberta → o build() ordena por
    ele, deixando o envelope DETERMINÍSTICO mesmo quando as fatias rodam em paralelo (asyncio.gather)."""
    doc_server = build_doc_tools_server(doc)
    submit_server = build_submit_tools_server(builder, doc, scope_order=scope_order)
    options = ClaudeAgentOptions(
        model=EXTRACTOR_MODEL,
        system_prompt={"type": "file", "path": _ensure_sys()},
        mcp_servers={"doctools": doc_server, "envelope": submit_server},
        allowed_tools=_ALLOWED_TOOLS,
        permission_mode="acceptEdits",
        max_turns=EXTRACTOR_MAX_TURNS,
        cwd=tempfile.gettempdir(),
    )

    usage = cost = num_turns = None
    # NÃO dar break no ResultMessage (gotcha do mapper: gerador a meio quebra).
    async for msg in query(
        prompt=_user_prompt(doc, doc_type, context_md, structure, scope, pass_no, is_last),
        options=options,
    ):
        if isinstance(msg, ResultMessage):
            usage = getattr(msg, "usage", None)
            cost = getattr(msg, "total_cost_usd", None)
            num_turns = getattr(msg, "num_turns", None)
    return PassResult(usage=usage, cost=cost, num_turns=num_turns)
