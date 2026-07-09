"""Worker da Normalização (Camada A) · drena obra_arquivos na fase 'normalizacao'.

Fluxo por arquivo:
    acquire_lease('normalizacao') → load_latest_extracao → config_para_doc_type →
    engine.normalizar → upsert_medicao → complete_job (normalized | normalizacao_error).

Determinístico, SEM modelo (custo zero, rápido). Falha-alto: competência ambígua →
normalizacao_error; gate de invariante falha → grava mas marca a MEDIÇÃO needs_review.

Uso (dentro de agent/, venv ativa):
    python -m agents.normalizacao.job --once     # drena e sai (dev)
    python -m agents.normalizacao.job             # loop contínuo (worker)
"""

from __future__ import annotations

import argparse
import signal
import sys
import time

from config import POLL_INTERVAL_SEC
from services.queue import acquire_lease, complete_job, reap_stale_leases

from .configs import (
    DOCTYPE_CATALOGO_INSUMOS,
    DOCTYPE_INSUMOS_VALOR,
    config_para_doc_type,
    cronograma_v1,
    eh_doctype_insumos,
    eh_doctype_produtividade,
    eh_doctype_reajuste,
    eh_doctype_workbook_motor,
)
from .engine import (
    enriquecer_insumos_com_catalogo,
    enriquecer_insumos_com_valor,
    normalizar,
    normalizar_acumulada,
    normalizar_cronograma,
    normalizar_insumos,
)
from .persist import (
    atualizar_obra_reajuste,
    buscar_extracao_por_doctype,
    carregar_identidade_obra,
    load_latest_extracao,
    upsert_cronograma,
    upsert_cronograma_tarefas,
    upsert_faturamento_curva,
    upsert_insumos,
    upsert_medicao,
    upsert_orcamento,
    upsert_produtividade,
)
from .resolvers import extrair_indice_reajuste, extrair_produtividade, gate_pertinencia
from .workbook_motor import processar_workbook_motor

_stop = False


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _install_signals() -> None:
    def handler(signum, _frame):  # noqa: ANN001
        global _stop
        _stop = True
        _log(f"Sinal {signal.Signals(signum).name} · parando após o atual…")

    for s in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(s, handler)
        except (ValueError, OSError):
            pass


def _eh_cronograma_cfg(cfg) -> bool:  # noqa: ANN001
    """A config é a do cronograma (entidade obra_cronograma_previsto)?"""
    return any(e.entidade == "obra_cronograma_previsto" for e in cfg.entidades)


def _eh_acumulada_cfg(cfg) -> bool:  # noqa: ANN001
    """A config é a da Medição acumulada (entidade obra_faturamento_meses)?"""
    return any(e.entidade == "obra_faturamento_meses" for e in cfg.entidades)


def _processar_acumulada(arquivo_id, contrato_id, nome, payload, version, cfg) -> str:  # noqa: ANN001
    """Medição acumulada → Curva S financeira (Contratado baseline + Projeção). NÃO toca os
    BMs (já limpos). Gate Σ cada curva == custo total → arquivo sai de review só se fechar."""
    res = normalizar_acumulada(payload, cfg, nome_original=nome)
    meses = res["entidades"].get("obra_faturamento_meses", [])
    if not meses:
        _log("  ↷ sem curvas financeiras extraíveis — pulado")
        complete_job(arquivo_id, "normalized", "sem curvas financeiras — pulado")
        return "skipped"
    cur_status = "ok" if res["status"] == "ok" else "needs_review"
    try:
        curva_id = upsert_faturamento_curva(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version=cfg.config_version, status=cur_status,
            header=res.get("header") or {}, meses=meses,
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ upsert faturamento falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"upsert faturamento: {e}")
        return "normalizacao_error"
    # Orçamento (entidade INDEPENDENTE do mesmo doc · falha do orçamento não derruba a curva).
    orc = res.get("orcamento")
    orc_itens = res["entidades"].get("obra_orcamento_itens", [])
    orc_log = ""
    if orc and orc_itens:
        try:
            upsert_orcamento(
                contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                config_version=cfg.config_version, status=orc["status"],
                resumo=orc["resumo"], itens=orc_itens,
            )
            orc_log = f" · orçamento {orc['status']} ({len(orc_itens)} itens · BDI {orc['resumo'].get('bdi')})"
        except Exception as e:  # noqa: BLE001
            _log(f"  ⚠ upsert orçamento falhou (faturamento segue): {type(e).__name__}: {e}")

    # Cronograma-fonte (tarefas/marcos) · entidade independente.
    tar = res.get("tarefas")
    tar_itens = res["entidades"].get("obra_cronograma_tarefas", [])
    if tar and tar_itens:
        try:
            upsert_cronograma_tarefas(
                contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
                config_version=cfg.config_version, status=tar["status"], tarefas=tar_itens,
            )
            orc_log += f" · tarefas {tar['status']} ({tar.get('n_distintos')} EDTs, {tar.get('n_marcos')} marcos)"
        except Exception as e:  # noqa: BLE001
            _log(f"  ⚠ upsert tarefas falhou (faturamento segue): {type(e).__name__}: {e}")

    g = res["gate"] or {}
    if cur_status == "ok":
        # a curva fechou, mas se uma sub-entidade independente (orçamento/tarefas) está em revisão,
        # o arquivo NÃO sai silenciosamente verde — o aviso vai no reason/log (honestidade).
        sub_reason = " · ".join(res.get("sub_review") or [])[:2000] or None
        complete_job(arquivo_id, "normalized", sub_reason)
        rev = f" · ⚠ {sub_reason}" if sub_reason else ""
        _log(f"  ✓ faturamento ok · {len(meses)} meses · proj={g.get('proj_total')} "
             f"base={g.get('base_total')} (curva {str(curva_id)[:8]}…){orc_log}{rev}")
        return "normalized"
    reason = " · ".join(f["msg"] for f in res["findings"] if f["severity"] == "error")[:2000]
    complete_job(arquivo_id, "normalizacao_error", reason or "gate de faturamento não fechou")
    _log(f"  ✗ faturamento needs_review · {reason}")
    return "normalizacao_error"


def _persistir_cronograma(arquivo_id, contrato_id, nome, payload, version) -> str | None:  # noqa: ANN001
    """Extrai+grava a curva PREVISTA FÍSICA do payload, SE houver distribuição mensal. Gate
    Σ% == 100% protege (needs_review se não fechar). Retorna sufixo de log, ou None se o doc
    não traz cronograma (pula gracioso — não é erro). Fonte VALIDADA = BM/Medição (BM-02)."""
    res = normalizar_cronograma(payload, cronograma_v1(), nome_original=nome)
    meses = res["entidades"].get("obra_cronograma_previsto", [])
    if not meses:
        return None  # doc sem distribuição mensal → não é cronograma, nada a gravar
    cron_status = "ok" if res["status"] == "ok" else "needs_review"
    cron_id = upsert_cronograma(
        contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
        config_version=cronograma_v1().config_version, status=cron_status,
        header=res.get("header") or {}, meses=meses,
    )
    g = res["gate"] or {}
    return (f"cronograma {cron_status} · {len(meses)} meses · Σ%={g.get('soma_pct')} "
            f"(cronograma {str(cron_id)[:8]}…)")


def _processar_medicao(arquivo_id, contrato_id, nome, payload, version, cfg) -> str:  # noqa: ANN001
    res = normalizar(payload, cfg, nome_original=nome)
    comp = res["competencia"]
    if comp["status"] != "ok":
        _log(f"  ✗ competência: {comp['motivo']}")
        complete_job(arquivo_id, "normalizacao_error", f"competência: {comp['motivo']}")
        return "normalizacao_error"

    med_status = "needs_review" if res["status"] == "needs_review" else "ok"
    try:
        medicao_id = upsert_medicao(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            comp=comp, config_version=cfg.config_version, status=med_status,
            itens=res["entidades"].get("obra_medicao_itens", []),
            totais=res["entidades"].get("obra_medicao_totais", {}),
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ upsert falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"upsert: {e}")
        return "normalizacao_error"

    # Bônus: o doc de Medição/BM pode trazer o Cronograma Físico-Financeiro EMBUTIDO (curva
    # prevista física). Fonte validada. Gracioso se ausente; falha do cronograma NÃO derruba
    # a medição (já gravada).
    cron_log = None
    try:
        cron_log = _persistir_cronograma(arquivo_id, contrato_id, nome, payload, version)
    except Exception as e:  # noqa: BLE001
        _log(f"  ⚠ cronograma embutido falhou (medição segue): {type(e).__name__}: {e}")

    reason = None if med_status == "ok" else " · ".join(
        f["msg"] for f in res["findings"] if f["severity"] == "error"
    )[:2000]
    complete_job(arquivo_id, "normalized", reason)
    n_itens = len(res["entidades"].get("obra_medicao_itens", []))
    gate = res["gate"]
    _log(
        f"  ✓ {'normalized' if med_status == 'ok' else 'normalized · MEDIÇÃO em revisão'} · "
        f"bm={comp['bm_numero']} · {n_itens} itens · Σfolhas={gate['soma_folhas']:.2f} "
        f"vs {gate['total_declarado']} (medicao {str(medicao_id)[:8]}…)"
    )
    if cron_log:
        _log(f"  ✓ + {cron_log}")
    return "normalized"


def _processar_cronograma(arquivo_id, contrato_id, nome, payload, version) -> str:  # noqa: ANN001
    """Doc dedicado de Cronograma (standalone). Fonte secundária — o gate protege. Sem
    distribuição legível → pula gracioso (não erro, evita retry-loop)."""
    try:
        cron_log = _persistir_cronograma(arquivo_id, contrato_id, nome, payload, version)
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ upsert cronograma falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"upsert cronograma: {e}")
        return "normalizacao_error"
    if cron_log is None:
        _log("  ↷ cronograma sem distribuição mensal legível — pulado")
        complete_job(arquivo_id, "normalized", "cronograma sem distribuição mensal legível — pulado")
        return "skipped"
    complete_job(arquivo_id, "normalized", None)
    _log(f"  ✓ {cron_log}")
    return "normalized"


def _processar_insumos(arquivo_id, contrato_id, nome, payload, version) -> str:  # noqa: ANN001
    """Histograma de Insumos por Quantidades → take-off físico (obra_insumos + obra_insumo_meses).
    Gate de conservação (Σ células == Σ Total) protege. ENRIQUECE classe ABC + grupo de custo do
    CATÁLOGO (doc Curva ABC, cross-doc) se disponível — degrada gracioso (classe NULL) se não houver.
    Genérico p/ obra #2: nada de contrato hardcoded (o populate one-off não serve mais)."""
    res = normalizar_insumos(payload, nome_original=nome)
    insumos = res["entidades"].get("obra_insumos", [])
    meses = res["entidades"].get("obra_insumo_meses", [])
    if not insumos:
        reason = " · ".join(f["msg"] for f in res["findings"] if f["severity"] == "error")[:2000]
        complete_job(arquivo_id, "normalized", reason or "sem insumos extraíveis — pulado")
        _log(f"  ↷ sem insumos extraíveis · {reason}")
        return "skipped"
    status = "needs_review" if res["status"] != "ok" else "ok"

    # enriquecimento cross-doc 1: classe ABC + grupo de custo do Cadastro de Insumos (doc Curva ABC).
    enr_log = " · classe ABC pendente (sem catálogo)"
    cat = buscar_extracao_por_doctype(contrato_id, DOCTYPE_CATALOGO_INSUMOS)
    if cat and isinstance(cat.get("payload"), dict):
        enr = enriquecer_insumos_com_catalogo(insumos, cat["payload"])
        insumos = enr["insumos"]
        n_enr = enr.get("n_enriquecidos", 0)
        enr_log = (f" · {n_enr}/{len(insumos)} c/ classe ABC (catálogo {enr.get('n_catalogo', 0)})"
                   if enr["status"] == "ok"
                   else f" · enriquecimento parcial ({n_enr}/{len(insumos)} c/ ABC · catálogo s/ seção)")

    # enriquecimento cross-doc 2: VALOR orçado (R$) do Histograma por Valor → Curva ABC por valor.
    # Referência orçada (conf 0,600 · fontes divergem ~7%), não preço de centavo — degrada gracioso.
    val = buscar_extracao_por_doctype(contrato_id, DOCTYPE_INSUMOS_VALOR)
    if val and isinstance(val.get("payload"), dict):
        enr_v = enriquecer_insumos_com_valor(insumos, val["payload"])
        insumos = enr_v["insumos"]
        tv = enr_v.get("total_valor")
        enr_log += (f" · {enr_v.get('n_enriquecidos', 0)}/{len(insumos)} c/ valor orçado "
                    f"(Σ R$ {tv:,.0f})" if tv else " · valor orçado parcial")

    try:
        n_ins, n_mes = upsert_insumos(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version="insumos@1.0.0", status=status, insumos=insumos, meses=meses,
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ upsert insumos falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"upsert insumos: {e}")
        return "normalizacao_error"
    reason = None if status == "ok" else " · ".join(
        f["msg"] for f in res["findings"] if f["severity"] == "error")[:2000]
    complete_job(arquivo_id, "normalized", reason)
    g = res["gate"] or {}
    _log(f"  ✓ insumos {status} · {n_ins} insumos · {n_mes} meses · "
         f"Σ={g.get('total_geral')} vs {g.get('soma_total_declarado')}{enr_log}")
    return "normalized"


def _processar_produtividade(arquivo_id, contrato_id, nome, payload, version) -> str:  # noqa: ANN001
    """Controle de Armação e Concreto → produtividade FÍSICA (Σaço / Σperson-h), recomputada do
    diário (ignora o KPI errado do dashboard). A anomalia de perda (>100%) é sinalizada, não
    ocultada. Genérico p/ obra #2 (sem contrato hardcoded)."""
    res = extrair_produtividade(payload)
    meses = res.get("meses", [])
    resumo = res.get("resumo", {})
    if not meses:
        reason = " · ".join(f["msg"] for f in res["findings"] if f["severity"] == "error")[:2000]
        complete_job(arquivo_id, "normalized", reason or "sem tabela diária de armação — pulado")
        _log(f"  ↷ sem produtividade extraível · {reason}")
        return "skipped"
    status = "needs_review" if res["status"] != "ok" else "ok"
    try:
        _prod_id, n_mes = upsert_produtividade(
            contrato_id=contrato_id, arquivo_id=arquivo_id, extracao_version=version,
            config_version="produtividade@1.0.0", status=status, resumo=resumo, meses=meses,
        )
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ upsert produtividade falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"upsert produtividade: {e}")
        return "normalizacao_error"
    anomalia = next((f["msg"] for f in res["findings"] if "ANOMALIA" in f["msg"]), None)
    complete_job(arquivo_id, "normalized", anomalia)
    _log(f"  ✓ produtividade {status} · {resumo.get('produtividade_real_kg_ph')} kg/Hh · {n_mes} meses"
         + (f" · ⚠ {anomalia}" if anomalia else ""))
    return "normalized"


def _processar_reajuste(arquivo_id, contrato_id, nome, payload, version) -> str:  # noqa: ANN001
    """Solicitação de Reajustamento (PSP) → índice contratual de reajuste no CADASTRO da obra
    (obras.indice_reajuste/periodicidade). Resolve o §4.4 (INCC, não IPCA). Não gera entidade de
    série temporal (a série mensal é externa, FGV); só fixa o índice contratual. Genérico."""
    res = extrair_indice_reajuste(payload)
    if res["status"] != "ok" or not res.get("indice"):
        reason = res.get("motivo") or "índice de reajuste não extraível"
        complete_job(arquivo_id, "normalized", reason)
        _log(f"  ↷ reajuste: {reason}")
        return "skipped"
    try:
        atualizar_obra_reajuste(contrato_id, res["indice"], res.get("periodicidade"))
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ update obra (reajuste) falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"update reajuste: {e}")
        return "normalizacao_error"
    complete_job(arquivo_id, "normalized", None)
    _log(f"  ✓ reajuste · índice contratual = {res['indice']} · "
         f"{res.get('periodicidade') or 'periodicidade ?'} ({len(res['series'])} séries FGV)")
    return "normalized"


def _processar_workbook_motor(arquivo_id, contrato_id, nome, payload, version) -> str:  # noqa: ANN001
    """Workbook-motor consolidado → SPLITTER (fan-out 1 envelope → N seções). Roteia cada seção C.x
    pro seu resolver+gate+persist. Nesta leva só C.6 Insumos·CurvaABC tem resolver; o resto é
    reconhecido e logado como pendente (não inventa dado). Status do arquivo: needs_review se algo
    roteado não fechou o gate; senão normalized (com reason enumerando routed/revisão/pendentes)."""
    try:
        r = processar_workbook_motor(arquivo_id, contrato_id, nome, payload, version)
    except Exception as e:  # noqa: BLE001
        _log(f"  ✗ splitter workbook-motor falhou: {type(e).__name__}: {e}")
        complete_job(arquivo_id, "normalizacao_error", f"workbook-motor: {e}")
        return "normalizacao_error"
    complete_job(arquivo_id, r["status_arquivo"], r["reason"])
    _log(f"  ✓ workbook-motor · {r['reason']}")
    return r["status_arquivo"]


def process_one(row: dict) -> str:
    arquivo_id = row["id"]
    nome = row.get("nome_original") or arquivo_id
    contrato_id = row.get("obra_id")
    _log(f"→ Normalizando «{nome}» (id={arquivo_id[:8]}…)")

    ext = load_latest_extracao(arquivo_id)
    if not ext or not isinstance(ext.get("payload"), dict):
        _log("  ✗ sem extração utilizável")
        complete_job(arquivo_id, "normalizacao_error", "sem extração (payload) pra normalizar")
        return "normalizacao_error"

    payload = ext["payload"]
    version = ext["version"]
    doc_type = ext.get("doc_type") or ""

    # Decide a ROTA: handler dedicado (insumos/produtividade/reajuste/workbook-motor) ou config.
    rota_dedicada = (eh_doctype_insumos(doc_type) or eh_doctype_produtividade(doc_type)
                     or eh_doctype_reajuste(doc_type) or eh_doctype_workbook_motor(doc_type))
    cfg = None if rota_dedicada else config_para_doc_type(doc_type)

    # Gate de PERTINÊNCIA — só p/ docs que SERÃO normalizados (rota dedicada OU config). Barra doc
    # de OUTRA obra ANTES de contaminar as tabelas (o acervo real tinha Sorocaba/Novo Túnel). Docs
    # genéricos sem rota seguem 'skipped' (não passam aqui). Obra sem identidade no cadastro → passa.
    if rota_dedicada or cfg is not None:
        # Identidade do doc = resumo + tipo + VALORES da identificação. O resumo sozinho pode não citar o
        # token da obra (ex.: a contratada/consórcio 'ATERPA' vive só em identificacao, não no resumo) →
        # gate dava falso-negativo e barrava a obra CERTA. A identificação é onde a obra é nomeada.
        _ident = payload.get("identificacao") or {}
        _texto_pert = " ".join([str(payload.get("resumo") or ""), str(payload.get("tipo_documento") or ""),
                                " ".join(str(v) for v in _ident.values())])
        pert = gate_pertinencia(_texto_pert, carregar_identidade_obra(contrato_id))
        if not pert["pertinente"]:
            complete_job(arquivo_id, "normalizacao_error", f"pertinência: {pert['motivo']}")
            _log(f"  ✗ pertinência (doc de outra obra?): {pert['motivo']}")
            return "normalizacao_error"

    # Handlers DEDICADOS (resolvers auto-descritivos, fora do CampoMap) — roteados por doc_type.
    if eh_doctype_insumos(doc_type):
        return _processar_insumos(arquivo_id, contrato_id, nome, payload, version)
    if eh_doctype_produtividade(doc_type):
        return _processar_produtividade(arquivo_id, contrato_id, nome, payload, version)
    if eh_doctype_reajuste(doc_type):
        return _processar_reajuste(arquivo_id, contrato_id, nome, payload, version)
    if eh_doctype_workbook_motor(doc_type):
        return _processar_workbook_motor(arquivo_id, contrato_id, nome, payload, version)

    if cfg is None:
        # Tipo de doc ainda sem config → PULA gracioso (não é erro, não fica em retry-loop).
        _log(f"  ↷ sem config p/ doc_type '{doc_type}' — pulado")
        complete_job(arquivo_id, "normalized", f"tipo '{doc_type}' sem config de normalização — pulado")
        return "skipped"

    # Roteia pelo tipo de config: acumulada (curvas R$) · cronograma standalone · medição.
    if _eh_acumulada_cfg(cfg):
        return _processar_acumulada(arquivo_id, contrato_id, nome, payload, version, cfg)
    if _eh_cronograma_cfg(cfg):
        return _processar_cronograma(arquivo_id, contrato_id, nome, payload, version)
    return _processar_medicao(arquivo_id, contrato_id, nome, payload, version, cfg)


def run(once: bool, poll: float) -> None:
    mode = "drena e sai" if once else "loop contínuo"
    _log(f"Normalizador iniciado · {mode}")
    reaped = reap_stale_leases()
    if reaped:
        _log(f"⚑ reaper: {reaped} doc(s) preso(s) movido(s) pra estado de erro.")
    processed = 0
    empty = 0
    while not _stop:
        try:
            row = acquire_lease("normalizacao")
        except Exception as e:  # noqa: BLE001
            _log(f"✗ acquire_lease falhou: {e}")
            if once:
                break
            time.sleep(poll)
            continue
        if row is None:
            if once:
                _log(f"Fila vazia · concluído. {processed} normalizado(s).")
                break
            empty += 1
            if empty == 1:
                _log("Fila vazia · aguardando docs em extracted/verified… (Ctrl+C pra sair)")
            reap_stale_leases()
            time.sleep(poll)
            continue
        empty = 0
        process_one(row)
        processed += 1
    _log(f"Encerrado. Total nesta execução: {processed}.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Normalizador de documentos da obra (Fase 3)")
    ap.add_argument("--once", action="store_true", help="drena a fila e sai (dev)")
    ap.add_argument("--poll", type=float, default=POLL_INTERVAL_SEC, help="intervalo de polling (s)")
    args = ap.parse_args()
    _install_signals()
    try:
        run(once=args.once, poll=args.poll)
    except KeyboardInterrupt:
        _log("Interrompido.")
        sys.exit(0)


if __name__ == "__main__":
    main()
