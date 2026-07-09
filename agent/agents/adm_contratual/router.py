"""Rotas do agente Adm Contratual IA · self-contained (guia §6)."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends

from agents.adm_contratual.relatorio import gerar_e_salvar_relatorio
from agents.adm_contratual.schemas import (
    AskRequest,
    AskResponse,
    RegenerarRequest,
    RegenerarResponse,
    RelatorioGerarRequest,
    RelatorioGerarResponse,
)
from agents.adm_contratual.service import ask
from agents.adm_contratual.sintese import regenerar_sinteses
from api.auth import verify_vps_secret

router = APIRouter(prefix="/agents/adm", tags=["adm-contratual"])


@router.post("/ask", response_model=AskResponse)
async def adm_ask(
    req: AskRequest,
    background_tasks: BackgroundTasks,
    _=Depends(verify_vps_secret),
) -> AskResponse:
    result = await ask(
        req.visitor_id,
        req.message,
        background_tasks,
        conversation_id=req.conversation_id,
        obra_id=req.obra_id,
    )
    return AskResponse(**result)


@router.post("/sinteses/regerar", response_model=RegenerarResponse)
async def adm_regenerar(
    req: RegenerarRequest,
    background_tasks: BackgroundTasks,
    _=Depends(verify_vps_secret),
) -> RegenerarResponse:
    """Dispara a regeneração das sínteses da obra em BACKGROUND (chamada Claude é lenta) e retorna na
    hora. O front lê as sínteses atualizadas pelos read-models (obra_sinteses) quando ficarem prontas."""
    background_tasks.add_task(regenerar_sinteses, req.obra_id)
    return RegenerarResponse(obra_id=req.obra_id, status="processing")


@router.post("/relatorios/gerar", response_model=RelatorioGerarResponse)
async def adm_gerar_relatorio(
    req: RelatorioGerarRequest,
    background_tasks: BackgroundTasks,
    _=Depends(verify_vps_secret),
) -> RelatorioGerarResponse:
    """Gera o RELATÓRIO de IA de uma aba em BACKGROUND (Claude é lento) e retorna na hora. Os `dados`
    vêm do front (read-models da aba → paridade). O front lê o relatório pronto via obra_relatorios
    (polling/refetch). Persiste 1 por (obra, aba) — regenerar = upsert."""
    background_tasks.add_task(
        gerar_e_salvar_relatorio, req.obra_id, req.aba, req.dados, req.extracao_version
    )
    return RelatorioGerarResponse(obra_id=req.obra_id, aba=req.aba, status="processing")
