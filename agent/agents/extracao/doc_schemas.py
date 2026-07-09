"""Registro de domínio por tipo de documento (portado do worker TS, agora ATIVO).

O envelope da extração é genérico de propósito (frame fixo, seções livres). Mas
cada tipo de doc da obra tem campos CANÔNICOS esperados (um BM tem numeroBM, itens
com quantidadeMedida/valorMedido, totais…). Aqui guardamos essa estrutura esperada
e injetamos como DICA no prompt do extrator — assim ele captura os campos certos
com os nomes certos, sem perder a flexibilidade do envelope.

Casamento por palavras-chave no tipo detectado (texto-mapa) + nome do arquivo.
Não é validação rígida — é guia. `critical` reforça o is_critical/dupla-passada.
"""

from __future__ import annotations

import re
import unicodedata

# Por tipo: hints (casamento), critical, e a estrutura esperada (identificação,
# colunas da tabela principal, totais). Strings curtas — viram dica no prompt.
DOC_SCHEMAS: dict[str, dict] = {
    "bm": {
        "label": "Boletim de Medição (BM)",
        "hints": ["bm", "boletim", "medicao", "fiscalizacao"],
        "critical": True,
        "identificacao": "numeroBM, mesReferencia, obraNome, contratoNumero, contratante, contratada, dataEmissao, periodoMedicao(inicio,fim)",
        "tabela": "itens medidos · colunas: numeroItem, descricao, unidade, quantidadeContratada, precoUnitario, quantidadeMedida(no período), valorMedido, acumuladoQuantidade, acumuladoValor, percentualExecutado",
        "totais": "totalMesValor, totalAcumuladoValor, totalContratualValor",
    },
    "medicao-acumulada": {
        "label": "Medição Acumulada",
        "hints": ["acumulada", "acumulado", "consolidado"],
        "critical": True,
        "identificacao": "bmReferencia, dataCorte, contratoNumero, obraNome",
        "tabela": "itens · colunas: numeroItem, descricao, unidade, quantidadeContratada, precoUnitario, quantidadeAcumulada, valorAcumulado, percentualAcumulado",
        "totais": "totalContratualValor, totalAcumuladoValor, saldoAFaturar, percentualGlobal",
    },
    "cronograma": {  # MS Project / físico-financeiro
        "label": "Cronograma (MS Project / físico-financeiro)",
        "hints": ["cronograma", "ms project", "mpp", "baseline", "fisico-financeiro", "fisico financeiro", "curva s"],
        "critical": True,
        "identificacao": "revisao, dataLinhaBase, dataInicio, dataTerminoPlanejado",
        "tabela": "tarefas · colunas: wbs, nome, inicioPlanejado, fimPlanejado, inicioReal, fimReal, duracaoDias, predecessoras, percentConcluido, caminhoCritico · marcos: wbs, nome, dataPlanejada, dataReal",
        "totais": "—",
    },
    "rdo": {
        "label": "Relatório Diário de Obra (RDO)",
        "hints": ["rdo", "diario"],
        "critical": False,
        "identificacao": "data, numeroRdo, obraNome, clima(manha,tarde,noite,chuvaMm)",
        "tabela": "efetivo (mod/moi: funcao, quantidade), equipamentos (tipo, quantidade, horasTrabalhadas), atividadesExecutadas (frente, descricao, percentualDia)",
        "totais": "totalMod, totalMoi, ocorrencias, observacoes",
    },
    "relatorio-semanal": {
        "label": "Relatório Semanal",
        "hints": ["semanal", "semana"],
        "critical": False,
        "identificacao": "numeroSemana, periodo(inicio,fim), resumoExecutivo",
        "tabela": "atividadesPorFrente (frente, descricao, percentualSemana), desviosCronograma (marco, impactoDias, causa)",
        "totais": "proximaSemana, ocorrencias",
    },
    "faturamento": {
        "label": "Controle de Faturamento",
        "hints": ["faturamento", "compras", "fornecedor", "nota fiscal"],
        "critical": False,
        "identificacao": "mesReferencia",
        "tabela": "comprasInsumos · colunas: data, fornecedor, insumo, codigoInsumo, unidade, quantidade, precoUnitario, valorTotal, notaFiscal",
        "totais": "totalMes",
    },
    "pluviometrico": {
        "label": "Controle Pluviométrico",
        "hints": ["pluviometrico", "chuva", "precipitacao"],
        "critical": False,
        "identificacao": "mesReferencia",
        "tabela": "registrosDiarios · colunas: data, mm, horasParalisadas, observacao",
        "totais": "diasComChuva, totalMm",
    },
    "armacao-concreto": {
        "label": "Controle de Armação e Concreto",
        "hints": ["armacao", "concreto", "fck"],
        "critical": False,
        "identificacao": "periodo",
        "tabela": "registrosArmacao (data, elemento, pesoKg, bitola); registrosConcreto (data, elemento, fck)",
        "totais": "totalArmacaoKg",
    },
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s.lower()).strip()


def match_doc_schema(doc_type_text: str | None, filename: str = "") -> dict | None:
    """Casa o tipo detectado (+ nome do arquivo) com um schema de domínio pelas
    hints. Retorna o dict do schema ou None."""
    hay = _norm(f"{doc_type_text or ''} {filename}")
    if not hay:
        return None
    best = None
    best_score = 0
    for key, sch in DOC_SCHEMAS.items():
        score = sum(1 for h in sch["hints"] if _norm(h) in hay)
        if score > best_score:
            best, best_score = sch, score
    return best if best_score > 0 else None


def expected_structure_hint(doc_type_text: str | None, filename: str = "") -> str:
    """Dica de ESTRUTURA ESPERADA pra injetar no prompt do extrator (ou '' se não
    casar). Guia, não regra — capture o que o doc tiver, com estes nomes quando der."""
    sch = match_doc_schema(doc_type_text, filename)
    if not sch:
        return ""
    return (
        f"\nESTRUTURA ESPERADA ({sch['label']}) — capture estes campos QUANDO presentes, "
        f"com nomes próximos a estes:\n"
        f"  · identificação: {sch['identificacao']}\n"
        f"  · tabela principal: {sch['tabela']}\n"
        f"  · totais declarados: {sch['totais']}\n"
        f"(É guia do domínio, não regra rígida — o documento manda. Não invente campo ausente.)"
    )


def is_domain_critical(doc_type_text: str | None, filename: str = "") -> bool:
    """True se o tipo casado é crítico (reforça is_critical do envelope)."""
    sch = match_doc_schema(doc_type_text, filename)
    return bool(sch and sch.get("critical"))
