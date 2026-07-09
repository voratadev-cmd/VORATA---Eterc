"""C.14 Mapa da Obra · AVANÇO FÍSICO-FINANCEIRO CONTRATADO por disciplina × mês (Fase 2b · farol).

SINTÉTICO (sempre roda · trava a lógica): a fonte auxiliar_C.14 (Disciplina + Valor + %mês) vira a
matriz Valor×%/100 por disciplina, com físico/não-físico separado, acumulado recomposto e REAL=NULL
(pendente · nunca 0); o gate conserva Σ valor BRUTO == PV e Σ físicas == âncora.

GOLDEN (SKIP se ausente · fixture gitignored = dado real): a BR-101 v45 — Σ físicas == 367.256.923 ao
centavo (8 disciplinas físicas; as 4 não-físicas completam o PV) e Σ valor bruto == PV 611.357.315.
Qualquer refactor que mude UM CENTAVO quebra. Regenere o fixture via scripts/dump (dado real, LGPD).

Rodar: cd agent && PYTHONPATH=. venv/bin/python -m agents.normalizacao.test_workbook_avanco_fisico
"""
from __future__ import annotations

import json
import pathlib

from .gate import gate_avanco_fisico_disciplina
from .resolvers import extrair_avanco_fisico_disciplina_mes

FIX = pathlib.Path(__file__).parent / "fixtures" / "workbook_br101v45_auxC14.json"

# ── ÂNCORAS CONGELADAS (BR-101 v45 · trianguladas ao centavo · NÃO alterar sem re-auditar) ──────────
PV = 611357315.0            # Σ Valor(R$) bruto da auxiliar_C.14 == Preço de Venda
FISICO = 367256923.03       # Σ físicas distribuído == matriz C.14 L200-222 (porção física do PV)
TERRA = 140976062.0         # Terraplenagem (maior disciplina física)


def _sintetico() -> None:
    # 2 disciplinas FÍSICAS + 1 NÃO-física (Adm Local). %mês somam 100 por item → distribuído == bruto.
    sec = {
        "titulo": "auxiliar_C.14 — Cronograma físico mensal por item", "tipo": "tabela",
        "colunas": ["Cód", "Descrição", "Disciplina", "Valor (R$)", "mar-26", "abr-26", "mai-26"],
        "linhas": [
            {"Cód": "01", "Descrição": "Terra A", "Disciplina": "Terraplenagem",
             "Valor (R$)": 1000.0, "mar-26": 50, "abr-26": 50},          # → 500 / 500 / 0
            {"Cód": "02", "Descrição": "Dren A", "Disciplina": "Drenagem",
             "Valor (R$)": 2000.0, "abr-26": 25, "mai-26": 75},          # → 0 / 500 / 1500
            {"Cód": "03", "Descrição": "Adm", "Disciplina": "Administração Local",
             "Valor (R$)": 500.0, "mar-26": 100},                        # NÃO-física → 500 / 0 / 0
        ],
    }
    r = extrair_avanco_fisico_disciplina_mes([sec])
    assert r["status"] == "ok", r["findings"]
    assert r["n_disciplinas_fisicas"] == 2, r["n_disciplinas_fisicas"]
    assert r["soma_fisico"] == 3000.0, r["soma_fisico"]                  # 1000 + 2000 (Adm fora)
    assert r["soma_valor_bruto"] == 3500.0, r["soma_valor_bruto"]        # + 500 Adm
    # NÃO-física presente no série mas marcada fisico=False (não entra no Σ físico)
    adm = [l for l in r["linhas"] if l["disciplina"] == "Administração Local"]
    assert adm and all(l["fisico"] is False for l in adm), "Adm Local tem que ser não-física"
    # acumulado RECOMPOSTO (cumsum) + ordem dos meses (mar<abr<mai)
    dren = [l for l in r["linhas"] if l["disciplina"] == "Drenagem"]
    assert [l["contratado_rs"] for l in dren] == [0.0, 500.0, 1500.0], dren
    assert [l["contratado_acum_rs"] for l in dren] == [0.0, 500.0, 2000.0], dren
    # ANTI-FABRICAÇÃO: real/aderência = NULL pendente (NUNCA 0)
    assert all(l["real_rs"] is None and l["aderencia_pct"] is None for l in r["linhas"])

    # GATE: âncoras certas → ok; âncora física errada → falha-alto
    g = gate_avanco_fisico_disciplina(r, pv_anchor=3500.0, fisico_anchor=3000.0)
    assert g["status"] == "ok", [f for f in g["findings"] if f["severity"] != "info"]
    gbad = gate_avanco_fisico_disciplina(r, pv_anchor=3500.0, fisico_anchor=9999.0)
    assert gbad["status"] == "needs_review", "âncora física errada tem que reprovar"
    # SEM âncora → NÃO pode ser 'ok' (persist-verde): escala p/ needs_review (fix mestre da revisão)
    gna = gate_avanco_fisico_disciplina(r)
    assert gna["status"] == "needs_review", "sem âncora tem que escalar p/ needs_review (não persiste verde)"
    gna2 = gate_avanco_fisico_disciplina(r, pv_anchor=3500.0)  # só PV, sem físico → ainda escala
    assert gna2["status"] == "needs_review", "âncora física ausente tem que escalar"


def _golden() -> bool:
    if not FIX.exists():
        print(f"SKIP {FIX.name} (gitignored · dado real). Regenere via dump.")
        return False
    sec = json.loads(FIX.read_text())
    r = extrair_avanco_fisico_disciplina_mes([sec])
    assert r["status"] == "ok", [f for f in r["findings"] if f["severity"] == "error"]
    assert r["n_disciplinas_fisicas"] == 8, f"esperava 8 físicas, veio {r['n_disciplinas_fisicas']}"
    assert abs(r["soma_fisico"] - FISICO) < 1.0, f"Σ físico {r['soma_fisico']} ≠ {FISICO} (±R$1)"
    assert abs(r["soma_valor_bruto"] - PV) < max(1.0, PV * 0.0001), f"Σ bruto {r['soma_valor_bruto']} ≠ PV"
    terra = [l for l in r["linhas"] if l["disciplina"] == "Terraplenagem"]
    assert abs(sum(l["contratado_rs"] for l in terra) - TERRA) < 1.0, "Terraplenagem ≠ 140.976.062"
    g = gate_avanco_fisico_disciplina(r, pv_anchor=PV, fisico_anchor=FISICO)
    assert g["status"] == "ok", [f for f in g["findings"] if f["severity"] == "error"]
    return True


def _variacoes() -> None:
    """Robustez a 'obra DIFERENTE' (os furos que a revisão adversarial achou). Cada caso = um bug que
    movia milhões/sumia curva em silêncio, agora travado."""
    from .resolvers import _coluna_mes, _disc_fisica

    AUX = "auxiliar_C.14 — Cronograma físico mensal por item"

    # (1) ESCALA: perfil em FRAÇÃO 0-1 (0,5) — auto-detecta escala=1 (sem isso, Σ sairia 100× MENOR)
    sec_frac = {"titulo": AUX, "tipo": "tabela", "colunas": ["Cód", "Disciplina", "Valor (R$)", "mar-26", "abr-26"],
                "linhas": [{"Cód": "01", "Disciplina": "Terraplenagem", "Valor (R$)": 1000.0, "mar-26": 0.5, "abr-26": 0.5}]}
    assert extrair_avanco_fisico_disciplina_mes([sec_frac])["soma_fisico"] == 1000.0, "escala-fração: Σ 100× errado"

    # (2) FORMATOS DE MÊS: 'M1'/'M13'/'2026-03'/'mes_02' reconhecidos; 'Valor'/'99' não
    assert all(_coluna_mes(x) for x in ("M1", "M13", "2026-03", "mes_02", "mar-26"))
    assert all(_coluna_mes(x) is None for x in ("Disciplina", "Valor (R$)", "99", "Cód"))
    sec_m = {"titulo": AUX, "tipo": "tabela", "colunas": ["Disciplina", "Valor (R$)", "M1", "M2"],
             "linhas": [{"Disciplina": "Drenagem", "Valor (R$)": 200.0, "M1": 50, "M2": 50}]}
    assert extrair_avanco_fisico_disciplina_mes([sec_m])["soma_fisico"] == 200.0, "formato M1/M2: curva sumiu"

    # (3) DENYLIST fallback (sem matriz cached): 'Insumos de Pavimentação' É físico (era o bug de 80M);
    #     'Insumos (Fat. Direto)'/'Outros'/'Adm Local' NÃO.
    assert _disc_fisica("Insumos de Pavimentação") and _disc_fisica("Insumos Asfálticos") and _disc_fisica("Terraplenagem")
    assert not _disc_fisica("Insumos (Fat. Direto)") and not _disc_fisica("Outros") and not _disc_fisica("Administração Local")

    # (4) MEMBERSHIP (com matriz cached C.14): físico = pertencer à matriz, IGNORANDO a denylist
    cached = {"titulo": "C.14 Mapa da Obra — Bloco não-rotulado L200-L207 (auto-ingerido)", "tipo": "tabela",
              "colunas": ["disciplina", "mes_01", "mes_02"],
              "linhas": [{"disciplina": "Terraplenagem", "mes_01": 600.0, "mes_02": 400.0},
                         {"disciplina": "Insumos de Pavimentação", "mes_01": 300.0, "mes_02": 200.0}]}
    aux = {"titulo": AUX, "tipo": "tabela", "colunas": ["Disciplina", "Valor (R$)", "mar-26", "abr-26"],
           "linhas": [{"Disciplina": "Terraplenagem", "Valor (R$)": 1000.0, "mar-26": 60, "abr-26": 40},
                      {"Disciplina": "Insumos de Pavimentação", "Valor (R$)": 500.0, "mar-26": 60, "abr-26": 40},
                      {"Disciplina": "Administração Local", "Valor (R$)": 200.0, "mar-26": 100}]}
    rmem = extrair_avanco_fisico_disciplina_mes([cached, aux])
    assert rmem["soma_fisico_cached"] == 1500.0, rmem["soma_fisico_cached"]
    assert {l["disciplina"] for l in rmem["linhas"] if l["fisico"]} == {"Terraplenagem", "Insumos de Pavimentação"}
    assert rmem["soma_fisico"] == 1500.0, "membership: Σ físico ≠ matriz cached"

    # (5) COLISÃO de coluna Valor: 'Valor Agregado (%)' ANTES de 'Valor (R$)' → pega a canônica
    sec_col = {"titulo": AUX, "tipo": "tabela", "colunas": ["Disciplina", "Valor Agregado (%)", "Valor (R$)", "mar-26"],
               "linhas": [{"Disciplina": "Pavimentação", "Valor Agregado (%)": 7.5, "Valor (R$)": 800.0, "mar-26": 100}]}
    assert extrair_avanco_fisico_disciplina_mes([sec_col])["soma_valor_bruto"] == 800.0, "colisão: pegou coluna %-valor"

    # (6) COLUNA ÓRFÃ INTERLEAVADA entre meses (formato não-suportado no meio) → needs_review (não calado).
    #     Trailing ('Real medido acum') NÃO flagra — só mês perdido entre meses reconhecidos.
    sec_orf = {"titulo": AUX, "tipo": "tabela", "colunas": ["Disciplina", "Valor (R$)", "mar-26", "perfil_x", "mai-26"],
               "linhas": [{"Disciplina": "Drenagem", "Valor (R$)": 100.0, "mar-26": 30, "perfil_x": 12345, "mai-26": 40}]}
    assert extrair_avanco_fisico_disciplina_mes([sec_orf])["status"] == "needs_review", "coluna órfã interleavada não flagrou"
    # trailing (após o último mês) NÃO é mês perdido → não flagra
    sec_trail = {"titulo": AUX, "tipo": "tabela", "colunas": ["Disciplina", "Valor (R$)", "mar-26", "abr-26", "Real acum"],
                 "linhas": [{"Disciplina": "Drenagem", "Valor (R$)": 100.0, "mar-26": 50, "abr-26": 50, "Real acum": 999}]}
    assert extrair_avanco_fisico_disciplina_mes([sec_trail])["status"] == "ok", "coluna trailing não pode reprovar (falso-positivo)"


def run() -> None:
    _sintetico()
    _variacoes()
    rodou_golden = _golden()
    sufixo = "GOLDEN ao-centavo (367.256.923 · 8 físicas · PV) ✓" if rodou_golden else "golden SKIPADO (fixture LGPD ausente)"
    print(f"PASS avanço-físico · Valor×%/100 por disciplina · físico/não-físico · acum cumsum · real=NULL · "
          f"gate conserva (PV bruto + físicas) · {sufixo}")


if __name__ == "__main__":
    run()
