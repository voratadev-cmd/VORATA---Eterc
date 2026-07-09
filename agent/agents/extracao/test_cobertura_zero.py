"""Honest-zero (motor-hardening · fidelidade v45) · órfã-ZERO × órfã-FONTE. Prova: um bloco órfão com
TODAS as numéricas == 0 (template pré-execução §5.6 — ex.: a matriz 'IMPEDIMENTO POR EVENTO' de
auxiliar_C.8, ~478 zeros, que fazia TODA obra cair em needs_review à toa) NÃO força review (vira
alerta). E o ANTI-MASCARAMENTO: um único valor ≠ 0 no bloco o devolve a FONTE (não capturar dado real
continua reprovando — ex.: C.14 L200-222, matriz mensal por disciplina COM valores)."""
from __future__ import annotations

from agents.extracao.cobertura import auditar_cobertura, resumo_cobertura


def _grid(impedimento_val=0.0) -> dict:
    return {"auxiliar_C.8": [
        ["Frente", "Linha", "M1", "M2", "M3"],                    # L1 header (texto)
        ["Trecho 01", "Contratado", 100.0, 200.0, 300.0],         # L2 FONTE real (não-zero)
        ["Trecho 01", "Real", 50.0, 0.0, 0.0],                    # L3 FONTE real (tem 50)
        [], [], [], [],                                           # L4-L7 separador (gap >3)
        ["IMPEDIMENTO POR EVENTO (matriz · sem evento no BM)"],   # L8 banner (texto)
        ["IMP-01", "Trecho 01", impedimento_val, 0.0, 0.0],       # L9  todo-zero (ou 1 não-zero no anti-masc)
        [0.0, 0.0, 0.0, 0.0, 0.0],                                # L10 zero
        [0.0, 0.0, 0.0, 0.0, 0.0],                                # L11 zero
    ]}


def run() -> None:
    # Honest-zero: L2-L3 (FONTE real) cobertas; a matriz L8-L11 (toda-zero, gap>3 → bloco isolado) = ZERO.
    grid = _grid()
    cv = auditar_cobertura(grid, {"auxiliar_C.8": {2, 3}})
    assert cv["total_numericas"] == 0, f"matriz toda-zero não pode ser FONTE, veio {cv['total_numericas']}"
    assert cv["total_numericas_zero"] == 13, f"esperava 13 numéricas-zero, veio {cv['total_numericas_zero']}"

    # ANTI-MASCARAMENTO: um ÚNICO valor ≠ 0 (42) no mesmo bloco → volta a FONTE (perda de dado real).
    cv2 = auditar_cobertura(_grid(impedimento_val=42.0), {"auxiliar_C.8": {2, 3}})
    assert cv2["total_numericas"] == 13, f"bloco com valor ≠ 0 tem que ser FONTE, veio {cv2['total_numericas']}"
    assert cv2["total_numericas_zero"] == 0, f"com não-zero, nada é honest-zero, veio {cv2['total_numericas_zero']}"

    # SEM cobertura: a tabela-fonte real (L2-L3, não-zero) é FONTE; a matriz-zero segue ZERO
    # (independe de adjacência — bloco isolado por gap). Confirma que zero-ness é decidido pelo bloco.
    cv3 = auditar_cobertura(grid, {})
    assert cv3["total_numericas"] == 6, f"L2-L3 não-zero (6 num) devem ser FONTE, veio {cv3['total_numericas']}"
    assert cv3["total_numericas_zero"] == 13, f"matriz-zero segue ZERO, veio {cv3['total_numericas_zero']}"

    # FURO 1 (regressão): os RÓTULOS textuais do bloco-zero (L8 banner + L9 'IMP-01'/'Trecho 01' = 3 cels
    # de texto) NÃO podem sumir em silêncio — entram em total_orfas (alerta de texto, "nada se perde").
    assert cv["total_orfas"] >= 3, f"rótulos do bloco-zero têm que aparecer em total_orfas, veio {cv['total_orfas']}"

    # FURO 2 (regressão · crash): aba FONTE (C.14) + aba pura-ZERO no MESMO workbook. A pura-ZERO entra no
    # por_aba com regioes=[]; resumo_cobertura indexava a['regioes'][0] → IndexError, engolido pelo runner
    # como 'gate falhou', cegando o relatório de C.14. Tem que NÃO crashar e reportar C.14.
    grid_fz = {
        "C.14 Mapa da Obra": [["Disciplina", "M1", "M2"], ["Terraplenagem", 100.0, 200.0]],  # FONTE real
        "auxiliar_C.8 zero": [["IMP-01", "Trecho", 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]],          # pura-ZERO
    }
    res_fz = auditar_cobertura(grid_fz, {})
    assert res_fz["total_numericas"] > 0, "C.14 tem dado FONTE real (não-coberto)"
    msg = resumo_cobertura(res_fz)  # NÃO pode levantar IndexError
    assert "C.14" in msg, f"resumo deve reportar a FONTE C.14, veio: {msg!r}"
    assert "auxiliar_C.8 zero" not in msg, "aba pura-ZERO (sem região FONTE) não entra no resumo de FONTE"

    print("PASS honest-zero · matriz toda-zero = alerta não review · anti-mascaramento (1 valor ≠ 0 → FONTE) · "
          "FURO1: rótulos-zero visíveis em total_orfas · FURO2: FONTE+ZERO não crasha resumo_cobertura")


if __name__ == "__main__":
    run()
