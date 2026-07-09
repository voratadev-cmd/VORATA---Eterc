"""Teste do sampler · modo WORKBOOK-MOTOR (planilha multi-aba com índice/guia).

Garante que, num workbook com 6+ abas: (1) o INVENTÁRIO de TODAS as abas vai no topo (nunca
cortado), (2) as abas-meta (Guia/MAPA) são detectadas e priorizadas antes do conteúdo, (3) uma
aba de conteúdo codificada que por acaso tenha "Mapa" no nome (C.14 Mapa da Obra) NÃO é falso-
positivo de meta, e (4) planilha de poucas abas mantém o comportamento legado (sem INVENTÁRIO).

Rodar: cd agent && venv/bin/python -m parsers.test_sampler
"""

from __future__ import annotations

import io

from .sampler import build_doc_samples


def _xlsx(sheets: dict[str, list[list]]) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name[:31])
        for r in rows:
            ws.append(r)
    bio = io.BytesIO()
    wb.save(bio)
    return bio.getvalue()


def _guia_rows(n: int) -> list[list]:
    head = [["Módulo", "Aba", "Finalidade", "Inputs", "Saídas", "Lê de", "Alimenta", "Instrução"]]
    return head + [[f"C.{i}", f"Aba {i}", "popula tela", "3 amarelas", "KPI", "C.1", "D.0", "ler B4"]
                   for i in range(1, n)]


def _meta_first() -> None:
    sheets = {
        "INSTRUÇÕES — Guia da IA": _guia_rows(40),
        "MAPA — Telas Plataforma": [["Cód", "Tela", "Aba"]] + [[f"C.{i}", "x", "y"] for i in range(12)],
        "C.1 BDI Detalhe": [["PV", "BDI"], [611357314.09, 0.2975]],
        "C.4 Recursos": [["Recurso", "Contratado"], ["PEDREIRO", 10]],
        "C.14 Mapa da Obra": [["Segmento", "Status"], ["km 1", "liberado"]],  # 'Mapa' mas é conteúdo
        "D — Mob-Desmob Adicional": [["Recurso", "Pico"], ["EQP", 5]],  # 'aDICIONal' ⊅ 'dicion'
        "H Dashboard": [["KPI", "Valor"], ["Contratos", 1]],
        "D.0 Painel": [["Natureza", "R$"], ["Indiretos", 100]],
        "F.1 Lições": [["Lição", "Nota"], ["x", "y"]],
    }
    s = build_doc_samples("workbook.xlsx", _xlsx(sheets))
    assert s.fmt == "xlsx" and s.total_units == 9, (s.fmt, s.total_units)

    # 1 · INVENTÁRIO no topo com TODAS as 9 abas
    assert "### INVENTÁRIO · 9 abas" in s.text, "faltou bloco de inventário"
    for name in sheets:
        assert name in s.text, f"aba {name} sumiu do inventário/amostra"

    # 2 · meta detectadas certas; falsos-positivos de substring NÃO entram (match por token)
    meta = {x["name"]: x["isMeta"] for x in s.structure["sheets"]}
    assert meta["INSTRUÇÕES — Guia da IA"] is True, "Guia deveria ser meta"
    assert meta["MAPA — Telas Plataforma"] is True, "MAPA deveria ser meta"
    assert meta["C.14 Mapa da Obra"] is False, "C.14 (conteúdo codificado) NÃO é meta"
    assert meta["D — Mob-Desmob Adicional"] is False, "'aDICIONal' não pode casar 'dicion'"
    assert meta["C.1 BDI Detalhe"] is False and meta["H Dashboard"] is False
    n_meta = sum(1 for v in meta.values() if v)
    assert n_meta == 2, f"esperado exatamente 2 abas-meta (Guia+MAPA), veio {n_meta}"

    # 3 · ordem: inventário < abas-meta < conteúdo (o que sobrevive ao clip)
    pos_inv = s.text.index("### INVENTÁRIO")
    pos_guia = s.text.index('Sheet "INSTRUÇÕES — Guia da IA"')
    pos_bdi = s.text.index('Sheet "C.1 BDI Detalhe"')
    assert pos_inv < pos_guia < pos_bdi, "ordem deveria ser inventário → meta → conteúdo"
    assert "ABA-META" in s.text, "abas-meta deveriam vir marcadas"

    # 4 · nota do modo workbook lista as abas-meta
    notes = " ".join(s.notes)
    assert "modo workbook-motor" in notes and "Guia da IA" in notes, notes
    print(f"PASS meta-first · 9 abas · inventário no topo · meta=[Guia,MAPA] (2) · C.14 e "
          f"Mob-Desmob(aDICIONal) não-meta · ordem inv<meta<conteúdo · {len(s.text)} chars")


def _legacy_few_sheets() -> None:
    # ≤6 abas → comportamento legado: SEM inventário, ordem natural
    sheets = {"Plan1": [["A", "B"], [1, 2]], "Plan2": [["C"], [3]]}
    s = build_doc_samples("simples.xlsx", _xlsx(sheets))
    assert "### INVENTÁRIO" not in s.text, "planilha pequena não deve entrar no modo workbook"
    assert all(x["isMeta"] is False for x in s.structure["sheets"]), "sem meta fora do modo workbook"
    print("PASS legado · planilha de 2 abas mantém comportamento antigo (sem inventário)")


def run() -> None:
    _meta_first()
    _legacy_few_sheets()


if __name__ == "__main__":
    run()
