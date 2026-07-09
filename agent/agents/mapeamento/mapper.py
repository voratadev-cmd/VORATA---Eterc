"""Mapper · transforma as amostras de um documento no texto-mapa, via Claude.

Usa o claude-agent-sdk (OAuth do Claude Code CLI no dev, custo zero). SEM
tools: o doc já chega amostrado no prompt, então é geração de texto pura —
mais estável e barato que tool-calling.

Saída: context_md (markdown) + doc_type (palpite) + confidence + structure.
A estrutura JSON é montada em Python a partir do sampler (dimensões reais),
não pedida ao modelo — menos chance de erro.
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
from dataclasses import dataclass

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    query,
)

from config import MAPPER_MODEL
from parsers import DocSample
from .persona import SYSTEM_PROMPT

MAPPING_SCHEMA_VERSION = "context@1.0.0"

# system prompt em arquivo (guia §14: string grande estoura ARG_MAX no Linux)
_PROMPT_PATH = os.path.join(tempfile.gettempdir(), "mapeamento_system_prompt.txt")


@dataclass
class MappingResult:
    context_md: str
    doc_type: str
    confidence: float
    structure: dict
    nome_sugerido: str = ""


def _ensure_prompt_file() -> str:
    content = SYSTEM_PROMPT.encode("utf-8")
    if os.path.exists(_PROMPT_PATH) and os.path.getsize(_PROMPT_PATH) == len(content):
        return _PROMPT_PATH
    # Escrita ATÔMICA (tmp + rename) — evita corrida entre processos lendo um
    # arquivo escrito pela metade.
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(_PROMPT_PATH) or None, suffix=".txt")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(content)
        os.replace(tmp, _PROMPT_PATH)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
    return _PROMPT_PATH


def _build_user_prompt(filename: str, sample: DocSample) -> str:
    notes = ""
    if sample.notes:
        notes = "\nAVISOS DO PARSER:\n" + "\n".join(f"- {n}" for n in sample.notes)
    dims = (
        f"Formato detectado: {sample.fmt} · "
        f"unidades totais (páginas/sheets/linhas): {sample.total_units} · "
        f"legível: {'sim' if sample.readable else 'NÃO (sem texto extraível)'} · "
        f"amostra truncada: {'sim' if sample.truncated else 'não'}"
    )
    return f"""Mapeie o documento "{filename}".

{dims}{notes}

═══════════ AMOSTRAS DO DOCUMENTO ═══════════
{sample.text}
═════════════════════════════════════════════

Produza o texto-mapa com as 6 seções (## O que é, ## Estrutura, ## Onde estão os dados, ## Padrões, ## Anomalias, ## Sugestão de extração) e termine com as linhas TIPO: e CONFIANCA: como instruído.
LEMBRE-SE: você NÃO extrai dados, só MAPEIA o que é e onde estão. Você viu uma amostra — raciocine sobre o todo a partir das dimensões."""


def _options() -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MAPPER_MODEL,
        system_prompt={"type": "file", "path": _ensure_prompt_file()},
        allowed_tools=[],  # geração de texto pura · doc já vem no prompt
        permission_mode="acceptEdits",
        cwd=tempfile.gettempdir(),
    )


async def _collect_text(user_prompt: str) -> str:
    # NÃO damos `break` no ResultMessage: sair do `async for` no meio deixa o
    # gerador interno do SDK a meio (RuntimeError "aclose(): already running").
    # Deixamos o gerador exaurir naturalmente — ResultMessage é o último msg.
    out: list[str] = []
    async for msg in query(prompt=user_prompt, options=_options()):
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    out.append(block.text)
        elif isinstance(msg, ResultMessage):
            pass  # fim lógico · loop encerra sozinho na próxima iteração
    return "".join(out).strip()


_TIPO_RE = re.compile(r"^\s*TIPO\s*:\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
_CONF_RE = re.compile(r"^\s*CONFIAN[ÇC]A\s*:\s*([01](?:[.,]\d+)?)\s*$", re.IGNORECASE | re.MULTILINE)
_NOME_RE = re.compile(r"^\s*NOME[_ ]SUGERIDO\s*:\s*(.*?)\s*$", re.IGNORECASE | re.MULTILINE)

# Caracteres proibidos em nome de arquivo (Windows/macOS/Linux) + controles.
_BAD_NAME_CHARS = re.compile(r'[/\\:*?"<>|\x00-\x1f]')
_SUGGESTED_NAME_MAX = 80  # base, sem extensão


def _sanitize_suggested_name(raw: str, original_filename: str) -> str:
    """Nome sugerido SEGURO e fiel: tira caminho/extensão arbitrária do modelo,
    higieniza caracteres proibidos e RE-ANEXA a extensão ORIGINAL (nunca muda o
    tipo do arquivo). Vazio/garbage → "" (sem sugestão)."""
    if not raw:
        return ""
    base = raw.strip().strip("\"'").strip()
    # só o basename (modelo pode ter posto "pasta/arquivo")
    base = base.replace("\\", "/").split("/")[-1]
    # remove QUALQUER extensão que o modelo tenha colocado (re-anexamos a original)
    base = re.sub(r"\.[A-Za-z0-9]{1,5}$", "", base).strip()
    base = _BAD_NAME_CHARS.sub("", base)
    base = re.sub(r"\s+", " ", base).strip(" .-")
    if len(base) < 3:  # curto demais p/ ser útil
        return ""
    base = base[:_SUGGESTED_NAME_MAX].strip(" .-")
    # extensão original (com o ponto), minúscula; sem extensão → sem sufixo
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower() if ext and len(ext) <= 6 else ""
    return f"{base}{ext}"


def _parse_tail(text: str) -> tuple[str, str, float, str]:
    """Extrai TIPO/CONFIANCA/NOME_SUGERIDO do rodapé e devolve
    (context_md_limpo, tipo, conf, nome_sugerido_bruto)."""
    tipo_m = _TIPO_RE.search(text)
    conf_m = _CONF_RE.search(text)
    nome_m = _NOME_RE.search(text)

    doc_type = (tipo_m.group(1).strip() if tipo_m else "Documento (tipo a confirmar)")
    doc_type = doc_type[:120]

    # Default CONSERVADOR quando o modelo não emitiu CONFIANCA (sinaliza prompt não
    # seguido) — confiança é auto-relato não-calibrado, não pode default alto.
    confidence = 0.85 if conf_m else 0.5
    if conf_m:
        try:
            confidence = float(conf_m.group(1).replace(",", "."))
        except ValueError:
            pass
    confidence = max(0.0, min(1.0, confidence))

    nome_raw = nome_m.group(1).strip() if nome_m else ""

    # Remove o bloco final (--- + TIPO/CONFIANCA/NOME_SUGERIDO) do context_md.
    body = text
    cut = min(
        (m.start() for m in [tipo_m, conf_m, nome_m] if m),
        default=len(text),
    )
    if cut < len(text):
        body = text[:cut]
        # tira um "---" sozinho que tenha sobrado no fim
        body = re.sub(r"\n-{3,}\s*$", "", body.rstrip())
    return body.strip(), doc_type, confidence, nome_raw


async def map_document(filename: str, sample: DocSample) -> MappingResult:
    """Roda o Mapper num doc amostrado e devolve o MappingResult."""
    raw = await _collect_text(_build_user_prompt(filename, sample))
    if not raw:
        raise RuntimeError("Mapper retornou vazio (sem texto do modelo)")

    context_md, doc_type, confidence, nome_raw = _parse_tail(raw)
    nome_sugerido = _sanitize_suggested_name(nome_raw, filename)

    # Sinais DETERMINÍSTICOS rebaixam o teto, independente do que o modelo disse.
    _sheets = sample.structure.get("sheets") or []
    _meta_captured = any(s.get("isMeta") for s in _sheets)  # workbook-motor com Guia/MAPA na amostra
    if not sample.readable:
        confidence = min(confidence, 0.4)
    if sample.truncated:  # amostra cortada → o modelo não viu o todo
        # Workbook-motor com abas-meta capturadas: a qualidade do mapa vem do Guia + inventário
        # completo, não de ver cada célula de conteúdo → truncar o conteúdo não derruba a confiança
        # tanto quanto num doc avulso cortado no meio.
        confidence = min(confidence, 0.8 if _meta_captured else 0.6)
    if not _meta_captured and any(s.get("truncatedCols") for s in _sheets):
        confidence = min(confidence, 0.6)  # sheet larga truncada na amostra (doc avulso)

    if len(context_md) < 100:
        # fallback defensivo: nunca persistir um mapa vazio.
        context_md = (
            context_md
            + "\n\n(Observação do sistema: mapeamento curto — documento pode estar "
            "ilegível ou com pouca informação amostrada.)"
        )

    structure = dict(sample.structure)
    structure["docTypeGuess"] = doc_type
    if nome_sugerido:
        structure["nomeSugerido"] = nome_sugerido

    return MappingResult(
        context_md=context_md,
        doc_type=doc_type,
        confidence=confidence,
        structure=structure,
        nome_sugerido=nome_sugerido,
    )
