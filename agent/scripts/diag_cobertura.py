"""Diagnóstico de cobertura (GRÁTIS · sem LLM): dump do grid REAL (DocContext.sheet_rows, igual ao
que o gate vê) das sheets com gap. Entende POR QUE as regiões ficam órfãs.

Uso: python -m scripts.diag_cobertura
"""
from __future__ import annotations

LOCAL_XLSX = "/Users/mateusmilagre/Downloads/BR-101_Macae_Histogramas_BDI_Prazos_45.xlsx"


def _cell(v) -> str:
    if v is None:
        return ""
    s = str(v)
    return s[:22]


def dump(doc, sheet: str, rows_filter=None, maxrow=None):
    rows = doc.sheet_rows(sheet)
    print(f"\n{'='*90}\n=== {sheet} · {len(rows)} linhas ===")
    for i, row in enumerate(rows, start=1):
        if maxrow and i > maxrow:
            print(f"  … (+{len(rows)-maxrow} linhas)")
            break
        if rows_filter and i not in rows_filter:
            continue
        cells = [(j, _cell(v)) for j, v in enumerate(row or []) if v is not None and str(v).strip()]
        if not cells:
            print(f"  L{i:3d} │ (vazia)")
            continue
        # marca se a célula é numérica
        def isnum(v):
            try:
                float(str(v).replace(".", "").replace(",", ".")); return True
            except Exception:
                return False
        compact = " · ".join(f"c{j}={t}" for j, t in cells[:9])
        nnum = sum(1 for _, t in cells if isnum(t))
        print(f"  L{i:3d} │ [{len(cells)}cel {nnum}num] {compact}")


def main():
    import os
    from agents.extracao.doc_tools import DocContext
    with open(LOCAL_XLSX, "rb") as f:
        data = f.read()
    doc = DocContext(os.path.basename(LOCAL_XLSX), data)

    names = doc.sheet_names()
    print("SHEETS com 'C.8' ou 'C.14':", [n for n in names if "C.8" in n or "C.14" in n])

    # auxiliar_C.8 Curvas Frente — o GAP REAL (task #7). Dump completo.
    aux8 = next((n for n in names if "auxiliar_C.8" in n), None)
    if aux8:
        dump(doc, aux8)

    # C.14 Mapa da Obra — regiões órfãs flagradas: L1-5, L111, L200-207, L215-222 (hipótese: mapa defasado)
    c14 = next((n for n in names if n.startswith("C.14")), None)
    if c14:
        flagged = set(range(1, 6)) | {111} | set(range(200, 208)) | set(range(215, 223))
        dump(doc, c14, rows_filter=flagged)

    doc.close()


if __name__ == "__main__":
    main()
