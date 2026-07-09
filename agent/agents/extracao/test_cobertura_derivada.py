"""B1 (motor-hardening) · órfã-DERIVADA × órfã-FONTE. Prova: o RODAPÉ recomputável (TOTAL/DIFERENÇA/
ACUMULADO + linhas de diferença com rótulo de função) colado à tabela ingerida NÃO força review
(vira alerta); e o ANTI-AFROUXAMENTO: tirar a cobertura-fonte faz as MESMAS linhas voltarem a FONTE
(needs_review). Sem isto, rebaixar derivada seria mascarar perda de dado."""
from __future__ import annotations

from agents.extracao.cobertura import auditar_cobertura


def _grid() -> dict:
    return {"Detalhe": [
        ["S — MÃO DE OBRA DIRETA DETALHADA"],                 # L1 banner (texto)
        ["FUNÇÃO", "STATUS", "M1", "M2"],                      # L2 header (texto)
        ["OPERADOR DE COMPRESSOR", "Contratado", 10.0, 20.0],  # L3..L12 fonte (ingerida)
        ["OPERADOR DE TRATOR", "Contratado", 11.0, 21.0],
        ["MOTONIVELADORA", "Contratado", 12.0, 22.0],
        ["CARREGADEIRA", "Contratado", 13.0, 23.0],
        ["PEDREIRO", "Contratado", 14.0, 24.0],
        ["SERVENTE", "Contratado", 15.0, 25.0],
        ["CARPINTEIRO", "Contratado", 16.0, 26.0],
        ["ARMADOR", "Contratado", 17.0, 27.0],
        ["ELETRICISTA", "Contratado", 18.0, 28.0],
        ["ENCANADOR", "Contratado", 19.0, 29.0],               # L12 (último ingerido)
        ["TOTAL REAL", "", 100.0, 200.0],                      # L13 rodapé derivado (numérico)
        ["DIFERENÇA (Real − Contratado)", "", 5.0, 5.0],       # L14 derivado
        ["CONTRATADO ACUMULADO", "", 1000.0, 2000.0],          # L15 derivado
        ["MOTOSSERRISTA", "", -2.0, -2.0],                     # L16 linha-diferença rótulo-FUNÇÃO (derivada via bloco)
    ]}


def run() -> None:
    grid = _grid()
    cob = set(range(3, 13))  # L3..L12 ingeridas (cobertas)

    # COM cobertura-fonte: rodapé L13-L16 (8 numéricas) = DERIVADO (não força review); fonte numérica = 0
    cv = auditar_cobertura(grid, {"Detalhe": set(cob)})
    assert cv["total_numericas"] == 0, f"fonte deveria ser 0, veio {cv['total_numericas']}"
    assert cv["total_numericas_derivadas"] == 8, f"derivadas deveria ser 8, veio {cv['total_numericas_derivadas']}"
    # a linha-diferença com rótulo de FUNÇÃO (MOTOSSERRISTA) também caiu no bloco derivado:
    det = next(a for a in cv["por_aba"] if a["aba"] == "Detalhe")
    assert det["n_numericas_orfas"] == 0 and det["n_numericas_derivadas"] == 8

    # ANTI-AFROUXAMENTO: sem cobertura nenhuma, NADA é rebaixado — todas as 28 numéricas (20 das
    # linhas-função L3-L12 + 8 do rodapé) voltam a FONTE (o bloco não toca nenhuma linha coberta).
    cv2 = auditar_cobertura(grid, {})
    assert cv2["total_numericas"] == 28, f"sem cobertura, tudo tem que ser FONTE, veio {cv2['total_numericas']}"
    assert cv2["total_numericas_derivadas"] == 0, cv2["total_numericas_derivadas"]

    # ANTI-AFROUXAMENTO 2: marcador derivado SEM fonte adjacente (bloco isolado) NÃO é rebaixado
    grid3 = {"X": [["a", 1.0], [], [], [], [], ["TOTAL", "", 99.0]]}  # L6 TOTAL longe de qualquer coberta
    cv3 = auditar_cobertura(grid3, {"X": {1}})  # só L1 coberta; L6 a 5 linhas → não adjacente
    assert cv3["total_numericas"] == 1 and cv3["total_numericas_derivadas"] == 0, cv3

    print("PASS B1 · rodapé TOTAL/DIFERENÇA/ACUM (+ linha-diff rótulo-função) = derivado (alerta, não review) · "
          "anti-afrouxamento: sem fonte adjacente volta a FONTE")


if __name__ == "__main__":
    run()
