"""Propositor de config · DESIGN-TIME (a IA monta o mapeamento, o gate verifica).

Fluxo: lê as colunas + amostra + chaves de totais de um envelope → a IA PROPÕE qual coluna
é cada campo canônico (JSON) → constrói uma config candidata → o GATE determinístico aplica
a candidata no envelope e confere por VALOR (Σ folhas == total declarado). A IA é
DESCARTÁVEL: o que se aceita é a config que PASSOU NO GATE, não a opinião do modelo.

É a única peça com LLM da normalização — e roda UMA vez por layout, em design-time, não por
documento em runtime. Uso: python -m agents.normalizacao.propor <fixture.json> "<doc_type>"
"""

from __future__ import annotations

import asyncio
import copy
import json
import re
import sys
import tempfile

from claude_agent_sdk import ClaudeAgentOptions, query
from config import EXTRACTOR_MODEL

from .config import load_config
from .configs import _MEDICAO_V1
from .engine import normalizar

# Catálogo dos campos canônicos que a IA mapeia (nome → o que significa). O perfil/eixo de
# cada um vem do TEMPLATE (_MEDICAO_V1) — a IA só decide QUAL coluna, não o tipo.
_CAT_ITEM = {
    "numero_item": "código EDT/item hierárquico (1, 1.1, 1.1.1) — identificador da linha",
    "descricao": "nome/descrição da tarefa ou serviço",
    "unidade": "unidade de medida (m³, kg, vb, conj., un)",
    "quantidade_contratada": "quantidade total CONTRATADA/orçada do item",
    "preco_unitario": "preço/custo UNITÁRIO contratado",
    "valor_contratado": "valor/custo TOTAL contratado do item (qtd × preço)",
    "quantidade_periodo": "quantidade medida NO PERÍODO (o mês deste BM)",
    "valor_medido_periodo": "valor R$ medido NO PERÍODO (o mês deste BM)",
    "quantidade_acumulada": "quantidade medida ACUMULADA até este BM",
    "valor_medido_acumulado": "valor R$ medido ACUMULADO até este BM",
}
_CAT_TOTAIS = {
    "total_periodo_valor": "total R$ medido no período (total do mês / linha TOTAL)",
    "total_acumulado_valor": "total R$ medido acumulado até este BM",
}


async def _ask_llm(columns: list, sample: list, totais_keys: list) -> str:
    cat = "\n".join(f"  - {k}: {v}" for k, v in _CAT_ITEM.items())
    tcat = "\n".join(f"  - {k}: {v}" for k, v in _CAT_TOTAIS.items())
    prompt = f"""Você mapeia colunas de uma tabela de Medição/BM de obra (PT-BR) para campos canônicos do sistema.

COLUNAS da tabela: {json.dumps(columns, ensure_ascii=False)}
AMOSTRA (2 linhas): {json.dumps(sample, ensure_ascii=False)[:900]}
CHAVES de totais declarados: {json.dumps(totais_keys, ensure_ascii=False)}

CAMPOS CANÔNICOS de ITEM (para cada um, diga a COLUNA exata que corresponde, ou null):
{cat}

CAMPOS CANÔNICOS de TOTAIS (para cada um, diga a CHAVE exata de totais, ou null):
{tcat}

Cuidado: 'valor no período' (medido no mês) é DIFERENTE de 'custo total' (contratado).
Responda APENAS um JSON, sem texto antes nem depois:
{{"itens": {{"<campo>": "<Nome Exato da Coluna>"|null, ...}}, "totais": {{"<campo>": "<chaveExata>"|null, ...}}}}"""
    options = ClaudeAgentOptions(model=EXTRACTOR_MODEL, max_turns=1, cwd=tempfile.gettempdir())
    text = ""
    async for msg in query(prompt=prompt, options=options):
        for b in getattr(msg, "content", []) or []:
            t = getattr(b, "text", None)
            if isinstance(t, str):
                text += t
    return text


def _parse_json(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _build_config(mapping: dict, doc_type: str) -> dict:
    """Constrói a config candidata: usa _MEDICAO_V1 como TEMPLATE (perfil/eixo de cada campo)
    e troca o alias_set pela coluna que a IA propôs. Campo mapeado pra null é dropado."""
    cfg = copy.deepcopy(_MEDICAO_V1)
    cfg["config_version"] = "config@9.9.9"  # marca de candidata (versão real só após revisão)
    cfg["doc_types"] = [doc_type[:60]] if doc_type else cfg["doc_types"]
    item_map = mapping.get("itens", {}) or {}
    totais_map = mapping.get("totais", {}) or {}
    for ent in cfg["entidades"]:
        m = item_map if ent["entidade"] == "obra_medicao_itens" else totais_map
        novos = []
        for campo in ent["campos"]:
            col = m.get(campo["canonico"])
            if col:
                campo["coluna"]["alias_set"] = [col]
                novos.append(campo)
        ent["campos"] = novos
    return cfg


def propor_config(envelope: dict, doc_type: str, nome_original: str = "") -> dict:
    """A IA propõe o mapeamento; o gate verifica. Retorna {mapping, config, status, gate}."""
    secoes = envelope.get("secoes") or []
    tabs = [s for s in secoes if s.get("tipo") == "tabela" and s.get("linhas")]
    if not tabs:
        return {"erro": "envelope sem tabela"}
    tab = max(tabs, key=lambda s: len(s.get("linhas") or []))
    columns = tab.get("colunas") or []
    sample = (tab.get("linhas") or [])[:2]
    totais_keys = list((envelope.get("totais_declarados") or {}).keys())

    raw = asyncio.run(_ask_llm(columns, sample, totais_keys))
    mapping = _parse_json(raw)
    if not mapping:
        return {"erro": "IA não retornou JSON parseável", "raw": raw[:400]}

    cfg_dict = _build_config(mapping, doc_type)
    try:
        cfg = load_config(cfg_dict)
    except Exception as e:  # noqa: BLE001
        return {"erro": f"config candidata inválida: {e}", "mapping": mapping}

    # GATE determinístico: aplica a candidata e confere por VALOR.
    res = normalizar(envelope, cfg, nome_original=nome_original)
    return {"mapping": mapping, "config": cfg_dict, "status": res["status"], "gate": res["gate"],
            "n_itens": len(res["entidades"].get("obra_medicao_itens", []))}


def main() -> None:
    fixture, doc_type = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "Boletim de Medição")
    envelope = json.loads(open(fixture).read())
    r = propor_config(envelope, doc_type, nome_original="BM 03 - SBSO.pdf")
    if "erro" in r:
        print("ERRO:", r["erro"], r.get("raw", "")); return
    print("=== MAPEAMENTO proposto pela IA ===")
    for k, v in r["mapping"].get("itens", {}).items():
        print(f"  {k:24} ← {v}")
    print("  -- totais --")
    for k, v in r["mapping"].get("totais", {}).items():
        print(f"  {k:24} ← {v}")
    g = r["gate"]
    print(f"\n=== GATE (verificação determinística) ===")
    print(f"  itens={r['n_itens']} · Σfolhas={g['soma_folhas']:,.2f} vs total={g['total_declarado']} → {r['status']}")
    print("\n" + ("✅ Config candidata PASSOU no gate — pronta pra revisão humana."
                  if r["status"] == "ok" else
                  "⚠ Candidata REPROVOU no gate — a IA errou um mapeamento; o gate pegou (não vai pro banco)."))


if __name__ == "__main__":
    main()
