"""Job de mapeamento · drena a fila obra_arquivos (status='raw') um por um.

Fluxo por arquivo (Fase 1 · Mapeamento):
    acquire_lease → download → amostragem → Mapper (Claude/OAuth) →
    persist_contexto → status='mapped'  (pausa pro gate humano na UI)

Uso (dentro de agent/, com a venv ativa):
    python -m agents.mapeamento.job            # roda em loop (worker)
    python -m agents.mapeamento.job --once      # drena a fila e sai (dev)
    python -m agents.mapeamento.job --once --poll 2

NÃO avança pra extração · isso depende da validação humana na tela /mapeamento.
"""

from __future__ import annotations

import argparse
import asyncio
import signal
import sys
import time

from config import (
    CLAUDE_AUTH_MODE,
    MAPPER_MODEL,
    MAX_FILE_MB,
    POLL_INTERVAL_SEC,
)
from parsers import build_doc_samples
from services.queue import acquire_lease, complete_job, download_file, persist_contexto, reap_stale_leases

from .mapper import MAPPING_SCHEMA_VERSION, map_document

_stop = False


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _install_signals() -> None:
    def handler(signum, _frame):  # noqa: ANN001
        global _stop
        _stop = True
        _log(f"Sinal {signal.Signals(signum).name} recebido · parando após o atual…")

    for s in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(s, handler)
        except (ValueError, OSError):
            pass  # ex: thread sem suporte a signal


async def process_one(row: dict) -> str:
    """Processa 1 arquivo. Retorna o status final aplicado."""
    arquivo_id = row["id"]
    nome = row.get("nome_original") or row.get("path") or arquivo_id
    obra_id = row["obra_id"]
    path = row["path"]
    _log(f"→ Mapeando «{nome}» (id={arquivo_id[:8]}…)")

    # 1. Download do bruto
    try:
        data = download_file(path)
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ download falhou: {e}")
        complete_job(arquivo_id, "mapping_error", f"download: {e}")
        return "mapping_error"

    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        _log(f"  ⚠ {size_mb:.1f}MB > limite {MAX_FILE_MB}MB · mandando pra needs_review")
        complete_job(arquivo_id, "needs_review", f"arquivo {size_mb:.1f}MB > {MAX_FILE_MB}MB")
        return "needs_review"

    # 2. Amostragem (cabeça/meio/cauda)
    sample = build_doc_samples(nome, data)
    _log(
        f"  · amostrado: fmt={sample.fmt} unidades={sample.total_units} "
        f"legível={'sim' if sample.readable else 'não'} ({size_mb:.2f}MB)"
    )

    # 3. Mapper (Claude via OAuth) → texto-mapa
    try:
        result = await map_document(nome, sample)
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ mapper falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "mapping_error", f"mapper: {e}")
        return "mapping_error"

    # 4. Persistir contexto + 5. marcar 'mapped'
    try:
        persisted = persist_contexto(
            arquivo_id=arquivo_id,
            obra_id=obra_id,
            arquivo_nome=nome,
            doc_type=result.doc_type,
            doc_type_confidence=result.confidence,
            schema_version=MAPPING_SCHEMA_VERSION,
            context_md=result.context_md,
            structure=result.structure,
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ persistência falhou: {e}")
        complete_job(arquivo_id, "mapping_error", f"persist: {e}")
        return "mapping_error"

    complete_job(arquivo_id, "mapped")
    _log(
        f"  ✓ mapeado «{result.doc_type}» conf={result.confidence:.2f} "
        f"v{persisted['version']} ({len(result.context_md)} chars)"
    )
    return "mapped"


async def run(once: bool, poll: float) -> None:
    mode = "drena e sai" if once else "loop contínuo"
    _log(f"Mapeador iniciado · auth={CLAUDE_AUTH_MODE} · modelo={MAPPER_MODEL} · {mode}")
    if CLAUDE_AUTH_MODE == "oauth_cli":
        _log("Auth: OAuth do Claude Code CLI (assinatura · custo zero de token)")

    reaped = reap_stale_leases()  # destrava docs presos em 'mapping' de execuções anteriores
    if reaped:
        _log(f"⚑ reaper: {reaped} doc(s) preso(s) movido(s) pra estado de erro.")
    processed = 0
    empty_polls = 0
    while not _stop:
        try:
            row = acquire_lease("mapping")
        except Exception as e:  # noqa: BLE001
            _log(f"✗ acquire_lease falhou: {e}")
            if once:
                break
            await asyncio.sleep(poll)
            continue

        if row is None:
            if once:
                _log(f"Fila vazia · concluído. {processed} arquivo(s) mapeado(s).")
                break
            empty_polls += 1
            if empty_polls == 1:
                _log("Fila vazia · aguardando novos arquivos… (Ctrl+C pra sair)")
            await asyncio.sleep(poll)
            continue

        empty_polls = 0
        await process_one(row)
        processed += 1

    _log(f"Encerrado. Total processado nesta execução: {processed}.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Mapeador de documentos da obra (Fase 1)")
    ap.add_argument("--once", action="store_true", help="drena a fila e sai (dev)")
    ap.add_argument("--poll", type=float, default=POLL_INTERVAL_SEC, help="intervalo de polling (s)")
    args = ap.parse_args()

    _install_signals()
    try:
        asyncio.run(run(once=args.once, poll=args.poll))
    except KeyboardInterrupt:
        _log("Interrompido.")
        sys.exit(0)


if __name__ == "__main__":
    main()
