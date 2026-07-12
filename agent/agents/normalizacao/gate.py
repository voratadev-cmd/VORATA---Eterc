"""GATE de invariante numérica — OBRIGATÓRIO, não opcional. Sem ele a config dá falsa
sensação de determinismo (alias certo + semântica errada: 'Valor' casa mas é o acumulado;
o deslocamento de coluna já mordeu o projeto no PSQ). Reusa a ideia do _check_sums da
extração: soma só as FOLHAS (o pai já é a soma dos filhos) e confere com o total declarado.

Falha-alto: qualquer error → a medição vira needs_review; NUNCA grava soma errada em silêncio.
"""

from __future__ import annotations

from .resolvers import folhas_idx, rollup_hierarquico

_TOL_MIN = 0.02


def gate_invariante(
    itens: list[dict],
    totais: dict,
    *,
    valor_field: str = "valor_medido_periodo",
    total_field: str = "total_periodo_valor",
) -> dict:
    """Confere Σ(folhas[valor_field]) ≈ totais[total_field] + rollup pai==Σfilhos.
    Retorna {status, findings, soma_folhas, total_declarado}."""
    findings: list[dict] = []

    # 1) Soma das FOLHAS vs total declarado (a invariante principal).
    leaves = folhas_idx(itens)
    soma = 0.0
    n = 0
    for i in leaves:
        v = itens[i].get(valor_field)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            soma += float(v)
            n += 1
    total = totais.get(total_field)
    if total is not None and isinstance(total, (int, float)) and n > 0:
        tol = max(_TOL_MIN, n * 0.01)
        if abs(soma - float(total)) > tol:
            findings.append({
                "severity": "error",
                "campo": valor_field,
                "msg": f"Σ folhas ({soma:.2f}) ≠ {total_field} declarado ({float(total):.2f}) "
                       f"[tol {tol:.2f} · {n} folhas]",
            })
    elif total is None:
        findings.append({
            "severity": "warn",
            "campo": total_field,
            "msg": f"sem '{total_field}' declarado — soma de {valor_field} NÃO conferida",
        })

    # 2) Rollup hierárquico (pai == Σ filhos diretos).
    findings += rollup_hierarquico(itens, valor_field)

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {
        "status": status,
        "findings": findings,
        "soma_folhas": round(soma, 2),
        "total_declarado": total,
    }


_TOL_PCT = 0.01  # 1 ponto percentual de folga no fechamento da curva física


def gate_cronograma(meses: list[dict], *, pct_field: str = "previsto_pct") -> dict:
    """Invariante da curva PREVISTA FÍSICA: Σ(% mensal) == 1,0 (100%). Falha-alto: curva que
    não fecha 100% → needs_review (mês faltando / PDF parcial). Confere competência duplicada.
    NÃO gateia o financeiro (parcial por design — o doc traz só parte legível)."""
    findings: list[dict] = []
    soma = 0.0
    n = 0
    vistos: set[tuple] = set()
    for m in meses:
        v = m.get(pct_field)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            soma += float(v)
            n += 1
        chave = (m.get("ano"), m.get("mes"))
        if chave in vistos:
            findings.append({"severity": "error", "campo": "competencia",
                             "msg": f"competência duplicada: {chave[0]}-{chave[1]}"})
        vistos.add(chave)
    if n == 0:
        findings.append({"severity": "error", "campo": pct_field,
                         "msg": "nenhum % físico mensal — curva prevista vazia"})
    elif abs(soma - 1.0) > _TOL_PCT:
        findings.append({"severity": "error", "campo": pct_field,
                         "msg": f"Σ% físico ({soma * 100:.2f}%) ≠ 100% [tol {_TOL_PCT * 100:.0f}pp · {n} meses]"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_pct": round(soma, 6), "n_meses": n}


def gate_faturamento(proj_total, base_total, *, custo_total=None):  # noqa: ANN001
    """Invariante das 2 curvas R$ do Faturamento: Σ(projeção) == Σ(baseline) == custo total.
    Falha-alto se divergir (folha perdida / dupla contagem / raiz+folha somados). Pelo menos
    UMA curva precisa existir e fechar."""
    findings: list[dict] = []
    tot = custo_total or proj_total or base_total
    presentes = 0
    for nome, v in (("projecao", proj_total), ("baseline", base_total)):
        if v is None:
            findings.append({"severity": "warn", "campo": nome, "msg": f"curva {nome} ausente"})
            continue
        presentes += 1
        if tot and abs(float(v) - float(tot)) > max(1.0, abs(float(tot)) * 0.0001):
            findings.append({"severity": "error", "campo": nome,
                             "msg": f"Σ {nome} ({float(v):.2f}) ≠ custo total ({float(tot):.2f})"})
    if presentes == 0:
        findings.append({"severity": "error", "campo": "curvas", "msg": "nenhuma curva financeira extraída"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "proj_total": proj_total,
            "base_total": base_total, "custo_total": tot}


def gate_orcamento(base_total, resumo: dict, *, custo_total_obra=None):  # noqa: ANN001
    """Invariante do orçamento: Σ(folhas BASE1) == preço de venda (== custo total do contrato).
    Falha-alto se a soma do orçamento de venda não fechar. O resumo de custo (direto/indireto)
    é conferido como presença (não soma — viria de outra base)."""
    findings: list[dict] = []
    alvo = custo_total_obra or base_total
    if base_total is None:
        findings.append({"severity": "error", "campo": "base", "msg": "orçamento base (BASE1) vazio"})
    elif alvo and abs(float(base_total) - float(alvo)) > max(1.0, abs(float(alvo)) * 0.0001):
        findings.append({"severity": "error", "campo": "base",
                         "msg": f"Σ BASE1 ({float(base_total):.2f}) ≠ custo total ({float(alvo):.2f})"})
    if not resumo or resumo.get("custo_direto") is None:
        findings.append({"severity": "warn", "campo": "resumo",
                         "msg": "resumo de custo (direto/indireto) ausente"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "base_total": base_total, "alvo": alvo}


def gate_cronograma_tarefas(res: dict):
    """Gate ESTRUTURAL do cronograma-fonte (sem invariante de Σ monetária): precisa ter tarefas
    e a raiz EDT='1' com datas início/término. Marcos/profundidade são informativos (tolerante)."""
    findings: list[dict] = []
    tarefas = res.get("tarefas", [])
    if not tarefas:
        findings.append({"severity": "error", "campo": "tarefas", "msg": "nenhuma tarefa de cronograma"})
    raiz = next((t for t in tarefas if t.get("numero_item") == "1"), None)
    if raiz is None or not raiz.get("data_inicio") or not raiz.get("data_termino"):
        findings.append({"severity": "error", "campo": "raiz",
                         "msg": "raiz EDT='1' sem datas início/término (estrutura inesperada)"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings,
            "n_distintos": res.get("n_distintos"), "n_marcos": res.get("n_marcos")}


def gate_insumos(res: dict) -> dict:
    """Invariante do take-off físico de insumos: a distribuição mensal CONSERVA o total
    declarado. Confere (1) Σ células mensais == Σ 'Total' declarado (doc inteiro) e (2) Σ
    qtde_total dos insumos == Σ qtde das linhas-mês (a agregação não perdeu/duplicou célula).
    Falha-alto. Unidades NÃO são somadas semanticamente — isto é pura conservação numérica de
    extração (cada linha 'Total' na sua unidade == Σ seus meses na mesma unidade)."""
    findings: list[dict] = list(res.get("findings", []))
    cells = res.get("total_geral")
    decl = res.get("soma_total_declarado")
    n = res.get("n_folhas", 0) or 0

    if cells is not None and decl is not None and n > 0:
        tol = max(_TOL_MIN, n * 0.01)
        if abs(float(cells) - float(decl)) > tol:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"Σ células ({float(cells):.2f}) ≠ Σ Total declarado "
                                    f"({float(decl):.2f}) [tol {tol:.2f} · {n} folhas]"})
    else:
        findings.append({"severity": "error", "campo": "conservacao",
                         "msg": "histograma sem células/Total — nada a conferir"})

    si = round(sum(float(i.get("qtde_total") or 0) for i in res.get("insumos", [])), 4)
    sm = round(sum(float(m.get("qtde") or 0) for m in res.get("meses", [])), 4)
    n_ins = len(res.get("insumos", []))
    if abs(si - sm) > max(_TOL_MIN, n_ins * 0.01):
        findings.append({"severity": "error", "campo": "agregacao",
                         "msg": f"Σ qtde_total insumos ({si:.2f}) ≠ Σ qtde meses ({sm:.2f})"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings,
            "soma_cells": cells, "soma_declarado": decl,
            "n_insumos": res.get("n_insumos"), "n_violacoes_linha": res.get("n_violacoes_linha")}


def gate_insumos_abc(res: dict) -> dict:
    """Invariante da Curva ABC de materiais (workbook-motor C.6): Σ valor_orcado == TOTAL de
    materiais declarado (companion C.6 Parâmetros) + Σ % total == 1,0 + 0 violações de linha
    (valor == qtde × preço orçado). Falha-alto: divergência → needs_review (nunca grava ABC
    'mais ou menos'). O eixo de preço REAL ausente é warn (não error) — é dado faltante honesto,
    não grade torta; o farol de desvio fica pendente na Camada B."""
    findings: list[dict] = list(res.get("findings", []))
    soma = res.get("soma_valor")
    decl = res.get("total_declarado")

    if soma is not None and decl is not None:
        tol = max(1.0, abs(float(decl)) * 0.0001)
        if abs(float(soma) - float(decl)) > tol:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"Σ custo ({float(soma):.2f}) ≠ TOTAL materiais declarado "
                                    f"({float(decl):.2f}) [tol {tol:.2f}]"})
    elif decl is None:
        findings.append({"severity": "warn", "campo": "total_declarado",
                         "msg": "sem TOTAL de materiais declarado — Σ custo NÃO conferida"})

    pct = res.get("soma_pct")
    if pct is not None and abs(float(pct) - 1.0) > 0.01:
        findings.append({"severity": "error", "campo": "pct",
                         "msg": f"Σ % total ({float(pct) * 100:.2f}%) ≠ 100% [tol 1pp]"})

    nviol = res.get("n_violacoes_linha", 0) or 0
    if nviol > 0:
        findings.append({"severity": "error", "campo": "linha",
                         "msg": f"{nviol} linha(s) com Custo total ≠ Qtde × Preço orçado"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_valor": soma,
            "total_declarado": decl, "n_insumos": res.get("n_insumos")}


def gate_recursos(res: dict, histo: dict | None = None) -> dict:
    """Conservação do plano de recursos (C.4) por categoria, com DEFESA EM PROFUNDIDADE — robusto a
    workbooks que NÃO trazem a seção de Totais (o título/estrutura varia entre obras):
      • âncora FORTE (quando há): Σ(itens contratado) == TOTAL declarado → divergência = ERROR.
      • CRUZAMENTO per-recurso × histograma mensal (2 representações do MESMO plano):
          - per-recurso > histograma → ERROR (não pode exceder o total mensal: shift de coluna/dup).
          - per-recurso < histograma → WARN (lista por função PARCIAL = área-cega, ex.: MOI 662<683).
          - igual → conservado.
      • sem NENHUMA âncora (sem Totais e sem histograma) → WARN (não dá pra conferir; honesto).
    Período não-parseável do histograma e eixo REAL vazio já chegam como findings de res/histo."""
    findings: list[dict] = list(res.get("findings", []))
    if histo and isinstance(histo.get("findings"), list):
        findings.extend(histo["findings"])  # ex.: período não-parseável do histograma
    por = res.get("por_categoria", {}) or {}
    decl = res.get("declarados", {}) or {}

    def _hsoma(cat: str, campo: str):
        if not histo or not isinstance(histo.get("soma_hist"), dict):
            return None
        return (histo["soma_hist"].get(cat) or {}).get(campo)

    def _conservar(cat: str, eixo: str, val: float, alvo_decl, hsoma, piso: float) -> None:
        """Confere `val` (Σ per-recurso) contra a âncora declarada (forte) e/ou o histograma."""
        if alvo_decl is not None:
            tol = max(piso, abs(float(alvo_decl)) * 0.0001)
            if abs(float(val) - float(alvo_decl)) > tol:
                findings.append({"severity": "error", "campo": f"{cat}.{eixo}",
                                 "msg": f"Σ {cat} {eixo} ({float(val):.2f}) ≠ TOTAL declarado "
                                        f"({float(alvo_decl):.2f}) [tol {tol:.2f}]"})
        if hsoma is not None:
            tol = max(piso, abs(float(hsoma)) * 0.0001)
            diff = float(val) - float(hsoma)
            if diff > tol:
                findings.append({"severity": "error", "campo": f"{cat}.{eixo}.histograma",
                                 "msg": f"Σ {cat} {eixo} por recurso ({float(val):.2f}) > histograma "
                                        f"({float(hsoma):.2f}) — não pode exceder o total mensal"})
            elif diff < -tol:
                findings.append({"severity": "warn", "campo": f"{cat}.{eixo}.histograma",
                                 "msg": f"{cat} {eixo}: lista por recurso (Σ {float(val):.2f}) < histograma "
                                        f"({float(hsoma):.2f}) — lista por função parcial (área-cega)"})

    for categoria in ("MOD", "MOI", "EQP"):
        p = por.get(categoria)
        d = decl.get(categoria) or {}
        alvo_q, alvo_rs = d.get("contratado_qtde"), d.get("contratado_rs")
        hq, hrs = _hsoma(categoria, "q"), _hsoma(categoria, "rs")
        if p is None:
            if alvo_q is not None or alvo_rs is not None:
                findings.append({"severity": "error", "campo": f"{categoria}.ausente",
                                 "msg": f"{categoria} declarada nos Totais mas sem tabela por recurso "
                                        "extraída — seção ausente/estrutura não casou"})
            elif hq:
                findings.append({"severity": "warn", "campo": f"{categoria}.ausente",
                                 "msg": f"{categoria} no histograma (Σ {float(hq):.0f}) mas sem tabela por "
                                        "recurso — sem detalhe por função"})
            continue
        if alvo_q is None and hq is None:
            findings.append({"severity": "warn", "campo": f"{categoria}.qtde",
                             "msg": f"{categoria}: sem Totais e sem histograma — Σ qtde NÃO conferida"})
        else:
            _conservar(categoria, "qtde", p["soma_qtde"], alvo_q, hq, _TOL_MIN)
        if p["soma_rs"] is not None:  # R$ por recurso (MOD/EQP) — confere; MOI vem qtde-only
            _conservar(categoria, "rs", p["soma_rs"], alvo_rs, hrs, 1.0)
        elif alvo_rs or hrs:
            findings.append({"severity": "warn", "campo": f"{categoria}.rs",
                             "msg": f"{categoria}: R$ só agregado (histograma/Totais), sem R$ por função"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "por_categoria": por, "declarados": decl,
            "n_itens": res.get("n_itens")}


def gate_faturamento_workbook(res: dict) -> dict:
    """Conservação da curva de Faturamento (workbook-motor C.3) contra os cards (KV): Σ contratado
    == contratadoTotal e Σ real == realAcumAteBM. Falha-alto na divergência. Sem cards (sem âncora)
    → warn (não dá pra conferir). Acumulados já vêm RECOMPUTADOS pelo resolver (não da fonte)."""
    findings: list[dict] = list(res.get("findings", []))
    cards = res.get("cards") or {}
    soma_c, soma_r = res.get("soma_contratado"), res.get("soma_real")
    alvo_c = cards.get("contratadoTotal")
    alvo_r = cards.get("realAcumAteBM")

    def _conf(nome: str, soma, alvo) -> None:  # noqa: ANN001
        if alvo is None:
            findings.append({"severity": "warn", "campo": nome,
                             "msg": f"sem card-âncora p/ {nome} — Σ NÃO conferida"})
            return
        try:
            a = float(alvo)
        except (TypeError, ValueError):
            return
        if soma is None:
            return
        tol = max(1.0, abs(a) * 0.0001)
        if abs(float(soma) - a) > tol:
            findings.append({"severity": "error", "campo": nome,
                             "msg": f"Σ {nome} ({float(soma):.2f}) ≠ card ({a:.2f}) [tol {tol:.2f}]"})

    _conf("contratado", soma_c, alvo_c)
    _conf("real", soma_r, alvo_r)
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_contratado": soma_c, "soma_real": soma_r}


def gate_produtividade_economica(res: dict) -> dict:
    """Conservação da série de produtividade econômica (C.7): Σ hh_previsto == card hhTotalPrevisto.
    Falha-alto na divergência; sem card → warn (sem âncora). HH real parcial é honesto (não gateia)."""
    findings: list[dict] = list(res.get("findings", []))
    cards = res.get("cards") or {}
    soma = res.get("soma_hh_previsto")
    alvo = cards.get("hhTotalPrevisto")
    if alvo is not None and soma is not None:
        try:
            a = float(alvo)
        except (TypeError, ValueError):
            a = None
        if a is not None and abs(float(soma) - a) > max(1.0, abs(a) * 0.0001):
            findings.append({"severity": "error", "campo": "hh_previsto",
                             "msg": f"Σ HH previsto ({float(soma):.0f}) ≠ card hhTotalPrevisto ({a:.0f})"})
    elif alvo is None:
        findings.append({"severity": "warn", "campo": "hh_previsto",
                         "msg": "sem card hhTotalPrevisto — Σ HH NÃO conferida"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_hh_previsto": soma}


def gate_bdi(res: dict, pv_anchor: float | None = None) -> dict:
    """Conservação do BDI (C.1 · FONTE-MÃE), livre de hierarquia: (1) CD = valor/(%CD) CONSTANTE
    célula-a-célula (prova de leitura correta — valor/%CD mal-lido diverge); (2) CD + markup(Σ
    folhas) ≈ PV (âncora do Guia, se vier). Falha-alto na divergência."""
    findings: list[dict] = list(res.get("findings", []))
    rubricas = res.get("rubricas") or []
    cd = res.get("cd_implicito")
    if cd:
        for r in rubricas:
            v, p = r.get("valor_rs"), r.get("pct_custo_direto")
            if v and p:
                cd_i = v / p
                if abs(cd_i - cd) > max(1000.0, cd * 0.002):
                    findings.append({"severity": "error", "campo": "cd",
                                     "msg": f"rubrica '{r['descricao'][:28]}': CD implícito "
                                            f"{cd_i:,.0f} ≠ {cd:,.0f} (valor ou %CD mal-lido)"})
    markup = res.get("soma_folhas_rs")
    if pv_anchor and cd and markup is not None:
        pv_calc = cd + markup
        if abs(pv_calc - pv_anchor) > max(1e5, pv_anchor * 0.005):
            findings.append({"severity": "error", "campo": "pv",
                             "msg": f"CD+markup ({pv_calc:,.0f}) ≠ PV âncora ({pv_anchor:,.0f})"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "cd": cd, "markup": markup}


def gate_desequilibrio(res: dict, total_declarado: float | None = None) -> dict:
    """Conservação do D.0 Painel Desequilíbrio: Σ categorias == total declarado (card/Dashboard), se
    vier. Sem total → warn (Σ não conferida). Falha-alto na divergência."""
    findings: list[dict] = list(res.get("findings", []))
    soma = res.get("soma_rs")
    if total_declarado is not None and soma is not None:
        if abs(soma - total_declarado) > max(1.0, abs(total_declarado) * 0.0001):
            findings.append({"severity": "error", "campo": "total",
                             "msg": f"Σ categorias ({soma:.2f}) ≠ total declarado ({total_declarado:.2f})"})
    elif total_declarado is None:
        findings.append({"severity": "warn", "campo": "total", "msg": "sem total declarado — Σ NÃO conferida"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_rs": soma}


def gate_indiretos(res: dict, total_d0: float | None = None) -> dict:
    """Conservação do D.1 Indiretos: o desequilíbrio do MÉTODO ATIVO (M2.2 = gasto − medido) ==
    o valor de Custos Indiretos no D.0 Painel (cross-check inter-seção). NÃO soma cenários
    (redução/extensão alimentam o D.10). Sem D.0 → warn. Falha-alto na divergência."""
    findings: list[dict] = list(res.get("findings", []))
    total = res.get("desequilibrio_total")
    canteiro = res.get("canteiro_rs")
    if total_d0 is not None and total is not None:
        # O D.0 compõe Adm Local (método ativo) + Canteiro quando a obra o quantifica em separado.
        composto = total + (canteiro if isinstance(canteiro, float) else 0.0)
        if abs(composto - total_d0) > max(1.0, abs(total_d0) * 0.0001):
            findings.append({"severity": "error", "campo": "composicao",
                             "msg": (f"composição D.1 (ativo {total:.2f}"
                                     + (f" + canteiro {canteiro:.2f}" if isinstance(canteiro, float) else "")
                                     + f" = {composto:.2f}) ≠ Custos Indiretos no D.0 ({total_d0:.2f})")})
    elif total_d0 is None:
        findings.append({"severity": "warn", "campo": "composicao", "msg": "sem D.0 — composição NÃO cruzada"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "desequilibrio_total": total}


def gate_condutas(res: dict) -> dict:
    """Conservação do catálogo de Condutas (C.11): n condutas == card condutasSugeridasTotal."""
    findings: list[dict] = list(res.get("findings", []))
    n, alvo = res.get("n_condutas"), res.get("total_card")
    if alvo is not None and n is not None and n != alvo:
        findings.append({"severity": "error", "campo": "total",
                         "msg": f"n condutas ({n}) ≠ card condutasSugeridasTotal ({alvo})"})
    elif alvo is None:
        findings.append({"severity": "warn", "campo": "total", "msg": "sem card total — n NÃO conferido"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n_condutas": n}


def gate_curvas_c8(res: dict, faturamento_real_acum: float | None = None) -> dict:
    """Conservação do C.8: executado_acum == faturamento real acumulado (cross-check inter-seção)."""
    findings: list[dict] = list(res.get("findings", []))
    ex = res.get("executado_acum")
    if faturamento_real_acum is not None and ex is not None:
        if abs(ex - faturamento_real_acum) > max(1.0, abs(faturamento_real_acum) * 0.0001):
            findings.append({"severity": "error", "campo": "executado",
                             "msg": f"executado C.8 ({ex:.2f}) ≠ faturamento real ({faturamento_real_acum:.2f})"})
    elif faturamento_real_acum is None:
        findings.append({"severity": "warn", "campo": "executado", "msg": "sem faturamento real — executado NÃO cruzado"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_chuvas(res: dict) -> dict:
    """Sanidade do C.9: chuva_prev_acum do último mês ≈ Σ chuva prevista (monotônico/coerente)."""
    findings: list[dict] = list(res.get("findings", []))
    meses = res.get("meses") or []
    if meses:
        soma = sum(m["chuva_prev_mm"] for m in meses if m.get("chuva_prev_mm"))
        ult = meses[-1].get("chuva_prev_acum")
        if isinstance(ult, float) and soma and abs(ult - soma) > max(1.0, soma * 0.01):
            findings.append({"severity": "warn", "campo": "acum",
                             "msg": f"prev_acum final ({ult:.0f}) ≠ Σ prevista ({soma:.0f})"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_faturamento_frentes(res: dict, pv: float | None = None, contratado_corte: float | None = None) -> dict:
    """Conservação do C.3 Por frente: Σ Contratado Total == PV · Σ Contratado Acum == contratado-no-corte."""
    findings: list[dict] = list(res.get("findings", []))
    st, sa = res.get("soma_contratado_total"), res.get("soma_contratado_acum")
    if pv is not None and st is not None and abs(st - pv) > max(1.0, abs(pv) * 0.0001):
        findings.append({"severity": "error", "campo": "total", "msg": f"Σ Contratado Total ({st:.0f}) ≠ PV ({pv:.0f})"})
    if contratado_corte is not None and sa is not None and abs(sa - contratado_corte) > max(1.0, abs(contratado_corte) * 0.001):
        findings.append({"severity": "error", "campo": "acum", "msg": f"Σ Contratado Acum ({sa:.0f}) ≠ corte ({contratado_corte:.0f})"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_faturamento_frente_trecho(res: dict, pv: float | None = None) -> dict:
    """Conservação do C.3 Frente×Trecho: Σ Contratado ≈ PV (tolera arredondamento do rateio por
    trecho · 0,1%). Real é input pendente → não entra no gate."""
    findings: list[dict] = list(res.get("findings", []))
    soma = res.get("soma_contratado")
    if pv is not None and soma is not None and abs(soma - pv) > max(1.0, abs(pv) * 0.001):
        findings.append({"severity": "error", "campo": "contratado",
                         "msg": f"Σ Contratado frente×trecho ({soma:.0f}) ≠ PV ({pv:.0f})"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_faturamento_disciplina_mes(
    res: dict, pv: float | None = None, curva_por_mes: dict | None = None
) -> dict:
    """Conservação da MATRIZ disciplina×mês (C.3, explosão 2D da curva):
      (1) Σ matriz PREVISTO == PV (== Σ da curva C.3) — tolerância 0,01% (arredondamento do rateio).
      (2) cross-check por mês: Σ matriz[mês] == curva mensal contratada (pega shift de coluna/mês).
    Sem PV/curva → warn (sem âncora, Σ NÃO conferida). Real é pendente → fora do gate."""
    findings: list[dict] = list(res.get("findings", []))
    soma = res.get("soma_previsto")
    if pv is not None and soma is not None:
        if abs(soma - pv) > max(1.0, abs(pv) * 0.0001):
            findings.append({"severity": "error", "campo": "total",
                             "msg": f"Σ matriz ({soma:.0f}) ≠ PV/curva ({pv:.0f})"})
    elif pv is None:
        findings.append({"severity": "warn", "campo": "total",
                         "msg": "sem PV/curva — Σ matriz NÃO conferida"})
    # cross-check por mês (mesma chave (ano,mes) que a curva): Σ matriz[mês] == curva[mês].
    if curva_por_mes:
        spm = res.get("soma_por_mes") or {}
        ndiv = 0
        for k, v_matriz in spm.items():
            v_curva = curva_por_mes.get(k)
            if v_curva is None:
                continue  # mês ausente na curva → não cruza (a curva é a fonte canônica)
            if abs(v_matriz - float(v_curva)) > max(1.0, abs(float(v_curva)) * 0.0001):
                ndiv += 1
        if ndiv:
            findings.append({"severity": "error", "campo": "mes",
                             "msg": f"{ndiv} mês(es) com Σ matriz ≠ curva mensal (shift de coluna/mês?)"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_previsto": soma}


def gate_cronograma_frente_mes(res: dict, snapshot_por_disc: dict | None = None) -> dict:
    """Conservação da MATRIZ FÍSICA disciplina×mês (C.5 · % previsto acum):
      (1) ÂNCORA TIGHT — a coluna de CORTE da matriz == snapshot "Atraso físico por disciplina
          (% previsto até BM)" por disciplina (mesma fonte, 2 representações → bate exato).
      (2) MONOTÔNICO — % acumulado não-decrescente por disciplina (curva acumulada não pode cair).
    Sem snapshot → warn (só monotônico conferido). Real é pendente → fora do gate."""
    findings: list[dict] = list(res.get("findings", []))
    por: dict = {}
    for ln in res.get("linhas") or []:
        por.setdefault(ln["disciplina"], {})[ln["mes_num"]] = ln.get("previsto_pct")

    # (2) monotônico
    for disc, serie in por.items():
        seq = [serie[m] for m in sorted(serie) if serie[m] is not None]
        if any(seq[i + 1] < seq[i] - 1e-4 for i in range(len(seq) - 1)):
            findings.append({"severity": "error", "campo": "monotonico",
                             "msg": f"{disc[:24]}: % físico acumulado decresce (não-monotônico)"})

    # (1) âncora do snapshot: acha a coluna de corte que casa o snapshot p/ TODAS as disciplinas
    if snapshot_por_disc:
        meses = sorted({m for serie in por.values() for m in serie})

        def _cell(disc: str, m: int):
            for d in por:
                if d[:8] == disc[:8]:
                    return por[d].get(m)
            return None

        best_col, best_err = None, None
        for m in meses:
            err, n = 0.0, 0
            for disc, snap in snapshot_por_disc.items():
                cell = _cell(disc, m)
                if cell is not None:
                    err += abs(cell - snap)
                    n += 1
            if n >= max(1, len(snapshot_por_disc) // 2):
                if best_err is None or err < best_err:
                    best_err, best_col = err, m
        if best_col is None:
            findings.append({"severity": "warn", "campo": "corte",
                             "msg": "snapshot não casou nenhuma coluna da matriz"})
        elif best_err > 0.01:  # Σ|Δ| em fração entre todas as disciplinas (~1pp total) — tight
            findings.append({"severity": "error", "campo": "corte",
                             "msg": f"matriz[M{best_col:02d}] ≠ snapshot por disciplina (Σ|Δ|={best_err:.4f})"})
    else:
        findings.append({"severity": "warn", "campo": "snapshot",
                         "msg": "sem snapshot 'Atraso físico por disciplina' — só monotônico conferido"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n_disciplinas": res.get("n_disciplinas")}


def gate_mapa_segmentos(res: dict, bm: int | None = None, resumo: dict | None = None,
                        contratado_total: float | None = None,
                        mapa_mensal: list[dict] | None = None) -> dict:
    """Conservação do MAPA DA OBRA por km (C.14 Bloco 1 · segmentos de liberação/impedimento):
      (1) DERIVABILIDADE — Status/Liberado/Impedido (no BM) recomputados de (mês lib. real, janela
          de impedimento, BM) batem com a planilha ao centavo, segmento a segmento.
      (2) CONSERVAÇÃO — Σ Liberado == liberadoTotalRS · Σ Impedido == impedidoTotalRS (resumo C.9)
          · Σ valor dos trechos de duplicação == Contratado Total (C.3), tudo ao centavo.
      (3) GEOMETRIA — trechos de duplicação contíguos (km fim == km início do próximo, sem buraco
          nem sobreposição); sinistro é ponto dentro da faixa.
      (4) MAPA MENSAL — Bloco 2 inteiro recomputável dos segmentos (cada célula 0/1/2).
    Âncora ausente → warn (não passa verde em cima de conferência não feita)."""
    from .resolvers import _norm_key, derivar_status_segmento

    findings: list[dict] = list(res.get("findings", []))
    segs: list[dict] = res.get("segmentos") or []
    _TOL_RS = 0.005  # ao centavo

    # (1) derivabilidade de Status/Liberado/Impedido no BM corrente
    if bm is None:
        findings.append({"severity": "warn", "campo": "bm",
                         "msg": "sem BM corrente — derivação de status não conferida"})
    else:
        for s in segs:
            st_calc = derivar_status_segmento(s, bm)
            v = s["valor_contrato_rs"]
            lib_calc = v if st_calc == "Liberado" else 0.0
            imp_calc = v if st_calc == "Impedido" else 0.0
            if s.get("status_bm") and _norm_key(s["status_bm"]) != _norm_key(st_calc):
                findings.append({"severity": "error", "campo": "status",
                                 "msg": f"{s['seg_codigo']}: status '{s['status_bm']}' ≠ derivado '{st_calc}' no BM {bm}"})
            if s.get("liberado_rs") is not None and abs(s["liberado_rs"] - lib_calc) > _TOL_RS:
                findings.append({"severity": "error", "campo": "liberado",
                                 "msg": f"{s['seg_codigo']}: Liberado R$ {s['liberado_rs']:.2f} ≠ derivado {lib_calc:.2f}"})
            if s.get("impedido_rs") is not None and abs(s["impedido_rs"] - imp_calc) > _TOL_RS:
                findings.append({"severity": "error", "campo": "impedido",
                                 "msg": f"{s['seg_codigo']}: Impedido R$ {s['impedido_rs']:.2f} ≠ derivado {imp_calc:.2f}"})

    # (2) conservação contra as âncoras dos vizinhos (C.9 resumo · C.3 contratado total)
    soma_lib, soma_imp = res.get("soma_liberado_rs"), res.get("soma_impedido_rs")
    if resumo:
        anc_lib, anc_imp = resumo.get("liberadototalrs"), resumo.get("impedidototalrs")
        if anc_lib is not None and soma_lib is not None and abs(soma_lib - anc_lib) > _TOL_RS:
            findings.append({"severity": "error", "campo": "liberado",
                             "msg": f"Σ Liberado {soma_lib:.2f} ≠ resumo C.9 {anc_lib:.2f}"})
        if anc_imp is not None and soma_imp is not None and abs(soma_imp - anc_imp) > _TOL_RS:
            findings.append({"severity": "error", "campo": "impedido",
                             "msg": f"Σ Impedido {soma_imp:.2f} ≠ resumo C.9 {anc_imp:.2f}"})
        anc_ni = resumo.get("frentesnaoiniciadasqtd")
        if anc_ni is not None and bm is not None:
            n_ni = sum(1 for s in segs if derivar_status_segmento(s, bm) == "Não iniciado")
            if n_ni != int(anc_ni):
                findings.append({"severity": "error", "campo": "nao_iniciados",
                                 "msg": f"{n_ni} segmentos não iniciados ≠ resumo C.9 ({int(anc_ni)})"})
        anc_pct = resumo.get("pctimpedidovscontrato")
        soma_tot = res.get("soma_valor_rs")
        if anc_pct is not None and soma_imp is not None and soma_tot:
            # 1e-6 em fração (0,0001pp): tight, mas tolera ruído de float da fonte
            if abs(soma_imp / soma_tot - anc_pct) > 1e-6:
                findings.append({"severity": "error", "campo": "pct_impedido",
                                 "msg": f"Σ Impedido/Σ valor {soma_imp / soma_tot:.6%} ≠ resumo C.9 {anc_pct:.6%}"})
    else:
        findings.append({"severity": "warn", "campo": "resumo",
                         "msg": "sem resumo C.9 'liberações × impedimentos' — Σ não cruzada"})
    dupls = sorted((s for s in segs if s["tipo"] == "duplicacao"), key=lambda s: s["km_inicio"])
    if contratado_total is not None:
        soma_dupl = sum(s["valor_contrato_rs"] for s in dupls)
        if abs(soma_dupl - contratado_total) > _TOL_RS:
            findings.append({"severity": "error", "campo": "contratado",
                             "msg": f"Σ duplicação {soma_dupl:.2f} ≠ Contratado Total {contratado_total:.2f}"})
    else:
        findings.append({"severity": "warn", "campo": "contratado",
                         "msg": "sem 'Contratado Total' (C.3) — Σ duplicação não cruzada"})

    # (3) geometria: faixa contígua, sem buraco/sobreposição; sinistro é ponto dentro da faixa
    _TOL_KM = 1e-6
    for a, b in zip(dupls, dupls[1:]):
        if abs(b["km_inicio"] - a["km_fim"]) > _TOL_KM:
            findings.append({"severity": "error", "campo": "km",
                             "msg": f"{a['seg_codigo']}→{b['seg_codigo']}: km {a['km_fim']}→{b['km_inicio']} (buraco/sobreposição)"})
    if dupls:
        km_min, km_max = dupls[0]["km_inicio"], dupls[-1]["km_fim"]
        for s in segs:
            if s["tipo"] == "sinistro" and not (km_min - _TOL_KM <= s["km_inicio"] <= km_max + _TOL_KM):
                findings.append({"severity": "warn", "campo": "km",
                                 "msg": f"{s['seg_codigo']}: sinistro km {s['km_inicio']} fora da faixa {km_min}–{km_max}"})

    # (4) Bloco 2 recomputável célula a célula (0=a liberar · 1=liberado · 2=impedido)
    if mapa_mensal:
        cod = {"Não iniciado": 0, "Liberado": 1, "Impedido": 2}
        por_codigo = {s["seg_codigo"]: s for s in segs}
        ndiv = 0
        for mes in mapa_mensal:
            for seg_cod, v in (mes.get("codigos") or {}).items():
                s = por_codigo.get(seg_cod)
                if s is not None and cod[derivar_status_segmento(s, mes["mes_num"])] != v:
                    ndiv += 1
        if ndiv:
            findings.append({"severity": "error", "campo": "mapa_mensal",
                             "msg": f"{ndiv} célula(s) do Bloco 2 ≠ derivação dos segmentos (shift de mês?)"})
    else:
        findings.append({"severity": "warn", "campo": "mapa_mensal",
                         "msg": "sem Bloco 2 (mapa seg×mês) — derivação mensal não conferida"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n_segmentos": res.get("n_segmentos")}


def gate_curvas_serie_mes(res: dict, cards: dict | None = None, bm: int | None = None,
                          contratado_total: float | None = None) -> dict:
    """Conservação da SÉRIE MENSAL das curvas (C.8 × C.3 · Tela 6):
      (1) CROSS-SOURCE mês a mês — C.8 'Contratado Acum.' == C.3 'Previsto Acum.' ao centavo
          (mesmo eixo em 2 abas) · C.8 'Executado Acum.' == C.3 'Real Acum.' até o BM.
      (2) CORTE — no BM, série == cards do C.8 (contratado/liberado/capacidade/executado) ao centavo.
      (3) TOTAL — último contratado acum == Contratado Total (C.3).
      (4) FORMA — contratado/liberado acum monotônicos · 0 ≤ previsto serviços ≤ previsto todo (mês).
    Âncora ausente → warn (não passa verde em cima de conferência não feita)."""
    findings: list[dict] = list(res.get("findings", []))
    meses: list[dict] = res.get("meses") or []
    c3: dict = res.get("c3") or {}
    _TOL = 0.005

    # (1) cross-source C.8 × C.3
    if c3:
        ndiv = nreal = 0
        for x in meses:
            aux = c3.get(x["mes_num"])
            if not aux:
                continue
            ca, pa = x.get("contratado_acum_rs"), aux.get("previsto_acum")
            if ca is not None and pa is not None and abs(ca - pa) > _TOL:
                ndiv += 1
            ea, ra = x.get("executado_acum_rs"), aux.get("real_acum")
            if (bm is None or x["mes_num"] <= bm) and ea is not None and ra is not None \
                    and abs(ea - ra) > _TOL:
                nreal += 1
        if ndiv:
            findings.append({"severity": "error", "campo": "contratado",
                             "msg": f"{ndiv} mês(es) com C.8 Contratado ≠ C.3 Previsto Acum (shift?)"})
        if nreal:
            findings.append({"severity": "error", "campo": "executado",
                             "msg": f"{nreal} mês(es) com C.8 Executado ≠ C.3 Real Acum até o BM"})
    else:
        findings.append({"severity": "warn", "campo": "cross",
                         "msg": "sem C.3 curva mensal — cross-source C.8×C.3 não conferido"})

    # (2) corte == cards do C.8
    if cards and bm is not None:
        corte = next((x for x in meses if x["mes_num"] == bm), None)
        ancoras = (("contratado_acum_rs", "totalcontratadoacum"),
                   ("liberado_acum_rs", "liberadoparaexecucaoacum"),
                   ("capacidade_acum_rs", "capacidadeprodutivaacum"),
                   ("executado_acum_rs", "executadoacum"))
        if corte is None:
            findings.append({"severity": "error", "campo": "corte",
                             "msg": f"BM {bm} não existe na série"})
        else:
            for campo, chave in ancoras:
                anc = cards.get(chave)
                v = corte.get(campo)
                if anc is not None and v is not None and abs(v - anc) > _TOL:
                    findings.append({"severity": "error", "campo": campo,
                                     "msg": f"série[M{bm:02d}].{campo} {v:.2f} ≠ card C.8 {anc:.2f}"})
    else:
        findings.append({"severity": "warn", "campo": "cards",
                         "msg": "sem cards C.8/BM — corte não cruzado"})

    # (3) total do contrato
    ult = next((x["contratado_acum_rs"] for x in reversed(meses)
                if x.get("contratado_acum_rs") is not None), None)
    if contratado_total is not None and ult is not None:
        if abs(ult - contratado_total) > _TOL:
            findings.append({"severity": "error", "campo": "total",
                             "msg": f"último Contratado Acum {ult:.2f} ≠ Contratado Total {contratado_total:.2f}"})
    elif contratado_total is None:
        findings.append({"severity": "warn", "campo": "total",
                         "msg": "sem 'Contratado Total' (C.3) — fim da curva não cruzado"})

    # (4) forma
    for campo in ("contratado_acum_rs", "liberado_acum_rs"):
        seq = [x[campo] for x in meses if x.get(campo) is not None]
        if any(seq[i + 1] < seq[i] - _TOL for i in range(len(seq) - 1)):
            findings.append({"severity": "error", "campo": campo,
                             "msg": f"{campo} decresce (acumulado não-monotônico)"})
    for x in meses:
        ps = x.get("previsto_servicos_rs")
        todo = (c3.get(x["mes_num"]) or {}).get("previsto_todo")
        if ps is not None and ps < -_TOL:
            findings.append({"severity": "error", "campo": "servicos",
                             "msg": f"M{x['mes_num']:02d}: previsto serviços negativo"})
        elif ps is not None and todo is not None and ps > todo + _TOL:
            findings.append({"severity": "error", "campo": "servicos",
                             "msg": f"M{x['mes_num']:02d}: previsto serviços {ps:.2f} > previsto todo {todo:.2f}"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n_meses": res.get("n_meses")}


def gate_insumo_excedente(res: dict, abc: dict | None = None, params: dict | None = None,
                          contratado_total: float | None = None) -> dict:
    """Conservação do EXCEDENTE AO IPCA (D.5 · cláusula 8.8 · snapshot por insumo relevante):
      (1) CROSS ABC — qtd orçada e preço orçado de cada insumo com índice == Curva ABC (C.6)
          ao centavo (mesmo orçamento em 2 abas; match por nome normalizado/prefixo).
      (2) DERIVAÇÕES — preço ref == orçado×(1+Δ%) · excedente == (Δ%−teto)⁺ · Δ R$ ==
          excedente × qtd × preço, tudo ao centavo; farol derivável da régua (2pp/5pp).
      (3) TOTAIS — Σ Δ R$ == excedente repassável (card) == Σ bruto == líquido + reajuste pago;
          'insumos acima do teto' == count(excedente>0); % sobre PV == total/Contratado.
      (4) PENDÊNCIA — linha sem índice não pode carregar R$ (≠ 0 fabricado).
    Âncora ausente → warn (não passa verde em cima de conferência não feita)."""
    from .resolvers import _norm_key, derivar_farol_excedente

    findings: list[dict] = list(res.get("findings", []))
    insumos: list[dict] = res.get("insumos") or []
    _TOL = 0.005

    # (1) cross com a Curva ABC (C.6)
    if abc:
        def _prefixo_comum(a: str, b: str) -> int:
            n = 0
            for ca, cb in zip(a, b):
                if ca != cb:
                    break
                n += 1
            return n

        def _match(nome_norm: str):
            # igualdade primeiro; senão prefixo comum ≥8 com candidato ÚNICO (ex.: 'cbuqmassa…'
            # casa as 2 grafias do CBUQ; 'concretousinado' casa N variantes FCK → ambíguo → None)
            if nome_norm in abc:
                return abc[nome_norm]
            cands = [v for k, v in abc.items() if _prefixo_comum(k, nome_norm) >= 8]
            return cands[0] if len(cands) == 1 else None

        for i in insumos:
            if i["qtd_orcada"] is None and i["preco_orcado_rs"] is None:
                continue
            ref = _match(_norm_key(i["insumo"]))
            if ref is None:
                findings.append({"severity": "warn", "campo": "abc",
                                 "msg": f"{i['insumo'][:30]}: sem correspondente único na Curva ABC"})
                continue
            if i["qtd_orcada"] is not None and isinstance(ref.get("qtde"), float) \
                    and abs(i["qtd_orcada"] - ref["qtde"]) > _TOL:
                findings.append({"severity": "error", "campo": "qtd",
                                 "msg": f"{i['insumo'][:30]}: qtd {i['qtd_orcada']} ≠ ABC {ref['qtde']}"})
            if i["preco_orcado_rs"] is not None and isinstance(ref.get("preco"), float) \
                    and abs(i["preco_orcado_rs"] - ref["preco"]) > _TOL:
                findings.append({"severity": "error", "campo": "preco",
                                 "msg": f"{i['insumo'][:30]}: preço {i['preco_orcado_rs']} ≠ ABC {ref['preco']}"})
    else:
        findings.append({"severity": "warn", "campo": "abc",
                         "msg": "sem Curva ABC (C.6) — qtd/preço orçado não cruzados"})

    # (2) derivações exatas + farol pela régua
    for i in insumos:
        d, teto, exc = i["delta_real_pct"], i["teto_ipca_pct"], i["excedente_pct"]
        if d is not None and teto is not None:
            exc_calc = max(0.0, d - teto)
            if exc is not None and abs(exc - exc_calc) > 1e-9:
                findings.append({"severity": "error", "campo": "excedente",
                                 "msg": f"{i['insumo'][:30]}: excedente {exc} ≠ (Δ−teto)⁺ {exc_calc:.6f}"})
            if (i["qtd_orcada"] is not None and i["preco_orcado_rs"] is not None
                    and i["delta_rs"] is not None):
                rs_calc = i["qtd_orcada"] * i["preco_orcado_rs"] * exc_calc
                if abs(i["delta_rs"] - rs_calc) > _TOL:
                    findings.append({"severity": "error", "campo": "delta_rs",
                                     "msg": f"{i['insumo'][:30]}: Δ R$ {i['delta_rs']:.2f} ≠ derivado {rs_calc:.2f}"})
            if i["preco_ref_real_rs"] is not None and i["preco_orcado_rs"] is not None:
                ref_calc = i["preco_orcado_rs"] * (1 + d)
                if abs(i["preco_ref_real_rs"] - ref_calc) > _TOL:
                    findings.append({"severity": "error", "campo": "preco_ref",
                                     "msg": f"{i['insumo'][:30]}: preço ref {i['preco_ref_real_rs']} ≠ orçado×(1+Δ) {ref_calc:.4f}"})
        farol_calc = derivar_farol_excedente(d, exc)
        if i["farol"] and farol_calc and _norm_key(i["farol"]) != _norm_key(farol_calc):
            findings.append({"severity": "error", "campo": "farol",
                             "msg": f"{i['insumo'][:30]}: farol '{i['farol']}' ≠ régua '{farol_calc}'"})
        # (4) pendência honesta: sem índice não existe R$ apurado
        if i["indice_pendente"] and i["delta_rs"] not in (None, 0.0):
            findings.append({"severity": "error", "campo": "pendente",
                             "msg": f"{i['insumo'][:30]}: R$ sem índice de mercado"})

    # snapshot é um MÊS COMUM (banana com banana): todo teto não-nulo tem que ser o MESMO
    tetos = [i["teto_ipca_pct"] for i in insumos if i["teto_ipca_pct"] is not None]
    if tetos and max(tetos) - min(tetos) > 1e-9:
        findings.append({"severity": "error", "campo": "teto",
                         "msg": f"teto IPCA não-uniforme no snapshot ({min(tetos)}–{max(tetos)})"})

    # (3) totais e contagens contra os cards/consolidação
    soma = sum(i["delta_rs"] for i in insumos if i["delta_rs"] is not None)
    if params:
        for chave in ("excedenterepassavel88", "somadeltabrutometodoativo"):
            anc = params.get(chave)
            if isinstance(anc, float) and abs(soma - anc) > _TOL:
                findings.append({"severity": "error", "campo": "total",
                                 "msg": f"Σ Δ R$ {soma:.2f} ≠ {chave} {anc:.2f}"})
        liq = params.get("desequilibrioliquidoinsumos")
        pago = params.get("reajustecontratualjapagoacum")
        if isinstance(liq, float):
            esperado = soma - (pago if isinstance(pago, float) else 0.0)
            if abs(liq - esperado) > _TOL:
                findings.append({"severity": "error", "campo": "liquido",
                                 "msg": f"líquido {liq:.2f} ≠ Σ − reajuste pago {esperado:.2f}"})
        anc_n = params.get("insumosacimadoteto")
        n_acima = sum(1 for i in insumos if (i["excedente_pct"] or 0) > 0)
        if isinstance(anc_n, float) and int(anc_n) != n_acima:
            findings.append({"severity": "error", "campo": "acima_teto",
                             "msg": f"{n_acima} insumos acima do teto ≠ card ({int(anc_n)})"})
        anc_pct = params.get("pctsobrepv")
        if isinstance(anc_pct, float) and contratado_total:
            if abs(soma / contratado_total - anc_pct) > 1e-6:
                findings.append({"severity": "error", "campo": "pct_pv",
                                 "msg": f"Σ/PV {soma / contratado_total:.8%} ≠ card {anc_pct:.8%}"})
    else:
        findings.append({"severity": "warn", "campo": "params",
                         "msg": "sem parâmetros/consolidação do D.5 — totais não cruzados"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n_insumos": res.get("n_insumos"),
            "soma_delta_rs": soma}


def gate_avanco_fisico_disciplina(res: dict, *, pv_anchor=None, fisico_anchor=None) -> dict:  # noqa: ANN001
    """Conservação do avanço físico-financeiro CONTRATADO por disciplina (C.14 · extrair_avanco_fisico_
    disciplina_mes). Dois invariantes, ambos falha-alto:
      · Σ TOTAL (todas as disciplinas, físicas + não-físicas) == PV (com BDI/markup) → prova que lemos a
        fonte auxiliar_C.14 inteira (não um subconjunto torto). Sem âncora de PV → warn (não confere).
      · Σ FÍSICAS == porção física do PV (fisico_anchor, ex.: 367.256.923 da BR-101) → prova o RECORTE
        físico correto (exclui Adm Local/Insumos/Mob-Desmob/Outros). Sem âncora → warn.
    REAL é pendente do RDO (NULL) — gate NÃO confere aderência aqui (só a baseline contratada)."""
    findings: list[dict] = list(res.get("findings", []))

    def _conf(nome: str, soma, alvo) -> None:  # noqa: ANN001
        if alvo is None:
            # SEM âncora não dá pra conservar → NÃO pode ir ao banco "verde": escala p/ needs_review
            # (erro=milhões · "PENDENTE nunca vira 0"). Numa obra diferente a âncora falta fácil — é
            # exatamente o caso onde um bug de valor (escala/misclassificação) passaria silencioso.
            findings.append({"severity": "error", "campo": nome,
                             "msg": f"sem âncora p/ {nome} — Σ NÃO conferível → needs_review (não persiste verde)"})
            return
        if soma is None:
            findings.append({"severity": "error", "campo": nome, "msg": f"Σ {nome} ausente"})
            return
        try:
            a = float(alvo)
        except (TypeError, ValueError):
            return
        tol = max(1.0, abs(a) * 0.0001)  # 0,01% · cobre arredondamento de centavo
        if abs(float(soma) - a) > tol:
            findings.append({"severity": "error", "campo": nome,
                             "msg": f"Σ {nome} {float(soma):,.2f} ≠ âncora {a:,.2f} (Δ {float(soma) - a:,.2f})"})

    # PV: contra o Valor(R$) BRUTO (Σ por item), não o distribuído por %mês — a distribuição drifta de
    # 100% por item; o bruto é a âncora limpa (== PV). Físicas: contra o DISTRIBUÍDO (== matriz cached).
    _conf("valor bruto (PV)", res.get("soma_valor_bruto"), pv_anchor)
    _conf("físicas", res.get("soma_fisico"), fisico_anchor)
    if not res.get("n_disciplinas_fisicas"):
        findings.append({"severity": "error", "campo": "disciplinas",
                         "msg": "nenhuma disciplina física na matriz C.14"})
    if res.get("real_pendente"):
        findings.append({"severity": "info", "campo": "real",
                         "msg": "REAL/aderência pendente do RDO (NULL) — farol exibe só a baseline contratada"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings,
            "soma_total": res.get("soma_total"), "soma_fisico": res.get("soma_fisico")}


def gate_valor_agregado(res: dict, pv: float | None = None) -> dict:
    """Conservação do D.4 Valor Agregado (earned value · ao centavo):
      (1) PERDA — perda_cat == real_alocado_cat − va_medido_cat, categoria a categoria.
      (2) TOTAL — categoria 'TOTAL' == MOD + EQP em cada métrica (va/alocado/perda).
      (3) SERVIÇOS — Σ va_mod_rs == VA medido MOD do resumo · Σ va_eqp_rs == VA medido EQP · e
          VA serviço == qtd_medida × R$/un por linha (derivação exata).
      (4) % sobre PV — pct_pv == perda_cat / PV (se a âncora PV vier).
    Âncora ausente → warn (não passa verde sobre conferência não feita)."""
    findings: list[dict] = list(res.get("findings", []))
    cats: list[dict] = res.get("categorias") or []
    servs: list[dict] = res.get("servicos") or []
    _TOL = 0.02  # ao centavo (tolerância padrão do projeto)

    por = {str(c.get("categoria", "")).upper(): c for c in cats}

    # (1) perda == alocado − agregado, por categoria
    for cat, c in por.items():
        va, al, pe = c.get("va_medido_rs"), c.get("real_alocado_rs"), c.get("perda_rs")
        if None not in (va, al, pe):
            esperado = float(al) - float(va)
            if abs(float(pe) - esperado) > _TOL:
                findings.append({"severity": "error", "campo": "perda",
                                 "msg": f"{cat}: perda {float(pe):.2f} ≠ alocado−agregado {esperado:.2f}"})

    # (2) TOTAL == MOD + EQP em cada métrica
    tot, mod, eqp = por.get("TOTAL"), por.get("MOD"), por.get("EQP")
    if tot and mod and eqp:
        for campo in ("va_medido_rs", "real_alocado_rs", "perda_rs"):
            partes = [mod.get(campo), eqp.get(campo), tot.get(campo)]
            if None not in partes:
                soma = float(mod[campo]) + float(eqp[campo])
                if abs(soma - float(tot[campo])) > _TOL:
                    findings.append({"severity": "error", "campo": f"total.{campo}",
                                     "msg": f"TOTAL.{campo} {float(tot[campo]):.2f} ≠ MOD+EQP {soma:.2f}"})
    else:
        findings.append({"severity": "warn", "campo": "total",
                         "msg": "faltam categorias MOD/EQP/TOTAL — Σ TOTAL não conferida"})

    # (3) serviços: Σ VA == VA medido do resumo + derivação por linha (qtd × R$/un)
    soma_mod = sum(float(s["va_mod_rs"]) for s in servs if s.get("va_mod_rs") is not None)
    soma_eqp = sum(float(s["va_eqp_rs"]) for s in servs if s.get("va_eqp_rs") is not None)
    if mod and mod.get("va_medido_rs") is not None and servs:
        tol = max(_TOL, abs(float(mod["va_medido_rs"])) * 0.0001)
        if abs(soma_mod - float(mod["va_medido_rs"])) > tol:
            findings.append({"severity": "error", "campo": "servicos.mod",
                             "msg": f"Σ VA MOD serviços {soma_mod:.2f} ≠ VA medido MOD resumo {float(mod['va_medido_rs']):.2f}"})
    if eqp and eqp.get("va_medido_rs") is not None and servs:
        tol = max(_TOL, abs(float(eqp["va_medido_rs"])) * 0.0001)
        if abs(soma_eqp - float(eqp["va_medido_rs"])) > tol:
            findings.append({"severity": "error", "campo": "servicos.eqp",
                             "msg": f"Σ VA EQP serviços {soma_eqp:.2f} ≠ VA medido EQP resumo {float(eqp['va_medido_rs']):.2f}"})
    for s in servs:
        q = s.get("qtd_medida")
        for col, rsun in (("va_mod_rs", "mod_rs_un"), ("va_eqp_rs", "eqp_rs_un")):
            v, u = s.get(col), s.get(rsun)
            if None not in (q, u, v):
                calc = float(q) * float(u)
                if abs(float(v) - calc) > max(_TOL, abs(calc) * 0.001):
                    findings.append({"severity": "error", "campo": col,
                                     "msg": f"{str(s.get('servico'))[:30]}: {col} {float(v):.2f} ≠ qtd×R$/un {calc:.2f}"})

    # (4) % sobre PV
    if pv:
        for cat, c in por.items():
            pe, pct = c.get("perda_rs"), c.get("pct_pv")
            if None not in (pe, pct) and abs(float(pct) - float(pe) / pv) > 1e-5:
                findings.append({"severity": "error", "campo": "pct_pv",
                                 "msg": f"{cat}: %PV {float(pct):.6f} ≠ perda/PV {float(pe) / pv:.6f}"})
    else:
        findings.append({"severity": "warn", "campo": "pct_pv", "msg": "sem PV âncora — %PV não conferido"})

    # (5) série mensal: Σ por categoria == resumo (VA e Real alocado, MOD e EQP)
    serie = res.get("serie") or []
    if serie and mod and eqp:
        sums = {"va_mod_rs": 0.0, "va_eqp_rs": 0.0, "real_mod_rs": 0.0, "real_eqp_rs": 0.0}
        for m in serie:
            for col in sums:
                v = m.get(col)
                if v is not None:
                    sums[col] += float(v)
        checks = (("va_mod_rs", sums["va_mod_rs"], mod.get("va_medido_rs")),
                  ("va_eqp_rs", sums["va_eqp_rs"], eqp.get("va_medido_rs")),
                  ("real_mod_rs", sums["real_mod_rs"], mod.get("real_alocado_rs")),
                  ("real_eqp_rs", sums["real_eqp_rs"], eqp.get("real_alocado_rs")))
        for nome, soma, alvo in checks:
            if alvo is not None:
                tol = max(_TOL, abs(float(alvo)) * 0.0001)
                if abs(soma - float(alvo)) > tol:
                    findings.append({"severity": "error", "campo": f"serie.{nome}",
                                     "msg": f"Σ mensal {nome} {soma:.2f} ≠ resumo {float(alvo):.2f}"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "soma_va_mod": round(soma_mod, 2),
            "soma_va_eqp": round(soma_eqp, 2), "n_meses": len(serie)}


def gate_recursos_desvio(res: dict) -> dict:
    """Conservação dos maiores desvios de alocação (C.4): desvio_rs == real_rs − contratado_rs por
    recurso, ao centavo. Linha que não fecha → needs_review (não grava desvio fabricado)."""
    findings: list[dict] = list(res.get("findings", []))
    _TOL = 0.02
    for d in res.get("desvios") or []:
        c, r, dv = d.get("contratado_rs"), d.get("real_rs"), d.get("desvio_rs")
        if None not in (c, r, dv):
            esperado = float(r) - float(c)
            if abs(float(dv) - esperado) > _TOL:
                findings.append({"severity": "error", "campo": "desvio",
                                 "msg": f"{str(d.get('recurso'))[:24]}: desvio {float(dv):.2f} ≠ real−contr {esperado:.2f}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_cronograma_tarefas_c13(res: dict) -> dict:
    """Gate ESTRUTURAL do Gantt C.13 (cronograma · sem invariante monetária): precisa ter tarefas,
    cada uma com início+término contratado e término >= início. Eixo real pode vir vazio (pré-exec)."""
    findings: list[dict] = list(res.get("findings", []))
    tarefas = res.get("tarefas") or []
    if not tarefas:
        findings.append({"severity": "error", "campo": "tarefas", "msg": "nenhuma tarefa no Cron Project C.13"})
    for t in tarefas:
        ini, ter = t.get("data_inicio"), t.get("data_termino")
        if not ini or not ter:
            findings.append({"severity": "error", "campo": "datas",
                             "msg": f"{str(t.get('nome'))[:28]}: sem início/término contratado"})
        elif ter < ini:  # ISO 'YYYY-MM-DD' compara lexicograficamente
            findings.append({"severity": "error", "campo": "datas",
                             "msg": f"{str(t.get('nome'))[:28]}: término {ter} < início {ini}"})
        # eixo REAL pode vir vazio (pré-execução); se vier, término real não pode anteceder o início
        ir, tr = t.get("data_inicio_real"), t.get("data_termino_real")
        if ir and tr and tr < ir:
            findings.append({"severity": "error", "campo": "datas_real",
                             "msg": f"{str(t.get('nome'))[:28]}: término real {tr} < início real {ir}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n_grupos": sum(1 for t in tarefas if t.get("nivel") == 0)}


def gate_eventos_prazo(res: dict) -> dict:
    """Gate ESTRUTURAL dos eventos C.13: cada evento precisa de título; se tiver início e fim, fim >=
    início. Datas ausentes em evento pontual são toleradas (marco/clima sem janela)."""
    findings: list[dict] = list(res.get("findings", []))
    for e in res.get("eventos") or []:
        if not (e.get("titulo") or "").strip():
            findings.append({"severity": "error", "campo": "titulo", "msg": "evento sem título"})
        ini, fim = e.get("data_inicio"), e.get("data_fim")
        if ini and fim and fim < ini:
            findings.append({"severity": "error", "campo": "datas",
                             "msg": f"{str(e.get('titulo'))[:28]}: fim {fim} < início {ini}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_produtividade_c7(params: dict | None, fisica: list[dict], impedimentos: list[dict]) -> dict:
    """C.7 Produtividade física — CONSERVAÇÃO: por linha medida, % físico == medida ÷ contratada e
    aderência == real ÷ CPU; e Σ HH ociosas dos impedimentos == ociosidade da ponte. Tolerância
    folgada (frações 0,01 · HH 1,0) — fração derivada pode ter arredondamento da planilha."""
    findings: list[dict] = []
    for r in fisica or []:
        qc, qm, pf = r.get("qtd_contratada"), r.get("qtd_medida"), r.get("pct_fisico")
        if qc and qm is not None and pf is not None and qc != 0:
            if abs(float(pf) - float(qm) / float(qc)) > 0.01:
                findings.append({"severity": "error", "campo": "pct_fisico",
                                 "msg": f"{str(r.get('servico'))[:24]}: % físico {float(pf):.4f} ≠ medida/contr {float(qm) / float(qc):.4f}"})
        cpu, real, ad = r.get("cpu_un_h"), r.get("real_un_h"), r.get("aderencia")
        if cpu and real is not None and ad is not None and cpu != 0:
            if abs(float(ad) - float(real) / float(cpu)) > 0.01:
                findings.append({"severity": "error", "campo": "aderencia",
                                 "msg": f"{str(r.get('servico'))[:24]}: aderência {float(ad):.4f} ≠ real/CPU {float(real) / float(cpu):.4f}"})
    if params and impedimentos:
        oc = params.get("ponte_ociosidade_hh")
        soma = round(sum(i.get("hh_ociosas") or 0 for i in impedimentos), 1)
        if oc is not None and abs(soma - float(oc)) > 1.0:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"Σ HH ociosas {soma:.1f} ≠ ociosidade ponte {float(oc):.1f}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_pontuais_d6(params: dict | None, eventos: list[dict], chuva_mensal: list[dict]) -> dict:
    """D.6 Pontuais — CONSERVAÇÃO: (1) Σ perda dos eventos == pendente total dos Cards; (2) a perda
    VALIDADA é R$ 0 (D.6 não soma · dedup c/ D.4); (3) por evento, custo MOD + EQP == perda; (4) o
    evento de chuva == Σ pleiteável (MOD+EQP) da apuração mês a mês. Tolerância R$ 1."""
    findings: list[dict] = []
    _TOL = 1.0
    soma = round(sum(e.get("custo_rs") or 0 for e in eventos), 2)
    if params is not None:
        # Dois baldes nos Cards: 'pendente (não soma)' (BR-101: todos os eventos) e
        # 'perda adicional nesta tela' (SBSO: evento quantificado que SOMA no D.0).
        pend = params.get("pendente_total_rs")
        adic = params.get("adicional_rs")
        if pend is not None or adic is not None:
            alvo = float(pend or 0) + float(adic or 0)
            if abs(soma - alvo) > _TOL:
                findings.append({"severity": "error", "campo": "conservacao",
                                 "msg": f"Σ perda eventos {soma:.2f} ≠ Cards (pendente {float(pend or 0):.2f} + adicional {float(adic or 0):.2f})"})
        val = params.get("perda_validada_rs")
        if val is not None and abs(float(val)) > _TOL:
            findings.append({"severity": "error", "campo": "perda_validada",
                             "msg": f"perda validada {float(val):.2f} ≠ 0 (D.6 não soma · dedup D.4)"})
    for e in eventos or []:
        cm, ce, cr = e.get("custo_mod_rs"), e.get("custo_eqp_rs"), e.get("custo_rs")
        if cm is not None and ce is not None and cr is not None:
            if abs((float(cm) + float(ce)) - float(cr)) > _TOL:
                findings.append({"severity": "error", "campo": "custo_evento",
                                 "msg": f"{str(e.get('categoria'))[:18]}: MOD+EQP {float(cm) + float(ce):.2f} ≠ perda {float(cr):.2f}"})
    if chuva_mensal:
        ch = next((e for e in eventos if str(e.get("categoria") or "").lower() == "chuva"), None)
        if ch is not None and ch.get("custo_rs") is not None:
            somam = round(sum(m.get("total_mes_rs") or 0 for m in chuva_mensal), 2)
            if abs(somam - float(ch["custo_rs"])) > _TOL:
                findings.append({"severity": "error", "campo": "conservacao",
                                 "msg": f"Σ chuva mês {somam:.2f} ≠ perda evento chuva {float(ch['custo_rs']):.2f}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_mapa_elementos(res: dict, sinistro_total: float | None = None) -> dict:
    """C.14 Bloco 5 — estrutural + CONSERVAÇÃO: cada elemento tem km; taludes têm valor; se o total
    de sinistros do BLOCO 1 for conhecido, Σ valor dos taludes == sinistro_total ao centavo (os 5
    taludes são carve-out do S1 e fecham com o agregado)."""
    findings: list[dict] = list(res.get("findings", []))
    els = res.get("elementos") or []
    for e in els:
        if e.get("km") is None:
            findings.append({"severity": "error", "campo": "km",
                             "msg": f"{str(e.get('elemento'))[:24]}: sem km"})
    taludes = [e for e in els if e.get("tipo") == "Talude"]
    falta_valor = [e for e in taludes if e.get("valor_rs") is None]
    for e in falta_valor:
        findings.append({"severity": "error", "campo": "valor",
                         "msg": f"{str(e.get('elemento'))[:24]}: talude sem valor"})
    # conservação do carve-out: Σ taludes == sinistro agregado do BLOCO 1 (ao centavo). Só confere
    # com TODOS os valores presentes; sem a âncora (BLOCO 1 ausente nesta extração) → falha-alto.
    if taludes:
        if sinistro_total is None:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": "taludes sem o sinistro agregado (BLOCO 1) p/ conferir o carve-out"})
        elif not falta_valor:
            soma = round(sum(e["valor_rs"] for e in taludes), 2)
            if abs(soma - round(float(sinistro_total), 2)) > 0.02:
                findings.append({"severity": "error", "campo": "conservacao",
                                 "msg": f"Σ taludes {soma:.2f} ≠ sinistro BLOCO 1 {float(sinistro_total):.2f}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings, "n": len(els)}


def gate_bdi_deseq(params: dict | None, rubricas: list[dict], perda: list[dict]) -> dict:
    """D.2 BDI — CONSERVAÇÃO tripla: Σ desequilíbrio das 6 rubricas == desequilíbrio total; Σ valor
    das rubricas == valor total no contrato; e a perda ACUMULADA no BM corrente == desequilíbrio
    (a curva fecha com o headline). Tolerância R$ 1 (valores na casa dos milhões)."""
    findings: list[dict] = []
    _TOL = 1.0
    if params is None:
        return {"status": "ok", "findings": findings}
    deq_total = params.get("desequilibrio_rs")
    if rubricas and deq_total is not None:
        soma = round(sum(r.get("desequilibrio_rs") or 0 for r in rubricas), 2)
        if abs(soma - float(deq_total)) > _TOL:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"Σ rubricas desequilíbrio {soma:.2f} ≠ total {float(deq_total):.2f}"})
    val_total = params.get("valor_total_contrato_rs")
    if rubricas and val_total is not None:
        somav = round(sum(r.get("valor_contrato_rs") or 0 for r in rubricas), 2)
        if abs(somav - float(val_total)) > _TOL:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"Σ valor rubricas {somav:.2f} ≠ total contrato {float(val_total):.2f}"})
    bm = params.get("bm_corrente")
    if perda and bm is not None and deq_total is not None:
        row = next((m for m in perda if m.get("bm") == bm), None)
        acum = row.get("perda_acum_rs") if row else None
        if acum is not None and abs(float(acum) - float(deq_total)) > _TOL:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"perda acum BM{bm} {float(acum):.2f} ≠ desequilíbrio {float(deq_total):.2f}"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}


def gate_insumos_fd(res: dict) -> dict:
    """C.6/D.5 fd — conservação contra os Cards da C.6: n insumos == monitorados e
    Σ valor_contrato_bdi == valor contratado orçado (tol 0,01% · piso R$1). Cada insumo
    precisa de fonte recomendada existente. Falha-alto."""
    findings: list[dict] = list(res.get("findings", []))
    cards = res.get("cards") or {}
    n_dec = cards.get("n_monitorados")
    if n_dec is not None and int(n_dec) != res.get("n"):
        findings.append({"severity": "error", "campo": "n",
                         "msg": f"n insumos fd ({res.get('n')}) ≠ monitorados Cards ({int(n_dec)})"})
    val_dec = cards.get("valor_orcado")
    soma = round(sum((i.get("valor_contrato_bdi") or 0) for i in res.get("insumos") or []), 2)
    if val_dec is not None:
        tol = max(1.0, abs(float(val_dec)) * 0.0001)
        if abs(soma - float(val_dec)) > tol:
            findings.append({"severity": "error", "campo": "conservacao",
                             "msg": f"Σ valor fd {soma:.2f} ≠ contratado orçado Cards {float(val_dec):.2f}"})
    ids = {f.get("insumo_ordem") for f in res.get("fontes") or []}
    orfaos = [i["ordem_abc"] for i in res.get("insumos") or [] if i["ordem_abc"] not in ids]
    if orfaos:
        findings.append({"severity": "error", "campo": "fontes", "msg": f"{len(orfaos)} insumo(s) sem fonte"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"status": status, "findings": findings}
