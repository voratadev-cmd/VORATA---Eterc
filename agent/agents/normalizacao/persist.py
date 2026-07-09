"""Persistência da normalização · lê a extração e faz UPSERT idempotente nas tabelas canônicas.

Idempotente por (contrato_id, bm_numero, arquivo_id, extracao_version): re-normalizar a mesma
contribuição substitui (não duplica). service_role bypassa RLS (só roda no backend).
"""

from __future__ import annotations

from services.supabase_client import supabase

from .resolvers import tokens_obra_de

# Colunas que o engine pode emitir num item (whitelist · só o que existe no DDL).
_ITEM_COLS = (
    "ordem", "numero_item", "nivel", "descricao", "unidade",
    "quantidade_contratada", "preco_unitario", "valor_contratado",
    "quantidade_periodo", "valor_medido_periodo",
    "quantidade_acumulada", "valor_medido_acumulado", "percentual_executado",
)
_TOTAIS_COLS = ("total_periodo_valor", "total_acumulado_valor",
                "fisico_pct_periodo", "fisico_pct_acumulado")
# Colunas do mês do cronograma (whitelist · só o que existe no DDL da migration 0004).
_MES_COLS = (
    "ordem", "ano", "mes", "competencia_chave",
    "previsto_pct", "previsto_pct_acumulado", "previsto_financeiro_declarado",
    "real_pct", "real_pct_acumulado",
)


def atualizar_obra_reajuste(contrato_id: str, indice: str | None, periodicidade: str | None) -> None:
    """Atualiza o cadastro da obra com o índice + periodicidade de reajuste (do PSP). Só escreve
    campos não-nulos — não apaga o que já houver."""
    patch: dict = {}
    if indice:
        patch["indice_reajuste"] = indice
    if periodicidade:
        patch["periodicidade_reajuste"] = periodicidade
    if patch:
        supabase.table("obras").update(patch).eq("id", contrato_id).execute()


def carregar_identidade_obra(contrato_id: str) -> list[str]:
    """Tokens distintivos da obra (do cadastro `obras`) p/ o gate de pertinência. Lista vazia se o
    cadastro não tem identidade — o gate então passa (não bloqueia sem base)."""
    resp = (
        supabase.table("obras")
        .select("nome_interno, cidade, uf, contratante")
        .eq("id", contrato_id)
        .limit(1)
        .execute()
    )
    o = (resp.data or [{}])[0]
    return tokens_obra_de(o.get("nome_interno"), o.get("cidade"), o.get("uf"), o.get("contratante"))


def load_latest_extracao(arquivo_id: str) -> dict | None:
    """Última versão da extração de um arquivo (payload + version + doc_type)."""
    resp = (
        supabase.table("obra_arquivo_extracoes")
        .select("payload, version, doc_type")
        .eq("arquivo_id", arquivo_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


def upsert_medicao(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    comp: dict,
    config_version: str,
    status: str,
    itens: list[dict],
    totais: dict,
) -> str:
    """Grava a medição canônica. VIGENTE POR (contrato, bm_numero): re-envio do BM corrigido
    (arquivo novo) ou re-extração (versão nova) SUBSTITUI a contribuição anterior do mesmo BM —
    nunca duas medições do mesmo BM somando em dobro. UPSERT da row-mãe + REPLACE dos itens +
    UPSERT dos totais. Retorna o medicao_id."""
    # apaga contribuições ANTERIORES do mesmo BM (outro arquivo/versão) com os filhos.
    # NÃO-transacional por design (PostgREST): se o insert abaixo falhar, o BM fica ausente
    # até o retry — fail-loud visível (normalizacao_error re-roda), nunca soma dobrada.
    antigas = (
        supabase.table("obra_medicoes").select("id, arquivo_id, extracao_version")
        .eq("contrato_id", contrato_id).eq("bm_numero", comp["bm_numero"]).execute()
    )
    for r in antigas.data or []:
        if r["arquivo_id"] == arquivo_id and r["extracao_version"] == extracao_version:
            continue  # a própria contribuição (re-normalização) — o upsert/replace abaixo cuida
        supabase.table("obra_medicao_itens").delete().eq("medicao_id", r["id"]).execute()
        supabase.table("obra_medicao_totais").delete().eq("medicao_id", r["id"]).execute()
        supabase.table("obra_medicoes").delete().eq("id", r["id"]).execute()

    med_row = {
        "contrato_id": contrato_id,
        "arquivo_id": arquivo_id,
        "extracao_version": extracao_version,
        "bm_numero": comp["bm_numero"],
        "ano": comp.get("ano"),
        "mes": comp.get("mes"),
        "config_version": config_version,
        "status": status,
    }
    up = (
        supabase.table("obra_medicoes")
        .upsert(med_row, on_conflict="contrato_id,bm_numero,arquivo_id,extracao_version")
        .execute()
    )
    medicao_id = up.data[0]["id"]

    # itens · replace (a contribuição é imutável; re-normalizar regrava limpo)
    supabase.table("obra_medicao_itens").delete().eq("medicao_id", medicao_id).execute()
    if itens:
        rows = [{"medicao_id": medicao_id, **{k: it[k] for k in _ITEM_COLS if k in it}} for it in itens]
        supabase.table("obra_medicao_itens").insert(rows).execute()

    # totais · upsert pela PK (medicao_id)
    if totais:
        supabase.table("obra_medicao_totais").upsert(
            {"medicao_id": medicao_id, "fonte": "totais_declarados",
             **{k: totais[k] for k in _TOTAIS_COLS if k in totais}}
        ).execute()

    return medicao_id


def upsert_cronograma(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    header: dict,
    meses: list[dict],
) -> str:
    """Grava o cronograma previsto canônico. UPSERT da row-mãe (obra_cronogramas) + REPLACE
    dos meses (obra_cronograma_meses). Idempotente por (contrato_id, arquivo_id,
    extracao_version). Retorna o cronograma_id."""
    cron_row = {
        "contrato_id": contrato_id,
        "arquivo_id": arquivo_id,
        "extracao_version": extracao_version,
        "config_version": config_version,
        "status": status,
        "custo_total_obra": header.get("custo_total_obra"),
        "data_base": header.get("data_base"),
        "inicio_obra": header.get("inicio_obra"),
        "termino_obra": header.get("termino_obra"),
    }
    up = (
        supabase.table("obra_cronogramas")
        .upsert(cron_row, on_conflict="contrato_id,arquivo_id,extracao_version")
        .execute()
    )
    cronograma_id = up.data[0]["id"]

    # meses · replace (a contribuição é imutável; re-normalizar regrava limpo)
    supabase.table("obra_cronograma_meses").delete().eq("cronograma_id", cronograma_id).execute()
    if meses:
        rows = [{"cronograma_id": cronograma_id, **{k: m[k] for k in _MES_COLS if k in m}} for m in meses]
        supabase.table("obra_cronograma_meses").insert(rows).execute()

    return cronograma_id


# Colunas do mês da curva de faturamento (whitelist · migration 0005 + real 20260606000001).
_FAT_MES_COLS = (
    "ordem", "ano", "mes",
    "contratado_rs", "contratado_rs_acumulado",
    "projecao_rs", "projecao_rs_acumulado", "tipo_projecao",
    "real_rs", "real_rs_acumulado",
)


def upsert_faturamento_curva(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    header: dict,
    meses: list[dict],
) -> str:
    """Grava a Curva S financeira (obra_faturamento_curvas + REPLACE dos meses). Idempotente
    por (contrato_id, arquivo_id, extracao_version). Retorna o curva_id."""
    cur_row = {
        "contrato_id": contrato_id,
        "arquivo_id": arquivo_id,
        "extracao_version": extracao_version,
        "config_version": config_version,
        "status": status,
        "custo_total": header.get("custo_total"),
        "data_corte": header.get("data_corte"),
    }
    up = (
        supabase.table("obra_faturamento_curvas")
        .upsert(cur_row, on_conflict="contrato_id,arquivo_id,extracao_version")
        .execute()
    )
    curva_id = up.data[0]["id"]

    supabase.table("obra_faturamento_meses").delete().eq("curva_id", curva_id).execute()
    if meses:
        rows = [{"curva_id": curva_id, **{k: m[k] for k in _FAT_MES_COLS if k in m}} for m in meses]
        supabase.table("obra_faturamento_meses").insert(rows).execute()

    return curva_id


_ORC_ITEM_COLS = (
    "ordem", "numero_item", "nivel", "descricao", "unidade",
    "quantidade", "custo_unitario", "custo_total",
)


def upsert_orcamento(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    resumo: dict,
    itens: list[dict],
) -> str:
    """Grava o orçamento (obra_orcamentos header/resumo + REPLACE dos itens BASE1). Idempotente
    por (contrato_id, arquivo_id, extracao_version). Retorna o orcamento_id."""
    orc_row = {
        "contrato_id": contrato_id,
        "arquivo_id": arquivo_id,
        "extracao_version": extracao_version,
        "config_version": config_version,
        "status": status,
        "preco_venda": resumo.get("preco_venda"),
        "custo_direto": resumo.get("custo_direto"),
        "custo_indireto": resumo.get("custo_indireto"),
        "custo_total_atividades": resumo.get("custo_total_atividades"),
        "receita": resumo.get("receita"),
        "bdi": resumo.get("bdi"),
    }
    up = (
        supabase.table("obra_orcamentos")
        .upsert(orc_row, on_conflict="contrato_id,arquivo_id,extracao_version")
        .execute()
    )
    orcamento_id = up.data[0]["id"]

    supabase.table("obra_orcamento_itens").delete().eq("orcamento_id", orcamento_id).execute()
    if itens:
        rows = [{"orcamento_id": orcamento_id, **{k: it[k] for k in _ORC_ITEM_COLS if k in it}} for it in itens]
        supabase.table("obra_orcamento_itens").insert(rows).execute()

    return orcamento_id


_TAREFA_COLS = (
    "ordem", "numero_item", "codigo", "nivel", "nome", "unidade", "quantidade",
    "duracao_dias", "data_inicio", "data_termino", "eh_marco",
    "data_inicio_real", "data_termino_real", "desvio_dias", "pct_concluido",  # eixo real (C.13)
)


def upsert_cronograma_tarefas(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    tarefas: list[dict],
) -> int:
    """Grava as tarefas do cronograma-fonte (tabela flat). Idempotente: REPLACE por
    (contrato_id, arquivo_id, extracao_version). Retorna o nº de tarefas gravadas."""
    (
        supabase.table("obra_cronograma_tarefas")
        .delete()
        .eq("contrato_id", contrato_id)  # vigente POR OBRA
        .execute()
    )
    if tarefas:
        rows = [
            {
                "contrato_id": contrato_id,
                "arquivo_id": arquivo_id,
                "extracao_version": extracao_version,
                "config_version": config_version,
                "status": status,
                **{k: t[k] for k in _TAREFA_COLS if k in t},
            }
            for t in tarefas
        ]
        supabase.table("obra_cronograma_tarefas").insert(rows).execute()
    return len(tarefas)


# Colunas do insumo (whitelist · DDL da migration 0001 insumos). ABC/grupo/preço = enriquecimento.
_INSUMO_COLS = ("codigo", "descricao", "unidade", "qtde_total",
                "classe_abc", "grupo_custo", "preco_orcado_unit", "valor_orcado",
                "preco_reajustado_unit", "preco_real_pago_unit")


def upsert_insumos(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    insumos: list[dict],
    meses: list[dict],
) -> tuple[int, int]:
    """Grava o take-off físico de insumos (2 tabelas flat). VIGENTE POR OBRA: hoje só o
    Histograma de Insumos tem rota própria (o Catálogo/Valor entram como ENRIQUECIMENTO
    cross-doc, sem upsert próprio) — se um dia o Catálogo ganhar rota que escreva aqui,
    REVER este delete (apagaria a contribuição do outro doc). Retorna (n_insumos, n_meses)."""
    for tbl in ("obra_insumo_meses", "obra_insumos"):
        (
            supabase.table(tbl)
            .delete()
            .eq("contrato_id", contrato_id)  # vigente POR OBRA
            .execute()
        )
    base = {
        "contrato_id": contrato_id,
        "arquivo_id": arquivo_id,
        "extracao_version": extracao_version,
        "config_version": config_version,
    }
    if insumos:
        rows = [{**base, "status": status, **{k: i.get(k) for k in _INSUMO_COLS}} for i in insumos]
        supabase.table("obra_insumos").insert(rows).execute()
    if meses:
        mrows = [{**base, "codigo": m["codigo"], "ano": m["ano"], "mes": m["mes"], "qtde": m["qtde"]}
                 for m in meses]
        # insere em lotes (1428 linhas) para não estourar o payload do PostgREST
        for k in range(0, len(mrows), 500):
            supabase.table("obra_insumo_meses").insert(mrows[k:k + 500]).execute()
    return len(insumos), len(meses)


# Colunas dos recursos (whitelist · DDL da migration 0002 recursos).
_RECURSO_COLS = ("categoria", "recurso", "ordem",
                 "contratado_qtde", "real_qtde", "contratado_rs", "real_rs")
_RECURSO_MES_COLS = ("categoria", "ano", "mes", "periodo_label",
                     "contratado_qtde", "real_qtde", "contratado_rs", "real_rs")


def upsert_recursos(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    itens: list[dict],
    meses: list[dict],
) -> tuple[int, int]:
    """Grava o plano de recursos (itens + histograma mensal · 2 tabelas flat). Idempotente:
    REPLACE por (contrato_id, arquivo_id, extracao_version). Retorna (n_itens, n_linhas_mes)."""
    for tbl in ("obra_recursos_meses", "obra_recursos"):
        (
            supabase.table(tbl)
            .delete()
            .eq("contrato_id", contrato_id)  # vigente POR OBRA
            .execute()
        )
    base = {
        "contrato_id": contrato_id,
        "arquivo_id": arquivo_id,
        "extracao_version": extracao_version,
        "config_version": config_version,
    }
    if itens:
        rows = [{**base, "status": status, **{k: i.get(k) for k in _RECURSO_COLS}} for i in itens]
        for k in range(0, len(rows), 500):
            supabase.table("obra_recursos").insert(rows[k:k + 500]).execute()
    if meses:
        mrows = [{**base, **{k: m.get(k) for k in _RECURSO_MES_COLS}} for m in meses]
        for k in range(0, len(mrows), 500):
            supabase.table("obra_recursos_meses").insert(mrows[k:k + 500]).execute()
    return len(itens), len(meses)


# Colunas do resumo de produtividade (whitelist · DDL da migration 0003).
_PROD_COLS = ("aco_total_kg", "person_horas_total", "produtividade_real_kg_ph",
              "avanco_fisico_pct", "indice_perda_pct_raw")


def upsert_produtividade(
    *,
    contrato_id: str,
    arquivo_id: str,
    extracao_version: int,
    config_version: str,
    status: str,
    resumo: dict,
    meses: list[dict],
) -> tuple[str, int]:
    """Grava a produtividade física (resumo + meses). MULTI-DOC: cada arquivo (controle de
    armação/concreto do mês) é uma contribuição própria — vigente POR (contrato, arquivo):
    re-extração do mesmo arquivo substitui; arquivos de outros meses coexistem.
    Retorna (produtividade_id, n_meses)."""
    old = (
        supabase.table("obra_produtividade")
        .select("id")
        .eq("contrato_id", contrato_id)
        .eq("arquivo_id", arquivo_id)
        .execute()
    )
    for r in old.data or []:
        supabase.table("obra_produtividade_meses").delete().eq("produtividade_id", r["id"]).execute()
    (
        supabase.table("obra_produtividade")
        .delete()
        .eq("contrato_id", contrato_id)
        .eq("arquivo_id", arquivo_id)  # vigente POR (obra, arquivo) — multi-doc mensal
        .execute()
    )
    head = {
        "contrato_id": contrato_id, "arquivo_id": arquivo_id,
        "extracao_version": extracao_version, "config_version": config_version,
        "status": status, **{k: resumo.get(k) for k in _PROD_COLS},
    }
    ins = supabase.table("obra_produtividade").insert(head).execute()
    prod_id = ins.data[0]["id"]
    if meses:
        rows = [{"produtividade_id": prod_id, "contrato_id": contrato_id,
                 "ano": m["ano"], "mes": m["mes"],
                 "aco_kg": m.get("aco_kg"), "person_horas": m.get("person_horas")} for m in meses]
        supabase.table("obra_produtividade_meses").insert(rows).execute()
    return prod_id, len(meses)


def buscar_extracao_por_doctype(contrato_id: str, substrings: tuple[str, ...]) -> dict | None:
    """Acha a última extração de um arquivo DESTA obra cujo doc_type casa (substring, case-insens).
    Cross-doc: ex. o handler de Insumos busca o Cadastro/Curva ABC (doc SEPARADO) p/ enriquecer
    classe ABC. None se nenhum casa — o chamador degrada gracioso (não falha). Confere o doc_type
    LEVE primeiro (sem puxar payload) e só carrega o payload do que casou."""
    arqs = supabase.table("obra_arquivos").select("id").eq("obra_id", contrato_id).execute()
    subs = [s.lower() for s in substrings]
    for a in arqs.data or []:
        meta = (
            supabase.table("obra_arquivo_extracoes")
            .select("doc_type")
            .eq("arquivo_id", a["id"])
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        rows = meta.data or []
        if rows and any(s in (rows[0].get("doc_type") or "").lower() for s in subs):
            return load_latest_extracao(a["id"])  # só agora puxa o payload (grande)
    return None


# Colunas da produtividade econômica (whitelist · migration 0003 produtividade_economica).
_PROD_ECON_COLS = ("ano", "mes", "periodo_label", "faturado_rs", "hh_previsto",
                   "hh_real", "rs_por_hh", "aderencia")


def upsert_produtividade_economica(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, meses: list[dict],
) -> int:
    """Grava a série de produtividade econômica (tabela flat). Idempotente: REPLACE por
    (contrato_id, arquivo_id, extracao_version). Retorna n_meses."""
    (
        supabase.table("obra_produtividade_economica").delete()
        .eq("contrato_id", contrato_id).execute()  # vigente POR OBRA
    )
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if meses:
        rows = [{**base, "status": status, **{k: m.get(k) for k in _PROD_ECON_COLS}} for m in meses]
        for k in range(0, len(rows), 500):
            supabase.table("obra_produtividade_economica").insert(rows[k:k + 500]).execute()
    return len(meses)


# ── C.7 Produtividade · refactor (params + física + detalhe + impedimentos) ───────────────────
_PROD_PARAMS_COLS = ("bm_corrente", "base_hh", "valor_total_contratado", "jornada_mod_h_mes",
                     "jornada_moi_h_mes", "contratada_periodo_rs_hh", "faturado_acum_rs",
                     "hh_real_acum", "hh_contratado_acum", "real_acum_rs_hh", "real_mes_rs_hh",
                     "aderencia_acum", "meta_projeto_rs_hh", "farol_aderencia", "cambio",
                     "bmk_aterpa_rs_hh", "bmk_setor_rs_hh", "real_div_aterpa", "real_div_setor",
                     "farol_bmk", "ponte_pct_liberado", "ponte_pct_aproveitamento",
                     "ponte_pct_capacidade", "ponte_ociosidade_hh")
_PROD_FIS_COLS = ("ordem", "disciplina", "servico", "trecho", "unidade", "qtd_contratada",
                  "qtd_medida", "pct_fisico", "cpu_un_h", "real_un_h", "aderencia", "farol")
_PROD_FIS_DET_COLS = ("ordem", "servico", "frente", "unidade", "cpu_un_h", "equip_principal",
                      "qtd_executada", "dias_servico", "equip_dia", "equip_horas", "real_un_h",
                      "aderencia", "farol")
_PROD_IMPED_COLS = ("ordem", "impedimento", "periodo", "hh_ociosas")


def upsert_produtividade_params(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, params: dict,
) -> int:
    """Grava os params/cards + benchmarks + meta REAL + ponte do C.7 (1 linha). Replace POR OBRA."""
    supabase.table("obra_produtividade_params").delete().eq("contrato_id", contrato_id).execute()
    if params:
        row = {"contrato_id": contrato_id, "arquivo_id": arquivo_id, "extracao_version": extracao_version,
               "config_version": config_version, "status": status,
               **{k: params.get(k) for k in _PROD_PARAMS_COLS}}
        supabase.table("obra_produtividade_params").insert(row).execute()
        return 1
    return 0


def _upsert_prod_lista(table: str, cols: tuple, *, contrato_id, arquivo_id, extracao_version,  # noqa: ANN001
                       config_version, status, linhas) -> int:
    supabase.table(table).delete().eq("contrato_id", contrato_id).execute()
    if linhas:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": status, **{k: r.get(k) for k in cols}} for r in linhas]
        supabase.table(table).insert(rows).execute()
    return len(linhas)


def upsert_produtividade_fisica(*, contrato_id, arquivo_id, extracao_version, config_version, status, linhas):  # noqa: ANN001
    """Tracker de produtividade física serviço×trecho (C.7). Replace POR OBRA."""
    return _upsert_prod_lista("obra_produtividade_fisica", _PROD_FIS_COLS, contrato_id=contrato_id,
                              arquivo_id=arquivo_id, extracao_version=extracao_version,
                              config_version=config_version, status=status, linhas=linhas)


def upsert_produtividade_fisica_detalhe(*, contrato_id, arquivo_id, extracao_version, config_version, status, linhas):  # noqa: ANN001
    """Detalhe do cálculo por equipamento (C.7 · Trecho 1). Replace POR OBRA."""
    return _upsert_prod_lista("obra_produtividade_fisica_detalhe", _PROD_FIS_DET_COLS, contrato_id=contrato_id,
                              arquivo_id=arquivo_id, extracao_version=extracao_version,
                              config_version=config_version, status=status, linhas=linhas)


def upsert_produtividade_impedimento(*, contrato_id, arquivo_id, extracao_version, config_version, status, linhas):  # noqa: ANN001
    """Impedimentos documentados (C.7 · D.6 · HH ociosas). Replace POR OBRA."""
    return _upsert_prod_lista("obra_produtividade_impedimento", _PROD_IMPED_COLS, contrato_id=contrato_id,
                              arquivo_id=arquivo_id, extracao_version=extracao_version,
                              config_version=config_version, status=status, linhas=linhas)


# ── D.6 Análises Pontuais (migration 0005 pontuais_d6) ───────────────────────────────────────────
_PONT_EVT_COLS = ("ordem", "categoria", "titulo", "periodo", "duracao", "descricao", "dias",
                  "mod_total", "mod_frentes_ativas", "mod_afetado", "eqp_total",
                  "eqp_frentes_ativas", "eqp_afetado", "hh_ociosas", "heq_ociosas",
                  "custo_mod_rs", "custo_eqp_rs", "custo_rs", "fonte")
_PONT_CHUVA_M_COLS = ("ordem", "mes_label", "real_5mm", "prev_5mm", "excedente", "fracao_excedente",
                      "pleiteavel_mod_rs", "pleiteavel_eqp_rs", "total_mes_rs")
_PONT_CHUVA_D_COLS = ("ordem", "data_label", "chuva_mm", "acima_5mm", "periodos_afetados",
                      "efetivo_rdo", "hh_ociosas", "custo_ocioso_rs", "equip_producao",
                      "heq_ociosas", "custo_eqp_rs")
_PONT_PARAMS_COLS = ("jornada_dia_h", "custo_hora_mod_rs", "custo_hora_eqp_rs", "perda_validada_rs",
                     "pendente_total_rs", "eventos_pendentes", "farol")


def upsert_pontuais_eventos(*, contrato_id, arquivo_id, extracao_version, config_version, status, linhas):  # noqa: ANN001
    """4 eventos D.6 (chuva + impedimentos) · status POR LINHA (pendente de revisão). Replace POR OBRA."""
    supabase.table("obra_pontuais_evento").delete().eq("contrato_id", contrato_id).execute()
    if linhas:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": r.get("status") or status, **{k: r.get(k) for k in _PONT_EVT_COLS}}
                for r in linhas]
        supabase.table("obra_pontuais_evento").insert(rows).execute()
    return len(linhas)


def upsert_pontuais_chuva_mensal(*, contrato_id, arquivo_id, extracao_version, config_version, status, linhas):  # noqa: ANN001
    """Apuração mês a mês da chuva (memória do pleiteável). Replace POR OBRA."""
    return _upsert_prod_lista("obra_pontuais_chuva_mensal", _PONT_CHUVA_M_COLS, contrato_id=contrato_id,
                              arquivo_id=arquivo_id, extracao_version=extracao_version,
                              config_version=config_version, status=status, linhas=linhas)


def upsert_pontuais_chuva_dia(*, contrato_id, arquivo_id, extracao_version, config_version, status, linhas):  # noqa: ANN001
    """Ociosidade por chuva dia a dia (equipe afetada). Replace POR OBRA."""
    return _upsert_prod_lista("obra_pontuais_chuva_dia", _PONT_CHUVA_D_COLS, contrato_id=contrato_id,
                              arquivo_id=arquivo_id, extracao_version=extracao_version,
                              config_version=config_version, status=status, linhas=linhas)


def upsert_pontuais_params(*, contrato_id, arquivo_id, extracao_version, config_version, status, params):  # noqa: ANN001
    """Params D.6 (jornada/custos) + resumo dos Cards (validada 0 / pendente / nº / farol). Replace POR OBRA."""
    supabase.table("obra_pontuais_params").delete().eq("contrato_id", contrato_id).execute()
    if params:
        row = {"contrato_id": contrato_id, "arquivo_id": arquivo_id, "extracao_version": extracao_version,
               "config_version": config_version, "status": status,
               **{k: params.get(k) for k in _PONT_PARAMS_COLS}}
        supabase.table("obra_pontuais_params").insert(row).execute()
        return 1
    return 0


# Colunas da rubrica de BDI (whitelist · migration 0004 bdi_rubricas).
_BDI_COLS = ("ordem", "descricao", "pct_receita", "pct_custo_direto", "valor_rs",
             "pct_receita_implicito", "eh_subtotal")


def upsert_bdi_rubricas(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, rubricas: list[dict],
) -> int:
    """Grava as rubricas do BDI (C.1 · FONTE-MÃE). Idempotente: REPLACE por (contrato, arquivo,
    version). Retorna n_rubricas."""
    (
        supabase.table("obra_bdi_rubricas").delete()
        .eq("contrato_id", contrato_id).execute()  # vigente POR OBRA
    )
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if rubricas:
        rows = [{**base, "status": status, **{k: r.get(k) for k in _BDI_COLS}} for r in rubricas]
        for k in range(0, len(rows), 500):
            supabase.table("obra_bdi_rubricas").insert(rows[k:k + 500]).execute()
    return len(rubricas)


# ── D.2 BDI desequilíbrio (view própria · ≠ composição C.1) ───────────────────────────────────
_BDI_DESEQ_COLS = ("pv_rs", "bdi_declarado", "custo_direto_rs", "custo_indireto_rs", "bm_corrente",
                   "meses_contratuais", "medicao_acum_rs", "meses_extensao", "desequilibrio_rs",
                   "pct_sobre_pv", "custo_mensal_tempo_rs", "gasto_teorico_acum_rs",
                   "remunerado_acum_rs", "valor_total_contrato_rs", "overhead_mes_rs",
                   "projecao_extensao_rs", "delta_reducao_rs", "farol")
_BDI_RUB_TEMPO_COLS = ("ordem", "rubrica", "tipo", "pct_rubrica", "valor_contrato_rs",
                       "incorrido_mes_rs", "gasto_teorico_acum_rs", "remunerado_acum_rs",
                       "desequilibrio_rs", "obs")
_BDI_PERDA_COLS = ("ordem", "bm", "mes_label", "gasto_teorico_mes_rs", "remunerado_mes_rs",
                   "perda_mes_rs", "perda_acum_rs")


def upsert_bdi_deseq(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, params: dict,
) -> int:
    """Grava os params/KPIs do D.2 BDI (1 linha). Replace POR OBRA."""
    supabase.table("obra_bdi_deseq").delete().eq("contrato_id", contrato_id).execute()
    if params:
        row = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
               "extracao_version": extracao_version, "config_version": config_version,
               "status": status, **{k: params.get(k) for k in _BDI_DESEQ_COLS}}
        supabase.table("obra_bdi_deseq").insert(row).execute()
        return 1
    return 0


def upsert_bdi_rubricas_tempo(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, rubricas: list[dict],
) -> int:
    """Grava as 6 rubricas de tempo do D.2 BDI. Replace POR OBRA."""
    supabase.table("obra_bdi_rubrica_tempo").delete().eq("contrato_id", contrato_id).execute()
    if rubricas:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": status, **{k: r.get(k) for k in _BDI_RUB_TEMPO_COLS}} for r in rubricas]
        supabase.table("obra_bdi_rubrica_tempo").insert(rows).execute()
    return len(rubricas)


def upsert_bdi_perda_mensal(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, meses: list[dict],
) -> int:
    """Grava a curva de perda mensal do D.2 BDI (BM 1–46). Replace POR OBRA."""
    supabase.table("obra_bdi_perda_mensal").delete().eq("contrato_id", contrato_id).execute()
    if meses:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": status, **{k: m.get(k) for k in _BDI_PERDA_COLS}} for m in meses]
        supabase.table("obra_bdi_perda_mensal").insert(rows).execute()
    return len(meses)


# Colunas do desequilíbrio (whitelist · migration 0005 desequilibrio).
_DESEQ_COLS = ("ordem", "categoria", "tela", "valor_rs", "pct_do_total")


def upsert_desequilibrio(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, categorias: list[dict],
) -> int:
    """Grava a composição do desequilíbrio (D.0). Idempotente: REPLACE por (contrato, arquivo,
    version). Retorna n_categorias."""
    (
        supabase.table("obra_desequilibrio").delete()
        .eq("contrato_id", contrato_id).execute()  # vigente POR OBRA
    )
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if categorias:
        rows = [{**base, "status": status, **{k: c.get(k) for k in _DESEQ_COLS}} for c in categorias]
        for k in range(0, len(rows), 500):
            supabase.table("obra_desequilibrio").insert(rows[k:k + 500]).execute()
    return len(categorias)


_IND_BASE_COLS = ("adm_local_cheio", "adm_local_mensal", "reducao_escopo", "desequilibrio_extensao",
                  "custo_direto", "metodo_ativo", "desequilibrio_total",
                  "gasto_acum", "medido_acum", "real_acum", "contratado_acum",
                  "pv", "percent_pv", "prazo_meses", "bm_corrente", "reducao_pct", "extensao_meses")
_IND_MET_COLS = ("ordem", "metodo", "desequilibrio_rs", "medido_rs", "defensabilidade", "ativo", "obs",
                 "codigo", "comparacao", "valor_a", "valor_b", "pendente")
_IND_ITEM_COLS = ("ordem", "grupo", "qtd_contr", "qtd_real", "custo_contr", "custo_real", "delta_custo")


def upsert_indiretos(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, base: dict, metodos: list[dict], desequilibrio_total,
    itens: list[dict] | None = None,
) -> int:
    """Grava D.1 Indiretos: base (1 row · upsert) + métodos + itens (29 grupos · replace).
    Retorna n_metodos."""
    # GUARDA: como o gravar é "vigente por obra" (apaga tudo antes de inserir), NUNCA gravar estado
    # incompleto — senão apagaria o BM anterior bom para deixar a obra com base/total vazios. Recusa
    # antes de qualquer delete; o caller deve rotear para revisão (não persistir).
    if not metodos or desequilibrio_total is None or not base or base.get("custo_direto") is None:
        raise ValueError(
            "upsert_indiretos recusado: estado incompleto "
            f"(metodos={len(metodos or [])}, total={desequilibrio_total}, "
            f"custo_direto={(base or {}).get('custo_direto')}) — preserva o dado vigente"
        )
    key = {"contrato_id": contrato_id, "arquivo_id": arquivo_id, "extracao_version": extracao_version}
    # VIGENTE POR OBRA: limpa as 3 tabelas por contrato (mesmo arquivo/version antigos) antes de
    # gravar o estado corrente — evita misturar normalização nova com linhas stale de outra extração.
    supabase.table("obra_indiretos_base").delete().eq("contrato_id", contrato_id).execute()
    supabase.table("obra_indiretos_metodos").delete().eq("contrato_id", contrato_id).execute()
    supabase.table("obra_indiretos_itens").delete().eq("contrato_id", contrato_id).execute()
    base_row = {**key, "config_version": config_version, "status": status,
                "desequilibrio_total": desequilibrio_total,
                **{k: base.get(k) for k in _IND_BASE_COLS if k != "desequilibrio_total"}}
    supabase.table("obra_indiretos_base").insert(base_row).execute()
    if metodos:
        rows = [{**key, "config_version": config_version, "status": status,
                 **{k: m.get(k) for k in _IND_MET_COLS}} for m in metodos]
        supabase.table("obra_indiretos_metodos").insert(rows).execute()
    # 29 grupos da Adm Local (M2 contratado × real)
    if itens:
        irows = [{**key, "config_version": config_version, "status": status,
                  **{k: it.get(k) for k in _IND_ITEM_COLS}} for it in itens]
        supabase.table("obra_indiretos_itens").insert(irows).execute()
    return len(metodos)


_CONDUTA_COLS = ("ordem", "gatilho", "documento", "clausula", "categoria", "prioridade",
                 "farol", "status", "data_sugerida", "dias_aberto")


def upsert_condutas(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, condutas: list[dict],
) -> int:
    """Grava o catálogo de condutas (C.11). Idempotente: REPLACE por (contrato, arquivo, version)."""
    (
        supabase.table("obra_condutas").delete()
        .eq("contrato_id", contrato_id).execute()  # vigente POR OBRA
    )
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if condutas:
        rows = [{**base, "norm_status": status, **{k: c.get(k) for k in _CONDUTA_COLS}} for c in condutas]
        for k in range(0, len(rows), 500):
            supabase.table("obra_condutas").insert(rows[k:k + 500]).execute()
    return len(condutas)


_C8_COLS = ("contratado_acum_corte", "liberado_acum", "capacidade_acum", "executado_acum",
            "maior_gap_rs", "liberacao_pct", "capacidade_pct", "alocado_pct")


def upsert_curvas_c8(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, c8: dict,
) -> None:
    """Grava C.8 Curvas (1 row · upsert por contrato/arquivo/version)."""
    row = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
           "extracao_version": extracao_version, "config_version": config_version,
           "status": status, **{k: c8.get(k) for k in _C8_COLS}}
    supabase.table("obra_curvas_c8").upsert(
        row, on_conflict="contrato_id,arquivo_id,extracao_version").execute()


_CHUVA_M_COLS = ("ordem", "mes_obra", "periodo", "chuva_prev_mm", "chuva_real_mm",
                 "chuva_prev_acum", "chuva_real_acum", "dias_parados", "dias_prev_5mm", "farol")


def upsert_chuvas(
    *, contrato_id: str, arquivo_id: str, extracao_version: int, config_version: str,
    status: str, resumo: dict, meses: list[dict], eixo_real_vazio: bool, chuva_prev_total,
) -> int:
    """Grava C.9 Chuvas: resumo (1 row · upsert) + série mensal (replace). Retorna n_meses."""
    key = {"contrato_id": contrato_id, "arquivo_id": arquivo_id, "extracao_version": extracao_version}
    head = {**key, "config_version": config_version, "status": status,
            "eixo_real_vazio": eixo_real_vazio, "chuva_prev_total": chuva_prev_total,
            "impedido_total_rs": resumo.get("impedido_total_rs"),
            "liberado_total_rs": resumo.get("liberado_total_rs"),
            "frentes_nao_iniciadas": resumo.get("frentes_nao_iniciadas"),
            "principal_impedido": resumo.get("principal_impedido")}
    supabase.table("obra_chuvas").upsert(
        head, on_conflict="contrato_id,arquivo_id,extracao_version").execute()
    supabase.table("obra_chuvas_meses").delete().eq(
        "contrato_id", contrato_id).execute()  # vigente POR OBRA
    if meses:
        rows = [{**key, "config_version": config_version, "status": status,
                 **{k: m.get(k) for k in _CHUVA_M_COLS}} for m in meses]
        for i in range(0, len(rows), 500):
            supabase.table("obra_chuvas_meses").insert(rows[i:i + 500]).execute()
    return len(meses)


_FRENTE_COLS = ("ordem", "frente", "contratado_rs", "produtividade_rs_hh", "gap_dominante_rs", "responsabilidade")


def upsert_curvas_frentes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, frentes: list[dict],
) -> int:
    """Grava as frentes da matriz C.8 (replace por obra/version)."""
    (supabase.table("obra_curvas_frentes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if frentes:
        rows = [{**base, "status": status, **{k: f.get(k) for k in _FRENTE_COLS}} for f in frentes]
        supabase.table("obra_curvas_frentes").insert(rows).execute()
    return len(frentes)


_PANORAMA_FAROL_COLS = ("projetos", "interferencias", "liberacoes_area", "clima_forca_maior",
                        "precos_quantidades", "suprimentos_material")


def upsert_panorama(
    *, contrato_id: str, arquivo_id: str, extracao_version: int, config_version: str,
    status: str, panorama: dict,
) -> None:
    """Grava C.10 Panorama (1 row · upsert). Faróis como colunas farol_<dim>."""
    row = {"contrato_id": contrato_id, "arquivo_id": arquivo_id, "extracao_version": extracao_version,
           "config_version": config_version, "status": status,
           "consolidado": panorama.get("consolidado"),
           "pct_areas_liberadas": panorama.get("pct_areas_liberadas"),
           "dias_parados_acum": panorama.get("dias_parados_acum"),
           "frentes_impedidas_rs": panorama.get("frentes_impedidas_rs"),
           **{f"farol_{k}": panorama["farois"].get(k) for k in _PANORAMA_FAROL_COLS}}
    supabase.table("obra_panorama").upsert(
        row, on_conflict="contrato_id,arquivo_id,extracao_version").execute()


_FATFRENTE_COLS = ("ordem", "frente", "servico", "contratado_total", "contratado_acum",
                   "real_acum", "pct", "farol")


def upsert_faturamento_frentes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, frentes: list[dict],
) -> int:
    """Grava o faturamento por frente (C.3 · replace por obra/version)."""
    (supabase.table("obra_faturamento_frentes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if frentes:
        rows = [{**base, "status": status, **{k: f.get(k) for k in _FATFRENTE_COLS}} for f in frentes]
        supabase.table("obra_faturamento_frentes").insert(rows).execute()
    return len(frentes)


def upsert_faturamento_frente_macro(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, real_pendente: bool, frentes: list[dict],
) -> int:
    """Grava o C.3 Faturamento por FRENTE NOMEADA + macro (replace por obra/version). Mapeia explícito
    resolver→coluna (sufixo _rs). Σ contratado_total = PV."""
    (supabase.table("obra_faturamento_frente_macro").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if frentes:
        rows = [{**base, "status": status, "real_pendente": real_pendente,
                 "ordem": f["ordem"], "macro": f.get("macro"), "frente": f["frente"],
                 "contratado_total_rs": f.get("contratado_total"),
                 "contratado_acum_rs": f.get("contratado_acum"),
                 "real_acum_rs": f.get("real_acum"), "pct": f.get("pct"), "farol": f.get("farol")}
                for f in frentes]
        supabase.table("obra_faturamento_frente_macro").insert(rows).execute()
    return len(frentes)


def upsert_faturamento_disciplina_resumo(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, real_pendente: bool, disciplinas: list[dict],
) -> int:
    """Grava o C.3 Faturamento por DISCIPLINA · resumo (15 disc + real alocado · replace por obra/version)."""
    (supabase.table("obra_faturamento_disciplina_resumo").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if disciplinas:
        rows = [{**base, "status": status, "real_pendente": real_pendente,
                 "ordem": d["ordem"], "disciplina": d["disciplina"], "servico": d.get("servico"),
                 "contratado_total_rs": d.get("contratado_total"),
                 "contratado_acum_rs": d.get("contratado_acum"),
                 "real_acum_rs": d.get("real_acum"), "pct": d.get("pct"), "farol": d.get("farol")}
                for d in disciplinas]
        supabase.table("obra_faturamento_disciplina_resumo").insert(rows).execute()
    return len(disciplinas)


def upsert_faturamento_serie_mes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, dimensao: str, linhas: list[dict],
) -> int:
    """Grava a série mensal por item (disciplina|frente) · previsto+real · replace por obra/dimensao."""
    (supabase.table("obra_faturamento_serie_mes").delete()
     .eq("contrato_id", contrato_id).eq("dimensao", dimensao).execute())
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    rows = [{**base, "status": status, "dimensao": dimensao,
             "ordem": l["ordem"], "item": l["item"], "mes_num": l["mes_num"],
             "ano": l.get("ano"), "mes": l.get("mes"),
             "previsto_rs": l.get("previsto_rs"), "real_rs": l.get("real_rs")}
            for l in linhas]
    for i in range(0, len(rows), 200):  # 690/782 linhas → batches
        supabase.table("obra_faturamento_serie_mes").insert(rows[i:i + 200]).execute()
    return len(linhas)


_FAT_FT_COLS = ("ordem", "frente", "trecho", "share_pct", "contratado_rs", "previsto_acum_rs",
                "real_acum_rs", "deficit_rs", "aderencia", "farol", "real_pendente")


def upsert_faturamento_frente_trecho(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, linhas: list[dict],
) -> int:
    """Grava o C.3 Frente×Trecho drill-down (replace por obra/version)."""
    (supabase.table("obra_faturamento_frente_trecho").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if linhas:
        rows = [{**base, "status": status, **{k: ln.get(k) for k in _FAT_FT_COLS}} for ln in linhas]
        for i in range(0, len(rows), 200):
            supabase.table("obra_faturamento_frente_trecho").insert(rows[i:i + 200]).execute()
    return len(linhas)


_SECAO_COLS = ("ordem", "codigo", "modulo", "titulo", "tipo", "colunas", "dados",
               "n_linhas", "tem_dado", "coberta")


def upsert_secoes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, secoes: list[dict],
) -> int:
    """Captura genérica: grava TODA seção (estrutura preservada) em obra_secoes. Replace por
    obra/version. colunas/dados vão como JSONB (o client serializa dict/list)."""
    (supabase.table("obra_secoes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if secoes:
        rows = [{**base, **{k: s.get(k) for k in _SECAO_COLS}} for s in secoes]
        for i in range(0, len(rows), 100):  # batch menor — payloads JSONB grandes
            supabase.table("obra_secoes").insert(rows[i:i + 100]).execute()
    return len(secoes)


_CPU_COLS = ("ordem", "codigo_cpu", "servico", "unidade", "tipo", "custo_direto_unit",
             "mod_rs_un", "eqp_rs_un", "pct_mod", "pct_eqp", "pct_mat")


def upsert_cpu_coeficientes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, cpus: list[dict],
) -> int:
    """Grava as CPUs (base de custo · replace por obra/version). 558 linhas → batch."""
    (supabase.table("obra_cpu_coeficientes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if cpus:
        rows = [{**base, "status": status, **{k: cp.get(k) for k in _CPU_COLS}} for cp in cpus]
        for i in range(0, len(rows), 200):
            supabase.table("obra_cpu_coeficientes").insert(rows[i:i + 200]).execute()
    return len(cpus)


_MARCO_COLS = ("ordem", "categoria", "trecho", "data_limite", "pct_concluido", "farol")


def upsert_prazo_marcos(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, marcos: list[dict],
) -> int:
    (supabase.table("obra_prazo_marcos").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if marcos:
        rows = [{**base, "status": status, **{k: m.get(k) for k in _MARCO_COLS}} for m in marcos]
        supabase.table("obra_prazo_marcos").insert(rows).execute()
    return len(marcos)


_FAT_DM_COLS = ("ordem", "disciplina", "mes_num", "ano", "mes", "periodo_label",
                "previsto_rs", "real_rs", "deficit_rs")


def upsert_faturamento_disciplina_mes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, linhas: list[dict],
) -> int:
    """Grava a matriz FINANCEIRA disciplina×mês (C.3 · heatmap do Faturamento). Replace por
    obra/version. Real/déficit pendentes chegam None (PENDENTE≠0)."""
    (supabase.table("obra_faturamento_disciplina_mes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if linhas:
        rows = [{**base, "status": status, **{k: ln.get(k) for k in _FAT_DM_COLS}} for ln in linhas]
        for i in range(0, len(rows), 200):
            supabase.table("obra_faturamento_disciplina_mes").insert(rows[i:i + 200]).execute()
    return len(linhas)


_CRON_FM_COLS = ("ordem", "disciplina", "mes_num", "previsto_pct", "real_pct")


def upsert_cronograma_frente_mes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, linhas: list[dict],
) -> int:
    """Grava a matriz FÍSICA disciplina×mês (C.5 · seletor por frente do Prazo). Replace por
    obra/version. % real é input do RDO → None até a medição."""
    (supabase.table("obra_cronograma_frente_mes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if linhas:
        rows = [{**base, "status": status, **{k: ln.get(k) for k in _CRON_FM_COLS}} for ln in linhas]
        for i in range(0, len(rows), 200):
            supabase.table("obra_cronograma_frente_mes").insert(rows[i:i + 200]).execute()
    return len(linhas)


_AVANCO_FIS_COLS = ("ordem", "disciplina", "fisico", "mes_num",
                    "contratado_rs", "contratado_acum_rs", "real_rs", "aderencia_pct")


def upsert_avanco_fisico_disciplina_mes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, linhas: list[dict],
) -> int:
    """Grava o avanço físico-financeiro CONTRATADO disciplina×mês (C.14 · baseline da curva-S física).
    Replace por obra/version. `fisico` separa serviço de campo de rubrica não-física; real/aderência
    chegam None (PENDENTE≠0, input do RDO)."""
    (supabase.table("obra_avanco_fisico_disciplina_mes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if linhas:
        rows = [{**base, "status": status, **{k: ln.get(k) for k in _AVANCO_FIS_COLS}} for ln in linhas]
        for i in range(0, len(rows), 200):
            supabase.table("obra_avanco_fisico_disciplina_mes").insert(rows[i:i + 200]).execute()
    return len(linhas)


_MAPA_SEG_COLS = ("ordem", "seg_codigo", "item_nome", "tipo", "km_inicio", "km_fim",
                  "mes_lib_prevista", "mes_lib_real", "imped_mes_inicio", "imped_mes_fim",
                  "valor_contrato_rs", "status_bm", "liberado_rs", "impedido_rs",
                  "causa_impedimento")


def upsert_mapa_segmentos(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, segmentos: list[dict], bm_corrente: int | None,
) -> int:
    """Grava o mapa da obra por km (C.14 Bloco 1 · retigráfico). Replace por obra/version.
    Status/Liberado/Impedido no BM já conferidos pelo gate (deriváveis)."""
    (supabase.table("obra_mapa_segmentos").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version,
            "bm_corrente": bm_corrente}
    if segmentos:
        rows = [{**base, "status": status, **{k: s.get(k) for k in _MAPA_SEG_COLS}}
                for s in segmentos]
        supabase.table("obra_mapa_segmentos").insert(rows).execute()
    return len(segmentos)


_MAPA_ELEM_COLS = ("ordem", "tipo", "elemento", "km", "estaca",
                   "impedido_ate_mes", "obs_lado", "valor_rs")


def upsert_mapa_elementos(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, elementos: list[dict],
) -> int:
    """Grava os elementos pontuais do retigráfico (C.14 Bloco 5 · OAEs/dispositivos/taludes).
    Replace POR OBRA."""
    supabase.table("obra_mapa_elementos").delete().eq("contrato_id", contrato_id).execute()
    if elementos:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": status, **{k: e.get(k) for k in _MAPA_ELEM_COLS}} for e in elementos]
        supabase.table("obra_mapa_elementos").insert(rows).execute()
    return len(elementos)


_CURVA_SERIE_COLS = ("ordem", "mes_num", "periodo_label", "contratado_acum_rs",
                     "liberado_acum_rs", "capacidade_acum_rs", "executado_acum_rs",
                     "previsto_servicos_rs")


def upsert_curvas_serie_mes(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, meses: list[dict], bm_corrente: int | None,
) -> int:
    """Grava a série mensal das 4 curvas (C.8×C.3 · gráfico da Tela 6). Replace por obra/version.
    Capacidade/executado pós-BM chegam None (carry da planilha cortado · PENDENTE≠0)."""
    (supabase.table("obra_curvas_serie_mes").delete()
     .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version,
            "bm_corrente": bm_corrente}
    if meses:
        rows = [{**base, "status": status, **{k: m.get(k) for k in _CURVA_SERIE_COLS}}
                for m in meses]
        supabase.table("obra_curvas_serie_mes").insert(rows).execute()
    return len(meses)


_INSUMO_EXC_COLS = ("ordem", "insumo", "classe_abc", "qtd_orcada", "preco_orcado_rs",
                    "preco_ref_real_rs", "delta_real_pct", "teto_ipca_pct", "excedente_pct",
                    "delta_rs", "farol", "indice_pendente")


def upsert_insumo_excedente(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, insumos: list[dict], params: dict,
    snapshot_label: str | None,
) -> int:
    """Grava o excedente ao IPCA (D.5 · cláusula 8.8): linhas + header de params/consolidação.
    Replace por obra/version. Pendentes de índice chegam None (o 0 da planilha é default)."""
    for tabela in ("obra_insumo_excedente", "obra_insumo_excedente_params"):
        (supabase.table(tabela).delete()
         .eq("contrato_id", contrato_id).execute())  # vigente POR OBRA)
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}

    # Lookup ROBUSTO: a grafia das chaves varia entre extrações (ex.: 'Método ativo (M1/M2)' →
    # 'metodoativom1m2'; 'Data-base do orçamento' → 'databasedoorcamento'). Casa exato e, se falhar,
    # por substring — senão método/data-base ficavam null mesmo existindo na planilha.
    def _pp(*frags):  # noqa: ANN002, ANN202
        for f in frags:
            if params.get(f) is not None:
                return params[f]
        for f in frags:
            for k, v in params.items():
                if f in k and v is not None:
                    return v
        return None

    farol = _pp("farol")
    teto = next((i.get("teto_ipca_pct") for i in insumos if i.get("teto_ipca_pct") is not None), None)
    acima = _pp("insumosacimadoteto")
    supabase.table("obra_insumo_excedente_params").insert({
        **base, "status": status,
        "data_base": _pp("databaseorcamento", "databasedoorcamento", "databas"),
        "normativa": _pp("normativaaplicavel", "normativa"),
        "metodo_ativo": _pp("metodoativo"),
        "snapshot_label": snapshot_label,
        "teto_snapshot_pct": teto,
        "total_delta_rs": _pp("excedenterepassavel88", "somadeltabrutometodoativo"),
        "insumos_acima_teto": int(acima) if isinstance(acima, float) else None,
        "pct_sobre_pv": _pp("pctsobreopv", "pctsobrepv", "percentsobreopv"),
        "reajuste_pago_acum_rs": _pp("reajustecontratualjapagoacum", "reajustejapago"),
        "farol": farol.replace("●", "").strip() if isinstance(farol, str) else None,
    }).execute()
    if insumos:
        rows = [{**base, "status": status, "snapshot_label": snapshot_label,
                 **{k: i.get(k) for k in _INSUMO_EXC_COLS}} for i in insumos]
        supabase.table("obra_insumo_excedente").insert(rows).execute()
    return len(insumos)


# Colunas do resumo D.4 Valor Agregado por categoria + por serviço (whitelist · DDL migration).
_VA_CAT_COLS = ("ordem", "categoria", "va_medido_rs", "real_alocado_rs", "perda_rs", "pct_pv", "farol")
_VA_SERV_COLS = ("ordem", "codigo_cpu", "servico", "unidade", "pct_mod", "pct_eqp",
                 "mod_rs_un", "eqp_rs_un", "qtd_medida", "va_mod_rs", "va_eqp_rs")
_VA_MES_COLS = ("ordem", "ano", "mes", "periodo_label",
                "va_mod_rs", "va_eqp_rs", "real_mod_rs", "real_eqp_rs")


def upsert_valor_agregado(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, categorias: list[dict], servicos: list[dict],
    serie: list[dict] | None = None,
) -> tuple[int, int, int]:
    """Grava D.4 Valor Agregado (earned value): resumo por categoria MOD/EQP/TOTAL (perda de
    produtividade = Alocado − Agregado) + VA por serviço (Qtd medida × R$/un) + série mensal (VA/Real
    por mês, p/ o gráfico). Replace POR OBRA (delete+insert por contrato_id; contribuição imutável).
    Serviço/mês sem produção chega VA=0 (medição honesta, não fabricada). Retorna (n_cat,n_serv,n_mes)."""
    serie = serie or []
    for tabela in ("obra_valor_agregado_mes", "obra_valor_agregado_servico", "obra_valor_agregado"):
        supabase.table(tabela).delete().eq("contrato_id", contrato_id).execute()  # vigente POR OBRA
    base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
            "extracao_version": extracao_version, "config_version": config_version}
    if categorias:
        crows = [{**base, "status": status, **{k: c.get(k) for k in _VA_CAT_COLS}} for c in categorias]
        supabase.table("obra_valor_agregado").insert(crows).execute()
    if servicos:
        srows = [{**base, "status": status, **{k: s.get(k) for k in _VA_SERV_COLS}} for s in servicos]
        for i in range(0, len(srows), 200):
            supabase.table("obra_valor_agregado_servico").insert(srows[i:i + 200]).execute()
    if serie:
        mrows = [{**base, "status": status, **{k: m.get(k) for k in _VA_MES_COLS}} for m in serie]
        supabase.table("obra_valor_agregado_mes").insert(mrows).execute()
    return len(categorias), len(servicos), len(serie)


_REC_DESVIO_COLS = ("ordem", "recurso", "contratado_rs", "real_rs", "desvio_rs")


def upsert_recursos_desvio(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, desvios: list[dict],
) -> int:
    """Grava os maiores desvios de alocação (C.4 · por recurso). Replace POR OBRA."""
    supabase.table("obra_recursos_desvio").delete().eq("contrato_id", contrato_id).execute()
    if desvios:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": status, **{k: d.get(k) for k in _REC_DESVIO_COLS}} for d in desvios]
        supabase.table("obra_recursos_desvio").insert(rows).execute()
    return len(desvios)


_EVENTO_PRAZO_COLS = ("ordem", "ev_id", "titulo", "categoria", "data_inicio", "data_fim",
                      "frente_trecho", "critico", "clausulas", "status_analise", "cross_matriz", "impacta")


def upsert_eventos_prazo(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, eventos: list[dict],
) -> int:
    """Grava os eventos que impactam o prazo (C.13 · cadastro). Replace POR OBRA."""
    supabase.table("obra_eventos_prazo").delete().eq("contrato_id", contrato_id).execute()
    if eventos:
        base = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
                "extracao_version": extracao_version, "config_version": config_version}
        rows = [{**base, "status": status, **{k: e.get(k) for k in _EVENTO_PRAZO_COLS}} for e in eventos]
        supabase.table("obra_eventos_prazo").insert(rows).execute()
    return len(eventos)


_TIMELINE_PARAM_COLS = ("os_real", "os_original", "termino_contratual", "inicio_execucao",
                        "termino_previsto", "total_eventos", "eventos_climaticos", "marcos_em_risco",
                        "marcos_cumpridos", "marcos_total", "criticos_impacto_fisico",
                        "caminho_critico_dias", "mes_corte_indice", "avanco_fisico_previsto_pp",
                        "delta_impacto_fisico_pp", "windows_obs")


def upsert_timeline_params(
    *, contrato_id: str, arquivo_id: str, extracao_version: int,
    config_version: str, status: str, params: dict,
) -> int:
    """Grava os parâmetros da timeline (C.13 · header/cards/Windows · 1 linha). Replace POR OBRA."""
    supabase.table("obra_timeline_params").delete().eq("contrato_id", contrato_id).execute()
    if params:
        row = {"contrato_id": contrato_id, "arquivo_id": arquivo_id,
               "extracao_version": extracao_version, "config_version": config_version,
               "status": status, **{k: params.get(k) for k in _TIMELINE_PARAM_COLS}}
        supabase.table("obra_timeline_params").insert(row).execute()
        return 1
    return 0
