"""Client Supabase com service_role → bypassa RLS. SÓ no agente (nunca no front)."""

from __future__ import annotations

from supabase import Client, create_client

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── Helpers genéricos ──────────────────────────────────────────────
def insert_row(table: str, data: dict) -> dict:
    return supabase.table(table).insert(data).execute().data[0]


def update_row(table: str, row_id: str, data: dict) -> None:
    supabase.table(table).update(data).eq("id", row_id).execute()


def fetch_rows(table: str, **eq) -> list[dict]:
    q = supabase.table(table).select("*")
    for k, v in eq.items():
        q = q.eq(k, v)
    return q.execute().data or []
