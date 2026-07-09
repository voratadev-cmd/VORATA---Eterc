"""FastAPI app do agente "Adm Contratual IA".

Ativar um agente = 1 linha de include_router aqui (cada agente é self-contained
em agents/<nome>/router.py · ver guia §6).
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("agent")

# Checa os envs ANTES de importar o router — o router importa o supabase_client, que cria o
# client em nível de módulo e levantaria um SupabaseException cru mascarando a msg amigável.
config.assert_ready()

from agents.adm_contratual.router import router as adm_router  # noqa: E402

app = FastAPI(title="Adm Contratual IA · Agent Runner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,  # NÃO usar "*" com dados de negócio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(adm_router, prefix="/api")


@app.on_event("startup")
async def _startup() -> None:
    log.info("Agent runner subindo · auth Claude = %s · modelo = %s", config.CLAUDE_AUTH_MODE, config.AGENT_MODEL)
    if config.CLAUDE_AUTH_MODE == "oauth_cli":
        log.info("Modo OAuth (assinatura): usa o token da CLI (claude setup-token / CLAUDE_CODE_OAUTH_TOKEN).")
    else:
        log.info("Modo API key (prod): cobrança por token via ANTHROPIC_API_KEY.")
    # Libera mensagens de chat presas em "streaming" de um processo anterior (restart/deploy/OOM).
    from agents.adm_contratual.service import reap_stuck_messages  # noqa: E402 (após assert_ready)

    n = reap_stuck_messages()
    if n:
        log.info("Reaper: %d mensagem(ns) presa(s) marcada(s) como erro.", n)


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "adm-contratual-agent",
        "claude_auth": config.CLAUDE_AUTH_MODE,
        "model": config.AGENT_MODEL,
    }
