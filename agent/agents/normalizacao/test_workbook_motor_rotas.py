"""Teste de FIAÇÃO do workbook-motor — as 5 rotas plugadas em jun/2026 roteiam de verdade.

Roda processar_workbook_motor com os upserts MOCKADOS (sem banco) sobre o envelope real da
BR-101 (full + seções D.5 corrigidas) e assere: cada rota nova dispara, persiste o nº de linhas
esperado, e a flag `coberta` da captura genérica reconhece as seções novas. SKIP gracioso se as
fixtures (gitignored · dado real) não existirem.

Rodar: cd agent && venv/bin/python -m agents.normalizacao.test_workbook_motor_rotas
"""

from __future__ import annotations

import json
import pathlib

from . import workbook_motor as wm

FIX = pathlib.Path(__file__).parent / "fixtures"


def run() -> None:
    full = FIX / "workbook_br101v11_full.json"
    d5 = FIX / "workbook_br101v13_d5_excedente.json"
    if not full.exists():
        print(f"SKIP {full.name} (gitignored · dado real).")
        return
    secoes = json.loads(full.read_text())
    if d5.exists():
        # injeta as seções do D.5 corrigido (revisão jun/2026) p/ exercitar a rota do excedente
        ja = {s.get("titulo") for s in secoes}
        secoes = secoes + [s for s in json.loads(d5.read_text()) if s.get("titulo") not in ja]

    chamadas: dict[str, dict] = {}

    def _mock(nome: str):
        def _f(**kw):  # noqa: ANN003
            chamadas[nome] = kw
            for chave in ("linhas", "meses", "segmentos", "insumos", "itens", "frentes",
                          "rubricas", "categorias", "metodos", "condutas", "marcos", "cpus",
                          "secoes"):
                if isinstance(kw.get(chave), list):
                    return len(kw[chave])
            return 1
        return _f

    originais = {}
    for nome in dir(wm):
        if nome.startswith("upsert_"):
            originais[nome] = getattr(wm, nome)
            setattr(wm, nome, _mock(nome))
    try:
        out = wm.processar_workbook_motor("arq-teste", "contrato-teste", "workbook.xlsx",
                                          {"secoes": secoes}, 1)
    finally:
        for nome, fn in originais.items():
            setattr(wm, nome, fn)

    todas = "\n".join(out["routed"] + out["em_revisao"])

    # as 5 rotas novas dispararam e persistiram o shape esperado
    assert "Matriz disciplina×mês" in todas, todas
    assert len(chamadas["upsert_faturamento_disciplina_mes"]["linhas"]) == 552
    assert "Matriz física disciplina×mês" in todas
    assert len(chamadas["upsert_cronograma_frente_mes"]["linhas"]) == 552
    assert "Série mensal" in todas
    assert len(chamadas["upsert_curvas_serie_mes"]["meses"]) == 46
    assert chamadas["upsert_curvas_serie_mes"]["bm_corrente"] == 4
    assert "C.14 Mapa/km" in todas
    assert len(chamadas["upsert_mapa_segmentos"]["segmentos"]) == 11
    assert "Excedente 8.8" in todas
    assert len(chamadas["upsert_insumo_excedente"]["insumos"]) == 8

    # nenhuma das 5 em revisão (gates fecham no dado real)
    em_rev = "\n".join(out["em_revisao"])
    for marca in ("Matriz disciplina×mês", "Matriz física", "Série mensal", "Mapa/km",
                  "Excedente 8.8"):
        assert marca not in em_rev, f"{marca} caiu em revisão: {em_rev}"

    # captura genérica: as seções novas agora contam como COBERTAS
    caps = chamadas["upsert_secoes"]["secoes"]
    por_titulo = {c["titulo"]: c["coberta"] for c in caps}
    cobertas_esperadas = [t for t in por_titulo if
                          ("Mapa da Obra — Bloco 1" in t) or ("Previsto por frente" in t)
                          or ("excedente por insumo relevante" in t.lower())]
    assert cobertas_esperadas, "seções-alvo não estão na captura"
    nao_marcadas = [t for t in cobertas_esperadas if not por_titulo[t]]
    assert not nao_marcadas, f"seções com rota mas coberta=False: {nao_marcadas}"
    n_cob = sum(1 for c in caps if c["coberta"])
    print(f"PASS motor · 5 rotas novas roteiam (552+552 células · 46 meses · 11 segmentos · "
          f"8 relevantes · BM 4) · gates ok · captura: {n_cob}/{len(caps)} cobertas")


if __name__ == "__main__":
    run()
