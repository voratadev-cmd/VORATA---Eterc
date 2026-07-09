"""Engine determinístico — interpreta a config e produz as entidades canônicas atômicas.

Rota por entidade (fatia-1): obra_medicao_itens ← tabela de medição; obra_medicao_totais ←
totais_declarados. Casa coluna por ALIAS normalizado (seletor robusto), coage por PERFIL,
roda resolvers (parse_nivel, competência) e o GATE de invariante. Falha-alto → needs_review.
ZERO LLM. ZERO formatação/farol (isso é camada de view).
"""

from __future__ import annotations

import re
import unicodedata

from agents.extracao import cells  # reusa parse_number (BR/US, negativo-paren, milhar…)

from .config import NormConfig, Perfil
from .gate import (
    gate_cronograma,
    gate_cronograma_tarefas,
    gate_faturamento,
    gate_insumos,
    gate_invariante,
    gate_orcamento,
)
from .resolvers import (
    extrair_cronograma_tarefas,
    extrair_cronograma_fisico_tabela,
    extrair_insumos_catalogo,
    extrair_insumos_histograma,
    extrair_insumos_valor,
    extrair_orcamento_base,
    extrair_orcamento_resumo,
    parse_nivel,
    resolver_competencia,
    unpivot_tabela_temporal,
    parse_mes_abbr,
    unpivot_temporal,
)


def _norm(s) -> str:  # noqa: ANN001
    """Normaliza nome de coluna/chave p/ casamento (igual cells/sanity: minúsculo, só alnum)."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _coerce(v, perfil: Perfil):  # noqa: ANN001
    """Coage o valor cru do envelope ao tipo do perfil. None se não-coercível (o gate pega)."""
    if v is None:
        return None
    if perfil is Perfil.CODIGO_DOTTED:
        return str(v).strip() or None
    if perfil in (Perfil.MONETARIO, Perfil.QUANTIDADE, Perfil.PRECO):
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return float(v)
        return cells.parse_number(v, "br") if isinstance(v, str) else None
    if perfil is Perfil.PERCENTUAL:  # '15,99%' → 0.1599 (fração)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return float(v)
        if isinstance(v, str):
            n = cells.parse_number(v.strip().rstrip("%").strip(), "br")
            return n / 100 if isinstance(n, (int, float)) and not isinstance(n, bool) else None
        return None
    if perfil in (Perfil.TEXTO, Perfil.UNIDADE, Perfil.DATA):
        return str(v).strip() or None
    return v


def _aliases_norm(campo) -> set[str]:  # noqa: ANN001
    return {_norm(a) for a in campo.coluna.alias_set}


def _pick_tabela(secoes: list, ent) -> dict | None:  # noqa: ANN001
    """Seleciona a seção-tabela alvo por melhor casamento de alias (papel tabela_medicao)."""
    tabs = [s for s in secoes if isinstance(s, dict) and s.get("tipo") == "tabela" and s.get("linhas")]
    if not tabs:
        return None
    todos_alias = set().union(*(_aliases_norm(c) for c in ent.campos)) if ent.campos else set()

    def score(s: dict) -> int:
        cols = {_norm(c) for c in (s.get("colunas") or [])}
        return len(cols & todos_alias)

    melhor = max(tabs, key=score)
    return melhor if score(melhor) > 0 else None


def _match_colunas(colunas: list, campos: list) -> tuple[dict, list]:
    """canonico → nome-de-coluna-real (1º alias que casa, normalizado). Falta = não casou."""
    norm_to_real: dict[str, str] = {}
    for c in colunas:
        norm_to_real.setdefault(_norm(c), c)
    colmap: dict[str, str] = {}
    faltando: list[str] = []
    for campo in campos:
        real = next((norm_to_real[a] for a in _aliases_norm(campo) if a in norm_to_real), None)
        if real is not None:
            colmap[campo.canonico] = real
        else:
            faltando.append(campo.canonico)
    return colmap, faltando


def normalizar(payload: dict, config: NormConfig, nome_original: str = "") -> dict:
    """Envelope → entidades canônicas. Retorna {entidades, status, findings, competencia, gate}."""
    out: dict = {"entidades": {}, "status": "ok", "findings": [], "competencia": None, "gate": None}
    secoes = payload.get("secoes") or []
    totais_dec = payload.get("totais_declarados") or {}

    itens_ent = next((e for e in config.entidades if e.entidade == "obra_medicao_itens"), None)
    totais_ent = next((e for e in config.entidades if e.entidade == "obra_medicao_totais"), None)

    def fail(msg: str) -> None:
        out["status"] = "needs_review"
        out["findings"].append({"severity": "error", "msg": msg})

    # ── obra_medicao_itens ──────────────────────────────────────────────
    itens: list[dict] = []
    if itens_ent:
        secao = _pick_tabela(secoes, itens_ent)
        if secao is None:
            fail("nenhuma tabela de medição casou os aliases (papel tabela_medicao)")
        else:
            colmap, faltando = _match_colunas(secao.get("colunas") or [], itens_ent.campos)
            if "numero_item" not in colmap:
                fail("coluna de código (numero_item) não casou nenhum alias — falha-alto")
            for ordem, row in enumerate(secao.get("linhas") or []):
                if not isinstance(row, dict):
                    continue
                it: dict = {"ordem": ordem}
                for campo in itens_ent.campos:
                    col = colmap.get(campo.canonico)
                    if col is None:
                        continue
                    val = _coerce(row.get(col), campo.coluna.perfil)
                    if val is not None:
                        it[campo.canonico] = val
                if "numero_item" not in it:
                    continue
                it["nivel"] = parse_nivel(it["numero_item"])
                itens.append(it)
            out["entidades"]["obra_medicao_itens"] = itens
            for f in faltando:  # transparência: campos cujo alias não casou (coluna ausente)
                out["findings"].append({"severity": "info", "msg": f"campo '{f}' sem coluna casada"})

    # ── obra_medicao_totais (de totais_declarados, por alias de chave) ──
    totais: dict = {}
    if totais_ent:
        for campo in totais_ent.campos:
            alias_norm = _aliases_norm(campo)
            real = next((k for k in totais_dec if _norm(k) in alias_norm), None)
            if real is not None:
                totais[campo.canonico] = _coerce(totais_dec[real], campo.coluna.perfil)
        # físico % do BM (mês + acumulado) → enriquece o oráculo de totais (frações 0..1)
        fis = _extrair_fisico_bm(payload)
        totais.update(fis["fisico"])
        out["findings"] += fis["findings"]
        out["entidades"]["obra_medicao_totais"] = totais

    # ── competência (chave de entidade · falha-alto) ────────────────────
    comp = resolver_competencia(payload, nome_original)
    out["competencia"] = comp
    if comp["status"] != "ok":
        fail(f"competência: {comp['motivo']}")

    # ── GATE de invariante (obrigatório) ────────────────────────────────
    gate = gate_invariante(itens, totais)
    out["gate"] = gate
    out["findings"] += gate["findings"]
    if gate["status"] != "ok":
        out["status"] = "needs_review"

    return out


def _extrair_fisico_bm(payload: dict) -> dict:
    """Físico % do BM (mês + acumulado) p/ enriquecer obra_medicao_totais — frações 0..1.
    A fatia-1 só capturava VALOR (R$); o % físico (executado) da LINHA-RAIZ do BM era descartado
    (perfil=quantidade rejeita a string '15,99%'). Aqui recuperamos:
    PRIMÁRIO  · identificacao.percentualNoPeriodo / percentualAcumulado (já frações, extraídas do PDF);
    CROSS-CHECK· a linha-raiz da tabela (Item '1': 'Quantidade no Período'='15,99%', acumulada='24,99%')
                — divergência > 0,5pp vira finding (honesto, não falha). Fallback p/ tabela se a
    identificacao não trouxer. Fora de [0,1] → não persiste (finding). Sem físico → {'fisico':{}}."""
    idt = payload.get("identificacao") or {}
    findings: list[dict] = []

    def _frac(v):  # noqa: ANN001
        # bool é subclasse de int — rejeita (mesmo padrão de _coerce: True não vira 1.0)
        return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    per = _frac(idt.get("percentualNoPeriodo"))
    acc = _frac(idt.get("percentualAcumulado"))

    # linha-raiz da tabela de medição (Item '1') — cross-check / fallback
    t_per = t_acc = None
    for s in payload.get("secoes") or []:
        if not isinstance(s, dict):
            continue
        for row in s.get("linhas") or []:
            if isinstance(row, dict) and str(row.get("Item", "")).strip() == "1":
                t_per = _coerce(row.get("Quantidade no Período"), Perfil.PERCENTUAL)
                t_acc = _coerce(row.get("Quantidade acumulada no Período"), Perfil.PERCENTUAL)
                break
        if t_per is not None or t_acc is not None:
            break

    if per is None:
        per = t_per
    if acc is None:
        acc = t_acc

    for nome, a, b in (("período", per, t_per), ("acumulado", acc, t_acc)):
        if a is not None and b is not None and abs(a - b) > 0.005:
            findings.append({"severity": "warn",
                             "msg": f"físico {nome}: identificacao={a} × tabela={b} divergem >0,5pp"})

    fisico: dict = {}
    for chave, val in (("fisico_pct_periodo", per), ("fisico_pct_acumulado", acc)):
        if val is None:
            continue
        if not 0.0 <= val <= 1.0:
            findings.append({"severity": "warn", "msg": f"{chave}={val} fora de [0,1] — não persistido"})
            continue
        fisico[chave] = round(val, 6)
    return {"fisico": fisico, "findings": findings}


def _achar_secao_cronograma(secoes: list) -> dict | None:
    """Acha a seção chave_valor que carrega a distribuição mensal do cronograma — por CONTEÚDO
    (uma chave de `dados` que parece distribuição mensal), não por título literal (que varia)."""
    for s in secoes:
        if not (isinstance(s, dict) and s.get("tipo") == "chave_valor" and isinstance(s.get("dados"), dict)):
            continue
        for k in s["dados"]:
            nk = _norm(k)
            if "distribuicaomensal" in nk or ("fisico" in nk and ("percent" in nk or "distribu" in nk)):
                return s
    return None


def _achar_secao_cronograma_tabela(secoes: list) -> dict | None:
    """Acha a seção TABELA (linhas+colunas) do cronograma físico-financeiro: tem coluna de EDT/EAP
    e ≥3 colunas-mês ('out.-25'). Ex.: Cronograma FF PDF standalone (não cabe no chave_valor)."""
    for s in secoes:
        if not (isinstance(s, dict) and isinstance(s.get("linhas"), list)):
            continue
        cols = s.get("colunas") or []
        tem_edt = any(_norm(c) in ("edt", "eap", "item", "codigo") for c in cols)
        tem_mes = sum(1 for c in cols if parse_mes_abbr(c)) >= 3
        if tem_edt and tem_mes:
            return s
    return None


def normalizar_cronograma(payload: dict, config: NormConfig, nome_original: str = "") -> dict:
    """Envelope do Cronograma Físico-Financeiro → entidade `obra_cronograma_previsto` (curva
    PREVISTA FÍSICA, 1 linha/competência) + header (custo total, datas). Determinístico, SEM
    LLM. GATE Σ% == 100% obrigatório → needs_review se não fechar. Falha-alto."""
    out: dict = {"entidades": {}, "status": "ok", "findings": [], "gate": None, "header": None}
    secoes = payload.get("secoes") or []
    ent = next((e for e in config.entidades if e.entidade == "obra_cronograma_previsto"), None)

    def fail(msg: str) -> None:
        out["status"] = "needs_review"
        out["findings"].append({"severity": "error", "msg": msg})

    if ent is None:
        fail("config sem entidade 'obra_cronograma_previsto'")
        return out
    secao = _achar_secao_cronograma(secoes)
    if secao is not None:
        # caminho CHAVE_VALOR (distribuição mensal transposta) — ex.: cronograma embutido no BM.
        res = unpivot_temporal(secao["dados"])
        if res["status"] != "ok":
            fail(f"unpivot_temporal: {res['motivo']}")
            return out
        meses = res["meses"]
        dados = secao["dados"]
        header = {"custo_total_obra": res["custo_total"]}
        for canon, needle in (("data_base", "database"), ("inicio_obra", "inicio"), ("termino_obra", "termino")):
            real = next((dados[k] for k in dados if needle in _norm(k) and isinstance(dados[k], str)), None)
            if real is not None:
                header[canon] = real
    else:
        # caminho TABELA (EDT × colunas-mês 'out.-25') — ex.: Cronograma FF PDF standalone.
        sec_tab = _achar_secao_cronograma_tabela(secoes)
        if sec_tab is None:
            fail("seção do cronograma (distribuição mensal) não encontrada (nem chave_valor nem tabela)")
            return out
        res_tab = extrair_cronograma_fisico_tabela(sec_tab)
        if res_tab["status"] != "ok":
            fail(f"cronograma (tabela física): {res_tab.get('findings')}")
            return out
        meses = res_tab["meses"]
        header = res_tab["header"]
    out["entidades"]["obra_cronograma_previsto"] = meses
    out["header"] = header

    gate = gate_cronograma(meses)
    out["gate"] = gate
    out["findings"] += gate["findings"]
    if gate["status"] != "ok":
        out["status"] = "needs_review"
    return out


def _achar_secao_por_titulo(secoes: list, *needles: str) -> dict | None:
    """Seção cujo TÍTULO normalizado contém todos os needles (já normalizados)."""
    for s in secoes:
        if isinstance(s, dict):
            t = _norm(s.get("titulo", ""))
            if all(nd in t for nd in needles):
                return s
    return None


def _resumo_sub_review(out: dict) -> list[str]:
    """Notas das sub-entidades INDEPENDENTES (orçamento, tarefas) que NÃO fecharam o gate. O doc
    de Medição acumulada produz 3 entidades independentes (curva de faturamento, orçamento,
    tarefas); cada uma persiste com seu próprio status. A curva boa NÃO deve ser derrubada por um
    orçamento quebrado — mas o arquivo também NÃO pode ser concluído 'normalized' em SILÊNCIO
    quando uma sub-entidade está em revisão (seria verde com área cega, a regra-mãe proibida).
    Esta lista alimenta o reason/log do arquivo no job. Pura/testável."""
    notas: list[str] = []
    for nome, chave in (("orçamento", "orcamento"), ("tarefas", "tarefas")):
        ent = out.get(chave)
        if ent and ent.get("status") != "ok":
            errs = [f["msg"] for f in (ent.get("gate") or {}).get("findings", [])
                    if f.get("severity") == "error"]
            notas.append(f"{nome} em revisão" + (f": {'; '.join(errs)}" if errs else ""))
    return notas


def normalizar_acumulada(payload: dict, config: NormConfig, nome_original: str = "") -> dict:
    """Medição acumulada (XLSX-ERP) → entidade `obra_faturamento_meses` (Curva S financeira:
    Contratado baseline + Projeção). Determinístico, SEM LLM. NÃO toca obra_medicoes (os BMs
    já estão limpos dos PDFs). Gate: Σ cada curva == custo total. Falha-alto."""
    out: dict = {"entidades": {}, "status": "ok", "findings": [], "gate": None, "header": None}
    secoes = payload.get("secoes") or []

    def fail(msg: str) -> None:
        out["status"] = "needs_review"
        out["findings"].append({"severity": "error", "msg": msg})

    # projeção = "mensal (valores ...)" (linha-raiz) · baseline = "diário" (folhas → mês)
    sec_proj = _achar_secao_por_titulo(secoes, "mensal", "valores")
    sec_base = _achar_secao_por_titulo(secoes, "diario")
    cr = config.codigos_raiz
    proj = (unpivot_tabela_temporal(sec_proj, modo="raiz", edt_key=cr.edt_key, edt_raiz=cr.edt_raiz)
            if sec_proj else None)
    base = (unpivot_tabela_temporal(sec_base, modo="folhas", edt_key=cr.edt_key, edt_raiz=cr.edt_raiz)
            if sec_base else None)

    proj_meses = proj["meses"] if proj and proj["status"] == "ok" else []
    base_meses = base["meses"] if base and base["status"] == "ok" else []
    proj_total = proj["total"] if proj and proj["status"] == "ok" else None
    base_total = base["total"] if base and base["status"] == "ok" else None
    if not proj_meses and not base_meses:
        fail("nenhuma curva financeira (projeção/baseline) extraível")
        return out

    by_key: dict = {}
    for m in base_meses:
        d = by_key.setdefault((m["ano"], m["mes"]), {})
        d["contratado_rs"] = m["valor"]
        d["contratado_rs_acumulado"] = m["valor_acumulado"]
    for m in proj_meses:
        d = by_key.setdefault((m["ano"], m["mes"]), {})
        d["projecao_rs"] = m["valor"]
        d["projecao_rs_acumulado"] = m["valor_acumulado"]
    meses = [
        {"ano": k[0], "mes": k[1], "ordem": ordem, **v}
        for ordem, (k, v) in enumerate(sorted(by_key.items()))
    ]
    out["entidades"]["obra_faturamento_meses"] = meses
    custo_total = proj_total or base_total
    out["header"] = {"custo_total": custo_total, "data_corte": None}

    gate_fat = gate_faturamento(proj_total, base_total, custo_total=custo_total)
    out["gate"] = gate_fat
    out["findings"] += gate_fat["findings"]
    if gate_fat["status"] != "ok":
        out["status"] = "needs_review"

    # ── orçamento (BASE1 preço-venda + Atividades custo/BDI) · entidade independente ──
    sec_base1 = _achar_secao_por_titulo(secoes, "base1")
    sec_ativ = _achar_secao_por_titulo(secoes, "atividades")
    if sec_base1 or sec_ativ:
        rb = extrair_orcamento_base(sec_base1) if sec_base1 else {"itens": [], "total": None}
        rr = (extrair_orcamento_resumo(sec_ativ, raiz_custo=cr.orcamento_custo,
                                       raiz_receita=cr.orcamento_receita) if sec_ativ else {})
        preco_venda = rb.get("total")
        custo_total_ativ = rr.get("custo_total_atividades")
        bdi = round(preco_venda / custo_total_ativ, 5) if preco_venda and custo_total_ativ else None
        gate_orc = gate_orcamento(preco_venda, rr, custo_total_obra=custo_total)
        out["entidades"]["obra_orcamento_itens"] = rb.get("itens", [])
        out["orcamento"] = {
            "resumo": {
                "preco_venda": preco_venda,
                "custo_direto": rr.get("custo_direto"),
                "custo_indireto": rr.get("custo_indireto"),
                "custo_total_atividades": custo_total_ativ,
                "receita": rr.get("receita"),
                "bdi": bdi,
            },
            "gate": gate_orc,
            "status": "ok" if gate_orc["status"] == "ok" else "needs_review",
        }
        out["findings"] += gate_orc["findings"]

    # ── cronograma-fonte MS-Project (tarefas/datas/marcos) · entidade independente ──
    sec_msp = _achar_secao_por_titulo(secoes, "cronograma", "msproject")
    if sec_msp:
        rt = extrair_cronograma_tarefas(sec_msp)
        gate_t = gate_cronograma_tarefas(rt)
        out["entidades"]["obra_cronograma_tarefas"] = rt.get("tarefas", [])
        out["tarefas"] = {
            "gate": gate_t,
            "status": "ok" if gate_t["status"] == "ok" else "needs_review",
            "n_distintos": rt.get("n_distintos"),
            "n_marcos": rt.get("n_marcos"),
            "profundidade": rt.get("profundidade"),
        }
        out["findings"] += gate_t["findings"]

    # visibilidade no nível do documento: sub-entidades independentes em revisão NÃO podem ficar
    # silenciosas só porque a curva fechou (o arquivo carrega o aviso no reason/log — ver job.py).
    out["sub_review"] = _resumo_sub_review(out)
    return out


def normalizar_insumos(payload: dict, config: NormConfig | None = None, nome_original: str = "") -> dict:
    """Histograma de Insumos por Quantidades → entidades `obra_insumos` (take-off por insumo) +
    `obra_insumo_meses` (distribuição mensal). Determinístico, SEM LLM. GATE de conservação
    (Σ células == Σ Total declarado) obrigatório → needs_review se não fechar. Preço/ABC ficam
    NULL (enriquecimento posterior pelo catálogo). `config` não é usado (doc auto-descritivo)."""
    out: dict = {"entidades": {}, "status": "ok", "findings": [], "gate": None, "header": None}
    secoes = payload.get("secoes") or []

    def fail(msg: str) -> None:
        out["status"] = "needs_review"
        out["findings"].append({"severity": "error", "msg": msg})

    secao = _achar_secao_por_titulo(secoes, "histograma", "insumos")
    if secao is None:
        fail("seção 'Histograma de Insumos' não encontrada")
        return out

    res = extrair_insumos_histograma(secao)
    out["entidades"]["obra_insumos"] = res.get("insumos", [])
    out["entidades"]["obra_insumo_meses"] = res.get("meses", [])
    out["header"] = {"n_insumos": res.get("n_insumos"), "n_folhas": res.get("n_folhas")}

    gate = gate_insumos(res)
    out["gate"] = gate
    out["findings"] += gate["findings"]
    if res.get("status") != "ok" or gate["status"] != "ok":
        out["status"] = "needs_review"
    return out


def enriquecer_insumos_com_catalogo(insumos: list[dict], catalogo_payload: dict) -> dict:
    """ENRIQUECE o take-off físico (insumos do Histograma de Quantidades) com classe ABC + grupo de
    custo do Cadastro de Insumos (sheet do Cronograma curva ABC) — join determinístico por CÓDIGO.
    NÃO toca PREÇO: o catálogo é pântano (0/absurdo) → `preco_orcado_unit` fica NULL até o trabalho
    de preço-real × índice. Devolve NOVA lista (não muta a de entrada, não altera qtde) + cobertura.
    Insumo sem match no catálogo mantém classe_abc/grupo_custo None e vira finding — honesto, não
    falha. Cross-doc: o histograma e o catálogo são DOIS envelopes; o orquestrador (builder/job)
    passa ambos."""
    secoes = (catalogo_payload or {}).get("secoes") or []
    sec_cat = _achar_secao_por_titulo(secoes, "cadastro", "insumos")
    if sec_cat is None:
        return {
            "insumos": [dict(i) for i in insumos], "n_catalogo": 0, "n_enriquecidos": 0,
            "sem_catalogo": [i.get("codigo") for i in insumos], "status": "needs_review",
            "findings": [{"severity": "error", "msg": "seção 'Cadastro de Insumos' não encontrada"}],
        }
    cat = extrair_insumos_catalogo(sec_cat)
    por_cod = cat["por_codigo"]
    enriquecidos: list[dict] = []
    sem_catalogo: list[str] = []
    for i in insumos:
        novo = dict(i)                              # preserva qtde_total e tudo do take-off
        meta = por_cod.get(i.get("codigo"))
        if meta:
            novo["classe_abc"] = meta.get("classe_abc")
            novo["grupo_custo"] = meta.get("grupo_custo")
        else:
            novo.setdefault("classe_abc", None)
            novo.setdefault("grupo_custo", None)
            sem_catalogo.append(i.get("codigo"))
        enriquecidos.append(novo)
    findings = list(cat.get("findings") or [])
    if sem_catalogo:
        findings.append({"severity": "warn",
                         "msg": f"{len(sem_catalogo)} insumo(s) sem catálogo (classe NULL): "
                                f"{sem_catalogo[:5]}"})
    return {"insumos": enriquecidos, "n_catalogo": cat["n"],
            "n_enriquecidos": len(insumos) - len(sem_catalogo),
            "sem_catalogo": sem_catalogo, "findings": findings, "status": "ok"}


def enriquecer_insumos_com_valor(insumos: list[dict], valor_payload: dict) -> dict:
    """ENRIQUECE o take-off com o VALOR ORÇADO (R$) por insumo, do Histograma de Insumos por Valor
    (doc SEPARADO — cross-doc). Join determinístico por CÓDIGO. REFERÊNCIA orçada, não preço de
    centavo (ver extrair_insumos_valor). Insumo sem match mantém valor_orcado None (finding, não
    falha). NÃO muta a lista de entrada (devolve nova)."""
    secoes = (valor_payload or {}).get("secoes") or []
    sec_val = _achar_secao_por_titulo(secoes, "histograma", "valor")
    if sec_val is None:
        return {"insumos": [dict(i) for i in insumos], "n_valor": 0, "n_enriquecidos": 0,
                "total_valor": None, "sem_valor": [i.get("codigo") for i in insumos],
                "status": "needs_review",
                "findings": [{"severity": "error",
                              "msg": "seção 'Histograma de Insumos por Valor' não encontrada"}]}
    res = extrair_insumos_valor(sec_val)
    por_cod = {it["codigo"]: it["valor_orcado"] for it in res["itens"]}
    enriquecidos: list[dict] = []
    sem_valor: list[str] = []
    for i in insumos:
        novo = dict(i)
        v = por_cod.get(i.get("codigo"))
        if v is not None:
            novo["valor_orcado"] = v
        else:
            novo.setdefault("valor_orcado", None)
            sem_valor.append(i.get("codigo"))
        enriquecidos.append(novo)
    findings = list(res.get("findings") or [])
    if sem_valor:
        findings.append({"severity": "warn",
                         "msg": f"{len(sem_valor)} insumo(s) sem valor orçado (NULL): {sem_valor[:5]}"})
    return {"insumos": enriquecidos, "n_valor": res["n"],
            "n_enriquecidos": len(insumos) - len(sem_valor),
            "total_valor": res["total_valor"], "sem_valor": sem_valor,
            "findings": findings, "status": "ok"}
