"""Job de extração (Fase 2) · drena obra_arquivos em status='ready_to_extract'.

Fluxo por arquivo:
    acquire_lease('extracting') → load_latest_contexto (mapa) → download →
    run_extraction → persist_extracao → complete_job (extracted | needs_review).

Uso (dentro de agent/, venv ativa):
    python -m agents.extracao.job --once          # drena e sai (dev)
    python -m agents.extracao.job                  # loop contínuo (worker)
"""

from __future__ import annotations

import argparse
import asyncio
import signal
import sys
import time

from config import CLAUDE_AUTH_MODE, EXTRACTOR_MODEL, LEASE_TIMEOUT_MIN, MAX_FILE_MB, POLL_INTERVAL_SEC
from services.queue import (
    acquire_lease,
    complete_job,
    download_file,
    end_run,
    load_latest_contexto,
    persist_extracao,
    reap_stale_leases,
    renew_lease,
    start_run,
)

from .doc_tools import DocContext
from .envelope import EXTRACTION_SCHEMA_VERSION
from .runner import run_extraction

_stop = False


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _install_signals() -> None:
    def handler(signum, _frame):  # noqa: ANN001
        global _stop
        _stop = True
        _log(f"Sinal {signal.Signals(signum).name} · parando após o atual…")

    for s in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(s, handler)
        except (ValueError, OSError):
            pass


async def _with_heartbeat(arquivo_id: str, coro):
    """Roda `coro` (extração longa) renovando o lease periodicamente, pra ele não
    vencer no meio (o que abriria janela de dupla-pega sob concorrência)."""
    lease_sec = LEASE_TIMEOUT_MIN * 60
    interval = max(30, min(int(lease_sec / 3), lease_sec - 30))  # sempre < lease

    async def _beat() -> None:
        while True:
            await asyncio.sleep(interval)
            renew_lease(arquivo_id)

    beat = asyncio.create_task(_beat())
    try:
        return await coro
    finally:
        beat.cancel()
        try:
            await beat
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


async def process_one(row: dict) -> str:
    arquivo_id = row["id"]
    nome = row.get("nome_original") or row.get("path") or arquivo_id
    path = row["path"]
    _log(f"→ Extraindo «{nome}» (id={arquivo_id[:8]}…)")

    ctx_row = load_latest_contexto(arquivo_id)
    if not ctx_row:
        _log("  ✗ sem texto-mapa · mapeie antes de extrair")
        complete_job(arquivo_id, "extraction_error", "sem contexto (mapa) — re-mapear")
        return "extraction_error"

    try:
        data = download_file(path)
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ download falhou: {e}")
        complete_job(arquivo_id, "extraction_error", f"download: {e}")
        return "extraction_error"

    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        _log(f"  ⚠ {size_mb:.1f}MB > {MAX_FILE_MB}MB · needs_review")
        complete_job(arquivo_id, "needs_review", f"arquivo {size_mb:.1f}MB > {MAX_FILE_MB}MB")
        return "needs_review"

    doc = DocContext(nome, data)
    doc_type = ctx_row.get("doc_type") or "Documento"
    t_start = time.monotonic()
    try:
        result = await _with_heartbeat(
            arquivo_id,
            run_extraction(
                doc, doc_type, ctx_row.get("context_md") or "", ctx_row.get("structure") or {}
            ),
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ extrator falhou: {type(e).__name__}: {e}")
        # Observabilidade da FALHA (sem isso o run caro que errou fica invisível) · com latência.
        rid = start_run(arquivo_id, "extractor", EXTRACTOR_MODEL, 1)
        end_run(rid, status="error", error=f"{type(e).__name__}: {e}", latency_ms=int((time.monotonic() - t_start) * 1000))
        complete_job(arquivo_id, "extraction_error", f"extractor: {e}")
        return "extraction_error"
    finally:
        doc.close()

    # Observabilidade (best-effort) · 1 row por chamada de modelo (extractor/verifier)
    for name, pass_no, usage, cost, latency_ms in result.runs:
        rid = start_run(arquivo_id, name, EXTRACTOR_MODEL, pass_no)
        end_run(rid, usage=usage, cost=cost, latency_ms=latency_ms)

    try:
        persisted = persist_extracao(
            arquivo_id=arquivo_id,
            doc_type=doc_type,
            doc_type_confidence=ctx_row.get("doc_type_confidence"),
            schema_version=EXTRACTION_SCHEMA_VERSION,
            payload=result.payload,
            field_confidence=result.field_confidence,
            discrepancies=result.discrepancies,
            verifier_findings=result.verifier_findings,
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ persistência falhou: {e}")
        complete_job(arquivo_id, "extraction_error", f"persist: {e}")
        return "extraction_error"

    status = "needs_review" if result.needs_review else "extracted"
    reason = " · ".join(result.review_reasons)[:2000] if result.needs_review else None
    complete_job(arquivo_id, status, reason)
    secoes = result.payload.get("secoes") if isinstance(result.payload, dict) else None
    n_linhas = sum(
        len(s.get("linhas", [])) for s in (secoes or []) if isinstance(s, dict) and s.get("tipo") == "tabela"
    )
    _log(
        f"  ✓ {status} «{(result.payload or {}).get('tipo_documento', '?')}» · "
        f"{len(secoes) if isinstance(secoes, list) else 0} seções · {n_linhas} linhas · v{persisted['version']}"
        f"{' · CRÍTICO' if result.critical else ''}"
        + (f" · motivo: {reason}" if reason else "")
    )
    return status


async def run(once: bool, poll: float) -> None:
    mode = "drena e sai" if once else "loop contínuo"
    _log(f"Extrator iniciado · auth={CLAUDE_AUTH_MODE} · modelo={EXTRACTOR_MODEL} · {mode}")
    reaped = reap_stale_leases()  # destrava docs presos de execuções anteriores
    if reaped:
        _log(f"⚑ reaper: {reaped} doc(s) preso(s) movido(s) pra estado de erro.")
    processed = 0
    empty = 0
    while not _stop:
        try:
            row = acquire_lease("extracting")
        except Exception as e:  # noqa: BLE001
            _log(f"✗ acquire_lease falhou: {e}")
            if once:
                break
            await asyncio.sleep(poll)
            continue
        if row is None:
            if once:
                _log(f"Fila vazia · concluído. {processed} arquivo(s) extraído(s).")
                break
            empty += 1
            if empty == 1:
                _log("Fila vazia · aguardando docs em ready_to_extract… (Ctrl+C pra sair)")
            reap_stale_leases()  # enquanto ocioso, destrava presos
            await asyncio.sleep(poll)
            continue
        empty = 0
        await process_one(row)
        processed += 1
    _log(f"Encerrado. Total nesta execução: {processed}.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Extrator de documentos da obra (Fase 2)")
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
