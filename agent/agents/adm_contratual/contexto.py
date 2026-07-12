"""Contexto/FATOS da obra para a IA (grounding). Lê as tabelas NORMALIZADAS e monta o conjunto de
fatos RESOLVIDOS que a IA recebe — a IA interpreta, NÃO calcula nem inventa número. É a fonte da
verdade do «DATA_CONTEXT» do chat E do diagnóstico. Determinístico (sem modelo).

Contrato de honestidade: todo número que a IA pode citar SAI daqui. O validador (validador.py)
confere que a saída da IA não introduz número que não esteja nestes fatos.
"""

from __future__ import annotations

from services.supabase_client import supabase

_FAROL_LABEL = {"conforme": "Conforme", "observacao": "Observação",
                "risco": "Risco", "critico": "Crítico"}


def _num(v) -> float | None:  # noqa: ANN001
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _achar_corte(meses_fat: list[dict], realizado: float | None) -> tuple[int, int] | None:
    """Corte = mês cujo projeção_rs_acumulado mais se aproxima do realizado — MESMO método da Camada
    B (calcFaturamento.acharCorteIdx). Mantém paridade com a aba (golden trava). None se sem dado."""
    if realizado is None:
        return None
    melhor, menor = None, float("inf")
    for m in meses_fat:
        pa = _num(m.get("projecao_rs_acumulado"))
        if pa is None:
            continue
        d = abs(pa - realizado)
        if d < menor:
            menor, melhor = d, (m["ano"], m["mes"])
    return melhor


def _farol_faturamento_desvio(desvio_pp: float | None) -> str | None:
    """Régua OFICIAL `faturamento_desvio_acumulado` (espelha src/lib/rma/farol.ts; golden trava os
    cortes): desvio ≥ -1 Conforme · ≥ -5 Observação · ≥ -10 Risco · senão Crítico (abaixo = pior)."""
    if desvio_pp is None:
        return None
    for nivel, corte in (("conforme", -1.0), ("observacao", -5.0), ("risco", -10.0)):
        if desvio_pp >= corte:
            return nivel
    return "critico"


def coletar_fatos(obra_id: str) -> dict:
    """Fatos RESOLVIDOS da obra, das tabelas normalizadas. Só números que já passaram pelos gates
    da Camada A/B. Campos ausentes ficam de fora (a IA dirá 'pendente'), nunca preenchidos a 0."""
    fatos: dict = {}

    o = (supabase.table("obras")
         .select("nome_interno, indice_reajuste, periodicidade_reajuste, data_inicio, data_termino")
         .eq("id", obra_id).limit(1).execute().data or [{}])[0]
    fatos["obra"] = {k: o.get(k) for k in
                     ("nome_interno", "indice_reajuste", "periodicidade_reajuste",
                      "data_inicio", "data_termino") if o.get(k) is not None}

    # Faturamento + físico (último BM) — realizado ÷ contratado-raiz = aderência.
    meds = (supabase.table("obra_medicoes").select("id, bm_numero")
            .eq("contrato_id", obra_id).order("bm_numero", desc=True).execute().data or [])
    if meds:
        ult = meds[0]
        tot = (supabase.table("obra_medicao_totais")
               .select("total_acumulado_valor, fisico_pct_acumulado")
               .eq("medicao_id", ult["id"]).limit(1).execute().data or [{}])[0]
        realizado = _num(tot.get("total_acumulado_valor"))
        fisico = _num(tot.get("fisico_pct_acumulado"))
        ids = [m["id"] for m in meds]
        raizes = (supabase.table("obra_medicao_itens").select("valor_contratado")
                  .in_("medicao_id", ids).eq("numero_item", "1").execute().data or [])
        contratado = max((x for x in (_num(r.get("valor_contratado")) for r in raizes) if x is not None),
                         default=None)
        # workbook-motor: a raiz "1" pode ser só a 1ª disciplina — o CFF da curva é o total oficial
        _cv = (supabase.table("obra_faturamento_curvas").select("custo_total")
               .eq("contrato_id", obra_id).order("created_at", desc=True).limit(1).execute().data or [])
        _ct_curva = _num((_cv[0] if _cv else {}).get("custo_total"))
        if _ct_curva and (not contratado or contratado < _ct_curva * 0.5):
            contratado = _ct_curva
        fat = {"bm_corte": ult["bm_numero"]}
        if realizado is not None:
            fat["realizado_acumulado_rs"] = round(realizado, 2)
        if contratado is not None:
            fat["contratado_total_rs"] = round(contratado, 2)
        # realizado ÷ contrato TOTAL = avanço FINANCEIRO (% do contrato faturado).
        if realizado and contratado:
            fat["avanco_financeiro_pct"] = round(realizado / contratado * 100, 2)
        # aderência vs PREVISTO no corte = realizado ÷ contratado-acumulado-no-corte (Camada B). O
        # corte vem por projeção≈realizado; o farol pela régua oficial. (paridade golden-testada)
        curvas = (supabase.table("obra_faturamento_curvas").select("id")
                  .eq("contrato_id", obra_id).order("created_at", desc=True).limit(1)
                  .execute().data or [])
        mfat = (supabase.table("obra_faturamento_meses")
                .select("ano, mes, projecao_rs_acumulado, contratado_rs_acumulado")
                .eq("curva_id", curvas[0]["id"]).execute().data if curvas else []) or []
        corte = _achar_corte(mfat, realizado)
        if corte and realizado:
            cm = next((m for m in mfat if m["ano"] == corte[0] and m["mes"] == corte[1]), {})
            ct_corte = _num(cm.get("contratado_rs_acumulado"))
            if ct_corte:
                ader = round(realizado / ct_corte * 100, 2)
                fat["aderencia_vs_previsto_pct"] = ader
                fat["desvio_faturamento_pp"] = round(ader - 100, 2)
                fat["farol_faturamento"] = _farol_faturamento_desvio(round(ader - 100, 2))
        fatos["faturamento"] = fat

        if fisico is not None:
            fis = {"real_acumulado_pct": round(fisico * 100, 2)}
            if corte:  # previsto físico no corte, do cronograma mais COMPLETO (o autoritativo)
                crons = (supabase.table("obra_cronogramas").select("id")
                         .eq("contrato_id", obra_id).execute().data or [])
                best, bestn = None, -1
                for cr in crons:
                    n = len(supabase.table("obra_cronograma_meses").select("id")
                            .eq("cronograma_id", cr["id"]).execute().data or [])
                    if n > bestn:
                        bestn, best = n, cr["id"]
                if best:
                    cmeses = (supabase.table("obra_cronograma_meses")
                              .select("ano, mes, previsto_pct_acumulado")
                              .eq("cronograma_id", best).execute().data or [])
                    pm = next((m for m in cmeses if m["ano"] == corte[0] and m["mes"] == corte[1]), None)
                    pv = _num((pm or {}).get("previsto_pct_acumulado"))
                    if pv is not None:
                        fis["previsto_acumulado_pct"] = round(pv * 100, 2)
                        fis["atraso_fisico_pp"] = round(
                            fis["real_acumulado_pct"] - fis["previsto_acumulado_pct"], 2)
            fatos["fisico"] = fis

    # Fallback SEM doc de medição (workbook-motor: a curva JÁ é o BM oficial · caso SBSO).
    corte_fb = None
    if "faturamento" not in fatos:
        curvas = (supabase.table("obra_faturamento_curvas").select("id, custo_total")
                  .eq("contrato_id", obra_id).order("created_at", desc=True).limit(1).execute().data or [])
        mfat = (supabase.table("obra_faturamento_meses")
                .select("ano, mes, real_rs, real_rs_acumulado, contratado_rs_acumulado")
                .eq("curva_id", curvas[0]["id"]).execute().data if curvas else []) or []
        mfat.sort(key=lambda m: (m.get("ano") or 0, m.get("mes") or 0))
        idx_corte = None
        for i, m in enumerate(mfat):
            if (_num(m.get("real_rs")) or 0) > 0:
                idx_corte = i
        if idx_corte is not None:
            ult = mfat[idx_corte]
            corte_fb = (ult["ano"], ult["mes"])
            realizado = _num(ult.get("real_rs_acumulado"))
            contratado = _num(curvas[0].get("custo_total")) or max(
                (x for x in (_num(m.get("contratado_rs_acumulado")) for m in mfat) if x is not None), default=None)
            fat = {"bm_corte": idx_corte + 1}
            if realizado is not None:
                fat["realizado_acumulado_rs"] = round(realizado, 2)
            if contratado is not None:
                fat["contratado_total_rs"] = round(contratado, 2)
            if realizado and contratado:
                fat["avanco_financeiro_pct"] = round(realizado / contratado * 100, 2)
            ct_corte = _num(ult.get("contratado_rs_acumulado"))
            if realizado and ct_corte:
                ader = round(realizado / ct_corte * 100, 2)
                fat["aderencia_vs_previsto_pct"] = ader
                fat["desvio_faturamento_pp"] = round(ader - 100, 2)
                fat["farol_faturamento"] = _farol_faturamento_desvio(round(ader - 100, 2))
            fatos["faturamento"] = fat

    if "fisico" not in fatos and corte_fb:
        crons = (supabase.table("obra_cronogramas").select("id")
                 .eq("contrato_id", obra_id).execute().data or [])
        best, bestn = None, -1
        for cr in crons:
            n = len(supabase.table("obra_cronograma_meses").select("id")
                    .eq("cronograma_id", cr["id"]).execute().data or [])
            if n > bestn:
                bestn, best = n, cr["id"]
        if best:
            cmeses = (supabase.table("obra_cronograma_meses")
                      .select("ano, mes, previsto_pct_acumulado, real_pct_acumulado")
                      .eq("cronograma_id", best).execute().data or [])
            pm = next((m for m in cmeses if m["ano"] == corte_fb[0] and m["mes"] == corte_fb[1]), None)
            rl = _num((pm or {}).get("real_pct_acumulado"))
            pv = _num((pm or {}).get("previsto_pct_acumulado"))
            if rl is not None:
                fis = {"real_acumulado_pct": round(rl * 100, 2)}
                if pv is not None:
                    fis["previsto_acumulado_pct"] = round(pv * 100, 2)
                    fis["atraso_fisico_pp"] = round(fis["real_acumulado_pct"] - fis["previsto_acumulado_pct"], 2)
                fatos["fisico"] = fis

    # Desequilíbrio (D.0) — teto quantificado + maior categoria (sempre que houver painel).
    des = (supabase.table("obra_desequilibrio").select("categoria, tela, valor_rs")
           .eq("contrato_id", obra_id).execute().data or [])
    _dv = [(d, _num(d.get("valor_rs"))) for d in des]
    _soma = sum(v for _, v in _dv if v)
    if des and _soma:
        _top = max((x for x in _dv if x[1]), key=lambda x: x[1])
        fatos["desequilibrio"] = {"total_rs": round(_soma, 2), "n_categorias": len(des),
                                  "maior_categoria": str(_top[0].get("categoria"))[:60],
                                  "maior_tela": _top[0].get("tela"), "maior_rs": round(_top[1], 2)}

    # Insumos de faturamento direto (v53 · PQ C.04 c/ BDI) — Curva ABC por valor de contrato.
    ins = (supabase.table("obra_insumos_fd").select("valor_contrato_bdi, valor_medido_bdi")
           .eq("contrato_id", obra_id).execute().data or [])
    vals = sorted((x for x in (_num(i.get("valor_contrato_bdi")) for i in ins)
                   if x is not None and x > 0), reverse=True)
    if vals:
        total = sum(vals)
        medido = sum(_num(i.get("valor_medido_bdi")) or 0 for i in ins)
        acc, n80 = 0.0, 0
        for v in vals:
            acc += v
            n80 += 1
            if acc >= 0.8 * total:
                break
        fatos["insumos"] = {"n_insumos": len(ins), "contrato_fd_bdi_rs": round(total, 2),
                            "medido_bdi_rs": round(medido, 2),
                            "n_concentram_80pct_do_valor": n80}

    # Produtividade econômica (HH) — fallback quando não há física normalizada.
    pe = (supabase.table("obra_produtividade_economica").select("hh_previsto, hh_real")
          .eq("contrato_id", obra_id).execute().data or [])
    if pe:
        hhp = sum(_num(x.get("hh_previsto")) or 0 for x in pe)
        hhr = sum(_num(x.get("hh_real")) or 0 for x in pe)
        if hhp:
            fatos["produtividade_hh"] = {"hh_previsto_total": round(hhp), "hh_real_acum": round(hhr)}

    # Produtividade física.
    pr = (supabase.table("obra_produtividade")
          .select("produtividade_real_kg_ph, avanco_fisico_pct")
          .eq("contrato_id", obra_id).limit(1).execute().data or [])
    if pr:
        p = {}
        if _num(pr[0].get("produtividade_real_kg_ph")) is not None:
            p["kg_por_pessoa_hora"] = round(_num(pr[0]["produtividade_real_kg_ph"]), 4)
        if _num(pr[0].get("avanco_fisico_pct")) is not None:
            p["avanco_fisico_pct"] = round(_num(pr[0]["avanco_fisico_pct"]), 2)
        if p:
            fatos["produtividade"] = p

    return fatos


def _fmt_rs(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_data_context(obra_id) -> str:  # noqa: ANN001
    """Monta o «DATA_CONTEXT» textual a partir dos fatos resolvidos. Vazio/obra inexistente →
    mensagem honesta. NÃO inventa; só formata o que a Camada A/B já resolveu."""
    if not obra_id:
        return "(Nenhuma obra em foco — pergunta geral.)"
    fatos = coletar_fatos(obra_id)
    if not fatos.get("faturamento") and not fatos.get("insumos"):
        return f"(Obra {obra_id} ainda sem dados normalizados suficientes.)"

    linhas: list[str] = ["DADOS NORMALIZADOS DA OBRA (fonte da verdade — números SÓ daqui):"]
    ob = fatos.get("obra", {})
    if ob.get("nome_interno"):
        linhas.append(f"- Obra: {ob['nome_interno']}")
    if ob.get("indice_reajuste"):
        linhas.append(f"- Índice contratual de reajuste: {ob['indice_reajuste']} "
                      f"({ob.get('periodicidade_reajuste') or 'periodicidade não informada'})")
    f = fatos.get("faturamento", {})
    if f:
        linhas.append(
            f"- Faturamento (corte BM-{f.get('bm_corte')}): realizado acumulado "
            f"{_fmt_rs(f['realizado_acumulado_rs'])} de {_fmt_rs(f['contratado_total_rs'])} contratado"
            + (f" → avanço financeiro {f['avanco_financeiro_pct']}% do contrato"
               if f.get("avanco_financeiro_pct") is not None else ""))
        if f.get("aderencia_vs_previsto_pct") is not None:
            farol = f.get("farol_faturamento")
            linhas.append(
                f"- Aderência de faturamento vs PREVISTO no corte: {f['aderencia_vs_previsto_pct']}% "
                f"(desvio {f['desvio_faturamento_pp']:+g} pp"
                + (f" → farol {_FAROL_LABEL.get(farol, farol)}" if farol else "") + ")")
    fis = fatos.get("fisico", {})
    if fis.get("real_acumulado_pct") is not None:
        ln = f"- Avanço físico real acumulado (BM oficial): {fis['real_acumulado_pct']}%"
        if fis.get("previsto_acumulado_pct") is not None:
            ln += (f" · previsto no corte {fis['previsto_acumulado_pct']}% (plano)"
                   f" · atraso físico {fis['atraso_fisico_pp']:+g} pp")
        linhas.append(ln)
    ins = fatos.get("insumos", {})
    if ins:
        linhas.append(f"- Insumos FD (PQ C.04 c/ BDI): {ins['n_insumos']} itens; Curva ABC — "
                      f"{ins['n_concentram_80pct_do_valor']} concentram 80% do contrato "
                      f"({_fmt_rs(ins['contrato_fd_bdi_rs'])}; medido até o BM "
                      f"{_fmt_rs(ins['medido_bdi_rs'])})")
    des = fatos.get("desequilibrio", {})
    if des:
        linhas.append(f"- Desequilíbrio quantificado (D.0): {_fmt_rs(des['total_rs'])} · maior categoria "
                      f"{des['maior_categoria']} ({des['maior_tela']} · {_fmt_rs(des['maior_rs'])})")
    ph = fatos.get("produtividade_hh", {})
    if ph:
        linhas.append(f"- HH (C.7): previsto total {ph['hh_previsto_total']:,} · real acumulado {ph['hh_real_acum']:,}".replace(",", "."))
    pr = fatos.get("produtividade", {})
    if pr.get("kg_por_pessoa_hora") is not None:
        linhas.append(f"- Produtividade física (armação): {pr['kg_por_pessoa_hora']} kg por pessoa-hora"
                      + (f"; avanço {pr['avanco_fisico_pct']}%" if pr.get("avanco_fisico_pct") is not None else ""))
    linhas.append("\nO que NÃO está aqui é PENDENTE — diga 'pendente', não estime.")
    return "\n".join(linhas)
