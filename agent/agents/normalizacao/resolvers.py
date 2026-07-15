"""Resolvers nomeados — a lógica determinística que NÃO cabe na config (proibição #1).

São cidadãos de 1ª classe (não "escape hatch de 20%"): algoritmos sobre a COLEÇÃO ou sobre
a CHAVE de entidade. Cada um é puro, testável e falha-alto. A config só os REFERENCIA por nome.
"""

from __future__ import annotations

import re

_EDT_RE = re.compile(r"^\d+(\.\d+)*$")
_ROUND = 2  # tolerância de centavos pra conferência de soma (BR)


def parse_nivel(numero_item) -> int | None:  # noqa: ANN001
    """Profundidade do código EDT ('1'→1, '1.2'→2, '1.2.3'→3). None se não é EDT dotted."""
    s = str(numero_item).strip()
    return s.count(".") + 1 if _EDT_RE.match(s) else None


def folhas_idx(itens: list[dict]) -> set[int]:
    """Índices das linhas-FOLHA (código EDT que NÃO é prefixo de nenhum outro). Linha sem
    código EDT é mantida (não é pai de ninguém). Idêntico ao leaf-sum do sanity — o item-pai
    já É a soma dos filhos, somar os dois conta 2×."""
    codes: dict[int, str] = {}
    for i, it in enumerate(itens):
        s = str(it.get("numero_item", "")).strip()
        if _EDT_RE.match(s):
            codes[i] = s
    code_set = set(codes.values())
    parents = {c for c in code_set if any(c2 != c and c2.startswith(c + ".") for c2 in code_set)}
    return {i for i in range(len(itens)) if codes.get(i) not in parents}


def rollup_hierarquico(itens: list[dict], valor_field: str) -> list[dict]:
    """Confere, pra cada item-PAI, que `valor_field` == Σ(filhos DIRETOS), com tolerância de
    centavo. Falha-alto: retorna findings (não corrige). Pais/filhos sem valor são pulados
    (o BM é esparso — só folhas trazem o valor do período em muitos docs)."""
    by_code: dict[str, float] = {}
    children: dict[str, list[str]] = {}
    for it in itens:
        c = str(it.get("numero_item", "")).strip()
        if not _EDT_RE.match(c):
            continue
        v = it.get(valor_field)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            by_code[c] = float(v)
        if "." in c:
            children.setdefault(c.rsplit(".", 1)[0], []).append(c)
    findings: list[dict] = []
    for pai, filhos in children.items():
        vp = by_code.get(pai)
        soma = sum(by_code[f] for f in filhos if f in by_code)
        if vp is None or not any(f in by_code for f in filhos):
            continue  # esparso — nada a conferir
        if round(abs(vp - soma), _ROUND) > max(0.02, len(filhos) * 0.01):
            findings.append({
                "severity": "error",
                "campo": valor_field,
                "msg": f"rollup: item '{pai}' ({vp:.2f}) ≠ Σ filhos ({soma:.2f}) [{len(filhos)} filhos]",
            })
    return findings


_BM_NUM_RE = re.compile(r"\b(?:bm|medi[çc][ãa]o|boletim)[\s\-–]*0*(\d{1,3})\b", re.IGNORECASE)
_MESES = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}


def _norm_key(s) -> str:  # noqa: ANN001
    import unicodedata
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def resolver_competencia(payload: dict, nome_original: str) -> dict:
    """Resolve a CHAVE de entidade (bm_numero) por código. FALHA-ALTO se ambíguo, ANTES de
    qualquer upsert — erro aqui corrompe o BANCO, não uma célula. ÂNCORA = nome do arquivo
    (fonte mais estável); a identificacao só CONFIRMA via campo especificamente do BM (não
    qualquer número solto — senão um 'Nº Contrato 124' polui). Retorna {bm_numero, status, motivo}."""
    ident = payload.get("identificacao") if isinstance(payload.get("identificacao"), dict) else {}
    # 1) Âncora primária: número do BM no nome do arquivo ('BM 03' → 3).
    m = _BM_NUM_RE.search(nome_original or "")
    fname_bm = int(m.group(1)) if m else None
    # 2) Identificacao · SÓ campos cuja CHAVE é especificamente "nº do BM/medição/boletim"
    #    (não 'Número do Contrato'). Aí sim aceita número solto no valor.
    ident_bms: set[int] = set()
    for k, v in ident.items():
        nk = _norm_key(k)
        if ("bm" in nk or "boletim" in nk or "medicao" in nk) and ("numero" in nk or nk.startswith("n")):
            mm = _BM_NUM_RE.search(str(v)) or re.match(r"^\s*0*(\d{1,3})\b", str(v))
            if mm:
                ident_bms.add(int(mm.group(1)))
    base = {"ano": None, "mes": None}
    if fname_bm is not None:
        if ident_bms and fname_bm not in ident_bms:
            return {"bm_numero": None, **base, "status": "needs_review",
                    "motivo": f"BM do nome ({fname_bm}) diverge da identificação ({sorted(ident_bms)})"}
        return {"bm_numero": fname_bm, **base, "status": "ok", "motivo": ""}
    if len(ident_bms) == 1:
        return {"bm_numero": ident_bms.pop(), **base, "status": "ok", "motivo": ""}
    if not ident_bms:
        return {"bm_numero": None, **base, "status": "needs_review",
                "motivo": "número do BM não identificado (nome do arquivo nem identificação)"}
    return {"bm_numero": None, **base, "status": "needs_review",
            "motivo": f"número do BM AMBÍGUO na identificação: {sorted(ident_bms)}"}


# ── Cronograma físico-financeiro · curva PREVISTA (unpivot temporal) ─────
# A distribuição mensal do cronograma vem como chave_valor {mês: %/valor}, não como tabela.
# Este resolver TRANSPÕE isso em linhas atômicas (1 por competência). Fuzzy-match das chaves
# (físico-% / financeiro / custo total) pra ser robusto à variação de redação entre projetos.


def _parse_competencia_mes(chave) -> tuple[int, int] | None:  # noqa: ANN001
    """'abr-26' / 'mai/26' / 'set-26' → (2026, 4). None se não casar mês BR + ano."""
    s = str(chave).strip().lower()
    mes = ano = None
    for p in re.split(r"[\s\-/_.]+", s):
        if p[:3] in _MESES:
            mes = _MESES[p[:3]]
        elif p.isdigit():
            ano = int(p)
    if mes is None or ano is None:
        return None
    return (ano + 2000 if ano < 100 else ano, mes)


def _find_dist(dados: dict, *needles: str) -> dict:
    """Sub-dict {mês: valor} cuja CHAVE normalizada contém TODOS os needles. {} se não achar."""
    for k, v in dados.items():
        if isinstance(v, dict) and all(nd in _norm_key(k) for nd in needles):
            return v
    return {}


def _find_num(dados: dict, *needles: str):  # noqa: ANN001
    for k, v in dados.items():
        if isinstance(v, (int, float)) and not isinstance(v, bool) and all(nd in _norm_key(k) for nd in needles):
            return float(v)
    return None


def unpivot_temporal(dados: dict) -> dict:
    """Distribuição mensal do cronograma físico-financeiro → linhas atômicas (1/competência).
    FIEL ao documento, SEM inventar: a curva FÍSICA (% avanço) e a FINANCEIRA (R$) são curvas
    DISTINTAS — não se deriva uma da outra. Guarda `previsto_pct` (físico, base do gate Σ==1,0),
    `previsto_pct_acumulado` e `previsto_financeiro_declarado` (parcial, só onde legível no doc).
    FALHA-ALTO se não localizar a distribuição. Reusa _MESES/_norm_key (replicável entre projetos)."""
    if not isinstance(dados, dict):
        return {"meses": [], "custo_total": None, "status": "needs_review",
                "motivo": "seção de cronograma sem 'dados' (chave_valor)"}
    pct_map = _find_dist(dados, "fisico", "percent") or _find_dist(dados, "fisico")
    fin_map = _find_dist(dados, "financeiro")
    custo_total = _find_num(dados, "custototal") or _find_num(dados, "valortotal")
    if not pct_map and not fin_map:
        return {"meses": [], "custo_total": custo_total, "status": "needs_review",
                "motivo": "distribuição mensal (físico % / financeiro) não localizada"}
    base = pct_map or fin_map
    meses: list[dict] = []
    ignoradas: list[str] = []
    for chave, pct in base.items():
        ym = _parse_competencia_mes(chave)
        if ym is None:
            ignoradas.append(str(chave))
            continue
        row: dict = {"ano": ym[0], "mes": ym[1], "competencia_chave": str(chave)}
        if isinstance(pct, (int, float)) and not isinstance(pct, bool):
            row["previsto_pct"] = float(pct)
        fin = fin_map.get(chave) if isinstance(fin_map, dict) else None
        if isinstance(fin, (int, float)) and not isinstance(fin, bool):
            row["previsto_financeiro_declarado"] = float(fin)
        meses.append(row)
    meses.sort(key=lambda m: (m["ano"], m["mes"]))
    acc_pct = 0.0
    fin_cobertos = 0
    for ordem, m in enumerate(meses):
        m["ordem"] = ordem
        pct = m.get("previsto_pct")
        if pct is not None:
            acc_pct += pct
            m["previsto_pct_acumulado"] = round(acc_pct, 6)
        if m.get("previsto_financeiro_declarado") is not None:
            fin_cobertos += 1
    return {"meses": meses, "custo_total": custo_total, "soma_pct": round(acc_pct, 6),
            "financeiro_cobertura": fin_cobertos, "ignoradas": ignoradas,
            "status": "ok", "motivo": ""}


# ── Tabela EDT × colunas-de-data → curva mensal R$ (unpivot de tabela larga) ──
# Diferente de unpivot_temporal (que lê chave_valor {mês:%}). Aqui a fonte é uma TABELA com
# colunas cujos cabeçalhos são datas ISO (mensal ou diário). FALHA-ALTO contra os pecados que
# o mapeamento da Medição acumulada flagrou: rejeita célula '#REF!'; nunca soma raiz+folhas
# (dupla contagem); consolida diário em mês.
_DATA_COL_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
_EDT_VALIDO_RE = re.compile(r"^\d+(\.\d+)*$")


def _num_limpo(v):  # noqa: ANN001
    """Número da célula, ou None. Aceita número nativo OU string-número (a extração tipa diferente
    por seção — ex.: a curva C.3 vem como '3319716'), inclusive formato BR ('1.234.567,89'). REJEITA
    '#REF!'/'#DIV' (erro de fórmula) com a sentinela ERRO_REF → falha-alto no chamador."""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    if isinstance(v, str):
        u = v.upper()
        if "#REF!" in u or "#DIV" in u:
            return "ERRO_REF"
        s = v.strip().replace(" ", "")
        if s == "":
            return None
        try:
            return float(s)
        except ValueError:
            try:  # formato BR: milhar com '.' e decimal com ',' → 1.234.567,89
                return float(s.replace(".", "").replace(",", "."))
            except ValueError:
                return None
    return None


# Marcadores de célula-helper que VAZAM pra linha de dado (rótulo de fórmula de roll-up, ranking
# automático, legendas/critérios de IA). Achado da auditoria das 139 seções (P1): aparecem em TODAS
# as check-lists E.x ('max rank →'), no C.7 ('análise de produtividade…'), etc.
_ROTULO_MARKERS = ("max rank", "ranking automatico", "analise de produtividade",
                   "criterios de", "ia: evolucao", "ia: ")


def eh_linha_rotulo(row, *, min_repeticao: int = 3) -> bool:  # noqa: ANN001
    """True se a linha é RÓTULO/SEPARADOR/HELPER (não dado) — utilitário transversal dos resolvers
    (P1 da auditoria). Cobre: (a) marcador de fórmula de roll-up/ranking/IA ('max rank →'); (b)
    separador de seção = mesmo texto repetido em ≥min_repeticao colunas (ex.: 'M4 Check-list' em
    6 colunas); (c) linha totalmente vazia. NÃO cobre family-header de 1 célula — isso o resolver
    trata pelo seu próprio check de coluna-ID vazia (combina os dois)."""
    if not isinstance(row, dict):
        return True
    vals = [v for v in row.values() if v is not None and str(v).strip() != ""]
    if not vals:
        return True
    texto = " ".join(str(v).lower() for v in vals)
    if any(m in texto for m in _ROTULO_MARKERS):
        return True
    # separador: o mesmo TEXTO (não-número) repetido em ≥min_repeticao colunas (ex.: 'M4 Check-list'
    # em 6 colunas). Números repetidos (linha toda 0) são DADO, não separador — não contam.
    textos = [str(v).strip() for v in vals if not isinstance(_num_limpo(v), float)]
    if textos:
        from collections import Counter
        mc_count = Counter(textos).most_common(1)[0][1]
        # …MAS só se o texto repetido DOMINA a linha (≤2 valores distintos = banner mesclado). Linha
        # com vários valores distintos além do repetido é DADO — ex.: D.10 Quantificação, cuja
        # descrição duplica em col_7/col_8 mas carrega Categoria/Valor/⭐/Incluir? distintos.
        if mc_count >= min_repeticao and len(set(textos)) <= 2:
            return True
    return False


def _folhas_por_edt(linhas: list[dict], edt_key: str) -> list[dict]:
    """Linhas-folha por EDT (nenhuma outra começa com edt+'.'). Só EDT válido."""
    edts = {}
    for i, r in enumerate(linhas):
        e = str(r.get(edt_key, "")).strip()
        if _EDT_VALIDO_RE.match(e):
            edts[i] = e
    code_set = set(edts.values())
    pais = {c for c in code_set if any(o != c and o.startswith(c + ".") for o in code_set)}
    return [linhas[i] for i, e in edts.items() if e not in pais]


def _detectar_edt_key(linhas: list[dict], preferido: str) -> str:
    """Acha a coluna de código EDT por conteúdo (varia entre seções: 'EDT' vs 'Item')."""
    for k in (preferido, "EDT", "Item", "Código", "Cod", "Codigo"):
        if any(_EDT_VALIDO_RE.match(str(r.get(k, "")).strip()) for r in linhas):
            return k
    return preferido


def unpivot_tabela_temporal(secao: dict, *, modo: str = "raiz", edt_key: str = "EDT",
                            edt_raiz: str = "1") -> dict:
    """Tabela larga (EDT × colunas-de-data) → linhas mensais {ano, mes, valor, valor_acumulado}.
    `modo='raiz'`: usa a linha EDT==edt_raiz (já é o roll-up — ex. sec[5] mensal).
    `modo='folhas'`: soma as folhas (ex. sec[12] diário), consolidando por mês.
    Rejeita '#REF!' (→ needs_review). NUNCA mistura raiz+folhas."""
    cols = secao.get("colunas") or []
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    edt_key = _detectar_edt_key(linhas, edt_key)
    date_cols = [c for c in cols if _DATA_COL_RE.match(str(c))]
    if not date_cols:
        return {"meses": [], "total": None, "status": "needs_review", "motivo": "sem colunas-de-data ISO"}

    # bucket por (ano, mes) — diário e mensal caem no mesmo balde
    buckets: dict[tuple, float] = {}
    fontes = []
    if modo == "raiz":
        raiz = next((r for r in linhas if str(r.get(edt_key, "")).strip() == edt_raiz), None)
        if raiz is None:
            return {"meses": [], "total": None, "status": "needs_review",
                    "motivo": f"linha raiz {edt_key}='{edt_raiz}' não encontrada"}
        fontes = [raiz]
    elif modo == "folhas":
        fontes = _folhas_por_edt(linhas, edt_key)
        if not fontes:
            return {"meses": [], "total": None, "status": "needs_review", "motivo": "nenhuma folha por EDT"}
    else:
        return {"meses": [], "total": None, "status": "needs_review", "motivo": f"modo inválido '{modo}'"}

    for r in fontes:
        for c in date_cols:
            v = _num_limpo(r.get(c))
            if v == "ERRO_REF":
                return {"meses": [], "total": None, "status": "needs_review",
                        "motivo": f"célula '#REF!' na coluna {c} — fonte corrompida"}
            if v is None:
                continue
            mm = _DATA_COL_RE.match(str(c))
            chave = (int(mm.group(1)), int(mm.group(2)))
            buckets[chave] = buckets.get(chave, 0.0) + v

    meses = [{"ano": a, "mes": m, "valor": round(val, 2)} for (a, m), val in sorted(buckets.items())]
    acc = 0.0
    for ordem, mm in enumerate(meses):
        mm["ordem"] = ordem
        acc += mm["valor"]
        mm["valor_acumulado"] = round(acc, 2)
    total = round(sum(m["valor"] for m in meses), 2)
    return {"meses": meses, "total": total, "status": "ok", "motivo": ""}


# ── Orçamento (BASE1 preço-de-venda por EAP + Atividades custo/receita/BDI) ──
def extrair_orcamento_base(secao: dict) -> dict:
    """BASE1 → itens-FOLHA (linhas com QUANT. e CUSTO UNITÁRIO presentes; pais não têm).
    Σ(custo total folhas) == preço de venda (39.776.000). ITEM com leading-zero ('01.01')
    é o EDT; alguns vêm date-mangled (nível None). Rejeita '#REF!'."""
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    itens: list[dict] = []
    soma = 0.0
    for ordem, r in enumerate(linhas):
        q, cu = r.get("QUANT."), r.get("CUSTO UNITÁRIO (R$)")
        num = lambda v: v if isinstance(v, (int, float)) and not isinstance(v, bool) else None  # noqa: E731
        if num(q) is None or num(cu) is None:
            continue  # não-folha
        ct = r.get("CUSTO TOTAL REAL (R$)")
        if isinstance(ct, str) and "#REF!" in ct.upper():
            return {"itens": [], "total": None, "status": "needs_review", "motivo": "#REF! em CUSTO TOTAL"}
        ctv = num(ct) if num(ct) is not None else round(float(q) * float(cu), 2)
        item = str(r.get("ITEM", "")).strip()
        itens.append({
            "ordem": ordem,
            "numero_item": item or None,
            "nivel": item.count(".") + 1 if _EDT_VALIDO_RE.match(item) else None,
            "descricao": (str(r.get("DESCRIÇÃO", "")).strip() or None),
            "unidade": (str(r.get("UNID.", "")).strip() or None),
            "quantidade": float(q),
            "custo_unitario": float(cu),
            "custo_total": float(ctv),
        })
        soma += float(ctv)
    return {"itens": itens, "total": round(soma, 2), "status": "ok", "motivo": ""}


def extrair_orcamento_resumo(secao: dict, *, raiz_custo: str = "001", raiz_receita: str = "003") -> dict:
    """Atividades → resumo de custo: raiz de custo (direto + indireto) · raiz de receita. Os códigos
    das raízes VARIAM por obra → parametrizados (defaults Sorriso, sobrescritos pela config p/ obra
    #2). O BDI (preço-venda / custo) é computado no handler. NÃO somar folhas (dobra o indireto)."""
    by = {str(r.get("Código da Tarefa", "")).strip(): r for r in (secao.get("linhas") or []) if isinstance(r, dict)}
    num = lambda v: float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None  # noqa: E731
    r_custo = by.get(raiz_custo)
    if r_custo is None:
        return {"status": "needs_review", "motivo": f"raiz '{raiz_custo}' (custo) não encontrada"}
    direto = num(r_custo.get("Custo Parcial"))
    indireto = num(r_custo.get("Custo Parcial Indireto"))
    r_receita = by.get(raiz_receita)
    receita = num(r_receita.get("Custo Parcial")) if r_receita else None
    custo_total = round((direto or 0.0) + (indireto or 0.0), 2)
    return {"custo_direto": direto, "custo_indireto": indireto,
            "custo_total_atividades": custo_total, "receita": receita,
            "status": "ok", "motivo": ""}


# ── Cronograma-fonte MS-Project (datas/durações/marcos planejados por EDT) ──
_BR_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")


def _parse_data_br(s) -> str | None:  # noqa: ANN001
    """'Ter 16/09/25' / '16/09/2025' → ISO '2025-09-16'. None se não casar."""
    m = _BR_DATE_RE.search(str(s))
    if not m:
        return None
    dia, mes, ano = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if ano < 100:
        ano += 2000
    return f"{ano:04d}-{mes:02d}-{dia:02d}"


def extrair_cronograma_tarefas(secao: dict) -> dict:
    """Cronograma MS-Project → tarefas planejadas (EDT, nome, duração, início/término, marco).
    Marco = Duração começa '0 dia'. Dedup por EDT (a 2ª linha 'Receita' repete o código).
    Estrutural (sem invariante de Σ monetária)."""
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    tarefas: list[dict] = []
    vistos: set[str] = set()
    for ordem, r in enumerate(linhas):
        edt = str(r.get("EDT", "")).strip()
        if not _EDT_VALIDO_RE.match(edt) or edt in vistos:
            continue
        vistos.add(edt)
        dur = str(r.get("Duração", "")).strip()
        durm = re.search(r"(\d+)", dur)
        q = r.get("Quantidade")
        tarefas.append({
            "ordem": ordem,
            "numero_item": edt,
            "nivel": edt.count(".") + 1,
            "nome": (str(r.get("Nome da Tarefa", "")).strip() or None),
            "unidade": (str(r.get("UND", "")).strip() or None),
            "quantidade": float(q) if isinstance(q, (int, float)) and not isinstance(q, bool) else None,
            "duracao_dias": int(durm.group(1)) if durm else None,
            "data_inicio": _parse_data_br(r.get("Início")),
            "data_termino": _parse_data_br(r.get("Término")),
            "eh_marco": dur.startswith("0 dia"),
        })
    n_marcos = sum(1 for t in tarefas if t["eh_marco"])
    prof = max((t["nivel"] for t in tarefas), default=0)
    return {"tarefas": tarefas, "n_distintos": len(tarefas), "n_marcos": n_marcos,
            "profundidade": prof, "status": "ok", "motivo": ""}


# ── Produtividade · Controle de Armação e Concreto (kg/person-hora real) ──
def extrair_produtividade(payload: dict) -> dict:
    """Controle de Armação e Concreto → produtividade REAL (kg/person-hora) consolidada por mês + KPIs
    de contexto. CUIDADO (decisão de domínio): o 'produtMediaArmacao' do Dashboard é MÉDIA ARITMÉTICA
    das razões diárias (estatisticamente errada) — NÃO usar. Recomputamos Σaço / Σ(horas×armadores)
    das tabelas diárias. Avanço físico e índice de perda saem do Dashboard como CONTEXTO; perda > 100%
    vira finding (anomalia de unidade/fórmula na origem), não dado limpo. Determinístico, sem LLM."""
    secoes = payload.get("secoes") or []
    findings: list[dict] = []

    dash = next((s for s in secoes if isinstance(s, dict) and s.get("tipo") == "chave_valor"
                 and isinstance(s.get("dados"), dict)
                 and any("perda" in _norm_key(k) or "avancofisico" in _norm_key(k) for k in s["dados"])), None)

    def kpi(*needles: str):
        if not dash:
            return None
        for k, v in dash["dados"].items():
            nk = _norm_key(k)
            if all(n in nk for n in needles):
                return _num_limpo(v.get("valor") if isinstance(v, dict) else v)
        return None

    aco_total_dash = kpi("aco", "total")
    avanco_fisico = kpi("avanco", "fisico")
    indice_perda = kpi("indice", "perda")

    por_mes: dict[tuple, dict] = {}
    for s in secoes:
        ls = [r for r in (s.get("linhas") or []) if isinstance(r, dict)]
        if not ls:
            continue
        cols = list(ls[0].keys())

        def _col(cands: list[str]):
            for c in cols:
                u = str(c).upper()
                if any(x in u for x in cands):
                    return c
            return None

        cdata, choras, carm, caco = (_col(["DATA"]), _col(["HORAS"]),
                                     _col(["ARMADOR"]), _col(["AÇO EXEC", "ACO EXEC"]))
        if not (cdata and choras and carm and caco):
            continue  # só tabelas DIÁRIAS de armação
        for r in ls:
            m = re.search(r"(\d{4})-(\d{2})", str(r.get(cdata, "")))
            aco, h, arm = _num_limpo(r.get(caco)), _num_limpo(r.get(choras)), _num_limpo(r.get(carm))
            if not (m and isinstance(aco, (int, float)) and isinstance(h, (int, float)) and aco > 0 and h > 0):
                continue
            key = (int(m.group(1)), int(m.group(2)))
            ph = h * (arm if isinstance(arm, (int, float)) and arm > 0 else 1)
            a = por_mes.setdefault(key, {"aco": 0.0, "person_horas": 0.0, "n_dias": 0})
            a["aco"] += aco
            a["person_horas"] += ph
            a["n_dias"] += 1

    meses = [{"ano": k[0], "mes": k[1], "aco_kg": round(v["aco"], 3),
              "person_horas": round(v["person_horas"], 2),
              "produtividade_kg_ph": round(v["aco"] / v["person_horas"], 4) if v["person_horas"] else None,
              "n_dias": v["n_dias"]} for k, v in sorted(por_mes.items())]
    aco_total = round(sum(m["aco_kg"] for m in meses), 3)
    ph_total = round(sum(m["person_horas"] for m in meses), 2)
    prod_real = round(aco_total / ph_total, 4) if ph_total else None

    if isinstance(aco_total_dash, (int, float)) and abs(aco_total - aco_total_dash) > max(1.0, 0.01 * aco_total_dash):
        findings.append({"severity": "warn", "msg": f"Σ aço tabelas ({aco_total}) ≠ dashboard ({aco_total_dash})"})
    if isinstance(indice_perda, (int, float)) and indice_perda > 100:
        findings.append({"severity": "warn",
                         "msg": f"índice de perda de aço {indice_perda}% > 100% — ANOMALIA (erro de unidade/fórmula na origem)"})

    resumo = {"aco_total_kg": aco_total, "person_horas_total": ph_total,
              "produtividade_real_kg_ph": prod_real,
              "avanco_fisico_pct": round(avanco_fisico * 100, 2) if isinstance(avanco_fisico, (int, float)) else None,
              "indice_perda_pct_raw": indice_perda if isinstance(indice_perda, (int, float)) else None,
              "n_meses": len(meses)}
    status = "ok" if meses else "needs_review"
    if not meses:
        findings.append({"severity": "error", "msg": "nenhuma tabela diária de armação (DATA/HORAS/ARMADORES/AÇO)"})
    return {"meses": meses, "resumo": resumo, "findings": findings, "status": status, "motivo": ""}


# ── Gate de PERTINÊNCIA · este documento é DESTA obra? ───────────────────
# Defesa contra contaminação cross-obra (o acervo real tinha docs de Sorocaba e Novo Túnel filtrados
# pra obra do Sorriso). Determinístico: compara TOKENS DISTINTIVOS da obra (cidade/nome próprio,
# derivados do cadastro) contra o resumo do doc. Genérico: nada de "Sorriso" hardcoded.
_OBRA_STOPWORDS = frozenset({
    "aeroporto", "terminal", "passageiros", "obra", "obras", "construcao", "construção",
    "edificacao", "edificação", "edificacoes", "edificações", "complementares", "complementar",
    "novo", "nova", "regional", "internacional", "teste", "real", "tps", "ampliacao", "ampliação",
    "reforma", "rodovia", "ponte", "hospital", "escola", "predio", "prédio", "centro", "sistema",
    "execucao", "execução", "projeto", "servicos", "serviços", "contrato", "consorcio", "consórcio",
})


def tokens_obra_de(nome_interno: str | None = None, cidade: str | None = None,
                   uf: str | None = None, contratante: str | None = None) -> list[str]:
    """Tokens DISTINTIVOS da identidade da obra (cidade/nome próprio) p/ o gate de pertinência.
    Remove genéricos (aeroporto/terminal/teste…) e palavras curtas. Lowercase, ordem preservada.
    Vazio = obra sem identidade cadastrada → o gate passa (não dá pra checar)."""
    out: list[str] = []
    for campo in (nome_interno, cidade, contratante):
        for w in re.findall(r"[a-zà-ú0-9]+", (campo or "").lower()):
            if len(w) >= 4 and w not in _OBRA_STOPWORDS and w not in out:
                out.append(w)
    if uf and len(uf.strip()) == 2 and uf.strip().lower() not in out:
        out.append(uf.strip().lower())
    return out


_MES_ABBR = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
             "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}
_MES_COL_RE = re.compile(r"(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s*[-/]?\s*(\d{2,4})\b",
                         re.IGNORECASE)


def parse_mes_abbr(col) -> tuple[int, int] | None:  # noqa: ANN001
    """'out.-25' / 'mai-26' / 'jan.26' / 'mar-2026' / 'mar/2026' → (ano, mes). None se não casar.
    Ano de 2 dígitos vira 20xx; 4 dígitos é usado direto (replicável entre templates)."""
    m = _MES_COL_RE.search(str(col))
    if not m:
        return None
    ano = int(m.group(2))
    return (ano + 2000 if ano < 100 else ano, _MES_ABBR[m.group(1).lower()])


def _pct_para_fracao(v) -> float | None:  # noqa: ANN001
    """% físico → fração 0..1. Aceita '4,14%' / '4,14' / 4.14 (sempre é %: 4,14 → 0,0414). Para %
    (0–100) não há separador de milhar, então ',' é sempre decimal. None se não-numérico/vazio."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v) / 100.0
    s = str(v).replace("%", "").replace(" ", "").replace(",", ".").strip()
    if not s:
        return None
    try:
        return float(s) / 100.0
    except ValueError:
        return None


def extrair_cronograma_fisico_tabela(secao: dict, *, edt_raiz: str = "1", edt_key: str = "EDT") -> dict:
    """Cronograma Físico-Financeiro em formato TABELA (EDT × colunas-mês 'out.-25') → curva PREVISTA
    FÍSICA da linha-raiz (EDT==edt_raiz = roll-up % do projeto). Valores são % físico ('4,14%' →
    fração 0,0414). Gate Σ% == 100% protege. Distinto de unpivot_temporal (que lê chave_valor)."""
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    raiz = next((r for r in linhas if str(r.get(edt_key, "")).strip() == edt_raiz), None)
    if raiz is None:
        return {"meses": [], "soma_pct": None, "header": {}, "status": "needs_review",
                "findings": [{"severity": "error", "msg": f"linha raiz {edt_key}='{edt_raiz}' não encontrada"}]}
    pares: list[tuple] = []
    for col in (secao.get("colunas") or list(raiz.keys())):
        d = parse_mes_abbr(col)
        if d is None:
            continue
        frac = _pct_para_fracao(raiz.get(col))
        if frac is None:
            continue
        pares.append((d, frac))
    pares.sort(key=lambda x: x[0])  # CRONOLÓGICO (a extração pode vir em ordem alfabética)
    meses: list[dict] = []
    acc = 0.0
    for ordem, ((ano, mes), frac) in enumerate(pares):
        acc += frac
        meses.append({"ordem": ordem, "ano": ano, "mes": mes,
                      "competencia_chave": f"{ano}-{mes:02d}",
                      "previsto_pct": round(frac, 6), "previsto_pct_acumulado": round(acc, 6),
                      "previsto_financeiro_declarado": None})
    header: dict = {"custo_total_obra": None}  # 'Valor total' do FF é corrompido na extração → None
    ini = _parse_data_br(raiz.get("Início") or raiz.get("Inicio") or "")
    fim = _parse_data_br(raiz.get("Término") or raiz.get("Termino") or "")
    if ini:
        header["inicio_obra"] = ini
    if fim:
        header["termino_obra"] = fim
    status = "ok" if meses else "needs_review"
    findings = [] if meses else [{"severity": "error", "msg": "nenhuma coluna-mês na linha raiz"}]
    return {"meses": meses, "soma_pct": round(acc, 4) if meses else None,
            "header": header, "status": status, "findings": findings, "motivo": ""}


def extrair_indice_reajuste(payload: dict) -> dict:
    """Solicitação de Reajustamento (PSP) → índice contratual de reajuste. Lê a 'Legenda dos Índices'
    (FGVDADOS): o índice é a FAMÍLIA dominante entre as séries ATIVAS (com variação preenchida —
    séries descontinuadas têm variação null e NÃO contam). Resolve o §4.4 (era IPCA no mock; o real
    é INCC). Periodicidade derivada da distância (em meses) das datas de referência nas colunas.
    Determinístico. Auto-contido (acha a própria seção)."""
    secoes = (payload or {}).get("secoes") or []
    sec = next(
        (s for s in secoes if isinstance(s, dict)
         and "legenda" in str(s.get("titulo", "")).lower()
         and ("índice" in str(s.get("titulo", "")).lower()
              or "indice" in str(s.get("titulo", "")).lower())),
        None,
    )
    if sec is None:
        return {"indice": None, "periodicidade": None, "series": [], "familias": {},
                "status": "needs_review", "motivo": "seção 'Legenda dos Índices' não encontrada",
                "findings": [{"severity": "error", "msg": "seção 'Legenda dos Índices' ausente"}]}
    familias: dict[str, int] = {}
    series: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        desc = str(r.get("Descrição") or "").strip()
        var = r.get("Variação")
        fam = re.split(r"[-\s]", desc, maxsplit=1)[0].strip().upper() if desc else ""
        series.append({"codigo": str(r.get("Código") or "").strip(), "descricao": desc[:60],
                       "variacao": var if isinstance(var, (int, float)) else None})
        if fam and isinstance(var, (int, float)):  # só séries ATIVAS (usadas no reajuste)
            familias[fam] = familias.get(fam, 0) + 1
    if not familias:
        return {"indice": None, "periodicidade": None, "series": series, "familias": {},
                "status": "needs_review", "motivo": "nenhum índice ativo (com variação) na legenda",
                "findings": [{"severity": "error", "msg": "nenhuma série de índice com variação"}]}
    indice = max(familias, key=lambda k: familias[k])

    # periodicidade pela distância das datas MM/YY nos cabeçalhos (08/24 → 08/25 = 12m = anual)
    datas = sorted({(int(m.group(2)), int(m.group(1)))
                    for col in (sec.get("colunas") or [])
                    for m in [re.search(r"(\d{2})/(\d{2})", str(col))] if m})
    periodicidade = None
    if len(datas) >= 2:
        (y0, m0), (y1, m1) = datas[0], datas[-1]
        gap = (y1 - y0) * 12 + (m1 - m0)
        periodicidade = {12: "anual", 6: "semestral", 3: "trimestral", 1: "mensal"}.get(gap)

    findings = []
    if len(familias) > 1:
        findings.append({"severity": "warn",
                         "msg": f"múltiplas famílias ativas {familias} — dominante '{indice}'"})
    return {"indice": indice, "periodicidade": periodicidade, "series": series,
            "familias": familias, "status": "ok", "motivo": "", "findings": findings}


def gate_pertinencia(texto: str, tokens_obra: list[str]) -> dict:
    """O documento menciona a obra? Casa os tokens distintivos da obra contra o texto (resumo da
    extração). SEM tokens (obra sem identidade) → passa (não dá pra checar, não inventa bloqueio).
    `pertinente=False` só quando a obra TEM identidade e o doc não cita NENHUM token dela."""
    if not tokens_obra:
        return {"pertinente": True, "tokens_casados": [], "motivo": None}
    t = (texto or "").lower()
    casados = [tok for tok in tokens_obra if tok in t]
    if casados:
        return {"pertinente": True, "tokens_casados": casados, "motivo": None}
    return {"pertinente": False, "tokens_casados": [],
            "motivo": f"doc não menciona a obra (tokens esperados: {', '.join(tokens_obra)})"}


# ── Insumos · take-off FÍSICO mensal (Histograma de Insumos por Quantidades) ──
_HIST_MES_RE = re.compile(r"^De (\d{2})/(\d{2})/(\d{4})")  # "De 01/09/2025 até 30/09/2025" → mês de início


def extrair_insumos_histograma(secao: dict) -> dict:
    """Histograma de Insumos por Quantidades (XLSX) → take-off FÍSICO por insumo.

    Linha-FOLHA = tem 'Código do Insumo' (os pais EAP não têm). Agrega por código (1 unidade por
    código) somando a distribuição mensal. GATE no chamador: Σ células mensais == Σ 'Total'
    declarado (conservação) + por linha Total==Σmeses. Exclui garbage (cód '9999' / desc 'Teste').
    Rejeita '#REF!'. Branco ≠ zero: só guarda meses com qtde != 0. NÃO toca preço (catálogo é
    pântano: 0/absurdo/unidade inconsistente) — preço/ABC entram num passo de enriquecimento.
    Unidades NÃO somam entre si (KG/M3/H/% distintos) — por isso a chave é o CÓDIGO atômico."""
    cols = secao.get("colunas") or []
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    mes_cols = [(c, int(m.group(3)), int(m.group(2)))
                for c in cols for m in [_HIST_MES_RE.match(str(c))] if m]
    if not mes_cols:
        return {"insumos": [], "meses": [], "total_geral": None, "soma_total_declarado": None,
                "n_folhas": 0, "n_insumos": 0, "n_violacoes_linha": 0, "status": "needs_review",
                "findings": [{"severity": "error", "msg": "sem colunas-de-mês 'De dd/mm/aaaa'"}],
                "motivo": "sem meses"}

    findings: list[dict] = []
    agg: dict[str, dict] = {}
    soma_total = soma_cells = 0.0
    n_folhas = n_viol = 0

    for r in linhas:
        cod_raw = r.get("Código do Insumo")
        if cod_raw in (None, ""):
            continue  # pai EAP (sem código de insumo) — não soma (evita dupla contagem)
        cod = str(cod_raw).strip()
        desc = str(r.get("Descrição") or "").strip()
        if cod == "9999" or "teste" in desc.lower():
            findings.append({"severity": "warn", "msg": f"garbage excluído: cód={cod} '{desc[:30]}'"})
            continue
        n_folhas += 1
        unidade = (str(r.get("Unidade") or "").strip() or None)

        tot = _num_limpo(r.get("Total"))
        if tot == "ERRO_REF":
            return {"insumos": [], "meses": [], "total_geral": None, "soma_total_declarado": None,
                    "n_folhas": 0, "n_insumos": 0, "n_violacoes_linha": 0, "status": "needs_review",
                    "findings": [{"severity": "error", "msg": f"#REF! em Total (cód {cod})"}],
                    "motivo": "#REF!"}
        tot = tot or 0.0

        cells: dict[tuple, float] = {}
        smm = 0.0
        for (c, ano, mes) in mes_cols:
            v = _num_limpo(r.get(c))
            if v == "ERRO_REF":
                return {"insumos": [], "meses": [], "total_geral": None, "soma_total_declarado": None,
                        "n_folhas": 0, "n_insumos": 0, "n_violacoes_linha": 0, "status": "needs_review",
                        "findings": [{"severity": "error", "msg": f"#REF! em {c} (cód {cod})"}],
                        "motivo": "#REF!"}
            if v:
                cells[(ano, mes)] = cells.get((ano, mes), 0.0) + v
                smm += v

        soma_total += tot
        soma_cells += smm
        if abs(tot - smm) > max(0.01, abs(tot) * 0.01):
            n_viol += 1
            findings.append({"severity": "warn",
                             "msg": f"cód={cod}: Total {tot:.4f} ≠ Σmeses {smm:.4f}"})

        a = agg.setdefault(cod, {"descricao": desc, "unidade": unidade, "meses": {}})
        if a["unidade"] is None:
            a["unidade"] = unidade
        elif unidade is not None and a["unidade"] != unidade:
            findings.append({"severity": "error",
                             "msg": f"cód={cod} com 2 unidades: {a['unidade']} vs {unidade}"})
        for k, v in cells.items():
            a["meses"][k] = a["meses"].get(k, 0.0) + v

    insumos: list[dict] = []
    meses_out: list[dict] = []
    for cod, a in sorted(agg.items()):
        q_total = round(sum(a["meses"].values()), 4)
        insumos.append({"codigo": cod, "descricao": a["descricao"],
                        "unidade": a["unidade"], "qtde_total": q_total})
        for (ano, mes), q in sorted(a["meses"].items()):
            if q:
                meses_out.append({"codigo": cod, "ano": ano, "mes": mes, "qtde": round(q, 4)})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"insumos": insumos, "meses": meses_out,
            "total_geral": round(soma_cells, 4), "soma_total_declarado": round(soma_total, 4),
            "n_folhas": n_folhas, "n_insumos": len(insumos), "n_violacoes_linha": n_viol,
            "status": status, "findings": findings, "motivo": ""}


def extrair_insumos_valor(secao: dict) -> dict:
    """Histograma de Insumos por VALOR → valor orçado (R$) por insumo: Σ 'Total' das linhas-FOLHA
    (tem 'Código do Insumo'), agregado por código (um insumo aparece sob várias tarefas/composições).
    É REFERÊNCIA orçada, NÃO preço de centavo (conf 0,600 na origem; fontes de valor divergem ~7%) —
    habilita a Curva ABC POR VALOR (ranking de Pareto). Exclui garbage (cód 9999/'Teste'); #REF!
    vira finding (não derruba). Devolve itens ordenados por valor desc + total."""
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    agg: dict[str, dict] = {}
    findings: list[dict] = []
    for r in linhas:
        cod_raw = r.get("Código do Insumo")
        if cod_raw in (None, ""):
            continue  # pai EAP (sem código de insumo) — não soma (evita dupla contagem)
        cod = str(cod_raw).strip()
        desc = str(r.get("Descrição") or "").strip()
        if cod == "9999" or "teste" in desc.lower():
            continue
        tot = _num_limpo(r.get("Total"))
        if tot == "ERRO_REF":
            findings.append({"severity": "warn", "msg": f"#REF! em Total (cód {cod}) — ignorado"})
            continue
        a = agg.setdefault(cod, {"descricao": desc, "valor": 0.0})
        a["valor"] += float(tot) if tot else 0.0
    itens = [{"codigo": c, "descricao": a["descricao"], "valor_orcado": round(a["valor"], 2)}
             for c, a in agg.items()]
    itens.sort(key=lambda i: i["valor_orcado"], reverse=True)
    total = round(sum(i["valor_orcado"] for i in itens), 2)
    return {"itens": itens, "total_valor": total, "n": len(itens),
            "findings": findings, "status": "ok" if itens else "needs_review", "motivo": ""}


def extrair_insumos_catalogo(secao: dict) -> dict:
    """Cadastro de Insumos (sheet 'Insumos' do Cronograma curva ABC) → metadados por CÓDIGO para
    ENRIQUECER o take-off físico: classe ABC (col 'Grupo de Insumos': A/B/C/D/N — guardada verbatim,
    NÃO forçar em A/B/C) e grupo de custo (MATERIAIS/MAO-DE-OBRA…). O preço ('Valor') é guardado
    apenas como CRU (`valor_raw`) — é pântano (0/absurdo: aço 0,01 R$/kg, pacotes I-codados em R$
    milhões) e NÃO é persistido como preço unitário; preço confiável vem do trabalho de preço-real
    × índice (depois). Exclui garbage (cód '9999'/'Teste')."""
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    out: dict[str, dict] = {}
    findings: list[dict] = []
    for r in linhas:
        cod_raw = r.get("Código")
        if cod_raw in (None, ""):
            continue
        cod = str(cod_raw).strip()
        desc = str(r.get("Descrição") or "").strip()
        if cod == "9999" or "teste" in desc.lower():
            findings.append({"severity": "warn", "msg": f"garbage no catálogo: cód={cod}"})
            continue
        valor = _num_limpo(r.get("Valor"))
        valor = None if valor in (None, "ERRO_REF") else float(valor)
        out[cod] = {
            "codigo": cod,
            "descricao": desc or None,
            "unidade": (str(r.get("Unidade") or "").strip() or None),
            "classe_abc": (str(r.get("Grupo de Insumos") or "").strip() or None),
            "grupo_custo": (str(r.get("Grupo de Custo") or "").strip() or None),
            "valor_raw": valor,  # CRU · não confiável · não persistido como preço
        }
    return {"por_codigo": out, "n": len(out), "findings": findings,
            "status": "ok", "motivo": ""}


# ── Workbook-motor · C.6 Insumos · Curva ABC de materiais (preço ORÇADO por insumo) ──────────
def _achar_coluna(colunas, *candidatos: str):  # noqa: ANN001
    """1ª coluna cujo nome normalizado CONTÉM um dos candidatos (substring, sem acento/espaço).
    Robusto a variações de grafia entre obras. None se nenhuma casar."""
    norm = [(c, _norm_key(c)) for c in (colunas or [])]
    for cand in candidatos:
        nc = _norm_key(cand)
        if not nc:
            continue
        for original, n in norm:
            if nc in n:
                return original
    return None


def _achar_coluna_exata(colunas, *candidatos: str):  # noqa: ANN001
    """Como _achar_coluna mas exige IGUALDADE do nome normalizado (não substring). Necessário
    quando o _norm_key colapsa nomes distintos — ex.: '%MOD'→'mod' vs 'MOD R$/un'→'modrun': o
    substring 'mod' casaria a coluna ERRADA (R$/un). Aqui '%MOD' só casa a coluna cujo norm == 'mod'."""
    norm = [(c, _norm_key(c)) for c in (colunas or [])]
    for cand in candidatos:
        nc = _norm_key(cand)
        if not nc:
            continue
        for original, n in norm:
            if n == nc:
                return original
    return None


def _slug_insumo(nome: str) -> str:
    """Código determinístico do insumo (a Curva ABC não traz código atômico). Estável p/ a chave
    unique de obra_insumos. Lowercase sem acento, alfanumérico + hífen, ≤60 chars."""
    s = re.sub(r"[^a-z0-9]+", "-", _norm_key_keepspace(nome)).strip("-")
    return s[:60] or "insumo"


def _norm_key_keepspace(s) -> str:  # noqa: ANN001
    """Como _norm_key mas PRESERVA espaços (vira hífen no slug) — mantém legibilidade do código."""
    import unicodedata
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9 ]", "", s.lower())


def extrair_insumos_curva_abc(secao: dict, *, total_declarado=None) -> dict:  # noqa: ANN001
    """Curva ABC de materiais do workbook-motor (C.6) → preço ORÇADO por insumo + classe ABC +
    valor orçado. Chave = nome (sem código atômico na fonte) → codigo = slug determinístico.
    Eixo REAL (preço real pago / reajustado / variação) fica NULL quando vazio no doc — honesto,
    nunca vira zero nem farol verde. Conservação conferida no chamador (gate_insumos_abc):
    Σ valor == TOTAL declarado · Σ % == 1,0 · valor == qtde × preço orçado.
    Determinístico: o modelo não calcula — todos os números são fonte declarada do workbook."""
    cols = secao.get("colunas") or []
    linhas = [r for r in (secao.get("linhas") or []) if isinstance(r, dict)]
    c_ins = _achar_coluna(cols, "insumo", "descricao", "material")
    c_val = _achar_coluna(cols, "custo total", "valor total", "valor orcado")
    if c_ins is None or c_val is None:
        return {"insumos": [], "soma_valor": None, "soma_pct": None, "total_declarado": total_declarado,
                "n_violacoes_linha": 0, "n_insumos": 0, "eixo_real_vazio": True, "status": "needs_review",
                "motivo": "colunas Insumo/Custo total não encontradas",
                "findings": [{"severity": "error", "campo": "colunas",
                              "msg": "seção sem coluna Insumo/Custo total — não-ingerível"}]}
    c_und = _achar_coluna(cols, "unidade", "und", "un")
    c_qtd = _achar_coluna(cols, "qtde contratada", "quantidade", "qtde")
    c_orc = _achar_coluna(cols, "preco orcado", "preco unit")
    # % total: "%"-aware (o _norm_key tira o '%', então "% total" colidiria com "Custo total").
    c_pct = next((c for c in cols if "%" in str(c) and "total" in str(c).lower()
                  and "acum" not in str(c).lower()), None)
    c_cls = _achar_coluna(cols, "classe")
    c_reaj = _achar_coluna(cols, "preco reajustado")
    c_real = _achar_coluna(cols, "preco real")

    insumos: list[dict] = []
    findings: list[dict] = []
    soma_valor = soma_pct = 0.0
    n_viol = real_preenchido = 0
    vistos: set[str] = set()

    for r in linhas:
        nome = str(r.get(c_ins) or "").strip()
        if not nome or nome.upper() in ("TOTAL", "TOTAL GERAL", "TOTAL (R$)"):
            continue  # linha de total (defensivo · a fonte já costuma excluir)
        qtde = _num_limpo(r.get(c_qtd)) if c_qtd else None
        preco = _num_limpo(r.get(c_orc)) if c_orc else None
        valor = _num_limpo(r.get(c_val))
        if "ERRO_REF" in (qtde, preco, valor):
            return {"insumos": [], "soma_valor": None, "soma_pct": None, "total_declarado": total_declarado,
                    "n_violacoes_linha": 0, "n_insumos": 0, "eixo_real_vazio": True, "status": "needs_review",
                    "motivo": "#REF!", "findings": [{"severity": "error", "campo": "celula",
                                                     "msg": f"#REF! na linha '{nome[:30]}'"}]}
        pct = _num_limpo(r.get(c_pct)) if c_pct else None
        classe = (str(r.get(c_cls)).strip() if c_cls and r.get(c_cls) not in (None, "") else None)
        preco_reaj = _num_limpo(r.get(c_reaj)) if c_reaj else None
        preco_real = _num_limpo(r.get(c_real)) if c_real else None
        if isinstance(preco_real, float):
            real_preenchido += 1

        codigo = _slug_insumo(nome)
        if codigo in vistos:
            codigo = f"{codigo}-{len(insumos)}"
        vistos.add(codigo)

        if isinstance(qtde, float) and isinstance(preco, float) and isinstance(valor, float):
            # tol 0,5% + piso R$1: a qtde/preço exibidos são arredondados, o Custo total tem mais
            # precisão (ex.: PEDRISCO 2,78×147=408,66 vs 409,12 = 0,11%). Pega só erro GROSSO
            # (ordens de grandeza). A conservação Σ (gate) é o check autoritativo.
            if abs(qtde * preco - valor) > max(1.0, abs(valor) * 0.005):
                n_viol += 1
        if isinstance(valor, float):
            soma_valor += valor
        if isinstance(pct, float):
            soma_pct += pct

        insumos.append({
            "codigo": codigo,
            "descricao": nome,
            "unidade": (str(r.get(c_und)).strip() if c_und and r.get(c_und) else None),
            "qtde_total": qtde if isinstance(qtde, float) else None,
            "classe_abc": classe,
            "grupo_custo": "MATERIAIS",
            "preco_orcado_unit": preco if isinstance(preco, float) else None,
            "valor_orcado": valor if isinstance(valor, float) else None,
            "preco_reajustado_unit": preco_reaj if isinstance(preco_reaj, float) else None,
            "preco_real_pago_unit": preco_real if isinstance(preco_real, float) else None,
        })

    eixo_real_vazio = real_preenchido == 0
    if eixo_real_vazio and insumos:
        findings.append({"severity": "warn", "campo": "preco_real_pago_unit",
                         "msg": "eixo de preço REAL vazio no workbook (BM-1) — preço real/variação ficam "
                                "NULL; farol de desvio de preço fica PENDENTE (nunca verde sem o real)"})
    if not insumos:
        findings.append({"severity": "error", "campo": "insumos", "msg": "nenhum insumo extraível"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"insumos": insumos, "soma_valor": round(soma_valor, 2), "soma_pct": round(soma_pct, 6),
            "total_declarado": total_declarado, "n_violacoes_linha": n_viol, "n_insumos": len(insumos),
            "eixo_real_vazio": eixo_real_vazio, "status": status, "motivo": "", "findings": findings}


# ── C.4 RECURSOS (MOD/MOI/EQP) — Contratado × Real, item a item + histograma mensal ──────────────

# Matching ROBUSTO à variação de título entre workbooks: a extração DESCREVE cada seção e a frase
# varia ("MOD por função" → "MOD recurso a recurso"). Casamos pela ESTRUTURA (coluna de nome +
# Contratado(q)) + token de categoria (MOD/MOI/EQP como PALAVRA inteira no título). Nem do código
# da seção dependemos — basta a forma da tabela.
_CAT_TOKEN_RE = {
    "MOD": re.compile(r"\bMOD\b"),
    "MOI": re.compile(r"\bMOI\b"),
    "EQP": re.compile(r"\bEQP\b"),
}
# Chaves do dado declarado em "Recursos — Totais por categoria" — ÂNCORA EXTRA do gate quando o
# template traz esse bloco de controle; NÃO é requisito (o gate conserva por cruzamento).
_RECURSO_TOTAIS = {"MOD": "TOTAL_MOD", "MOI": "TOTAL_MOI", "EQP": "TOTAL_EQP"}


def _achar_secao_por_titulo(secoes: list[dict], *needles: str) -> dict | None:
    """1ª seção cujo título normalizado contém TODOS os needles. Espelha o _achar_secao do
    workbook_motor, replicado aqui p/ os resolvers serem testáveis sem o handler."""
    alvos = [_norm_key(n) for n in needles]
    for s in secoes:
        if isinstance(s, dict) and all(a in _norm_key(s.get("titulo") or "") for a in alvos):
            return s
    return None


def _categoria_unica_do_titulo(titulo: str) -> str | None:
    """Categoria (MOD|MOI|EQP) se o título tiver EXATAMENTE uma como palavra inteira; senão None
    (histograma 'MOD/MOI/EQP'=3 → None; '4 maiores MOD+EQP'=2 → None; 'MOD recurso a recurso'=1)."""
    achados = [c for c, rx in _CAT_TOKEN_RE.items() if rx.search(titulo or "")]
    return achados[0] if len(achados) == 1 else None


def _tem_col(cols, *cands) -> bool:  # noqa: ANN001
    return _achar_coluna(cols, *cands) is not None


def _tem_col_mes(cols) -> bool:  # noqa: ANN001
    return _tem_col(cols, "periodo") or any(_norm_key(c) == "mes" for c in (cols or []))


def _eh_tabela_por_recurso(secao: dict) -> bool:
    """Tabela 'recurso a recurso' (lista função/equipamento): coluna de NOME + 'Contratado (q)',
    COM linhas, e NÃO série mensal (sem coluna Mês/Período). Casa pela ESTRUTURA, não pela frase."""
    cols = secao.get("colunas") or []
    linhas = secao.get("linhas")
    if not isinstance(linhas, list) or not linhas:
        return False
    return (_tem_col(cols, "recurso", "funcao", "item", "equipamento", "descricao")
            and _tem_col(cols, "contratado (q)", "contratado q", "contratada (q)")
            and not _tem_col_mes(cols))


def achar_histograma_recursos(secoes: list[dict]) -> dict | None:
    """Histograma mensal de recursos pela ESTRUTURA: coluna Mês/Período + colunas de categoria
    (MOD/MOI/EQP Contr.). Robusto à variação de título."""
    for s in secoes:
        if not isinstance(s, dict):
            continue
        cols = s.get("colunas") or []
        if (_tem_col_mes(cols) and _tem_col(cols, "mod contr", "moi contr", "eqp contr")
                and isinstance(s.get("linhas"), list) and s["linhas"]):
            return s
    return None


def extrair_recursos(secoes: list[dict]) -> dict:
    """Lê as tabelas 'recurso a recurso' (MOD/MOI/EQP) do C.4 → itens com qtde e R$ Contratado ×
    Real. Casa por ESTRUTURA (coluna nome + Contratado(q)) + token de categoria no título — robusto
    à variação de descrição entre workbooks. Totais declarados (bloco de controle) entram como
    ÂNCORA EXTRA do gate quando existirem. Determinístico; eixo REAL fica NULL quando vazio."""
    itens: list[dict] = []
    findings: list[dict] = []
    por_categoria: dict[str, dict] = {}
    real_preenchido = 0
    vistos: set[str] = set()

    for sec in secoes:
        if not isinstance(sec, dict) or not _eh_tabela_por_recurso(sec):
            continue
        categoria = _categoria_unica_do_titulo(sec.get("titulo") or "")
        if categoria is None or categoria in vistos:
            continue  # título sem categoria única (ex.: '4 maiores MOD+EQP') ou já capturada
        vistos.add(categoria)
        cols = sec.get("colunas") or []
        c_nome = _achar_coluna(cols, "recurso", "funcao", "item", "equipamento", "descricao")
        c_cq = _achar_coluna(cols, "contratado (q)", "contratado q", "contratada (q)")
        c_rq = _achar_coluna(cols, "real (q)", "real q")
        c_crs = _achar_coluna(cols, "contratado (r$)", "contratado r")
        c_rrs = _achar_coluna(cols, "real (r$)", "real r")
        soma_q = soma_rs = 0.0
        n_cat = 0
        for r in (sec.get("linhas") or []):
            if not isinstance(r, dict):
                continue
            nome = str(r.get(c_nome) or "").strip() if c_nome else ""
            if not nome or nome.upper().startswith("TOTAL"):
                continue  # defensivo: linha de total (a fonte já costuma excluir)
            cq = _num_limpo(r.get(c_cq)) if c_cq else None
            rq = _num_limpo(r.get(c_rq)) if c_rq else None
            crs = _num_limpo(r.get(c_crs)) if c_crs else None
            rrs = _num_limpo(r.get(c_rrs)) if c_rrs else None
            if "ERRO_REF" in (cq, rq, crs, rrs):
                findings.append({"severity": "error", "campo": "celula",
                                 "msg": f"#REF! em {categoria} '{nome[:30]}'"})
                continue
            if (isinstance(rq, float) and rq != 0) or (isinstance(rrs, float) and rrs != 0):
                real_preenchido += 1
            if isinstance(cq, float):
                soma_q += cq
            if isinstance(crs, float):
                soma_rs += crs
            n_cat += 1
            itens.append({
                "categoria": categoria, "recurso": nome, "ordem": len(itens),
                "contratado_qtde": cq if isinstance(cq, float) else None,
                "real_qtde": rq if isinstance(rq, float) else None,
                "contratado_rs": crs if isinstance(crs, float) else None,
                "real_rs": rrs if isinstance(rrs, float) else None,
            })
        por_categoria[categoria] = {"n": n_cat, "soma_qtde": round(soma_q, 4),
                                    "soma_rs": round(soma_rs, 2) if soma_rs else None}

    for categoria in ("MOD", "MOI", "EQP"):
        if categoria not in por_categoria:
            findings.append({"severity": "warn", "campo": categoria,
                             "msg": f"tabela '{categoria} recurso a recurso' não localizada "
                                    "(estrutura nome+Contratado(q) + token de categoria no título)"})

    # Totais declarados — ÂNCORA EXTRA do gate ('Totais por categoria'), quando o template traz.
    # Ausência é OK: o gate conserva por cruzamento per-recurso × histograma.
    declarados: dict[str, dict] = {}
    sec_tot = _achar_secao_por_titulo(secoes, "recursos", "totais por categoria")
    if sec_tot is not None and isinstance(sec_tot.get("dados"), dict):
        d = sec_tot["dados"]
        for categoria, chave in _RECURSO_TOTAIS.items():
            bloco = d.get(chave) or {}
            if isinstance(bloco, dict):
                declarados[categoria] = {
                    "contratado_qtde": _num_limpo(bloco.get("contratado_qtde")),
                    "contratado_rs": _num_limpo(bloco.get("contratado_RS")),
                }

    eixo_real_vazio = real_preenchido == 0
    if eixo_real_vazio and itens:
        findings.append({"severity": "warn", "campo": "real_qtde",
                         "msg": "eixo REAL de recursos vazio (obra pré-execução) — real fica NULL; "
                                "farol de mobilização PENDENTE (nunca verde sem realizado)"})
    if not itens:
        findings.append({"severity": "error", "campo": "itens", "msg": "nenhum recurso extraível"})

    # SANIDADE-por-coluna (warn, não veta): pega o que o Σ não pega — coluna trocada / magnitude.
    from .sanidade import check_outlier_magnitude, check_real_le_contratado
    for cat in ("MOD", "MOI", "EQP"):
        sub = [i for i in itens if i["categoria"] == cat]
        if not sub:
            continue
        findings += check_real_le_contratado(
            ((i["contratado_qtde"], i["real_qtde"]) for i in sub), campo=f"{cat}.qtde")
        findings += check_real_le_contratado(
            ((i["contratado_rs"], i["real_rs"]) for i in sub), campo=f"{cat}.rs")
        findings += check_outlier_magnitude([i["contratado_rs"] for i in sub], campo=f"{cat}.contratado_rs")

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"itens": itens, "por_categoria": por_categoria, "declarados": declarados,
            "eixo_real_vazio": eixo_real_vazio, "n_itens": len(itens),
            "status": status, "findings": findings}


def extrair_recursos_histograma(sec: dict) -> dict:
    """Histograma mensal MOD/MOI/EQP (curva de mobilização) → 1 linha por (categoria, mês) com
    qtde e R$ Contratado × Real. Período tipo 'mar-26'/'mar-2026' → (ano, mes) via parse_mes_abbr.
    DEDUPLICA por (categoria, ano, mes): rótulos que colidem no mesmo mês (ex.: 'mar-26' + header
    repetido, ou range que casa o 1º mês) são AGREGADOS (soma das células), nunca emitidos duas
    vezes — protege o UNIQUE(...,categoria,ano,mes) da persistência contra crash. Linhas com
    período NÃO-parseável são contadas e viram finding (falha de parsing não fica invisível)."""
    cols = sec.get("colunas") or []
    c_per = _achar_coluna(cols, "periodo", "mes")
    findings: list[dict] = []
    somas = {c: {"q": 0.0, "rs": 0.0} for c in ("MOD", "MOI", "EQP")}
    # bucket por (categoria, ano, mes) → agrega células; preserva NULL distinto de 0 (None até ver número)
    buckets: dict[tuple[str, int, int], dict] = {}
    n_linhas = n_nao_parseaveis = 0
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        n_linhas += 1
        ym = parse_mes_abbr(r.get(c_per)) if c_per else None
        if ym is None:
            n_nao_parseaveis += 1
            continue
        ano, mes = ym
        label = str(r.get(c_per)).strip() if c_per else None
        for categoria in ("MOD", "MOI", "EQP"):
            cq = _num_limpo(r.get(_achar_coluna(cols, f"{categoria} contr.(q)", f"{categoria} contr (q)")))
            rq = _num_limpo(r.get(_achar_coluna(cols, f"{categoria} real(q)", f"{categoria} real (q)")))
            crs = _num_limpo(r.get(_achar_coluna(cols, f"{categoria} contr.(r$)", f"{categoria} contr (r$)")))
            rrs = _num_limpo(r.get(_achar_coluna(cols, f"{categoria} real(r$)", f"{categoria} real (r$)")))
            cq = cq if isinstance(cq, float) else None
            rq = rq if isinstance(rq, float) else None
            crs = crs if isinstance(crs, float) else None
            rrs = rrs if isinstance(rrs, float) else None
            somas[categoria]["q"] += cq or 0.0
            somas[categoria]["rs"] += crs or 0.0
            key = (categoria, ano, mes)
            b = buckets.get(key)
            if b is None:
                buckets[key] = {"categoria": categoria, "ano": ano, "mes": mes, "periodo_label": label,
                                "contratado_qtde": cq, "real_qtde": rq, "contratado_rs": crs, "real_rs": rrs}
            else:
                # colisão de mês: soma as células (None+x=x; None+None=None) — sem duplicar a chave
                for campo, val in (("contratado_qtde", cq), ("real_qtde", rq),
                                   ("contratado_rs", crs), ("real_rs", rrs)):
                    if val is not None:
                        b[campo] = (b[campo] or 0.0) + val

    if n_nao_parseaveis:
        sev = "error" if n_nao_parseaveis == n_linhas else "warn"
        findings.append({"severity": sev, "campo": "periodo",
                         "msg": f"{n_nao_parseaveis}/{n_linhas} linha(s) do histograma com período "
                                "não-parseável (formato de mês inesperado) — meses descartados"})

    meses = list(buckets.values())
    soma_hist = {c: {"q": round(somas[c]["q"], 4), "rs": round(somas[c]["rs"], 2)} for c in somas}
    return {"meses": meses, "soma_hist": soma_hist, "n_meses": len(meses), "findings": findings}


# ── C.3 FATURAMENTO — curva mensal Previsto × Real (workbook-motor) ──────────────────────────────
# Casa por ESTRUTURA (coluna Mês + 'Previsto' + 'Real', tabela longa); âncoras nos cards (KV) com
# contratadoTotal / realAcumAteBM. RECOMPUTA os acumulados (não confia na coluna 'Acum.' da fonte —
# P2 da auditoria). Reusa obra_faturamento_* (contratado=Previsto Todo, + real_rs novo).

def _achar_cards_faturamento(secoes: list[dict]) -> dict | None:
    """Cards KV do C.3 Faturamento com os totais-âncora (contratadoTotal, realAcumAteBM)."""
    for s in secoes:
        if not isinstance(s, dict):
            continue
        dd = s.get("dados")
        if (isinstance(dd, dict) and "contratadoTotal" in dd
                and "faturamento" in _norm_key(s.get("titulo") or "")):
            return dd
    return None


# ── ENGINE genérico SÉRIE-MENSAL — esqueleto comum dos resolvers de série (1 linha por mês) ───────
# Fatora o que Faturamento/Prazo/Produtividade repetiam linha-a-linha (achar-seção-por-estrutura +
# iterar-linhas-mês com skip-rótulo + parse-mês). Cada resolver só declara colunas + a semântica do
# campo (acumular / diferenciar / valor). Reusável pelos demais 'série mês×campos' (Chuvas, Milha…).

def _achar_secao_serie(secoes: list[dict], *, exige: list[tuple],
                       codigo: str | None = None, coluna_ancora: tuple[str, ...] | None = None,
                       max_cols_uteis: int | None = None,
                       min_linhas: int = 3) -> dict | None:
    """Acha uma seção-SÉRIE pela ESTRUTURA: tem coluna-mês + TODAS as colunas de `exige` (cada item
    = grupo de needles p/ _achar_coluna). `codigo` (opcional) exige um token estável no título —
    use só quando a assinatura de coluna é ambígua (ex.: 'faturamento' p/ desambiguar da curva
    física do Prazo, que também tem previsto/real/mês). `max_cols_uteis` (ignora padding col_N)
    exclui matrizes largas. Sem `codigo` = roteamento 100% estrutural (robusto a rename de título).

    `coluna_ancora` (opcional): grupo de needles de uma coluna que SÓ existe na seção-alvo —
    desambigua quando o workbook traz seções de assinatura parecida (ex.: a C.2 Indicadores ganhou
    uma 'Curva de Faturamento' com Previsto/Real acum (R$) que sequestrava a rota da C.3 e somava
    16,2 bi). Com âncora setada, ambiguidade RESIDUAL (>1 candidata) é FAIL-LOUD: retorna None → o
    caller vira needs_review — NUNCA pega a 1ª seção calada. Sem âncora, mantém o comportamento
    antigo (1ª que casa), preservando os resolvers já validados (v11/Sorriso)."""
    cands: list[dict] = []
    for s in secoes:
        if not isinstance(s, dict):
            continue
        if codigo is not None and codigo not in _norm_key(s.get("titulo") or ""):
            continue
        cols = s.get("colunas") or []
        if not _tem_col_mes(cols):
            continue
        if max_cols_uteis is not None:
            uteis = [c for c in cols if not re.match(r"^col_\d+$", str(c))]
            if len(uteis) > max_cols_uteis:
                continue
        if coluna_ancora is not None and _achar_coluna(cols, *coluna_ancora) is None:
            continue
        if (all(_achar_coluna(cols, *grp) is not None for grp in exige)
                and isinstance(s.get("linhas"), list) and len(s["linhas"]) >= min_linhas):
            cands.append(s)
    if not cands:
        return None
    if coluna_ancora is not None and len(cands) > 1:
        return None  # âncora não foi única → ambíguo; fail-loud em vez de adivinhar a seção
    return cands[0]


def _iterar_meses(sec: dict):  # -> Iterator[tuple[int, int, str | None, dict]]
    """Gera (ano, mes, label, row) das linhas-MÊS válidas: pula linha-rótulo (eh_linha_rotulo) e
    linhas sem mês parseável (parse_mes_abbr). O laço comum de todo resolver de série mensal."""
    cols = sec.get("colunas") or []
    c_mes = _achar_coluna(cols, "periodo", "mes")
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        ym = parse_mes_abbr(r.get(c_mes)) if c_mes else None
        if ym is None:
            continue
        yield ym[0], ym[1], (str(r.get(c_mes)).strip() if c_mes else None), r


def extrair_faturamento_curva(secoes: list[dict]) -> dict:
    """C.3 Faturamento → curva mensal {contratado_rs (Previsto Todo), real_rs} com acumulados
    RECOMPUTADOS (running sum; não confia na coluna 'Acum.' da fonte). Determinístico; pula
    linha-rótulo. Âncoras (cards): Σ contratado == contratadoTotal · Σ real == realAcumAteBM."""
    # coluna_ancora='previsto todo' isola a C.3: a C.2 Indicadores ganhou uma "Curva de Faturamento
    # mensal" (Previsto acum/Real acum R$) que casava previsto+real e somava 16,2 bi (26× o PV),
    # sequestrando esta rota. 'Previsto Todo' existe na C.3 (v11 e v45) e NÃO na C.2 — é o discriminador
    # ÚNICO. NÃO usar codigo='faturamento' no título: o v45 renomeou a seção de 'C.3 Faturamento — Curva'
    # → 'C.3 — Curva por BM' (sem 'faturamento'); a âncora de coluna basta (robusto a rename · fail-loud
    # se >1 candidata). [gap v45 fechado]
    sec = _achar_secao_serie(secoes, coluna_ancora=("previsto todo",),
                             exige=[("previsto",), ("real",)])
    cards = _achar_cards_faturamento(secoes)
    findings: list[dict] = []
    if sec is None:
        findings.append({"severity": "error", "campo": "curva", "msg": "curva de faturamento não localizada"})
        return {"meses": [], "soma_contratado": None, "soma_real": None, "n_meses": 0,
                "cards": cards, "status": "needs_review", "findings": findings}
    cols = sec.get("colunas") or []
    c_prev = _achar_coluna(cols, "previsto todo", "previsto")
    c_real = _achar_coluna(cols, "real (r$)", "real")
    meses: list[dict] = []
    soma_c = soma_r = acum_c = acum_r = 0.0
    for ano, mes, _label, r in _iterar_meses(sec):
        prev = _num_limpo(r.get(c_prev)) if c_prev else None
        real = _num_limpo(r.get(c_real)) if c_real else None
        if "ERRO_REF" in (prev, real):
            findings.append({"severity": "error", "campo": "celula", "msg": f"#REF! em {ano}-{mes:02d}"})
            continue
        prev = prev if isinstance(prev, float) else None
        real = real if isinstance(real, float) else None
        acum_c += prev or 0.0
        acum_r += real or 0.0
        soma_c += prev or 0.0
        soma_r += real or 0.0
        meses.append({"ano": ano, "mes": mes, "ordem": len(meses),
                      "contratado_rs": prev, "contratado_rs_acumulado": round(acum_c, 2),
                      "real_rs": real, "real_rs_acumulado": round(acum_r, 2),
                      "projecao_rs": None, "projecao_rs_acumulado": None, "tipo_projecao": None})
    if not meses:
        findings.append({"severity": "error", "campo": "meses", "msg": "nenhum mês de faturamento extraível"})
    # PENDENTE ≠ ZERO: a fonte C.3 PRÉ-PREENCHE Real=0 nos meses futuros (diferente do C.5/C.7, que
    # deixam em branco → None). A CAUDA de 0s após o último mês executado (Real>0) é pendente, não
    # realização zero → grava real_rs/acumulado = NULL nesses meses (espelha C.5/C.7; o realizado
    # real fica intacto, inclusive 0s LEGÍTIMOS no meio da janela executada).
    ult_real = max((i for i, m in enumerate(meses) if m["real_rs"] and m["real_rs"] > 0), default=-1)
    for m in meses[ult_real + 1:]:
        m["real_rs"] = None
        m["real_rs_acumulado"] = None
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"meses": meses, "soma_contratado": round(soma_c, 2), "soma_real": round(soma_r, 2),
            "n_meses": len(meses), "cards": cards, "status": status, "findings": findings}


# ── C.5 PRAZO — curva física % previsto × real acumulado (workbook-motor) ────────────────────────
# Tabela LONGA (Mês × % previsto acum × % real acum) — distinta da tabela larga EDT×meses do Sorriso
# (extrair_cronograma_fisico_tabela) E das matrizes largas por disciplina (max_cols_uteis=6). Valores
# em PERCENTUAL ('1.09'=1,09%) → fração. Per-month previsto_pct = diff do acumulado (recompute).
# Real é PARCIAL (None onde vazio · obra em execução). Roteamento 100% ESTRUTURAL (sem código).

def extrair_cronograma_curva_fisica(secoes: list[dict]) -> dict:
    """C.5 Prazo → curva física {previsto_pct, previsto_pct_acumulado, real_pct_acumulado}. Converte
    percentual→fração; recomputa previsto_pct (diff do acumulado). Real parcial (None onde vazio).
    Determinístico; pula linha-rótulo. Gate: gate_cronograma (Σ previsto_pct == 100%)."""
    # exige o token 'fisico' (não os fallbacks 'previsto acum'/'real acum', que vazavam p/ a C.2
    # financeira → R$ lido como % → 611.357.314% no Prazo). coluna_ancora reforça + dá fail-loud
    # se >1 seção física casar. 'Físico Previsto Acum.' existe na C.5 (v11 e v45), não na C.2.
    sec = _achar_secao_serie(secoes, max_cols_uteis=6, coluna_ancora=("fisico previsto",),
                             exige=[("fisico previsto",), ("fisico real",)])
    if sec is None:
        # dialeto SBSO: "Previsto % acum (cronograma) - FISICO" / "Real % acum (FISICO)"
        for s2 in secoes:
            if not isinstance(s2, dict) or not s2.get("linhas"):
                continue
            cols2 = s2.get("colunas") or []
            tem_pf = any("previsto" in _norm_key(str(c)) and "fisico" in _norm_key(str(c)) for c in cols2)
            tem_rf = any("real" in _norm_key(str(c)) and "fisico" in _norm_key(str(c)) for c in cols2)
            if tem_pf and tem_rf and _achar_coluna(cols2, "mes", "mês") is not None:
                sec = s2
                break
    findings: list[dict] = []
    if sec is None:
        findings.append({"severity": "error", "campo": "curva", "msg": "curva física do Prazo não localizada"})
        return {"meses": [], "final_previsto": None, "n_meses": 0, "status": "needs_review", "findings": findings}
    cols = sec.get("colunas") or []
    c_prev = (_achar_coluna(cols, "fisico previsto")
              or next((c for c in cols if "previsto" in _norm_key(str(c)) and "fisico" in _norm_key(str(c))), None))
    c_real = (_achar_coluna(cols, "fisico real")
              or next((c for c in cols if "real" in _norm_key(str(c)) and "fisico" in _norm_key(str(c))), None))
    # Escala: BR-101 emite percentual (0–100); SBSO emite FRAÇÃO (0–1). Detecta pelo teto do acumulado.
    _vals = [_num_limpo(r.get(c_prev)) for _a, _m, _l, r in _iterar_meses(sec)] if c_prev else []
    _vals = [v for v in _vals if isinstance(v, float)]
    _div = 1.0 if (_vals and max(_vals) <= 1.5) else 100.0
    meses: list[dict] = []
    prev_acum_ant = 0.0
    for ano, mes, _label, r in _iterar_meses(sec):
        pa = _num_limpo(r.get(c_prev)) if c_prev else None
        ra = _num_limpo(r.get(c_real)) if c_real else None
        if "ERRO_REF" in (pa, ra):
            findings.append({"severity": "error", "campo": "celula", "msg": f"#REF! em {ano}-{mes:02d}"})
            continue
        pa_f = pa / _div if isinstance(pa, float) else None       # percentual|fração → fração
        ra_f = ra / _div if isinstance(ra, float) else None
        p_mes = round(pa_f - prev_acum_ant, 6) if pa_f is not None else None
        if pa_f is not None:
            prev_acum_ant = pa_f
        meses.append({"ordem": len(meses), "ano": ano, "mes": mes, "competencia_chave": f"{ano}-{mes:02d}",
                      "previsto_pct": p_mes, "previsto_pct_acumulado": round(pa_f, 6) if pa_f is not None else None,
                      "real_pct_acumulado": round(ra_f, 6) if ra_f is not None else None})
    if not meses:
        findings.append({"severity": "error", "campo": "meses", "msg": "nenhum mês na curva física"})
    final = meses[-1]["previsto_pct_acumulado"] if meses else None
    # INÍCIO/TÉRMINO da obra derivados dos meses da curva (1º dia do 1º mês → último dia do último).
    # Sem isso o cronograma fica sem datas → prazoContratualDias=null → a aba Prazo E a Visão Geral
    # ficam VAZIAS (buildPrazoBm retorna null). Crítico p/ o front renderizar.
    inicio_iso = termino_iso = None
    if meses:
        import calendar
        a0, m0 = meses[0]["ano"], meses[0]["mes"]
        a1, m1 = meses[-1]["ano"], meses[-1]["mes"]
        inicio_iso = f"{a0:04d}-{m0:02d}-01"
        termino_iso = f"{a1:04d}-{m1:02d}-{calendar.monthrange(a1, m1)[1]:02d}"
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"meses": meses, "final_previsto": final, "n_meses": len(meses),
            "inicio_iso": inicio_iso, "termino_iso": termino_iso,
            "status": status, "findings": findings}


# ── C.7 PRODUTIVIDADE ECONÔMICA — série mensal R$/HH (workbook-motor) ─────────────────────────────
def _achar_cards_produtividade(secoes: list[dict]) -> dict | None:
    for s in secoes:
        if not isinstance(s, dict):
            continue
        dd = s.get("dados")
        if isinstance(dd, dict) and "hhTotalPrevisto" in dd:
            return dd
    return None


def extrair_produtividade_params(secoes: list[dict]) -> dict:
    """C.7 — params/cards (financeira) + benchmarks + META REAL + jornadas + ponte (1 linha). Lê
    'C.7 Cards de produtividade' (flat bloco/indicador/valor) + 'C.7 Parâmetros' + 'C.7 Sinais'.
    META vem do card (229,95), não do config 340,33 defasado."""
    # cards (tabela flat) → lookup por rótulo normalizado
    card_raw: dict = {}
    sec_cards = None
    sec_sinais = None
    par: dict = {}
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if s.get("tipo") == "tabela" and "c7" in t and "cardsdeprodutividade" in t:
            sec_cards = s
        elif s.get("tipo") == "tabela" and "c7" in t and "sinais" in t:
            sec_sinais = s
        elif s.get("tipo") == "chave_valor" and "c7" in t and "parametros" in t and "fisica" not in t:
            par = {_norm_key(k): v for k, v in (s.get("dados") or {}).items()}
    if sec_cards is not None:
        cols = sec_cards.get("colunas") or []
        c_ind = _achar_coluna(cols, "indicador")
        c_sec = _achar_coluna(cols, "indicadorsecundario", "indicador secundário", "secundario")
        c_val = _achar_coluna(cols, "valor")
        for r in (sec_cards.get("linhas") or []):
            if not isinstance(r, dict):
                continue
            ind = str(r.get(c_ind) or "").strip() if c_ind else ""
            sec = str(r.get(c_sec) or "").strip() if c_sec else ""
            val = r.get(c_val) if c_val else None
            lbl = ind or sec  # rótulo principal; quando 'indicador' vazio, usa o secundário (ex.: Meta)
            if lbl and val not in (None, ""):
                card_raw[_norm_key(lbl)] = val
    if not card_raw and not par:
        return {"params": None, "status": "ok", "findings": []}

    def cnum(*frags):  # primeiro card cujo rótulo contém todos os fragmentos → float
        for k, v in card_raw.items():
            if all(f in k for f in frags):
                n = _num_limpo(v)
                if isinstance(n, float):
                    return n
        return None

    def cstr(*frags):
        for k, v in card_raw.items():
            if all(f in k for f in frags):
                return _limpa_glifo(v) or None
        return None

    def pnum(k):
        n = _num_limpo(par.get(k))
        return n if isinstance(n, float) else None

    # ponte (sinais)
    pl = pa = pc = poc = None
    if sec_sinais is not None:
        cols = sec_sinais.get("colunas") or []
        cs, cv = _achar_coluna(cols, "sinal"), _achar_coluna(cols, "valor")
        for r in (sec_sinais.get("linhas") or []):
            sn = _norm_key(r.get(cs)) if cs else ""
            v = _num_limpo(r.get(cv)) if cv else None
            v = v if isinstance(v, float) else None
            if "liberado" in sn:
                pl = v
            elif "aproveitamento" in sn:
                pa = v
            elif "capacidade" in sn:
                pc = v
            elif "ociosidade" in sn:
                poc = v

    params = {
        "bm_corrente": int(pnum("bmcorrente")) if pnum("bmcorrente") is not None else None,
        "base_hh": (str(par.get("basedohh")).strip() if par.get("basedohh") else None),
        "valor_total_contratado": pnum("valortotalcontratado"),
        "jornada_mod_h_mes": pnum("jornadamodhpormes"),
        "jornada_moi_h_mes": pnum("jornadamoihpormes"),
        "contratada_periodo_rs_hh": cnum("contratada", "periodo"),
        "faturado_acum_rs": cnum("faturado", "acum"),
        "hh_real_acum": cnum("hh", "real", "acum"),
        "hh_contratado_acum": cnum("hh", "contratado", "acum"),
        "real_acum_rs_hh": cnum("real", "acum", "rhh") or cnum("produtividade", "real", "acum"),
        "real_mes_rs_hh": cnum("produtividade", "real", "mes"),
        "aderencia_acum": cnum("aderencia", "acum"),
        "meta_projeto_rs_hh": cnum("meta", "projeto"),
        "farol_aderencia": cstr("farol", "aderencia"),
        "cambio": cnum("cambio", "input"),
        "bmk_aterpa_rs_hh": cnum("benchmark", "aterpa"),
        "bmk_setor_rs_hh": cnum("benchmark", "setor"),
        "real_div_aterpa": cnum("real", "benchmark", "aterpa") or cnum("real", "aterpa"),
        "real_div_setor": cnum("real", "benchmark", "setor") or cnum("real", "setor"),
        "farol_bmk": cstr("farol", "benchmark"),
        "ponte_pct_liberado": pl,
        "ponte_pct_aproveitamento": pa,
        "ponte_pct_capacidade": pc,
        "ponte_ociosidade_hh": poc,
    }
    return {"params": params, "status": "ok", "findings": []}


def extrair_produtividade_fisica(secoes: list[dict]) -> dict:
    """C.7 — tracker de produtividade física serviço×trecho (CPU un/h × real · 13 linhas)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "c7" in t and "acompanhamentodeprodutividadefisica" in t:
            sec = s
            break
    if sec is None:
        return {"linhas": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"disc": _achar_coluna(cols, "disciplina"), "serv": _achar_coluna(cols, "serviço", "servico"),
         "tre": _achar_coluna(cols, "trecho"), "un": _achar_coluna_exata(cols, "un"),
         "qc": _achar_coluna(cols, "qtd contratada"), "qm": _achar_coluna(cols, "qtd medida"),
         "pf": _achar_coluna(cols, "% físico", "% fisico"), "cpu": _achar_coluna(cols, "cpu un", "cpu"),
         "real": _achar_coluna(cols, "real un", "real un/h"), "ad": _achar_coluna(cols, "aderência", "aderencia"),
         "farol": _achar_coluna(cols, "farol")}
    linhas: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        serv = str(r.get(c["serv"]) or "").strip() if c["serv"] else ""
        if not serv:
            continue
        linhas.append({
            "ordem": len(linhas),
            "disciplina": (str(r.get(c["disc"]) or "").strip() or None) if c["disc"] else None,
            "servico": serv[:120], "trecho": (str(r.get(c["tre"]) or "").strip() or None) if c["tre"] else None,
            "unidade": (str(r.get(c["un"]) or "").strip() or None) if c["un"] else None,
            "qtd_contratada": _num_limpo(r.get(c["qc"])) if c["qc"] else None,
            "qtd_medida": _num_limpo(r.get(c["qm"])) if c["qm"] else None,
            "pct_fisico": _num_limpo(r.get(c["pf"])) if c["pf"] else None,
            "cpu_un_h": _num_limpo(r.get(c["cpu"])) if c["cpu"] else None,
            "real_un_h": _num_limpo(r.get(c["real"])) if c["real"] else None,
            "aderencia": _num_limpo(r.get(c["ad"])) if c["ad"] else None,
            "farol": (_limpa_glifo(r.get(c["farol"])) or None) if c["farol"] else None,
        })
    return {"linhas": linhas, "n": len(linhas), "status": "ok", "findings": []}


def extrair_produtividade_fisica_detalhe(secoes: list[dict]) -> dict:
    """C.7 — detalhe do cálculo por equipamento (Trecho 1 · CPU × equip-horas × dias RDO)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "c7" in t and "produtividadefisicatrecho" in t:
            sec = s
            break
    if sec is None:
        return {"linhas": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"serv": _achar_coluna(cols, "serviço", "servico"), "fr": _achar_coluna(cols, "frente"),
         "un": _achar_coluna_exata(cols, "un"), "cpu": _achar_coluna(cols, "produção cpu", "producao cpu", "cpu"),
         "eq": _achar_coluna(cols, "equip. principal", "equip principal"),
         "qx": _achar_coluna(cols, "qtd executada"), "dias": _achar_coluna(cols, "dias"),
         "ed": _achar_coluna(cols, "equip/dia", "equip dia"), "eh": _achar_coluna(cols, "equip-horas", "equip horas"),
         "real": _achar_coluna(cols, "produtiv. real", "produtiv real", "produtividade real"),
         "ad": _achar_coluna(cols, "aderência", "aderencia"), "farol": _achar_coluna(cols, "farol")}
    linhas: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        serv = str(r.get(c["serv"]) or "").strip() if c["serv"] else ""
        if not serv:
            continue
        dias = _num_limpo(r.get(c["dias"])) if c["dias"] else None
        linhas.append({
            "ordem": len(linhas), "servico": serv[:120],
            "frente": (str(r.get(c["fr"]) or "").strip() or None) if c["fr"] else None,
            "unidade": (str(r.get(c["un"]) or "").strip() or None) if c["un"] else None,
            "cpu_un_h": _num_limpo(r.get(c["cpu"])) if c["cpu"] else None,
            "equip_principal": (str(r.get(c["eq"]) or "").strip() or None) if c["eq"] else None,
            "qtd_executada": _num_limpo(r.get(c["qx"])) if c["qx"] else None,
            "dias_servico": int(dias) if isinstance(dias, float) else None,
            "equip_dia": _num_limpo(r.get(c["ed"])) if c["ed"] else None,
            "equip_horas": _num_limpo(r.get(c["eh"])) if c["eh"] else None,
            "real_un_h": _num_limpo(r.get(c["real"])) if c["real"] else None,
            "aderencia": _num_limpo(r.get(c["ad"])) if c["ad"] else None,
            "farol": (_limpa_glifo(r.get(c["farol"])) or None) if c["farol"] else None,
        })
    return {"linhas": linhas, "n": len(linhas), "status": "ok", "findings": []}


def extrair_produtividade_impedimento(secoes: list[dict]) -> dict:
    """C.7 — impedimentos documentados (D.6 · HH ociosas) → 3 eventos da ponte."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "c7" in t and "impedimentos" in t:
            sec = s
            break
    if sec is None:
        return {"linhas": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"imp": _achar_coluna(cols, "impedimento"), "per": _achar_coluna(cols, "periodo", "período"),
         "hh": _achar_coluna(cols, "hh ociosas", "hhociosas", "hh")}
    linhas: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        imp = str(r.get(c["imp"]) or "").strip() if c["imp"] else ""
        if not imp:
            continue
        linhas.append({
            "ordem": len(linhas), "impedimento": imp[:200],
            "periodo": (str(r.get(c["per"]) or "").strip() or None) if c["per"] else None,
            "hh_ociosas": _num_limpo(r.get(c["hh"])) if c["hh"] else None,
        })
    return {"linhas": linhas, "n": len(linhas), "status": "ok", "findings": []}


def extrair_produtividade_economica(secoes: list[dict]) -> dict:
    """C.7 → série mensal {faturado_rs, hh_previsto, hh_real, rs_por_hh, aderencia}. Pula as linhas-
    rótulo de IA/critérios (parse de mês + eh_linha_rotulo). Âncora: Σ hh_previsto == hhTotalPrevisto
    (card). HH real é PARCIAL (obra em execução) — fica NULL onde vazio, nunca 0 silencioso."""
    sec = _achar_secao_serie(secoes, codigo="produtividade", exige=[("hh previsto", "previsto mes")])
    cards = _achar_cards_produtividade(secoes)
    findings: list[dict] = []
    if sec is None:
        findings.append({"severity": "error", "campo": "serie", "msg": "série de produtividade não localizada"})
        return {"meses": [], "soma_hh_previsto": None, "cards": cards, "eixo_real_vazio": True,
                "n_meses": 0, "status": "needs_review", "findings": findings}
    cols = sec.get("colunas") or []
    c_fat = _achar_coluna(cols, "faturado")
    c_hhp = _achar_coluna(cols, "hh previsto", "previsto mes")
    c_hhr = _achar_coluna(cols, "hh real", "real mes")
    c_rhh = _achar_coluna(cols, "r$/hh", "rs/hh", "por hh")
    c_ad = _achar_coluna(cols, "aderencia")
    meses: list[dict] = []
    soma_hh = 0.0
    real_preenchido = 0
    for ano, mes, label, r in _iterar_meses(sec):
        fat = _num_limpo(r.get(c_fat)) if c_fat else None
        hhp = _num_limpo(r.get(c_hhp)) if c_hhp else None
        hhr = _num_limpo(r.get(c_hhr)) if c_hhr else None
        rhh = _num_limpo(r.get(c_rhh)) if c_rhh else None
        ad = _num_limpo(r.get(c_ad)) if c_ad else None
        if "ERRO_REF" in (fat, hhp, hhr, rhh, ad):
            findings.append({"severity": "error", "campo": "celula", "msg": f"#REF! em {ano}-{mes:02d}"})
            continue
        def _f(x):  # noqa: ANN001
            return x if isinstance(x, float) else None
        if isinstance(hhr, float) and hhr != 0:
            real_preenchido += 1
        if isinstance(hhp, float):
            soma_hh += hhp
        meses.append({"ano": ano, "mes": mes, "periodo_label": label,
                      "faturado_rs": _f(fat), "hh_previsto": _f(hhp), "hh_real": _f(hhr),
                      "rs_por_hh": _f(rhh), "aderencia": _f(ad)})
    if not meses:
        findings.append({"severity": "error", "campo": "meses", "msg": "nenhum mês de produtividade"})
    # PENDENTE ≠ ZERO: a fonte C.7 pré-preenche Faturado=0 nos meses futuros (não executados). A
    # CAUDA de 0s após o último mês faturado (>0) é pendente → faturado_rs = NULL (espelha C.3; hh
    # previsto, que é PLANO, fica). rs_por_hh/aderência já vêm NULL aí (a fonte não divide por 0).
    ult_fat = max((i for i, m in enumerate(meses) if (m["faturado_rs"] or 0) > 0), default=-1)
    for m in meses[ult_fat + 1:]:
        m["faturado_rs"] = None
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"meses": meses, "soma_hh_previsto": round(soma_hh, 2), "cards": cards,
            "eixo_real_vazio": real_preenchido == 0, "n_meses": len(meses),
            "status": status, "findings": findings}


# ── C.1 BDI DETALHE — FONTE-MÃE econômica (rubricas do BDI) ───────────────────────────────────────
# Lista com HIERARQUIA (subtotais): 'Despesas Indiretas+Impostos' = Σ(rubricas 2-12); 'Impostos' =
# Σ(taxas 13-17). Somar FLAT dobra a conta. Conservação ROBUSTA e LIVRE de hierarquia: CD =
# valor / (% s/ CD) é CONSTANTE em toda rubrica (= Custo Direto da obra, 471,2M) — se um valor for
# mal-lido, o CD implícito dele DIVERGE. É a prova de correção célula-a-célula. eh_subtotal (detecção
# independente: rubrica == Σ das contíguas seguintes) só serve p/ o display não double-contar — as
# FOLHAS (não-subtotal) somam o markup do BDI (140,1M) e CD + markup ≈ PV.

def _detectar_subtotais(rubricas: list[dict]) -> None:
    """Marca eh_subtotal: cada rubrica é checada INDEPENDENTE — é subtotal se as contíguas seguintes
    somam exatamente o valor dela. Pega 'Desp Indiretas+Impostos' (=Σ 2-12) E 'Impostos' (=Σ taxas)
    sem se confundir com o aninhamento. As não-subtotal são as FOLHAS (sem double-count)."""
    n = len(rubricas)
    for i in range(n):
        rubricas[i]["eh_subtotal"] = False
        val = rubricas[i].get("valor_rs") or 0.0
        if val <= 0:
            continue
        acc, j, tol = 0.0, i + 1, max(1.0, val * 0.001)
        while j < n and acc < val - tol:
            acc += rubricas[j].get("valor_rs") or 0.0
            j += 1
        if j > i + 1 and abs(acc - val) <= tol:
            rubricas[i]["eh_subtotal"] = True


def extrair_bdi_detalhe(secoes: list[dict]) -> dict:
    """C.1 BDI Detalhe (FONTE-MÃE) → rubricas {descricao, pct_receita, pct_custo_direto, valor_rs,
    pct_receita_implicito, eh_subtotal}. Σ das FOLHAS = markup do BDI (sem double-count); cd_implicito
    = valor/%CD (constante = Custo Direto). Determinístico; pula linha-rótulo. Gate: gate_bdi
    (CD constante célula-a-célula + CD+markup ≈ PV)."""
    findings: list[dict] = []
    alvo = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        cols = s.get("colunas") or []
        if (_achar_coluna(cols, "descricao", "descrição") is not None
                and _achar_coluna(cols, "s/ receita", "receita (fonte)") is not None
                and _achar_coluna(cols, "valor (r$)", "valor") is not None
                and isinstance(s.get("linhas"), list) and len(s["linhas"]) >= 3):
            alvo = s
            break
    if alvo is None:
        # Variante SBSO: a fonte não traz R$ por rubrica no Anexo XIV (só % da fórmula composta),
        # mas DECLARA os valores por rubrica na tabela de rubricas do BDI (Tempo + GRUPO B) e os
        # cards do Anexo ([23]: custoDireto/bdiEmValor/PV). Deriva %CD e %receita de bases explícitas.
        cards23 = None
        for s2 in secoes:
            dd = s2.get("dados") if isinstance(s2, dict) else None
            if isinstance(dd, dict) and "bdiEmValor" in dd and "custoDireto" in dd:
                cards23 = dd
                break
        sec_rub = None
        for s2 in secoes:
            if not isinstance(s2, dict) or s2.get("tipo") != "tabela":
                continue
            cols2 = s2.get("colunas") or []
            if (_achar_coluna(cols2, "rubrica") is not None
                    and _achar_coluna(cols2, "valor total no contrato") is not None):
                sec_rub = s2
                break
        if cards23 and sec_rub is not None:
            cd0 = _num_limpo(cards23.get("custoDireto"))
            pv0 = _num_limpo(cards23.get("valorContratoPrecoGlobal"))
            cols2 = sec_rub.get("colunas") or []
            cR = _achar_coluna(cols2, "rubrica")
            cV = _achar_coluna(cols2, "valor total no contrato")
            rubs2: list[dict] = []
            for r in (sec_rub.get("linhas") or []):
                if not isinstance(r, dict):
                    continue
                nome2 = str(r.get(cR) or "").strip()
                v2 = _num_limpo(r.get(cV))
                nk2 = _norm_key(nome2)
                if not nome2 or not isinstance(v2, float) or v2 <= 0 or "total" in nk2 or nk2 == "bdi":
                    continue
                rubs2.append({
                    "ordem": len(rubs2), "descricao": nome2[:120],
                    "pct_receita": (v2 / pv0) if isinstance(pv0, float) and pv0 else None,
                    "pct_custo_direto": (v2 / cd0) if isinstance(cd0, float) and cd0 else None,
                    "valor_rs": v2, "pct_receita_implicito": None, "eh_subtotal": False,
                })
            if rubs2:
                soma2 = round(sum(x["valor_rs"] for x in rubs2), 2)
                bdi_val = _num_limpo(cards23.get("bdiEmValor"))
                if isinstance(bdi_val, float) and abs(soma2 - bdi_val) > max(1000.0, bdi_val * 0.005):
                    findings.append({"severity": "warn", "campo": "conservacao",
                                     "msg": f"Σ rubricas {soma2:,.2f} ≠ bdiEmValor {bdi_val:,.2f}"})
                return {"rubricas": rubs2, "soma_folhas_rs": soma2,
                        "cd_implicito": cd0 if isinstance(cd0, float) else None,
                        "n_rubricas": len(rubs2), "status": "ok", "findings": findings}
        findings.append({"severity": "error", "campo": "bdi", "msg": "C.1 BDI Detalhe não localizada"})
        return {"rubricas": [], "soma_folhas_rs": None, "cd_implicito": None, "n_rubricas": 0,
                "status": "needs_review", "findings": findings}
    cols = alvo.get("colunas") or []
    c_desc = _achar_coluna(cols, "descricao", "descrição")
    c_prec = _achar_coluna(cols, "s/ receita (fonte)", "s/ receita")
    c_pcd = _achar_coluna(cols, "s/ custo direto", "custo direto")
    c_val = _achar_coluna(cols, "valor (r$)", "valor")
    c_pimp = _achar_coluna(cols, "receita implicito", "receita implícito", "implicito")
    rubricas: list[dict] = []
    for r in (alvo.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        desc = str(r.get(c_desc) or "").strip()
        if not desc:
            continue
        def _f(cc):  # noqa: ANN001
            v = _num_limpo(r.get(cc)) if cc else None
            return v if isinstance(v, float) else None
        rubricas.append({
            "ordem": len(rubricas), "descricao": desc[:200],
            "pct_receita": _f(c_prec), "pct_custo_direto": _f(c_pcd),
            "valor_rs": _f(c_val), "pct_receita_implicito": _f(c_pimp), "eh_subtotal": False,
        })
    if not rubricas:
        findings.append({"severity": "error", "campo": "rubricas", "msg": "nenhuma rubrica de BDI"})
        return {"rubricas": [], "soma_folhas_rs": None, "cd_implicito": None, "n_rubricas": 0,
                "status": "needs_review", "findings": findings}
    _detectar_subtotais(rubricas)
    soma_folhas = sum(r["valor_rs"] or 0.0 for r in rubricas if not r["eh_subtotal"])
    # CD implícito = mediana de valor/%CD (rubricas com ambos > 0) — o custo direto da obra
    cds = sorted(r["valor_rs"] / r["pct_custo_direto"] for r in rubricas
                 if r["valor_rs"] and r["pct_custo_direto"])
    cd = cds[len(cds) // 2] if cds else None
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"rubricas": rubricas, "soma_folhas_rs": round(soma_folhas, 2),
            "cd_implicito": round(cd, 2) if cd else None, "n_rubricas": len(rubricas),
            "status": status, "findings": findings}


# ── D.2 BDI DESEQUILÍBRIO — view do BDI não remunerado (≠ composição C.1 do obra_bdi_rubricas) ────
def extrair_bdi_deseq(secoes: list[dict]) -> dict:
    """D.2 BDI · params/base + KPIs + cenários (chave_valor, 1 linha). Junta os blocos chave_valor
    'D.2 BDI ...' (Parâmetros/Bloco1 · Cards/KPIs · Bloco2 Total · Bloco4/5 cenários)."""
    out: dict = {}
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "chave_valor":
            continue
        t = _norm_key(s.get("titulo") or "")
        # 'd2bdi' colado (BR-101) OU 'd2'+'bdi' separados no título (ex.: SBSO
        # "D.2 — Parâmetros, Base Contratual e Cards do BDI").
        if not ("d2bdi" in t or ("d2" in t and "bdi" in t)):
            continue
        dados = s.get("dados") or {}
        if isinstance(dados, dict):
            for k, v in dados.items():
                out[_norm_key(k)] = v
    if not out:
        return {"params": None, "status": "ok", "findings": []}

    def _f(*ks):  # 1º float entre as chaves candidatas (dialetos BR-101 e SBSO)
        for k in ks:
            n = _num_limpo(out.get(k))
            if isinstance(n, float):
                return n
        return None

    def _i(*ks):
        n = _f(*ks)
        return int(round(n)) if isinstance(n, float) else None

    # Prazo contratual: preferir o card 'prazo' quando existir — o rótulo
    # 'mesesDecorridosXContratuais' pode carregar resíduo de template ("9 / 46").
    _prazo = _i("prazo")
    if _prazo is None:
        mm = re.findall(r"\d+", str(out.get("mesesdecorridosxcontratuais") or ""))
        _prazo = int(mm[-1]) if mm else None
    params = {
        "pv_rs": _f("precovendapv", "precodevendapv"),
        "bdi_declarado": _f("bdideclarado"),
        "custo_direto_rs": _f("custodiretocd"),
        "custo_indireto_rs": _f("custoindiretoci"),
        "bm_corrente": _i("bmcorrentemesno", "bmcorrente"),
        "meses_contratuais": _prazo,
        "medicao_acum_rs": _f("medicaopvacumuladaatebm"),
        "meses_extensao": _i("mesesextensaoprojetada", "mesesextensaoprojetados"),
        "desequilibrio_rs": _f("desequilibriobdiacumuladorealizado"),
        "pct_sobre_pv": _f("percentsobreopv", "percentsobrepv"),
        "custo_mensal_tempo_rs": _f("customensaltempoincorridomes", "customensaltempoincorrido"),
        "gasto_teorico_acum_rs": _f("gastoteoricoacum", "totalbdinaoremuneradoatebmgastoteoricoacum"),
        "remunerado_acum_rs": _f("remuneradoacum", "totalbdinaoremuneradoatebmremuneradoacum"),
        "valor_total_contrato_rs": _f("valortotalnocontrator", "totalbdinaoremuneradoatebmvalortotalcontrato"),
        "overhead_mes_rs": _f("bloco4overheaddetempoxmesesextensao", "overheadtempoextensao"),
        "projecao_extensao_rs": _f("desequilibriomaisprojecaoextensao"),
        "delta_reducao_rs": _f("bloco5deltabdiporreducaoescopo"),
        "farol": (_limpa_glifo(out.get("farol")) or None) if out.get("farol") else None,
    }
    return {"params": params, "status": "ok", "findings": []}


def extrair_bdi_rubricas_tempo(secoes: list[dict]) -> dict:
    """D.2 BDI · Bloco 2 — 6 rubricas tempo-dependentes (gasto teórico × remunerado → desequilíbrio).
    Casa por título 'd2 bdi' + 'rubricas de tempo'. Linha TOTAL fora (conservação no gate)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if ("d2bdi" in t or ("d2" in t and "bdi" in t)) and "rubricasdetempo" in t:
            sec = s
            break
    if sec is None:
        return {"rubricas": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"rub": _achar_coluna(cols, "rubrica"), "tipo": _achar_coluna(cols, "tipo"),
         "pct": _achar_coluna(cols, "% da rubrica", "% do pv"),
         "valor": _achar_coluna(cols, "valor total no contrato", "valor total"),
         "inc": _achar_coluna(cols, "incorrido"),
         "gasto": _achar_coluna(cols, "gasto teórico", "gasto teorico"),
         "rem": _achar_coluna(cols, "remunerado"), "deq": _achar_coluna(cols, "desequil"),
         "obs": _achar_coluna(cols, "obs")}
    rubricas: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        nome = str(r.get(c["rub"]) or "").strip() if c["rub"] else ""
        # Só rubricas de TEMPO (propósito da tabela): a fonte pode anexar o GRUPO B
        # (ISS/PIS/COFINS · % sobre medição) e a linha consolidada 'BDI' — ficam fora
        # (a conservação Σ==desequilíbrio total é só das tempo-dependentes).
        _tipo_raw = str(r.get(c["tipo"]) or "").strip() if c["tipo"] else ""
        if _tipo_raw and _norm_key(_tipo_raw) != "tempo":
            continue
        if not _tipo_raw and _norm_key(nome) in ("iss", "pis", "cofins", "cprb", "bdi"):
            continue
        if not nome or "total" in _norm_key(nome):
            continue
        rubricas.append({
            "ordem": len(rubricas),
            "rubrica": nome[:120],
            "tipo": (str(r.get(c["tipo"]) or "").strip() or None) if c["tipo"] else None,
            "pct_rubrica": _num_limpo(r.get(c["pct"])) if c["pct"] else None,
            "valor_contrato_rs": _num_limpo(r.get(c["valor"])) if c["valor"] else None,
            "incorrido_mes_rs": _num_limpo(r.get(c["inc"])) if c["inc"] else None,
            "gasto_teorico_acum_rs": _num_limpo(r.get(c["gasto"])) if c["gasto"] else None,
            "remunerado_acum_rs": _num_limpo(r.get(c["rem"])) if c["rem"] else None,
            "desequilibrio_rs": _num_limpo(r.get(c["deq"])) if c["deq"] else None,
            "obs": (str(r.get(c["obs"]) or "").strip() or None) if c["obs"] else None,
        })
    return {"rubricas": rubricas, "n": len(rubricas), "status": "ok", "findings": []}


def extrair_bdi_perda_mensal(secoes: list[dict]) -> dict:
    """D.2 BDI · Bloco 6 — curva da perda do BDI não remunerado mês a mês (BM 1–46)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        eh_d2 = "d2bdi" in t or ("d2" in t and "bdi" in t)
        if eh_d2 and ("perdamensal" in t or ("perda" in t and ("porbm" in t or "curva" in t))):
            sec = s
            break
    if sec is None:
        return {"meses": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"bm": _achar_coluna_exata(cols, "bm"), "mes": _achar_coluna(cols, "mês", "mes"),
         "gasto": _achar_coluna(cols, "gasto teórico", "gasto teorico"),
         "rem": _achar_coluna(cols, "remunerado"),
         "perda_mes": _achar_coluna(cols, "perda do mês", "perda do mes"),
         "perda_acum": _achar_coluna(cols, "perda acumulada", "perda acum", "acumulada", "acum")}
    meses: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        bm = _num_limpo(r.get(c["bm"])) if c["bm"] else None
        if not isinstance(bm, float):
            continue
        meses.append({
            "ordem": len(meses),
            "bm": int(bm),
            "mes_label": (str(r.get(c["mes"]) or "").strip() or None) if c["mes"] else None,
            "gasto_teorico_mes_rs": _num_limpo(r.get(c["gasto"])) if c["gasto"] else None,
            "remunerado_mes_rs": _num_limpo(r.get(c["rem"])) if c["rem"] else None,
            "perda_mes_rs": _num_limpo(r.get(c["perda_mes"])) if c["perda_mes"] else None,
            "perda_acum_rs": _num_limpo(r.get(c["perda_acum"])) if c["perda_acum"] else None,
        })
    return {"meses": meses, "n": len(meses), "status": "ok", "findings": []}


# ── D.6 ANÁLISES PONTUAIS — eventos de paralisação/ociosidade (chuva excedente + impedimentos) ─────
def extrair_pontuais_chuva_mensal(secoes: list[dict]) -> dict:
    """auxiliar_D.6 Chuva · apuração mês a mês — memória do pleiteável (líquido da prevista da C.9)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "d6chuva" in t and "apura" in t:
            sec = s
            break
    if sec is None:
        return {"meses": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"mes": _achar_coluna(cols, "mês", "mes"), "real": _achar_coluna(cols, "real >5mm", "real 5mm", "real"),
         "prev": _achar_coluna(cols, "prev >5mm", "prev 5mm", "prev"), "exc": _achar_coluna(cols, "excedente"),
         "frac": _achar_coluna(cols, "fração", "fracao"), "pmod": _achar_coluna(cols, "pleiteável mês", "pleiteavel mes", "pleiteável mod"),
         "peqp": _achar_coluna(cols, "pleiteável eqp", "pleiteavel eqp"), "tot": _achar_coluna(cols, "total mês", "total mes")}
    meses: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        mes = str(r.get(c["mes"]) or "").strip() if c["mes"] else ""
        if not mes or "total" in _norm_key(mes):
            continue
        meses.append({
            "ordem": len(meses), "mes_label": mes[:16],
            "real_5mm": _num_limpo(r.get(c["real"])) if c["real"] else None,
            "prev_5mm": _num_limpo(r.get(c["prev"])) if c["prev"] else None,
            "excedente": _num_limpo(r.get(c["exc"])) if c["exc"] else None,
            "fracao_excedente": _num_limpo(r.get(c["frac"])) if c["frac"] else None,
            "pleiteavel_mod_rs": _num_limpo(r.get(c["pmod"])) if c["pmod"] else None,
            "pleiteavel_eqp_rs": _num_limpo(r.get(c["peqp"])) if c["peqp"] else None,
            "total_mes_rs": _num_limpo(r.get(c["tot"])) if c["tot"] else None,
        })
    return {"meses": meses, "n": len(meses), "status": "ok", "findings": []}


def extrair_pontuais_chuva_dia(secoes: list[dict]) -> dict:
    """auxiliar_D.6 Chuva · ociosidade dia a dia — equipe afetada nos dias >5mm com efetivo em campo."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "d6chuva" in t and "ociosidade" in t:
            sec = s
            break
    if sec is None:
        return {"dias": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"data": _achar_coluna_exata(cols, "data"), "mm": _achar_coluna(cols, "chuva (mm)", "chuva mm"),
         "ac5": _achar_coluna(cols, ">5mm"), "per": _achar_coluna(cols, "períodos afet", "periodos afet"),
         "ef": _achar_coluna(cols, "efetivo direto", "efetivo"), "hh": _achar_coluna(cols, "hh ociosas"),
         "co": _achar_coluna(cols, "custo ocioso"), "eq": _achar_coluna(cols, "equip. produção", "equip producao"),
         "heq": _achar_coluna(cols, "heq ociosas"), "ce": _achar_coluna(cols, "custo eqp")}
    dias: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        data = str(r.get(c["data"]) or "").strip() if c["data"] else ""
        if not data or "total" in _norm_key(data):
            continue
        ac5 = _norm_key(r.get(c["ac5"])) if c["ac5"] else ""
        dias.append({
            "ordem": len(dias), "data_label": data[:16],
            "chuva_mm": _num_limpo(r.get(c["mm"])) if c["mm"] else None,
            "acima_5mm": ("sim" in ac5) if ac5 else None,
            "periodos_afetados": int(p) if isinstance(p := _num_limpo(r.get(c["per"])), float) else None,
            "efetivo_rdo": _num_limpo(r.get(c["ef"])) if c["ef"] else None,
            "hh_ociosas": _num_limpo(r.get(c["hh"])) if c["hh"] else None,
            "custo_ocioso_rs": _num_limpo(r.get(c["co"])) if c["co"] else None,
            "equip_producao": _num_limpo(r.get(c["eq"])) if c["eq"] else None,
            "heq_ociosas": _num_limpo(r.get(c["heq"])) if c["heq"] else None,
            "custo_eqp_rs": _num_limpo(r.get(c["ce"])) if c["ce"] else None,
        })
    return {"dias": dias, "n": len(dias), "status": "ok", "findings": []}


def _pontuais_params_raw(secoes: list[dict]) -> dict:
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "chave_valor":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "d6impediment" in t and "parametr" in t:
            return {_norm_key(k): v for k, v in (s.get("dados") or {}).items()}
    return {}


def _tokens_signif(s: str) -> set:
    return {t for t in _norm_key_keepspace(s or "").split() if len(t) >= 4}


def _impedimentos_breakdown(secoes: list[dict]) -> list[dict]:
    """Linhas da tabela `D.6 Impedimentos pontuais` — equipe afetada por subtração (p/ casar c/ evento)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        if "d6impedimentospontuais" in _norm_key(s.get("titulo") or ""):
            sec = s
            break
    if sec is None:
        return []
    cols = sec.get("colunas") or []
    c = {"imp": _achar_coluna(cols, "impedimento"), "dias": _achar_coluna_exata(cols, "dias"),
         "modt": _achar_coluna(cols, "mod total"), "moda": _achar_coluna(cols, "mod frentes", "mod ativas"),
         "modf": _achar_coluna(cols, "mod afetado"), "eqpt": _achar_coluna(cols, "eqp total"),
         "eqpa": _achar_coluna(cols, "eqp frentes", "eqp ativas"), "eqpf": _achar_coluna(cols, "eqp afetado")}
    out: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        nome = str(r.get(c["imp"]) or "").strip() if c["imp"] else ""
        if not nome or "total" in _norm_key(nome):
            continue

        def _f(k, _r=r):
            v = _num_limpo(_r.get(c[k])) if c[k] else None
            return v if isinstance(v, float) else None

        dias = _f("dias")
        out.append({"nome": nome, "tokens": _tokens_signif(nome),
                    "dias": int(dias) if isinstance(dias, float) else None,
                    "mod_total": _f("modt"), "mod_frentes_ativas": _f("moda"), "mod_afetado": _f("modf"),
                    "eqp_total": _f("eqpt"), "eqp_frentes_ativas": _f("eqpa"), "eqp_afetado": _f("eqpf")})
    return out


def extrair_pontuais_eventos(secoes: list[dict]) -> dict:
    """D.6 · 4 eventos da `Tabela de eventos` (Categoria/Perda/Status prontos), enriquecidos com a
    quebra de equipe por subtração dos Impedimentos (casamento por token da descrição)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if ("d6pontuais" in t or "d6" in t) and "tabeladeeventos" in t:
            sec = s
            break
    if sec is None:
        return {"eventos": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"data": _achar_coluna_exata(cols, "data") or _achar_coluna(cols, "período", "periodo"),
         "dur": _achar_coluna(cols, "duração", "duracao"),
         "desc": _achar_coluna(cols, "descrição", "descricao"), "cat": _achar_coluna(cols, "categoria"),
         "hh": _achar_coluna(cols, "hh mod parad", "hh mod"), "rmod": _achar_coluna(cols, "custo hh"),
         "heq": _achar_coluna(cols, "heq ocioso", "heq"), "reqp": _achar_coluna(cols, "custo heq"),
         "perda": _achar_coluna(cols, "perda (r$)", "perda r$", "perda"),
         "fonte": _achar_coluna(cols, "fonte"),
         "status": _achar_coluna(cols, "status")}
    imps = _impedimentos_breakdown(secoes)
    usados: set = set()
    eventos: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        cat = str(r.get(c["cat"]) or "").strip() if c["cat"] else ""
        if not cat or "total" in _norm_key(cat):
            continue

        def _f(k, _r=r):
            v = _num_limpo(_r.get(c[k])) if c[k] else None
            return v if isinstance(v, float) else None

        hh = _f("hh")
        heq = _f("heq")
        rmod = _f("rmod")
        reqp = _f("reqp")
        desc = (str(r.get(c["desc"]) or "").strip() or None) if c["desc"] else None
        st = _norm_key(r.get(c["status"])) if c["status"] else ""
        # casa com a quebra de impedimento por sobreposição de tokens da descrição
        bd = None
        if desc:
            dtok = _tokens_signif(desc)
            best, score = None, 0
            for i, im in enumerate(imps):
                if i in usados:
                    continue
                ov = len(dtok & im["tokens"])
                if ov > score:
                    best, score = i, ov
            if best is not None and score >= 2:
                bd = imps[best]
                usados.add(best)
        dias = bd["dias"] if bd else None
        if dias is None and c["dur"]:  # chuva: "27 dias / ..."
            m = re.search(r"(\d+)\s*dias", str(r.get(c["dur"]) or ""))
            dias = int(m.group(1)) if m else None
        eventos.append({
            "ordem": len(eventos), "categoria": cat, "titulo": cat[:200],
            "periodo": (str(r.get(c["data"]) or "").strip() or None) if c["data"] else None,
            "duracao": (str(r.get(c["dur"]) or "").strip() or None) if c["dur"] else None,
            "descricao": desc, "dias": dias,
            "mod_total": bd["mod_total"] if bd else None,
            "mod_frentes_ativas": bd["mod_frentes_ativas"] if bd else None,
            "mod_afetado": bd["mod_afetado"] if bd else None,
            "eqp_total": bd["eqp_total"] if bd else None,
            "eqp_frentes_ativas": bd["eqp_frentes_ativas"] if bd else None,
            "eqp_afetado": bd["eqp_afetado"] if bd else None,
            "hh_ociosas": hh, "heq_ociosas": heq,
            "custo_mod_rs": round(hh * rmod, 2) if hh is not None and rmod else None,
            "custo_eqp_rs": round(heq * reqp, 2) if heq is not None and reqp else None,
            "custo_rs": _f("perda"),
            "fonte": (str(r.get(c["fonte"]) or "").strip() or None) if c["fonte"] else None,
            "status": "needs_review" if ("pendente" in st or "revis" in st) else "ok",
        })
    return {"eventos": eventos, "n": len(eventos), "status": "ok", "findings": []}


def extrair_pontuais_params(secoes: list[dict]) -> dict:
    """D.6 · params (jornada/custos) + resumo dos Cards (perda validada=0, pendente, nº eventos, farol)."""
    raw = _pontuais_params_raw(secoes)
    jornada = _num_limpo(raw.get("jornadadiah"))
    cmod = _num_limpo(raw.get("custohoramodrh"))
    ceqp = _num_limpo(raw.get("custohoraeqprh"))
    cards: dict = {}
    for s in secoes:
        _t6 = _norm_key(s.get("titulo") or "") if isinstance(s, dict) else ""
        if isinstance(s, dict) and s.get("tipo") == "chave_valor" and ("d6pontuaiscards" in _t6 or ("d6" in _t6 and "cards" in _t6)):
            cards = {_norm_key(k): v for k, v in (s.get("dados") or {}).items()}
            break
    validada = _num_limpo(next((v for k, v in cards.items() if k.startswith("perdatotalacumulada")), None))
    adicional = _num_limpo(next((v for k, v in cards.items() if k.startswith("perdaadicional")), None))
    pendente = _num_limpo(cards.get("pendenteemanalisenaosoma"))
    n_pend = _num_limpo(cards.get("eventospendentesderevisao"))
    farol = _limpa_glifo(str(cards.get("farol") or "").strip()) or "Conforme"
    return {"params": {
        "jornada_dia_h": jornada if isinstance(jornada, float) else None,
        "custo_hora_mod_rs": cmod if isinstance(cmod, float) else None,
        "custo_hora_eqp_rs": ceqp if isinstance(ceqp, float) else None,
        "perda_validada_rs": validada if isinstance(validada, float) else 0.0,
        "pendente_total_rs": pendente if isinstance(pendente, float) else None,
        "adicional_rs": adicional if isinstance(adicional, float) else None,
        "eventos_pendentes": int(n_pend) if isinstance(n_pend, float) else None,
        "farol": farol,
    }, "status": "ok", "findings": []}


# ── D.0 PAINEL DESEQUILÍBRIO — composição por categoria (M3 · headline 33,1M) ─────────────────────
# Lista: Categoria (natureza) × Tela (D.1..D.8) × Valor (R$) × % do total. Σ categorias == total do
# desequilíbrio (o número que alimenta o bloco do RMA + a Visão Geral + o Dashboard). É a CONSOLIDAÇÃO
# (lê dos D.x), mas a própria tabela traz os valores → normalizo direto. Conservação: Σ == total.

def extrair_desequilibrio_painel(secoes: list[dict]) -> dict:
    """D.0 → composição do desequilíbrio {categoria, tela, valor_rs, pct}. Σ valor = total. Pula
    linha-rótulo. Gate: gate_desequilibrio (Σ categorias == total declarado, se houver card)."""
    findings: list[dict] = []
    alvo = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if (("painel desequil" in t or ("desequil" in t and "composic" in t))
                and _achar_coluna(cols, "categoria") is not None
                and _achar_coluna(cols, "valor") is not None
                and isinstance(s.get("linhas"), list)):
            alvo = s
            break
    if alvo is None:
        findings.append({"severity": "error", "campo": "painel", "msg": "D.0 Painel Desequilíbrio não localizado"})
        return {"categorias": [], "soma_rs": None, "n_categorias": 0, "status": "needs_review", "findings": findings}
    cols = alvo.get("colunas") or []
    c_cat = _achar_coluna(cols, "categoria")
    c_tela = _achar_coluna(cols, "tela")
    c_val = _achar_coluna(cols, "valor (r$)", "valor")
    c_pct = _achar_coluna(cols, "% do total", "do total", "%")
    categorias: list[dict] = []
    soma = 0.0
    for r in (alvo.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        cat = str(r.get(c_cat) or "").strip()
        if not cat:
            continue
        val = _num_limpo(r.get(c_val)) if c_val else None
        pct = _num_limpo(r.get(c_pct)) if c_pct else None
        if "ERRO_REF" in (val, pct):
            findings.append({"severity": "error", "campo": "celula", "msg": f"#REF! em '{cat[:24]}'"})
            continue
        val = val if isinstance(val, float) else None
        categorias.append({
            "ordem": len(categorias), "categoria": cat[:120],
            "tela": str(r.get(c_tela) or "").strip()[:16] if c_tela else None,
            "valor_rs": val, "pct_do_total": pct if isinstance(pct, float) else None,
        })
        if val:
            soma += val
    if not categorias:
        findings.append({"severity": "error", "campo": "categorias", "msg": "nenhuma categoria de desequilíbrio"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"categorias": categorias, "soma_rs": round(soma, 2), "n_categorias": len(categorias),
            "status": status, "findings": findings}


# ── D.1 INDIRETOS — métodos paralelos + base (M3 · maior componente do desequilíbrio) ─────────────
# 4 métodos de cálculo (M1 PSQ ativo, M2 RDO×SICRO, M3 contábil, M4 comparativo) + cards-base. O
# desequilíbrio de indiretos = mensal(M1) + redução-escopo(cenário A) + extensão(cenário B) = 31,99M
# (cruza com D.0). Métodos = lista; base = cards (KV). Conservação: composição == valor D.0 de D.1.

def _estrelas(v: str) -> int | None:
    n = str(v or "").count("⭐") + str(v or "").count("★")
    return n or None


def extrair_indiretos(secoes: list[dict]) -> dict:
    """D.1 Indiretos (v2) — lê o estado CORRETO da extração (under-recovery da Adm Local).

    Seções (na extração, KV vem em `dados`, tabela em `linhas`):
      • Bloco 2 (KV): 4 métodos M2/M2.1/M2.2/M3 com seus pares comparados + metodoAtivo +
        desequilibrioMetodoAtivo. → o ATIVO governa o número.
      • Base Contratual / Detalhe (KV): cheio, mensal, custo_direto, PV, prazo, BM +
        gasto/medido/real/contratado (as bases dos métodos).
      • Bloco 3 (tabela): os 29 grupos da Adm Local (contratado × real do M2).
      • Cenário A/B (KV): redução de escopo + extensão de prazo — quantificações que
        alimentam o pleito (D.10) e NÃO somam ao desequilíbrio da D.1.

    `desequilibrio_total` = método ATIVO (NÃO a soma de parcelas/cenários). Determinístico.
    """
    findings: list[dict] = []

    def _kv(pred):  # noqa: ANN001 — 1ª seção cujo dados (dict KV) satisfaz o predicado
        for s in secoes:
            dd = s.get("dados") if isinstance(s, dict) else None
            if isinstance(dd, dict) and pred(dd):
                return dd
        return None

    def _g(d, *keys):  # noqa: ANN001 — número limpo da 1ª chave presente
        if not isinstance(d, dict):
            return None
        for k in keys:
            if k in d:
                v = _num_limpo(d.get(k))
                if isinstance(v, float):
                    return v
        return None

    m = _kv(lambda d: "M2_2_gastoXMedido" in d or "desequilibrioMetodoAtivo" in d)
    base_kv = _kv(lambda d: "custoDiretoCD" in d and "admLocalMensalCheio" in d)
    det_kv = _kv(lambda d: "precoVendaPV" in d)
    kpi_kv = _kv(lambda d: "percentSobreOPV" in d)
    red_kv = _kv(lambda d: "totalAdmLocalNaoRemuneradaReducao" in d)
    ext_kv = _kv(lambda d: "totalAdmLocalNaoRemuneradaExtensao" in d)

    metodos: list[dict] = []
    total = metodo_ativo = None
    gasto = medido = real = contratado = None

    if m:
        metodo_ativo = str(m.get("metodoAtivo") or "").strip()[:16] or None
        total = _g(m, "desequilibrioMetodoAtivo")
        h = m.get("M2_comparativoHistograma") or {}
        r1 = m.get("M2_1_realXMedido") or {}
        r2 = m.get("M2_2_gastoXMedido") or {}
        real = _g(h, "admLocalRealAteOPeriodo")
        contratado = _g(h, "admLocalContratadaAteOPeriodo")
        gasto = _g(r2, "admLocalGastoAteOPeriodo")
        medido = _g(r2, "admLocalMedidaBoletimAteOPeriodo") or _g(r1, "admLocalMedidaBoletimAteOPeriodo")

        def _met(ordem, codigo, nome, comp, va, vb, des, pend=False):  # noqa: ANN001
            return {
                "ordem": ordem, "codigo": codigo, "metodo": nome, "comparacao": comp,
                "valor_a": va if isinstance(va, float) else None,
                "valor_b": vb if isinstance(vb, float) else None,
                "desequilibrio_rs": des if isinstance(des, float) else None,
                "medido_rs": None, "defensabilidade": None,
                "ativo": metodo_ativo == codigo, "pendente": pend, "obs": None,
            }
        metodos = [
            _met(0, "M2", "Comparativo de histograma", "real − contratado",
                 real, contratado, _g(h, "desequilibrioM2_realMenosContratada")),
            _met(1, "M2.1", "Real × Medido", "real − boletim medido",
                 real, medido, _g(r1, "desequilibrioM2_1_realMenosMedida")),
            _met(2, "M2.2", "Gasto × Medido", "gasto − boletim medido",
                 gasto, medido, _g(r2, "desequilibrioM2_2_gastoMenosMedida")),
            _met(3, "M3", "Contábil (AGM)", "apropriação contábil", None, None, None, pend=True),
        ]

    # ── Variante TABELA+CARDS (caso SBSO/Sorriso) ────────────────────────────────────────────
    # Em obras cujo workbook emite o Bloco 2 como TABELA (linhas metodo/desequilibrio/
    # componente1..2) e o ativo+total nos CARDS (metodoAtivo/desequilibrioAcumuladoMetodoAtivo),
    # o KV canônico acima não existe. Só ativa nesse caso — BR-101 permanece no caminho v2.
    if not metodos:
        cards_kv = _kv(lambda d: "metodoAtivo" in d
                       and ("desequilibrioAcumuladoMetodoAtivo" in d or "desequilibrioMetodoAtivo" in d))
        sec_met = next(
            (s for s in secoes if isinstance(s, dict) and isinstance(s.get("linhas"), list) and s.get("linhas")
             and isinstance(s["linhas"][0], dict) and "metodo" in s["linhas"][0]
             and "desequilibrio" in s["linhas"][0] and "componente1_valor" in s["linhas"][0]),
            None,
        )
        if cards_kv and sec_met is not None:
            metodo_ativo = str(cards_kv.get("metodoAtivo") or "").strip()[:16] or None
            total = _g(cards_kv, "desequilibrioAcumuladoMetodoAtivo", "desequilibrioMetodoAtivo")
            for i, r in enumerate(sec_met.get("linhas") or []):
                if not isinstance(r, dict):
                    continue
                rot = str(r.get("metodo") or "").strip()
                codigo = (rot.split("—")[0].split("-")[0].strip()[:8]) or f"M{i + 1}"
                nome = rot.split("—", 1)[1].strip() if "—" in rot else rot
                nome = re.sub(r"\s*\(ativo\)\s*$", "", nome, flags=re.I).strip()
                va = _num_limpo(r.get("componente1_valor"))
                vb = _num_limpo(r.get("componente2_valor"))
                des = _num_limpo(r.get("desequilibrio"))
                c1 = str(r.get("componente1_label") or "").strip()
                c2 = str(r.get("componente2_label") or "").strip()
                # bases dos KPIs pelo rótulo dos componentes (determinístico)
                if isinstance(va, float):
                    la = c1.lower()
                    if "gasto" in la:
                        gasto = va if gasto is None else gasto
                    elif "real" in la:
                        real = va if real is None else real
                    elif "contratada" in la or "contratado" in la:
                        contratado = va if contratado is None else contratado
                if isinstance(vb, float):
                    lb = c2.lower()
                    if "medida" in lb or "medido" in lb or "boletim" in lb:
                        medido = vb if medido is None else medido
                    elif "contratada" in lb or "contratado" in lb:
                        contratado = vb if contratado is None else contratado
                # invariante da tela: valor_a − valor_b == desequilíbrio (minuendo/subtraendo).
                # Se o workbook listou os componentes na ordem inversa, troca (com os rótulos).
                if (isinstance(va, float) and isinstance(vb, float) and isinstance(des, float)
                        and abs((va - vb) - des) > 0.01 and abs((vb - va) - des) <= 0.01):
                    va, vb, c1, c2 = vb, va, c2, c1
                metodos.append({
                    "ordem": i, "codigo": codigo, "metodo": (nome or codigo)[:120],
                    "comparacao": (f"{c1} − {c2}"[:160] if c1 and c2 else None),
                    "valor_a": va if isinstance(va, float) else None,
                    "valor_b": vb if isinstance(vb, float) else None,
                    "desequilibrio_rs": des if isinstance(des, float) else None,
                    "medido_rs": None, "defensabilidade": None,
                    "ativo": metodo_ativo == codigo, "pendente": des is None, "obs": None,
                })

    # 29 grupos da Adm Local (tabela Bloco 3 · M2 contratado × real)
    itens: list[dict] = []
    sec_it = next(
        (s for s in secoes if isinstance(s, dict)
         and _achar_coluna(s.get("colunas") or [], "item", "grupo") is not None
         and _achar_coluna(s.get("colunas") or [], "custo contr", "custo contratado") is not None),
        None,
    )
    if sec_it is not None:
        cols = sec_it.get("colunas") or []
        kG = _achar_coluna(cols, "item", "grupo")
        kQC = _achar_coluna(cols, "qtd contr", "qtd contratada")
        kQR = _achar_coluna(cols, "qtd real")
        kCC = _achar_coluna(cols, "custo contr", "custo contratado")
        kCR = _achar_coluna(cols, "custo real")
        for r in (sec_it.get("linhas") or []):
            if not isinstance(r, dict) or eh_linha_rotulo(r):
                continue
            grupo = str(r.get(kG) or "").strip()
            if not grupo or grupo.upper() == "TOTAL":
                continue
            cc = _num_limpo(r.get(kCC)) if kCC else None
            cr = _num_limpo(r.get(kCR)) if kCR else None
            # Δ Custo = real − contratado (definição exata; evita coluna ambígua sob
            # normalização, onde "Δ Custo (R$)" colide com "Custo Real (R$)").
            delta = (cr - cc) if isinstance(cc, float) and isinstance(cr, float) else None
            itens.append({
                "ordem": len(itens), "grupo": grupo[:120],
                "qtd_contr": _num_limpo(r.get(kQC)) if kQC else None,
                "qtd_real": _num_limpo(r.get(kQR)) if kQR else None,
                "custo_contr": cc, "custo_real": cr, "delta_custo": delta,
            })

    def _i(v):  # noqa: ANN001 — inteiro ou None
        return int(v) if isinstance(v, float) else None

    base = {
        "adm_local_cheio": _g(base_kv, "admLocalValorCheio") or _g(det_kv, "admLocalValorCheioTotalSemBDI"),
        "adm_local_mensal": _g(base_kv, "admLocalMensalCheio") or _g(det_kv, "admLocalMensalCheio"),
        "custo_direto": _g(base_kv, "custoDiretoCD") or _g(det_kv, "custoDiretoCD"),
        "pv": _g(det_kv, "precoVendaPV"),
        "percent_pv": _g(kpi_kv, "percentSobreOPV") or _g(base_kv, "percentSobrePV"),
        "prazo_meses": _i(_g(base_kv, "prazoContratualMeses") or _g(det_kv, "prazoOriginalMeses")),
        "bm_corrente": _i(_g(base_kv, "bmCorrenteMesNo") or _g(base_kv, "bmCorrente")),
        "gasto_acum": gasto, "medido_acum": medido, "real_acum": real, "contratado_acum": contratado,
        "metodo_ativo": metodo_ativo,
        # cenários (alimentam D.10 · NÃO somam à D.1):
        "reducao_pct": _g(red_kv, "reducaoEscopoPercentSContrato"),
        "reducao_escopo": _g(red_kv, "totalAdmLocalNaoRemuneradaReducao"),
        "extensao_meses": _g(ext_kv, "extensaoPrazoDeltaTMeses"),
        "desequilibrio_extensao": _g(ext_kv, "totalAdmLocalNaoRemuneradaExtensao"),
    }

    if not metodos:
        findings.append({"severity": "error", "campo": "metodos", "msg": "Bloco 2 de métodos não encontrado"})
    if total is None:
        findings.append({"severity": "error", "campo": "total", "msg": "desequilibrioMetodoAtivo ausente"})
    # Base Contratual ausente = KPIs/calculadora ficariam vazios. Falha-alto (não silêncio) para o
    # gate/persist recusarem gravar por cima do vigente quando a seção não foi encontrada.
    if metodos and (base["custo_direto"] is None or base["adm_local_mensal"] is None):
        findings.append({"severity": "error", "campo": "base",
                         "msg": "Base Contratual (custoDiretoCD/admLocalMensalCheio) não encontrada"})
    # O método ATIVO governa o total — precisa existir e casar 1:1 com a flag dos métodos, senão o
    # número fica órfão de contexto (não sabemos qual comparação o gerou).
    if metodos:
        flagged = [x for x in metodos if x["ativo"]]
        if not metodo_ativo:
            findings.append({"severity": "error", "campo": "metodoAtivo", "msg": "metodoAtivo ausente"})
        elif len(flagged) != 1:
            findings.append({"severity": "error", "campo": "metodoAtivo",
                             "msg": f"esperado 1 método ativo (={metodo_ativo}), achou {len(flagged)}"})
    # Canteiro (quando a obra o quantifica em separado, ex.: SBSO): NÃO soma no total do método
    # ativo (regra: o ativo governa a D.1); vai como campo próprio — o D.0 costuma compor
    # Adm Local + Canteiro na categoria Custos Indiretos, e o gate cruza com essa soma.
    cant_kv = _kv(lambda d: any("desequilibrio" in _norm_key(k) and "canteiro" in _norm_key(k) for k in d))
    canteiro_rs = None
    if cant_kv:
        for k, v in cant_kv.items():
            if "desequilibrio" in _norm_key(k) and "canteiro" in _norm_key(k):
                canteiro_rs = _num_limpo(v) if not isinstance(v, float) else v
                break

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"metodos": metodos, "base": base, "itens": itens,
            "desequilibrio_total": total, "canteiro_rs": canteiro_rs, "n_metodos": len(metodos),
            "n_itens": len(itens), "status": status, "findings": findings}


# ── C.11 CONDUTAS — catálogo de condutas/gatilhos (RMA · ações sugeridas pelo Adm Contratual IA) ───
def extrair_condutas(secoes: list[dict]) -> dict:
    """C.11 → catálogo de condutas {gatilho, documento, clausula, categoria, prioridade, farol,
    status, data_sugerida, dias_aberto} + cards (totais). Conservação: n == condutasSugeridasTotal."""
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("condutas" in t and "catalogo" in t
                and _achar_coluna(cols, "conduta", "gatilho") is not None
                and isinstance(s.get("linhas"), list)):
            sec = s
            break
    cards = None
    for s in secoes:
        dd = s.get("dados") if isinstance(s, dict) else None
        if isinstance(dd, dict) and "condutasSugeridasTotal" in dd:
            cards = dd
            break
    condutas: list[dict] = []
    if sec is not None:
        cols = sec.get("colunas") or []
        c = {k: _achar_coluna(cols, *ns) for k, ns in {
            "gat": ("conduta", "gatilho"), "doc": ("documento",), "cla": ("clausula", "cláusula", "base"),
            "cat": ("categoria",), "pri": ("prioridade",), "far": ("farol",),
            "sta": ("status",), "dat": ("data sugerida",), "dia": ("dias aberto",),
        }.items()}
        for r in (sec.get("linhas") or []):
            if not isinstance(r, dict) or eh_linha_rotulo(r):
                continue
            gat = str(r.get(c["gat"]) or "").strip()
            if not gat:
                continue
            dia = _num_limpo(r.get(c["dia"])) if c["dia"] else None
            condutas.append({
                "ordem": len(condutas), "gatilho": gat[:300],
                "documento": str(r.get(c["doc"]) or "").strip()[:200] if c["doc"] else None,
                "clausula": str(r.get(c["cla"]) or "").strip()[:200] if c["cla"] else None,
                "categoria": str(r.get(c["cat"]) or "").strip()[:80] if c["cat"] else None,
                "prioridade": str(r.get(c["pri"]) or "").strip()[:40] if c["pri"] else None,
                "farol": str(r.get(c["far"]) or "").strip()[:40] if c["far"] else None,
                "status": str(r.get(c["sta"]) or "").strip()[:60] if c["sta"] else None,
                "data_sugerida": str(r.get(c["dat"]) or "").strip()[:20] if c["dat"] else None,
                "dias_aberto": int(dia) if isinstance(dia, float) else None,
            })
    total_card = None
    if cards:
        tc = _num_limpo(cards.get("condutasSugeridasTotal"))
        total_card = int(tc) if isinstance(tc, float) else None
    if not condutas:
        findings.append({"severity": "error", "campo": "condutas", "msg": "nenhuma conduta no catálogo"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"condutas": condutas, "cards": cards, "total_card": total_card,
            "n_condutas": len(condutas), "status": status, "findings": findings}


# ── C.8 CURVAS Lib×Cap×Aloc — aderência das curvas (RMA · origem do gargalo) ──────────────────────
# Cards consolidados no corte: liberado/capacidade/executado vs contratado. executadoAcum == faturado
# real (cross-check inter-seção). Liberação=liberado/contratado · Capacidade=cap/contratado ·
# Alocado=executado/contratado. NÃO confundir com C.9 (que também tem pctLiberadoVsContratado).
def extrair_curvas_c8(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    cards = None
    for s in secoes:
        dd = s.get("dados") if isinstance(s, dict) else None
        if isinstance(dd, dict) and "executadoAcum" in dd and "pctLiberadoVsContratado" in dd:
            cards = dd
            break
    if cards is None:
        findings.append({"severity": "error", "campo": "cards", "msg": "C.8 cards não localizados"})
        return {"executado_acum": None, "status": "needs_review", "findings": findings}

    def f(k):  # noqa: ANN001
        v = _num_limpo(cards.get(k))
        return v if isinstance(v, float) else None

    contratado = f("totalContratadoAcum")
    executado = f("executadoAcum")
    res = {
        "contratado_acum_corte": contratado,
        "liberado_acum": f("liberadoParaExecucaoAcum"),
        "capacidade_acum": f("capacidadeProdutivaAcum"),
        "executado_acum": executado,
        "maior_gap_rs": f("maiorGapEntreCurvasRS"),
        # frações 0..1 (a UI multiplica por 100)
        "liberacao_pct": f("pctLiberadoVsContratado"),
        "capacidade_pct": f("pctCapacidadeVsContratado"),
        # "alocado" = executado / contratado-no-corte (recomputado p/ não depender de rótulo da planilha)
        "alocado_pct": round(executado / contratado, 6) if executado and contratado else None,
    }
    if res["executado_acum"] is None:
        findings.append({"severity": "error", "campo": "executado", "msg": "executadoAcum ausente"})
    res["status"] = "needs_review" if any(x["severity"] == "error" for x in findings) else "ok"
    res["findings"] = findings
    return res


# ── C.9 CHUVAS — análise pluviométrica (RMA · crucial p/ obra a céu aberto) ───────────────────────
# Série mensal chuva prevista (baseline histórico) × real (input) + dias parados + resumo de
# impedimentos (R$ impedido, frentes não iniciadas, sinistros). Chuva REAL é input → pendente até a
# obra medir. Conservação: chuva_prev_acum bate com a soma corrente da prevista.
def extrair_chuvas(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("chuvas" in t and ("acompanhamento" in t or "analise" in t or "inmet" in t)
                and _achar_coluna(cols, "chuva prev (mm)", "chuva prev") is not None):
            sec = s
            break
    resumo_kv = None
    for s in secoes:
        dd = s.get("dados") if isinstance(s, dict) else None
        if isinstance(dd, dict) and "impedidoTotalRS" in dd:
            resumo_kv = dd
            break
    meses: list[dict] = []
    if sec is not None:
        cols = sec.get("colunas") or []
        c = {
            "mo": _achar_coluna(cols, "mes obra", "mês obra"),
            "pa": _achar_coluna(cols, "mes/ano", "mês/ano"),
            "pv": _achar_coluna(cols, "chuva prev (mm)", "chuva prev"),
            "rl": _achar_coluna(cols, "chuva real (mm)", "chuva real", "real inmet", "real rdo"),
            "pac": _achar_coluna(cols, "chuva prev acum"),
            "rac": _achar_coluna(cols, "chuva real acum"),
            "dp": _achar_coluna(cols, "dias parados"),
            "d5": _achar_coluna(cols, "dias chuva prev >5mm", "dias chuva prev", "dias prev"),
            "far": _achar_coluna(cols, "forca maior", "força maior", "farol"),
        }
        for r in (sec.get("linhas") or []):
            if not isinstance(r, dict) or eh_linha_rotulo(r):
                continue
            periodo = str(r.get(c["pa"]) or "").strip() if c["pa"] else ""
            pv = _num_limpo(r.get(c["pv"])) if c["pv"] else None
            if not periodo or not isinstance(pv, float):  # só meses com período + chuva prevista
                continue
            rl = _num_limpo(r.get(c["rl"])) if c["rl"] else None
            pac = _num_limpo(r.get(c["pac"])) if c["pac"] else None
            rac = _num_limpo(r.get(c["rac"])) if c["rac"] else None
            dp = _num_limpo(r.get(c["dp"])) if c["dp"] else None
            d5 = _num_limpo(r.get(c["d5"])) if c["d5"] else None
            meses.append({
                "ordem": len(meses),
                "mes_obra": str(r.get(c["mo"]) or "").strip()[:8] if c["mo"] else None,
                "periodo": periodo[:12],
                "chuva_prev_mm": pv,
                "chuva_real_mm": rl if isinstance(rl, float) else None,  # input → None se vazio
                "chuva_prev_acum": pac if isinstance(pac, float) else None,
                "chuva_real_acum": rac if isinstance(rac, float) else None,
                "dias_parados": dp if isinstance(dp, float) else None,
                "dias_prev_5mm": d5 if isinstance(d5, float) else None,  # dias de chuva >5mm (impacto)
                "farol": str(r.get(c["far"]) or "").strip()[:30] if c["far"] else None,
            })
    resumo = {}
    if resumo_kv:
        def b(k):  # noqa: ANN001
            v = _num_limpo(resumo_kv.get(k))
            return v if isinstance(v, float) else None
        resumo = {
            "impedido_total_rs": b("impedidoTotalRS"),
            "liberado_total_rs": b("liberadoTotalRS"),
            "frentes_nao_iniciadas": int(b("frentesNaoIniciadasQtd")) if b("frentesNaoIniciadasQtd") else None,
            "principal_impedido": str(resumo_kv.get("principalImpedido1") or "").strip()[:120] or None,
        }
    eixo_real_vazio = not any((m["chuva_real_mm"] or 0) > 0 for m in meses)
    if not meses:
        findings.append({"severity": "error", "campo": "meses", "msg": "série de chuvas vazia"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"meses": meses, "resumo": resumo, "n_meses": len(meses),
            "eixo_real_vazio": eixo_real_vazio, "status": status, "findings": findings}


# ── C.8 MATRIZ POR FRENTE — responsabilidade × gargalo por frente de serviço (RMA · combina c/ Curvas)
# 12 frentes: Contratado, Produtividade (R$/HH), Gap dominante, Responsabilidade preliminar. Liberado/
# HH/Capacidade/Executado são inputs (pendentes). Σ contratado das frentes cruza com C.8 contratado.
def extrair_curvas_frentes(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("matriz" in t and ("curva" in t or "aderencia" in t)  # _norm_key tira o ponto de 'c.8'
                and _achar_coluna(cols, "frente") is not None
                and _achar_coluna(cols, "responsabilidade") is not None):
            sec = s
            break
    if sec is None:
        return {"frentes": [], "soma_contratado": None, "n_frentes": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "frentes", "msg": "matriz de frentes não localizada"}]}
    cols = sec.get("colunas") or []
    c = {
        "fr": _achar_coluna(cols, "frente"),
        "ct": _achar_coluna(cols, "contratado (r$)", "contratado"),
        "pr": _achar_coluna(cols, "produtiv", "r$/hh"),
        "gap": _achar_coluna(cols, "gap dominante", "gap"),
        "resp": _achar_coluna(cols, "responsabilidade"),
        "exe": _achar_coluna(cols, "executado"),
        "cap": _achar_coluna(cols, "capacidade"),
    }
    frentes: list[dict] = []
    soma = 0.0
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        fr = str(r.get(c["fr"]) or "").strip()
        if not fr:
            continue
        ct = _num_limpo(r.get(c["ct"])) if c["ct"] else None
        gap = _num_limpo(r.get(c["gap"])) if c["gap"] else None
        pr = _num_limpo(r.get(c["pr"])) if c["pr"] else None
        exe = _num_limpo(r.get(c["exe"])) if c["exe"] else None
        cap = _num_limpo(r.get(c["cap"])) if c["cap"] else None
        frentes.append({
            "ordem": len(frentes), "frente": fr[:80],
            "contratado_rs": ct if isinstance(ct, float) else None,
            "produtividade_rs_hh": pr if isinstance(pr, float) else None,
            "gap_dominante_rs": gap if isinstance(gap, float) else None,
            "responsabilidade": str(r.get(c["resp"]) or "").strip()[:60] if c["resp"] else None,
            "_exe": exe if isinstance(exe, float) else None,
            "_cap": cap if isinstance(cap, float) else None,
        })
        if isinstance(ct, float):
            soma += ct
    if not frentes:
        findings.append({"severity": "error", "campo": "frentes", "msg": "nenhuma frente"})
    # PENDENTE ≠ ZERO: Gap dominante e Responsabilidade são DERIVADOS de Executado/Capacidade por
    # frente (inputs). Quando esses inputs estão pendentes (todos 0/branco), a fonte fabrica
    # 'Gap = Contratado − 0 = Contratado' e um VEREDITO de culpa '● Contratada (subdim.)'. Não
    # propagar essa culpa fabricada → gap/responsabilidade = NULL (pendente). Contratado e
    # produtividade (referência contratual) ficam. Quando o real for medido (≥1 executado>0), mantém.
    real_alocado = any((f["_exe"] or 0) > 0 or (f["_cap"] or 0) > 0 for f in frentes)
    if not real_alocado:
        for f in frentes:
            f["gap_dominante_rs"] = None
            f["responsabilidade"] = None
    for f in frentes:
        del f["_exe"], f["_cap"]
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"frentes": frentes, "soma_contratado": round(soma, 2), "n_frentes": len(frentes),
            "real_pendente": not real_alocado, "status": status, "findings": findings}


# ── C.10 PANORAMA DO CONTRATO — faróis multidimensionais (RMA · visão consolidada) ────────────────
def _farol_nivel(v) -> str | None:  # noqa: ANN001
    s = _norm_key(str(v or ""))
    if "conforme" in s:
        return "conforme"
    if "observ" in s or "atencao" in s:  # "Atenção" (não-canônico da fonte) → Observação
        return "observacao"
    if "risco" in s:
        return "risco"
    if "critic" in s:
        return "critico"
    return None  # "—" → pendente (dimensão não avaliada)


def extrair_panorama(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    kv = None
    for s in secoes:
        dd = s.get("dados") if isinstance(s, dict) else None
        if isinstance(dd, dict) and any(str(k).startswith("consolidadoPior") for k in dd):
            kv = dict(dd)
            break
    if kv is not None:
        # merge das demais KVs do C.10 (ex.: SBSO separa Farol e KPIs em seções) — 1º valor vence
        for s in secoes:
            if not isinstance(s, dict):
                continue
            if "c10" not in _norm_key(s.get("titulo") or ""):
                continue
            dd = s.get("dados")
            if isinstance(dd, dict):
                for k, v in dd.items():
                    kv.setdefault(k, v)
    if kv is None:
        return {"farois": {}, "n_avaliados": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "panorama", "msg": "C.10 panorama não localizado"}]}
    def _g10(*nomes):  # 1º valor entre chaves candidatas (lookup normalizado · dialetos BR-101/SBSO)
        idx10 = {_norm_key(k): v for k, v in kv.items()}
        for nm in nomes:
            if _norm_key(nm) in idx10:
                return idx10[_norm_key(nm)]
        return None

    farois = {
        "projetos": _farol_nivel(_g10("farolProjetos", "projetos")),
        "interferencias": _farol_nivel(_g10("farolInterferencias", "interferenciasDivPontuais")),
        "liberacoes_area": _farol_nivel(_g10("farolLiberacoesArea", "liberacoesDeArea")),
        "clima_forca_maior": _farol_nivel(_g10("farolClimaForcaMaior", "clima")),
        "precos_quantidades": _farol_nivel(_g10("farolPrecosQuantidades", "precosEQuantidades")),
        "suprimentos_material": _farol_nivel(_g10("farolSuprimentosMaterial", "suprimentosMaterial")),
    }
    consolidado = _farol_nivel(next((v for k, v in kv.items() if str(k).startswith("consolidadoPior")), None))
    pct = _num_limpo(_g10("liberacoes_pctAreasLiberadas", "liberacoesArea_percAreasLiberadas"))
    dias = _num_limpo(_g10("clima_diasParadosAcumulados", "clima_diasParados", "diasParadosAcum"))
    imp = _num_limpo(_g10("liberacoes_frentesImpedidasHojeRS", "liberacoesArea_frentesImpedidasHoje_RS"))
    n_avaliados = sum(1 for v in farois.values() if v is not None)
    return {
        "farois": farois,
        "consolidado": consolidado,
        "pct_areas_liberadas": pct if isinstance(pct, float) else None,
        "dias_parados_acum": dias if isinstance(dias, float) else None,
        "frentes_impedidas_rs": imp if isinstance(imp, float) else None,
        "n_avaliados": n_avaliados,
        "status": "ok",
        "findings": findings,
    }


# ── C.3 FATURAMENTO POR FRENTE/DISCIPLINA — Contratado × Real por frente (RMA · gap apontado) ──────
# 12 frentes: Contratado Total + Contratado Acum até BM + Real Acum + % + Farol. Σ Contratado Total
# = PV (611M) · Σ Contratado Acum = 41M (cruza C.8/curva no corte). Real é input (0 até medir).
def extrair_faturamento_frentes(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("faturamento" in t and "frente" in t and ("resumo" in t or "disciplina" in t)
                and _achar_coluna(cols, "frente") is not None
                and _achar_coluna(cols, "contratado total", "contratado") is not None):
            sec = s
            break
    if sec is None:
        return {"frentes": [], "soma_contratado_total": None, "soma_contratado_acum": None,
                "n_frentes": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "frentes", "msg": "C.3 Por frente não localizado"}]}
    cols = sec.get("colunas") or []
    c = {
        "fr": _achar_coluna(cols, "frente"),
        "sv": _achar_coluna(cols, "serviço?", "servico?", "serviço"),
        "ct": _achar_coluna(cols, "contratado total"),
        "ca": _achar_coluna(cols, "contratado acum"),
        "ra": _achar_coluna(cols, "real acum"),
        "pc": _achar_coluna(cols, "%"),
        "far": _achar_coluna(cols, "farol"),
    }
    frentes: list[dict] = []
    soma_tot = soma_acum = 0.0
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        fr = str(r.get(c["fr"]) or "").strip()
        if not fr or fr.upper() == "TOTAL":
            continue
        ct = _num_limpo(r.get(c["ct"])) if c["ct"] else None
        ca = _num_limpo(r.get(c["ca"])) if c["ca"] else None
        ra = _num_limpo(r.get(c["ra"])) if c["ra"] else None
        pc = _num_limpo(r.get(c["pc"])) if c["pc"] else None
        sv = str(r.get(c["sv"]) or "").strip().lower() if c["sv"] else ""
        frentes.append({
            "ordem": len(frentes), "frente": fr[:80],
            "servico": sv.startswith("s") if sv else None,
            "contratado_total": ct if isinstance(ct, float) else None,
            "contratado_acum": ca if isinstance(ca, float) else None,
            "real_acum": ra if isinstance(ra, float) else None,
            "pct": pc if isinstance(pc, float) else None,
            "farol": str(r.get(c["far"]) or "").strip()[:24] if c["far"] else None,
        })
        if isinstance(ct, float):
            soma_tot += ct
        if isinstance(ca, float):
            soma_acum += ca
    if not frentes:
        findings.append({"severity": "error", "campo": "frentes", "msg": "nenhuma frente"})
    # PENDENTE ≠ ZERO: o Real por frente é INPUT alocado. Quando a obra só mediu o agregado
    # (C.3 resumo traz realAcumAteBM) sem ratear por frente, a seção-fonte traz Real Acum.=0 e um
    # farol "Crítico" DERIVADO desse 0 falso. Se NENHUMA frente tem real>0, o eixo real não foi
    # alocado → grava real/pct/farol = NULL (pendente), nunca 0 nem Crítico fabricado.
    real_alocado = any(isinstance(f["real_acum"], float) and f["real_acum"] > 0 for f in frentes)
    if not real_alocado:
        for f in frentes:
            f["real_acum"] = None
            f["pct"] = None
            f["farol"] = None
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"frentes": frentes, "soma_contratado_total": round(soma_tot, 2),
            "soma_contratado_acum": round(soma_acum, 2), "n_frentes": len(frentes),
            "real_pendente": not real_alocado, "status": status, "findings": findings}


# ── C.3 FATURAMENTO POR FRENTE NOMEADA + MACRO (drill "Por Frente" · Trecho/Ponte/Dispositivo) ──────
# Seção template "C.3 — Faturamento por Frente": Macro (Pista/OAEs/Dispositivos/…) × Frente NOMEADA ×
# Contratado Total/Acum × Real Acum × % × Farol. Fonte ROBUSTA dos rótulos do drill "Por Frente" — cada
# obra traz as SUAS frentes (lido por ESTRUTURA, zero hardcode de KM/Trecho). Assinatura única: coluna
# "Macro" + coluna "Frente" (a por-disciplina tem "Serviço?", não tem Macro → sem colisão). Σ Contratado
# Total = PV (gate). Real é INPUT alocado: se nenhuma frente tem real>0 → NULL (pendente, nunca 0/Crítico).
def extrair_faturamento_por_frente_macro(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("faturamento" in t and "frente" in t
                and _achar_coluna(cols, "macro") is not None
                and _achar_coluna(cols, "frente") is not None
                and _achar_coluna(cols, "contratado total", "contratado") is not None):
            sec = s
            break
    if sec is None:
        return {"frentes": [], "soma_contratado_total": None, "soma_contratado_acum": None,
                "n_frentes": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "frente_macro",
                              "msg": "C.3 Por frente (macro) não localizado"}]}
    cols = sec.get("colunas") or []
    c = {
        "mc": _achar_coluna(cols, "macro"),
        "fr": _achar_coluna(cols, "frente"),
        "ct": _achar_coluna(cols, "contratado total"),
        "ca": _achar_coluna(cols, "contratado acum"),
        "ra": _achar_coluna(cols, "real acum"),
        "pc": _achar_coluna(cols, "%"),
        "far": _achar_coluna(cols, "farol"),
    }
    frentes: list[dict] = []
    soma_tot = soma_acum = 0.0
    macro_atual = None
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        fr = str(r.get(c["fr"]) or "").strip()
        if not fr or fr.upper() == "TOTAL":
            continue
        mc = str(r.get(c["mc"]) or "").strip() if c["mc"] else ""
        if mc:  # macro vem só na 1ª linha do grupo em algumas planilhas → propaga (forward-fill)
            macro_atual = mc
        ct = _num_limpo(r.get(c["ct"])) if c["ct"] else None
        ca = _num_limpo(r.get(c["ca"])) if c["ca"] else None
        ra = _num_limpo(r.get(c["ra"])) if c["ra"] else None
        pc = _num_limpo(r.get(c["pc"])) if c["pc"] else None
        frentes.append({
            "ordem": len(frentes),
            "macro": (macro_atual or "")[:80] or None,
            "frente": fr[:120],
            "contratado_total": ct if isinstance(ct, float) else None,
            "contratado_acum": ca if isinstance(ca, float) else None,
            "real_acum": ra if isinstance(ra, float) else None,
            "pct": pc if isinstance(pc, float) else None,
            "farol": str(r.get(c["far"]) or "").strip()[:24] if c["far"] else None,
        })
        if isinstance(ct, float):
            soma_tot += ct
        if isinstance(ca, float):
            soma_acum += ca
    if not frentes:
        findings.append({"severity": "error", "campo": "frente_macro", "msg": "nenhuma frente nomeada"})
    real_alocado = any(isinstance(f["real_acum"], float) and f["real_acum"] > 0 for f in frentes)
    if not real_alocado:
        for f in frentes:
            f["real_acum"] = None
            f["pct"] = None
            f["farol"] = None
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"frentes": frentes, "soma_contratado_total": round(soma_tot, 2),
            "soma_contratado_acum": round(soma_acum, 2), "n_frentes": len(frentes),
            "real_pendente": not real_alocado, "status": status, "findings": findings}


# ── C.3 FATURAMENTO POR DISCIPLINA — resumo (drill "Por Disciplina" · COM real alocado + farol) ─────
# Seção template "C.3 — Faturamento por Disciplina" (15 disc finas: Mobilização, Desmobilização, …):
# Disciplina × Contratado Total/Acum × Real Acum × % × Farol. Distinta da coarse obra_faturamento_frentes
# (12, sem real) — ESTA tem o real alocado por disciplina (Mobilização 5,33M, Terraplenagem 1,02M…) que
# acende os faróis do drill. Lida por estrutura (coluna "Disciplina" + "Contratado Total"; sem "frente"
# nem "mês" → não colide com a por-frente nem com a matriz×mês). Σ Contratado Total = PV (gate reusado).
def extrair_faturamento_por_disciplina(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("faturamento" in t and "disciplina" in t and "frente" not in t and "mes" not in t
                and _achar_coluna(cols, "disciplina") is not None
                and _achar_coluna(cols, "contratado total", "contratado") is not None):
            sec = s
            break
    if sec is None:
        return {"disciplinas": [], "soma_contratado_total": None, "soma_contratado_acum": None,
                "n_disciplinas": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "disciplina",
                              "msg": "C.3 Por disciplina (resumo) não localizado"}]}
    cols = sec.get("colunas") or []
    c = {
        "di": _achar_coluna(cols, "disciplina"),
        "sv": _achar_coluna(cols, "serviço?", "servico?", "serviço"),
        "ct": _achar_coluna(cols, "contratado total"),
        "ca": _achar_coluna(cols, "contratado acum"),
        "ra": _achar_coluna(cols, "real acum"),
        "pc": _achar_coluna(cols, "%"),
        "far": _achar_coluna(cols, "farol"),
    }
    disc: list[dict] = []
    soma_tot = soma_acum = 0.0
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        di = str(r.get(c["di"]) or "").strip()
        if not di or di.upper() == "TOTAL":
            continue
        ct = _num_limpo(r.get(c["ct"])) if c["ct"] else None
        ca = _num_limpo(r.get(c["ca"])) if c["ca"] else None
        ra = _num_limpo(r.get(c["ra"])) if c["ra"] else None
        pc = _num_limpo(r.get(c["pc"])) if c["pc"] else None
        sv = str(r.get(c["sv"]) or "").strip().lower() if c["sv"] else ""
        disc.append({
            "ordem": len(disc), "disciplina": di[:80],
            "servico": sv.startswith("s") if sv else None,
            "contratado_total": ct if isinstance(ct, float) else None,
            "contratado_acum": ca if isinstance(ca, float) else None,
            "real_acum": ra if isinstance(ra, float) else None,
            "pct": pc if isinstance(pc, float) else None,
            "farol": str(r.get(c["far"]) or "").strip()[:24] if c["far"] else None,
        })
        if isinstance(ct, float):
            soma_tot += ct
        if isinstance(ca, float):
            soma_acum += ca
    if not disc:
        findings.append({"severity": "error", "campo": "disciplina", "msg": "nenhuma disciplina"})
    # PENDENTE ≠ ZERO: só NULLa o real se NENHUMA disciplina tem real>0 (aqui há → mantém os faróis).
    real_alocado = any(isinstance(d["real_acum"], float) and d["real_acum"] > 0 for d in disc)
    if not real_alocado:
        for d in disc:
            d["real_acum"] = None
            d["pct"] = None
            d["farol"] = None
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"disciplinas": disc, "soma_contratado_total": round(soma_tot, 2),
            "soma_contratado_acum": round(soma_acum, 2), "n_disciplinas": len(disc),
            "real_pendente": not real_alocado, "status": status, "findings": findings}


# ── C.3 SÉRIE MENSAL por DISCIPLINA/FRENTE (curva por item · Previsto + Real, mês a mês) ────────────
# As matrizes "Previsto por {dim} × Mês" + "Real por {dim} × Mês" (mesma granularidade: 15 disc / 17
# frentes) → série mensal {previsto, real} por item, p/ o select da Curva S filtrar a curva. Lê por
# ESTRUTURA (coluna do {dim} + colunas-mês ORDINAIS "1".."46"), genérico p/ qualquer obra. AQUI o real
# EXISTE mensal (a fonte traz "Real por {dim} × Mês") → diferente do disciplina_mes coarse (real=0).
# Σ previsto == PV · Σ real == real medido (gate na orquestração).
def extrair_faturamento_serie_mes(secoes: list[dict], dim: str,
                                  meses_curva: list[dict] | None = None) -> dict:
    findings: list[dict] = []

    def achar(tipo: str) -> dict | None:
        for s in secoes:
            if not isinstance(s, dict):
                continue
            t = _norm_key(s.get("titulo") or "")
            cols = s.get("colunas") or []
            if (tipo in t and dim in t and "deficit" not in t
                    and (tipo == "previsto" or "previsto" not in t)
                    and _achar_coluna(cols, dim) is not None
                    and any(re.match(r"^\d+$", str(c)) for c in cols)):
                return s
        return None

    sec_p = achar("previsto")
    if sec_p is None:
        # ── Variante BASELINE LONGO (SBSO auxiliar_C.3): atividades × Bloco(Contratado/Real) ×
        # Métrica('R$ Mês') × meses wide, com Disciplina/Frente/Folha por linha. Σ folhas == PV.
        sec_b = None
        for s2 in secoes:
            if not isinstance(s2, dict) or not s2.get("linhas"):
                continue
            cols2 = s2.get("colunas") or []
            if (_achar_coluna(cols2, "bloco") is not None and _achar_coluna(cols2, "metrica", "métrica") is not None
                    and _achar_coluna(cols2, "folha") is not None and _achar_coluna(cols2, dim) is not None):
                sec_b = s2
                break
        if sec_b is not None:
            cols2 = sec_b.get("colunas") or []
            cDim = _achar_coluna(cols2, dim)
            cBlo = _achar_coluna(cols2, "bloco")
            cMet = _achar_coluna(cols2, "metrica", "métrica")
            cFol = _achar_coluna(cols2, "folha")
            mes_cols = [(int(re.sub(r"\D", "", str(c))), c) for c in cols2
                        if re.match(r"^m[eê]s\s*\d+$", str(c).strip().lower())]
            mes_cols.sort()
            comp2 = {i + 1: (m.get("ano"), m.get("mes")) for i, m in enumerate(meses_curva)} if meses_curva else {}
            acc: dict[tuple[str, int], dict] = {}
            for r in (sec_b.get("linhas") or []):
                if not isinstance(r, dict):
                    continue
                if str(r.get(cFol) or "").strip().upper() != "S":
                    continue
                if str(r.get(cMet) or "").strip().lower() not in ("r$ mês", "r$ mes"):
                    continue
                bloco2 = _norm_key(str(r.get(cBlo) or ""))
                if bloco2 not in ("contratado", "real"):
                    continue
                item2 = str(r.get(cDim) or "").strip() or "—"
                for n_mes, colname in mes_cols:
                    v2 = _num_limpo(r.get(colname))
                    if not isinstance(v2, float) or v2 == 0:
                        continue
                    ch = (item2, n_mes)
                    if ch not in acc:
                        a2, m2 = comp2.get(n_mes, (None, None))
                        acc[ch] = {"item": item2, "mes_num": n_mes, "ano": a2, "mes": m2,
                                   "previsto_rs": None, "real_rs": None}
                    campo2 = "previsto_rs" if bloco2 == "contratado" else "real_rs"
                    acc[ch][campo2] = round((acc[ch][campo2] or 0.0) + v2, 2)
            if acc:
                linhas2 = [{"ordem": i, **v} for i, v in enumerate(
                    sorted(acc.values(), key=lambda x: (x["item"], x["mes_num"])))]
                soma_p2 = round(sum(x["previsto_rs"] or 0 for x in linhas2), 2)
                soma_r2 = round(sum(x["real_rs"] or 0 for x in linhas2), 2)
                itens2 = {x["item"] for x in linhas2}
                meses2 = {x["mes_num"] for x in linhas2}
                return {"linhas": linhas2, "soma_previsto": soma_p2, "soma_real": soma_r2,
                        "n_itens": len(itens2), "n_meses": len(meses2), "dim": dim,
                        "real_pendente": soma_r2 == 0, "status": "ok", "findings": findings}
        return {"linhas": [], "soma_previsto": None, "soma_real": None, "n_itens": 0, "n_meses": 0,
                "dim": dim, "real_pendente": True, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "matriz",
                              "msg": f"Matriz {dim}×mês (Previsto) não localizada"}]}
    sec_r = achar("real")
    comp = {i + 1: (m.get("ano"), m.get("mes")) for i, m in enumerate(meses_curva)} if meses_curva else {}

    def ler(sec: dict | None) -> dict:
        out: dict = {}
        if sec is None:
            return out
        cols = sec.get("colunas") or []
        dc = _achar_coluna(cols, dim)
        for r in (sec.get("linhas") or []):
            if not isinstance(r, dict) or eh_linha_rotulo(r):
                continue
            it = str(r.get(dc) or "").strip()
            if not it or it.upper() == "TOTAL":
                continue
            for c in cols:
                if c != dc and re.match(r"^\d+$", str(c)):
                    v = _num_limpo(r.get(c))
                    if isinstance(v, float):
                        out[(it, int(c))] = v
        return out

    prev = ler(sec_p)
    real = ler(sec_r)
    cols_p = sec_p.get("colunas") or []
    dc_p = _achar_coluna(cols_p, dim)
    cols_mes = sorted((int(c) for c in cols_p if c != dc_p and re.match(r"^\d+$", str(c))))
    # ordem dos itens preservada da matriz Previsto
    itens: list[str] = []
    for r in (sec_p.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        it = str(r.get(dc_p) or "").strip()
        if it and it.upper() != "TOTAL" and it not in itens:
            itens.append(it)
    linhas: list[dict] = []
    soma_p = soma_r = 0.0
    for it in itens:
        for mes_num in cols_mes:
            p = prev.get((it, mes_num))
            rv = real.get((it, mes_num))
            ano, mes = comp.get(mes_num, (None, None))
            linhas.append({"ordem": len(linhas), "dimensao": dim, "item": it[:120],
                           "mes_num": mes_num, "ano": ano, "mes": mes,
                           "previsto_rs": p, "real_rs": rv})
            if isinstance(p, float):
                soma_p += p
            if isinstance(rv, float):
                soma_r += rv
    if not linhas:
        findings.append({"severity": "error", "campo": "matriz", "msg": f"nenhuma célula {dim}×mês"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"linhas": linhas, "soma_previsto": round(soma_p, 2), "soma_real": round(soma_r, 2),
            "n_itens": len(itens), "n_meses": len(cols_mes), "dim": dim,
            "real_pendente": soma_r <= 0, "status": status, "findings": findings}


# ── C.3 FATURAMENTO POR FRENTE × TRECHO (drill-down · caderno SaaS A171:I242) ──────────────────────
# Matriz Frente→Trecho: Contratado + Previsto acum + Real(input) + Déficit + Aderência + Farol. O
# Real é INPUT não medido → Real/Déficit/Aderência ficam NULL (pendente) e o farol fica em estado
# "a medir" (real_pendente=True) — no drill-down operacional a tela pinta vermelho "a medir"
# (decisão híbrida do usuário), nunca um "Crítico" definitivo fabricado sobre dado faltante. Quando
# o Real for medido, Déficit/Aderência/Farol se calculam. Gate: Σ Contratado ≈ PV.
def extrair_faturamento_frente_trecho(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("faturamento" in t and "frente" in t and "trecho" in t
                and _achar_coluna(cols, "frente") is not None
                and _achar_coluna(cols, "trecho") is not None):
            sec = s
            break
    if sec is None:
        return {"linhas": [], "soma_contratado": None, "n_linhas": 0, "n_frentes": 0,
                "real_pendente": True, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "frente_trecho", "msg": "C.3 Frente×Trecho não localizado"}]}
    cols = sec.get("colunas") or []
    c = {
        "fr": _achar_coluna(cols, "frente"),
        "tr": _achar_coluna(cols, "trecho"),
        "sh": _achar_coluna(cols, "share"),
        "ct": _achar_coluna(cols, "contratado"),
        "pa": _achar_coluna(cols, "previsto acum", "previsto"),
        "ra": _achar_coluna(cols, "real acum", "real"),
        "df": _achar_coluna(cols, "déficit", "deficit"),
        "ad": _achar_coluna(cols, "aderência", "aderencia"),
        "far": _achar_coluna(cols, "farol"),
    }
    linhas: list[dict] = []
    soma = 0.0
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        fr = str(r.get(c["fr"]) or "").strip()
        tr = str(r.get(c["tr"]) or "").strip()
        if not fr or not tr or fr.upper() == "TOTAL" or tr.upper() == "TOTAL":
            continue
        ct = _num_limpo(r.get(c["ct"])) if c["ct"] else None
        pa = _num_limpo(r.get(c["pa"])) if c["pa"] else None
        ra = _num_limpo(r.get(c["ra"])) if c["ra"] else None
        sh = _num_limpo(r.get(c["sh"])) if c["sh"] else None
        linhas.append({
            "ordem": len(linhas), "frente": fr[:80], "trecho": tr[:80],
            "share_pct": sh if isinstance(sh, float) else None,
            "contratado_rs": ct if isinstance(ct, float) else None,
            "previsto_acum_rs": pa if isinstance(pa, float) else None,
            "real_acum_rs": ra if isinstance(ra, float) and ra > 0 else None,
        })
        if isinstance(ct, float):
            soma += ct
    # PENDENTE ≠ ZERO: Déficit/Aderência/Farol derivam do Real. Real medido → calcula; senão NULL +
    # real_pendente (a tela mostra "a medir" vermelho no drill-down).
    for ln in linhas:
        real, prev = ln["real_acum_rs"], ln["previsto_acum_rs"]
        if real is not None and prev:
            ln["deficit_rs"] = round(real - prev, 2)
            ln["aderencia"] = round(real / prev, 4) if prev else None
            ad = ln["aderencia"]
            ln["farol"] = ("conforme" if ad is not None and ad >= 0.85
                           else "observacao" if ad is not None and ad >= 0.70
                           else "critico")
            ln["real_pendente"] = False
        else:
            ln["deficit_rs"] = None
            ln["aderencia"] = None
            ln["farol"] = None  # front renderiza "a medir" via real_pendente
            ln["real_pendente"] = True
    if not linhas:
        findings.append({"severity": "error", "campo": "frente_trecho", "msg": "nenhuma linha frente×trecho"})
    n_fr = len({ln["frente"] for ln in linhas})
    real_pendente = not any(not ln["real_pendente"] for ln in linhas)
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"linhas": linhas, "soma_contratado": round(soma, 2), "n_linhas": len(linhas),
            "n_frentes": n_fr, "real_pendente": real_pendente, "status": status, "findings": findings}


# ── C.3 FATURAMENTO · MATRIZ DISCIPLINA × MÊS (caderno SaaS A114:L157) ─────────────────────────────
# A explosão 2D da curva financeira: PREVISTO mensal por disciplina (12 disc × 46 meses). O REAL é
# input do RDO/medição e NÃO vem isolado na fonte (só existe a matriz Déficit = Real−Previsto, que com
# Real=0 é apenas −Previsto FABRICADO) → real_rs/deficit_rs ficam NULL (pendente), nunca 0. Os headers
# de mês são ORDINAIS "1".."46" (não datas) — por isso a seção não casa o resolver de série; matching
# manual por título+estrutura (espelha extrair_faturamento_frentes). A competência (ano,mes) por
# ordinal vem da curva C.3 (`meses_curva`); sem ela, fica None (honesto, não inventa data).
# Gate: Σ matriz ≈ PV (== Σ da curva) + cross-check Σ-por-mês == curva mensal contratada.
def extrair_faturamento_disciplina_mes(secoes: list[dict], meses_curva: list[dict] | None = None) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        # PREVISTO por frente, mês a mês — distingue do Déficit ("deficit" no título + colunas-DATA) e
        # do resumo ("resumo"): exige previsto+mesames+frente E colunas-mês ORDINAIS "1".."46".
        if ("faturamento" in t and "previsto" in t and "mesames" in t and "deficit" not in t
                and _achar_coluna(cols, "frente") is not None
                and any(re.match(r"^\d+$", str(c)) for c in cols)):
            sec = s
            break
    if sec is None:
        return {"linhas": [], "soma_previsto": None, "soma_por_mes": {}, "n_linhas": 0,
                "n_disciplinas": 0, "real_pendente": True, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "matriz",
                              "msg": "C.3 Matriz disciplina×mês (Previsto) não localizada"}]}
    cols = sec.get("colunas") or []
    c_disc = _achar_coluna(cols, "frente")
    cols_mes = sorted(
        (c for c in cols if c != c_disc and re.match(r"^\d+$", str(c))), key=lambda x: int(x)
    )
    if not cols_mes:
        findings.append({"severity": "error", "campo": "meses", "msg": "nenhuma coluna-mês ordinal na matriz"})
    # competência (ano,mes) por ordinal: mes_num 1-based → meses_curva[mes_num-1]
    comp = {i + 1: (m.get("ano"), m.get("mes")) for i, m in enumerate(meses_curva)} if meses_curva else {}
    linhas: list[dict] = []
    soma = 0.0
    soma_por_mes: dict = {}
    disciplinas: set = set()
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        disc = str(r.get(c_disc) or "").strip()
        if not disc or disc.upper() == "TOTAL":
            continue
        disciplinas.add(disc)
        for c in cols_mes:
            mes_num = int(c)
            prev = _num_limpo(r.get(c))
            prev = prev if isinstance(prev, float) else None
            ano, mes = comp.get(mes_num, (None, None))
            linhas.append({
                "ordem": len(linhas), "disciplina": disc[:80], "mes_num": mes_num,
                "ano": ano, "mes": mes, "periodo_label": None,
                # PENDENTE ≠ ZERO: real/déficit do RDO não existem na fonte → NULL (nunca 0 fabricado).
                "previsto_rs": prev, "real_rs": None, "deficit_rs": None,
            })
            if prev is not None:
                soma += prev
                k = (ano, mes)
                soma_por_mes[k] = round(soma_por_mes.get(k, 0.0) + prev, 2)
    if not linhas:
        findings.append({"severity": "error", "campo": "matriz", "msg": "nenhuma célula disciplina×mês"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"linhas": linhas, "soma_previsto": round(soma, 2), "soma_por_mes": soma_por_mes,
            "n_linhas": len(linhas), "n_disciplinas": len(disciplinas),
            "real_pendente": True, "status": status, "findings": findings}


# ── C.5 PRAZO · MATRIZ FÍSICA POR FRENTE/DISCIPLINA × MÊS (caderno A140:AW151 · seletor por frente) ─
# % físico PREVISTO acumulado por disciplina (12 × 46 meses). Aqui "frente" = disciplina/serviço
# (vocabulário do Prazo, ≠ "frente"=local do Faturamento). Headers "M01".."M46". O % REAL é input do
# RDO → NULL (pendente, nunca 0). Armazenado como FRAÇÃO (0..~1,0) p/ casar a curva física global e o
# snapshot. Gate TIGHT: matriz[coluna-de-corte] == snapshot "Atraso físico por disciplina (% até BM)"
# por disciplina (exato · mesma fonte em 2 representações) + % acumulado monotônico não-decrescente.
def extrair_cronograma_frente_mes(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        # "Matriz % físico previsto por DISCIPLINA × mês" (≠ a por TRECHO); headers "M01".."M46".
        if ("matriz" in t and "fisico" in t and "disciplina" in t and "trecho" not in t
                and any(re.match(r"^M\d+$", str(c)) for c in cols)):
            sec = s
            break
    if sec is None:
        return {"linhas": [], "n_disciplinas": 0, "real_pendente": True, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "matriz",
                              "msg": "C.5 Matriz física disciplina×mês não localizada"}]}
    cols = sec.get("colunas") or []
    c_disc = cols[0]
    cols_mes = sorted((c for c in cols if re.match(r"^M\d+$", str(c))), key=lambda x: int(str(x)[1:]))
    if not cols_mes:
        findings.append({"severity": "error", "campo": "meses", "msg": "nenhuma coluna-mês M01..MNN"})
    linhas: list[dict] = []
    disciplinas: set = set()
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        disc = str(r.get(c_disc) or "").strip()
        if not disc or disc.upper() == "TOTAL":
            continue
        disciplinas.add(disc)
        for c in cols_mes:
            v = _num_limpo(r.get(c))
            if v == "ERRO_REF":  # #REF!/#DIV → falha-alto (não vira NULL silencioso · igual aos irmãos)
                findings.append({"severity": "error", "campo": "ref",
                                 "msg": f"{disc[:20]} {c}: erro de referência na célula (#REF!/#DIV)"})
            # % → FRAÇÃO (5,04 → 0,0504); real é pendente (NULL).
            prev = round(v / 100.0, 6) if isinstance(v, float) else None
            linhas.append({
                "ordem": len(linhas), "disciplina": disc[:80], "mes_num": int(str(c)[1:]),
                "previsto_pct": prev, "real_pct": None,
            })
    if not linhas:
        findings.append({"severity": "error", "campo": "matriz", "msg": "nenhuma célula disciplina×mês"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"linhas": linhas, "n_disciplinas": len(disciplinas),
            "real_pendente": True, "status": status, "findings": findings}


# Snapshot "Atraso físico por disciplina (% previsto até BM)" → {disciplina: fração até o corte}.
# Âncora do gate da matriz física (a coluna de corte da matriz tem que bater com este snapshot).
def snapshot_fisico_por_disciplina(secoes: list[dict]) -> dict:
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if "atraso" in t and "fisico" in t and "disciplina" in t:
            cols = s.get("colunas") or []
            if not cols:
                return {}
            c_disc, c_prev = cols[0], _achar_coluna(cols, "previsto")
            if c_prev is None:
                return {}
            out: dict = {}
            for r in (s.get("linhas") or []):
                if not isinstance(r, dict) or eh_linha_rotulo(r):
                    continue
                d = str(r.get(c_disc) or "").strip()
                v = _num_limpo(r.get(c_prev))
                if d and d.upper() != "TOTAL" and isinstance(v, float):
                    out[d] = v  # já em fração (0,0504)
            return out
    return {}


# ── C.14 MAPA DA OBRA · AVANÇO FÍSICO-FINANCEIRO CONTRATADO POR DISCIPLINA × MÊS ───────────────────
# A matriz C.14 L200-222 é a baseline CONTRATADA físico-financeira (curva-S) das disciplinas FÍSICAS de
# obra, em PREÇO de venda (com BDI/markup). PROVADO ao centavo: Σ físicas = 367.256.923 = porção física
# do PV (611M); as rubricas NÃO-físicas (Adm Local + Insumos Fat.Direto + Mob/Desmob + Outros = 243M)
# completam o PV. Lemos a FONTE ROTULADA `auxiliar_C.14 Crono` (Cód|Descrição|Disciplina|Valor(R$)|mar-26…
# dez-29): cada item tem Disciplina + Valor + perfil %mês EXPLÍCITOS → matriz = Valor(R$) × %mês ÷ 100,
# agrupado por Disciplina (reconstrução verificada 0,000% drift contra a matriz cached da C.14). PREVISTO
# não REAL (cobre o horizonte até dez-29 com BM corrente=3); REAL/ADERÊNCIA = input do RDO → NULL
# (pendente, NUNCA 0). Acumulado RECOMPOSTO (cumsum) pelo resolver. Conservação: Σtotal == PV (gate).
_NAO_FISICO_FRAGS = ("administ", "mobiliz", "desmobiliz", "canteiro")  # denylist FALLBACK (token no-space)
_MESES_ABREV = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
                "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}


def _disc_fisica(disc: str) -> bool:
    """FALLBACK — usado SÓ quando a matriz cached C.14 não foi capturada (e aí o gate ESCALA p/
    needs_review, então a imprecisão é flagrada, não persistida verde). Disciplina física = NÃO é
    rubrica não-física. 'outros'/'insumo' são ambíguos por substring ('Insumos de Pavimentação' É
    físico) → tratados como token isolado / rubrica de fornecimento PURA."""
    import re
    d = _norm_key(disc)
    if any(f in d for f in _NAO_FISICO_FRAGS):
        return False
    toks = re.findall(r"[a-zà-ú]+", (disc or "").lower())
    if "outros" in toks and len(toks) <= 3:                 # 'Outros' / 'Demais e Outros' isolado
        return False
    if d.startswith("insumo") and ("fatdireto" in d or "faturamentodireto" in d or d == "insumos"):
        return False                                        # fornecimento puro (≠ 'insumos de <serviço>')
    return True


def _coluna_mes(header) -> tuple | None:  # noqa: ANN001
    """Chave de ordenação de coluna-mês; None se não-mês. Aceita: 'mar-26'/'mar_26'/'março/26' (abbr/4-letra
    + ano), 'YYYY-MM'/'MM-YYYY'/'YYYY/MM'/ISO 'YYYY-MM-DD', 'Mês 3'/'mes_03'/'M3'/'1º mês', ordinal '3'
    (1..60). Datas ordenam por (ano,mês); ordinais por N. Não casa Cód/Descrição/Disciplina/Valor."""
    import re
    s = str(header).strip().lower()
    m = re.match(r"^([a-zçã]{3,5})[-/._ ](\d{2,4})$", s)                # mar-26 · março/2026 · marco_26
    if m:
        mk = m.group(1)[:3].replace("ç", "c").replace("ã", "a")
        if mk in _MESES_ABREV:
            ano = int(m.group(2)); ano = 2000 + ano if ano < 100 else ano
            return (1, ano, _MESES_ABREV[mk])
    m = re.match(r"^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$", s)          # 2026-03 · 2026/03 · 2026-03-01
    if m and 1 <= int(m.group(2)) <= 12:
        return (1, int(m.group(1)), int(m.group(2)))
    m = re.match(r"^(\d{1,2})[-/](\d{4})$", s)                         # 03-2026
    if m and 1 <= int(m.group(1)) <= 12:
        return (1, int(m.group(2)), int(m.group(1)))
    m = (re.match(r"^m[êe]s[\s_]*(\d{1,2})$", s) or re.match(r"^m(\d{1,2})$", s)
         or re.match(r"^(\d{1,2})[ºo]?\s*m[êe]s$", s))                  # Mês 3 · mes_03 · M3 · 1º mês
    if m:
        n = int(m.group(1))
        return (0, 0, n) if 1 <= n <= 60 else None
    if re.fullmatch(r"\d{1,2}", s) and 1 <= int(s) <= 60:              # ordinal solto (bounded)
        return (0, 0, int(s))
    return None


def _set_disc_cached_c14(secoes: list[dict]) -> tuple:  # noqa: ANN001
    """Disciplinas (norm) da matriz CACHED da C.14 (auto-ingerida pelo backstop · físico OFICIAL) + Σ do
    corte MENSAL (âncora). 1ª coluna = disciplina, resto = R$ (o rename da Fase 2a não muda valores). Pega
    o corte de MENOR total (mensal < acumulado/cumsum). (None, None) se não capturada → fallback denylist."""
    cands = []
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        # matriz CACHED da C.14 (disciplina × mês, R$). Pode vir do BACKSTOP ('não-rotulado') OU do
        # MODELO com título próprio (v45: 'C.14 — Execução por serviço · valores mensais/acumulado'). O
        # corte MENSAL é pego por menor-Σ (o acumulado é cumsum). [gap v45: o modelo capturou e o match
        # antigo só via o backstop → fisico_anchor sumia → farol caía em needs_review à toa].
        if ("c14" in t and len(cols) >= 3
                and ("naorotulado" in t or "execucao" in t or "valoresmensa" in t or "valoresacum" in t)):
            disc_col = cols[0]
            # 1ª coluna tem que ser DISCIPLINA, não meses: exclui o BLOCO 2 (mês×segmento, cols[0]=meses)
            # que casaria o título mas não é a matriz física por disciplina.
            amostra = [str(r.get(disc_col) or "") for r in (s.get("linhas") or [])[:6] if str(r.get(disc_col) or "").strip()]
            if not amostra or sum(1 for v in amostra if _coluna_mes(v) is not None) > len(amostra) / 2:
                continue
            discs, tot = set(), 0.0
            for r in (s.get("linhas") or []):
                dn = _norm_key(str(r.get(disc_col) or ""))
                if dn:
                    discs.add(dn)
                for c in cols[1:]:
                    v = r.get(c)
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        tot += v
            if discs and tot > 0:
                cands.append((discs, round(tot, 2)))
    if not cands:
        return None, None
    return min(cands, key=lambda x: x[1])  # corte mensal = menor Σ (acumulado é cumsum)


def extrair_avanco_fisico_disciplina_mes(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    # ── seleção: MELHOR candidata (não a 1ª) — auxiliar_C.14 Crono com Disciplina + Valor + colunas-mês.
    cands = []
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if (("auxiliarc14" in t or ("c14" in t and "crono" in t))
                and _achar_coluna(cols, "disciplina") is not None
                and any(_norm_key(c).startswith("valor") for c in cols)):
            nmes = sum(1 for c in cols if _coluna_mes(c) is not None)
            cands.append((nmes, len(s.get("linhas") or []), s))
    if not cands:
        return {"linhas": [], "soma_fisico": None, "soma_total": None, "soma_valor_bruto": None,
                "soma_fisico_cached": None, "soma_por_mes": {}, "n_disciplinas_fisicas": 0,
                "disciplinas": [], "real_pendente": True, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "fonte",
                    "msg": "auxiliar_C.14 Crono (físico-financeiro por disciplina) não localizada"}]}
    cands.sort(key=lambda x: (-x[0], -x[1]))
    if len(cands) > 1:
        findings.append({"severity": "warn", "campo": "fonte",
                         "msg": f"{len(cands)} candidatas auxiliar_C.14 — usei a com mais colunas-mês/linhas"})
    sec = cands[0][2]
    cols = sec.get("colunas") or []
    c_disc = _achar_coluna(cols, "disciplina")
    mes_cols = [c for c in cols if _coluna_mes(c) is not None]
    mes_cols.sort(key=lambda c: _coluna_mes(c))
    if not mes_cols:
        findings.append({"severity": "error", "campo": "meses", "msg": "nenhuma coluna-mês na fonte"})
    # coluna VALOR EXATA (evita colisão com 'Valor Agregado (%)'/'Valor previsto'): startswith 'valor',
    # não é mês, e sem token de %/derivada. >1 ou 0 candidata → falha-alto (não conservável).
    val_cands = [c for c in cols if _coluna_mes(c) is None and _norm_key(c).startswith("valor")
                 and not any(b in _norm_key(c) for b in ("agregado", "previsto", "percent", "pct", "acum"))]
    if len(val_cands) != 1:
        findings.append({"severity": "error", "campo": "valor",
                         "msg": f"coluna Valor ambígua/ausente ({len(val_cands)} candidatas) — não conservável"})
    c_val = val_cands[0] if val_cands else _achar_coluna(cols, "valor")
    # INSTRUMENTA PERDA (posicional): coluna numérica com dado, NA REGIÃO DOS MESES (índice > 1º mês), que
    # NÃO é mês reconhecido → mês de formato não-suportado = curva parcialmente perdida (silenciosa antes).
    # Metadata antes dos meses (Cód/Desc/Disc/Valor/Quantidade) é ignorada.
    if mes_cols:
        idx = {c: i for i, c in enumerate(cols)}
        mes_idx = [idx[c] for c in mes_cols if c in idx]
        primeiro_mes, ultimo_mes = min(mes_idx), max(mes_idx)
        for c in cols:
            # SÓ entre o 1º e o último mês (mês não-reconhecido INTERLEAVADO = curva perdida). Colunas
            # ANTES (metadata) e DEPOIS (trailing: 'Real medido acum', totais) NÃO são mês perdido.
            if not (primeiro_mes < idx.get(c, -1) < ultimo_mes) or _coluna_mes(c) is not None or c in (c_disc, c_val):
                continue
            if any(isinstance(r.get(c), (int, float)) and not isinstance(r.get(c), bool) and r.get(c) != 0
                   for r in (sec.get("linhas") or [])):
                findings.append({"severity": "error", "campo": "meses",
                                 "msg": f"coluna numérica '{str(c)[:20]}' interleavada nos meses não reconhecida — curva perdida"})
                break

    # ESCALA do perfil %mês: percent (0-100) vs fração (0-1) pela magnitude máxima (uma matriz, uma convenção).
    mx = 0.0
    for r in (sec.get("linhas") or []):
        for c in mes_cols:
            v = _num_limpo(r.get(c))
            if isinstance(v, float) and abs(v) > mx:
                mx = abs(v)
    escala = 100.0 if mx > 1.5 else 1.0

    # FÍSICO por MEMBERSHIP na matriz cached C.14 (oficial · 367M); denylist só como FALLBACK.
    fis_set, soma_fisico_cached = _set_disc_cached_c14(secoes)

    def _eh_fisico(disc: str) -> bool:
        return (_norm_key(disc) in fis_set) if fis_set is not None else _disc_fisica(disc)

    por_disc_mes: dict = {}
    soma_valor_bruto = 0.0
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        disc = str(r.get(c_disc) or "").strip()
        if not disc or disc.upper().startswith("TOTAL"):
            continue
        val = _num_limpo(r.get(c_val))
        if val == "ERRO_REF":
            findings.append({"severity": "error", "campo": "valor", "msg": f"#REF em '{disc[:30]}'"})
            continue
        if not isinstance(val, float):
            continue
        soma_valor_bruto += val
        d = por_disc_mes.setdefault(disc, {})
        for k, mc in enumerate(mes_cols):
            pct = _num_limpo(r.get(mc))
            if not isinstance(pct, float) or pct == 0.0:
                continue
            d[k + 1] = d.get(k + 1, 0.0) + val * pct / escala

    linhas: list[dict] = []
    soma_fisico = soma_total = 0.0
    soma_por_mes: dict = {}
    fisicas: list[str] = []
    for disc in sorted(por_disc_mes, key=lambda x: -sum(por_disc_mes[x].values())):
        fis = _eh_fisico(disc)
        if fis:
            fisicas.append(disc)
        acum = 0.0
        for k in range(len(mes_cols)):
            mes_num = k + 1
            rs = round(por_disc_mes[disc].get(mes_num, 0.0), 2)
            acum = round(acum + rs, 2)
            linhas.append({
                "ordem": len(linhas), "disciplina": disc[:80], "fisico": fis, "mes_num": mes_num,
                "contratado_rs": rs, "contratado_acum_rs": acum,
                # PENDENTE ≠ ZERO: real/aderência são input do RDO → NULL, nunca 0 fabricado.
                "real_rs": None, "aderencia_pct": None,
            })
            soma_total += rs
            if fis:
                soma_fisico += rs
                soma_por_mes[mes_num] = round(soma_por_mes.get(mes_num, 0.0) + rs, 2)
    if not linhas:
        findings.append({"severity": "error", "campo": "matriz", "msg": "nenhuma célula disciplina×mês"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"linhas": linhas, "soma_fisico": round(soma_fisico, 2), "soma_total": round(soma_total, 2),
            "soma_valor_bruto": round(soma_valor_bruto, 2), "soma_fisico_cached": soma_fisico_cached,
            "soma_por_mes": soma_por_mes, "n_disciplinas_fisicas": len(fisicas),
            "disciplinas": list(por_disc_mes.keys()), "real_pendente": True,
            "status": status, "findings": findings}


# ── CAPTURA GENÉRICA — rede de completude: TODA seção com dado vai pro banco (obra_secoes) ──────────
# Garante que o motor não DROPA nada: cada seção (tabela/chave_valor) é armazenada com estrutura
# preservada (colunas + linhas/KV em JSONB), código/módulo parseados, flag `coberta` (tem resolver
# específico?) e `tem_dado`. Os resolvers específicos (cross-checked) continuam por cima — esta é a
# malha de segurança + auditoria de cobertura.

# fragmentos das seções com resolver ESPECÍFICO (título contém TODOS os fragmentos do grupo)
_COBERTAS_FRAGS: tuple[tuple[str, ...], ...] = (
    ("insumos", "curva abc"), ("recursos", "histograma"), ("recursos", "recurso a recurso"),
    ("recursos", "resumo por grupo"), ("recursos", "maiores desvios"),
    ("faturamento", "curva mensal"), ("faturamento", "por frente"),
    ("prazo", "curva física"), ("produtividade", "mês a mês"), ("bdi detalhe", "rubricas"),
    ("bdi detalhe", "decomposição"), ("painel desequilíbrio",), ("indiretos", "métodos"),
    ("indiretos", "base"), ("aderência das curvas", "curvas acum"),
    ("aderência das curvas", "matriz por fr"), ("chuvas", "acompanhamento"),
    ("chuvas", "resumo liber"), ("panorama",), ("condutas", "catálogo"),
    # rotas plugadas em jun/2026 (5 verticais que antes só existiam via backfill local)
    ("faturamento", "previsto por frente"), ("faturamento", "déficit"),
    ("matriz % físico", "disciplina"), ("mapa da obra", "segmentos"),
    ("mapa da obra", "bloco 2"), ("excedente por insumo relevante",),
    ("insumos", "consolidação"), ("prazo", "marcos"), ("cpu", "coeficientes"),
    ("síntese", "trechos × valor"),
    # C.14 avanço físico-financeiro por disciplina (Fase 2b · fonte rotulada auxiliar_C.14 Crono)
    ("auxiliar_c.14", "cronograma"),
)
# Folhas-META (navegação/documentação do workbook, não dado de obra). Casam por PREFIXO do título
# — as folhas-meta se CHAMAM assim ("MAPA — Telas…", "INSTRUÇÕES — Guia da IA…"). Substring solto
# reprovava seções REAIS que têm a palavra no meio após um código ("C.14 Mapa da Obra", "D.9 Mapa
# de Riscos", "C.9 …Índices de chuva") → data-loss. Seção real começa com código (C.14/D.9/…).
_META_PREFIXOS = ("mapa ", "mapa—", "mapa —", "índice", "indice", "instruções", "instrucoes",
                  "guia da ia", "guia ", "dicionário", "dicionario")
_CODIGO_RE = re.compile(r"^\s*(auxiliar_)?[A-Z]\.\d")  # C.14, D.9, aux_C.3 → seção real, nunca meta


def _eh_meta(titulo: str) -> bool:
    """META só se o título COMEÇA com palavra-chave de folha-meta E não é uma seção codificada."""
    tl = (titulo or "").strip().lower()
    if _CODIGO_RE.match(titulo or ""):
        return False
    return any(tl.startswith(p) for p in _META_PREFIXOS)


def _secao_coberta(titulo: str) -> bool:
    tl = (titulo or "").lower()
    return any(all(f in tl for f in frags) for frags in _COBERTAS_FRAGS)


def _secao_codigo_modulo(titulo: str) -> tuple[str | None, str]:
    """Parseia código (C.5, D.4, B.1, F.3, E.2, H, A, auxiliar_C.x) + módulo do título."""
    import re
    m = re.match(r"\s*(auxiliar_)?([A-Z])\.?(\d+)?", titulo or "")
    if not m:
        return None, "outro"
    letra = m.group(2)
    cod = f"{'aux_' if m.group(1) else ''}{letra}{('.' + m.group(3)) if m.group(3) else ''}"
    mod = {"C": "M2", "D": "M3", "B": "M1", "F": "M5", "E": "M4", "H": "Dashboard", "A": "Catálogo"}.get(letra, "outro")
    return cod[:24], mod


def capturar_secoes(secoes: list[dict]) -> list[dict]:
    """Captura TODA seção tabela/chave_valor com dado real → registros p/ obra_secoes. Pula META
    (Guia/MAPA/Índice/instruções) — não é dado de obra."""
    out: list[dict] = []
    for s in secoes:
        if not isinstance(s, dict):
            continue
        titulo = s.get("titulo") or ""
        if not titulo or _eh_meta(titulo):
            continue
        tipo = s.get("tipo") or ("chave_valor" if s.get("dados") else "tabela")
        # col_N NÃO é dropado: coluna sem CABEÇALHO ≠ coluna vazia (o filtro por-valor abaixo já
        # remove padding). Caso real: a col_1 da "C.5 — Detalhe Prazos" é o código WBS (1.1.1) —
        # dropá-la furava a promessa "nada dropado" e quebrava o Gantt do Timeline (SBSO).
        cols = list(s.get("colunas") or [])
        linhas = [
            {k: v for k, v in r.items() if v not in (None, "")}
            for r in (s.get("linhas") or []) if isinstance(r, dict) and not eh_linha_rotulo(r)
        ]
        linhas = [r for r in linhas if r]  # descarta linhas vazias
        kv = s.get("dados") if isinstance(s.get("dados"), dict) else None
        conteudo = s.get("conteudo") if isinstance(s.get("conteudo"), str) else None
        tem_dado = bool(linhas) or bool(kv) or bool(conteudo and conteudo.strip())
        if not tem_dado:
            continue
        cod, mod = _secao_codigo_modulo(titulo)
        # NARRATIVA (Leitura IA / nota metodológica / critérios): sem linhas nem kv, mas com texto.
        # Sem reter o `conteudo`, 26 dessas somem no v45 — furava a promessa "nada dropado em silêncio".
        # Capturada como tipo=texto; custo ZERO p/ correção numérica, ganho de auditoria/chat-RAG.
        if not linhas and not kv and conteudo:
            out.append({
                "ordem": len(out), "codigo": cod, "modulo": mod, "titulo": titulo[:300],
                "tipo": "texto", "colunas": [], "dados": {"conteudo": conteudo[:8000]},
                "n_linhas": 0, "tem_dado": True, "coberta": _secao_coberta(titulo),
            })
            continue
        out.append({
            "ordem": len(out), "codigo": cod, "modulo": mod, "titulo": titulo[:300],
            "tipo": tipo, "colunas": cols, "dados": (kv if kv else linhas),
            "n_linhas": len(linhas) if linhas else 0,
            "tem_dado": tem_dado, "coberta": _secao_coberta(titulo),
        })
    return out


# ── CPU COEFICIENTES — Composição de Preço Unitário (base de custo de TUDO · 558 CPUs) ─────────────
# Cada CPU decompõe o preço unitário de um serviço em %MOD + %EQP + %Mat/Transp. Cross-check FORTE:
# por CPU, %MOD + %EQP + %Mat ≈ 1 (100% do custo). Base do orçamento, da produtividade (R$/HH) e do
# desequilíbrio (re-precificação). 558 linhas.
def extrair_cpu_coeficientes(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("cpu" in t and "coeficien" in t
                and _achar_coluna(cols, "código cpu", "codigo cpu") is not None):
            sec = s
            break
    if sec is None:
        return {"cpus": [], "n_cpus": 0, "n_consistente": 0, "n_com_cd": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "cpu", "msg": "CPU Coeficientes não localizado"}]}
    cols = sec.get("colunas") or []
    c = {k: _achar_coluna(cols, *ns) for k, ns in {
        "cod": ("código cpu", "codigo cpu"), "srv": ("serviço", "servico"), "un": ("unid",),
        "tp": ("tipo",), "cd": ("custo direto unit", "custo direto"),
        "mod": ("mod r$/un", "mod r"), "eqp": ("eqp r$/un", "eqp r"),
    }.items()}
    # % MOD/EQP/Mat: EXATO — '%MOD'→norm 'mod' colidiria via substring com 'MOD R$/un'→'modrun'
    # (pegava o R$/un travestido de %). _achar_coluna_exata casa só a coluna de percentual real.
    c["pmod"] = _achar_coluna_exata(cols, "%mod") or _achar_coluna(cols, "% mod")
    c["peqp"] = _achar_coluna_exata(cols, "%eqp") or _achar_coluna(cols, "% eqp")
    c["pmat"] = _achar_coluna_exata(cols, "%mat/transp", "%mat") or _achar_coluna(cols, "mat/transp")
    cpus: list[dict] = []
    n_consistente = 0  # MOD+EQP ≤ custo direto (invariante R$ CONFIÁVEL · ~97% na BR-101). O "%" agora
    n_com_cd = 0        # é a FRAÇÃO real (0..1) da fonte, mapeada por coluna exata (não mais o R$/un).
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        cod = re.sub(r"\s+", "", str(r.get(c["cod"]) or "").strip())
        srv = str(r.get(c["srv"]) or "").strip()
        cd_v = _num_limpo(r.get(c["cd"])) if c["cd"] else None
        mod_v = _num_limpo(r.get(c["mod"])) if c["mod"] else None
        eqp_v = _num_limpo(r.get(c["eqp"])) if c["eqp"] else None
        # Mantém a CPU se tem identidade (código) ou custo — NÃO descarta por Serviço vazio (eram
        # 7 CPUs Principais reais perdidas). Pula só linha totalmente vazia.
        if not cod and not isinstance(cd_v, float) and not isinstance(mod_v, float):
            continue
        if isinstance(cd_v, float) and cd_v > 0:
            n_com_cd += 1
            me = (mod_v if isinstance(mod_v, float) else 0) + (eqp_v if isinstance(eqp_v, float) else 0)
            if me <= cd_v + max(0.01, abs(cd_v) * 0.02):
                n_consistente += 1
        pmod_v = _num_limpo(r.get(c["pmod"])) if c["pmod"] else None
        peqp_v = _num_limpo(r.get(c["peqp"])) if c["peqp"] else None
        pmat_v = _num_limpo(r.get(c["pmat"])) if c["pmat"] else None
        cpus.append({
            "ordem": len(cpus), "codigo_cpu": cod[:40] or None, "servico": srv[:160] or None,
            "unidade": (str(r.get(c["un"]) or "").strip()[:16] or None) if c["un"] else None,
            "tipo": (str(r.get(c["tp"]) or "").strip()[:24] or None) if c["tp"] else None,
            "custo_direto_unit": cd_v if isinstance(cd_v, float) else None,
            "mod_rs_un": mod_v if isinstance(mod_v, float) else None,
            "eqp_rs_un": eqp_v if isinstance(eqp_v, float) else None,
            # fração 0..1 — preserva 0.0 legítimo (CPU 100% material tem %MOD=0, ≠ desconhecido).
            "pct_mod": pmod_v if isinstance(pmod_v, float) else None,
            "pct_eqp": peqp_v if isinstance(peqp_v, float) else None,
            "pct_mat": pmat_v if isinstance(pmat_v, float) else None,
        })
    if not cpus:
        findings.append({"severity": "error", "campo": "cpus", "msg": "nenhuma CPU"})
    elif n_com_cd and n_consistente / n_com_cd < 0.9:
        findings.append({"severity": "warn", "campo": "consistencia",
                         "msg": f"só {n_consistente}/{n_com_cd} CPUs com MOD+EQP ≤ custo direto"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"cpus": cpus, "n_cpus": len(cpus), "n_consistente": n_consistente, "n_com_cd": n_com_cd,
            "status": status, "findings": findings}


# ── C.5 PRAZO · MARCOS CONTRATUAIS DETALHADOS (24) — popula o card "Marcos" do Prazo ──────────────
def extrair_prazo_marcos(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("prazo" in t and "marcos" in t and "detalhad" in t
                and _achar_coluna(cols, "categoria") is not None
                and _achar_coluna(cols, "data-limite", "data limite") is not None):
            sec = s
            break
    if sec is None:
        # dialeto SBSO: "Marcos de prazo por disciplina (previsto × real)" — Disciplina/Término/% Real/Status
        for s2 in secoes:
            if not isinstance(s2, dict):
                continue
            t2 = _norm_key(s2.get("titulo") or "")
            cols2 = s2.get("colunas") or []
            if ("marcos" in t2 and "disciplina" in t2
                    and _achar_coluna(cols2, "disciplina") is not None
                    and _achar_coluna(cols2, "termino previsto", "término previsto") is not None):
                marcos2 = []
                cD = _achar_coluna(cols2, "disciplina")
                cT = _achar_coluna(cols2, "termino previsto", "término previsto")
                cP = _achar_coluna(cols2, "% real")
                cS = _achar_coluna(cols2, "status")
                for r in (s2.get("linhas") or []):
                    if not isinstance(r, dict) or eh_linha_rotulo(r):
                        continue
                    disc = str(r.get(cD) or "").strip()
                    if not disc or "total" in _norm_key(disc):
                        continue
                    pr = _num_limpo(r.get(cP)) if cP else None
                    # convenção do produto: marcos em 0–100 (SBSO emite fração 0–1)
                    if isinstance(pr, float) and pr <= 1.5:
                        pr = round(pr * 100.0, 2)
                    st_raw = str(r.get(cS) or "").strip() if cS else ""
                    marcos2.append({
                        "ordem": len(marcos2), "categoria": disc[:60],
                        # trecho NÃO existe na tabela de marcos por disciplina. A coluna "Natureza"
                        # da MESMA linha pertence à tabela vizinha "Natureza do avanço real"
                        # (colunas L–N da aba, fundidas na captura) — mapeá-la aqui contaminava o
                        # banco com textos alheios (spec ajustes-REVISADO-v3 §C.5.1).
                        "trecho": None,
                        "data_limite": str(r.get(cT) or "").strip()[:20] or None,
                        "pct_concluido": pr if isinstance(pr, float) else None,
                        "farol": (_limpa_glifo(st_raw)[:30] or None) if st_raw else None,
                    })
                if marcos2:
                    eixo_vazio2 = not any((m["pct_concluido"] or 0) > 0 for m in marcos2)
                    return {"marcos": marcos2, "n_marcos": len(marcos2), "eixo_pct_vazio": eixo_vazio2,
                            "status": "ok", "findings": []}
        return {"marcos": [], "n_marcos": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "marcos", "msg": "C.5 Marcos detalhados não localizado"}]}
    cols = sec.get("colunas") or []
    c = {
        "cat": _achar_coluna(cols, "categoria"),
        "tr": _achar_coluna(cols, "trecho / obra", "trecho/obra", "trecho"),
        "dl": _achar_coluna(cols, "data-limite", "data limite"),
        "pc": _achar_coluna(cols, "% concluído", "concluido"),
        "far": _achar_coluna(cols, "farol"),
    }
    marcos: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        cat = str(r.get(c["cat"]) or "").strip()
        dl = str(r.get(c["dl"]) or "").strip() if c["dl"] else ""
        if not cat and not dl:
            continue
        pc = _num_limpo(r.get(c["pc"])) if c["pc"] else None
        marcos.append({
            "ordem": len(marcos), "categoria": cat[:60] or None,
            "trecho": str(r.get(c["tr"]) or "").strip()[:120] if c["tr"] else None,
            "data_limite": dl[:20] or None,
            "pct_concluido": pc if isinstance(pc, float) else None,  # input → None se vazio
            "farol": str(r.get(c["far"]) or "").strip()[:30] if c["far"] else None,
        })
    if not marcos:
        findings.append({"severity": "error", "campo": "marcos", "msg": "nenhum marco"})
    eixo_pct_vazio = not any((m["pct_concluido"] or 0) > 0 for m in marcos)
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"marcos": marcos, "n_marcos": len(marcos), "eixo_pct_vazio": eixo_pct_vazio,
            "status": status, "findings": findings}


# ── C.14 MAPA DA OBRA · SEGMENTOS POR KM (Bloco 1 · liberação/impedimento · Tela 6 Curvas) ──────────
# Retigráfico espaço×tempo: 1 linha = 1 segmento (trechos de duplicação contíguos + sinistros
# pontuais como itens próprios). Campos-FONTE: km início/fim, mês de liberação prevista (baseline)
# e real (efetiva no passado · projetada no futuro), janela de impedimento e valor de contrato.
# Status/Liberado/Impedido (no BM) também vêm da planilha mas são DERIVÁVEIS — o gate recomputa de
# (mês lib. real, janela, BM) e exige igualdade ao centavo. Causa do impedimento é input da obra.
def extrair_mapa_segmentos(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("mapadaobra" in t and "segmentos" in t
                and _achar_coluna(cols, "valor contrato") is not None):
            sec = s
            break
    if sec is None:
        return {"segmentos": [], "n_segmentos": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "segmentos",
                              "msg": "C.14 Bloco 1 (segmentos por km) não localizado"}]}
    cols = sec.get("colunas") or []
    c = {
        "seg": _achar_coluna_exata(cols, "seg.", "seg"),
        "item": _achar_coluna(cols, "item do cronograma", "item"),
        "km_i": _achar_coluna(cols, "km início"),
        "km_f": _achar_coluna(cols, "km fim"),
        "lib_prev": _achar_coluna(cols, "mês lib. prevista", "lib prevista"),
        "lib_real": _achar_coluna(cols, "mês lib. real", "lib real"),
        "imp_i": _achar_coluna(cols, "imped. início"),
        "imp_f": _achar_coluna(cols, "imped. fim"),
        "valor": _achar_coluna(cols, "valor contrato"),
        "status": _achar_coluna(cols, "status"),
        "lib_rs": _achar_coluna(cols, "liberado"),
        "imp_rs": _achar_coluna(cols, "impedido (r$)"),
        "causa": _achar_coluna(cols, "causa do impedimento", "causa"),
    }
    obrig = [k for k in ("seg", "item", "km_i", "km_f", "valor") if c[k] is None]
    if obrig:
        findings.append({"severity": "error", "campo": "colunas",
                         "msg": f"colunas obrigatórias ausentes: {', '.join(obrig)}"})

    def _mes(r, col, seg, campo):  # ordinal de mês (1..N) ou None — vazio é None, nunca 0
        if col is None:
            return None
        v = _num_limpo(r.get(col))
        if v == "ERRO_REF":
            findings.append({"severity": "error", "campo": campo,
                             "msg": f"{seg}: erro de referência na célula (#REF!/#DIV)"})
            return None
        return int(v) if isinstance(v, float) else None

    segmentos: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        seg = str(r.get(c["seg"]) or "").strip()
        item = str(r.get(c["item"]) or "").strip()
        if not seg or seg.upper() == "TOTAL" or not item:
            continue
        km_i, km_f = _num_limpo(r.get(c["km_i"])), _num_limpo(r.get(c["km_f"]))
        valor = _num_limpo(r.get(c["valor"]))
        lib_rs = _num_limpo(r.get(c["lib_rs"])) if c["lib_rs"] else None
        imp_rs = _num_limpo(r.get(c["imp_rs"])) if c["imp_rs"] else None
        for campo, v in (("km", km_i), ("km", km_f), ("valor", valor),
                         ("liberado", lib_rs), ("impedido", imp_rs)):
            if v == "ERRO_REF":  # falha-alto (não vira NULL silencioso · igual aos irmãos)
                findings.append({"severity": "error", "campo": campo,
                                 "msg": f"{seg}: erro de referência na célula (#REF!/#DIV)"})
        if not isinstance(valor, float):
            findings.append({"severity": "error", "campo": "valor",
                             "msg": f"{seg}: segmento sem valor de contrato"})
            continue
        if not isinstance(km_i, float) or not isinstance(km_f, float):
            findings.append({"severity": "error", "campo": "km",
                             "msg": f"{seg}: km início/fim ausente"})
            continue
        # sinistro = item próprio impeditivo (pontual no espaço); o resto é trecho de duplicação
        tipo = "sinistro" if ("sinistro" in _norm_key(item) or km_i == km_f) else "duplicacao"
        segmentos.append({
            "ordem": len(segmentos), "seg_codigo": seg[:12], "item_nome": item[:120],
            "tipo": tipo, "km_inicio": km_i, "km_fim": km_f,
            "mes_lib_prevista": _mes(r, c["lib_prev"], seg, "lib_prevista"),
            "mes_lib_real": _mes(r, c["lib_real"], seg, "lib_real"),
            "imped_mes_inicio": _mes(r, c["imp_i"], seg, "imped"),
            "imped_mes_fim": _mes(r, c["imp_f"], seg, "imped"),
            "valor_contrato_rs": valor,
            "status_bm": (str(r.get(c["status"]) or "").strip()[:30] or None) if c["status"] else None,
            "liberado_rs": lib_rs if isinstance(lib_rs, float) else None,
            "impedido_rs": imp_rs if isinstance(imp_rs, float) else None,
            "causa_impedimento": (str(r.get(c["causa"]) or "").strip()[:200] or None) if c["causa"] else None,
        })
    if not segmentos:
        findings.append({"severity": "error", "campo": "segmentos", "msg": "nenhum segmento"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {
        "segmentos": segmentos, "n_segmentos": len(segmentos),
        "soma_valor_rs": sum(s["valor_contrato_rs"] for s in segmentos),
        "soma_liberado_rs": sum(s["liberado_rs"] or 0.0 for s in segmentos),
        "soma_impedido_rs": sum(s["impedido_rs"] or 0.0 for s in segmentos),
        "status": status, "findings": findings,
    }


# Derivação canônica do estado de um segmento num mês m (mesma régua da planilha, conferida
# célula a célula no Bloco 2): impedido se m está na janela; senão liberado se já liberou
# (mês lib. real ≤ m); senão não iniciado. Janela ABERTA (fim vazio com início presente) =
# "impeditivo até reparo" (texto do C.14): impedido até a véspera da liberação real — nunca
# fecha no próprio início. Compartilhada entre gate (recomputo) e quem precisar.
def derivar_status_segmento(seg: dict, m: int) -> str:
    i, f = seg.get("imped_mes_inicio"), seg.get("imped_mes_fim")
    lr = seg.get("mes_lib_real")
    if i is not None and m >= i:
        fim = f if f is not None else ((lr - 1) if lr is not None else None)
        if fim is None or m <= fim:
            return "Impedido"
    if lr is not None and lr <= m:
        return "Liberado"
    return "Não iniciado"


def snapshot_bm_corrente(secoes: list[dict]) -> int | None:
    """BM corrente (data de corte) declarado nos cards do workbook (C.3/C.5/C.8 trazem o mesmo).
    1ª ocorrência de chave 'bmCorrente' em seção chave_valor."""
    for s in secoes:
        if not isinstance(s, dict):
            continue
        dados = s.get("dados") or {}
        if isinstance(dados, dict):
            for k, v in dados.items():
                if _norm_key(k) == "bmcorrente":
                    n = _num_limpo(v)
                    if isinstance(n, float):
                        return int(n)
    return None


def snapshot_contratado_total(secoes: list[dict]) -> float | None:
    """'Contratado Total (R$)' dos cards do C.3 — âncora do gate do C.14: Σ valor dos trechos de
    duplicação tem que fechar o contrato ao centavo (o retigráfico cobre o contrato inteiro)."""
    for s in secoes:
        if not isinstance(s, dict):
            continue
        dados = s.get("dados") or {}
        if isinstance(dados, dict):
            for k, v in dados.items():
                if _norm_key(k) == "contratadototal":
                    n = _num_limpo(v)
                    if isinstance(n, float):
                        return n
    return None


def snapshot_resumo_liberacoes(secoes: list[dict]) -> dict:
    """Resumo 'liberações × impedimentos' (C.9 · fontes C.14/C.8) → âncoras de conservação:
    {impedidototalrs, liberadototalrs, frentesnaoiniciadasqtd, pctimpedidovscontrato} (chaves
    normalizadas; só entram valores numéricos)."""
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if "resumo" in t and "impedimentos" in t:
            dados = s.get("dados") or {}
            out: dict = {}
            for k, v in (dados.items() if isinstance(dados, dict) else []):
                n = _num_limpo(v)
                if isinstance(n, float):
                    out[_norm_key(k)] = n
            return out
    return {}


def _tipo_elemento(raw: str) -> str:
    """Canonicaliza o tipo do elemento pontual (case/acento-insensível) → 'OAE' | 'Dispositivo' |
    'Talude'. Mantém o texto original se não casar nenhum padrão (gate sinaliza)."""
    n = _norm_key(raw)
    if "oae" in n or "ponte" in n:
        return "OAE"
    if "talude" in n:
        return "Talude"
    if "dispositivo" in n or "retorno" in n or "intersec" in n:
        return "Dispositivo"
    return raw.strip()


def extrair_mapa_elementos(secoes: list[dict]) -> dict:
    """C.14 Bloco 5 — Elementos Pontuais do Retigráfico: OAEs (pontes), dispositivos (retornos /
    Rocha Leão) e os 5 taludes sinistrados INDIVIDUAIS (carve-out do S1). Casa por título 'bloco 5'
    / 'elementos pontuais' + colunas (elemento + km). Taludes trazem valor + impedido-até."""
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if ("mapadaobra" in t and ("bloco5" in t or "bloco05" in t or "elementospontuais" in t)
                and _achar_coluna(cols, "elemento") is not None
                and _achar_coluna_exata(cols, "km") is not None):
            sec = s
            break
    if sec is None:
        return {"elementos": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {
        "tipo": _achar_coluna(cols, "tipo"),
        "elem": _achar_coluna(cols, "elemento"),
        "km": _achar_coluna_exata(cols, "km"),
        "estaca": _achar_coluna(cols, "estaca"),
        "ate": _achar_coluna(cols, "impedido até", "impedido ate"),
        "obs": _achar_coluna(cols, "obs / lado", "obs", "lado"),
        "valor": _achar_coluna(cols, "valor"),
    }
    elementos: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        nome = str(r.get(c["elem"]) or "").strip() if c["elem"] else ""
        km = _num_limpo(r.get(c["km"])) if c["km"] else None
        if not nome or not isinstance(km, float):
            continue
        tipo_raw = str(r.get(c["tipo"]) or "").strip() if c["tipo"] else ""
        tipo = _tipo_elemento(tipo_raw) if tipo_raw else ""
        ate = _num_limpo(r.get(c["ate"])) if c["ate"] else None
        estaca = _num_limpo(r.get(c["estaca"])) if c["estaca"] else None
        valor = _num_limpo(r.get(c["valor"])) if c["valor"] else None
        elementos.append({
            "ordem": len(elementos),
            "tipo": tipo or None,
            "elemento": nome[:200],
            "km": km,
            "estaca": estaca if isinstance(estaca, float) else None,
            "impedido_ate_mes": int(ate) if isinstance(ate, float) else None,
            "obs_lado": (str(r.get(c["obs"]) or "").strip() or None) if c["obs"] else None,
            "valor_rs": valor if isinstance(valor, float) else None,
        })
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"elementos": elementos, "n": len(elementos), "status": status, "findings": findings}


def extrair_mapa_liberacao_mensal(secoes: list[dict]) -> list[dict]:
    """Bloco 2 do C.14 (liberação seg×mês · 0=a liberar · 1=liberado · 2=impedido) →
    [{mes_num, label, codigos: {seg: 0|1|2}}]. Linha de mês = células dos segmentos numéricas
    (legenda/cabeçalho/faixa são texto → fora). Usado SÓ pelo gate: o mapa é 100% derivável dos
    segmentos (não vai pro banco)."""
    sec = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if "mapadaobra" in t and "bloco2" in t:
            sec = s
            break
    if sec is None:
        return []
    cols_seg = [str(col) for col in (sec.get("colunas") or []) if re.match(r"^S\d+$", str(col))]
    c_mes = _achar_coluna(sec.get("colunas") or [], "mês \\ seg", "mes seg")
    out: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        codigos: dict = {}
        ok = True
        for col in cols_seg:
            v = _num_limpo(r.get(col))
            if not isinstance(v, float) or v not in (0.0, 1.0, 2.0):
                ok = False
                break
            codigos[col] = int(v)
        if ok and codigos:
            out.append({"mes_num": len(out) + 1, "codigos": codigos,
                        "label": str(r.get(c_mes) or "").strip() if c_mes else ""})
    return out


# ── C.8/C.3 · SÉRIE MENSAL DAS CURVAS (Tela 6 · gráfico 4 curvas + toggle Total/Produção) ───────────
# Junta 2 fontes do MESMO eixo de meses (1..N): a série acumulada do C.8 (Contratado/Liberado/
# Capacidade/Executado) e a curva mensal do C.3 (col "Previsto Serviços" = base Produção do toggle;
# NÃO deriva da matriz disciplina×mês — M09 diverge R$ 85,9 mil, é fonte própria). Capacidade e
# Executado existem só até o BM: a planilha faz carry-forward (constante) nos meses futuros — aqui o
# carry vira NULL (futuro sem dado ≠ valor; PENDENTE≠0). O gate cruza C.8×C.3 mês a mês ao centavo.
def extrair_curvas_serie_mes(secoes: list[dict], bm: int | None = None) -> dict:
    findings: list[dict] = []
    sec8 = sec3 = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if sec8 is None and "aderenciadascurvas" in t and "acumuladas" in t:
            sec8 = s
        if sec3 is None and "curvamensal" in t and "previsto" in t:
            sec3 = s
    if sec8 is None:
        return {"meses": [], "n_meses": 0, "status": "needs_review", "c3": {},
                "findings": [{"severity": "error", "campo": "serie",
                              "msg": "C.8 série acumulada mês a mês não localizada"}]}
    cols8 = sec8.get("colunas") or []
    c8 = {
        "mes": _achar_coluna_exata(cols8, "mês", "mes"),
        "periodo": _achar_coluna(cols8, "período", "periodo"),
        "contratado": _achar_coluna(cols8, "contratado acum"),
        "liberado": _achar_coluna(cols8, "liberado acum"),
        "capacidade": _achar_coluna(cols8, "capacidade acum"),
        "executado": _achar_coluna(cols8, "executado acum"),
    }
    obrig = [k for k in ("mes", "contratado") if c8[k] is None]
    if obrig:
        findings.append({"severity": "error", "campo": "colunas",
                         "msg": f"C.8 série sem colunas obrigatórias: {', '.join(obrig)}"})

    def _rs(r, col, campo, mes):  # noqa: ANN001 — R$ da célula ou None; #REF! falha-alto
        if col is None:
            return None
        v = _num_limpo(r.get(col))
        if v == "ERRO_REF":
            findings.append({"severity": "error", "campo": campo,
                             "msg": f"M{mes:02d}: erro de referência na célula (#REF!/#DIV)"})
            return None
        return v if isinstance(v, float) else None

    meses: list[dict] = []
    for r in (sec8.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        m = _num_limpo(r.get(c8["mes"])) if c8["mes"] else None
        if not isinstance(m, float):
            continue
        m = int(m)
        meses.append({
            "ordem": len(meses), "mes_num": m,
            "periodo_label": (str(r.get(c8["periodo"]) or "").strip()[:20] or None) if c8["periodo"] else None,
            "contratado_acum_rs": _rs(r, c8["contratado"], "contratado", m),
            "liberado_acum_rs": _rs(r, c8["liberado"], "liberado", m),
            "capacidade_acum_rs": _rs(r, c8["capacidade"], "capacidade", m),
            "executado_acum_rs": _rs(r, c8["executado"], "executado", m),
            "previsto_servicos_rs": None,
        })
    if not meses:
        findings.append({"severity": "error", "campo": "serie", "msg": "nenhum mês na série C.8"})

    # C.3 curva mensal — previsto serviços (mensal) + auxiliares p/ o gate cruzar (acum/real/todo)
    c3_aux: dict = {}
    if sec3 is not None:
        cols3 = sec3.get("colunas") or []
        c3 = {
            "bm": _achar_coluna_exata(cols3, "bm"),
            "servicos": _achar_coluna(cols3, "previsto serviços", "previsto servicos"),
            "todo": _achar_coluna(cols3, "previsto todo"),
            "acum": _achar_coluna(cols3, "previsto acum"),
            "real_acum": _achar_coluna(cols3, "real acum"),
        }
        por_mes = {x["mes_num"]: x for x in meses}
        for r in (sec3.get("linhas") or []):
            if not isinstance(r, dict) or eh_linha_rotulo(r):
                continue
            m = _num_limpo(r.get(c3["bm"])) if c3["bm"] else None
            if not isinstance(m, float):
                continue
            m = int(m)
            if m in por_mes:
                por_mes[m]["previsto_servicos_rs"] = _rs(r, c3["servicos"], "servicos", m)
            c3_aux[m] = {"previsto_acum": _rs(r, c3["acum"], "c3_acum", m),
                         "previsto_todo": _rs(r, c3["todo"], "c3_todo", m),
                         "real_acum": _rs(r, c3["real_acum"], "c3_real", m)}
    else:
        findings.append({"severity": "warn", "campo": "servicos",
                         "msg": "C.3 curva mensal ausente — base Produção (serviços) sem fonte"})

    # corte no BM: capacidade/executado pós-BM são carry-forward (constante) → NULL (sem dado).
    # Se variarem (deixou de ser carry), mantém e avisa — pode ser dado real de outra obra.
    if bm is not None and meses:
        for campo in ("capacidade_acum_rs", "executado_acum_rs"):
            corte = next((x[campo] for x in meses if x["mes_num"] == bm), None)
            pos = [x for x in meses if x["mes_num"] > bm and x[campo] is not None]
            if corte is not None and pos and all(abs(x[campo] - corte) <= 0.005 for x in pos):
                for x in pos:
                    x[campo] = None
            elif pos:
                findings.append({"severity": "warn", "campo": campo,
                                 "msg": f"{campo} varia após o BM {bm} — mantido como dado (não é carry)"})
    elif bm is None:
        # sem BM não dá pra distinguir carry de dado real — gravar carry como se fosse medição
        # seria fabricar futuro → falha-alto (needs_review), nunca verde
        findings.append({"severity": "error", "campo": "bm",
                         "msg": "sem BM corrente — carry pós-BM indistinguível de dado (não corto)"})

    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"meses": meses, "n_meses": len(meses), "c3": c3_aux,
            "status": status, "findings": findings}


def snapshot_curvas_cards(secoes: list[dict]) -> dict:
    """Cards do C.8 (4 curvas no corte) → âncoras do gate da série: {totalcontratadoacum,
    liberadoparaexecucaoacum, capacidadeprodutivaacum, executadoacum} (chaves normalizadas)."""
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "chave_valor":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "aderenciadascurvas" in t:
            out: dict = {}
            dados = s.get("dados") or {}
            for k, v in (dados.items() if isinstance(dados, dict) else []):
                n = _num_limpo(v)
                if isinstance(n, float):
                    out[_norm_key(k)] = n
            return out
    return {}


# ── D.5 · EXCEDENTE AO IPCA POR INSUMO RELEVANTE (cláusula 8.8 · Tela Insumos do RMA) ───────────────
# Reframe do Caderno: o índice contratual é IPCA (cl. 6.2); nos insumos relevantes (8.8) a variação
# até o IPCA é risco da Contratada (6.2.2) e SÓ o excedente é faturado direto (com índice e/ou 3
# cotações) — não é reequilíbrio paramétrico. 1 linha = 1 insumo relevante no snapshot (mês comum):
# Δ% real provado por índice de mercado · teto IPCA acumulado · excedente = (Δ%real − Δ%IPCA)⁺ ·
# Δ R$ = excedente × qtde orçada × preço-base (repasse EFETIVO usa qtde da NF, mês a mês).
# Pendência honesta: sem índice → Δ%/teto/excedente/Δ R$ = None (o 0 da planilha é default de
# fórmula, não medição); o R$ por NF é input futuro. Gate cruza qtd/preço com a Curva ABC (C.6).
def extrair_insumo_excedente(secoes: list[dict]) -> dict:
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if "excedente" in t and "insumo" in t and _achar_coluna(cols, "teto") is not None:
            sec = s
            break
    if sec is None:
        return {"insumos": [], "n_insumos": 0, "snapshot_label": None, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "bloco",
                              "msg": "D.5 Bloco 5 (excedente por insumo relevante) não localizado"}]}
    cols = sec.get("colunas") or []

    # 'Δ% real (jan/26)' normaliza p/ 'realjan26' — começa com 'real' (≠ 'preço ref. real').
    # Se mais de uma coluna começar com 'real' (ex.: um futuro 'Real pago'), desempata pela que
    # declara o MÊS do snapshot entre parênteses — é a coluna canônica do Bloco 5.
    cand_delta = [c0 for c0 in cols if _norm_key(c0).startswith("real")]
    col_delta = cand_delta[0] if cand_delta else None
    if len(cand_delta) > 1:
        com_mes = [c0 for c0 in cand_delta
                   if re.search(r"\([a-zç]{3}/\d{2}\)", str(c0).lower())]
        col_delta = com_mes[0] if com_mes else cand_delta[0]

    c = {
        "insumo": _achar_coluna(cols, "insumo"),
        "abc": _achar_coluna_exata(cols, "abc"),
        "qtd": _achar_coluna(cols, "qtd orçada", "qtde orçada"),
        "preco": _achar_coluna(cols, "preço orçado"),
        "ref": _achar_coluna(cols, "preço ref"),
        "delta": col_delta,
        "teto": _achar_coluna(cols, "teto"),
        "exc": _achar_coluna(cols, "excedente"),
        "rs": _achar_coluna(cols, "r$ conforme", "conforme contrato"),
        "farol": _achar_coluna(cols, "farol"),
    }
    obrig = [k for k in ("insumo", "delta", "teto", "rs") if c[k] is None]
    if obrig:
        findings.append({"severity": "error", "campo": "colunas",
                         "msg": f"colunas obrigatórias ausentes no Bloco 5: {', '.join(obrig)}"})

    # snapshot (mês comum) declarado no header da coluna Δ% — ex.: 'Δ% real (jan/26)'
    snapshot = None
    if c["delta"]:
        m = re.search(r"\(([a-zç]{3}/\d{2})\)", str(c["delta"]).lower())
        snapshot = m.group(1) if m else None

    insumos: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        nome = str(r.get(c["insumo"]) or "").strip()
        if not nome or nome.upper().startswith("TOTAL"):
            continue
        delta = _num_limpo(r.get(c["delta"]))
        teto = _num_limpo(r.get(c["teto"]))
        exc = _num_limpo(r.get(c["exc"])) if c["exc"] else None
        rs = _num_limpo(r.get(c["rs"]))
        ref = _num_limpo(r.get(c["ref"])) if c["ref"] else None
        for campo, v in (("delta", delta), ("teto", teto), ("excedente", exc), ("rs", rs)):
            if v == "ERRO_REF":  # falha-alto (não vira NULL silencioso)
                findings.append({"severity": "error", "campo": campo,
                                 "msg": f"{nome[:30]}: erro de referência na célula (#REF!/#DIV)"})
        pendente = not isinstance(delta, float)  # sem índice de mercado ainda
        # linha pendente com R$ ≠ 0 na planilha = valor fabricado sem índice → falha-alto
        # (o None abaixo apaga o sintoma; o finding preserva a denúncia)
        if pendente and isinstance(rs, float) and abs(rs) > 0.005:
            findings.append({"severity": "error", "campo": "pendente",
                             "msg": f"{nome[:30]}: Δ R$ {rs:.2f} sem índice de mercado (fabricado?)"})
        farol_raw = str(r.get(c["farol"]) or "").strip() if c["farol"] else ""
        farol = farol_raw.replace("●", "").strip() or None
        if farol == "—":
            farol = None
        qtd = _num_limpo(r.get(c["qtd"])) if c["qtd"] else None
        preco = _num_limpo(r.get(c["preco"])) if c["preco"] else None
        insumos.append({
            "ordem": len(insumos), "insumo": nome[:120],
            "classe_abc": (str(r.get(c["abc"]) or "").strip()[:3] or None) if c["abc"] else None,
            "qtd_orcada": qtd if isinstance(qtd, float) else None,
            "preco_orcado_rs": preco if isinstance(preco, float) else None,
            "preco_ref_real_rs": ref if isinstance(ref, float) else None,
            "delta_real_pct": delta if isinstance(delta, float) else None,
            "teto_ipca_pct": (teto if isinstance(teto, float) else None) if not pendente else None,
            "excedente_pct": (exc if isinstance(exc, float) else None) if not pendente else None,
            # 0 da planilha em linha pendente é default de fórmula, não medição → None
            "delta_rs": (rs if isinstance(rs, float) else None) if not pendente else None,
            "farol": farol,
            "indice_pendente": pendente,
        })
    if not insumos:
        findings.append({"severity": "error", "campo": "insumos", "msg": "nenhum insumo relevante"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"insumos": insumos, "n_insumos": len(insumos), "snapshot_label": snapshot,
            "status": status, "findings": findings}


def extrair_valor_agregado(secoes: list[dict]) -> dict:
    """D.4 Valor Agregado (earned value · AACE 25R-03). Casa por ESTRUTURA (zero hardcode de obra):
      • RESUMO TRANSPOSTO — métricas são LINHAS (rótulo na 1ª coluna), categorias são COLUNAS
        (MOD/EQP/TOTAL). Lê por linha-rótulo: VA necessário · Real alocado · Perda · % sobre o PV ·
        Farol da perda (só na TOTAL).
      • POR SERVIÇO — Qtd medida × R$/un → VA MOD/EQP. Exclui a linha 'TOTAL' (é âncora do gate, não
        serviço); keya por código CPU (há serviços homônimos). 0 da planilha = default de fórmula.
    Retorna {categorias, servicos, farol_total, perda_total, n_servicos, status, findings}."""
    findings: list[dict] = []

    def _f(v):  # noqa: ANN001 — número da célula ou None (rejeita #REF! via _num_limpo)
        n = _num_limpo(v)
        return n if isinstance(n, float) else None

    def _classifica_metrica(rot: str):  # noqa: ANN001 → 'va'|'alocado'|'perda'|'pct'|None
        if "valoragregado" in rot or "necessario" in rot:
            return "va"
        if "realalocado" in rot or ("alocado" in rot and "real" in rot):
            return "alocado"
        if "perda" in rot:
            return "perda"
        if "sobreopv" in rot or ("pv" in rot and "sobre" in rot):
            return "pct"
        return None

    def _hist_real_cheio():  # {"MOD": Σ, "EQP": Σ} do histograma C.4 (Real R$ CHEIO) ou {}
        # "Regra de ouro": o real alocado do VA é a MESMA fonte da C.4 (histograma · apoio incluído).
        # O resumo do workbook traz o real de PRODUÇÃO (corta apoio) — o desequilíbrio compara o CHEIO.
        for s in secoes:
            if not isinstance(s, dict):
                continue
            t = _norm_key(s.get("titulo") or "")
            if "histograma" not in t or "mensal" not in t:
                continue
            cols = s.get("colunas") or []
            kmod = _achar_coluna(cols, "MOD Real(R$)", "MOD Real (R$)")
            keqp = _achar_coluna(cols, "EQP Real(R$)", "EQP Real (R$)")
            if not (kmod and keqp):
                continue
            mod = eqp = 0.0
            for r in (s.get("linhas") or []):
                if not isinstance(r, dict):
                    continue
                m, e = _num_limpo(r.get(kmod)), _num_limpo(r.get(keqp))
                if isinstance(m, float):
                    mod += m
                if isinstance(e, float):
                    eqp += e
            return {"MOD": round(mod, 2), "EQP": round(eqp, 2)}
        return {}

    # localizar seções por estrutura: RESUMO (chave_valor com dicts {MOD,EQP,TOTAL} — formato da
    # extração — OU tabela transposta de fallback) + SERVIÇOS (tabela com Qtd medida / VA por cat).
    sec_resumo_kv = None
    sec_resumo_tab = None
    sec_serv = None
    sec_serie = None  # série mensal (VA/Real por mês · p/ o gráfico)
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if "valoragregado" not in t and "earned" not in t:
            continue
        tipo = s.get("tipo")
        if tipo == "chave_valor":
            dados = s.get("dados") or {}
            if sec_resumo_kv is None and any(
                "valoragregado" in _norm_key(k) or "perdadeprodut" in _norm_key(k) for k in dados
            ):
                sec_resumo_kv = s
        elif tipo == "tabela":
            cols = s.get("colunas") or []
            if "seriemensal" in t:
                if sec_serie is None:
                    sec_serie = s
            elif (_achar_coluna(cols, "qtd medida", "qtde medida") is not None
                  or _achar_coluna(cols, "va mod", "va eqp") is not None
                  or _achar_coluna(cols, "codigo cpu", "código cpu") is not None):
                if sec_serv is None:
                    sec_serv = s
            elif _achar_coluna_exata(cols, "total") is not None and sec_resumo_tab is None:
                sec_resumo_tab = s

    if sec_resumo_kv is None and sec_resumo_tab is None:
        return {"categorias": [], "servicos": [], "farol_total": None, "perda_total": None,
                "n_servicos": 0, "status": "needs_review",
                "findings": [{"severity": "error", "campo": "bloco",
                              "msg": "D.4 Valor Agregado · seção RESUMO (VA×Alocado) não localizada"}]}

    # ── RESUMO · chave_valor (dicts por métrica) OU tabela transposta (fallback) ─────────────────
    metric: dict = {"va": {}, "alocado": {}, "perda": {}, "pct": {}}
    farol_total = None
    if sec_resumo_kv is not None:
        for k, v in (sec_resumo_kv.get("dados") or {}).items():
            nk = _norm_key(k)
            if "farol" in nk:
                if isinstance(v, str) and v.strip():
                    farol_total = v.replace("●", "").strip() or farol_total
                continue
            key = _classifica_metrica(nk)
            if key is None or not isinstance(v, dict):
                continue
            for cat in ("MOD", "EQP", "TOTAL"):
                n = _f(v.get(cat))
                if n is not None:
                    metric[key][cat] = n
    else:
        rcols = sec_resumo_tab.get("colunas") or []
        col_rotulo = _achar_coluna(rcols, "col_1") or (rcols[0] if rcols else None)
        cat_cols = {"MOD": _achar_coluna_exata(rcols, "mod"),
                    "EQP": _achar_coluna_exata(rcols, "eqp"),
                    "TOTAL": _achar_coluna_exata(rcols, "total")}
        for r in (sec_resumo_tab.get("linhas") or []):
            if not isinstance(r, dict):
                continue
            rot = _norm_key(r.get(col_rotulo)) if col_rotulo else ""
            if not rot:
                continue
            if "farol" in rot:
                for cc in cat_cols.values():
                    v = r.get(cc) if cc else None
                    if isinstance(v, str) and v.strip():
                        farol_total = v.replace("●", "").strip() or farol_total
                continue
            key = _classifica_metrica(rot)
            if key is None:
                continue
            for cat, cc in cat_cols.items():
                n = _f(r.get(cc)) if cc else None
                if n is not None:
                    metric[key][cat] = n

    categorias: list[dict] = []
    for i, cat in enumerate(("MOD", "EQP", "TOTAL")):
        va, al, pe = metric["va"].get(cat), metric["alocado"].get(cat), metric["perda"].get(cat)
        if va is None and al is None and pe is None:
            continue
        categorias.append({"ordem": i, "categoria": cat, "va_medido_rs": va,
                           "real_alocado_rs": al, "perda_rs": pe,
                           "pct_pv": metric["pct"].get(cat),
                           "farol": farol_total if cat == "TOTAL" else None})
    if not categorias:
        findings.append({"severity": "error", "campo": "resumo",
                         "msg": "D.4 VA · resumo sem categorias MOD/EQP/TOTAL numéricas"})

    # REAL ALOCADO = histograma C.4 CHEIO (apoio incluído). O resumo do workbook traz o real de
    # PRODUÇÃO; aqui sobrescreve real/perda/pct (TOTAL = MOD+EQP) com a fonte da C.4, ancorando o PV
    # na razão perda/pct ORIGINAL. va_medido (earned value) é preservado.
    real_cheio = _hist_real_cheio()
    if real_cheio and categorias:
        pe0, pc0 = metric["perda"].get("TOTAL"), metric["pct"].get("TOTAL")
        pv = pe0 / pc0 if isinstance(pe0, float) and isinstance(pc0, float) and pc0 else None
        for c in categorias:
            rc = real_cheio.get(c["categoria"])
            if c["categoria"] in ("MOD", "EQP") and rc is not None:
                c["real_alocado_rs"] = rc
                if c.get("va_medido_rs") is not None:
                    c["perda_rs"] = rc - c["va_medido_rs"]
                    if pv:
                        c["pct_pv"] = c["perda_rs"] / pv
        por = {c["categoria"]: c for c in categorias}
        if {"MOD", "EQP", "TOTAL"} <= set(por):
            for campo in ("va_medido_rs", "real_alocado_rs", "perda_rs"):
                a, b = por["MOD"].get(campo), por["EQP"].get(campo)
                if a is not None and b is not None:
                    por["TOTAL"][campo] = a + b
            if pv and por["TOTAL"].get("perda_rs") is not None:
                por["TOTAL"]["pct_pv"] = por["TOTAL"]["perda_rs"] / pv

    # ── POR SERVIÇO ────────────────────────────────────────────────────────────────────────────
    servicos: list[dict] = []
    if sec_serv is not None:
        sc = sec_serv.get("colunas") or []
        c = {"cpu": _achar_coluna(sc, "codigo cpu", "código cpu", "cpu"),
             "serv": _achar_coluna(sc, "serviço", "servico"),
             "unid": _achar_coluna(sc, "unid"),
             "pmod": _achar_coluna_exata(sc, "mod"),       # '%MOD' → norm 'mod'
             "peqp": _achar_coluna_exata(sc, "eqp"),       # '%EQP' → norm 'eqp'
             "modun": _achar_coluna(sc, "mod r$/un", "mod r$"),
             "eqpun": _achar_coluna(sc, "eqp r$/un", "eqp r$"),
             "qtd": _achar_coluna(sc, "qtd medida", "qtde medida"),
             "vamod": _achar_coluna(sc, "va mod"),
             "vaeqp": _achar_coluna(sc, "va eqp")}
        for r in (sec_serv.get("linhas") or []):
            if not isinstance(r, dict) or eh_linha_rotulo(r):
                continue
            serv = str(r.get(c["serv"]) or "").strip() if c["serv"] else ""
            # exclui a linha TOTAL (âncora do gate) e linhas sem nome de serviço
            if not serv or serv.upper().startswith("TOTAL"):
                continue
            vamod = _num_limpo(r.get(c["vamod"])) if c["vamod"] else None
            vaeqp = _num_limpo(r.get(c["vaeqp"])) if c["vaeqp"] else None
            for campo, v in (("va_mod_rs", vamod), ("va_eqp_rs", vaeqp)):
                if v == "ERRO_REF":  # falha-alto (não vira NULL silencioso)
                    findings.append({"severity": "error", "campo": campo,
                                     "msg": f"{serv[:30]}: erro de referência na célula (#REF!/#DIV)"})
            qtd = _num_limpo(r.get(c["qtd"])) if c["qtd"] else None
            # só serviços COM produção medida (qtd>0 ou VA>0). O resto é 0 por default de fórmula
            # (CPU decomposta sem medição) — não é medição, não vai pro banco (medição honesta).
            tem_prod = ((isinstance(qtd, float) and qtd > 0)
                        or (isinstance(vamod, float) and vamod > 0)
                        or (isinstance(vaeqp, float) and vaeqp > 0))
            if not tem_prod:
                continue
            cpu_raw = str(r.get(c["cpu"]) or "").strip() if c["cpu"] else ""
            servicos.append({
                "ordem": len(servicos),
                "codigo_cpu": (re.sub(r"\s+", "", cpu_raw) or None),
                "servico": serv[:160],
                "unidade": (str(r.get(c["unid"]) or "").strip()[:16] or None) if c["unid"] else None,
                "pct_mod": _f(r.get(c["pmod"])) if c["pmod"] else None,
                "pct_eqp": _f(r.get(c["peqp"])) if c["peqp"] else None,
                "mod_rs_un": _f(r.get(c["modun"])) if c["modun"] else None,
                "eqp_rs_un": _f(r.get(c["eqpun"])) if c["eqpun"] else None,
                "qtd_medida": qtd if isinstance(qtd, float) else None,
                "va_mod_rs": vamod if isinstance(vamod, float) else None,
                "va_eqp_rs": vaeqp if isinstance(vaeqp, float) else None,
            })

    # ── SÉRIE MENSAL (VA/Real por mês · p/ o gráfico) — transposta: métricas=linhas, meses=colunas ─
    _MES_PT = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
               "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}

    def _mes_label(x):  # noqa: ANN001 → (ano, mes) | None  · 'abr-26' → (2026, 4)
        m = re.match(r"^\s*([a-zç]{3})[-/](\d{2,4})\s*$", str(x).strip().lower())
        if not m or m.group(1) not in _MES_PT:
            return None
        yy = int(m.group(2))
        return (yy + 2000 if yy < 100 else yy, _MES_PT[m.group(1)])

    serie: list[dict] = []
    if sec_serie is not None:
        cols = sec_serie.get("colunas") or []
        col_mes = _achar_coluna(cols, "mês", "mes") or (cols[0] if cols else None)
        month_cols = [(co, _mes_label(co)) for co in cols if co != col_mes and _mes_label(co)]
        # mapeia as 4 linhas por categoria (VA/Real × MOD/EQP); ignora as linhas acumuladas (derivadas)
        rowmap: dict = {}
        for r in (sec_serie.get("linhas") or []):
            if not isinstance(r, dict):
                continue
            lab = _norm_key(r.get(col_mes)) if col_mes else ""
            if "acum" in lab:
                continue
            if "vamedido" in lab or "valoragregado" in lab:
                met = "va"
            elif "realalocado" in lab or ("alocado" in lab and "real" in lab):
                met = "real"
            else:
                continue
            cat = "MOD" if "mod" in lab else ("EQP" if "eqp" in lab else None)
            if cat:
                rowmap[(met, cat)] = r
        for co, ym in month_cols:
            ano, mes = ym

            def _cell(met, cat, _co=co):
                rr = rowmap.get((met, cat))
                return _f(rr.get(_co)) if rr else None

            vamod, vaeqp = _cell("va", "MOD"), _cell("va", "EQP")
            rmod, reqp = _cell("real", "MOD"), _cell("real", "EQP")
            # mês sem produção (tudo None/0) não entra — default de fórmula, não medição
            if not any(v for v in (vamod, vaeqp, rmod, reqp)):
                continue
            serie.append({"ordem": len(serie), "ano": ano, "mes": mes, "periodo_label": str(co),
                          "va_mod_rs": vamod, "va_eqp_rs": vaeqp,
                          "real_mod_rs": rmod, "real_eqp_rs": reqp})

    total = next((c0 for c0 in categorias if c0["categoria"] == "TOTAL"), None)
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"categorias": categorias, "servicos": servicos, "serie": serie,
            "farol_total": farol_total, "perda_total": (total or {}).get("perda_rs"),
            "n_servicos": len(servicos), "n_meses": len(serie),
            "status": status, "findings": findings}


def extrair_recursos_maiores_desvios(secoes: list[dict]) -> dict:
    """C.4 · ranking dos maiores desvios de alocação por recurso/função (Real − Contratado acum, R$,
    no corte do BM). Casa por título ('maiores desvios' + 'aloca') + colunas. ZERO hardcode de obra.
    Retorna {desvios, n, status, findings}."""
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "maioresdesvios" in t and "aloca" in t:
            sec = s
            break
    if sec is None:
        return {"desvios": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"rec": _achar_coluna(cols, "recurso", "função", "funcao"),
         "contr": _achar_coluna(cols, "contratado"),
         "real": _achar_coluna(cols, "real"),
         "desvio": _achar_coluna(cols, "desvio")}
    desvios: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        nome = str(r.get(c["rec"]) or "").strip() if c["rec"] else ""
        if not nome or nome.upper().startswith("TOTAL"):
            continue
        contr = _num_limpo(r.get(c["contr"])) if c["contr"] else None
        real = _num_limpo(r.get(c["real"])) if c["real"] else None
        desvio = _num_limpo(r.get(c["desvio"])) if c["desvio"] else None
        for campo, v in (("contratado", contr), ("real", real), ("desvio", desvio)):
            if v == "ERRO_REF":
                findings.append({"severity": "error", "campo": campo,
                                 "msg": f"{nome[:30]}: erro de referência (#REF!/#DIV)"})
        desvios.append({"ordem": len(desvios), "recurso": nome[:120],
                        "contratado_rs": contr if isinstance(contr, float) else None,
                        "real_rs": real if isinstance(real, float) else None,
                        "desvio_rs": desvio if isinstance(desvio, float) else None})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"desvios": desvios, "n": len(desvios), "status": status, "findings": findings}


def _data_iso(v):  # noqa: ANN001 → 'YYYY-MM-DD' válido ou None (datas do C.13 já vêm ISO)
    s = str(v).strip() if v is not None else ""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
    return m.group(1) if m else None


# grupos/trechos do Cron Project (depth 0 do Gantt) × disciplinas/folhas (depth 1).
# O workbook NÃO encoda a árvore (CÓD vazio; NÍVEL só nas 2 linhas de super-resumo) → derivamos pelo
# header estrutural do template C.13 (Trecho/Serviços/Recuperação/Cortes de Taludes/Dispositivos de
# Retorno) + a tag de trecho 'Tn'. Reproduz 1:1 os 12 grupos do mockup BR-101 sem citar nome de obra.
_GRUPO_CRON_PREFIXO = re.compile(r"^(trecho|servic|recuperac|cortes de taludes|dispositivos de retorno)")


def _eh_grupo_cron(nome: str) -> bool:
    n = _norm_key_keepspace(nome)
    return bool(_GRUPO_CRON_PREFIXO.match(n) or re.search(r"\bt\d", n))


def extrair_cronograma_tarefas_c13(secoes: list[dict]) -> dict:
    """C.13 · Cronograma MS Project (contratado × real) → tarefas p/ o Gantt (overview + zoom por
    NÍVEL). Casa por título 'cron project' / 'cronograma ms project' + colunas. Datas ISO. Eixo real
    pendente (pré-execução) chega NULL. ZERO hardcode de obra."""
    findings: list[dict] = []

    # dialeto SBSO (FONTE-CRONOGRAMA-FISICO · MS-Project): EDT/Início/Término/Nome — sem eixo real.
    def _data_br(v):  # 'Ter 16/09/25' | '16/09/2025' | ISO → ISO
        if v is None:
            return None
        s2 = str(v).strip()
        mi = re.search(r"(\d{4})-(\d{2})-(\d{2})", s2)
        if mi:
            return f"{mi.group(1)}-{mi.group(2)}-{mi.group(3)}"
        mb = re.search(r"(\d{2})/(\d{2})/(\d{2,4})", s2)
        if mb:
            y = mb.group(3)
            y = f"20{y}" if len(y) == 2 else y
            return f"{y}-{mb.group(2)}-{mb.group(1)}"
        return None
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        cols = s.get("colunas") or []
        # assinatura única do MS Project (Cron Project): NOME DA TAREFA + NÍVEL + eixo REAL.
        # NÃO casar por título — a seção 'Etapas' cita 'Cron Project' no parêntese e casaria errado.
        if (_achar_coluna(cols, "nome da tarefa")
                and _achar_coluna(cols, "nível", "nivel")
                and _achar_coluna(cols, "início real", "inicio real")):
            sec = s
            break
    if sec is None:
        for s2 in secoes:
            if not isinstance(s2, dict) or not s2.get("linhas"):
                continue
            cols2 = s2.get("colunas") or []
            if (_achar_coluna(cols2, "edt") is not None and _achar_coluna(cols2, "nome da tarefa") is not None
                    and _achar_coluna(cols2, "início", "inicio") is not None):
                cE = _achar_coluna(cols2, "edt")
                cN = _achar_coluna(cols2, "nome da tarefa")
                cI = _achar_coluna(cols2, "início", "inicio")
                cT = _achar_coluna(cols2, "término", "termino")
                tarefas2 = []
                for row in s2["linhas"]:
                    if not isinstance(row, dict):
                        continue
                    nome2 = str(row.get(cN) or "").strip()
                    edt = str(row.get(cE) or "").strip()
                    if not nome2:
                        continue
                    di = _data_br(row.get(cI))
                    dt2 = _data_br(row.get(cT)) or di
                    if not di:  # linha de agrupamento/cabeçalho sem data — não é barra de Gantt
                        continue
                    dur = None
                    if di and dt2:
                        from datetime import date as _d
                        try:
                            _a = _d(*[int(x) for x in di.split("-")])
                            _b = _d(*[int(x) for x in dt2.split("-")])
                            dur = (_b - _a).days + 1
                        except ValueError:
                            dur = None
                    tarefas2.append({
                        "ordem": len(tarefas2), "numero_item": edt[:40] or None, "codigo": edt[:40] or None,
                        "nivel": (edt.count(".") + 1) if edt else None, "nome": nome2[:300],
                        "unidade": None, "quantidade": None, "duracao_dias": dur,
                        "data_inicio": di, "data_termino": dt2,
                        "data_inicio_real": None, "data_termino_real": None,
                        "desvio_dias": None, "pct_concluido": None,
                        "eh_marco": bool(di and dt2 and di == dt2),
                    })
                if tarefas2:
                    return {"tarefas": tarefas2, "n": len(tarefas2), "status": "ok", "findings": []}
    if sec is None:
        return {"tarefas": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"id": _achar_coluna(cols, "id"),
         "cod": _achar_coluna(cols, "cód", "cod"),
         "nome": _achar_coluna(cols, "nome da tarefa", "tarefa"),
         "dur": _achar_coluna(cols, "duração", "duracao"),
         "ini": _achar_coluna(cols, "início (contrat", "inicio (contrat", "início contrat", "inicio contrat"),
         "ter": _achar_coluna(cols, "término (contrat", "termino (contrat", "término contrat", "termino contrat"),
         "inir": _achar_coluna(cols, "início real", "inicio real"),
         "terr": _achar_coluna(cols, "término real", "termino real"),
         "pct": _achar_coluna(cols, "% concl", "concl"),
         "desv": _achar_coluna(cols, "desvio"),
         "niv": _achar_coluna(cols, "nível", "nivel")}
    tarefas: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict) or eh_linha_rotulo(r):
            continue
        nome = str(r.get(c["nome"]) or "").strip() if c["nome"] else ""
        if not nome:
            continue
        # NÍVEL só vem preenchido nas 2 linhas de super-resumo (DUPLICAÇÃO obra/45km) → elas viram a
        # 'visão geral' (params/masterrow), não entram no Gantt detalhado. Descartar.
        niv_sel = _num_limpo(r.get(c["niv"])) if c["niv"] else None
        if isinstance(niv_sel, float):
            continue
        dur = _num_limpo(r.get(c["dur"])) if c["dur"] else None
        desv = _num_limpo(r.get(c["desv"])) if c["desv"] else None
        idv = r.get(c["id"]) if c["id"] else None
        tarefas.append({
            "ordem": len(tarefas),
            "numero_item": (str(idv).strip() if idv is not None else str(len(tarefas))),
            "codigo": (str(r.get(c["cod"]) or "").strip() or None) if c["cod"] else None,
            "nome": nome[:200],
            "nivel": 0 if _eh_grupo_cron(nome) else 1,  # 0 = grupo/trecho · 1 = disciplina/folha
            "unidade": None,
            "quantidade": None,
            "duracao_dias": int(dur) if isinstance(dur, float) else None,
            "data_inicio": _data_iso(r.get(c["ini"])) if c["ini"] else None,
            "data_termino": _data_iso(r.get(c["ter"])) if c["ter"] else None,
            "data_inicio_real": _data_iso(r.get(c["inir"])) if c["inir"] else None,
            "data_termino_real": _data_iso(r.get(c["terr"])) if c["terr"] else None,
            "pct_concluido": _num_limpo(r.get(c["pct"])) if c["pct"] and isinstance(_num_limpo(r.get(c["pct"])), float) else None,
            "desvio_dias": int(desv) if isinstance(desv, float) else None,
            "eh_marco": isinstance(dur, float) and dur == 0,
        })
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"tarefas": tarefas, "n": len(tarefas), "status": status, "findings": findings}


def _limpa_glifo(v):  # noqa: ANN001 — remove ●○⚠🚧🏞🌧◆ e espaços extras
    return re.sub(r"\s+", " ", re.sub(r"[●○◆⚠🚧🏞🌧️️]", "", str(v or ""))).strip()


def _sim_nao(v):  # noqa: ANN001 → True/False/None
    s = _norm_key(v)
    if "sim" in s:
        return True
    if "nao" in s:
        return False
    return None


def extrair_eventos_prazo(secoes: list[dict]) -> dict:
    """C.13 · Registro de Eventos que impactam o prazo → eventos datados. Casa por título 'registro de
    eventos'. Linha sem título = separador → fora. Glifos removidos das categorias/flags."""
    findings: list[dict] = []
    sec = None
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "registrodeeventos" in t or ("marcos" in t and "eventos" in t):
            sec = s
            break
    if sec is None:
        return {"eventos": [], "n": 0, "status": "ok", "findings": []}
    cols = sec.get("colunas") or []
    c = {"id": _achar_coluna(cols, "id (ev", "id (ev…"),
         "tit": _achar_coluna(cols, "título", "titulo", "marco / evento", "marco/evento", "marco"),
         "cat": _achar_coluna(cols, "categoria", "tipo"),
         "ini": _achar_coluna(cols, "data início", "data inicio") or _achar_coluna_exata(cols, "data"),
         "fim": _achar_coluna(cols, "data fim"),
         "frente": _achar_coluna(cols, "frente/trecho", "frente"),
         "crit": _achar_coluna(cols, "crítico", "critico"),
         "clau": _achar_coluna(cols, "cláusula", "clausula", "descrição / observação", "descricao"),
         "stat": _achar_coluna(cols, "status análise", "status analise"),
         "matriz": _achar_coluna(cols, "matriz"),
         "imp": _achar_coluna(cols, "impacta")}
    eventos: list[dict] = []
    for r in (sec.get("linhas") or []):
        if not isinstance(r, dict):
            continue
        tit = str(r.get(c["tit"]) or "").strip() if c["tit"] else ""
        if not tit:
            continue
        eventos.append({
            "ordem": len(eventos),
            "ev_id": (str(r.get(c["id"]) or "").strip() or None) if c["id"] else None,
            "titulo": tit[:200],
            "categoria": (_limpa_glifo(r.get(c["cat"])) or None) if c["cat"] else None,
            "data_inicio": _data_iso(r.get(c["ini"])) if c["ini"] else None,
            "data_fim": _data_iso(r.get(c["fim"])) if c["fim"] else None,
            "frente_trecho": (str(r.get(c["frente"]) or "").strip() or None) if c["frente"] else None,
            "critico": _sim_nao(r.get(c["crit"])) if c["crit"] else None,
            "clausulas": (str(r.get(c["clau"]) or "").strip()[:300] or None) if c["clau"] else None,
            "status_analise": (_limpa_glifo(r.get(c["stat"])) or None) if c["stat"] else None,
            "cross_matriz": (str(r.get(c["matriz"]) or "").strip() or None) if c["matriz"] else None,
            "impacta": _sim_nao(r.get(c["imp"])) if c["imp"] else None,
        })
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"eventos": eventos, "n": len(eventos), "status": status, "findings": findings}


def extrair_timeline_params(secoes: list[dict]) -> dict:
    """C.13 · Marcos Contratuais + Windows Analysis + Resumo/Cards (chave_valor) → params da timeline
    (OS real, término contratual, cards, windows). Junta as 3 seções chave_valor da C.13."""
    out: dict = {}
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "chave_valor":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "c13" not in t and "timeline" not in t:
            continue
        dados = s.get("dados") or {}
        if isinstance(dados, dict):
            for k, v in dados.items():
                out[_norm_key(k)] = v
    if not out:
        # dialeto SBSO: painel C.5 (inicioOSreal/bmCorrente/desvio_pp) + término contratual dos marcos
        kvp = None
        for s in secoes:
            dd = s.get("dados") if isinstance(s, dict) else None
            if isinstance(dd, dict) and any(_norm_key(k) == "inicioosreal" for k in dd):
                kvp = {_norm_key(k): v for k, v in dd.items()}
                break
        if kvp:
            term = None
            for s in secoes:
                if not isinstance(s, dict) or "marco" not in _norm_key(s.get("titulo") or ""):
                    continue
                for row in s.get("linhas") or []:
                    if isinstance(row, dict) and any(
                            "terminocontratual" in _norm_key(str(v)) for v in row.values() if isinstance(v, str)):
                        for v in row.values():
                            if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
                                term = v[:10]
                                break
                if term:
                    break
            _dpp = _num_limpo(kvp.get("desviopp"))
            _bm = _num_limpo(kvp.get("bmcorrente"))
            params2 = {
                "os_real": str(kvp.get("inicioosreal") or "")[:10] or None,
                "os_original": None, "termino_contratual": term,
                "inicio_execucao": str(kvp.get("inicioosreal") or "")[:10] or None,
                "termino_previsto": term,
                "mes_corte_indice": int(_bm) if isinstance(_bm, float) else None,
                "delta_impacto_fisico_pp": round(_dpp, 2) if isinstance(_dpp, float) else None,
                "windows_obs": None,
            }
            return {"params": params2, "status": "ok", "findings": []}
        return {"params": None, "status": "ok", "findings": []}


    def _i(k):  # int ou None
        n = _num_limpo(out.get(k))
        return int(n) if isinstance(n, float) else None

    def _f(k):  # float ou None
        n = _num_limpo(out.get(k))
        return n if isinstance(n, float) else None

    def _s(k):  # str ou None
        v = out.get(k)
        return str(v).strip() if v not in (None, "") else None

    params = {
        "os_real": _data_iso(out.get("ordemdeservicoreal")),
        "os_original": _data_iso(out.get("ordemdeservicooriginal")),
        "termino_contratual": _data_iso(out.get("terminocontratualreferencia")),
        "inicio_execucao": _s("iniciodaexecucao"),
        "termino_previsto": _s("terminoprevistodaexecucao"),
        "total_eventos": _i("totaldeeventos"),
        "eventos_climaticos": _i("eventosclimaticos"),
        "marcos_em_risco": _i("marcosemriscode24"),
        "marcos_cumpridos": _i("marcoscumpridosde24"),
        "marcos_total": 24 if "marcosemriscode24" in out else None,
        "criticos_impacto_fisico": _i("criticosimpactofisico"),
        "caminho_critico_dias": _f("caminhocriticomaisdiasinput"),
        "mes_corte_indice": _i("mesdecorteindice"),
        "avanco_fisico_previsto_pp": _f("avancofisicoprevistonoperiodopp"),
        "delta_impacto_fisico_pp": _f("deltaimpactofisicoprevistomenosrealpp"),
        "windows_obs": _s("obs"),
    }
    return {"params": params, "status": "ok", "findings": []}


def snapshot_excedente_params(secoes: list[dict]) -> dict:
    """Parâmetros/consolidação do D.5 (cl. 6.2/8.8) → âncoras do gate + header do banco:
    {excedenterepassavel88, somadeltabrutometodoativo, desequilibrioliquidoinsumos,
     insumosacimadoteto, pctsobrepv, reajustecontratualjapagoacum, fatorcestaabc, ...} (chaves
    normalizadas; numéricos) + {databaseorcamento, normativaaplicavel, metodoativo, farol} (texto).
    Quando há MAIS de uma seção candidata (ex.: extração antiga do D.5 pré-correção convivendo
    com a corrigida), prefere a que declara a chave da 8.8 ('excedenteRepassavel88')."""
    def _parse(s: dict) -> dict:
        out: dict = {}
        dados = s.get("dados") or {}
        for k, v in (dados.items() if isinstance(dados, dict) else []):
            n = _num_limpo(v)
            out[_norm_key(k)] = n if isinstance(n, float) else (str(v).strip() if v is not None else None)
        return out

    candidatas: list[dict] = []
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "chave_valor":
            continue
        t = _norm_key(s.get("titulo") or "")
        if "d5" in t and ("parametros" in t or "consolidacao" in t):
            candidatas.append(_parse(s))
    if not candidatas:
        return {}
    # Os params da D.5 vêm SPLIT em 2 seções (Parâmetros/Base = método+data-base; Consolidação =
    # Σ bruto/8.8/reajuste). Mescla TUDO: começa pela canônica (a que declara a 8.8) e PREENCHE as
    # chaves ausentes com as demais — senão método/data-base (só na Parâmetros) ficavam de fora.
    canonica = next((c for c in candidatas if "excedenterepassavel88" in c), candidatas[0])
    merged = dict(canonica)
    for c in candidatas:
        if c is canonica:
            continue
        for k, v in c.items():
            if merged.get(k) is None and v is not None:
                merged[k] = v
    return merged


def snapshot_abc_insumos(secoes: list[dict]) -> dict:
    """Curva ABC do C.6 → âncora de cross do gate do excedente: {nome_normalizado: {qtde, preco,
    classe, custo}}. O Bloco 5 repete qtd/preço orçado da ABC — têm que bater ao centavo."""
    for s in secoes:
        if not isinstance(s, dict) or s.get("tipo") != "tabela":
            continue
        t = _norm_key(s.get("titulo") or "")
        cols = s.get("colunas") or []
        if "curvaabc" in t and _achar_coluna(cols, "qtde contratada", "qtde") is not None:
            c_nome = cols[0]
            c_qtde = _achar_coluna(cols, "qtde contratada", "qtde")
            c_preco = _achar_coluna(cols, "preço orçado")
            c_classe = _achar_coluna_exata(cols, "classe")
            c_custo = _achar_coluna(cols, "custo total")
            out: dict = {}
            for r in (s.get("linhas") or []):
                if not isinstance(r, dict) or eh_linha_rotulo(r):
                    continue
                nome = str(r.get(c_nome) or "").strip()
                if not nome or nome.upper() == "TOTAL":
                    continue
                out[_norm_key(nome)] = {
                    "qtde": _num_limpo(r.get(c_qtde)),
                    "preco": _num_limpo(r.get(c_preco)) if c_preco else None,
                    "classe": str(r.get(c_classe) or "").strip() if c_classe else None,
                    "custo": _num_limpo(r.get(c_custo)) if c_custo else None,
                }
            return out
    return {}


# Farol canônico do excedente 8.8 (mesma régua da planilha · 4 níveis + pendente=None):
# sem índice → None · Δ<0 → 'Conforme · caiu' (sem repasse, 6.2.2) · excedente 0 → 'Conforme' ·
# ≤2pp → 'Observação' · ≤5pp → 'Risco' · >5pp → 'Crítico'. Compartilhado gate/quem precisar.
def derivar_farol_excedente(delta_pct, excedente_pct) -> str | None:  # noqa: ANN001
    if not isinstance(delta_pct, float):
        return None
    if delta_pct < 0:
        return "Conforme · caiu"
    exc = excedente_pct if isinstance(excedente_pct, float) else 0.0
    if exc <= 0:
        return "Conforme"
    if exc <= 0.02:
        return "Observação"
    if exc <= 0.05:
        return "Risco"
    return "Crítico"


# ── C.6/D.5 · MODELO FD (multifonte) — o que as TELAS leem (obra_insumos_fd/fontes/reeq/ipca) ────
def extrair_insumos_fd(secoes: list[dict]) -> dict:
    """C.6/D.5 fd — insumos de faturamento direto + fontes de índice + reequilíbrio.
    Variante FONTE ÚNICA (índice contratual · ex.: SBSO INCC-DI I03): a ABC de materiais
    da C.6 vira os insumos fd; a tabela de índices FGV vira a(s) fonte(s); os params de
    reajuste + PV/medição viram o reeq. Determinístico; conservação no gate (cards C.6)."""
    def _kv_all():
        out = {}
        for s in secoes:
            dd = s.get("dados") if isinstance(s, dict) else None
            if isinstance(dd, dict):
                for k, v in dd.items():
                    out.setdefault(_norm_key(k), v)
        return out
    kv = _kv_all()

    # ABC de materiais da C.6 (mesma seleção estrita da rota ABC)
    sec_abc = None
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if "c6" in t and "curvaabc" in t and s.get("linhas"):
            sec_abc = s
            break
    if sec_abc is None:
        return {"insumos": [], "fontes": [], "reeq": None, "serie": [], "cards": {},
                "n": 0, "status": "ok", "findings": []}

    # Tabela de índices (FGV/IBRE) — I01..I04 {codigo, serie, io, i, delta}
    indices = []
    for s in secoes:
        if not isinstance(s, dict) or not s.get("linhas"):
            continue
        t = _norm_key(s.get("titulo") or "")
        if "indice" in t and "reajuste" in t and _achar_coluna(s.get("colunas") or [], "io") is not None:
            for row in s["linhas"]:
                if not isinstance(row, dict):
                    continue
                cols = s.get("colunas") or []
                cc = _achar_coluna(cols, "codigo", "código")
                cs = _achar_coluna(cols, "serie", "série")
                cio = _achar_coluna(cols, "io")
                ci = _achar_coluna(cols, "i (reajuste)", "i reajuste")
                cd = next((c for c in cols if "%" in str(c)), None)  # Δ% (evita casar 'I (reajuste)')
                indices.append({
                    "codigo": str(row.get(cc) or "").strip(),
                    "serie": str(row.get(cs) or "").strip(),
                    "io": _num_limpo(row.get(cio)) if cio else None,
                    "i": _num_limpo(row.get(ci)) if ci else None,
                    "delta": _num_limpo(row.get(cd)) if cd else None,
                })
            break

    # Índice CONTRATUAL dos materiais (ex.: "INCC-DI Todos (I03)") → acha a linha do índice
    contratual_rot = str(kv.get("indicecontratual") or "").strip()
    m_cod = re.search(r"i\s*0?(\d)", contratual_rot.lower())
    cod_contratual = f"I 0{m_cod.group(1)}" if m_cod else None
    idx = next((x for x in indices if x["codigo"].replace(" ", "").lower() == (cod_contratual or "").replace(" ", "").lower()), None)
    reaj_acum = _num_limpo(kv.get("reajusteacumuladomai26frac")) or _num_limpo(
        next((v for k, v in kv.items() if k.startswith("reajusteacumulado")), None))
    if idx is None and reaj_acum is not None:
        idx = {"codigo": cod_contratual or "I", "serie": contratual_rot or "índice contratual",
               "io": None, "i": None, "delta": reaj_acum}

    cols = sec_abc.get("colunas") or []
    c_ins = _achar_coluna(cols, "insumo")
    c_und = _achar_coluna(cols, "und", "unidade")
    c_qtd = _achar_coluna(cols, "qtde contratada", "qtde", "quantidade")
    c_pre = _achar_coluna(cols, "preco orcado", "preço orçado")
    c_val = _achar_coluna(cols, "custo total", "valor orcado")
    c_cls = _achar_coluna(cols, "classe")
    fonte_id = (idx or {}).get("codigo", "idx").replace(" ", "").lower()
    insumos, fontes = [], []
    for i, row in enumerate([x for x in sec_abc.get("linhas") or [] if isinstance(x, dict)]):
        nome = str(row.get(c_ins) or "").strip()
        if not nome or "total" in _norm_key(nome):
            continue
        o = len(insumos)
        insumos.append({
            "ordem_abc": o, "nome": nome[:200],
            "unidade": (str(row.get(c_und)).strip() if c_und and row.get(c_und) else "—"),
            "classe": (str(row.get(c_cls)).strip()[:1].upper() if c_cls and row.get(c_cls) else "C"),
            "categoria": "MATERIAIS", "ordem_pq": None,
            # qtd/preço 0 nas linhas-balde (ex.: "Demais insumos") — NOT NULL no schema; o valor rege.
            "qtd_pq": (_num_limpo(row.get(c_qtd)) if c_qtd else None) or 0.0,
            "preco_unit_bdi": (_num_limpo(row.get(c_pre)) if c_pre else None) or 0.0,
            "valor_contrato_bdi": (_num_limpo(row.get(c_val)) if c_val else None) or 0.0,
            # NOT NULL no schema; 0 é o fato (nada medido de materiais até o BM · repasse real 0)
            "qtd_medida": 0.0, "valor_medido_bdi": 0.0,
            "fonte_recomendada": fonte_id,
        })
        fontes.append({
            "insumo_ordem": o, "ordem_opcao": 0, "fonte_id": fonte_id,
            "fonte": "FGV", "rotulo": (idx or {}).get("serie") or contratual_rot or "índice contratual",
            "codigo": (idx or {}).get("codigo"), "tipo": "indice",
            "valor_os": (idx or {}).get("io"), "valor_atual": (idx or {}).get("i"),
            "delta_pct": (idx or {}).get("delta"), "is_recomendada": True,
        })

    # Data da OS: marco contratual "Ordem de Serviço" na seção de Marcos & Eventos (determinístico)
    data_os = None
    for s2 in secoes:
        if not isinstance(s2, dict) or "marco" not in _norm_key(s2.get("titulo") or ""):
            continue
        for row in s2.get("linhas") or []:
            if isinstance(row, dict) and any(
                    "ordemdeservico" in _norm_key(str(v)) for v in row.values() if isinstance(v, str)):
                for v in row.values():
                    if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
                        data_os = v[:10]
                        break
            if data_os:
                break
        if data_os:
            break

    pv = _num_limpo(kv.get("precodevendapv")) or _num_limpo(kv.get("precovendapv")) or _num_limpo(kv.get("valorinicialdocontratopv"))
    medido = _num_limpo(kv.get("medicaopvacumuladaatebm"))
    _db_raw = str(kv.get("databaseorcamento") or kv.get("databasedoorcamento")
                  or next((v for k, v in kv.items() if k.startswith("database") and re.match(r"^\d{4}-", str(v))), "")
                  ).strip()[:10]
    _m_br = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", _db_raw)
    data_base = (f"{_m_br.group(3)}-{_m_br.group(2)}-{_m_br.group(1)}" if _m_br else _db_raw) or None
    reeq_data_verif = [None]
    reeq = {
        "ipca_periodo": reaj_acum, "ipca_atual": (idx or {}).get("i"),
        "contrato_cheio_bdi": pv, "medido_acumulado": medido,
        "saldo_a_executar": (pv - medido) if isinstance(pv, float) and isinstance(medido, float) else None,
        "reajuste_acumulado": reaj_acum,
        "data_os": data_os or data_base,  # NOT NULL; fallback documentado = data-base
        "data_verificacao": None,  # preenchida após a série (último dia do mês do índice)
        "data_assinatura": None,
        "data_proposta": data_base, "data_reajuste_aniversario": None, "data_verificacao_reeq": None,
        "cenario_m1_ativo": "database",
    }
    serie = []
    if data_base and (idx or {}).get("io") is not None:
        serie.append({"mes": data_base[:7], "indice": idx["io"], "cenario_id": "database",
                      "cenario_nome": "Data-base do orçamento", "cenario_desc": f"Io {contratual_rot}".strip()})
    if (idx or {}).get("i") is not None:
        mes_atual = "2026-05" if any("mai26" in k for k in kv) else "atual"
        if re.match(r"^\d{4}-\d{2}$", mes_atual):
            import calendar as _cal
            _y, _m = int(mes_atual[:4]), int(mes_atual[5:7])
            reeq_data_verif[0] = f"{mes_atual}-{_cal.monthrange(_y, _m)[1]:02d}"
        serie.append({"mes": mes_atual, "indice": idx["i"], "cenario_id": None,
                      "cenario_nome": None, "cenario_desc": None})

    if reeq_data_verif[0]:
        reeq["data_verificacao"] = reeq_data_verif[0]
    if not reeq.get("data_verificacao"):
        reeq["data_verificacao"] = reeq.get("data_os") or data_base

    cards = {"n_monitorados": _num_limpo(kv.get("insumosmonitorados")),
             "valor_orcado": _num_limpo(kv.get("valorcontratadoorcado")) or _num_limpo(
                 next((v for k, v in kv.items() if k.startswith("materiaisvalororcadototal")), None))}
    return {"insumos": insumos, "fontes": fontes, "reeq": reeq, "serie": serie, "cards": cards,
            "n": len(insumos), "status": "ok", "findings": []}


# ── MEDIÇÕES DO WORKBOOK — FONTE-MEDICAO01..NN → obra_medicoes/itens/totais ─────────────────────
_MESES_PT = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
             "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}


def _edt_depoison(v) -> str | None:  # noqa: ANN001
    """Código EDT que o Excel converteu em data ('01.01.01'→2001-01-01) volta a código.
    dd.mm.aa ← (day, month, year−2000). Strings normais passam intactas."""
    if v is None:
        return None
    s = str(v).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m and int(m.group(1)) < 2100:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 2000 <= y <= 2099:
            return f"{d:02d}.{mo:02d}.{y - 2000:02d}"
    return s[:40] or None


def extrair_medicoes_workbook(secoes: list[dict]) -> dict:
    """BMs consolidados no workbook (FONTE-MEDICAO*) → medições canônicas. Duas gramáticas:
    export MS-Project (Item/Nome da Tarefa/Custo…) e planilha oficial (ITEM/DESCRIÇÃO/PREÇO…).
    Totais por BM = faturas da D.7 (valor bruto · determinístico) com acumulado=cumsum; físico
    acumulado = curva física (Real % acum FISICO) no mês do BM. Códigos EDT des-envenenados."""
    findings: list[dict] = []
    # faturas da D.7 → {bm: valor_bruto}
    fat_bm: dict[int, float] = {}
    for s in secoes:
        if not isinstance(s, dict) or not s.get("linhas"):
            continue
        cols = s.get("colunas") or []
        if _achar_coluna(cols, "valor bruto") is None or _achar_coluna(cols, "bm / m", "bm/m", "bm") is None:
            continue
        cbm = _achar_coluna(cols, "nf / fatura", "nf/fatura") or _achar_coluna(cols, "bm / m", "bm")
        cv = _achar_coluna(cols, "valor bruto")
        for row in s["linhas"]:
            if not isinstance(row, dict):
                continue
            mnum = re.search(r"(\d+)", str(row.get(cbm) or ""))
            v = _num_limpo(row.get(cv))
            if mnum and isinstance(v, float):
                fat_bm[int(mnum.group(1))] = v
        if fat_bm:
            break
    # curva física → {(ano,mes): real_fisico_acum (fração)}
    fis_mes: dict[tuple[int, int], float] = {}
    for s in secoes:
        if not isinstance(s, dict) or not s.get("linhas"):
            continue
        cols = s.get("colunas") or []
        c_rf = next((c for c in cols if "real" in _norm_key(str(c)) and "fisico" in _norm_key(str(c))), None)
        c_ms = _achar_coluna(cols, "mês", "mes")
        if c_rf is None or c_ms is None:
            continue
        for row in s["linhas"]:
            if not isinstance(row, dict):
                continue
            lbl = str(row.get(c_ms) or "").strip().lower()
            m2 = re.match(r"^([a-zç]{3})[/-](\d{2})$", lbl)
            v = _num_limpo(row.get(c_rf))
            if m2 and m2.group(1)[:3] in _MESES_PT and isinstance(v, float):
                fis_mes[(2000 + int(m2.group(2)), _MESES_PT[m2.group(1)[:3]])] = v if v <= 1.5 else v / 100.0
        if fis_mes:
            break

    medicoes: list[dict] = []
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = s.get("titulo") or ""
        mbm = re.search(r"boletim de medi[çc][aã]o\s*0?(\d+)", t.lower())
        if not mbm or not s.get("linhas"):
            continue
        bm = int(mbm.group(1))
        mper = re.search(r"[–-](\d{2})/(\d{2})/(\d{4})", t)
        ano = int(mper.group(3)) if mper else None
        mes = int(mper.group(2)) if mper else None
        data_corte = f"{mper.group(3)}-{mper.group(2)}-{mper.group(1)}" if mper else None
        cols = s.get("colunas") or []
        c = {
            "num": _achar_coluna(cols, "item"),
            "desc": _achar_coluna(cols, "nome da tarefa", "descrição do serviço", "descricao do servico"),
            "und": _achar_coluna(cols, "und", "unid"),
            "qt": _achar_coluna(cols, "quantidade total", "quant."),
            "pu": _achar_coluna(cols, "custo unitário", "custo unitario", "preço unitário", "preco unitario"),
            "vc": _achar_coluna(cols, "custo total", "preço total", "preco total"),
            "qp": _achar_coluna(cols, "quantidade no período", "quantidade no periodo"),
            "vp": _achar_coluna(cols, "valor (r$) no período", "valor no periodo"),
            "qa": _achar_coluna(cols, "quantidade acumulada"),
            "va": _achar_coluna(cols, "valor (r$) acumulado", "valor acumulado"),
        }
        if c["num"] is None or c["desc"] is None:
            continue
        itens: list[dict] = []
        for row in s["linhas"]:
            if not isinstance(row, dict):
                continue
            num = _edt_depoison(row.get(c["num"]))
            desc = str(row.get(c["desc"]) or "").strip()
            if not num and not desc:
                continue
            def g(k, _r=row):  # noqa: ANN001
                v = _num_limpo(_r.get(c[k])) if c[k] else None
                return v if isinstance(v, float) else None
            itens.append({
                "ordem": len(itens), "numero_item": (num or "—")[:40],
                "nivel": (num.count(".") + 1) if num else None,
                "descricao": desc[:300] or None,
                "unidade": (str(row.get(c["und"])).strip()[:20] if c["und"] and row.get(c["und"]) else None),
                "quantidade_contratada": g("qt"), "preco_unitario": g("pu"),
                "valor_contratado": g("vc"), "quantidade_periodo": g("qp"),
                "valor_medido_periodo": g("vp"), "quantidade_acumulada": g("qa"),
                "valor_medido_acumulado": g("va"), "percentual_executado": None,
            })
        if not itens:
            continue
        medicoes.append({"bm_numero": bm, "ano": ano, "mes": mes, "data_corte": data_corte,
                         "itens": itens})
    medicoes.sort(key=lambda m: m["bm_numero"])
    acum = 0.0
    for m in medicoes:
        vper = fat_bm.get(m["bm_numero"])
        if vper is not None:
            acum = round(acum + vper, 2)
        fis = fis_mes.get((m["ano"], m["mes"])) if m["ano"] and m["mes"] else None
        m["totais"] = {
            "total_periodo_valor": vper,
            "total_acumulado_valor": acum if vper is not None else None,
            "fisico_pct_periodo": None,
            "fisico_pct_acumulado": fis,
            "fonte": "workbook-motor (faturas D.7 + curva física)",
        }
        if vper is None:
            findings.append({"severity": "warn", "campo": f"bm{m['bm_numero']}",
                             "msg": f"BM {m['bm_numero']}: sem valor bruto na D.7 — totais pendentes"})
    status = "needs_review" if any(f["severity"] == "error" for f in findings) else "ok"
    return {"medicoes": medicoes, "n": len(medicoes), "status": status, "findings": findings}
