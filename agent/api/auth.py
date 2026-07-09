"""Auth front → agente · segredo compartilhado (Bearer).

MVP: compara o VPS_SECRET. Quando o front tiver Supabase Auth, trocar por
validação do JWT do usuário (mais seguro pra app público · ver guia §5).
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from config import VPS_SECRET


async def verify_vps_secret(authorization: str | None = Header(None)) -> None:
    # Defesa em profundidade: nunca autenticar com segredo vazio (senão "Bearer " passaria).
    # O assert_ready() de boot já barra isso, mas não dependemos só dele.
    if not VPS_SECRET:
        raise HTTPException(status_code=500, detail="Server misconfigured (no secret)")
    # Header opcional → 401 explícito quando ausente (não 422). Comparação
    # constant-time (hmac.compare_digest) evita timing attack no segredo.
    expected = f"Bearer {VPS_SECRET}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid authorization")
