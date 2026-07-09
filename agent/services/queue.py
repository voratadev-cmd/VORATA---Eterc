"""Fila de mapeamento + persistência do contexto · porta Python do worker TS.

Reusa a MESMA infra que o worker TS usaria:
  · RPC `acquire_arquivo_lease(p_lease_minutes, p_phase)` — pega 1 arquivo
    elegível com FOR UPDATE SKIP LOCKED (atômico entre N processos).
  · tabela `obra_arquivo_contextos` — versionada (1:N por arquivo).
  · Storage bucket `rma-docs` — baixa o bruto e sobe uma cópia do .md.

service_role bypassa RLS (esse client só roda no backend, nunca no front).
"""

from __future__ import annotations

import datetime as _dt
import re
import uuid

from config import LEASE_TIMEOUT_MIN, MAPPER_MODEL, RMA_BUCKET
from services.supabase_client import supabase

# Token deste processo · fecha o double-pick (renew/complete só agem se bater).
_OWNER = str(uuid.uuid4())


# ── Fila ───────────────────────────────────────────────────────────
def acquire_lease(phase: str = "mapping") -> dict | None:
    """Pega 1 arquivo elegível e marca status='mapping' (atômico via RPC).

    Retorna a row de obra_arquivos ou None se não há trabalho.
    """
    try:
        resp = supabase.rpc(
            "acquire_arquivo_lease",
            {"p_lease_minutes": LEASE_TIMEOUT_MIN, "p_phase": phase, "p_owner": _OWNER},
        ).execute()
    except Exception:  # noqa: BLE001 — migration de ownership ainda não aplicada → assinatura antiga
        resp = supabase.rpc(
            "acquire_arquivo_lease",
            {"p_lease_minutes": LEASE_TIMEOUT_MIN, "p_phase": phase},
        ).execute()
    data = resp.data
    if not data:
        return None
    return data[0] if isinstance(data, list) else data


def reap_stale_leases() -> int:
    """Move pra estado de erro os docs presos em 'mapping'/'extracting' com lease
    vencido E contador esgotado (corrige o 'preso pra sempre'). Retorna a contagem."""
    try:
        resp = supabase.rpc("reap_stale_leases", {}).execute()
        n = resp.data
        return n if isinstance(n, int) else (n or 0)
    except Exception:  # noqa: BLE001 — best-effort; não derruba o worker
        return 0


def renew_lease(arquivo_id: str, lease_minutes: int | None = None) -> None:
    """Heartbeat · estende o lease de um doc ainda em processamento (extração longa).
    Só renova se ESTE processo ainda é dono do lease (não renova doc reassumido)."""
    mins = int(lease_minutes or LEASE_TIMEOUT_MIN)
    try:
        supabase.rpc(
            "renew_arquivo_lease",
            {"p_id": arquivo_id, "p_lease_minutes": mins, "p_owner": _OWNER},
        ).execute()
    except Exception:  # noqa: BLE001 — assinatura antiga (sem owner) → tenta sem
        try:
            supabase.rpc(
                "renew_arquivo_lease",
                {"p_id": arquivo_id, "p_lease_minutes": mins},
            ).execute()
        except Exception:  # noqa: BLE001
            pass


# Status terminais (espelha CompletionStatus do worker TS).
_ERROR_STATES = {"error", "mapping_error", "extraction_error"}


def complete_job(arquivo_id: str, status: str, last_error: str | None = None) -> None:
    """Marca o arquivo como concluído (sucesso ou falha) e libera o lease.
    Via RPC condicional: só fecha se ainda transiente E este processo é o dono —
    não sobrescreve um doc que outro worker já reassumiu/o reaper já moveu."""
    try:
        resp = supabase.rpc(
            "complete_arquivo_job",
            {"p_id": arquivo_id, "p_status": status, "p_error": last_error or None, "p_owner": _OWNER},
        ).execute()
        if resp.data is False:
            print(
                f"[queue] complete ignorado (doc {arquivo_id[:8]}… mudou de estado / não é meu lease)",
                flush=True,
            )
        return
    except Exception as e:  # noqa: BLE001
        # Só cai pro update DIRETO se a RPC NÃO existe (migration não aplicada). Em
        # qualquer outro erro NÃO sobrescreve às cegas (reabriria o double-write sem
        # checar owner) — loga e deixa o reaper/re-acquire resolver.
        msg = str(e).lower()
        rpc_missing = "pgrst202" in msg or "could not find the function" in msg or "does not exist" in msg
        if not rpc_missing:
            print(f"[queue] complete_arquivo_job falhou (não-fallback): {type(e).__name__}: {e}", flush=True)
            return
    patch: dict = {"status": status, "lease_until": None}
    if last_error:
        patch["last_error"] = last_error[:2000]
    elif status not in _ERROR_STATES:
        patch["last_error"] = None
    supabase.table("obra_arquivos").update(patch).eq("id", arquivo_id).execute()


# ── Storage ────────────────────────────────────────────────────────
def download_file(path: str) -> bytes:
    """Baixa o bruto do Storage. `path` é o caminho dentro do bucket rma-docs."""
    return supabase.storage.from_(RMA_BUCKET).download(path)


# ── Persistência do contexto (texto-mapa) ──────────────────────────
def _next_version(arquivo_id: str) -> int:
    resp = (
        supabase.table("obra_arquivo_contextos")
        .select("version")
        .eq("arquivo_id", arquivo_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return (rows[0]["version"] if rows else 0) + 1


def _safe(name: str) -> str:
    return re.sub(r"[^\w.-]", "_", name)


def persist_contexto(
    *,
    arquivo_id: str,
    obra_id: str,
    arquivo_nome: str,
    doc_type: str,
    doc_type_confidence: float,
    schema_version: str,
    context_md: str,
    structure: dict,
) -> dict:
    """Insere nova versão do mapeamento + sobe cópia do .md no Storage.

    Espelha persistContexto() do worker TS: versiona, grava o .md em
    `{obraId}/context/{tipo}/v{N}-{ts}-{nome}.md` e insere a row no DB.
    Se o insert falhar, faz rollback do upload.
    """
    version = _next_version(arquivo_id)
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    context_path = f"{obra_id}/context/{_safe(doc_type)}/v{version}-{ts}-{_safe(arquivo_nome)}.md"

    # Sobe o .md (best-effort · o que importa pro front é a coluna context_md).
    uploaded = False
    try:
        supabase.storage.from_(RMA_BUCKET).upload(
            context_path,
            context_md.encode("utf-8"),
            {"content-type": "text/markdown; charset=utf-8", "upsert": "false"},
        )
        uploaded = True
    except Exception:  # noqa: BLE001 — cópia em arquivo é redundante; não bloqueia
        context_path = None  # type: ignore[assignment]

    try:
        resp = (
            supabase.table("obra_arquivo_contextos")
            .insert(
                {
                    "arquivo_id": arquivo_id,
                    "doc_type": doc_type,
                    "doc_type_confidence": round(doc_type_confidence, 3),
                    "version": version,
                    "schema_version": schema_version,
                    "context_md": context_md,
                    "context_path": context_path,
                    "structure": structure,
                    "agent_model": MAPPER_MODEL,
                }
            )
            .execute()
        )
        row = resp.data[0]
        return {"id": row["id"], "version": version, "context_path": context_path}
    except Exception:
        if uploaded and context_path:
            try:
                supabase.storage.from_(RMA_BUCKET).remove([context_path])
            except Exception:  # noqa: BLE001
                pass
        raise


# ── Fase 2 · contexto (leitura) + extração (persistência) ──────────────
def load_latest_contexto(arquivo_id: str) -> dict | None:
    """Última versão do texto-mapa de um arquivo (o que o extrator usa de guia)."""
    resp = (
        supabase.table("obra_arquivo_contextos")
        .select("*")
        .eq("arquivo_id", arquivo_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


def _next_extracao_version(arquivo_id: str) -> int:
    resp = (
        supabase.table("obra_arquivo_extracoes")
        .select("version")
        .eq("arquivo_id", arquivo_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return (rows[0]["version"] if rows else 0) + 1


def persist_extracao(
    *,
    arquivo_id: str,
    doc_type: str | None,
    doc_type_confidence: float | None,
    schema_version: str,
    payload: dict,
    field_confidence: dict | None = None,
    discrepancies: list | None = None,
    verifier_findings: list | None = None,
) -> dict:
    """Insere uma versão da extração em obra_arquivo_extracoes. payload (jsonb) é
    o envelope; o JSON é a fonte da verdade (sem cópia no Storage por enquanto)."""
    version = _next_extracao_version(arquivo_id)
    resp = (
        supabase.table("obra_arquivo_extracoes")
        .insert(
            {
                "arquivo_id": arquivo_id,
                "doc_type": (doc_type or "")[:200] or None,
                "doc_type_confidence": (
                    round(doc_type_confidence, 3) if doc_type_confidence is not None else None
                ),
                "version": version,
                "schema_version": schema_version,
                "payload": payload,
                "field_confidence": field_confidence or None,
                "discrepancies": discrepancies or None,
                "verifier_findings": verifier_findings or None,
            }
        )
        .execute()
    )
    return {"id": resp.data[0]["id"], "version": version}


# ── Observabilidade · agent_runs (1 row por chamada de modelo) ─────────
def _usage_field(usage, *keys):
    if usage is None:
        return None
    for k in keys:
        if isinstance(usage, dict) and usage.get(k) is not None:
            return usage.get(k)
        v = getattr(usage, k, None)
        if v is not None:
            return v
    return None


def start_run(arquivo_id: str, agent_name: str, model: str, pass_no: int = 1) -> str | None:
    """Abre uma row em agent_runs. Best-effort (falha não derruba a extração)."""
    try:
        resp = (
            supabase.table("agent_runs")
            .insert(
                {
                    "arquivo_id": arquivo_id,
                    "agent_name": agent_name,
                    "model": model,
                    "pass": pass_no,
                    "status": "ok",
                }
            )
            .execute()
        )
        return resp.data[0]["id"]
    except Exception:  # noqa: BLE001
        return None


def end_run(
    run_id: str | None,
    *,
    usage=None,
    cost=None,
    status: str = "ok",
    error: str | None = None,
    latency_ms: int | None = None,
) -> None:
    if not run_id:
        return
    patch: dict = {"status": status, "ended_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}
    if error:
        patch["error"] = error[:2000]
    if latency_ms is not None:
        patch["latency_ms"] = int(latency_ms)
    if cost is not None:
        patch["cost_usd"] = round(float(cost), 6)
    inp = _usage_field(usage, "input_tokens")
    out = _usage_field(usage, "output_tokens")
    cr = _usage_field(usage, "cache_read_input_tokens", "cache_read_tokens")
    cc = _usage_field(usage, "cache_creation_input_tokens", "cache_creation_tokens")
    if inp is not None:
        patch["input_tokens"] = int(inp)
    if out is not None:
        patch["output_tokens"] = int(out)
    if cr is not None:
        patch["cache_read_tokens"] = int(cr)
    if cc is not None:
        patch["cache_creation_tokens"] = int(cc)
    try:
        supabase.table("agent_runs").update(patch).eq("id", run_id).execute()
    except Exception:  # noqa: BLE001
        pass
