"""Verifier · QA do envelope contra o documento (relê o doc, não corrige).

Saída PEQUENA (lista de findings) → cabe num único `output_format` sem o
problema de tamanho do extrator. Habilitado por config (EXTRACTOR_VERIFY).
Recebe um DIGEST do envelope (não o payload inteiro, p/ não inflar o prompt) e
relê o doc pelas tools fazendo spot-check de 3-5 valores.
"""

from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass, field
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

from config import VERIFIER_MODEL

from .doc_tools import TOOL_NAMES as DOC_TOOL_NAMES
from .doc_tools import DocContext, build_doc_tools_server
from .persona import VERIFIER_SYSTEM

VERIFIER_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string"},
                    "severity": {"type": "string", "enum": ["error", "warn", "info"]},
                    "message": {"type": "string"},
                },
                "required": ["severity", "message"],
                "additionalProperties": True,
            },
        },
        "needsReview": {"type": "boolean"},
        "overallConfidence": {"type": "number"},
    },
    "required": ["findings", "needsReview"],
    "additionalProperties": True,
}


@dataclass
class VerifyResult:
    findings: list = field(default_factory=list)
    needs_review: bool = False
    confidence: float | None = None
    concluded: bool = False  # o verifier REALMENTE rodou e devolveu structured?
    usage: Any = None
    cost: float | None = None


def _sample_rows(linhas: list, n: int) -> tuple[list[int], list]:
    """Amostra ESTRATIFICADA (começo + meio + fim) — não só o topo, senão o
    spot-check fica cego ao corpo/cauda da tabela. Retorna (posições 1-based, linhas)."""
    total = len(linhas)
    if total <= n:
        return list(range(1, total + 1)), list(linhas)
    k = max(1, n // 3)
    mid = total // 2 - k // 2
    raw = list(range(0, k)) + list(range(mid, mid + k)) + list(range(total - k, total))
    idxs = sorted({i for i in raw if 0 <= i < total})
    return [i + 1 for i in idxs], [linhas[i] for i in idxs]


def _digest(payload: dict, max_sample: int = 9) -> str:
    """Resumo do envelope p/ o verifier conferir (amostra estratificada por seção)."""
    out: dict = {
        "tipo_documento": payload.get("tipo_documento"),
        "identificacao": payload.get("identificacao"),
        "totais_declarados": payload.get("totais_declarados"),
        "secoes": [],
    }
    for s in payload.get("secoes") or []:
        if not isinstance(s, dict):
            continue
        d = {"titulo": s.get("titulo"), "tipo": s.get("tipo"), "fonte": s.get("fonte")}
        if s.get("tipo") == "tabela":
            linhas = s.get("linhas") or []
            pos, sample = _sample_rows(linhas, max_sample)
            d["colunas"] = s.get("colunas")
            d["n_linhas"] = len(linhas)
            d["amostra_posicoes_1based"] = pos  # começo/meio/fim — confira ESTAS no doc
            d["amostra_linhas"] = sample
        elif s.get("tipo") == "chave_valor":
            d["dados"] = s.get("dados")
        elif s.get("tipo") == "texto":
            c = s.get("conteudo") or ""
            d["conteudo"] = c[:600] + ("…" if len(c) > 600 else "")
        out["secoes"].append(d)
    txt = json.dumps(out, ensure_ascii=False, indent=1)
    return txt[:14000] + ("…(digest truncado)" if len(txt) > 14000 else "")


async def verify(doc: DocContext, doc_type: str, payload: dict) -> VerifyResult:
    server = build_doc_tools_server(doc)
    options = ClaudeAgentOptions(
        model=VERIFIER_MODEL,
        system_prompt=VERIFIER_SYSTEM,
        mcp_servers={"doctools": server},
        allowed_tools=[f"mcp__doctools__{n}" for n in DOC_TOOL_NAMES],
        output_format={"type": "json_schema", "schema": VERIFIER_SCHEMA},
        permission_mode="acceptEdits",
        max_turns=20,
        cwd=tempfile.gettempdir(),
    )
    prompt = f"""Verifique a extração do documento "{doc.filename}" (tipo: {doc_type}).
Abaixo o DIGEST do envelope extraído. Cada tabela traz `amostra_posicoes_1based` (linhas do COMEÇO, MEIO e FIM)
e `n_linhas` (total). RELEIA o documento pelas tools (use ler_pdf_pagina_imagem p/ tabela complexa) e faça
spot-check de 4-6 valores ESCOLHENDO de regiões diferentes (não só do topo — confira pelo menos uma do meio e
uma do fim, usando as posições da amostra). Confira somas, datas e faixas.
Aponte divergências como findings (NÃO corrija). Se houver `error`, marque needsReview=true.

═══ DIGEST DO ENVELOPE ═══
{_digest(payload)}
═════════════════════════"""

    res = VerifyResult()
    structured = None
    async for msg in query(prompt=prompt, options=options):
        if isinstance(msg, ResultMessage):
            structured = getattr(msg, "structured_output", None)
            res.usage = getattr(msg, "usage", None)
            res.cost = getattr(msg, "total_cost_usd", None)
    if isinstance(structured, dict):
        res.concluded = True
        res.findings = structured.get("findings") or []
        res.confidence = structured.get("overallConfidence")
        has_error = any(isinstance(f, dict) and f.get("severity") == "error" for f in res.findings)
        warns = sum(1 for f in res.findings if isinstance(f, dict) and f.get("severity") == "warn")
        res.needs_review = bool(structured.get("needsReview")) or has_error or warns >= 3
    else:
        # verifier não devolveu structured → não derruba a extração; sinaliza revisão leve
        res.findings = [{"severity": "warn", "message": "verifier não retornou resultado estruturado", "source": "verifier"}]
        res.needs_review = False
    return res
