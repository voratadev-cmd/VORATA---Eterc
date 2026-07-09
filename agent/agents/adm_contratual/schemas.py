"""Contratos (Pydantic) das rotas do agente Adm Contratual IA."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AskRequest(BaseModel):
    # Sem Supabase Auth ainda · o front manda um identificador do solicitante.
    visitor_id: str = Field(..., min_length=1, max_length=200, description="ID do usuário/sessão")
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    # Contexto: a qual obra a conversa se refere (null = global).
    obra_id: Optional[str] = Field(None, description="UUID da obra em foco, se houver")

    @field_validator("obra_id")
    @classmethod
    def _obra_id_uuid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        try:
            UUID(str(v))
        except (ValueError, TypeError) as e:
            raise ValueError("obra_id deve ser um UUID válido") from e
        return v


class AskResponse(BaseModel):
    conversation_id: str
    message_id: str
    status: str


class RegenerarRequest(BaseModel):
    obra_id: str = Field(..., description="UUID da obra cujas sínteses devem ser regeneradas")

    @field_validator("obra_id")
    @classmethod
    def _obra_id_uuid(cls, v: str) -> str:
        try:
            UUID(str(v))
        except (ValueError, TypeError) as e:
            raise ValueError("obra_id deve ser um UUID válido") from e
        return v


class RegenerarResponse(BaseModel):
    obra_id: str
    status: str


class RelatorioGerarRequest(BaseModel):
    # Geração de relatório por aba do RMA. Os DADOS vêm do FRONT (mesmos read-models da aba →
    # paridade com a tela); a IA só escreve a narrativa ancorada neles.
    obra_id: str = Field(..., description="UUID da obra")
    aba: str = Field(..., min_length=1, max_length=60, description="aba do RMA, ex.: 'faturamento'")
    dados: dict = Field(..., description="dados da aba (indicadores, gráfico, tabela, farol) p/ ancoragem")
    extracao_version: Optional[int] = Field(None, description="versão de extração lida (staleness)")

    @field_validator("obra_id")
    @classmethod
    def _obra_id_uuid(cls, v: str) -> str:
        try:
            UUID(str(v))
        except (ValueError, TypeError) as e:
            raise ValueError("obra_id deve ser um UUID válido") from e
        return v


class RelatorioGerarResponse(BaseModel):
    obra_id: str
    aba: str
    status: str
