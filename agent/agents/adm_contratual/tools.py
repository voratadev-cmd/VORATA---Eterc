"""Toolbox do Adm Contratual IA — ferramentas determinísticas de LEITURA sobre o dado NORMALIZADO
(Camada A/B). A IA escolhe a ferramenta e NARRA; nunca lê/calcula/inventa número.

Cada tool lê o estado VIGENTE das tabelas obra_* (re-upload substitui, delete remove — a tool live
SEMPRE vê o atual) e devolve JSON com: os fatos CONSERVADOS pelos gates, `_proveniencia`
(bm_corte/tabela/obra) e PENDENTE como null (NUNCA 0). Construção via `create_sdk_mcp_server`,
mesmo padrão do extrator (agent/agents/extracao/doc_tools.py:587).

Servidor por-OBRA: `build_adm_tools_server(obra_id)` fecha sobre a obra (o chat é de 1 contrato), então
as tools não pedem obra_id — só os recortes (termo/código). Paridade número-a-número: as tools de
faturamento/produtividade/insumos reusam `coletar_fatos` (contexto.py) — a MESMA computação golden-
testada que alimenta as abas, então o número do chat == número da tela por construção.

⚠️ FASE 0: 15 tools (faturamento, produtividade física+econômica, insumos, recursos, marcos×2,
desequilíbrio, orçamento, BDI, curvas, mapa, chuvas, panorama, buscar_secoes). Cada domínio porta o
read-model específico (ver docs/10-chat-adm-contratual.md §1).
"""

from __future__ import annotations

import calendar
import json
import re
import unicodedata
from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

from agents.adm_contratual.contexto import coletar_fatos
from services.supabase_client import supabase

# Nomes das tools — usado pelo agent.py p/ montar allowed_tools (mcp__admtools__<nome>).
ADM_TOOL_NAMES = [
    "get_faturamento_resumo",
    "get_produtividade_resumo",
    "get_produtividade_economica_resumo",
    "get_insumos_resumo",
    "get_recursos_resumo",
    "get_marcos_contratuais",
    "get_marcos_cronograma_fonte",
    "get_curva_fisica_por_frente",
    "get_curva_prevista_fisica",
    "get_desequilibrio_resumo",
    "get_orcamento_resumo",
    "get_bdi_buildup",
    "get_curvas_resumo",
    "get_mapa_liberacao_resumo",
    "get_chuvas_resumo",
    "get_panorama",
    "buscar_secoes",
    "get_insumos_excedente",
    "get_condutas",
    "get_plano_acao",
    "get_indiretos_detalhe",
    "get_bdi_desequilibrio",
    "get_encargos_detalhe",
    "get_valor_agregado",
    "get_pontuais",
]


# Recursos: metadados de UI por categoria (espelha CAT_META do read-model recursos.ts).
_REC_CAT_META = {
    "MOD": {"label": "MOD", "unidade": "homens·mês", "plural": "funções", "singular": "função"},
    "MOI": {"label": "MOI", "unidade": "homens·mês", "plural": "funções", "singular": "função"},
    "EQP": {"label": "Equipamentos", "unidade": "unid.·mês", "plural": "itens", "singular": "item"},
}
_REC_ORDEM_CAT = ["MOD", "MOI", "EQP"]


def _rec_num(v) -> float | None:  # noqa: ANN001
    """null/NaN → None (lacuna ≠ 0); espelha n() de recursos.ts."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and f not in (float("inf"), float("-inf")) else None


# ── Panorama (C.10) · faróis multidimensionais — espelha panorama.ts:DIMS/NIVEIS ─────────────────
_PANORAMA_FAROL_ORDEM = ["conforme", "observacao", "risco", "critico"]
_PANORAMA_FAROL_LABEL = {
    "conforme": "Conforme",
    "observacao": "Observação",
    "risco": "Risco",
    "critico": "Crítico",
}
# (coluna em obra_panorama, chave, label) — paridade 1:1 com panorama.ts.
_PANORAMA_DIMS = [
    ("farol_projetos", "projetos", "Projetos / Engenharia"),
    ("farol_interferencias", "interferencias", "Interferências"),
    ("farol_liberacoes_area", "liberacoes_area", "Liberações de Área"),
    ("farol_clima_forca_maior", "clima", "Clima / Força Maior"),
    ("farol_precos_quantidades", "precos", "Preços / Quantidades"),
    ("farol_suprimentos_material", "suprimentos", "Suprimentos / Material"),
]


def _pan_farol(v: Any) -> str | None:
    """Valor de farol do banco → nível válido; qualquer outra coisa (null/lixo) vira None = pendente."""
    s = str(v) if v is not None else ""
    return s if s in _PANORAMA_FAROL_ORDEM else None


def _json(obj: Any) -> dict[str, Any]:
    """Retorno de tool no formato MCP (texto = JSON dos fatos, p/ a IA citar com proveniência)."""
    return {"content": [{"type": "text", "text": json.dumps(obj, ensure_ascii=False, default=str)}]}


def _pendente(dimensao: str) -> dict[str, Any]:
    """Dimensão não normalizada → 'pendente' honesto (NUNCA 0 fabricado, NUNCA erro silencioso)."""
    return _json(
        {
            "disponivel": False,
            "motivo": f"{dimensao} ainda não normalizado(a) para esta obra — pendente.",
            "_proveniencia": None,
        }
    )


def _bm_corte(obra_id: str) -> int | None:
    """BM corrente (corte) da obra — dos Cards de resumo C.3 (mesma régua do faturamento). Usado p/
    alinhar a curva FÍSICA ao mesmo corte. None se não houver corte conhecido."""
    cards = (
        supabase.table("obra_secoes")
        .select("dados")
        .eq("contrato_id", obra_id)
        .ilike("codigo", "C.3")
        .eq("tipo", "chave_valor")
        .execute()
        .data
        or []
    )
    for c in cards:
        d = c.get("dados")
        # a chave varia entre extrações: bmCorrente | bmCorrenteDataCorte | bm corrente
        v = _pick(d, "bmCorrente", "bmCorrenteDataCorte", "bm corrente")
        if v is not None:
            try:
                return int(v)
            except (TypeError, ValueError):
                continue
    return None


def _pct1(v) -> float | None:  # noqa: ANN001
    """Fração 0..1 → % com 2 casas. null preserva (PENDENTE ≠ 0).

    2 casas (não 1): em % pequenas, 1 casa (±0,05 abs) estoura a tolerância relativa do gate de
    paridade chat×tela (caso real: físico 0,539% → chat 0,5 vs tela 0,54 = 7,4% de desvio relativo).
    """
    try:
        return round(float(v) * 100, 2) if v is not None else None
    except (TypeError, ValueError):
        return None


def _norm_key(s: Any) -> str:
    """Normaliza chave/coluna (sem acento/espaço/pontuação, minúscula) — casa colunas com glifos."""
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in s if ch.isalnum())


def _pick(row: Any, *frags: str) -> Any:
    """Valor de uma coluna por fragmento (match exato normalizado, depois substring). None se ausente."""
    if not isinstance(row, dict):
        return None
    keys = list(row.keys())
    for f in frags:
        nf = _norm_key(f)
        for k in keys:
            if _norm_key(k) == nf:
                return row[k]
    for f in frags:
        nf = _norm_key(f)
        for k in keys:
            if nf in _norm_key(k):
                return row[k]
    return None


def _secao_dados(obra_id: str, titulo_frag: str) -> Any:
    """`dados` de uma seção de obra_secoes por fragmento de título (MESMA fonte das telas TS). None se ausente."""
    rows = (
        supabase.table("obra_secoes")
        .select("dados")
        .eq("contrato_id", obra_id)
        .ilike("titulo", f"%{titulo_frag}%")
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0]["dados"] if rows else None


def _kpi_canonico(obra_id: str, key: str) -> float | None:
    """Valor CANÔNICO de obra_kpis (Fase B) — persistido das telas por scripts/persist_kpis.ts. None se
    ainda não há linha. Falha de leitura → None (degrada pra computação própria da tool, nunca quebra)."""
    try:
        rows = (
            supabase.table("obra_kpis")
            .select("valor")
            .eq("contrato_id", obra_id)
            .eq("kpi_key", key)
            .limit(1)
            .execute()
            .data
            or []
        )
        v = rows[0]["valor"] if rows else None
        return float(v) if v is not None else None
    except Exception:  # noqa: BLE001
        return None


def _pin_canon(obra_id: str, key: str, out: dict, field: str) -> dict:
    """PIN do headline ao canônico de obra_kpis → chat == tela por construção. Se obra_kpis tem a chave,
    sobrescreve out[field] com ela (e registra _canonico se divergia da computação própria = sinal de
    drift/stale, que o gate de paridade pega). Se não tem (ou a tool nem expôs o campo, ex.: pendente),
    mantém a computação da tool (fallback honesto)."""
    if field not in out:  # tool não expôs esse headline (pendente/erro) → não inventa valor
        return out
    canon = _kpi_canonico(obra_id, key)
    if canon is None:
        return out
    proprio = out.get(field)
    if proprio is not None and abs(float(proprio) - canon) > 0.01:
        out["_canonico"] = {"campo": field, "valor": canon, "proprio": proprio, "fonte": "obra_kpis (== tela)"}
    out[field] = canon
    return out


# Fase B · mapa tool → campo HEADLINE (top-level) que é fixado ao canônico de obra_kpis. O gate de
# paridade (scripts/parity/anchors.json) usa exatamente estes campos. Só top-level escalar (os
# aninhados — encargos/VA/pontuais/recursos — seguem na computação própria + gate até serem portados).
_CANON_FIELD = {
    "get_desequilibrio_resumo": "total_rs",
    "get_faturamento_resumo": "realizado_acumulado_rs",
    "get_indiretos_detalhe": "desequilibrio_total",
    "get_bdi_desequilibrio": "desequilibrio_total_rs",
    "get_insumos_resumo": "contrato_fd_bdi_rs",
    "get_insumos_excedente": "repasse_real_rs",
    "get_bdi_buildup": "markup_total",
    "get_curvas_resumo": "executado_acum_rs",
    "get_mapa_liberacao_resumo": "soma_valor_rs",
    "get_marcos_cronograma_fonte": "nTarefas",
    "get_marcos_contratuais": "nRiscoOuCritico",
    "get_curva_fisica_por_frente": "n_disciplinas",
    "get_panorama": "n_avaliados",
    "get_chuvas_resumo": "dias_a_cobrar",
}


def _pin_tool(tool: Any, obra_id: str) -> Any:
    """Embrulha o handler de uma tool p/ FIXAR seu headline ao canônico de obra_kpis (Fase B). Seguro:
    qualquer erro no pin cai pro resultado original (chat nunca quebra). Tools fora do _CANON_FIELD passam
    intactas."""
    field = _CANON_FIELD.get(getattr(tool, "name", None))
    if not field:
        return tool
    orig = tool.handler

    async def _wrapped(args):  # noqa: ANN001, ANN202
        res = await orig(args)
        try:
            for b in (res or {}).get("content") or []:
                if isinstance(b, dict) and b.get("type") == "text" and b.get("text"):
                    data = json.loads(b["text"])
                    if isinstance(data, dict):
                        data = _pin_canon(obra_id, tool.name, data, field)
                        b["text"] = json.dumps(data, ensure_ascii=False, default=str)
                    break
        except Exception:  # noqa: BLE001
            pass  # pin é best-effort — nunca derruba a resposta
        return res

    tool.handler = _wrapped
    return tool


_MES_ABBR = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
             "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}


def _corte_iso(obra_id: str) -> str | None:
    """ISO (último dia do mês) do BM corte — do label 'Mês' na Curva por BM (C.3). Referência p/ derivar
    o farol dos marcos, IGUAL à tela C.5 (corteMesParaISO sobre o mês de corte). None se ausente."""
    bm = _bm_corte(obra_id)
    if bm is None:
        return None
    dados = _secao_dados(obra_id, "Curva por BM")
    if not isinstance(dados, list):
        return None
    for r in dados:
        if not isinstance(r, dict) or _rec_num(_pick(r, "BM")) != bm:
            continue
        m = re.match(r"([a-zç]{3})[\-/ ]?(\d{2,4})", str(_pick(r, "Mês", "mes") or "").strip().lower())
        if not m or m.group(1)[:3] not in _MES_ABBR:
            return None
        mes = _MES_ABBR[m.group(1)[:3]]
        ano = int(m.group(2))
        ano = 2000 + ano if ano < 100 else ano
        return f"{ano:04d}-{mes:02d}-{calendar.monthrange(ano, mes)[1]:02d}"
    return None


_MARCO_HORIZONTE_MESES = 12  # = MARCO_RISCO_HORIZONTE_MESES (marcoFarol.ts)


def _meses_entre(corte_iso: str, alvo_iso: str) -> float:
    cy, cm, cd = (int(x) for x in corte_iso.split("-"))
    ay, am, ad = (int(x) for x in alvo_iso[:10].split("-"))
    return (ay - cy) * 12 + (am - cm) + (ad - cd) / 30.44


def _status_marco(data_limite: Any, corte_iso: str | None, pct: float | None) -> str:
    """Status do marco DERIVADO (data-limite × corte + %), idêntico a statusMarco (marcoFarol.ts).
    A coluna `farol` gravada na ingestão é NÃO-confiável (parte clusters) — não usar."""
    if pct is not None and pct >= 100:
        return "cumprido"
    if not data_limite:
        return "pendente"
    if not corte_iso:
        return "no-prazo"
    m = _meses_entre(corte_iso, str(data_limite))
    if m < 0:
        return "atrasado"
    if m <= _MARCO_HORIZONTE_MESES:
        return "em-risco"
    return "no-prazo"


# Status do marco → nível de farol do DS (= MARCO_STATUS_TONE da tela C.5/Visão Geral).
_MARCO_STATUS_NIVEL = {
    "atrasado": "critico", "em-risco": "risco", "no-prazo": "conforme",
    "cumprido": "conforme", "pendente": "observacao",
}
_MARCO_STATUS_LABEL = {
    "atrasado": "Atrasado", "em-risco": "Em risco", "no-prazo": "No prazo",
    "cumprido": "Cumprido", "pendente": "—",
}


def build_adm_tools_server(obra_id: str, return_callables: bool = False):
    """Servidor MCP in-process com as tools da obra. `obra_id` vive na closure (chat = 1 contrato).

    `return_callables=True` devolve {nome: handler async} em vez do server — usado pelo GATE DE
    PARIDADE (scripts/parity_chat.py) p/ chamar cada tool isolada (sem subir o MCP nem a LLM) e
    comparar com o read-model da tela + o oráculo."""

    @tool(
        "get_faturamento_resumo",
        "Resumo de FATURAMENTO da obra: contratado total, realizado acumulado, avanço financeiro %, "
        "aderência vs previsto no corte, desvio (pp) e farol. Inclui o avanço FÍSICO (real/previsto/"
        "atraso pp) quando há cronograma. Use para 'como está o faturamento / quanto faturamos / saldo'.",
        {},
    )
    async def get_faturamento_resumo(args):  # noqa: ANN001
        # Fluxo Sorriso (cadeia de BMs em obra_medicoes) — coletar_fatos resolve com paridade golden.
        fatos = coletar_fatos(obra_id)
        fat = fatos.get("faturamento")
        if fat:
            out: dict[str, Any] = dict(fat)
            if fatos.get("fisico"):
                out["fisico"] = fatos["fisico"]
            out["_proveniencia"] = {
                "bm_corte": fat.get("bm_corte"),
                "tabelas": ["obra_medicoes", "obra_medicao_totais", "obra_faturamento_meses"],
                "nota": "realizado pela cadeia de BMs (autoritativo); aderência vs previsto pela Camada "
                "B (paridade golden com farol.ts). 'avanço financeiro' (% do contrato) ≠ 'aderência'.",
            }
            return _json(out)
        # Fluxo workbook-motor (sem obra_medicoes): o contratado TOTAL (PV) vem de obra_faturamento_curvas
        # e o headline conservado vem dos Cards C.3 (ACUMULADO + PERÍODO) — a MESMA fonte da tela
        # (getFaturamentoCurva + calcFaturamento). avanço financeiro = acumulado ÷ contratado total.
        curva = (
            supabase.table("obra_faturamento_curvas")
            .select("custo_total")
            .eq("contrato_id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        custo_total = _rec_num(curva[0].get("custo_total")) if curva else None
        ac = _secao_dados(obra_id, "C.3 — Cards de resumo · ACUMULADO")
        pe = _secao_dados(obra_id, "C.3 — Cards de resumo · PERÍODO")
        if not isinstance(ac, dict) or custo_total is None:
            return _pendente("Faturamento")
        real_acum = _rec_num(_pick(ac, "realAcumAteBM"))
        cont_acum = _rec_num(_pick(ac, "contratadoAcumAteBM"))
        pe = pe if isinstance(pe, dict) else {}
        farol_raw = str(_pick(pe, "farolAderenciaAcum") or "").strip()
        farol = farol_raw.lstrip("●○◌◍◆▲△ ").strip() or None
        return _json(
            {
                "contratado_total_rs": custo_total,
                "realizado_acumulado_rs": real_acum,
                "contratado_acumulado_rs": cont_acum,
                # avanço financeiro = % do CONTRATO já faturado (≠ aderência ao previsto-no-corte)
                "avanco_financeiro_real_frac": (real_acum / custo_total) if (real_acum is not None and custo_total) else None,
                "avanco_financeiro_contratado_frac": (cont_acum / custo_total) if (cont_acum is not None and custo_total) else None,
                "desvio_acumulado_rs": _rec_num(_pick(ac, "desvioAcumRS")),
                "desvio_acumulado_frac": _rec_num(_pick(ac, "desvioAcumPct")),  # FRAÇÃO: -0.54 = -54%
                "saldo_a_faturar_rs": _rec_num(_pick(ac, "saldoAFaturar")),
                "aderencia_no_periodo_frac": _rec_num(_pick(pe, "aderenciaNoPeriodo")),  # FRAÇÃO
                "farol": farol,
                "bm_corte": _bm_corte(obra_id),
                "faturado_no_mes_rs": _rec_num(_pick(pe, "faturadoNoMesBM")),
                "previsto_para_o_mes_rs": _rec_num(_pick(pe, "previstoParaOMes")),
                "ritmo_medio_3bm_rs": _rec_num(_pick(pe, "ritmoMedioRecente3BM")),
                "projecao_termino_mes": _rec_num(_pick(pe, "projecaoTerminoMesEarnedSchedule")),
                "alerta_prorrogacao": _pick(pe, "alertaDeProrrogacao"),
                "_nota": "desvio/aderência em FRAÇÃO (−0,54 = −54%). 'avanço financeiro real' = realizado "
                "acumulado ÷ contratado total (% do contrato faturado); 'aderência' = realizado ÷ previsto "
                "no corte. Projeção de término por Earned Schedule (mês).",
                "_proveniencia": {
                    "bm_corte": _bm_corte(obra_id),
                    "tabela": "obra_faturamento_curvas (PV) + obra_secoes Cards C.3 ACUM/PERÍODO (mesma fonte da tela)",
                },
            }
        )

    @tool(
        "get_produtividade_resumo",
        "Resumo de PRODUTIVIDADE FÍSICA (ex.: aço): kg por pessoa-hora (recomputado Σ/Σ) e avanço "
        "físico %. NÃO confunda com produtividade ECONÔMICA (R$/HH) nem com o índice de aderência.",
        {},
    )
    async def get_produtividade_resumo(args):  # noqa: ANN001
        # Fluxo aço/concreto (obra_produtividade · Sorriso) → coletar_fatos.
        fatos = coletar_fatos(obra_id)
        pr = fatos.get("produtividade")
        if pr:
            out: dict[str, Any] = dict(pr)
            out["_proveniencia"] = {
                "tabela": "obra_produtividade",
                "nota": "kg/Hh recomputado Σaço/Σpessoa-hora (não a média aritmética do dashboard XLSX)",
            }
            return _json(out)
        # Fluxo workbook-motor: tracker físico serviço×trecho (obra_produtividade_fisica) — MESMA fonte
        # da tela C.7 (produtividadeFisica.ts). Aderência física = real ÷ CPU por serviço medido.
        rows = (
            supabase.table("obra_produtividade_fisica")
            .select("disciplina, servico, trecho, unidade, qtd_contratada, qtd_medida, pct_fisico, "
                    "cpu_un_h, real_un_h, aderencia, farol")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("Produtividade física")
        params = (
            supabase.table("obra_produtividade_params")
            .select("ponte_pct_capacidade, ponte_pct_liberado, ponte_pct_aproveitamento, ponte_ociosidade_hh")
            .eq("contrato_id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        p = params[0] if params else {}
        medidos = [r for r in rows if _rec_num(r.get("aderencia")) is not None]
        ader = [_rec_num(r.get("aderencia")) for r in medidos]
        ader = [a for a in ader if a is not None]
        ader_media = round(sum(ader) / len(ader), 4) if ader else None
        piores = sorted(
            (r for r in medidos),
            key=lambda r: _rec_num(r.get("aderencia")) or 9,
        )[:3]
        out = {
            "n_servicos": len(rows),
            "n_servicos_medidos": len(medidos),
            "aderencia_fisica_media_frac": ader_media,  # real ÷ CPU (0..1)
            "ponte_pct_capacidade": _pct1(p.get("ponte_pct_capacidade")),  # utilização física (C.7 Sinais)
            "ponte_pct_liberado": _pct1(p.get("ponte_pct_liberado")),
            "ponte_pct_aproveitamento": _pct1(p.get("ponte_pct_aproveitamento")),
            "ociosidade_hh": _rec_num(p.get("ponte_ociosidade_hh")),
            "piores_servicos": [
                {
                    "servico": r.get("servico"),
                    "trecho": r.get("trecho"),
                    "aderencia_frac": _rec_num(r.get("aderencia")),
                    "farol": r.get("farol"),
                }
                for r in piores
            ],
            "status": "ok",
            "_nota": "PRODUTIVIDADE FÍSICA (real ÷ CPU por serviço×trecho). Para R$/HH use a econômica "
            "(get_produtividade_economica_resumo). aderência/capacidade em FRAÇÃO/% conforme o campo.",
            "_proveniencia": {
                "tabelas": ["obra_produtividade_fisica", "obra_produtividade_params (mesma fonte da tela C.7)"],
            },
        }
        return _json(out)

    @tool(
        "get_insumos_resumo",
        "Resumo dos INSUMOS DE FATURAMENTO DIRETO (v53 · PQ oficial Anexo C.04, valores c/ BDI): nº de "
        "insumos (30), valor de contrato total (fecha com a PQ), valor medido até o BM e quantos itens "
        "concentram 80% do valor (Curva ABC). Use para 'quantos insumos / quem concentra o custo / "
        "contrato de insumos'. Para variação de preço/repasse use get_insumos_excedente.",
        {},
    )
    async def get_insumos_resumo(args):  # noqa: ANN001
        fatos = coletar_fatos(obra_id)
        ins = fatos.get("insumos")
        if not ins:
            return _pendente("Insumos")
        out: dict[str, Any] = dict(ins)
        out["_nota"] = ("valor de CONTRATO c/ BDI da PQ (Anexo C.04) — não preço real pago; "
                        "medido = BM oficial (só brita+bica no BM03)")
        out["_proveniencia"] = {"tabela": "obra_insumos_fd (v53)"}
        return _json(out)

    @tool(
        "get_recursos_resumo",
        "Resumo do PLANO DE RECURSOS contratado (MOD = Mão de Obra Direta · MOI = Indireta · EQP = "
        "Equipamentos): por categoria, total contratado, pico de mobilização (maior efetivo num mês + "
        "rótulo), custo R$, nº de funções/itens e o real ALOCADO até o BM-corte. Use para 'quanto "
        "efetivo / quantas pessoas / pico de mão de obra / curva de mobilização / equipamentos'. "
        "ATENÇÃO: o TOTAL por categoria vem SEMPRE do histograma mensal (Σ obra_recursos_meses, "
        "completo) — NÃO da soma da lista por função (que pode ser PARCIAL, ex.: MOI detalha menos "
        "funções que o histograma → catalogoParcial). Unidade é homens·mês (MOD/MOI) ou unid.·mês "
        "(EQP), NÃO 'pessoas' instantâneas. Em obra pré-execução o eixo REAL vem null (temReal=false) "
        "→ é PENDENTE, nunca 0. O real só existe até o último mês medido; meses seguintes = null.",
        {},
    )
    async def get_recursos_resumo(args):  # noqa: ANN001
        # LER LIVE (vigência garante o estado atual; sem filtro de versão — igual ao read-model .ts).
        # Erro de leitura PROPAGA (não vira _pendente): _pendente é só "não normalizado".
        itens_rows = (
            supabase.table("obra_recursos")
            .select("ordem, categoria, recurso, contratado_qtde, real_qtde, contratado_rs, real_rs, status")
            .eq("contrato_id", obra_id)
            .order("categoria")
            .order("contratado_qtde", desc=True)
            .order("ordem")
            .execute()
            .data
            or []
        )
        meses_rows = (
            supabase.table("obra_recursos_meses")
            .select("categoria, ano, mes, periodo_label, contratado_qtde, real_qtde, contratado_rs, real_rs")
            .eq("contrato_id", obra_id)
            .order("ano")
            .order("mes")
            .execute()
            .data
            or []
        )
        # Pendente só se NÃO há nem lista por função nem histograma. A BR-101 tem só histograma
        # (obra_recursos_meses) — a lista por função (obra_recursos) é vazia; o corpo deriva os totais
        # do histograma (igual à tela C.4 · recursos.ts: catalogoAusente).
        if not itens_rows and not meses_rows:
            return _pendente("Recursos (MOD/MOI/EQP)")

        categorias: dict[str, Any] = {}
        for cat in _REC_ORDEM_CAT:
            meta = _REC_CAT_META[cat]
            cat_itens = [i for i in itens_rows if i.get("categoria") == cat]
            cat_meses = [m for m in meses_rows if m.get("categoria") == cat]

            # Totais AUTORITATIVOS do histograma mensal. Σ trata null como 0 no acumulado, mas o R$ só
            # entra (e marca temRs) quando NÃO-null — paridade 1:1 com recursos.ts.
            contratado_qtde = 0.0
            contratado_rs = 0.0
            tem_rs = False
            real_qtde = 0.0
            real_rs = 0.0
            pico_qtde = -1.0
            pico_label = "—"
            ult_mes_medido = None  # rótulo do último mês com real medido (corte do eixo real)
            serie_mensal: list[dict[str, Any]] = []
            for m in cat_meses:
                cq = _rec_num(m.get("contratado_qtde"))
                cr = _rec_num(m.get("contratado_rs"))
                rq = _rec_num(m.get("real_qtde"))
                rr = _rec_num(m.get("real_rs"))
                contratado_qtde += cq or 0.0
                if cr is not None:
                    contratado_rs += cr
                    tem_rs = True
                real_qtde += rq or 0.0
                real_rs += rr or 0.0
                cqv = cq or 0.0
                if cqv > pico_qtde:
                    pico_qtde = cqv
                    pico_label = m.get("periodo_label") or "—"
                if rq is not None or rr is not None:
                    ult_mes_medido = m.get("periodo_label")
                serie_mensal.append({
                    "ano": m.get("ano"),
                    "mes": m.get("mes"),
                    "periodoLabel": m.get("periodo_label"),
                    "contratadoQtde": cqv,
                    "contratadoRs": cr or 0.0,
                    # null PRESERVADO: mês não medido ≠ "0 medido" — o gráfico corta a linha aqui (PENDENTE ≠ 0).
                    "realQtde": rq,
                    "realRs": rr,
                })

            catalogo_qtde = sum((_rec_num(i.get("contratado_qtde")) or 0.0) for i in cat_itens)
            total_qtde = contratado_qtde if cat_meses else catalogo_qtde
            rs_por_item = any(_rec_num(i.get("contratado_rs")) is not None for i in cat_itens)
            tem_real = real_qtde > 0 or real_rs > 0

            categorias[cat] = {
                "categoria": cat,
                "label": meta["label"],
                "unidade": meta["unidade"],
                "plural": meta["plural"],
                "singular": meta["singular"],
                "nItens": len(cat_itens),
                # TOTAL contratado SEMPRE do histograma (Σ obra_recursos_meses) — não da lista por função.
                "contratadoQtde": round(total_qtde, 4),
                "contratadoRs": round(contratado_rs, 2) if tem_rs else None,
                "rsPorItem": rs_por_item,
                # Real alocado (Σ histograma até o medido); PENDENTE (null) se nada alocado — nunca 0 verde.
                "realQtde": round(real_qtde, 4) if tem_real else None,
                "realRs": round(real_rs, 2) if tem_real else None,
                "temReal": tem_real,
                "ultimoMesMedido": ult_mes_medido,
                # Pico de mobilização: maior efetivo contratado num mês + rótulo do mês.
                "picoQtde": round(pico_qtde, 4) if pico_qtde >= 0 else 0,
                "picoLabel": pico_label,
                # Σ da lista por função (pode ser < total se a lista for parcial — área-cega).
                "catalogoQtde": round(catalogo_qtde, 4),
                "catalogoParcial": (
                    len(cat_meses) > 0 and len(cat_itens) > 0 and abs(catalogo_qtde - total_qtde) > 0.5
                ),
                "serieMensal": serie_mensal,
            }

        status = "needs_review" if any(i.get("status") == "needs_review" for i in itens_rows) else "ok"
        tem_real_global = any(categorias[c]["temReal"] for c in _REC_ORDEM_CAT)

        # Ressalvas de conservação DERIVADAS (visíveis, não escondidas) — espelham recursos.ts.
        ressalvas: list[str] = []
        for c in _REC_ORDEM_CAT:
            r = categorias[c]
            if r["catalogoParcial"]:
                ressalvas.append(
                    f"{r['label']}: histograma soma {round(r['contratadoQtde'])}; "
                    f"lista por função detalha {round(r['catalogoQtde'])} (parcial)."
                )
            if r["contratadoRs"] is not None and not r["rsPorItem"]:
                ressalvas.append(
                    f"{r['label']}: custo R$ vem do histograma mensal (a fonte não traz R$ por função)."
                )

        out: dict[str, Any] = {
            "status": status,
            "nItensTotal": len(itens_rows),
            "temRealGlobal": tem_real_global,
            "ressalvas": ressalvas,
            "categorias": {c: categorias[c] for c in _REC_ORDEM_CAT},
            "_proveniencia": {
                "tabelas": ["obra_recursos_meses", "obra_recursos"],
                "nota": "TOTAL por categoria = Σ histograma mensal (obra_recursos_meses), NÃO a lista por "
                "função (catalogoParcial sinaliza divergência). Pico = maior efetivo contratado num mês. "
                "Real só até o último mês medido (ultimoMesMedido); meses seguintes = null (PENDENTE ≠ 0). "
                "temReal=false → eixo real PENDENTE (obra pré-execução). Unidade homens·mês / unid.·mês.",
            },
        }
        return _json(out)

    @tool(
        "buscar_secoes",
        "Busca SEÇÕES capturadas do(s) documento(s) da obra (planilha-motor) por termo no título e/ou "
        "código (ex.: C.5, D.4, aux_C.3). Devolve colunas + linhas VERBATIM do banco (números já "
        "conservados pelos gates). Use para perguntas estruturais ('tabela de X', 'composição de Y'). "
        "ATENÇÃO: NÃO é o TEXTO do contrato/cláusulas (esse ainda não está no banco).",
        {"consulta": str},
    )
    async def buscar_secoes(args):  # noqa: ANN001
        consulta = (args.get("consulta") or "").strip()
        q = (
            supabase.table("obra_secoes")
            .select("codigo, titulo, modulo, tipo, colunas, dados, n_linhas, coberta")
            .eq("contrato_id", obra_id)
            .eq("tem_dado", True)
        )
        if consulta:
            # casa no título OU no código (o modelo passa um termo natural ou um código)
            q = q.or_(f"titulo.ilike.%{consulta}%,codigo.ilike.%{consulta}%")
        rows = q.order("ordem").limit(8).execute().data or []
        if not rows:
            return _json(
                {
                    "encontrado": False,
                    "motivo": "Nenhuma seção bate o filtro. Lembrete: o TEXTO do contrato/cláusulas "
                    "ainda NÃO está no banco — só seções de planilha (C.x/D.x/B.x).",
                }
            )
        # corta tabelas gigantes (ex.: heatmap 12×46) p/ não estourar o contexto
        for r in rows:
            d = r.get("dados")
            if isinstance(d, list) and len(d) > 40:
                r["dados"] = d[:40]
                r["_truncado"] = f"{len(d)} linhas no total; mostrando as 40 primeiras"
        return _json(
            {
                "encontrado": True,
                "n": len(rows),
                "secoes": rows,
                "_proveniencia": {"tabela": "obra_secoes", "obra_id": obra_id},
            }
        )

    @tool(
        "get_marcos_contratuais",
        "MARCOS CONTRATUAIS da obra (C.5): cada marco com categoria/trecho, DATA-LIMITE contratual, "
        "% concluído e farol — mais a contagem por farol e quantos estão em Risco/Crítico. Use para "
        "'quais os marcos / datas-limite / entregas intermediárias / quantos marcos em risco'. "
        "ATENÇÃO: o '% concluído' é INPUT por BM e fica null (PENDENTE, NUNCA 0) até a obra medir — não "
        "afirme avanço de marco se 'pctConcluidoPendente' for true. O farol de cada marco vem JÁ "
        "RESOLVIDO do banco (texto tipo '● Crítico' / 'Em risco' / '○ No prazo'); o nível é "
        "classificado por substring, EXATAMENTE como a aba Prazo (farolMarcoNivel). NÃO confunda estes "
        "marcos (C.5, datas-limite CONTRATUAIS) com os marcos do cronograma-fonte MS Project "
        "(get_marcos_cronograma_fonte, datas PLANEJADAS por EDT). NÃO há atraso físico aqui — isso é "
        "Camada B (calcPrazo, sem tabela), pendente de outra leva.",
        {},
    )
    async def get_marcos_contratuais(args):  # noqa: ANN001
        # Farol do marco DERIVADO (data-limite × corte + %), IGUAL à tela C.5/Visão Geral (statusMarco).
        # A coluna `farol` do banco é não-confiável (parte clusters: dizia 3 em risco; o correto são 5).
        # LER LIVE: vigência garante o estado atual; sem filtro de versão — igual a getPrazoMarcos.ts.
        rows = (
            supabase.table("obra_prazo_marcos")
            .select("ordem, categoria, trecho, data_limite, pct_concluido")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("Marcos contratuais (C.5)")
        corte_iso = _corte_iso(obra_id)

        marcos: list[dict[str, Any]] = []
        contagem = {"conforme": 0, "observacao": 0, "risco": 0, "critico": 0}
        algum_pct = False
        for r in rows:
            pct = r.get("pct_concluido")
            # % concluído é INPUT por BM → null PRESERVADO (PENDENTE ≠ 0).
            pct_v = float(pct) if pct is not None else None
            if pct_v is not None:
                algum_pct = True
            status = _status_marco(r.get("data_limite"), corte_iso, pct_v)
            nivel = _MARCO_STATUS_NIVEL[status]
            contagem[nivel] += 1
            marcos.append({
                "ordem": int(r.get("ordem") or 0),
                "categoria": str(r["categoria"]) if r.get("categoria") is not None else None,
                "trecho": str(r["trecho"]) if r.get("trecho") is not None else None,
                "dataLimite": str(r["data_limite"]) if r.get("data_limite") is not None else None,
                "pctConcluido": pct_v,
                "status": _MARCO_STATUS_LABEL[status],  # "Em risco" | "No prazo" | "Atrasado" | …
                "nivel": nivel,
            })

        out: dict[str, Any] = {
            "nMarcos": len(marcos),
            "marcos": marcos,
            "contagemFarol": contagem,
            "nRiscoOuCritico": contagem["risco"] + contagem["critico"],
            # true quando NENHUM marco tem % concluído medido — não invente avanço de marco.
            "pctConcluidoPendente": not algum_pct,
            "_proveniencia": {
                "tabela": "obra_prazo_marcos",
                "obra_id": obra_id,
                "nota": "datas-limite CONTRATUAIS (C.5); % concluído por BM (null = pendente, nunca 0). "
                f"Farol DERIVADO de data-limite × corte ({corte_iso or 'corte desconhecido'}) + %, "
                "horizonte 12 meses (em risco se vence dentro do horizonte e não-concluído) — paridade "
                "1:1 com statusMarco da aba Prazo/Visão Geral. NÃO usa a coluna `farol` (parte clusters).",
            },
        }
        return _json(out)

    @tool(
        "get_marcos_cronograma_fonte",
        "Marcos e TÉRMINO PLANEJADO do CRONOGRAMA-FONTE (MS Project · tarefas por EDT). Devolve: "
        "'terminoPlanejado' = MAIOR data_termino de TODAS as tarefas (= término planejado da obra), os "
        "marcos (tarefas de duração 0, ordenados por data de término) e o total de tarefas. Use para "
        "'quando termina a obra (plano) / qual o cronograma / marcos do MS Project / caminho crítico'. "
        "ATENÇÃO: estes marcos têm datas PLANEJADAS (por EDT, do .mpp) — NÃO confunda com os marcos "
        "CONTRATUAIS C.5 (get_marcos_contratuais, datas-LIMITE). A execução por marco NÃO é rastreada "
        "aqui (não afirme cumprido/atrasado por marco). 'terminoPlanejado' é o término do PLANO, não o "
        "término do CONTRATO nem a TENDÊNCIA (essa é Camada B / calcPrazo, sem tabela — fora desta tool).",
        {},
    )
    async def get_marcos_cronograma_fonte(args):  # noqa: ANN001
        # LER LIVE: sem filtro de versão (espelha getCronogramaTarefas · cronograma.ts). Erro PROPAGA.
        # 1ª leitura: todas as data_termino → nTarefas + MAX(data_termino) computado em Python (ISO
        # 'YYYY-MM-DD' ordena lexicograficamente == .order('data_termino', desc) do read-model).
        todas = (
            supabase.table("obra_cronograma_tarefas")
            .select("data_termino")
            .eq("contrato_id", obra_id)
            .execute()
            .data
            or []
        )
        if not todas:
            return _pendente("Cronograma-fonte (MS Project · tarefas/marcos)")
        n_tarefas = len(todas)
        # MAIOR data_termino ignorando null (PENDENTE ≠ 0); == read-model que filtra not.is.null.
        datas = [str(r["data_termino"]) for r in todas if r.get("data_termino") is not None]
        termino_planejado = max(datas) if datas else None

        # Marcos = tarefas duração 0 dias (eh_marco), ordenados por data de término (asc), como a aba.
        marcos_rows = (
            supabase.table("obra_cronograma_tarefas")
            .select("numero_item, nome, data_termino")
            .eq("contrato_id", obra_id)
            .eq("eh_marco", True)
            .order("data_termino")
            .execute()
            .data
            or []
        )
        marcos = [
            {
                "numeroItem": r.get("numero_item"),
                "nome": str(r["nome"]) if r.get("nome") is not None else "—",
                "dataTermino": str(r["data_termino"]) if r.get("data_termino") is not None else None,
            }
            for r in marcos_rows
        ]

        out: dict[str, Any] = {
            "terminoPlanejado": termino_planejado,
            "nMarcos": len(marcos),
            "marcos": marcos,
            "nTarefas": n_tarefas,
            "_proveniencia": {
                "tabela": "obra_cronograma_tarefas",
                "obra_id": obra_id,
                "nota": "terminoPlanejado = MAIOR data_termino de todas as tarefas (term. do PLANO, "
                "não do contrato nem tendência). Marcos = eh_marco (duração 0); datas PLANEJADAS por "
                "EDT — execução por marco não rastreada. Atraso/tendência é Camada B (calcPrazo), fora daqui.",
            },
        }
        return _json(out)

    @tool(
        "get_desequilibrio_resumo",
        "ÂNCORA D.0 — Painel de Desequilíbrio econômico-financeiro: total (R$) e a COMPOSIÇÃO por "
        "categoria (D.1 Indiretos, D.2 BDI, D.3 Encargos, D.4 Produtividade, D.5 Insumos, D.6 "
        "Pontuais, D.7 Atraso, D.8 Pleitos) com valor e % do total. Σ categorias = desequilíbrio "
        "total — é a referência cruzada das telas D.x. Use para 'qual o desequilíbrio / quanto a "
        "obra está desequilibrada / o que mais pesa no desequilíbrio'. ATENÇÃO: o desequilíbrio do "
        "BDI (D.2) é UMA categoria daqui — NÃO confunda com o markup do BDI contratual (buildup C.1, "
        "em get_bdi_buildup), que é outra coisa.",
        {},
    )
    async def get_desequilibrio_resumo(args):  # noqa: ANN001
        # FONTE CANÔNICA = obra_secoes D.0 Bloco 2, coluna "Valor (R$)", SEM override por categoria —
        # a D.4 usa o 736.740,88 da própria Bloco 2 (Total Cost do período). Σ categorias = R$ 6.287.068,
        # o total que o workbook DECLARA (confirmado pela Σ E pelo "% sobre valor contratual" 1,0284% da
        # Bloco 1). MESMA computação do read-model da tela (desequilibrio.ts) → chat == tela == fonte.
        # (Histórico: já houve override do D.4 p/ o "ajustado" 5,96mi → total 11,5mi; DESCARTADO — esse
        # número não existe na fonte.) A tabela obra_desequilibrio está defasada (antiga) — NÃO usar.
        b2 = _secao_dados(obra_id, "D.0 — Bloco 2")
        if not isinstance(b2, list) or not b2:
            # dialeto SBSO: "D.0 — Composição do Desequilíbrio por Categoria (Bloco 2 · Tab 6.2)"
            # — fragmento multi-% (mesma técnica do read-model desequilibrioPainel do front).
            b2 = _secao_dados(obra_id, "D.0%Bloco 2")
        if not isinstance(b2, list) or not b2:
            return _pendente("Desequilíbrio (Painel D.0)")
        cat_nome = {
            "D.1": "Custos Indiretos", "D.2": "BDI", "D.3": "Encargos Sociais",
            "D.4": "Perda de Produtividade", "D.6": "Eventos Pontuais",
            "D.7": "Atraso de Pagamento", "D.8": "Pleitos Pontuais",
        }
        categorias: list[dict] = []
        for r in b2:
            if not isinstance(r, dict):
                continue
            tela = str(_pick(r, "tela") or "").strip()
            if not tela:
                continue
            categoria = str(_pick(r, "categoria (natureza)", "categoria") or cat_nome.get(tela, tela)).strip()
            valor = _rec_num(_pick(r, "valor (r$)", "valor"))
            categorias.append({"categoria": categoria, "tela": tela, "valor_rs": valor})
        # Σ ignora null como 0 (paridade com `c.valorRs ?? 0` do read-model) — total é a âncora.
        total_rs = round(sum((c["valor_rs"] or 0.0) for c in categorias), 2)
        for c in categorias:
            c["pct_do_total"] = (
                (c["valor_rs"] / total_rs) if (total_rs > 0 and c["valor_rs"] is not None) else None
            )
        n_com_valor = sum(1 for c in categorias if (c["valor_rs"] or 0.0) > 0)
        out: dict[str, Any] = {
            "total_rs": total_rs,
            "n_categorias": len(categorias),
            "n_com_valor": n_com_valor,
            "status": "ok",
            "categorias": categorias,
        }
        out["_proveniencia"] = {
            "tabelas": ["obra_secoes · D.0 Bloco 2 (mesma fonte da tela)"],
            "nota": "composição do Painel D.0 — coluna Valor (R$) por categoria, SEM override (a D.4 = "
            "Total Cost do período da própria Bloco 2). Σ categorias = desequilíbrio total ≈ R$ 6.287.068. "
            "pct_do_total é fração 0..1.",
        }
        return _json(out)

    @tool(
        "get_orcamento_resumo",
        "Resumo do ORÇAMENTO baseline (referência de PREÇO/CUSTO p/ Desequilíbrio e BDI): preço de "
        "venda (Σ BASE1), custo direto, custo indireto, custo total das atividades, receita e o BDI "
        "(markup = preço-venda / custo, ex.: 1,24465 = 24,47%). Use para 'qual o valor do contrato/"
        "orçamento / preço de venda / custo da obra / qual o BDI'. ⚠️ GATE: se status='needs_review', "
        "o gate de conservação (Σ itens ≠ preço-venda) NÃO fechou — preço-venda/BDI NÃO são confiáveis; "
        "avise o usuário e NÃO afirme os números como fechados.",
        {},
    )
    async def get_orcamento_resumo(args):  # noqa: ANN001
        # LIVE: pega a normalização mais recente (vigência garante o estado atual), igual ao read-model.
        orcs = (
            supabase.table("obra_orcamentos")
            .select(
                "id, preco_venda, custo_direto, custo_indireto, custo_total_atividades, "
                "receita, bdi, status"
            )
            .eq("contrato_id", obra_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not orcs:
            return _pendente("Orçamento")
        o = orcs[0]
        n_itens = (
            supabase.table("obra_orcamento_itens")
            .select("id", count="exact", head=True)
            .eq("orcamento_id", o["id"])
            .execute()
            .count
            or 0
        )
        num = lambda v: float(v) if v is not None else None  # noqa: E731
        out: dict[str, Any] = {
            "preco_venda": num(o.get("preco_venda")),
            "custo_direto": num(o.get("custo_direto")),
            "custo_indireto": num(o.get("custo_indireto")),
            "custo_total_atividades": num(o.get("custo_total_atividades")),
            "receita": num(o.get("receita")),
            "bdi": num(o.get("bdi")),
            "status": o["status"],
            "n_itens": n_itens,
            "confiavel": o["status"] == "ok",
        }
        out["_proveniencia"] = {
            "tabelas": ["obra_orcamentos", "obra_orcamento_itens"],
            "nota": "orçamento é entidade INDEPENDENTE com gate próprio; status='needs_review' = "
            "Σ(itens BASE1) ≠ preço-venda não fechou → preço-venda/BDI sob suspeita. bdi é o MARKUP "
            "(preço-venda/custo, ex.: 1.24465), não percentual; (bdi-1) é o % do BDI.",
        }
        return _json(out)

    @tool(
        "get_bdi_buildup",
        "Composição (buildup) do BDI CONTRATUAL — C.1 FONTE-MÃE: as rubricas da proposta (descrição, "
        "%receita, %custo-direto, valor R$) e o MARKUP TOTAL = Σ das FOLHAS (sem somar subtotais, p/ "
        "evitar double-count). Use para 'como é composto o BDI / quais as rubricas do BDI / quanto de "
        "imposto/despesa indireta entra no BDI'. ⚠️ Isto é o MARKUP da proposta — NÃO é o "
        "desequilíbrio do BDI (D.2): o Δ do BDI vive só no Painel D.0 (get_desequilibrio_resumo). "
        "markup ≠ desequilíbrio.",
        {},
    )
    async def get_bdi_buildup(args):  # noqa: ANN001
        rows = (
            supabase.table("obra_bdi_rubricas")
            .select("ordem, descricao, pct_receita, pct_custo_direto, valor_rs, eh_subtotal, status")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("BDI (buildup C.1)")
        num = lambda v: float(v) if v is not None else None  # noqa: E731
        rubricas = [
            {
                "ordem": int(r["ordem"]),
                "descricao": r["descricao"],
                "pct_receita": num(r.get("pct_receita")),
                "pct_custo_direto": num(r.get("pct_custo_direto")),
                "valor_rs": num(r.get("valor_rs")),
                "eh_subtotal": bool(r.get("eh_subtotal")),
            }
            for r in rows
        ]
        # markup = Σ APENAS das folhas (eh_subtotal=False) — não double-count com os subtotais.
        markup_total = sum(
            (rb["valor_rs"] or 0.0) for rb in rubricas if not rb["eh_subtotal"]
        )
        status = "needs_review" if any(r["status"] != "ok" for r in rows) else "ok"
        out: dict[str, Any] = {
            "markup_total": markup_total,
            "n_rubricas": len(rubricas),
            "status": status,
            "rubricas": rubricas,
        }
        out["_proveniencia"] = {
            "tabelas": ["obra_bdi_rubricas"],
            "nota": "markup_total = Σ das FOLHAS (eh_subtotal=false); subtotais ('Despesas "
            "Indiretas+Impostos', 'Impostos') NÃO entram na soma (double-count). É o markup da "
            "PROPOSTA — o desequilíbrio do BDI (D.2) está só no Painel D.0, não aqui.",
        }
        return _json(out)

    @tool(
        "get_curvas_resumo",
        "Resumo das CURVAS C.8 (Liberação x Capacidade x Alocado): os 3 % vs contratado-no-corte "
        "(liberado / capacidade produtiva / alocado=executado), os acumulados em R$ no corte e o MAIOR "
        "GAP entre as curvas (R$) — ou seja, ONDE esta o gargalo da producao. Tambem traz a matriz por "
        "FRENTE (contratado, produtividade economica R$/HH, gap dominante, responsabilidade preliminar). "
        "Use para 'onde esta o gargalo / liberacao vs capacidade / curva de liberacao / por frente'. "
        "ATENCAO: 'alocado %' (=executado/contratado) e o avanco FINANCEIRO do contrato, NAO e a aderencia "
        "vs previsto (isso e faturamento). 'produtividade R$/HH' por frente e ECONOMICA, nao a fisica kg/Hh.",
        {},
    )
    async def get_curvas_resumo(args):  # noqa: ANN001
        # Estado VIGENTE: normalizacao mais recente (espelha getCurvasC8/.order created_at desc.limit(1)).
        c8 = (
            supabase.table("obra_curvas_c8")
            .select(
                "contratado_acum_corte, liberado_acum, capacidade_acum, executado_acum, "
                "maior_gap_rs, liberacao_pct, capacidade_pct, alocado_pct, status"
            )
            .eq("contrato_id", obra_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not c8:
            return _pendente("Curvas C.8 (Liberacao x Capacidade x Alocado)")
        r = c8[0]

        def _num(v):  # noqa: ANN001, ANN202
            return float(v) if v is not None else None

        def _pct(v):  # frac 0..1 no banco -> % (espelha pct() do read-model)  # noqa: ANN001, ANN202
            return round(float(v) * 100, 2) if v is not None else None

        out: dict[str, Any] = {
            "liberacao_pct": _pct(r.get("liberacao_pct")),
            # CAPACIDADE sob auditoria: o valor normalizado diverge (≈17% vs ~70% esperado · bug conhecido
            # da normalização C.8) → NÃO citar (PENDENTE ≠ valor errado). A Visão Geral também a exclui.
            "capacidade_pct": None,
            "alocado_pct": _pct(r.get("alocado_pct")),
            "contratado_acum_corte_rs": _num(r.get("contratado_acum_corte")),
            "liberado_acum_rs": _num(r.get("liberado_acum")),
            "capacidade_acum_rs": None,
            "executado_acum_rs": _num(r.get("executado_acum")),
            "maior_gap_rs": _num(r.get("maior_gap_rs")),
            "capacidade_nota": "capacidade sob auditoria (valor normalizado diverge) — não citar até reconciliar",
            "status_normalizacao": str(r.get("status") or "ok"),
        }
        # Onde esta o gargalo: a curva mais baixa entre Liberacao e Alocado (capacidade fora — sob auditoria).
        gargalos = {k: out[f"{k}_pct"] for k in ("liberacao", "alocado")
                    if out.get(f"{k}_pct") is not None}
        out["curva_mais_baixa"] = min(gargalos, key=gargalos.get) if gargalos else None

        # Matriz por FRENTE (C.8 Responsabilidade x gargalo) — [] se nao normalizado (sub-bloco opcional).
        frentes = (
            supabase.table("obra_curvas_frentes")
            .select("ordem, frente, contratado_rs, produtividade_rs_hh, gap_dominante_rs, responsabilidade")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        if frentes:
            out["frentes"] = [
                {
                    "ordem": int(f.get("ordem") or 0),
                    "frente": str(f.get("frente") or ""),
                    "contratado_rs": _num(f.get("contratado_rs")),
                    "produtividade_rs_hh": _num(f.get("produtividade_rs_hh")),
                    "gap_dominante_rs": _num(f.get("gap_dominante_rs")),
                    "responsabilidade": (str(f["responsabilidade"])
                                         if f.get("responsabilidade") is not None else None),
                }
                for f in frentes
            ]
            out["n_frentes"] = len(frentes)
        out["_proveniencia"] = {
            "tabelas": ["obra_curvas_c8", "obra_curvas_frentes"],
            "nota": "pcts no banco sao fracao 0..1 (x100 = %); 'alocado %' = avanco financeiro do "
            "contrato, NAO aderencia vs previsto; 'produtividade R$/HH' por frente e ECONOMICA, nao "
            "a fisica kg/Hh. executado_acum cruza com o faturamento real (gate).",
        }
        return _json(out)

    @tool(
        "get_mapa_liberacao_resumo",
        "Resumo do MAPA DA OBRA (C.14): as frentes FISICAS por tipo, Σ LIBERADO e Σ IMPEDIDO em R$ no BM "
        "de corte, faixa de km coberta pelos TRECHOS de pista, quantos segmentos estao 'Nao iniciado', "
        "por_tipo (nº+R$ por tipo) e a lista de segmentos com status/liberado/impedido/causa. As frentes "
        "tem 5 TIPOS: trecho (pista/duplicacao) · oae · dispositivo · talude · geodreno. Use para 'mapa "
        "da obra / quais/quantas frentes / quantas OAEs ou taludes / liberacao por km / quanto liberado/"
        "impedido / onde travou'. ATENCAO: soma_valor_rs = Σ TODAS as frentes fisicas (obra fisica), que "
        "NAO e o Contratado Total (C.3) — este inclui itens TRANSVERSAIS sem km, fora desta tabela.",
        {},
    )
    async def get_mapa_liberacao_resumo(args):  # noqa: ANN001
        rows = (
            supabase.table("obra_mapa_segmentos")
            .select(
                "ordem, seg_codigo, item_nome, tipo, km_inicio, km_fim, mes_lib_prevista, "
                "mes_lib_real, imped_mes_inicio, imped_mes_fim, valor_contrato_rs, bm_corrente, "
                "status_bm, liberado_rs, impedido_rs, causa_impedimento"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("Mapa da obra por km (C.14)")

        def _num(v):  # noqa: ANN001, ANN202
            return float(v) if v is not None else None

        # 5 tipos REAIS de frente (espelha FrenteTipo de mapaSegmentos.ts); desconhecido → 'trecho'.
        _MAPA_TIPOS = {"trecho", "oae", "dispositivo", "talude", "geodreno"}

        def _tipo(r):  # noqa: ANN001, ANN202
            t = str(r.get("tipo") or "").lower()
            return t if t in _MAPA_TIPOS else "trecho"

        segmentos = [
            {
                "ordem": int(r.get("ordem") or 0),
                "seg_codigo": str(r.get("seg_codigo") or ""),
                "item_nome": str(r.get("item_nome") or ""),
                "tipo": _tipo(r),  # trecho | oae | dispositivo | talude | geodreno (NÃO achatar)
                "eh_pista": _tipo(r) == "trecho",  # só 'trecho' é impedível por faixa de km
                "km_inicio": float(r.get("km_inicio") or 0),
                "km_fim": float(r.get("km_fim") or 0),
                "mes_lib_prevista": _num(r.get("mes_lib_prevista")),
                "mes_lib_real": _num(r.get("mes_lib_real")),
                "imped_mes_inicio": _num(r.get("imped_mes_inicio")),
                "imped_mes_fim": _num(r.get("imped_mes_fim")),
                "valor_contrato_rs": float(r.get("valor_contrato_rs") or 0),
                "status_bm": (str(r["status_bm"]) if r.get("status_bm") is not None else None),
                "liberado_rs": _num(r.get("liberado_rs")),
                "impedido_rs": _num(r.get("impedido_rs")),
                "causa_impedimento": (str(r["causa_impedimento"])
                                      if r.get("causa_impedimento") is not None else None),
            }
            for r in rows
        ]
        # Faixa de km = trechos de PISTA (tipo='trecho') ordenados por km_inicio (espelha getMapaFrentes).
        trechos = sorted((s for s in segmentos if s["tipo"] == "trecho"),
                         key=lambda s: s["km_inicio"])
        # quebra por tipo (nº + Σ R$) — responde "quantas OAEs / quanto em taludes / por tipo de frente".
        por_tipo: dict[str, dict] = {}
        for s in segmentos:
            d = por_tipo.setdefault(s["tipo"], {"n": 0, "valor_rs": 0.0})
            d["n"] += 1
            d["valor_rs"] = round(d["valor_rs"] + s["valor_contrato_rs"], 2)
        # bm_corrente: primeiro nao-nulo (read-model usa .find(v != null)).
        bm = next((_num(r.get("bm_corrente")) for r in rows if r.get("bm_corrente") is not None), None)
        out: dict[str, Any] = {
            "bm_corte": int(bm) if bm is not None else None,
            "n_segmentos": len(segmentos),
            "n_trechos": len(trechos),
            # Σ ignora null (None -> 0 SO na soma, espelha (s.liberadoRs ?? 0)); valor sempre presente.
            "soma_liberado_rs": round(sum(s["liberado_rs"] or 0 for s in segmentos), 2),
            "soma_impedido_rs": round(sum(s["impedido_rs"] or 0 for s in segmentos), 2),
            "soma_trechos_rs": round(sum(s["valor_contrato_rs"] for s in trechos), 2),  # só a pista (duplicação)
            "soma_valor_rs": round(sum(s["valor_contrato_rs"] for s in segmentos), 2),  # Σ TODAS as frentes físicas
            "por_tipo": por_tipo,
            "km_faixa_inicio": trechos[0]["km_inicio"] if trechos else None,
            "km_faixa_fim": trechos[-1]["km_fim"] if trechos else None,
            "nao_iniciados_qtd": sum(1 for s in segmentos if s["status_bm"] == "Não iniciado"),
            "segmentos": segmentos,
        }
        out["_proveniencia"] = {
            "bm_corte": out["bm_corte"],
            "tabelas": ["obra_mapa_segmentos"],
            "nota": "5 tipos REAIS de frente: trecho (pista/duplicação) · oae · dispositivo · talude · "
            "geodreno — NÃO achatar. soma_valor_rs = Σ TODAS as frentes físicas (= obra física); NÃO é o "
            "Contratado Total (C.3), que inclui itens TRANSVERSAIS sem km (fora desta tabela). "
            "soma_trechos_rs = só a pista (tipo='trecho'). Liberado/Impedido sao "
            "derivaveis (mes lib. real + janela de impedimento + BM), ja conferidos pelo gate. Status/Σ "
            "valem no BM de corte; meses futuros sao projecao, nao 'real'.",
        }
        return _json(out)

    @tool(
        "get_chuvas_resumo",
        "Resumo de CHUVAS (C.9 · análise pluviométrica) da obra a céu aberto: R$ impedido por chuva/"
        "força maior, R$ liberado, nº de frentes ainda NÃO iniciadas, sinistro/impedimento principal "
        "(ex.: 'Sinistro Talude 148+700 Sul'), chuva prevista total (mm), a série mensal (prev × real, "
        "dias parados, dias previstos >5mm, farol) E o headline 'dias_a_cobrar' (dias >5mm reais que "
        "excederam a proposta + pleiteavel_rs). Use para 'impacto da chuva / quanto a chuva impediu / "
        "frentes paradas / dias parados / dias a cobrar / pleiteável por chuva'. ATENÇÃO: separe os dois "
        "eixos — a CHUVA em MM real é INPUT (se eixo_real_vazio=true é PENDENTE, NÃO zero), MAS os DIAS "
        ">5mm reais (RDO) EXISTEM e alimentam dias_a_cobrar (não diga que 'o real é pendente' ao falar de "
        "dias a cobrar). Não confunda 'impedido' (R$ travado por chuva) com 'liberado' (R$ p/ execução).",
        {},
    )
    async def get_chuvas_resumo(args):  # noqa: ANN001
        # LER LIVE: resumo = normalização mais recente (1 row), série = todas as linhas por ordem.
        # Erro de leitura PROPAGA (.execute() levanta APIError) — _pendente é só 'não normalizado'.
        head_rows = (
            supabase.table("obra_chuvas")
            .select(
                "impedido_total_rs, liberado_total_rs, frentes_nao_iniciadas, "
                "principal_impedido, chuva_prev_total, eixo_real_vazio, status"
            )
            .eq("contrato_id", obra_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        meses_rows = (
            supabase.table("obra_chuvas_meses")
            .select(
                "ordem, mes_obra, periodo, chuva_prev_mm, chuva_real_mm, chuva_prev_acum, "
                "chuva_real_acum, dias_parados, dias_prev_5mm, farol"
            )
            .eq("contrato_id", obra_id)
            .order("ordem", desc=False)
            .execute()
            .data
            or []
        )
        head = head_rows[0] if head_rows else None
        # Espelha o read-model .ts: null só quando NÃO há resumo NEM série → não normalizado.
        if not head and not meses_rows:
            return _pendente("Chuvas (C.9)")

        head = head or {}
        # eixo_real_vazio: paridade com o .ts (head?.eixo_real_vazio !== false). Default do banco é true.
        # NOTA: é o eixo de CHUVA (mm) que fica pendente — os DIAS >5mm reais (RDO) existem (ver abaixo).
        eixo_real_vazio = head.get("eixo_real_vazio") is not False

        # DIAS A COBRAR (headline da C.9) — a tabela obra_chuvas_meses NÃO traz a coluna "Dias >5mm
        # REAL (RDO)"; ela vive na seção obra_secoes "C.9 — Acompanhamento mensal" (a MESMA fonte da
        # tela chuvasPainel.ts). Computa idêntico ao read-model: sobre os meses COM dias-real medido,
        # dias_a_cobrar = Σ max(0, real − proposta). (BR-101: mar 4, abr 4, mai 5 vs prop 5/5/3 → 2.)
        acomp = _secao_dados(obra_id, "C.9 — Acompanhamento mensal")
        dias_a_cobrar = dias_real_acum = dias_proposta_acum = None
        n_meses_dias_reais = 0
        if isinstance(acomp, list) and acomp:
            com_real = []
            for ar in acomp:
                if not isinstance(ar, dict):
                    continue
                real = _rec_num(_pick(ar, "Dias >5mm REAL (RDO)", "real (rdo", ">5mm real"))
                if real is None:
                    continue
                prop = _rec_num(_pick(ar, "Dias >5mm PROPOSTA", "proposta")) or 0.0
                com_real.append((prop, real))
            if com_real:
                dias_proposta_acum = sum(p for p, _ in com_real)
                dias_real_acum = sum(rl for _, rl in com_real)
                dias_a_cobrar = sum(max(0.0, rl - p) for p, rl in com_real)
                n_meses_dias_reais = len(com_real)
        # R$ pleiteável por chuva (MOD+EQP) — mesma seção auxiliar que a tela usa em `totais`.
        chuva_tot = _secao_dados(obra_id, "auxiliar_D.6 Chuva — Totais")
        if isinstance(chuva_tot, list) and chuva_tot:
            chuva_tot = chuva_tot[0]
        pleiteavel_rs = (
            _rec_num(_pick(chuva_tot, "pleiteável (mod + eqp)", "(mod + eqp)"))
            if isinstance(chuva_tot, dict) else None
        )

        out: dict[str, Any] = {
            "impedido_total_rs": head.get("impedido_total_rs"),
            "liberado_total_rs": head.get("liberado_total_rs"),
            "frentes_nao_iniciadas": head.get("frentes_nao_iniciadas"),
            "principal_impedido": head.get("principal_impedido"),
            "chuva_prev_total": head.get("chuva_prev_total"),
            "eixo_real_vazio": eixo_real_vazio,
            # chuva real EM MM / dias parados são INPUT: pendentes (null, NUNCA 0) enquanto não medidos.
            "chuva_real_pendente": eixo_real_vazio,
            # DIAS >5mm reais (RDO) — estes EXISTEM (≠ chuva mm). Headline "dias a cobrar" da C.9.
            "dias_a_cobrar": dias_a_cobrar,
            "dias_real_acum": dias_real_acum,
            "dias_proposta_acum": dias_proposta_acum,
            "delta_net_dias": (
                dias_real_acum - dias_proposta_acum
                if (dias_real_acum is not None and dias_proposta_acum is not None) else None
            ),
            "n_meses_dias_reais": n_meses_dias_reais,
            "pleiteavel_rs": pleiteavel_rs,
            "meses": meses_rows,
            "n_meses": len(meses_rows),
            "status": head.get("status") or "ok",
        }
        out["_proveniencia"] = {
            "tabelas": ["obra_chuvas", "obra_chuvas_meses", "obra_secoes · C.9 Acompanhamento (dias a cobrar)"],
            "obra_id": obra_id,
            "nota": "DOIS eixos distintos: (1) CHUVA em mm — prevista = baseline histórico, real é INPUT; "
            "se eixo_real_vazio=true a chuva-mm real é PENDENTE (null, não 0). (2) DIAS >5mm reais (RDO) — "
            "ESTES existem e geram 'dias_a_cobrar' = Σ max(0, real−proposta) sobre meses medidos (mesma "
            "fonte/fórmula da tela C.9: seção 'C.9 — Acompanhamento mensal'). Não dizer que 'o real é "
            "pendente' ao falar de dias a cobrar. 'impedido' (R$ travado por chuva) ≠ 'liberado'.",
        }
        return _json(out)

    @tool(
        "get_panorama",
        "PANORAMA consolidado da obra (C.10): farol consolidado + as 6 dimensões de farol (Projetos, "
        "Interferências, Liberações de Área, Clima/Força Maior, Preços/Quantidades, Suprimentos), "
        "quais estão em RISCO/CRÍTICO, % de áreas liberadas, dias parados e R$ de frentes impedidas. "
        "Use para 'como está a obra no geral / qual o farol consolidado / o que está em risco'. "
        "ATENÇÃO: o consolidado SÓ é confiável com cobertura COMPLETA (6/6 dimensões avaliadas) — se "
        "houver dimensão pendente, o consolidado é PARCIAL e pode estar verde sobre área cega (ex.: "
        "Clima/Força Maior não avaliado não rebaixa o consolidado). Farol pendente ≠ Conforme.",
        {},
    )
    async def get_panorama(args):  # noqa: ANN001
        # LIVE: pega a normalização mais recente (vigência garante o estado atual) — igual panorama.ts.
        rows = (
            supabase.table("obra_panorama")
            .select(
                "consolidado, farol_projetos, farol_interferencias, farol_liberacoes_area, "
                "farol_clima_forca_maior, farol_precos_quantidades, farol_suprimentos_material, "
                "pct_areas_liberadas, dias_parados_acum, frentes_impedidas_rs, status"
            )
            .eq("contrato_id", obra_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("Panorama (C.10)")
        r = rows[0]

        # 6 dimensões — null = NÃO avaliada (pendente honesto, nunca Conforme sobre área cega).
        dimensoes = []
        em_risco = []
        for col, chave, label in _PANORAMA_DIMS:
            nivel = _pan_farol(r.get(col))
            dimensoes.append(
                {
                    "chave": chave,
                    "label": label,
                    "nivel": nivel,
                    "nivel_label": _PANORAMA_FAROL_LABEL[nivel] if nivel else None,
                    "avaliada": nivel is not None,
                }
            )
            if nivel in ("risco", "critico"):
                em_risco.append({"chave": chave, "label": label, "nivel": nivel})

        n_avaliados = sum(1 for d in dimensoes if d["avaliada"])
        cobertura_completa = n_avaliados == len(_PANORAMA_DIMS)

        consolidado = _pan_farol(r.get("consolidado"))
        # pior dos AVALIADOS (cross-check da régua "consolidadoPior" da fonte) — ignora null.
        niveis_aval = [d["nivel"] for d in dimensoes if d["avaliada"]]
        consolidado_calc = (
            max(niveis_aval, key=_PANORAMA_FAROL_ORDEM.index) if niveis_aval else None
        )

        def _num(v):  # null → None (lacuna ≠ 0); pct_areas_liberadas é fração 0..1 (a tela faz ×100)
            return float(v) if v is not None else None

        pct = _num(r.get("pct_areas_liberadas"))
        out: dict[str, Any] = {
            "disponivel": True,
            "consolidado": consolidado,
            "consolidado_label": _PANORAMA_FAROL_LABEL[consolidado] if consolidado else None,
            "consolidado_confiavel": cobertura_completa,
            "consolidado_status": "completo" if cobertura_completa else "parcial",
            "consolidado_calculado_dos_avaliados": consolidado_calc,
            "dimensoes": dimensoes,
            "dimensoes_em_risco": em_risco,
            "n_dimensoes_em_risco": len(em_risco),
            "n_avaliados": n_avaliados,
            "n_dimensoes": len(_PANORAMA_DIMS),
            "cobertura_completa": cobertura_completa,
            "pct_areas_liberadas": pct,
            "pct_areas_liberadas_pct": round(pct * 100, 1) if pct is not None else None,
            "dias_parados_acum": _num(r.get("dias_parados_acum")),
            "frentes_impedidas_rs": _num(r.get("frentes_impedidas_rs")),
            "status_normalizacao": r.get("status") or "ok",
        }
        if not cobertura_completa:
            faltando = [d["label"] for d in dimensoes if not d["avaliada"]]
            out["_aviso_consolidado"] = (
                f"Cobertura PARCIAL: {n_avaliados}/{len(_PANORAMA_DIMS)} dimensões avaliadas. O "
                f"consolidado reflete só as avaliadas e pode estar otimista — pendente(s): "
                f"{', '.join(faltando)}. Dimensão pendente NÃO é Conforme."
            )
        if consolidado is not None and consolidado_calc is not None and consolidado != consolidado_calc:
            out["_aviso_divergencia"] = (
                f"Consolidado da fonte ({consolidado}) ≠ pior dos avaliados ({consolidado_calc}) — "
                "revisar normalização."
            )
        out["_proveniencia"] = {
            "tabela": "obra_panorama",
            "obra_id": obra_id,
            "nota": "1 row por obra/version; lida a mais recente (created_at desc). Faróis vêm "
            "PRÉ-CALCULADOS na C.10 (consolidadoPior da fonte) — não recomputados de régua aqui.",
        }
        return _json(out)

    @tool(
        "get_produtividade_economica_resumo",
        "Resumo da PRODUTIVIDADE ECONÔMICA (R$/HH · C.7): série mensal de faturado × homem-hora "
        "previsto/real, R$/HH e os cards da aba. Devolve: HH previsto total, HH real medido (parcial), "
        "R$/HH real (= faturado dos meses medidos ÷ HH real), 'ADERÊNCIA HH' (= HH real ÷ HH previsto "
        "DOS MESES MEDIDOS, em %) e o índice econômico/CPI (R$/HH real ÷ R$/HH contratado) do último mês. "
        "Use para 'qual a produtividade R$/HH', 'aderência de homem-hora', 'quanto cada HH rendeu'. "
        "⚠️ NÃO CONFUNDA as TRÊS produtividades/índices: (1) esta ADERÊNCIA HH = HH real÷previsto "
        "(mobilização de mão de obra, %); (2) o ÍNDICE/CPI 'aderencia' = R$/HH real÷contratado (cost "
        "performance, >100% = HH rendeu mais R$ que o contratado) — vem na coluna do banco; (3) a "
        "produtividade FÍSICA kg/Hh (get_produtividade_resumo, outra tabela). E nenhuma é o 'avanço "
        "financeiro' do faturamento. HH real é PARCIAL (obra em execução): meses sem medição ficam null.",
        {},
    )
    async def get_produtividade_economica_resumo(args):  # noqa: ANN001
        # LER LIVE o estado vigente (re-upload substitui) — sem filtro de versão, igual ao read-model
        # produtividadeEconomica.ts. Erro de leitura PROPAGA (área-cega ≠ pendente honesto).
        rows = (
            supabase.table("obra_produtividade_economica")
            .select(
                "ano, mes, periodo_label, faturado_rs, hh_previsto, hh_real, rs_por_hh, aderencia, status"
            )
            .eq("contrato_id", obra_id)
            .order("ano", desc=False)
            .order("mes", desc=False)
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("Produtividade econômica (R$/HH · C.7)")

        def _num(v):  # null/NaN/inf → None (lacuna ≠ 0); espelha num() do .ts
            if v is None:
                return None
            try:
                f = float(v)
            except (TypeError, ValueError):
                return None
            return f if f == f and f not in (float("inf"), float("-inf")) else None

        meses = [
            {
                "ano": r["ano"],
                "mes": r["mes"],
                "periodo_label": r.get("periodo_label"),
                "faturado_rs": _num(r.get("faturado_rs")),
                "hh_previsto": _num(r.get("hh_previsto")),
                "hh_real": _num(r.get("hh_real")),  # null = mês ainda não medido (NUNCA 0)
                "rs_por_hh": _num(r.get("rs_por_hh")),
                "indice_economico": _num(r.get("aderencia")),  # CPI R$/HH real÷contratado (NÃO é HH real÷prev)
            }
            for r in rows
        ]

        # Σ ignora null (None→0 só na soma). Σ HH previsto é sobre TODOS os meses (âncora de conservação).
        soma_hh_previsto = sum((m["hh_previsto"] or 0) for m in meses)
        soma_hh_real = sum((m["hh_real"] or 0) for m in meses)
        # eixo real só existe até o BM-corte; antes disso é pendente (NUNCA 0).
        eixo_real_vazio = not any((m["hh_real"] or 0) > 0 for m in meses)

        # Cards da aba — agregados SÓ dos meses MEDIDOS (hh_real>0), não diluir no horizonte total.
        medidos = [m for m in meses if (m["hh_real"] or 0) > 0]
        hh_prev_medido = sum((m["hh_previsto"] or 0) for m in medidos)
        faturado_medido = sum((m["faturado_rs"] or 0) for m in medidos)
        # ADERÊNCIA HH (card) = HH real ÷ HH previsto-DOS-MESES-MEDIDOS — mobilização de mão de obra.
        aderencia_hh = (soma_hh_real / hh_prev_medido) if hh_prev_medido > 0 else None
        # R$/HH REAL (card) = faturado dos medidos ÷ HH real total. Pendente se sem real.
        rs_por_hh_real = (faturado_medido / soma_hh_real) if soma_hh_real > 0 else None
        # CPI / índice econômico do último mês medido com índice — R$/HH real ÷ contratado.
        cpi = next((m["indice_economico"] for m in reversed(medidos) if m["indice_economico"] is not None), None)
        ultimo_rs_hh = next((m["rs_por_hh"] for m in reversed(medidos) if m["rs_por_hh"] is not None), None)

        status = "needs_review" if any(r.get("status") != "ok" for r in rows) else "ok"

        out: dict[str, Any] = {
            "n_meses": len(meses),
            "hh_previsto_total": round(soma_hh_previsto, 2),
            # PENDENTE (null) enquanto a obra não mediu nenhum HH real — não fabricar 0.
            "hh_real_medido": None if eixo_real_vazio else round(soma_hh_real, 2),
            "n_meses_medidos": len(medidos),
            "rs_por_hh_real": round(rs_por_hh_real, 2) if rs_por_hh_real is not None else None,
            "rs_por_hh_real_ultimo_mes": round(ultimo_rs_hh, 2) if ultimo_rs_hh is not None else None,
            "aderencia_hh_pct": round(aderencia_hh * 100, 2) if aderencia_hh is not None else None,
            "indice_economico_cpi": round(cpi, 4) if cpi is not None else None,
            "eixo_real_vazio": eixo_real_vazio,
            "status": status,
            "meses": meses,
            "_glossario": {
                "aderencia_hh_pct": "HH real ÷ HH previsto dos meses MEDIDOS (mobilização de mão de obra, %)",
                "indice_economico_cpi": "R$/HH real ÷ R$/HH contratado (cost performance; >1 = HH rendeu mais R$ que o contratado) — NÃO é a aderência HH",
                "rs_por_hh_real": "faturado dos meses medidos ÷ HH real (produtividade econômica)",
                "nao_e": "produtividade FÍSICA kg/Hh (outra tabela) nem 'avanço financeiro' do faturamento",
            },
        }
        out["_proveniencia"] = {
            "tabela": "obra_produtividade_economica",
            "obra_id": obra_id,
            "nota": "Camada A (C.7 workbook-motor). Cards 'R$/HH' e 'ADERÊNCIA HH' recomputados Σ/Σ sobre "
            "os meses MEDIDOS (paridade com produtividade.tsx). HH real é PARCIAL — meses sem medição = null. "
            "Gate de conservação: Σ HH previsto == card hhTotalPrevisto.",
        }
        return _json(out)

    # ── Físico / Cronograma (C.5 · Fase 1): respondem "atraso de CRONOGRAMA" (FÍSICO), nunca faturamento ──
    @tool(
        "get_curva_fisica_por_frente",
        "Curva FÍSICA por frente/disciplina (C.5): % de avanço físico PREVISTO acumulado de cada "
        "disciplina (Terraplenagem, Pavimentação, OAE, Drenagem…), com o REAL quando medido. Use para "
        "'quais frentes estão atrasadas no CRONOGRAMA / avanço físico por frente'. Cronograma é FÍSICO "
        "(% de obra), NÃO faturamento (R$) — JAMAIS use o desvio financeiro como prova de atraso físico. "
        "O REAL físico por frente costuma ser PENDENTE (input do RDO): quando for, NÃO dá pra rankear "
        "atraso REAL — só mostra o PLANEJADO e diz que o real não foi medido.",
        {},
    )
    async def get_curva_fisica_por_frente(args):  # noqa: ANN001
        # FÍSICO por disciplina = físico-financeiro (contratado/real acum ÷ contratado total da
        # disciplina), MESMA fonte da tela C.5 (obra_faturamento_disciplina_resumo), NÃO o cronograma.
        rows = (
            supabase.table("obra_faturamento_disciplina_resumo")
            .select("disciplina, servico, contratado_total_rs, contratado_acum_rs, real_acum_rs, farol")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        if not rows:
            return _pendente("Físico por disciplina/frente (C.5)")
        corte = _bm_corte(obra_id)
        disciplinas = []
        for r in rows:
            tot = _rec_num(r.get("contratado_total_rs"))
            prev = _rec_num(r.get("contratado_acum_rs"))
            real = _rec_num(r.get("real_acum_rs"))
            prev_f = (prev / tot) if (tot and prev is not None) else None
            real_f = (real / tot) if (tot and real is not None) else None
            atraso = (
                round((real_f - prev_f) * 100, 2) if (real_f is not None and prev_f is not None) else None
            )
            farol_raw = str(r.get("farol") or "").strip()
            disciplinas.append(
                {
                    "disciplina": r.get("disciplina"),
                    "servico": r.get("servico"),
                    "previsto_fisico_no_corte_pct": _pct1(prev_f),
                    "real_fisico_no_corte_pct": _pct1(real_f),
                    "atraso_pp": atraso,  # real − previsto (negativo = atraso)
                    "farol": (farol_raw.lstrip("●○◌◍◆▲△ ").strip() or None) if farol_raw else None,
                }
            )
        disciplinas.sort(key=lambda x: x.get("previsto_fisico_no_corte_pct") or -1, reverse=True)
        real_medido = any(d["real_fisico_no_corte_pct"] is not None for d in disciplinas)
        return _json(
            {
                "n_disciplinas": len(disciplinas),
                "bm_corte": corte,
                "real_fisico_medido": real_medido,
                "disciplinas": disciplinas,
                "_nota": "FÍSICO por disciplina = físico-financeiro (contratado/real acum ÷ contratado "
                "total da disciplina), MESMA base da tela C.5. atraso em pontos percentuais (real − "
                "previsto). disciplinas com servico=false (Mobilização/Adm Local/Insumos) NÃO entram no "
                "físico de serviços overall. NÃO usar o desvio FINANCEIRO como atraso físico.",
                "_proveniencia": {"tabelas": ["obra_faturamento_disciplina_resumo (C.5)"], "bm_corte": corte},
            }
        )

    @tool(
        "get_curva_prevista_fisica",
        "Curva FÍSICA PREVISTA AGREGADA da obra (C.5): % de avanço físico planejado acumulado (no corte "
        "e final) + término planejado, com o REAL quando medido. Use para 'a obra está atrasada no "
        "CRONOGRAMA / qual o avanço físico da obra'. É FÍSICO (% de obra), NÃO faturamento. O REAL "
        "físico agregado costuma ser PENDENTE → a aderência física (real vs previsto) não dá pra "
        "calcular; só mostra o planejado, sem confundir com o desvio financeiro.",
        {},
    )
    async def get_curva_prevista_fisica(args):  # noqa: ANN001
        crons = (
            supabase.table("obra_cronogramas")
            .select("id, termino_obra")
            .eq("contrato_id", obra_id)
            .execute()
            .data
            or []
        )
        if not crons:
            return _pendente("Cronograma físico (curva prevista C.5)")
        best, bestn = None, -1  # cronograma mais completo (mais meses) = autoritativo
        for cr in crons:
            n = (
                supabase.table("obra_cronograma_meses")
                .select("id", count="exact")
                .eq("cronograma_id", cr["id"])
                .limit(1)
                .execute()
                .count
            ) or 0
            if n > bestn:
                bestn, best = n, cr
        meses = (
            supabase.table("obra_cronograma_meses")
            .select("ano, mes, previsto_pct_acumulado, real_pct_acumulado")
            .eq("cronograma_id", best["id"])
            .order("ano")
            .order("mes")
            .execute()
            .data
            or []
        )
        corte = _bm_corte(obra_id)
        # FÍSICO = % físico-financeiro dos SERVIÇOS (Σ contratado/real acum ÷ Σ contratado total, só
        # servico=True), IGUAL à tela C.5 (o físico NÃO é a curva do cronograma). O cronograma acima dá
        # só o eixo de tempo e o término planejado.
        disc = (
            supabase.table("obra_faturamento_disciplina_resumo")
            .select("servico, contratado_total_rs, contratado_acum_rs, real_acum_rs")
            .eq("contrato_id", obra_id)
            .execute()
            .data
            or []
        )
        serv = [d for d in disc if d.get("servico")]
        tot_s = sum(_rec_num(d.get("contratado_total_rs")) or 0.0 for d in serv)
        prev_s = sum(_rec_num(d.get("contratado_acum_rs")) or 0.0 for d in serv)
        real_s = sum(_rec_num(d.get("real_acum_rs")) or 0.0 for d in serv)
        real_medido = any(d.get("real_acum_rs") is not None for d in serv) and real_s > 0
        prev_fis = (prev_s / tot_s) if tot_s else None
        real_fis = (real_s / tot_s) if (tot_s and real_medido) else None
        atraso_pp = (
            round((real_fis - prev_fis) * 100, 2) if (real_fis is not None and prev_fis is not None) else None
        )
        return _json(
            {
                "n_meses": len(meses),
                "bm_corte": corte,
                "previsto_fisico_no_corte_pct": _pct1(prev_fis),
                "real_fisico_no_corte_pct": _pct1(real_fis),
                "atraso_fisico_pp": atraso_pp,  # real − previsto (pontos percentuais; negativo = atraso)
                "previsto_fisico_final_pct": 100.0 if tot_s else None,
                "real_fisico_medido": real_medido,
                "termino_planejado": best.get("termino_obra"),
                "_nota": "FÍSICO = % físico-financeiro dos SERVIÇOS (Σ contratado/real acum ÷ Σ contratado "
                "total, exclui Mobilização/Adm Local/Insumos) — MESMA base da tela C.5, NÃO a curva do "
                "cronograma. atraso em pontos percentuais (real − previsto). NÃO confundir com o desvio "
                "FINANCEIRO de faturamento.",
                "_proveniencia": {
                    "tabelas": ["obra_faturamento_disciplina_resumo (físico serviços)",
                                "obra_cronograma_meses (eixo/término)"],
                    "bm_corte": corte,
                },
            }
        )

    @tool(
        "get_condutas",
        "CONDUTAS sugeridas pela IA (C.11): ações recomendadas com gatilho (situação que dispara), "
        "categoria (tipo de ação: Carta/Notificação, Análise, RDO, etc.), cláusula-base do contrato, "
        "documento sugerido e prioridade (Urgente, Importante, Preventiva). Devolve lista ordenada com "
        "status operacional (Sugerida/Em redação/Aceita), data sugerida e dias que está aberta. Use para "
        "'quais ações a IA sugeriu / por que recomendar tal redação / qual a prioridade da ação'. "
        "ATENÇÃO: condutas ainda não normalizado = [] (não _pendente); quando forem, cada linha traz "
        "ordem, gatilho, categoria (pode ser null), cláusula-base, documento sugerido, prioridade e status.",
        {},
    )
    async def get_condutas(args):  # noqa: ANN001
        # LER LIVE (vigência garante o estado atual — nenhum filtro de versão, igual condutas.ts).
        # Erro de leitura PROPAGA (não vira pendente: _pendente é só 'não normalizado').
        rows = (
            supabase.table("obra_condutas")
            .select(
                "ordem, gatilho, categoria, clausula, documento, prioridade, status, "
                "data_sugerida, dias_aberto"
            )
            .eq("contrato_id", obra_id)
            .order("ordem", desc=False)
            .execute()
            .data
            or []
        )
        # Sem condutas = [] (não normalizado ainda, mas não é 'erro') — diferenciar de pendente.
        if not rows:
            return _json(
                {
                    "disponivel": False,
                    "n_condutas": 0,
                    "condutas": [],
                    "_nota": "Nenhuma conduta sugerida ainda (C.11 ainda não normalizado).",
                    "_proveniencia": {"tabela": "obra_condutas", "obra_id": obra_id},
                }
            )

        def _num(v):  # null/NaN/inf → None (lacuna ≠ 0)  # noqa: ANN001, ANN202
            if v is None:
                return None
            try:
                f = float(v)
            except (TypeError, ValueError):
                return None
            return f if f == f and f not in (float("inf"), float("-inf")) else None

        condutas = [
            {
                "ordem": int(r.get("ordem") or 0),
                "gatilho": str(r["gatilho"]) if r.get("gatilho") is not None else None,
                "categoria": str(r["categoria"]) if r.get("categoria") is not None else None,
                "clausula": str(r["clausula"]) if r.get("clausula") is not None else None,
                "documento": str(r["documento"]) if r.get("documento") is not None else None,
                "prioridade": str(r["prioridade"]) if r.get("prioridade") is not None else None,
                "status": str(r["status"]) if r.get("status") is not None else None,
                "data_sugerida": str(r["data_sugerida"]) if r.get("data_sugerida") is not None else None,
                "dias_aberto": _num(r.get("dias_aberto")),
            }
            for r in rows
        ]

        # Contagem por status (presentes na data lida).
        contagem_status = {}
        for c in condutas:
            s = c.get("status") or "—"
            contagem_status[s] = contagem_status.get(s, 0) + 1

        # Contagem por prioridade.
        contagem_prioridade = {}
        for c in condutas:
            p = c.get("prioridade") or "—"
            contagem_prioridade[p] = contagem_prioridade.get(p, 0) + 1

        out: dict[str, Any] = {
            "disponivel": True,
            "n_condutas": len(condutas),
            "condutas": condutas,
            "contagem_por_status": contagem_status,
            "contagem_por_prioridade": contagem_prioridade,
            "n_urgentes": sum(1 for c in condutas if c.get("prioridade") == "Urgente"),
            "_proveniencia": {
                "tabela": "obra_condutas",
                "obra_id": obra_id,
                "nota": "Cada conduta com: gatilho (situação/evento que dispara), categoria "
                "(tipo de ação sugerida), cláusula-base, documento recomendado, prioridade "
                "(Urgente/Importante/Preventiva) e status operacional (Sugerida/Em redação/Aceita). "
                "Dias aberto = dias desde data_sugerida; null = ainda não medido. Ordenado por ordem.",
            },
        }
        return _json(out)

    @tool(
        "get_plano_acao",
        "Plano de Ação (C.12): quadro de tarefas (5W2H · origem rastreável C.11, responsável, prazo, "
        "urgência, status, vinculação), resumo consolidado (contagem por status, atrasadas, críticas, SLA, "
        "% avanço) e farol da aba (Crítico/Risco/Observação/Conforme). Use para 'quais as ações / que fazer / "
        "prazo das tarefas / quem é o responsável / qual o atraso / o que está crítico'. ATENÇÃO: origem "
        "rastreável (ex.: 'C.11 #2') vincula a tarefa à conduta que a gerou (causalidade Camada A). Farol "
        "segue o DS (sem 'Atenção'): Crítico, Risco, Observação ou Conforme. null = PENDENTE, nunca 0.",
        {},
    )
    async def get_plano_acao(args):  # noqa: ANN001
        """Plano de Ação (C.12) — tarefas + resumo + leitura IA."""
        def _str(v: Any) -> str | None:
            """Normaliza string: null → None, "" → None."""
            if v is None:
                return None
            s = str(v).strip()
            return s if s else None

        # LER LIVE: 3 seções (Quadro/Resumo/Leitura) — mesma fonte do read-model .ts.
        tarefas_rows = _secao_dados(obra_id, "C.12 Plano de Ação — Quadro")
        resumo_obj = _secao_dados(obra_id, "C.12 Plano de Ação — Resumo")
        leitura_obj = _secao_dados(obra_id, "C.12 Plano de Ação — Leitura")

        # Pendente: NÃO há Quadro NEM Resumo normalizados.
        if not (isinstance(tarefas_rows, list) and tarefas_rows) and not isinstance(resumo_obj, dict):
            return _pendente("Plano de Ação (C.12)")

        # QUADRO DE TAREFAS (Quadro de Tarefas — Quadro, array de dicts).
        tarefas: list[dict[str, Any]] = []
        if isinstance(tarefas_rows, list):
            for r in tarefas_rows:
                if not isinstance(r, dict):
                    continue
                # urgência: limpar bullet point ( ● Crítica → Crítica).
                urgencia_raw = _pick(r, "urgência", "urgencia")
                urgencia = (
                    re.sub(r"^[●○•◌]\s*", "", str(urgencia_raw or "")).strip()
                    if urgencia_raw
                    else None
                )
                tarefas.append({
                    "id": _str(_pick(r, "id", "id (t")) or "",
                    "titulo": _str(_pick(r, "título", "titulo")) or "",
                    "origem": _str(_pick(r, "origem")),  # ex.: "C.11 #2"
                    "responsavel": _str(_pick(r, "responsável", "responsavel")),
                    "prazo": _str(_pick(r, "prazo")),  # ISO "2026-06-10"
                    "urgencia": urgencia or None,  # sem o ●
                    "frente_trecho": _str(_pick(r, "frente/trecho", "frente")),
                    "status": _str(_pick(r, "status")),  # "Em Andamento" / "A Fazer" / "Concluída"
                    "vinculacao": _str(_pick(r, "vinculação", "vinculacao")),
                    "por_que": _str(_pick(r, "por quê", "por que", "justificativa")),
                    "esforco": _str(_pick(r, "esforço", "esforco")),
                })

        # RESUMO (Resumo, dict de contagens + farol).
        def _mapfarol(raw: Any) -> tuple[str, str]:
            """Mapeia farol para nível + label (sem 'Atenção' — risco ou obs). Retorna (nivel, label)."""
            s = str(raw or "").lower()
            if "crític" in s or "critic" in s:
                return ("critico", "Crítico")
            if "atenç" in s or "risco" in s:
                return ("risco", "Risco")
            if "observ" in s:
                return ("observacao", "Observação")
            return ("conforme", "Conforme")

        resumo: dict[str, Any] | None = None
        if isinstance(resumo_obj, dict):
            farol_nivel, farol_label = _mapfarol(_pick(resumo_obj, "faroldaaba", "farol"))
            resumo = {
                "total": _rec_num(_pick(resumo_obj, "totaldeacoes", "total")) or len(tarefas),
                "a_fazer": _rec_num(_pick(resumo_obj, "afazer")) or 0,
                "em_andamento": _rec_num(_pick(resumo_obj, "emandamento")) or 0,
                "concluidas": _rec_num(_pick(resumo_obj, "concluidas")) or 0,
                "atrasadas": _rec_num(_pick(resumo_obj, "tarefasatrasadas", "atrasadas")) or 0,
                "vencendo": _rec_num(_pick(resumo_obj, "vencendoemmenos7", "vencendo")) or 0,
                "criticas_atrasadas": _rec_num(_pick(resumo_obj, "criticasatrasadas")) or 0,
                "sla_medio_dias": _rec_num(_pick(resumo_obj, "slamediodias", "sla")),
                "vinculadas_ac11": _rec_num(_pick(resumo_obj, "vinculadasac11", "vinculadas")),
                "pct_concluidas_frac": _rec_num(_pick(resumo_obj, "percentualavancoconcluidas", "percentual")),
                "farol_nivel": farol_nivel,
                "farol_label": farol_label,
                "farol_criterio": _str(_pick(resumo_obj, "farolcriterio", "criterio")),
            }

        # LEITURA IA (Leitura, dict; limpar prefixo "📝 LEITURA IA (...):" ).
        leitura_ia = ""
        if isinstance(leitura_obj, dict):
            conteudo_raw = _str(_pick(leitura_obj, "conteudo", "leitura")) or ""
            leitura_ia = re.sub(r"^📝?\s*LEITURA IA[^:]*:\s*", "", conteudo_raw, flags=re.IGNORECASE).strip()

        out: dict[str, Any] = {
            "tarefas": tarefas,
            "resumo": resumo,
            "leitura_ia": leitura_ia or None,
            "_proveniencia": {
                "tabelas": ["obra_secoes · C.12 Plano de Ação (Quadro/Resumo/Leitura)"],
                "nota": "tarefas nascidas das condutas C.11 (origem rastreável); resumo: contagens por "
                "status + contagem por farol + SLA médio (dias até atraso); farol derivado do critério "
                "(ex.: '1-2 críticas atrasadas' → Risco). Farol segue DS (sem 'Atenção'). Leitura IA: "
                "narrativa editável do SaaS. null = PENDENTE, nunca 0 fabricado.",
            },
        }
        return _json(out)

    @tool(
        "get_indiretos_detalhe",
        "CUSTOS INDIRETOS (D.1 — detalhe: base + métodos): Adm Local cheio/mensal, redução de escopo, "
        "desequilíbrio de extensão, custo direto, e os 4 métodos paralelos (M1/M2/M3/M4) com "
        "desequilíbrio R$, medido R$, defensabilidade e qual está ativo. Use para 'qual o custo indireto / "
        "composição do indireto / qual método / quanto de adm / quanto pesa a extensão'.",
        {},
    )
    async def get_indiretos_detalhe(args):  # noqa: ANN001
        # LER LIVE: vigor garante estado atual (re-upload substitui). Espelha getIndiretos.ts.
        # Falha de leitura (RLS/timeout/rede) PROPAGA (erro = milhões) — _pendente só p/ "não normalizado".
        base_rows = (
            supabase.table("obra_indiretos_base")
            .select(
                "adm_local_cheio, adm_local_mensal, reducao_escopo, desequilibrio_extensao, "
                "custo_direto, metodo_ativo, desequilibrio_total, status"
            )
            .eq("contrato_id", obra_id)
            .order("created_at")
            .limit(1)
            .execute()
            .data
            or []
        )
        metodos_rows = (
            supabase.table("obra_indiretos_metodos")
            .select("ordem, metodo, desequilibrio_rs, medido_rs, defensabilidade, ativo, obs, status")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        # Nenhum dado = não normalizado (M3 não rodado).
        if not base_rows and not metodos_rows:
            return _pendente("Indiretos (D.1 — detalhe)")

        # Parsear base (1 row ou None).
        base = base_rows[0] if base_rows else {}
        num = lambda v: float(v) if v is not None else None  # noqa: E731
        
        metodos = [
            {
                "ordem": int(r.get("ordem") or 0),
                "metodo": str(r["metodo"]) if r.get("metodo") is not None else None,
                "desequilibrio_rs": num(r.get("desequilibrio_rs")),
                "medido_rs": num(r.get("medido_rs")),
                "defensabilidade": num(r.get("defensabilidade")),
                "ativo": bool(r.get("ativo")),
                "obs": str(r["obs"]) if r.get("obs") is not None else None,
            }
            for r in metodos_rows
        ]
        
        # Verificar se há algum status que indique revisão.
        status_base = base.get("status") or "ok"
        status_metodos = [m.get("status") for m in metodos_rows]
        status_global = "needs_review" if (
            status_base == "needs_review" or any(s == "needs_review" for s in status_metodos)
        ) else "ok"
        
        out: dict[str, Any] = {
            "disponivel": bool(base or metodos_rows),
            "adm_local_cheio": num(base.get("adm_local_cheio")),
            "adm_local_mensal": num(base.get("adm_local_mensal")),
            "reducao_escopo": num(base.get("reducao_escopo")),
            "desequilibrio_extensao": num(base.get("desequilibrio_extensao")),
            "custo_direto": num(base.get("custo_direto")),
            "metodo_ativo": str(base["metodo_ativo"]) if base.get("metodo_ativo") is not None else None,
            "desequilibrio_total": num(base.get("desequilibrio_total")),
            "metodos": metodos,
            "status": status_global,
            "_proveniencia": {
                "tabelas": ["obra_indiretos_base", "obra_indiretos_metodos"],
                "obra_id": obra_id,
                "nota": "Base = Adm Local (cheio/mensal), redução de escopo, desequilíbrio de "
                "extensão, custo direto. Métodos (M1/M2/M3/M4): desequilíbrio_rs (valor estimado), "
                "medido_rs (real medido ou zero), defensabilidade (1-5 escala), ativo (qual método em "
                "uso). Todos null = não normalizado (M3 não rodado).",
            },
        }
        return _json(out)

    @tool(
        "get_bdi_desequilibrio",
        "Detalhe do DESEQUILÍBRIO DO BDI NÃO-REMUNERADO (D.2): os params/KPIs consolidados (PV, BDI "
        "declarado, custos, desequilíbrio total, projeção); as 6 rubricas de tempo-dependência (Adm. "
        "Central, Lucro, Despesas Financeiras, Garantias, Seguros) com gasto teórico vs remunerado e "
        "desequilíbrio por rubrica; e a curva de PERDA MENSAL (BM 1–46) mostrando a acumulada. Use para "
        "'quanto o BDI se desequilibrou / composição da perda do BDI / perda por rubrica de tempo'. "
        "ATENÇÃO: isto é o DESEQUILÍBRIO do BDI (D.2, Painel D.0) — NÃO confunda com o markup/buildup "
        "do BDI contratual (C.1, get_bdi_buildup). Gasto teórico (acumulado até BM-corte) é a "
        "programação (custo mensal × meses do contrato); remunerado é o que entra na medição; a diferença "
        "é a PERDA (=desequilíbrio). Farol vem normalizado (Conforme/Observação/Risco/Crítico).",
        {},
    )
    async def get_bdi_desequilibrio(args):  # noqa: ANN001
        # FONTE: 3 tabelas do workbook-motor, normalizadas pelo gate (Σ rubricas == total; perda acum == deseq).
        # MESMA computação do read-model bdiDeseq.ts — número do chat == número da tela D.2.

        # 1. Params/KPIs do D.2
        params_rows = (
            supabase.table("obra_bdi_deseq")
            .select(
                "pv_rs, bdi_declarado, custo_direto_rs, custo_indireto_rs, bm_corrente, "
                "meses_contratuais, medicao_acum_rs, meses_extensao, desequilibrio_rs, pct_sobre_pv, "
                "custo_mensal_tempo_rs, gasto_teorico_acum_rs, remunerado_acum_rs, valor_total_contrato_rs, "
                "overhead_mes_rs, projecao_extensao_rs, delta_reducao_rs, farol"
            )
            .eq("contrato_id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )

        # 2. Rubricas de tempo-dependência (6 itens)
        rubricas_rows = (
            supabase.table("obra_bdi_rubrica_tempo")
            .select(
                "ordem, rubrica, tipo, pct_rubrica, valor_contrato_rs, incorrido_mes_rs, "
                "gasto_teorico_acum_rs, remunerado_acum_rs, desequilibrio_rs, obs"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )

        # 3. Curva de perda mensal (BM 1–46)
        perdas_rows = (
            supabase.table("obra_bdi_perda_mensal")
            .select(
                "ordem, bm, mes_label, gasto_teorico_mes_rs, remunerado_mes_rs, "
                "perda_mes_rs, perda_acum_rs"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )

        # Pendente: não normalizado em NENHUMA tabela
        if not params_rows and not rubricas_rows and not perdas_rows:
            return _pendente("BDI desequilíbrio (D.2)")

        # 1. Montar params/KPIs
        params = params_rows[0] if params_rows else {}
        out: dict[str, Any] = {
            "pv_rs": _rec_num(params.get("pv_rs")),
            "bdi_declarado": _rec_num(params.get("bdi_declarado")),  # fração 0..1 (e.g., 0.2975 = 29,75%)
            "custo_direto_rs": _rec_num(params.get("custo_direto_rs")),
            "custo_indireto_rs": _rec_num(params.get("custo_indireto_rs")),
            "bm_corrente": int(_rec_num(params.get("bm_corrente")) or 0) if params.get("bm_corrente") is not None else None,
            "meses_contratuais": int(_rec_num(params.get("meses_contratuais")) or 0) if params.get("meses_contratuais") is not None else None,
            "medicao_acum_rs": _rec_num(params.get("medicao_acum_rs")),
            "meses_extensao": int(_rec_num(params.get("meses_extensao")) or 0) if params.get("meses_extensao") is not None else None,
            "desequilibrio_total_rs": _rec_num(params.get("desequilibrio_rs")),
            "pct_desequilibrio_sobre_pv": _pct1(params.get("pct_sobre_pv")),  # % com 1 casa
            "custo_mensal_tempo_rs": _rec_num(params.get("custo_mensal_tempo_rs")),  # custo mensal teórico de tempo
            "gasto_teorico_acum_rs": _rec_num(params.get("gasto_teorico_acum_rs")),  # Σ teórico até BM-corte
            "remunerado_acum_rs": _rec_num(params.get("remunerado_acum_rs")),  # Σ remunerado até BM-corte
            "valor_total_contrato_rs": _rec_num(params.get("valor_total_contrato_rs")),
            "overhead_mes_rs": _rec_num(params.get("overhead_mes_rs")),
            "projecao_extensao_rs": _rec_num(params.get("projecao_extensao_rs")),
            "delta_reducao_rs": _rec_num(params.get("delta_reducao_rs")),
            "farol": str(params.get("farol")) if params.get("farol") is not None else None,
        }

        # 2. Rubricas: gasto teórico × remunerado → desequilíbrio por rubrica
        rubricas = [
            {
                "ordem": int(r.get("ordem") or 0),
                "rubrica": str(r.get("rubrica") or ""),
                "tipo": str(r.get("tipo")) if r.get("tipo") is not None else None,
                "pct_rubrica": _rec_num(r.get("pct_rubrica")),  # % do contrato
                "valor_contrato_rs": _rec_num(r.get("valor_contrato_rs")),
                "incorrido_mes_rs": _rec_num(r.get("incorrido_mes_rs")),  # custo mensal da rubrica
                "gasto_teorico_acum_rs": _rec_num(r.get("gasto_teorico_acum_rs")),  # teórico acum até BM-corte
                "remunerado_acum_rs": _rec_num(r.get("remunerado_acum_rs")),  # remunerado acum até BM-corte
                "desequilibrio_rs": _rec_num(r.get("desequilibrio_rs")),  # gasto_teorico - remunerado
                "obs": str(r.get("obs")) if r.get("obs") is not None else None,
            }
            for r in rubricas_rows
        ]

        # 3. Curva mensal de perda (BM 1–46): perda mês a mês e acumulada
        perdas = [
            {
                "ordem": int(r.get("ordem") or 0),
                "bm": int(_rec_num(r.get("bm")) or 0) if r.get("bm") is not None else None,
                "mes_label": str(r.get("mes_label")) if r.get("mes_label") is not None else None,
                "gasto_teorico_mes_rs": _rec_num(r.get("gasto_teorico_mes_rs")),  # teórico do mês
                "remunerado_mes_rs": _rec_num(r.get("remunerado_mes_rs")),  # remunerado do mês
                "perda_mes_rs": _rec_num(r.get("perda_mes_rs")),  # perda do mês (teórico - remunerado)
                "perda_acum_rs": _rec_num(r.get("perda_acum_rs")),  # perda acumulada até o BM
            }
            for r in perdas_rows
        ]

        # Σ das rubricas = conservação (gate confere)
        soma_deseq_rubricas = sum((r["desequilibrio_rs"] or 0.0) for r in rubricas)

        out["rubricas"] = rubricas
        out["n_rubricas"] = len(rubricas)
        out["perdas_mensais"] = perdas
        out["n_perdas_mensais"] = len(perdas)
        out["soma_desequilibrio_rubricas_rs"] = round(soma_deseq_rubricas, 2) if rubricas else None,
        out["_proveniencia"] = {
            "tabelas": [
                "obra_bdi_deseq (params/KPIs)",
                "obra_bdi_rubrica_tempo (6 rubricas de tempo)",
                "obra_bdi_perda_mensal (curva BM 1–46)",
            ],
            "nota": "D.2 — desequilíbrio do BDI NÃO-REMUNERADO. Gasto teórico (programação acumulada "
            "até BM-corte) vs remunerado (entrada na medição) = perda. Gate confere Σ rubricas == "
            "desequilíbrio total e perda acum final == desequilíbrio. pct_sobre_pv em %; bdi_declarado "
            "em fração 0..1. Farol normalizado (Conforme/Observação/Risco/Crítico).",
        }
        return _json(out)

    @tool(
        "get_encargos_detalhe",
        "D.3 ENCARGOS SOCIAIS (27 rubricas): composição das alíquotas PROPOSTA × REAL (MOD + MOI, fração), "
        "TOTAIS por coluna, split da folha-base (MOD via histograma + MOI), DESEQUILÍBRIO R$ (quando há mudança "
        "legislativa), % sobre o PV, farol. Use para 'encargos sociais / alíquotas de mão de obra / reoneração / "
        "legislação / folha-base'. ATENÇÃO: desequilíbrio de encargos só aparece quando a alíquota REAL muda "
        "(Lei 14.973/24); hoje Real = Proposta → desequilíbrio R$ 0.",
        {},
    )
    async def get_encargos_detalhe(args):  # noqa: ANN001
        # Lê as 3 seções de encargos (Composição, Totais, Split folha) + contexto (nome, PV).
        # MESMA fonte do read-model encargos.ts (getSecaoDados por fragmento de título).
        comp_raw = _secao_dados(obra_id, "D.3 Encargos Sociais — Bloco 1")
        tot_raw = _secao_dados(obra_id, "D.3 Encargos Sociais — Totais")
        cruz_raw = _secao_dados(obra_id, "Cruzamento histograma de recursos")
        c4_raw = _secao_dados(obra_id, "C.4 — Histograma mensal MOD")

        # Composição: array de rubricas (27 linhas, grupos + detalhe).
        comp_arr = comp_raw if isinstance(comp_raw, list) else None
        if not comp_arr or len(comp_arr) == 0:
            return _pendente("Encargos Sociais (D.3 — Bloco 1)")

        composicao: list[dict[str, Any]] = []
        for r in comp_arr:
            if not isinstance(r, dict):
                continue
            mod_proposta = _rec_num(_pick(r, "mod proposta"))
            mod_real = _rec_num(_pick(r, "mod real"))
            moi_proposta = _rec_num(_pick(r, "moi proposta"))
            moi_real = _rec_num(_pick(r, "moi real"))
            is_grupo = mod_proposta is None and moi_proposta is None
            composicao.append(
                {
                    "cod": str(_pick(r, "cód", "cod") or "").strip() or None,
                    "descricao": str(_pick(r, "descrição", "descricao") or "").strip() or None,
                    "is_grupo": is_grupo,
                    "mod_proposta": mod_proposta,  # fração 0..1
                    "mod_real": mod_real,
                    "moi_proposta": moi_proposta,
                    "moi_real": moi_real,
                    # Divergente: Real ≠ Proposta em qualquer eixo (sinalizador de mudança legislativa).
                    "divergente": (
                        not is_grupo
                        and (mod_proposta != mod_real or moi_proposta != moi_real)
                    ),
                }
            )

        # Totais (dict com colunas de resumo).
        t = tot_raw if isinstance(tot_raw, dict) else {}
        mod_total_proposta = _rec_num(_pick(t, "mod proposta (fracao", "mod proposta"))
        mod_total_real = _rec_num(_pick(t, "mod real (fracao", "mod real"))
        moi_total_proposta = _rec_num(_pick(t, "moi proposta (fracao", "moi proposta"))
        moi_total_real = _rec_num(_pick(t, "moi real (fracao", "moi real"))
        base_folha_rs = _rec_num(_pick(t, "folha base (sem encargos", "folha base"))

        # Split da folha-base = MOD (histograma) + MOI (Adm Local). Derivado do Cruzamento C.4.
        # Folha-base COM encargos ÷ (1 + alíquota total MOD) = folha SEM encargos (MOD).
        # MOI = folha-base total − MOD histórico → reconcilia ao centavo.
        cruz_arr = cruz_raw if isinstance(cruz_raw, list) else []
        c4_arr = c4_raw if isinstance(c4_raw, list) else []

        mod_cruz = next(
            (
                r
                for r in cruz_arr
                if _pick(r, "recurso") == "MOD"
            ),
            None,
        )
        # Σ da C.4 histograma MOD Contr(R$) — ou fallback Cruzamento histograma.
        mod_contr_sum = sum(
            (_rec_num(_pick(r, "mod contr.(r$)", "mod contr. r$")) or 0)
            for r in c4_arr
        )
        recursos_mob_mod = mod_contr_sum if mod_contr_sum > 0 else _rec_num(_pick(mod_cruz, "histograma"))
        mod_cpu_contrato = _rec_num(_pick(mod_cruz, "cpu expandido", "cpu"))
        fator_mod = (1 + mod_total_real) if mod_total_real is not None else None
        mod_folha_hist = (
            (recursos_mob_mod / fator_mod)
            if (recursos_mob_mod is not None and fator_mod)
            else None
        )
        mod_folha_cpu = (
            (mod_cpu_contrato / fator_mod)
            if (mod_cpu_contrato is not None and fator_mod)
            else None
        )
        moi_folha = (
            (base_folha_rs - mod_folha_hist)
            if (base_folha_rs is not None and mod_folha_hist is not None)
            else None
        )

        # Contexto (nome, PV denominador, farol).
        obra_rows = (
            supabase.table("obras")
            .select("nome_interno, valor_contratual")
            .eq("id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        curva_rows = (
            supabase.table("obra_faturamento_curvas")
            .select("custo_total")
            .eq("contrato_id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        nome = obra_rows[0].get("nome_interno") if obra_rows else None
        valor_manual = (
            _rec_num(obra_rows[0].get("valor_contratual")) if obra_rows else None
        )
        valor_pv = _rec_num(curva_rows[0].get("custo_total")) if curva_rows else None
        valor_contratado = valor_manual or valor_pv

        # Farol (extrai nível como no encargos.ts).
        farol_raw = str(_pick(t, "farol") or "").strip()
        def _farol_nivel(s: str) -> str | None:
            s_norm = _norm_key(s)
            if "conform" in s_norm:
                return "conforme"
            if "observ" in s_norm or "atenc" in s_norm:
                return "observacao"
            if "risco" in s_norm:
                return "risco"
            if "critic" in s_norm:
                return "critico"
            return None
        farol = _farol_nivel(farol_raw)

        # Desequilíbrio, %, regime, base seletor.
        deseq_rs = _rec_num(_pick(t, "desequilibrio encargos", "desequilíbrio"))
        pct_sobre_pv = _rec_num(_pick(t, "% sobre pv", "% sobre p.v.", "% sobre pv"))
        delta_aliq_mod = _rec_num(_pick(t, "delta aliquota mod", "δ aliquota mod", "Δ Alíquota MOD"))
        regime = str(_pick(t, "regime") or "").strip()
        regime = regime.replace(r"\s*\(input\)\s*", "").strip() if regime else None
        status_label = str(_pick(t, "status (desequilibrio", "status (desequil") or "").strip() or None
        base_mod_seletor = str(_pick(t, "base de mod para a folha") or "").strip() or None
        cprb_cronograma = str(_pick(t, "cronograma lei 14.973", "cronograma lei 14973") or "").strip() or None

        out: dict[str, Any] = {
            "disponivel": True,
            "nome": nome,
            "composicao": composicao,
            "n_rubricas": len(composicao),
            "modTotalProposta": mod_total_proposta,  # fração
            "modTotalReal": mod_total_real,
            "moiTotalProposta": moi_total_proposta,
            "moiTotalReal": moi_total_real,
            "baseFolhaRs": base_folha_rs,  # folha SEM encargos
            "modFolhaHist": mod_folha_hist,  # MOD via histograma mobilizado
            "modFolhaCpu": mod_folha_cpu,  # MOD via CPU precificada
            "moiFolha": moi_folha,  # MOI (Adm Local)
            "recursosMobMod": recursos_mob_mod,  # histograma MOD (fonte do split)
            "modCpuContrato": mod_cpu_contrato,  # CPU expandido (fonte do split)
            "desequilibrioRs": deseq_rs,
            "pctSobrePV": pct_sobre_pv,  # fração 0..1
            "deltaAliquotaMod": delta_aliq_mod,  # p.p. (pontos percentuais)
            "regime": regime,
            "farol": farol,  # "conforme" | "observacao" | "risco" | "critico" | None
            "statusLabel": status_label,  # "Aderente" | "Conforme"
            "baseModSeletor": base_mod_seletor,  # "Histograma"
            "cprbCronograma": cprb_cronograma,  # Lei 14.973/24 (reoneração)
            "valorContratado": valor_contratado,  # PV (denominador do "% sobre PV")
            "_nota": "alíquotas em FRAÇÃO (0,8584 = 85,84%). Desequilíbrio de encargos só quando alíquota REAL "
            "muda (Lei 14.973/24); hoje Real = Proposta → desequilíbrio R$ 0 (Aderente). Split folha-base: "
            "MOD via histograma de recursos (C.4 ou Cruzamento) ÷ (1 + alíquota MOD); MOI = base − MOD; "
            "Σ MOD + MOI = baseFolhaRs (reconcilia ao centavo).",
            "_proveniencia": {
                "bm_corte": _bm_corte(obra_id),
                "tabelas": [
                    "obra_secoes (D.3 Bloco 1 · composição, D.3 Totais, Cruzamento histograma)",
                    "obra_recursos_meses (C.4 histograma MOD Contr.)",
                    "obras (nome_interno, valor_contratual)",
                    "obra_faturamento_curvas (PV denominador)",
                ],
                "nota": "paridade 1:1 com encargos.ts/getEncargos. Folha-base SEM encargos; com encargos "
                "= (folha × (1 + alíquota)). Farol pré-calculado na C.10 (consolidadoPior).",
            },
        }
        return _json(out)

    @tool(
        "get_valor_agregado",
        "VALOR AGREGADO (D.4 · earned value · AACE 25R-03): resumo por categoria (MOD/EQP/TOTAL) com "
        "VA necessário medido (Σ serviços com produção), Real alocado (histograma) e Perda de produtividade "
        "(= Alocado − Agregado). Inclui VA por serviço (Qtd medida × R$/un), série mensal (VA × Custo Real) "
        "com acumulados p/ o gráfico, e farol (só na TOTAL). Use para 'produtividade / perda de produtividade "
        "/ VA medido / alocação vs agregado / gráfico de valor agregado'.",
        {},
    )
    async def get_valor_agregado(args):  # noqa: ANN001
        # LER LIVE (vigência garante o estado atual) — MESMA fonte do read-model valorAgregado.ts.
        # Erro de leitura PROPAGA (não vira _pendente): _pendente é só "não normalizado".
        cats = (
            supabase.table("obra_valor_agregado")
            .select("ordem, categoria, va_medido_rs, real_alocado_rs, perda_rs, pct_pv, farol")
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        servs = (
            supabase.table("obra_valor_agregado_servico")
            .select(
                "ordem, codigo_cpu, servico, unidade, pct_mod, pct_eqp, mod_rs_un, eqp_rs_un, "
                "qtd_medida, va_mod_rs, va_eqp_rs"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        meses = (
            supabase.table("obra_valor_agregado_mes")
            .select("ano, mes, periodo_label, va_mod_rs, va_eqp_rs, real_mod_rs, real_eqp_rs")
            .eq("contrato_id", obra_id)
            .order("ano")
            .order("mes")
            .execute()
            .data
            or []
        )
        # Sem normalização → null (PENDENTE ≠ 0).
        if not cats:
            return _pendente("Valor Agregado (D.4)")

        num = lambda v: float(v) if v is not None else None  # noqa: E731
        # Categorias (MOD/EQP/TOTAL)
        categorias: list[dict[str, Any]] = [
            {
                "categoria": str(r.get("categoria") or ""),
                "va_medido_rs": num(r.get("va_medido_rs")),
                "real_alocado_rs": num(r.get("real_alocado_rs")),
                "perda_rs": num(r.get("perda_rs")),
                "pct_pv": num(r.get("pct_pv")),
                "farol": str(r["farol"]) if r.get("farol") is not None else None,
            }
            for r in cats
        ]
        # VA por serviço (Qtd medida × R$/un) — só os com produção.
        servicos: list[dict[str, Any]] = [
            {
                "ordem": int(r.get("ordem") or 0),
                "codigo_cpu": str(r["codigo_cpu"]) if r.get("codigo_cpu") is not None else None,
                "servico": str(r.get("servico") or ""),
                "unidade": str(r["unidade"]) if r.get("unidade") is not None else None,
                "pct_mod": num(r.get("pct_mod")),
                "pct_eqp": num(r.get("pct_eqp")),
                "mod_rs_un": num(r.get("mod_rs_un")),
                "eqp_rs_un": num(r.get("eqp_rs_un")),
                "qtd_medida": num(r.get("qtd_medida")),
                "va_mod_rs": num(r.get("va_mod_rs")),
                "va_eqp_rs": num(r.get("va_eqp_rs")),
            }
            for r in servs
        ]
        # Série mensal + acumulados derivados (cumsum) — p/ o gráfico VA × Real alocado.
        va_acum = 0.0
        real_acum = 0.0
        serie_mensal: list[dict[str, Any]] = []
        for r in meses:
            va_mod = num(r.get("va_mod_rs")) or 0.0
            va_eqp = num(r.get("va_eqp_rs")) or 0.0
            real_mod = num(r.get("real_mod_rs")) or 0.0
            real_eqp = num(r.get("real_eqp_rs")) or 0.0
            va_mes = va_mod + va_eqp
            real_mes = real_mod + real_eqp
            va_acum += va_mes
            real_acum += real_mes
            serie_mensal.append({
                "ano": int(r.get("ano") or 0),
                "mes": int(r.get("mes") or 0),
                "periodo_label": str(r["periodo_label"]) if r.get("periodo_label") is not None else None,
                "va_mod_rs": num(r.get("va_mod_rs")),
                "va_eqp_rs": num(r.get("va_eqp_rs")),
                "real_mod_rs": num(r.get("real_mod_rs")),
                "real_eqp_rs": num(r.get("real_eqp_rs")),
                "va_mes_rs": va_mes,
                "real_mes_rs": real_mes,
                "va_acum_rs": va_acum,
                "real_acum_rs": real_acum,
            })
        # Busca MOD, EQP, TOTAL por categoria.
        def by_cat(c: str) -> dict[str, Any] | None:
            return next((x for x in categorias if x["categoria"].upper() == c), None)

        total = by_cat("TOTAL")
        out: dict[str, Any] = {
            "categorias": categorias,
            "servicos": servicos,
            "serie_mensal": serie_mensal,
            "mod": by_cat("MOD"),
            "eqp": by_cat("EQP"),
            "total": total,
            "farol_total": total.get("farol") if total else None,
            "_proveniencia": {
                "tabelas": [
                    "obra_valor_agregado",
                    "obra_valor_agregado_servico",
                    "obra_valor_agregado_mes",
                ],
                "nota": "VA medido = Σ serviço (Qtd medida × R$/un da CPU); Real alocado do histograma "
                "C.4 (MOD/MOI/EQP). Perda = Real − VA (produtividade perdida). pct_pv é fração (perda/PV). "
                "Série mensal com acumulados (cumsum) p/ o gráfico. Farol só na linha TOTAL. "
                "Sem normalização → null (PENDENTE ≠ 0).",
            },
        }
        return _json(out)

    @tool(
        "get_pontuais",
        "Resumo de ANÁLISES PONTUAIS (D.6 · eventos paralisação/ociosidade): eventos (chuva + "
        "impedimentos) com O.M./equipamento afetado(s), chuva mensal (dias com chuva >5mm + "
        "pleiteável R$), chuva diária (dia, mm, ociosidade em HH/HEQ), e cards do painel (perda "
        "validada, pendente total R$, nº eventos, farol). Use para 'quais eventos paralisaram a obra / "
        "dias parados / impacto de chuva / eventos pendentes de validação'.",
        {},
    )
    async def get_pontuais(args):  # noqa: ANN001
        # 4 tabelas de fonte ÚNICA: obra_pontuais_evento, obra_pontuais_chuva_mensal,
        # obra_pontuais_chuva_dia, obra_pontuais_params — LIVE (vigência garante estado atual).
        eventos_rows = (
            supabase.table("obra_pontuais_evento")
            .select(
                "ordem, categoria, titulo, periodo, duracao, descricao, dias, "
                "mod_total, mod_frentes_ativas, mod_afetado, "
                "eqp_total, eqp_frentes_ativas, eqp_afetado, "
                "hh_ociosas, heq_ociosas, custo_mod_rs, custo_eqp_rs, custo_rs, fonte, status"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        chuva_mes_rows = (
            supabase.table("obra_pontuais_chuva_mensal")
            .select(
                "ordem, mes_label, real_5mm, prev_5mm, excedente, fracao_excedente, "
                "pleiteavel_mod_rs, pleiteavel_eqp_rs, total_mes_rs"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        chuva_dia_rows = (
            supabase.table("obra_pontuais_chuva_dia")
            .select(
                "ordem, data_label, chuva_mm, acima_5mm, periodos_afetados, "
                "efetivo_rdo, hh_ociosas, custo_ocioso_rs, equip_producao, heq_ociosas, custo_eqp_rs"
            )
            .eq("contrato_id", obra_id)
            .order("ordem")
            .execute()
            .data
            or []
        )
        params_rows = (
            supabase.table("obra_pontuais_params")
            .select(
                "jornada_dia_h, custo_hora_mod_rs, custo_hora_eqp_rs, "
                "perda_validada_rs, pendente_total_rs, eventos_pendentes, farol"
            )
            .eq("contrato_id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )

        # Nenhuma tabela → pendente. Se houver pelo menos uma, usa-a (pode ser parcial).
        if not eventos_rows and not chuva_mes_rows and not chuva_dia_rows and not params_rows:
            return _pendente("Análises Pontuais (D.6)")

        def _num(v):  # null/NaN/inf → None (lacuna ≠ 0)
            if v is None:
                return None
            try:
                f = float(v)
            except (TypeError, ValueError):
                return None
            return f if f == f and f not in (float("inf"), float("-inf")) else None

        # Eventos: lista de dicts com snake_case (espelha getPontuaisEventos.ts).
        eventos = [
            {
                "ordem": int(r.get("ordem") or 0),
                "categoria": str(r["categoria"]) if r.get("categoria") is not None else None,
                "titulo": str(r["titulo"]) if r.get("titulo") is not None else "",
                "periodo": str(r["periodo"]) if r.get("periodo") is not None else None,
                "duracao": str(r["duracao"]) if r.get("duracao") is not None else None,
                "descricao": str(r["descricao"]) if r.get("descricao") is not None else None,
                "dias": _num(r.get("dias")),
                "mod_total": _num(r.get("mod_total")),
                "mod_frentes_ativas": _num(r.get("mod_frentes_ativas")),
                "mod_afetado": _num(r.get("mod_afetado")),
                "eqp_total": _num(r.get("eqp_total")),
                "eqp_frentes_ativas": _num(r.get("eqp_frentes_ativas")),
                "eqp_afetado": _num(r.get("eqp_afetado")),
                "hh_ociosas": _num(r.get("hh_ociosas")),
                "heq_ociosas": _num(r.get("heq_ociosas")),
                "custo_mod_rs": _num(r.get("custo_mod_rs")),
                "custo_eqp_rs": _num(r.get("custo_eqp_rs")),
                "custo_rs": _num(r.get("custo_rs")),
                "fonte": str(r["fonte"]) if r.get("fonte") is not None else None,
                "status": str(r["status"]) if r.get("status") is not None else None,
            }
            for r in eventos_rows
        ]

        # Chuva mensal: pleiteável (pleiteavel_mod_rs + pleiteavel_eqp_rs = total_mes_rs).
        chuva_meses = [
            {
                "ordem": int(r.get("ordem") or 0),
                "mes_label": str(r["mes_label"]) if r.get("mes_label") is not None else None,
                "real_5mm": _num(r.get("real_5mm")),
                "prev_5mm": _num(r.get("prev_5mm")),
                "excedente": _num(r.get("excedente")),
                "fracao_excedente": _num(r.get("fracao_excedente")),
                "pleiteavel_mod_rs": _num(r.get("pleiteavel_mod_rs")),
                "pleiteavel_eqp_rs": _num(r.get("pleiteavel_eqp_rs")),
                "total_mes_rs": _num(r.get("total_mes_rs")),
            }
            for r in chuva_mes_rows
        ]

        # Chuva diária: ociosidade por dia (hh_ociosas + heq_ociosas).
        chuva_dias = [
            {
                "ordem": int(r.get("ordem") or 0),
                "data_label": str(r["data_label"]) if r.get("data_label") is not None else None,
                "chuva_mm": _num(r.get("chuva_mm")),
                "acima_5mm": r.get("acima_5mm") if r.get("acima_5mm") is not None else None,
                "periodos_afetados": _num(r.get("periodos_afetados")),
                "efetivo_rdo": _num(r.get("efetivo_rdo")),
                "hh_ociosas": _num(r.get("hh_ociosas")),
                "custo_ocioso_rs": _num(r.get("custo_ocioso_rs")),
                "equip_producao": _num(r.get("equip_producao")),
                "heq_ociosas": _num(r.get("heq_ociosas")),
                "custo_eqp_rs": _num(r.get("custo_eqp_rs")),
            }
            for r in chuva_dia_rows
        ]

        # Cards (params): jornada, custos horários, perdas, farol.
        p = params_rows[0] if params_rows else {}
        params = {
            "jornada_dia_h": _num(p.get("jornada_dia_h")),
            "custo_hora_mod_rs": _num(p.get("custo_hora_mod_rs")),
            "custo_hora_eqp_rs": _num(p.get("custo_hora_eqp_rs")),
            "perda_validada_rs": _num(p.get("perda_validada_rs")),
            "pendente_total_rs": _num(p.get("pendente_total_rs")),
            "eventos_pendentes": _num(p.get("eventos_pendentes")),
            "farol": str(p["farol"]) if p.get("farol") is not None else None,
        }

        out: dict[str, Any] = {
            "disponivel": True,
            "n_eventos": len(eventos),
            "n_meses_chuva": len(chuva_meses),
            "n_dias_chuva": len(chuva_dias),
            "eventos": eventos,
            "chuva_mensal": chuva_meses,
            "chuva_diaria": chuva_dias,
            "params": params,
            "_proveniencia": {
                "tabelas": [
                    "obra_pontuais_evento (eventos paralisação/ociosidade)",
                    "obra_pontuais_chuva_mensal (dias >5mm + pleiteável R$)",
                    "obra_pontuais_chuva_dia (ociosidade diária em HH/HEQ)",
                    "obra_pontuais_params (jornada/custos + farol do painel)",
                ],
                "nota": "Camada A (D.6 workbook-motor). Evento.status='needs_review' = "
                "ainda não validado. custo_rs = custo_mod_rs + custo_eqp_rs. Chuva: "
                "pleiteavel = real_5mm com excedente. DiárIA: acima_5mm é booleano; "
                "ociosidade em HH/HEQ (ambas podem estar 0 ou null). Farol = nível do "
                "painel (Conforme/Observação/Risco/Crítico ou null=pendente).",
            },
        }
        return _json(out)

    @tool(
        "get_insumos_excedente",
        "REEQUILÍBRIO DOS INSUMOS (D.5/C.6 · cláusula 8.8 · modelo multifonte v53): variação de preço "
        "dos 30 insumos de faturamento direto desde o marco (OS mar/26 → mai/26) pela FONTE RECOMENDADA "
        "de cada um; o EXCEDENTE sobre o IPCA do período (1,254%, linha divisória) gera repasse. "
        "Devolve o repasse REAL (excedente × valor MEDIDO — só brita+bica no BM03), o POTENCIAL (se "
        "tudo medido, dominado pelo CBUQ), nº acima do IPCA, maior excedente, e o M1 (reajuste geral "
        "IPCA sobre o saldo a executar, 3 cenários de data-base). Use para 'reajuste/reequilíbrio/"
        "excedente de insumos · cláusula 8.8 · repasse'. É À PARTE do desequilíbrio (fatura direto, "
        "fora do teto do claim). Δ%/excedente em fração.",
        {},
    )
    async def get_insumos_excedente(args):  # noqa: ANN001
        ins = (
            supabase.table("obra_insumos_fd")
            .select("ordem_abc, nome, classe, valor_contrato_bdi, valor_medido_bdi, fonte_recomendada")
            .eq("contrato_id", obra_id)
            .order("ordem_abc")
            .execute()
            .data
            or []
        )
        if not ins:
            return _pendente("Reequilíbrio de insumos (D.5/C.6 v53)")
        fontes = (
            supabase.table("obra_insumos_fd_fontes")
            .select("insumo_ordem, fonte_id, rotulo, delta_pct")
            .eq("contrato_id", obra_id)
            .eq("is_recomendada", True)
            .execute()
            .data
            or []
        )
        rec = {int(f["insumo_ordem"]): f for f in fontes}
        reeq = (
            supabase.table("obra_insumos_reeq")
            .select("*")
            .eq("contrato_id", obra_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        h = reeq[0] if reeq else {}
        ipca = _rec_num(h.get("ipca_periodo")) or 0.0

        acima, repasse, potencial, medidos = [], 0.0, 0.0, []
        for i in ins:
            f = rec.get(int(i["ordem_abc"]))
            delta = _rec_num(f.get("delta_pct")) if f else None
            if delta is None:
                continue
            exc = delta - ipca
            vc = _rec_num(i.get("valor_contrato_bdi")) or 0.0
            vmed = _rec_num(i.get("valor_medido_bdi")) or 0.0
            if exc > 1e-4:
                potencial += exc * vc
                if vmed > 0:
                    repasse += exc * vmed
                acima.append(
                    {
                        "insumo": i.get("nome"),
                        "classe": i.get("classe"),
                        "fonte": f.get("rotulo"),
                        "delta_pct": delta,
                        "excedente_pct": round(exc, 6),
                        "potencial_rs": round(exc * vc, 2),
                        "repasse_real_rs": round(exc * vmed, 2) if vmed > 0 else 0,
                    }
                )
            if vmed > 0:
                medidos.append({"insumo": i.get("nome"), "valor_medido_bdi_rs": round(vmed, 2)})
        acima.sort(key=lambda r: r["excedente_pct"], reverse=True)

        # M1 — reajuste geral (cenários de data-base na série IPCA)
        serie = (
            supabase.table("obra_ipca_serie")
            .select("mes, indice, cenario_id, cenario_nome")
            .eq("contrato_id", obra_id)
            .not_.is_("cenario_id", "null")
            .execute()
            .data
            or []
        )
        saldo = _rec_num(h.get("saldo_a_executar"))
        i_atual = _rec_num(h.get("ipca_atual"))
        cen_ativo = h.get("cenario_m1_ativo")
        m1 = []
        for c in serie:
            i0 = _rec_num(c.get("indice"))
            if not (i0 and i_atual and saldo):
                continue
            var = (i_atual - i0) / i0
            m1.append(
                {
                    "cenario": c.get("cenario_nome"),
                    "id": c.get("cenario_id"),
                    "i0": i0,
                    "variacao_pct": round(var, 6),
                    "reajuste_rs": round(var * saldo, 2),
                    "ativo": c.get("cenario_id") == cen_ativo,
                }
            )

        out: dict[str, Any] = {
            "marco": "OS " + str(h.get("data_os")) if h.get("data_os") else None,
            "verificacao": h.get("data_verificacao"),
            "ipca_periodo_pct": ipca,
            "farol": "Observação" if potencial > 0 else "Conforme",
            "repasse_real_rs": round(repasse, 2),
            "potencial_se_tudo_medido_rs": round(potencial, 2),
            "n_insumos": len(ins),
            "n_acima_ipca": len(acima),
            "maior_excedente": acima[0] if acima else None,
            "acima_ipca_top": acima[:8],
            "insumos_medidos": medidos,
            "m1_reajuste_geral": {
                "formula": "R = [(I − I0) × P] / I0 · P = saldo a executar (contrato cheio − medido)",
                "saldo_a_executar_rs": saldo,
                "ipca_atual_indice": i_atual,
                "cenarios": m1,
            },
            "_nota": "Δ%/excedente em FRAÇÃO. repasse_real_rs = Σ excedente × valor MEDIDO (cl. 8.8, "
            "fatura direto — só brita+bica no BM03); potencial = excedente × valor de CONTRATO. Fonte "
            "recomendada por insumo (multifonte: SINAPI/DNIT/ANP/SBC/EMOP/SCO); presets nas telas "
            "C.6/D.5 mudam a base e o total em tempo real. À PARTE do desequilíbrio/claim.",
            "_proveniencia": {
                "tabelas": ["obra_insumos_fd", "obra_insumos_fd_fontes", "obra_insumos_reeq",
                            "obra_ipca_serie"],
                "versao": "v53",
            },
        }
        return _json(out)

    _adm_tools = [
        get_faturamento_resumo,
        get_produtividade_resumo,
        get_produtividade_economica_resumo,
        get_insumos_resumo,
        get_recursos_resumo,
        get_marcos_contratuais,
        get_marcos_cronograma_fonte,
        get_curva_fisica_por_frente,
        get_curva_prevista_fisica,
        get_desequilibrio_resumo,
        get_orcamento_resumo,
        get_bdi_buildup,
        get_curvas_resumo,
        get_mapa_liberacao_resumo,
        get_chuvas_resumo,
        get_panorama,
        buscar_secoes,
        get_insumos_excedente,
        get_condutas,
        get_plano_acao,
        get_indiretos_detalhe,
        get_bdi_desequilibrio,
        get_encargos_detalhe,
        get_valor_agregado,
        get_pontuais,
    ]
    # Fase B · fixa o headline de cada tool ao canônico de obra_kpis (== tela). Best-effort: sem linha
    # em obra_kpis ou erro → a tool segue com a computação própria. O gate de paridade pega stale.
    _adm_tools = [_pin_tool(t, obra_id) for t in _adm_tools]
    if return_callables:
        return {t.name: t.handler for t in _adm_tools}
    return create_sdk_mcp_server("admtools", "1.0.0", tools=_adm_tools)
