"""Fase 2a · rename SEGURO das matrizes do backstop (só p/ AUDITORIA/legibilidade).

O backstop (Fase 1) auto-ingere matrizes anônimas com colunas genéricas (rotulo, valor_1..valor_N).
Aqui o modelo propõe NOMES DE COLUNA reais (disciplina, meses) p/ deixar o dado legível no banco/chat.

FRONTEIRAS DURAS (o que torna isto seguro — escolha do dono "captura-only, fora do roteamento typed"):
  · O modelo SÓ nomeia colunas. NUNCA toca/inventa/transcreve valor (o número vem da ingestão em código).
  · O TÍTULO é mantido INTACTO ('… — Bloco não-rotulado L… (auto-ingerido)'). Os resolvers typed gateiam
    por TOKEN DE TÍTULO e não casam essa sentinela → a seção continua captura-only (coberta=False), sem
    risco de MIS-ROUTING (ex.: gravar um REAL como PREVISTO). Garantido por test_rename_backstop.
  · Falha/ambiguidade do modelo (count != nº de colunas, JSON inválido, nome col_*) → mantém os nomes
    genéricos. Degrada p/ 'capturado-genérico', NUNCA perde nem corrompe.
"""
from __future__ import annotations

import json
import re
import tempfile

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, query

from config import EXTRACTOR_MODEL


def _options() -> ClaudeAgentOptions:
    # geração de texto pura (sem tools); instruções no próprio user prompt.
    return ClaudeAgentOptions(
        model=EXTRACTOR_MODEL, allowed_tools=[], permission_mode="acceptEdits",
        cwd=tempfile.gettempdir(), max_turns=2,
    )


async def _collect(prompt: str) -> str:
    out: list[str] = []
    async for msg in query(prompt=prompt, options=_options()):
        if isinstance(msg, AssistantMessage):
            for b in msg.content:
                if isinstance(b, TextBlock):
                    out.append(b.text)
        elif isinstance(msg, ResultMessage):
            pass  # deixa o gerador exaurir (não dar break — gotcha do SDK)
    return "".join(out).strip()


def _build_prompt(aba: str, de: int, ate: int, cols: list, region_rows: list, context_rows: list) -> str:
    ctx = "\n".join(
        " | ".join(str(c) for c in (r or []) if c is not None and str(c).strip())
        for r in context_rows[-10:]
    ) or "(sem cabeçalho acima)"
    amostra = "\n".join(str(r) for r in region_rows[:6])
    return (
        f"Você nomeia COLUNAS de uma matriz tabular lida EM CÓDIGO de uma planilha. NÃO altere, invente "
        f"ou transcreva valores — só dê NOMES curtos às colunas, na ORDEM.\n\n"
        f"Aba: '{aba}' · linhas {de}-{ate} · {len(cols)} colunas (genéricas: {cols}).\n\n"
        f"CONTEXTO (linhas acima da matriz, pode conter cabeçalho/rótulos):\n{ctx}\n\n"
        f"AMOSTRA (chave = coluna genérica → valor):\n{amostra}\n\n"
        f"Proponha EXATAMENTE {len(cols)} nomes de coluna reais e curtos, na ordem. A 1ª coluna costuma "
        f"ser o rótulo de linha (disciplina/frente/item). Colunas numéricas costumam ser meses/períodos "
        f"sequenciais (use o contexto p/ inferir; se incerto, 'mes_01'..). Responda APENAS um array JSON "
        f"de {len(cols)} strings, nada além."
    )


def _parse_cols(text: str, ncols: int) -> list[str] | None:
    """Extrai o array JSON; valida count == ncols, sem nome vazio nem col_* (que capturar_secoes
    descartaria). Dedupe defensivo (sufixo _k)."""
    m = re.search(r"\[.*\]", text or "", re.DOTALL)
    if not m:
        return None
    try:
        arr = json.loads(m.group(0))
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(arr, list) or len(arr) != ncols:
        return None
    nomes = [str(x).strip()[:40] for x in arr]
    if any((not n) or n.lower().startswith("col_") for n in nomes):
        return None
    seen: set[str] = set()
    out: list[str] = []
    for n in nomes:
        base, k = n, 2
        while n in seen:
            n = f"{base}_{k}"
            k += 1
        seen.add(n)
        out.append(n)
    return out


async def _propor_colunas(aba, de, ate, cols, region_rows, context_rows) -> list[str] | None:  # noqa: ANN001
    try:
        txt = await _collect(_build_prompt(aba, de, ate, cols, region_rows, context_rows))
    except Exception:  # noqa: BLE001 — qualquer falha de API/transporte → mantém genérico
        return None
    return _parse_cols(txt, len(cols))


def _rekey(sec: dict, new_cols: list[str]) -> bool:
    """Re-chaveia as linhas pela posição (antiga→nova) e troca colunas. VALORES intactos (só a chave
    muda). Falha se o count diverge."""
    old = sec.get("colunas") or []
    if not old or len(old) != len(new_cols):
        return False
    mapa = dict(zip(old, new_cols))
    sec["linhas"] = [{mapa.get(k, k): v for k, v in r.items()} for r in (sec.get("linhas") or [])]
    sec["colunas"] = list(new_cols)
    return True


async def renomear_backstop_colunas(builder, doc, ingeridos) -> int:  # noqa: ANN001
    """Para cada região que o backstop ingeriu, pede ao modelo NOMES DE COLUNA e os aplica (título
    intacto). Retorna quantas seções foram renomeadas. NUNCA falha o pipeline (best-effort)."""
    n = 0
    for aba, de, ate, _ in ingeridos:
        sid = f"backstop::{aba}::{de}-{ate}"
        sec = builder._secoes.get(sid)
        if not sec or not sec.get("linhas"):
            continue
        try:
            rows = doc.sheet_rows(aba)
        except Exception:  # noqa: BLE001
            continue
        ctx = [rows[i - 1] for i in range(max(1, de - 10), de) if 0 < i <= len(rows)]
        new_cols = await _propor_colunas(aba, de, ate, sec.get("colunas") or [], sec["linhas"], ctx)
        if new_cols and _rekey(sec, new_cols):
            n += 1
    return n
