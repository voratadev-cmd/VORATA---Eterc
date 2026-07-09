"""Gerador de SÍNTESE da IA, GROUNDED e parametrizado por LENTE — uma só máquina que preenche os
campos de IA de várias tabs (Visão Geral, Faturamento, Insumos…), todos ancorados nos MESMOS fatos
e barrados pelo MESMO validador. A IA interpreta; nunca calcula nem inventa número.

Fluxo por lente: coletar_fatos → build_data_context → Claude (collect_text) → parse JSON →
validar_ancoragem. Se a saída citar número fora dos fatos, vem `ancorado=False` + suspeitos.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re

from config import AGENT_MODEL

from agents.adm_contratual.agent import collect_text
from agents.adm_contratual.contexto import build_data_context, coletar_fatos
from agents.adm_contratual.validador import validar_ancoragem
from services.supabase_client import supabase

# ── LENTES · cada uma preenche o campo de IA de uma tab. Adicionar tab = adicionar lente. ──
LENTES: dict[str, dict] = {
    "diagnostico_geral": {
        "campo": "diagnostico",  # tab: Visão Geral
        "instrucao": "Produza um DIAGNÓSTICO executivo da obra: situação geral, 2-4 pontos-chave "
                     "(o que está bom, o que merece atenção) e 1 recomendação. Cite os números do "
                     "contexto. Onde o contexto diz 'pendente', diga pendente — não estime.",
        "schema": ('{"situacao_geral": "1-2 frases", '
                   '"pontos": [{"titulo": "...", "texto": "...", "tom": "positivo|atencao|critico"}], '
                   '"recomendacao": "1 frase"}'),
    },
    "analise_faturamento": {
        "campo": "analiseTextual",  # tab: Faturamento
        "instrucao": "Produza uma ANÁLISE de FATURAMENTO da obra (2-4 frases): o realizado vs "
                     "contratado, o avanço financeiro e como ele se relaciona com o avanço físico. "
                     "Foque no faturamento. NÃO confunda avanço financeiro com aderência vs previsto "
                     "(se essa estiver pendente, diga pendente).",
        "schema": '{"analise": "2-4 frases sobre o faturamento"}',
    },
    "analise_prazo": {
        "campo": "analiseTextual",  # tab: Prazo
        "instrucao": "Produza uma ANÁLISE de PRAZO/cronograma (2-4 frases): o avanço físico real vs "
                     "previsto no corte e o atraso físico (pp). Diga se a obra está no rumo, adiantada "
                     "ou atrasada FISICAMENTE. Cite os números do contexto; o que for pendente, diga "
                     "pendente.",
        "schema": '{"analise": "2-4 frases sobre o prazo/avanço físico"}',
    },
}

_PREAMBULO = """# PAPEL
Você é o "Adm Contratual IA", administrador contratual sênior de obras de empreitada (PT-BR).

# REGRAS DURAS (honestidade = tudo; erro custa milhões)
- Use SOMENTE os números do CONTEXTO abaixo. NUNCA invente R$, %, datas ou cláusulas.
- Todo número que citar TEM que estar no contexto (verbatim ou arredondado). Nada de "estimo", "cerca de".
- Onde o contexto diz "pendente", escreva "pendente" — não preencha o buraco.
- NÃO confunda avanço FINANCEIRO (% do contrato faturado) com aderência (% vs previsto no corte).
- Vocabulário canônico (RMA, BM, BDI, Curva ABC, Contratada/Contratante…) — não traduza.
- PT-BR direto, sem jargão vazio."""


def _system_prompt(lente_id: str, contexto: str) -> str:
    lente = LENTES[lente_id]
    return (f"{_PREAMBULO}\n\n# TAREFA\n{lente['instrucao']}\n\n"
            f"# SAÍDA\nResponda APENAS um JSON válido (sem markdown, sem cercas ```), no schema:\n"
            f"{lente['schema']}\n\n"
            f"# CONTEXTO (fonte da verdade — números SÓ daqui)\n{contexto}")


def _parse_json(raw: str) -> dict | None:
    """Extrai o 1º objeto JSON do texto do modelo (tolera cercas/markdown/texto em volta)."""
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


async def _gerar_async(obra_id: str, lente_id: str) -> dict:
    fatos = coletar_fatos(obra_id)
    contexto = build_data_context(obra_id)
    raw = await collect_text("Gere a saída em JSON, conforme o schema e o contexto.",
                             _system_prompt(lente_id, contexto))
    obj = _parse_json(raw)
    if obj is None:
        return {"lente": lente_id, "status": "erro", "motivo": "saída não-JSON", "raw": raw[:500]}
    # ancoragem sobre TODO o texto da saída (concatena os valores citados)
    val = validar_ancoragem(json.dumps(obj, ensure_ascii=False), fatos)
    fatos_hash = hashlib.sha256(json.dumps(fatos, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    return {
        "lente": lente_id, "campo": LENTES[lente_id]["campo"],
        "conteudo": obj, "ancorado": val["ancorado"], "suspeitos": val["suspeitos"],
        "fatos_hash": fatos_hash, "status": "ok" if val["ancorado"] else "needs_review",
    }


def gerar_sintese(obra_id: str, lente_id: str = "diagnostico_geral") -> dict:
    """Gera a síntese de uma lente para uma obra (sync · abre event loop próprio). O resultado traz
    `ancorado`/`suspeitos` — o chamador decide persistir como 'ok' ou 'needs_review'."""
    if lente_id not in LENTES:
        raise ValueError(f"lente desconhecida: {lente_id} (disponíveis: {list(LENTES)})")
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_gerar_async(obra_id, lente_id))
    finally:
        loop.close()


def salvar_sintese(obra_id: str, resultado: dict) -> None:
    """Upsert por (obra, lente). Persiste mesmo 'needs_review' (com o status — o front gateia).
    NÃO persiste 'erro' (saída não-JSON) — não sobrescreve uma síntese boa com lixo."""
    if resultado.get("status") == "erro":
        return
    supabase.table("obra_sinteses").upsert(
        {
            "contrato_id": obra_id,
            "lente": resultado["lente"],
            "campo": resultado.get("campo"),
            "conteudo": resultado["conteudo"],
            "status": resultado["status"],
            "fatos_hash": resultado.get("fatos_hash"),
            "modelo": AGENT_MODEL,
        },
        on_conflict="contrato_id,lente",
    ).execute()


def gerar_e_salvar(obra_id: str, lente_id: str = "diagnostico_geral") -> dict:
    """Gera + persiste a síntese de uma lente. Conveniência p/ job/CLI."""
    r = gerar_sintese(obra_id, lente_id)
    salvar_sintese(obra_id, r)
    return r


def regenerar_sinteses(obra_id: str) -> dict:
    """Regenera TODAS as lentes de uma obra (chamado on-demand ou após a normalização). Cada lente é
    isolada: uma falha não derruba as outras. Retorna o resumo por lente."""
    resultados: dict[str, str] = {}
    for lente_id in LENTES:
        try:
            r = gerar_e_salvar(obra_id, lente_id)
            resultados[lente_id] = r.get("status", "?")
        except Exception as e:  # noqa: BLE001
            resultados[lente_id] = f"erro: {type(e).__name__}"
    return {"obra_id": obra_id, "lentes": resultados}
