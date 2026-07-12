"""SPLITTER do WORKBOOK-MOTOR (Camada A) — fan-out de 1 envelope consolidado em N entidades.

Contexto: algumas obras sobem TODO o conteúdo num único XLSX-motor que espelha as tabs do
produto (módulos A/H/M1-M5, seções C.x/D.x/...). O pipeline de Sorriso assume 1 doc = 1 entidade;
aqui é o shape inverso. Este handler roteia SEÇÃO A SEÇÃO (por título), e para cada rota roda o
trilho honesto resolver → gate → persist, com proveniência (config_version) e sem inventar dado.

Estado: o RMA Mensal tem ~25 seções com resolver ESPECÍFICO (typed + cross-checked ao centavo:
C.6 Insumos, C.4 Recursos, C.3 Faturamento curva+frentes, C.5 Prazo, C.7 Produtividade, C.1 BDI,
D.0/D.1 Desequilíbrio, C.8 Curvas+frentes, C.9 Chuvas, C.10 Panorama, C.11 Condutas). O M3 (D.x)
e os demais módulos entram como novos pares resolver+gate no mesmo molde.

COMPLETUDE (garantia anti-perda): além dos resolvers específicos, `capturar_secoes` → obra_secoes
grava TODA seção com dado (estrutura preservada em JSONB), com flag `coberta`. Assim o motor NUNCA
dropa um dado em silêncio — o que ainda não tem resolver fica capturado e auditável.

Honestidade: needs_review por seção quando o gate não fecha (gravado no status das linhas); o
arquivo conclui 'normalized' (processou) com um reason que enumera o que entrou, o que ficou em
revisão e o que está pendente — nunca um verde sobre seção não-conferida.
"""

from __future__ import annotations

from .configs import CONFIG_VERSION_WORKBOOK
from .gate import (
    gate_insumos_fd,
    gate_avanco_fisico_disciplina,
    gate_bdi,
    gate_bdi_deseq,
    gate_pontuais_d6,
    gate_condutas,
    gate_cronograma_frente_mes,
    gate_curvas_c8,
    gate_curvas_serie_mes,
    gate_chuvas,
    gate_cronograma,
    gate_cronograma_tarefas_c13,
    gate_eventos_prazo,
    gate_desequilibrio,
    gate_faturamento_disciplina_mes,
    gate_faturamento_frentes,
    gate_faturamento_frente_trecho,
    gate_faturamento_workbook,
    gate_indiretos,
    gate_insumo_excedente,
    gate_insumos_abc,
    gate_mapa_elementos,
    gate_mapa_segmentos,
    gate_produtividade_economica,
    gate_produtividade_c7,
    gate_recursos,
    gate_recursos_desvio,
    gate_valor_agregado,
)
from .guia_contrato import cobertura_atomica, parse_guia_contrato
from .persist import (
    upsert_insumos_fd,
    upsert_avanco_fisico_disciplina_mes,
    upsert_bdi_rubricas,
    upsert_bdi_deseq,
    upsert_bdi_rubricas_tempo,
    upsert_bdi_perda_mensal,
    upsert_condutas,
    upsert_cronograma_frente_mes,
    upsert_curvas_c8,
    upsert_curvas_frentes,
    upsert_curvas_serie_mes,
    upsert_panorama,
    upsert_cpu_coeficientes,
    upsert_prazo_marcos,
    upsert_secoes,
    upsert_chuvas,
    upsert_cronograma,
    upsert_cronograma_tarefas,
    upsert_eventos_prazo,
    upsert_timeline_params,
    upsert_desequilibrio,
    upsert_faturamento_curva,
    upsert_faturamento_disciplina_mes,
    upsert_faturamento_frentes,
    upsert_faturamento_frente_macro,
    upsert_faturamento_disciplina_resumo,
    upsert_faturamento_serie_mes,
    upsert_faturamento_frente_trecho,
    upsert_indiretos,
    upsert_insumo_excedente,
    upsert_insumos,
    upsert_mapa_elementos,
    upsert_mapa_segmentos,
    upsert_produtividade_economica,
    upsert_produtividade_params,
    upsert_produtividade_fisica,
    upsert_produtividade_fisica_detalhe,
    upsert_produtividade_impedimento,
    upsert_pontuais_eventos,
    upsert_pontuais_chuva_mensal,
    upsert_pontuais_chuva_dia,
    upsert_pontuais_params,
    upsert_recursos,
    upsert_recursos_desvio,
    upsert_valor_agregado,
)
from .resolvers import (
    _norm_key,
    _num_limpo,
    achar_histograma_recursos,
    extrair_avanco_fisico_disciplina_mes,
    extrair_bdi_detalhe,
    extrair_bdi_deseq,
    extrair_bdi_rubricas_tempo,
    extrair_bdi_perda_mensal,
    extrair_condutas,
    extrair_cronograma_frente_mes,
    extrair_curvas_c8,
    extrair_curvas_frentes,
    extrair_curvas_serie_mes,
    extrair_cronograma_tarefas_c13,
    extrair_eventos_prazo,
    extrair_timeline_params,
    capturar_secoes,
    extrair_cpu_coeficientes,
    extrair_insumo_excedente,
    extrair_mapa_elementos,
    extrair_mapa_liberacao_mensal,
    extrair_mapa_segmentos,
    extrair_prazo_marcos,
    extrair_panorama,
    extrair_chuvas,
    extrair_cronograma_curva_fisica,
    extrair_desequilibrio_painel,
    extrair_faturamento_curva,
    extrair_faturamento_disciplina_mes,
    extrair_faturamento_frentes,
    extrair_faturamento_por_frente_macro,
    extrair_faturamento_por_disciplina,
    extrair_faturamento_serie_mes,
    extrair_faturamento_frente_trecho,
    extrair_indiretos,
    extrair_insumos_curva_abc,
    extrair_insumos_fd,
    extrair_produtividade_economica,
    extrair_produtividade_params,
    extrair_produtividade_fisica,
    extrair_produtividade_fisica_detalhe,
    extrair_produtividade_impedimento,
    extrair_pontuais_eventos,
    extrair_pontuais_params,
    extrair_pontuais_chuva_mensal,
    extrair_pontuais_chuva_dia,
    extrair_recursos,
    extrair_recursos_histograma,
    extrair_recursos_maiores_desvios,
    extrair_valor_agregado,
    snapshot_abc_insumos,
    snapshot_bm_corrente,
    snapshot_contratado_total,
    snapshot_curvas_cards,
    snapshot_excedente_params,
    snapshot_fisico_por_disciplina,
    snapshot_resumo_liberacoes,
)


def _achar_secao(secoes: list[dict], *needles: str) -> dict | None:
    """1ª seção cujo TÍTULO normalizado contém TODOS os needles (sem acento/espaço)."""
    alvos = [_norm_key(n) for n in needles]
    for s in secoes:
        if not isinstance(s, dict):
            continue
        t = _norm_key(s.get("titulo") or "")
        if all(a in t for a in alvos):
            return s
    return None


def _total_materiais(secoes: list[dict]) -> float | None:
    """TOTAL de custo de materiais declarado (companion C.6 Parâmetros) p/ o gate de conservação.
    ROBUSTO: varre o dict 'dados'/'conteudo' de TODAS as seções procurando a chave de total de
    materiais (sem depender do título — evita pegar a 'cesta ABC' do D.5 por engano). Aceita
    'TOTAL...materiais' ou 'valorContratado...materiais'."""
    def _scan(pred) -> float | None:  # noqa: ANN001
        for s in secoes:
            if not isinstance(s, dict):
                continue
            dados = s.get("dados") or s.get("conteudo") or {}
            if not isinstance(dados, dict):
                continue
            for k, v in dados.items():
                if pred(_norm_key(k)):
                    n = _num_limpo(v)
                    if isinstance(n, float):
                        return n
        return None

    # radical 'materia' casa tanto 'material' quanto 'materiais' (plural)
    return (_scan(lambda nk: "total" in nk and "materia" in nk)
            or _scan(lambda nk: "materia" in nk and "contratado" in nk))


# Seções C.x do RMA ainda SEM resolver nesta leva — reconhecidas e logadas (honesto), não puladas
# em silêncio. Cada (needle...) vira um par resolver+gate numa próxima leva. Ver spec do splitter.
# (Podada em jun/2026: BDI rubricas, C.3 curva, C.5 marcos, C.7, C.14 segmentos ganharam rota.)
_PENDENTES_RMA: tuple[tuple[str, ...], ...] = (
    ("c.1 bdi detalhe", "base"), ("c.1 sintese", "premissas"),
    ("c.3 cronograma", "previsto"), ("c.3 faturamento", "resumo"),
    ("c.4 mod detalhe",), ("c.4 eqp detalhe",), ("d.1 moi",),
    ("c.5 prazos detalhe",), ("c.13 cronograma project",),
    ("c.9 chuvas", "indices"), ("c.9 chuvas", "dias"),
)


def processar_workbook_motor(arquivo_id: str, contrato_id: str, nome: str,
                             payload: dict, version: int) -> dict:
    """Roteia as seções do workbook-motor → entidades obra_*. Persiste o que tem resolver, lista
    o pendente. Retorna {status_arquivo, reason, routed, em_revisao, pendentes}. NÃO chama
    complete_job — o wrapper no job.py decide o status do arquivo a partir do retorno."""
    secoes = payload.get("secoes") or []
    routed: list[str] = []
    em_revisao: list[str] = []
    pendentes: list[str] = []

    # ── Rota C.6 Insumos · Curva ABC (preço orçado por insumo) ──────────────────────────────
    # Estrito primeiro: a ABC de MATERIAIS da C.6 (a que o companion 'total de materiais' rege).
    # Sem isso, um workbook com FONTE-curva-abc GERAL (todas as classes, ex.: SBSO) casa antes e
    # a conservação Σ==materiais quebra por premissa errada.
    sec_ins = (_achar_secao(secoes, "c.6", "curva abc")
               or _achar_secao(secoes, "curva abc", "materiais")
               or _achar_secao(secoes, "insumos", "curva abc"))
    if sec_ins is not None:
        total = _total_materiais(secoes)
        res = extrair_insumos_curva_abc(sec_ins, total_declarado=total)
        g = gate_insumos_abc(res)
        if res["insumos"]:
            upsert_insumos(
                contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
                insumos=res["insumos"], meses=[],
            )
            tag = f"C.6 Insumos·CurvaABC: {res['n_insumos']} insumos (status={g['status']})"
            (em_revisao if g["status"] == "needs_review" else routed).append(tag)
            if res.get("eixo_real_vazio"):
                routed.append("C.6 Insumos: eixo de preço REAL vazio → farol de desvio PENDENTE (honesto)")
        else:
            pendentes.append("C.6 Insumos·CurvaABC: nenhum insumo extraível")

    # ── Rota C.6/D.5 fd — modelo multifonte que as TELAS leem (fd/fontes/reeq/ipca_serie) ──────
    res_fd = extrair_insumos_fd(secoes)
    if res_fd["insumos"]:
        g = gate_insumos_fd(res_fd)
        upsert_insumos_fd(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            insumos=res_fd["insumos"], fontes=res_fd["fontes"], reeq=res_fd["reeq"], serie=res_fd["serie"],
        )
        tag = (f"C.6/D.5 fd: {res_fd['n']} insumos · fonte {res_fd['fontes'][0]['rotulo'][:22] if res_fd['fontes'] else '—'} "
               f"(status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.4 Recursos (MOD/MOI/EQP) — plano contratado item a item + histograma mensal ───
    # O histograma é roteado INDEPENDENTE dos itens: um workbook com a curva de mobilização mas sem
    # as tabelas por função ainda persiste os meses (não descarta a curva). E o gate enxerga ambos.
    res_rec = extrair_recursos(secoes)
    sec_hist = achar_histograma_recursos(secoes)  # estrutural (robusto à variação de título)
    histo = extrair_recursos_histograma(sec_hist) if sec_hist is not None else None
    if res_rec["itens"] or (histo and histo["meses"]):
        g = gate_recursos(res_rec, histo)
        upsert_recursos(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            itens=res_rec["itens"], meses=(histo["meses"] if histo else []),
        )
        n_meses = len(histo["meses"]) if histo else 0
        tag = (f"C.4 Recursos: {res_rec['n_itens']} itens (MOD/MOI/EQP) + {n_meses} linhas-mês "
               f"(status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)
        if res_rec.get("eixo_real_vazio"):
            routed.append("C.4 Recursos: eixo REAL vazio (pré-execução) → farol de mobilização PENDENTE (honesto)")

    # ── Rota C.3 Faturamento — curva mensal Previsto × Real (acumulados recomputados) ─────────
    res_fat = extrair_faturamento_curva(secoes)
    if res_fat["meses"]:
        g = gate_faturamento_workbook(res_fat)
        upsert_faturamento_curva(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            header={"custo_total": res_fat["soma_contratado"]}, meses=res_fat["meses"],
        )
        tag = (f"C.3 Faturamento: {res_fat['n_meses']} meses · contratado "
               f"{(res_fat['soma_contratado'] or 0) / 1e6:.1f}M · real "
               f"{(res_fat['soma_real'] or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.5 Prazo — curva física % previsto × real acumulado (previsto_pct recomputado) ──
    res_cron = extrair_cronograma_curva_fisica(secoes)
    if res_cron["meses"]:
        g = gate_cronograma(res_cron["meses"])
        upsert_cronograma(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            header={  # datas derivadas da curva + custo (PV) — sem isso o Prazo/Visão Geral ficam vazios
                "inicio_obra": res_cron.get("inicio_iso"),
                "termino_obra": res_cron.get("termino_iso"),
                "custo_total_obra": res_fat.get("soma_contratado") if res_fat.get("meses") else None,
            },
            meses=res_cron["meses"],
        )
        n_real = sum(1 for m in res_cron["meses"] if m.get("real_pct_acumulado") is not None)
        tag = (f"C.5 Prazo: curva física {res_cron['n_meses']} meses · previsto fecha "
               f"{(res_cron['final_previsto'] or 0) * 100:.0f}% (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)
        if n_real == 0:
            routed.append("C.5 Prazo: % físico REAL (input) vazio → farol físico PENDENTE (honesto)")

    # ── Rota C.7 Produtividade econômica — série mensal R$/HH (faturado, HH prev/real, aderência) ─
    res_prod = extrair_produtividade_economica(secoes)
    if res_prod["meses"]:
        g = gate_produtividade_economica(res_prod)
        upsert_produtividade_economica(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], meses=res_prod["meses"],
        )
        tag = (f"C.7 Produtividade: {res_prod['n_meses']} meses · Σ HH previsto "
               f"{(res_prod['soma_hh_previsto'] or 0):,.0f} (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.7 Produtividade · refactor (params/cards + FÍSICA serviço×trecho + detalhe + ponte) ──
    res_pp = extrair_produtividade_params(secoes)
    res_pf = extrair_produtividade_fisica(secoes)
    res_pd = extrair_produtividade_fisica_detalhe(secoes)
    res_pi = extrair_produtividade_impedimento(secoes)
    if res_pp["params"] or res_pf["linhas"]:
        g = gate_produtividade_c7(res_pp["params"], res_pf["linhas"], res_pi["linhas"])
        if res_pp["params"]:
            upsert_produtividade_params(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                        config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], params=res_pp["params"])
        upsert_produtividade_fisica(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                    config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_pf["linhas"])
        upsert_produtividade_fisica_detalhe(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_pd["linhas"])
        upsert_produtividade_impedimento(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                         config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_pi["linhas"])
        meta = (res_pp["params"] or {}).get("meta_projeto_rs_hh")
        tag = (f"C.7 Produtividade física: {res_pf['n']} serviços×trecho · {res_pi['n']} impedimentos · "
               f"meta R$ {meta:.0f}/HH (status={g['status']})" if meta else
               f"C.7 Produtividade física: {res_pf['n']} serviços×trecho (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.1 BDI Detalhe — FONTE-MÃE econômica (rubricas · CD constante + CD+markup ≈ PV) ──
    res_bdi = extrair_bdi_detalhe(secoes)
    if res_bdi["rubricas"]:
        pv = res_fat.get("soma_contratado") if res_fat.get("meses") else None  # PV triangulado exato
        g = gate_bdi(res_bdi, pv_anchor=pv)
        upsert_bdi_rubricas(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], rubricas=res_bdi["rubricas"],
        )
        tag = (f"C.1 BDI Detalhe: {res_bdi['n_rubricas']} rubricas · CD "
               f"{(res_bdi['cd_implicito'] or 0) / 1e6:.1f}M + markup "
               f"{(res_bdi['soma_folhas_rs'] or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota D.2 BDI desequilíbrio (não remunerado · view própria) — params + rubricas + curva ──
    res_bd = extrair_bdi_deseq(secoes)
    res_brt = extrair_bdi_rubricas_tempo(secoes)
    res_bpm = extrair_bdi_perda_mensal(secoes)
    if res_bd["params"]:
        g = gate_bdi_deseq(res_bd["params"], res_brt["rubricas"], res_bpm["meses"])
        upsert_bdi_deseq(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                         config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], params=res_bd["params"])
        upsert_bdi_rubricas_tempo(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                  config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], rubricas=res_brt["rubricas"])
        upsert_bdi_perda_mensal(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], meses=res_bpm["meses"])
        tag = (f"D.2 BDI: desequilíbrio {(res_bd['params'].get('desequilibrio_rs') or 0) / 1e6:.2f}M · "
               f"{res_brt['n']} rubricas · {res_bpm['n']} meses (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota D.6 Análises Pontuais (eventos · chuva excedente + impedimentos · dossiê pendente) ──
    res_pev = extrair_pontuais_eventos(secoes)
    res_pcm = extrair_pontuais_chuva_mensal(secoes)
    res_pcd = extrair_pontuais_chuva_dia(secoes)
    res_ppar = extrair_pontuais_params(secoes)
    if res_pev["eventos"]:
        g = gate_pontuais_d6(res_ppar["params"], res_pev["eventos"], res_pcm["meses"])
        upsert_pontuais_eventos(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_pev["eventos"])
        upsert_pontuais_chuva_mensal(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                     config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_pcm["meses"])
        upsert_pontuais_chuva_dia(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                  config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_pcd["dias"])
        if res_ppar["params"]:
            upsert_pontuais_params(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                   config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], params=res_ppar["params"])
        pend = (res_ppar["params"] or {}).get("pendente_total_rs") or 0
        tag = (f"D.6 Pontuais: {res_pev['n']} eventos · pendente R$ {pend / 1e3:.0f}k (não soma) · "
               f"chuva {res_pcm['n']} meses / {res_pcd['n']} dias (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota D.0 Painel Desequilíbrio (M3 · headline) — composição por categoria, Σ == total ──
    res_deq = extrair_desequilibrio_painel(secoes)
    if res_deq["categorias"]:
        # cross-check independente: o total do desequilíbrio declarado em algum card/Dashboard
        def _scan_deseq() -> float | None:
            # Passadas ORDENADAS do total consolidado. Um card de UMA categoria pode conter
            # 'total'+'desequilibrio' (ex.: totalBDINaoRemuneradoAteBM_desequilibrio da D.2) e
            # casar antes do teto do painel — por isso 'total' sozinho NÃO basta na estrita.
            passes = (
                lambda kk: "pleiteavel" in kk or "teto" in kk,       # desequilibrioTotalPleiteavelTeto
                lambda kk: kk.startswith("desequilibriototal"),       # desequilibrioTotal…
                lambda kk: True,                                       # legado (ordem do envelope)
            )
            for aceita in passes:
                for s in secoes:
                    dd = s.get("dados") if isinstance(s, dict) else None
                    if not isinstance(dd, dict):
                        continue
                    for k, v in dd.items():
                        kk = _norm_key(k)
                        if "desequilibrio" not in kk or "pct" in kk or not aceita(kk):
                            continue
                        n = _num_limpo(v)
                        if isinstance(n, float) and n > 1000:
                            return n
            return None
        g = gate_desequilibrio(res_deq, total_declarado=_scan_deseq() or res_deq["soma_rs"])
        upsert_desequilibrio(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], categorias=res_deq["categorias"],
        )
        tag = (f"D.0 Desequilíbrio: {res_deq['n_categorias']} categorias · Σ "
               f"{(res_deq['soma_rs'] or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota D.1 Indiretos (M3 · maior componente) — métodos + base, cruza com o D.0 ──────────
    res_ind = extrair_indiretos(secoes)
    _ind_completo = (bool(res_ind["metodos"]) and res_ind["desequilibrio_total"] is not None
                     and res_ind["base"].get("custo_direto") is not None)
    if _ind_completo:
        # cross-check inter-seção: o valor de Custos Indiretos declarado no D.0 — soma TODAS as
        # categorias cujo nome casa 'indireto' (obras podem separar Adm/Engenharia em duas linhas).
        _ind_cats = [c["valor_rs"] for c in (res_deq.get("categorias") or [])
                     if "indireto" in _norm_key(c.get("categoria") or "")
                     and isinstance(c.get("valor_rs"), float)]
        d1_no_d0 = sum(_ind_cats) if _ind_cats else None
        g = gate_indiretos(res_ind, total_d0=d1_no_d0)
        upsert_indiretos(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            base=res_ind["base"], metodos=res_ind["metodos"],
            desequilibrio_total=res_ind["desequilibrio_total"], itens=res_ind.get("itens"),
        )
        ativo = next((m["metodo"] for m in res_ind["metodos"] if m["ativo"]), "—")
        tag = (f"D.1 Indiretos: {res_ind['n_metodos']} métodos (ativo {ativo[:14]}) · composição "
               f"{(res_ind['desequilibrio_total'] or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)
    elif res_ind["metodos"] or res_ind["status"] != "ok":
        # extração parcial: NÃO grava (preserva o BM vigente) e roteia para revisão manual.
        em_revisao.append(
            f"D.1 Indiretos: extração incompleta (status={res_ind['status']}) · não gravado "
            f"para preservar o dado vigente"
        )

    # ── Rota C.8 Curvas Lib×Cap×Aloc — cards consolidados, executado cruza com faturamento ──────
    res_c8 = extrair_curvas_c8(secoes)
    if res_c8.get("executado_acum") is not None:
        fat_real_acum = None
        for m in reversed(res_fat.get("meses") or []):
            ra = m.get("real_rs_acumulado")
            if isinstance(ra, (int, float)) and ra:
                fat_real_acum = float(ra)
                break
        g = gate_curvas_c8(res_c8, faturamento_real_acum=fat_real_acum)
        upsert_curvas_c8(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], c8=res_c8,
        )
        res_fr = extrair_curvas_frentes(secoes)
        if res_fr["frentes"]:
            upsert_curvas_frentes(
                contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                config_version=CONFIG_VERSION_WORKBOOK, status=res_fr["status"], frentes=res_fr["frentes"],
            )
            routed.append(f"C.8 Frentes: {res_fr['n_frentes']} frentes · Σ contratado "
                          f"{(res_fr['soma_contratado'] or 0)/1e6:.1f}M")
        tag = (f"C.8 Curvas: Lib {(res_c8['liberacao_pct'] or 0)*100:.0f}% · Cap "
               f"{(res_c8['capacidade_pct'] or 0)*100:.0f}% · Aloc {(res_c8['alocado_pct'] or 0)*100:.0f}% "
               f"(status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.10 Panorama do Contrato — faróis multidimensionais (visão consolidada) ──────────
    res_pan = extrair_panorama(secoes)
    if res_pan.get("consolidado") is not None or res_pan["n_avaliados"] > 0:
        upsert_panorama(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=res_pan["status"], panorama=res_pan,
        )
        routed.append(f"C.10 Panorama: {res_pan['n_avaliados']}/6 dimensões avaliadas "
                      f"(consolidado {res_pan.get('consolidado') or 'pendente'})")

    # ── Rota C.3 Faturamento por frente/disciplina (gap apontado) — cruza Σ com PV e C.8 ──────
    res_ff = extrair_faturamento_frentes(secoes)
    if res_ff["frentes"]:
        # cross-check INTER-seção real: Σ Contratado Acum por frente == contratado-no-corte do C.8
        g = gate_faturamento_frentes(res_ff, contratado_corte=res_c8.get("contratado_acum_corte"))
        upsert_faturamento_frentes(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], frentes=res_ff["frentes"],
        )
        tag = (f"C.3 Fat.Frentes: {res_ff['n_frentes']} frentes · Σ total "
               f"{(res_ff['soma_contratado_total'] or 0)/1e6:.0f}M · acum "
               f"{(res_ff['soma_contratado_acum'] or 0)/1e6:.0f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.3 Frente × Trecho (drill-down · caderno SaaS A171:I242) — Σ Contratado ≈ PV ──────
    res_ft = extrair_faturamento_frente_trecho(secoes)
    if res_ft["linhas"]:
        g = gate_faturamento_frente_trecho(res_ft, pv=res_fat.get("soma_contratado"))
        upsert_faturamento_frente_trecho(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_ft["linhas"],
        )
        tag = (f"C.3 Frente×Trecho: {res_ft['n_linhas']} linhas · {res_ft['n_frentes']} frentes"
               f"{' · real a medir' if res_ft['real_pendente'] else ''} (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.3 Faturamento por FRENTE NOMEADA + MACRO (drill "Por Frente" robusto) — Σ == PV ──────
    # Fonte dos rótulos bonitos do drill "Por Frente" (Trecho/Ponte/Dispositivo + macro), lida por
    # estrutura → cada obra traz as SUAS frentes, sem hardcode. Gate: Σ Contratado Total == PV.
    res_fm = extrair_faturamento_por_frente_macro(secoes)
    if res_fm["frentes"]:
        g = gate_faturamento_frentes(res_fm, pv=res_fat.get("soma_contratado"))
        upsert_faturamento_frente_macro(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            real_pendente=res_fm["real_pendente"], frentes=res_fm["frentes"],
        )
        tag = (f"C.3 Fat.Frente+Macro: {res_fm['n_frentes']} frentes nomeadas · Σ "
               f"{(res_fm['soma_contratado_total'] or 0)/1e6:.0f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.3 Faturamento por DISCIPLINA · resumo (drill "Por Disciplina" · COM real + farol) ──────
    # 15 disc finas COM real alocado (acende os faróis do drill) — distinto da coarse frentes(12). Σ == PV.
    res_dr = extrair_faturamento_por_disciplina(secoes)
    if res_dr["disciplinas"]:
        g = gate_faturamento_frentes(res_dr, pv=res_fat.get("soma_contratado"))
        upsert_faturamento_disciplina_resumo(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            real_pendente=res_dr["real_pendente"], disciplinas=res_dr["disciplinas"],
        )
        tag = (f"C.3 Fat.Disciplina(resumo): {res_dr['n_disciplinas']} disc · Σ "
               f"{(res_dr['soma_contratado_total'] or 0)/1e6:.0f}M"
               f"{'' if res_dr['real_pendente'] else ' · real alocado'} (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.3 SÉRIE MENSAL por disciplina/frente (curva por item · Previsto + Real) — Σprev==PV ──
    # Alimenta o select da Curva S (filtra a curva por item). Real mensal EXISTE aqui (matriz Real por
    # {dim} × Mês) → gate: Σ previsto == PV. Roda p/ os dois recortes.
    _pv = res_fat.get("soma_contratado")
    for _dim in ("disciplina", "frente"):
        res_sm = extrair_faturamento_serie_mes(secoes, _dim, meses_curva=res_fat.get("meses"))
        if res_sm["linhas"]:
            _sp = res_sm["soma_previsto"]
            _ok = _pv is None or _sp is None or abs(_sp - _pv) <= max(1.0, abs(_pv) * 0.0001)
            _st = "ok" if _ok else "needs_review"
            upsert_faturamento_serie_mes(
                contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                config_version=CONFIG_VERSION_WORKBOOK, status=_st, dimensao=_dim, linhas=res_sm["linhas"],
            )
            tag = (f"C.3 Série/{_dim}: {res_sm['n_itens']}×{res_sm['n_meses']} · Σprev "
                   f"{(_sp or 0)/1e6:.0f}M · Σreal {(res_sm['soma_real'] or 0)/1e6:.1f}M (status={_st})")
            (em_revisao if _st == "needs_review" else routed).append(tag)

    # ── Rota C.3 Matriz DISCIPLINA × MÊS (heatmap do Faturamento · explosão 2D da curva) ─────────
    res_dm = extrair_faturamento_disciplina_mes(secoes, meses_curva=res_fat.get("meses"))
    if res_dm["linhas"]:
        curva_mes = {(m["ano"], m["mes"]): m.get("contratado_rs")
                     for m in (res_fat.get("meses") or [])}
        g = gate_faturamento_disciplina_mes(
            res_dm, pv=res_fat.get("soma_contratado"), curva_por_mes=curva_mes)
        upsert_faturamento_disciplina_mes(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_dm["linhas"],
        )
        tag = (f"C.3 Matriz disciplina×mês: {res_dm['n_disciplinas']} disc · Σ previsto "
               f"{(res_dm.get('soma_previsto') or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.5 Matriz FÍSICA disciplina × mês (seletor por frente do Prazo) ────────────────────
    res_fm = extrair_cronograma_frente_mes(secoes)
    if res_fm["linhas"]:
        g = gate_cronograma_frente_mes(res_fm, snapshot_fisico_por_disciplina(secoes))
        upsert_cronograma_frente_mes(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_fm["linhas"],
        )
        tag = (f"C.5 Matriz física disciplina×mês: {res_fm['n_disciplinas']} disc · "
               f"{len(res_fm['linhas'])} células (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.14 AVANÇO FÍSICO-FINANCEIRO contratado por disciplina × mês (baseline da curva-S física) ──
    # Distinto do C.3 (faturamento CHEIO/PV · 12-15 disc) e do C.5 (% físico · fração): aqui é o R$
    # CONTRATADO das disciplinas FÍSICAS (Σ 367M = porção física do PV). Lido da fonte ROTULADA
    # auxiliar_C.14 (Valor×%mês). Gate conserva Σ bruto == PV + cruza Σ físicas com a matriz cached da
    # C.14 (L200-207 · backstop · os 2 cortes têm que bater). Real/aderência = RDO → NULL (pendente).
    res_af = extrair_avanco_fisico_disciplina_mes(secoes)
    if res_af["linhas"]:
        # âncoras: PV = Σ contratado da curva C.3; físicas = Σ da matriz cached C.14 (o resolver achou via
        # _set_disc_cached_c14). Sem QUALQUER âncora o gate ESCALA p/ needs_review (não persiste verde).
        g = gate_avanco_fisico_disciplina(
            res_af, pv_anchor=res_fat.get("soma_contratado"),
            fisico_anchor=res_af.get("soma_fisico_cached"))
        upsert_avanco_fisico_disciplina_mes(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], linhas=res_af["linhas"],
        )
        tag = (f"C.14 Avanço físico disciplina×mês: {res_af['n_disciplinas_fisicas']} disc físicas · "
               f"Σ {(res_af.get('soma_fisico') or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.8×C.3 SÉRIE MENSAL das 4 curvas (gráfico da Tela 6 · toggle Total/Produção) ──────
    bm_corrente = snapshot_bm_corrente(secoes)
    res_serie = extrair_curvas_serie_mes(secoes, bm=bm_corrente)
    if res_serie["meses"]:
        g = gate_curvas_serie_mes(res_serie, cards=snapshot_curvas_cards(secoes), bm=bm_corrente,
                                  contratado_total=snapshot_contratado_total(secoes))
        upsert_curvas_serie_mes(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            meses=res_serie["meses"], bm_corrente=bm_corrente,
        )
        tag = (f"C.8 Série mensal: {res_serie['n_meses']} meses · carry pós-BM "
               f"{bm_corrente or '?'} → NULL (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.14 MAPA DA OBRA por km (segmentos de liberação/impedimento · Tela 6) ─────────────
    res_mapa = extrair_mapa_segmentos(secoes)
    if res_mapa["segmentos"]:
        g = gate_mapa_segmentos(res_mapa, bm=bm_corrente,
                                resumo=snapshot_resumo_liberacoes(secoes),
                                contratado_total=snapshot_contratado_total(secoes),
                                mapa_mensal=extrair_mapa_liberacao_mensal(secoes))
        upsert_mapa_segmentos(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            segmentos=res_mapa["segmentos"], bm_corrente=bm_corrente,
        )
        n_imp = sum(1 for s in res_mapa["segmentos"] if (s.get("impedido_rs") or 0) > 0)
        tag = (f"C.14 Mapa/km: {res_mapa['n_segmentos']} segmentos · {n_imp} impedidos "
               f"(status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.14 ELEMENTOS PONTUAIS do retigráfico (BLOCO 5 · OAEs/dispositivos/taludes) ─────────
    res_el = extrair_mapa_elementos(secoes)
    if res_el["elementos"]:
        # âncora do carve-out = VALOR CONTRATADO do sinistro do BLOCO 1 (invariante estrutural, não o
        # impedido_rs que é derivado do status mensal e zera quando recuperado).
        sin_total = sum(
            (s.get("valor_contrato_rs") or 0)
            for s in (res_mapa.get("segmentos") or [])
            if s.get("tipo") == "sinistro"
        )
        g = gate_mapa_elementos(res_el, sinistro_total=sin_total or None)
        upsert_mapa_elementos(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], elementos=res_el["elementos"],
        )
        n_tal = sum(1 for e in res_el["elementos"] if e.get("tipo") == "Talude")
        tag = f"C.14 Elementos: {res_el['n']} pontuais · {n_tal} taludes (status={g['status']})"
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota D.5 EXCEDENTE AO IPCA por insumo relevante (cláusula 8.8 · Tela Insumos) ───────────
    res_exc = extrair_insumo_excedente(secoes)
    if res_exc["insumos"]:
        params_exc = snapshot_excedente_params(secoes)
        g = gate_insumo_excedente(res_exc, abc=snapshot_abc_insumos(secoes), params=params_exc,
                                  contratado_total=snapshot_contratado_total(secoes))
        upsert_insumo_excedente(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            insumos=res_exc["insumos"], params=params_exc,
            snapshot_label=res_exc["snapshot_label"],
        )
        tag = (f"D.5 Excedente 8.8: {res_exc['n_insumos']} relevantes · Σ Δ "
               f"{(g.get('soma_delta_rs') or 0) / 1e3:.0f}k (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota D.4 VALOR AGREGADO (earned value · AACE 25R-03 · perda de produtividade) ───────────
    res_va = extrair_valor_agregado(secoes)
    if res_va["categorias"]:
        g = gate_valor_agregado(res_va, pv=snapshot_contratado_total(secoes))
        upsert_valor_agregado(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"],
            categorias=res_va["categorias"], servicos=res_va["servicos"], serie=res_va.get("serie"),
        )
        tag = (f"D.4 Valor Agregado: {res_va['n_servicos']} serviços · {res_va.get('n_meses', 0)} "
               f"meses · perda {(res_va.get('perda_total') or 0) / 1e6:.1f}M (status={g['status']})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.4 MAIORES DESVIOS de alocação por recurso (ranking R$ acum até BM) ───────────────
    res_rd = extrair_recursos_maiores_desvios(secoes)
    if res_rd["desvios"]:
        g = gate_recursos_desvio(res_rd)
        upsert_recursos_desvio(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], desvios=res_rd["desvios"],
        )
        tag = f"C.4 Maiores Desvios: {res_rd['n']} recursos (status={g['status']})"
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.9 Chuvas — análise pluviométrica (obra a céu aberto · impacto prazo/produtividade) ──
    res_ch = extrair_chuvas(secoes)
    if res_ch["meses"]:
        g = gate_chuvas(res_ch)
        prev_total = round(sum(m["chuva_prev_mm"] for m in res_ch["meses"] if m.get("chuva_prev_mm")), 1)
        upsert_chuvas(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], resumo=res_ch["resumo"],
            meses=res_ch["meses"], eixo_real_vazio=res_ch["eixo_real_vazio"], chuva_prev_total=prev_total,
        )
        imp = (res_ch["resumo"].get("impedido_total_rs") or 0) / 1e6
        tag = (f"C.9 Chuvas: {res_ch['n_meses']} meses · impedido {imp:.0f}M · "
               f"{res_ch['resumo'].get('frentes_nao_iniciadas') or 0} frentes não iniciadas "
               f"(real {'pendente' if res_ch['eixo_real_vazio'] else 'medido'})")
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.11 Condutas — catálogo de ações sugeridas pelo Adm Contratual IA ───────────────
    res_con = extrair_condutas(secoes)
    if res_con["condutas"]:
        g = gate_condutas(res_con)
        upsert_condutas(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], condutas=res_con["condutas"],
        )
        tag = f"C.11 Condutas: {res_con['n_condutas']} condutas (status={g['status']})"
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.5 Prazo Marcos detalhados — popula o card "Marcos" do Prazo ──────────────────────
    res_mc = extrair_prazo_marcos(secoes)
    if res_mc["marcos"]:
        upsert_prazo_marcos(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                            config_version=CONFIG_VERSION_WORKBOOK, status=res_mc["status"], marcos=res_mc["marcos"])
        routed.append(f"C.5 Marcos: {res_mc['n_marcos']} marcos contratuais"
                      f"{' (% concluído pendente)' if res_mc['eixo_pct_vazio'] else ''}")

    # ── Rota CPU Coeficientes — base de custo (558 CPUs · invariante MOD+EQP ≤ custo direto) ──────
    res_cpu = extrair_cpu_coeficientes(secoes)
    if res_cpu["cpus"]:
        upsert_cpu_coeficientes(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                                config_version=CONFIG_VERSION_WORKBOOK, status=res_cpu["status"], cpus=res_cpu["cpus"])
        routed.append(f"CPU Coeficientes: {res_cpu['n_cpus']} CPUs · {res_cpu['n_consistente']}/"
                      f"{res_cpu['n_com_cd']} consistentes (MOD+EQP ≤ custo direto)")

    # ── Rota C.13 TIMELINE — Gantt contratado × real (MS Project · eixo real + nível/grupo) ──────
    res_ct = extrair_cronograma_tarefas_c13(secoes)
    if res_ct["tarefas"]:
        g = gate_cronograma_tarefas_c13(res_ct)
        upsert_cronograma_tarefas(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], tarefas=res_ct["tarefas"],
        )
        tag = f"C.13 Gantt: {res_ct['n']} tarefas · {g.get('n_grupos', 0)} grupos (status={g['status']})"
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.13 EVENTOS de prazo (cadastro datado · impactam a timeline) ───────────────────────
    res_ev = extrair_eventos_prazo(secoes)
    if res_ev["eventos"]:
        g = gate_eventos_prazo(res_ev)
        upsert_eventos_prazo(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=g["status"], eventos=res_ev["eventos"],
        )
        tag = f"C.13 Eventos: {res_ev['n']} eventos de prazo (status={g['status']})"
        (em_revisao if g["status"] == "needs_review" else routed).append(tag)

    # ── Rota C.13 PARAMS (header/cards/Windows Analysis · 1 linha) ───────────────────────────────
    res_tp = extrair_timeline_params(secoes)
    if res_tp["params"]:
        upsert_timeline_params(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=CONFIG_VERSION_WORKBOOK, status=res_tp["status"], params=res_tp["params"],
        )
        p = res_tp["params"]
        routed.append(f"C.13 Params: OS real {p.get('os_real')} → término {p.get('termino_contratual')} "
                      f"· {p.get('total_eventos')} eventos")

    # ── CAPTURA GENÉRICA (rede de completude) — TODA seção com dado vai pro banco ──────────────
    caps = capturar_secoes(secoes)
    if caps:
        upsert_secoes(contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                      config_version=CONFIG_VERSION_WORKBOOK, secoes=caps)
        n_cob = sum(1 for c in caps if c["coberta"])
        routed.append(f"Captura genérica: {len(caps)} seções no banco ({n_cob} cobertas por resolver, "
                      f"{len(caps) - n_cob} genéricas — nada dropado)")

    # ── COBERTURA pelo GUIA-CONTRATO (autoritativo) — substitui a lista hardcoded de pendentes ──
    # Das abas que o Guia declara ATÔMICAS, as sem resolver viram pendente. Fallback p/ a lista
    # hardcoded quando a obra não traz Guia (fluxo Sorriso). Gate de cobertura: o que o Guia espera
    # e não foi roteado aparece — nunca some em silêncio (rename de título não engole seção).
    contrato = parse_guia_contrato(secoes)
    cobertura_tag = ""
    if contrato["abas"]:
        cob = cobertura_atomica(contrato, routed + em_revisao)
        for aba in cob["pendente"]:
            pendentes.append(f"{aba} — atômica declarada no Guia, sem resolver")
        cobertura_tag = f"cobertura {len(cob['coberto'])}/{cob['n_atomica']} atômicas do Guia"
    else:
        for needles in _PENDENTES_RMA:
            s = _achar_secao(secoes, *needles)
            if s is not None:
                pendentes.append(f"{s.get('titulo', '/'.join(needles))} — resolver pendente")

    n_total_secoes = len([s for s in secoes if isinstance(s, dict)])
    # Status do ARQUIVO: needs_review só se algo roteado falhou o gate; senão 'normalized'
    # (processou; o que falta é cobertura pendente, não erro). Nunca verde sobre seção não-conferida.
    status_arquivo = "needs_review" if em_revisao else "normalized"
    partes = []
    if routed:
        partes.append("✓ " + " · ".join(routed))
    if em_revisao:
        partes.append("⚠ revisão: " + " · ".join(em_revisao))
    if cobertura_tag:
        partes.append(cobertura_tag)
    if pendentes:
        partes.append(f"↷ {len(pendentes)} seção(ões) RMA pendente(s) de resolver")
    reason = (f"workbook-motor ({n_total_secoes} seções): " + " | ".join(partes))[:2000] \
        or "workbook-motor: nenhuma seção roteável nesta leva"

    return {"status_arquivo": status_arquivo, "reason": reason,
            "routed": routed, "em_revisao": em_revisao, "pendentes": pendentes}
