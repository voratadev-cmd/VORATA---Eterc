"""Gerador de RELATÓRIO de IA por aba do RMA — um DOCUMENTO estruturado (RelatorioAba), não texto
curto como as sínteses.

Princípio de honestidade/paridade: os DADOS (indicadores, série do gráfico, tabela de detalhamento,
farol) vêm do FRONT — são os MESMOS read-models que a aba renderiza, então o relatório bate ao
centavo com a tela (a golden trava do projeto). A IA escreve SÓ a NARRATIVA (sumário, leitura,
pontos de atenção, recomendações), ANCORADA nesses números e barrada pelo MESMO validador do chat.
A IA interpreta; nunca calcula nem inventa número.

Fluxo: front coleta `dados` da aba → POST /relatorios/gerar → Claude (narrativa JSON ancorada em
`dados`) → validar_ancoragem → monta RelatorioAba (dados + narrativa) → upsert obra_relatorios.

NÃO TESTADO em runtime ainda (precisa do serviço agent + auth Claude + DB) — espelha sintese.py.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone

from config import AGENT_MODEL

from agents.adm_contratual.agent import collect_text
from agents.adm_contratual.validador import validar_ancoragem
from services.supabase_client import supabase

# ── Foco de NARRATIVA por aba. Adicionar aba = adicionar entrada (os DADOS vêm do front). ──
RELATORIOS: dict[str, dict] = {
    "rma-geral": {
        "titulo": "RMA — Visão Consolidada",
        "foco": "Síntese executiva do CONTRATO INTEIRO (visão do Diretor): o estado de saúde "
                "consolidado de todos os blocos do RMA — o placar geral, os 2-3 sinais mais críticos "
                "que exigem decisão, e a recomendação central. NÃO detalhe nenhum domínio (isso é dos "
                "relatórios por aba); seja o panorama estratégico. Respeite cobertura parcial (blocos "
                "pendentes não são verdes), financeiro ≠ físico, e só trate o desequilíbrio como "
                "headline quando quantificado.",
    },
    "faturamento": {
        "titulo": "Faturamento",
        "foco": (
            "Analise o FATURAMENTO da obra: o realizado vs contratado (avanço FINANCEIRO) e, "
            "separadamente, a ADERÊNCIA vs o previsto no corte (NÃO confunda os dois). Leia o ritmo e "
            "a tendência da curva contratado×real e o sentido do desvio. Os pontos de atenção devem "
            "sair dos próprios números; as recomendações devem ser acionáveis e coerentes com o desvio "
            "medido (ex.: pleito de reequilíbrio, reforço de frente crítica, tempestividade)."
        ),
    },
    "visao-geral": {
        "titulo": "Visão Geral",
        "foco": "Diagnóstico executivo CONSOLIDADO: sintetize o placar dos 5 blocos (faturamento, "
                "recursos, produtividade, prazo, desequilíbrio) e a Situação Geral, sem mergulhar em "
                "nenhum domínio. Cobertura parcial = farol Observação (não verde); Prazo PENDENTE "
                "(não 0%); desequilíbrio só vira headline quando quantificado; financeiro ≠ físico.",
    },
    "indicadores": {
        "titulo": "Indicadores e Farol",
        "foco": "Leitura CRUZADA dos 4 blocos (Faturamento, Prazo, Recursos, Insumos) e destaque o "
                "PIOR. A régua aqui é DESVIO em p.p. (não a aderência 90/85/70 da C.3). Financeiro ≠ "
                "físico (avanço físico pendente → 'a medir', não 0); Insumos Conforme por gap zero é "
                "pendente honesto, não excelência.",
    },
    "recursos": {
        "titulo": "Recursos",
        "foco": "Alocação MOD/MOI/EQP: aderência = real ÷ contratado em QUANTIDADE até o BM (não "
                "físico nem financeiro). Quem está acima do plano (overspend de MOD → indício de "
                "improdutividade) vs abaixo, sempre como sinal/indício — a quantificação fina (Total "
                "Cost / Valor Agregado) é do M3. PENDENTE ≠ 0: farol só onde há real medido.",
    },
    "produtividade": {
        "titulo": "Produtividade",
        "foco": "Produtividade ECONÔMICA R$/HH (R$ faturado por hora-homem), NUNCA confundir com a "
                "física un/h. Farol oficial = aderência acumulada (real ÷ contratada). HH real é "
                "PARCIAL (só meses medidos; resto contratada-prevista, real=null='—'); separe ritmo "
                "da Contratada de falta de frente liberada antes de tratar como desequilíbrio.",
    },
    "prazo": {
        "titulo": "Prazo e Cronograma",
        "foco": "PRAZO FÍSICO (avanço de serviço), NÃO financeiro: avanço físico real vs previsto no "
                "corte, o atraso (pp), e os marcos (cumpridos/atrasados/em risco). Diga se a obra "
                "está no rumo, adiantada ou atrasada FISICAMENTE. O que for pendente, diga pendente.",
    },
    "insumos": {
        "titulo": "Insumos",
        "foco": "Curva ABC (concentração de valor), o excedente vs o limite contratual (IPCA) e o "
                "impacto financeiro do desvio de preços. Valor orçado é REFERÊNCIA (não preço real "
                "pago); se o real ainda não foi lançado, gap zero é pendente, não economia.",
    },
    "curvas": {
        "titulo": "Curvas e Responsabilidade",
        "foco": "Curvas Contratado → Liberado → Capacidade: onde está o GARGALO (Contratada/"
                "subdimensionamento, ou Capacidade/liberação?), pela folga liberado × capacidade "
                "(≥ 15 pp). Leitura por frente, como diagnóstico preliminar.",
    },
    "chuvas": {
        "titulo": "Chuvas",
        "foco": "Dias improdutivos por chuva > 5 mm: baseline contratual (proposta) × real do RDO, "
                "apurados SEM compensar entre meses → 'dias a cobrar' (só excessos contam). É PRAZO/"
                "ociosidade pleiteável (MOD+EQP), não faturamento. Meses sem RDO ficam '—'; o Δ net "
                "pode ser 0 e ainda haver dias a cobrar.",
    },
    "panorama": {
        "titulo": "Panorama do Contrato",
        "foco": "Visão CONSOLIDADA de farol por dimensão (operacional/contratual, não de medição). "
                "Dimensões sem sinal são PENDENTE (não verde); o consolidado reflete só as avaliadas. "
                "Reconcilie sinais (ex.: frentes impedidas em R$ pertencem a uma dimensão ainda não "
                "avaliada, por isso não rebaixam o consolidado).",
    },
    "plano-acao": {
        "titulo": "Plano de Ação",
        "foco": "Follow-up operacional 5W2H: priorize ações ATRASADAS e CRÍTICAS atrasadas (escalada), "
                "depois vencendo < 7 d e o ritmo de conclusão (% concluídas, SLA). É um quadro de "
                "tarefas (responsável/prazo/urgência/status), não série financeira nem física — não "
                "invente R$/%.",
    },
    "responsabilidade": {
        "titulo": "Análise de Responsabilidade",
        "foco": "Classificação de eventos NEGATIVOS por responsável (Contratante/Contratada/Terceiro/"
                "Força Maior), impacto em R$ e nexo causal — é a BASE para Pleitos, não indicador de "
                "desempenho. Atribua responsabilidade e quantifique; não confunda com farol de "
                "desempenho.",
    },
    "condutas": {
        "titulo": "Condutas",
        "foco": "Catálogo de AÇÕES contratuais sugeridas (C.11): priorize as urgentes em aberto "
                "(gatilho + cláusula-base + documento recomendado + estágio), como obrigações de "
                "registro/cobrança contemporânea cujo atraso enfraquece pleitos. Não é indicador "
                "numérico financeiro nem físico.",
    },
}

_PREAMBULO = """# PAPEL
Você é o "Adm Contratual IA", administrador contratual sênior de obras de empreitada (PT-BR),
escrevendo a ANÁLISE de uma tela do RMA para um relatório executivo de consultoria.

# REGRAS DURAS (honestidade = tudo; erro custa milhões)
- Use SOMENTE os números do CONTEXTO. NUNCA invente R$, %, datas ou cláusulas. Todo número que citar
  TEM que estar no contexto (verbatim ou arredondado). Nada de "estimo", "cerca de".
- NUNCA some, acumule, subtraia, projete ou DERIVE um número novo. Para descrever evolução, cite os
  valores pontuais que JÁ aparecem nas tabelas/curva — é proibido criar somas ou acumulados próprios.
- Onde o contexto disser "pendente", escreva "pendente" — não preencha o buraco.
- NÃO confunda avanço FINANCEIRO (% do contrato faturado) com aderência (% vs previsto no corte).
- Vocabulário canônico (RMA, BM, BDI, Curva ABC, Contratada/Contratante…) — não traduza.
- Texto de RELATÓRIO: prosa analítica densa, frases completas, tom técnico-executivo. Sem jargão vazio.

# PROFUNDIDADE (relatório de consultoria — COMPLETO e descritivo)
- Escreva um relatório COMPLETO: sumário de 2-3 parágrafos, leitura de 3-4 parágrafos, 4-6 pontos de
  atenção e 4-6 recomendações. Densidade > brevidade — mas todo número ancorado no contexto.
- LEIA A TABELA DE DETALHAMENTO: cite meses/linhas e valores ESPECÍFICOS (ex.: "de mar/26 a mai/26 o
  desvio abriu de X para Y"); mostre a EVOLUÇÃO, não só o agregado. Compare os indicadores entre si.
- Explique o PORQUÊ e a CONSEQUÊNCIA contratual de cada sinal, não só o "o quê". Cada ponto de atenção
  e cada recomendação deve apoiar-se num número concreto do contexto.
- Recomendações: específicas, priorizadas e acionáveis (o quê + por quê + com que urgência)."""

_SCHEMA = (
    '{"sumarioExecutivo": "2-3 parágrafos densos; separe parágrafos por \\n\\n", '
    '"leituraProsa": ['
    '"§1 (vem ANTES do gráfico): o que a curva e os indicadores mostram no corte", '
    '"§2 (DEPOIS): a tendência e o ritmo — acelera/desacelera, sentido e magnitude do desvio", '
    '"§3 (DEPOIS): o que o DETALHAMENTO mês a mês revela — cite meses e valores específicos", '
    '"§4 (DEPOIS): a implicação contratual e o que monitorar no próximo corte"], '
    '"pontosAtencao": [{"tom": "danger|warning|info|success", "titulo": "curto", "texto": "1-2 frases, cada uma ancorada num número do contexto"}], '
    '"recomendacoes": ["ação acionável e específica 1", "ação 2", "..."]}'
    "\n(leituraProsa: 3 a 4 parágrafos · pontosAtencao: 4 a 6 · recomendacoes: 4 a 6)"
)


def _fmt(v) -> str:  # noqa: ANN001
    return "—" if v is None else str(v)


def _ctx(dados: dict) -> str:
    """Renderiza os `dados` do front como CONTEXTO textual (fonte da verdade p/ a IA + o validador)."""
    titulo = dados.get("titulo", "")
    linhas: list[str] = [f"DADOS DA ABA {titulo} (fonte da verdade — números SÓ daqui):"]
    if dados.get("farol"):
        linhas.append(f"- Farol da aba (já calculado pela régua oficial): {dados['farol']}")
    for ind in dados.get("indicadores", []) or []:
        hint = f" ({ind['hint']})" if ind.get("hint") else ""
        linhas.append(f"- {ind.get('label')}: {ind.get('valor')}{hint}")
    graf = dados.get("grafico") or {}
    serie = graf.get("serie") or []
    if serie:
        un = graf.get("unidade", "")
        linhas.append(f"Curva acumulada{f' ({un})' if un else ''} — previsto × real:")
        for p in serie:
            linhas.append(f"  · {p.get('m')}: previsto {_fmt(p.get('previsto'))} · real {_fmt(p.get('real'))}")
    def _tabela(t: dict) -> None:
        if not t.get("linhas"):
            return
        titulo = t.get("titulo") or "Detalhamento"
        linhas.append(f"{titulo} ({' · '.join(t.get('colunas', []))}):")
        for ln in t["linhas"]:
            linhas.append("  · " + " · ".join(_fmt(c) for c in ln))

    _tabela(dados.get("detalhamento") or {})
    for t in dados.get("tabelas") or []:
        _tabela(t or {})
    linhas.append("\nO que NÃO estiver aqui é PENDENTE — diga 'pendente', não estime.")
    return "\n".join(linhas)


def _system_prompt(aba: str, dados: dict) -> str:
    cfg = RELATORIOS[aba]
    return (f"{_PREAMBULO}\n\n# TAREFA\nEscreva a análise da aba **{cfg['titulo']}**. {cfg['foco']}\n\n"
            f"# SAÍDA\nResponda APENAS um JSON válido (sem markdown, sem cercas ```), no schema:\n{_SCHEMA}\n\n"
            f"# CONTEXTO (fonte da verdade — números SÓ daqui)\n{_ctx(dados)}")


def _parse_json(raw: str) -> dict | None:
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


def _montar(aba: str, dados: dict, narr: dict, status: str) -> dict:
    """Monta o RelatorioAba final: DADOS do front + NARRATIVA da IA (schema casado com o TS do front)."""
    return {
        "aba": aba,
        "titulo": dados.get("titulo", RELATORIOS[aba]["titulo"]),
        "farol": dados.get("farol", "observacao"),
        "sumarioExecutivo": narr.get("sumarioExecutivo", ""),
        "indicadores": dados.get("indicadores", []),
        "leitura": {"prosa": narr.get("leituraProsa", []), "grafico": dados.get("grafico")},
        "detalhamento": dados.get("detalhamento"),
        "tabelas": dados.get("tabelas") or [],
        "pontosAtencao": narr.get("pontosAtencao", []),
        "recomendacoes": narr.get("recomendacoes", []),
        "meta": {
            "geradoEm": datetime.now(timezone.utc).isoformat(),
            "modelo": AGENT_MODEL,
            "status": status,
        },
    }


async def _gerar_async(aba: str, dados: dict) -> dict:
    raw = await collect_text("Gere a análise em JSON, conforme o schema e o contexto.",
                             _system_prompt(aba, dados))
    narr = _parse_json(raw)
    if narr is None:
        return {"status": "erro", "motivo": "saída não-JSON", "raw": raw[:500]}
    # ancoragem da NARRATIVA sobre os DADOS (todo R$/% citado tem que estar nos dados do front)
    val = validar_ancoragem(json.dumps(narr, ensure_ascii=False), dados)
    status = "ok" if val["ancorado"] else "needs_review"
    return {"relatorio": _montar(aba, dados, narr, status), "ancorado": val["ancorado"],
            "suspeitos": val["suspeitos"], "status": status}


def gerar_relatorio(obra_id: str, aba: str, dados: dict) -> dict:
    """Gera o relatório de uma aba (sync · event loop próprio). `dados` vêm do front (read-models)."""
    if aba not in RELATORIOS:
        raise ValueError(f"aba sem relatório: {aba} (disponíveis: {list(RELATORIOS)})")
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_gerar_async(aba, dados))
    finally:
        loop.close()


def salvar_relatorio(obra_id: str, aba: str, resultado: dict, extracao_version: int | None) -> None:
    """Upsert por (obra, aba). Não persiste 'erro' (saída não-JSON) — não troca um relatório bom por lixo."""
    if resultado.get("status") == "erro":
        return
    rel = resultado["relatorio"]
    fatos_hash = hashlib.sha256(
        json.dumps(rel, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    rel["meta"]["fatosHash"] = fatos_hash
    rel["meta"]["extracaoVersion"] = extracao_version
    supabase.table("obra_relatorios").upsert(
        {
            "contrato_id": obra_id,
            "aba": aba,
            "conteudo": rel,
            "status": resultado["status"],
            "fatos_hash": fatos_hash,
            "extracao_version": extracao_version,
            "modelo": AGENT_MODEL,
            "gerado_em": rel["meta"]["geradoEm"],
        },
        on_conflict="contrato_id,aba",
    ).execute()


def gerar_e_salvar_relatorio(obra_id: str, aba: str, dados: dict,
                             extracao_version: int | None = None) -> dict:
    """Gera + persiste o relatório de uma aba. Conveniência p/ a rota/background."""
    r = gerar_relatorio(obra_id, aba, dados)
    salvar_relatorio(obra_id, aba, r, extracao_version)
    return r
