"""GATE DE COBERTURA célula-a-célula (xlsx × envelope) — a garantia "100% extraído" VERIFICÁVEL.

A ingestão determinística é fiel DENTRO dos intervalos escolhidos, mas quem escolhe os intervalos
é o modelo — e região pulada não dava erro nenhum. Este gate fecha o anel: depois da extração,
varre TODA aba do xlsx e confere que cada LINHA com dado está coberta por alguma região declarada
(a ingestão lê a LARGURA INTEIRA do intervalo — linha coberta ⇒ todas as colunas dela lidas)
(intervalos do `ingerir_planilha` rastreados no builder ∪ regiões declaradas em `fonte` das seções).
Célula NUMÉRICA órfã ⇒ needs_review com as regiões apontadas (aba + linhas + amostra); órfã só de
texto ⇒ alerta. Aba inteira sem nenhuma região e com dado ⇒ needs_review.

Também roda STANDALONE sobre uma extração existente (auditoria/ensaio, sem re-extrair):
  cd agent && venv/bin/python -m agents.extracao.cobertura <arquivo.xlsx> <envelope.json>
"""

from __future__ import annotations

import re
import unicodedata

# Apenas referências EXPLÍCITAS de linha: "L13-L44" ou "linhas 13-44" + refs soltas "L18".
# Número-intervalo solto ("2024-2026", "600–190" de km) NÃO cobre nada — falso-coberto
# esconderia órfãs de milhões.
_RE_SHEET = re.compile(r"(?:aba|sheet)\s+'([^']+)'", re.I)
_RE_PAR_L = re.compile(r"\bL(\d{1,5})\s*[-–]\s*L?(\d{1,5})\b")
_RE_PAR_LINHAS = re.compile(r"\blinhas?\s+(\d{1,5})\s*[-–]\s*(\d{1,5})\b", re.I)
_RE_SOLTO = re.compile(r"\bL(\d{1,5})\b")


def ranges_do_envelope(payload: dict | list) -> dict[str, set[int]]:
    """Linhas cobertas por aba, parseadas do campo `fonte` de TODAS as seções do envelope.
    Conservador: qualquer par A-B vira intervalo; refs soltas L18 viram linha única. Nome de
    aba que não bater com a planilha real simplesmente não cobre nada (fail-loud: as órfãs
    daquela aba aparecem no relatório)."""
    secoes = payload.get("secoes") if isinstance(payload, dict) else payload
    out: dict[str, set[int]] = {}
    for s in secoes or []:
        fonte = str((s or {}).get("fonte") or "")
        m = _RE_SHEET.search(fonte)
        if not m:
            continue
        aba = m.group(1)
        linhas = out.setdefault(aba, set())
        for rx in (_RE_PAR_L, _RE_PAR_LINHAS):
            for a, b in rx.findall(fonte):
                de, ate = int(a), int(b)
                if 0 < de <= ate <= 100_000 and (ate - de) < 50_000:
                    linhas.update(range(de, ate + 1))
        for ref in _RE_SOLTO.findall(fonte):
            linhas.add(int(ref))
    return out


def _tem_dado(v) -> bool:  # noqa: ANN001
    return v is not None and (not isinstance(v, str) or v.strip() != "")


def _eh_numero(v) -> bool:  # noqa: ANN001
    return isinstance(v, (int, float)) and not isinstance(v, bool)


# ── Classificação órfã-DERIVADA × órfã-FONTE (motor-hardening B1) ──────────────────────────────
# Uma extração FIEL cai em needs_review à toa porque o RODAPÉ recomputável das abas-detalhe
# (TOTAL / DIFERENÇA / ACUMULADO — o motor recompõe, não extrai) fica fora de cobertura. Rebaixar
# essas órfãs a ALERTA (não review) — SEM mascarar perda de dado-FONTE — exige conjunção dupla:
#   (a) o BLOCO órfão toca uma linha COBERTA (≤2 acima/abaixo) — é o rodapé colado à tabela ingerida;
#   (b) o bloco contém um marcador derivado (TOTAL/DIFERENÇA/ACUM…).
# Bloco sem fonte adjacente (ex.: tabela-fonte inteira pulada) OU sem marcador NÃO é rebaixado.
_DERIV_KW = ("total", "subtotal", "diferen", "acumulad", "acum", "media", "varia",
             "desvio", "saldo", "consolidad", "percentual", "aderenc")


def _sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def _rotulo_linha(rows: list, lin: int) -> str:
    row = rows[lin - 1] if 0 < lin <= len(rows) else []
    for v in (row or []):
        if isinstance(v, str) and v.strip():
            return _sem_acento(v.strip())
    return ""


def _bloco_todo_zero(rows: list, bl: list[int]) -> bool:
    """True sse o bloco tem ≥1 célula numérica e TODAS as numéricas são 0 (nenhum valor não-zero).
    Bloco honest-zero (§5.6): matriz/template PRÉ-PREENCHIDO com 0 (impedimento sem evento, frente não
    executada, mês pós-corte). Não capturá-lo NÃO perde número — todo o conteúdo numérico é 0, então
    rebaixar a alerta (não força review) é fiel. Bloco com qualquer numérica ≠ 0 NÃO é honest-zero
    (perda de dado real · ex.: C.14 L200-222, matriz mensal por disciplina com valores) → segue FONTE."""
    viu_num = False
    for r in bl:
        row = rows[r - 1] if 0 < r <= len(rows) else []
        for v in (row or []):
            if _eh_numero(v):
                viu_num = True
                if v != 0:
                    return False
    return viu_num


def _classificar_orfas(rows: list, orfas: list[int], cob: set[int]) -> tuple[set[int], set[int], set[int]]:
    """Separa órfãs em (FONTE, DERIVADA, ZERO). Agrupa órfãs em blocos contíguos (gap ≤3):
      · ZERO     — bloco com ≥1 numérica e TODAS == 0 (template honest-zero §5.6) → alerta, não review.
      · DERIVADA — toca linha coberta E contém marcador (TOTAL/DIFERENÇA/ACUM…) → alerta, não review.
      · FONTE    — o resto → needs_review (perda de dado-fonte real).
    ZERO é checado ANTES de derivada: a ausência total de número não-zero domina (não há o que perder)."""
    if not orfas:
        return set(), set(), set()
    blocos: list[list[int]] = [[orfas[0]]]
    for i in orfas[1:]:
        if i - blocos[-1][-1] <= 3:
            blocos[-1].append(i)
        else:
            blocos.append([i])
    fonte: set[int] = set()
    deriv: set[int] = set()
    zero: set[int] = set()
    for bl in blocos:
        if _bloco_todo_zero(rows, bl):
            zero.update(bl)
            continue
        adj = any((r + d) in cob for r in bl for d in (-2, -1, 1, 2))
        marca = any(k in _rotulo_linha(rows, r) for r in bl for k in _DERIV_KW)
        (deriv if (adj and marca) else fonte).update(bl)
    return fonte, deriv, zero


def auditar_cobertura(
    abas_rows: dict[str, list], cobertas: dict[str, set[int]],
) -> dict:
    """Compara o grid real (abas_rows: aba → lista de linhas, cada linha = lista de células) com as
    linhas cobertas. `total_numericas` conta SÓ órfã-FONTE (gate duro → needs_review); órfã-DERIVADA
    (rodapé recomputável) vai p/ `total_numericas_derivadas` e órfã-ZERO (template honest-zero §5.6) p/
    `total_numericas_zero` — ambas só alerta. Retorna {por_aba, total_orfas, total_numericas,
    total_derivadas, total_numericas_derivadas, total_numericas_zero, abas_sem_regiao}."""
    por_aba: list[dict] = []
    abas_sem_regiao: list[str] = []
    total_orfas = total_num = total_der = total_num_der = total_num_zero = 0
    for aba, rows in abas_rows.items():
        cob = cobertas.get(aba, set())
        orfas_idx: list[int] = []
        cel_por_linha: dict[int, tuple[int, int]] = {}
        for i, row in enumerate(rows, start=1):
            if i in cob:
                continue
            celulas = [v for v in (row or []) if _tem_dado(v)]
            if not celulas:
                continue
            orfas_idx.append(i)
            cel_por_linha[i] = (len(celulas), sum(1 for v in celulas if _eh_numero(v)))
        if not orfas_idx:
            continue
        fonte_set, deriv_set, zero_set = _classificar_orfas(rows, orfas_idx, cob)
        orfas = sorted(fonte_set)
        n_cel = sum(cel_por_linha[i][0] for i in fonte_set)
        n_num = sum(cel_por_linha[i][1] for i in fonte_set)
        n_cel_der = sum(cel_por_linha[i][0] for i in deriv_set)
        n_num_der = sum(cel_por_linha[i][1] for i in deriv_set)
        n_num_zero = sum(cel_por_linha[i][1] for i in zero_set)
        n_cel_zero = sum(cel_por_linha[i][0] for i in zero_set)
        # agrupa linhas órfãs-FONTE contíguas em regiões legíveis (derivadas não viram região de review)
        regioes: list[dict] = []
        if orfas:
            ini = prev = orfas[0]
            for i in orfas[1:] + [None]:  # type: ignore[list-item]
                if i is not None and i == prev + 1:
                    prev = i
                    continue
                amostra = []
                for r in range(ini, prev + 1):
                    for v in (rows[r - 1] or []):
                        if _tem_dado(v):
                            amostra.append(f"L{r}:{str(v)[:40]}")
                            break
                    if len(amostra) >= 2:
                        break
                regioes.append({"de": ini, "ate": prev, "amostra": " · ".join(amostra)})
                if i is not None:
                    ini = prev = i
        tem_alguma_regiao = bool(cob)
        if not tem_alguma_regiao and orfas:
            abas_sem_regiao.append(aba)
        por_aba.append({"aba": aba, "regioes": regioes, "n_celulas_orfas": n_cel,
                        "n_numericas_orfas": n_num, "n_derivadas_orfas": n_cel_der,
                        "n_numericas_derivadas": n_num_der, "n_numericas_zero": n_num_zero,
                        "sem_regiao": (not tem_alguma_regiao) and bool(orfas)})
        # FURO 1 (honest-zero): as numéricas-0 do bloco-ZERO vão p/ total_num_zero (alerta próprio); mas os
        # RÓTULOS textuais do bloco (n_cel_zero − n_num_zero) entram em total_orfas p/ NUNCA sumirem em
        # silêncio — o honest-zero promete "nada se perde", e texto único (disciplina, frente) é dado.
        total_orfas += n_cel + (n_cel_zero - n_num_zero)
        total_num += n_num
        total_der += n_cel_der
        total_num_der += n_num_der
        total_num_zero += n_num_zero
    por_aba.sort(key=lambda x: -x["n_numericas_orfas"])
    return {"por_aba": por_aba, "total_orfas": total_orfas,
            "total_numericas": total_num, "total_derivadas": total_der,
            "total_numericas_derivadas": total_num_der, "total_numericas_zero": total_num_zero,
            "abas_sem_regiao": abas_sem_regiao}


def ranges_persistidos(payload: dict | list) -> dict[str, set[int]]:
    """Intervalos ingeridos serializados em payload['_ingestao'] (gravados por EnvelopeBuilder.build).
    Deixa o gate CLI/auditoria creditar a ingestão determinística SEM o builder em runtime."""
    ing = payload.get("_ingestao") if isinstance(payload, dict) else None
    if not isinstance(ing, dict):
        return {}
    out: dict[str, set[int]] = {}
    for aba, linhas in ing.items():
        try:
            out[str(aba)] = {int(x) for x in (linhas or [])}
        except (TypeError, ValueError):
            continue
    return out


def cobertura_de_doc(doc, payload: dict, extra_ranges: dict[str, set[int]] | None = None) -> dict:  # noqa: ANN001
    """Auditoria sobre o DocContext da extração (runner): regiões = fontes do envelope ∪
    intervalos rastreados pelo builder (extra_ranges). Sem extra_ranges (auditoria de envelope
    salvo), credita o `_ingestao` serializado — runtime já passa os ranges, não soma em dobro."""
    cobertas = ranges_do_envelope(payload)
    if not extra_ranges:
        extra_ranges = ranges_persistidos(payload)
    for aba, linhas in (extra_ranges or {}).items():
        cobertas.setdefault(aba, set()).update(linhas)
    abas_rows: dict[str, list] = {}
    for aba in doc.sheet_names():
        try:
            abas_rows[aba] = doc.sheet_rows(aba)
        except Exception:  # noqa: BLE001 — aba ilegível conta como 100% órfã (zero cobertura)
            abas_rows[aba] = []
    return auditar_cobertura(abas_rows, cobertas)


def resumo_cobertura(res: dict, max_abas: int = 6) -> str:
    """Mensagem compacta p/ alerta/review: top regiões órfãs-FONTE com amostra. SÓ abas com região FONTE
    (regioes não-vazia) — abas só-ZERO/só-DERIVADA entram no por_aba SEM região (regioes=[]) e indexá-las
    em a['regioes'][0] daria IndexError (engolido pelo except do runner → 'gate falhou', cegando o relatório
    justo quando há perda real). Elas têm alerta próprio (total_numericas_zero/derivadas)."""
    com_regiao = [a for a in res["por_aba"] if a["regioes"]]
    partes = []
    for a in com_regiao[:max_abas]:
        regs = ", ".join(f"L{r['de']}-L{r['ate']}" for r in a["regioes"][:4])
        extra = f" (+{len(a['regioes']) - 4} regiões)" if len(a["regioes"]) > 4 else ""
        marca = " [ABA SEM NENHUMA REGIÃO]" if a.get("sem_regiao") else ""
        partes.append(f"'{a['aba']}'{marca}: {a['n_celulas_orfas']} células "
                      f"({a['n_numericas_orfas']} numéricas) fora de cobertura em {regs}{extra} · "
                      f"ex.: {a['regioes'][0]['amostra'][:90]}")
    mais = len(com_regiao) - max_abas
    if mais > 0:
        partes.append(f"… +{mais} aba(s) com órfãs")
    return " | ".join(partes)


if __name__ == "__main__":
    import json
    import sys

    import openpyxl

    if len(sys.argv) < 3:
        raise SystemExit("uso: python -m agents.extracao.cobertura <arquivo.xlsx> <envelope.json>")
    wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    abas_rows = {}
    for ws in wb.worksheets:
        ws.reset_dimensions()  # não confiar no atributo dimension (exports de ERP mentem)
        abas_rows[ws.title] = [[c.value for c in row] for row in ws.iter_rows()]
    payload = json.load(open(sys.argv[2]))
    cobertas = ranges_do_envelope(payload)
    for aba, linhas in ranges_persistidos(payload).items():  # credita a ingestão serializada (_ingestao)
        cobertas.setdefault(aba, set()).update(linhas)
    res = auditar_cobertura(abas_rows, cobertas)
    tot_cel = sum(1 for rows in abas_rows.values() for row in rows for v in row if _tem_dado(v))
    pct = (1 - res["total_orfas"] / tot_cel) * 100 if tot_cel else 100.0
    print(f"COBERTURA: {tot_cel - res['total_orfas']}/{tot_cel} células ({pct:.1f}%) · "
          f"{res['total_orfas']} órfãs ({res['total_numericas']} numéricas) · "
          f"{len(res['abas_sem_regiao'])} aba(s) sem nenhuma região")
    for a in res["por_aba"]:
        marca = " ⚠ SEM NENHUMA REGIÃO" if a.get("sem_regiao") else ""
        print(f"\n## {a['aba']}{marca} — {a['n_celulas_orfas']} células órfãs "
              f"({a['n_numericas_orfas']} numéricas)")
        for r in a["regioes"][:10]:
            print(f"   L{r['de']}-L{r['ate']} · {r['amostra']}")
        if len(a["regioes"]) > 10:
            print(f"   … +{len(a['regioes']) - 10} regiões")


# ── GATE DOS NÚMEROS DIGITADOS (chave_valor · totais · identificação) ───────────────────────────
# Os ÚNICOS números que o modelo TRANSCREVE numa planilha são os de definir_dados/abrir_secao
# (cards/KPIs → chave_valor), totais_declarados e identificacao — todo o resto é lido em código.
# Este gate confere cada um deles contra o multiconjunto de células da planilha: número que não
# existe em célula nenhuma = digitado errado/arredondado/computado pelo modelo ⇒ needs_review
# apontando seção+campo. Zero fica fora (ambíguo demais).
_ROUND_DIG = 6


def _num_canonico(v):  # noqa: ANN001
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")) or f == 0:
            return None
        return round(f, _ROUND_DIG)
    if isinstance(v, str):
        from .cells import to_number_br

        n = to_number_br(v.strip())
        return round(float(n), _ROUND_DIG) if n is not None and float(n) != 0 else None
    return None


def _walk_campos(prefixo: str, v, out: list) -> None:  # noqa: ANN001
    if isinstance(v, dict):
        for k, x in v.items():
            _walk_campos(f"{prefixo}.{k}", x, out)
    elif isinstance(v, (list, tuple)):
        for i, x in enumerate(v):
            _walk_campos(f"{prefixo}[{i}]", x, out)
    else:
        n = _num_canonico(v)
        if n is not None:
            out.append((prefixo, n))


def celulas_numericas(abas_rows: dict[str, list]) -> tuple[dict[str, set], set]:
    """(multiconjunto por aba, multiconjunto global) dos números das células (round 6)."""
    por_aba: dict[str, set] = {}
    todas: set = set()
    for aba, rows in abas_rows.items():
        s: set = set()
        for row in rows:
            for v in (row or []):
                n = _num_canonico(v)
                if n is not None:
                    s.add(n)
        por_aba[aba] = s
        todas |= s
    return por_aba, todas


def auditar_digitados(abas_rows: dict[str, list], payload: dict) -> dict:
    """Confere os números digitados pelo modelo contra as células. Retorna
    {orfaos: [{onde, campo, valor, aba}], n_verificados}."""
    por_aba, todas = celulas_numericas(abas_rows)
    alvos: list[tuple[str, str | None, list]] = []  # (onde, aba_da_fonte, [(campo, n)])

    def _campos(v) -> list:  # noqa: ANN001
        out: list = []
        _walk_campos("", v, out)
        return out

    alvos.append(("identificacao", None, _campos(payload.get("identificacao"))))
    alvos.append(("totais_declarados", None, _campos(payload.get("totais_declarados"))))
    for s in payload.get("secoes") or []:
        if isinstance(s, dict) and s.get("tipo") == "chave_valor":
            m = _RE_SHEET.search(str(s.get("fonte") or ""))
            alvos.append((f"chave_valor '{(s.get('titulo') or '')[:50]}'",
                          m.group(1) if m else None, _campos(s.get("dados"))))

    orfaos: list[dict] = []
    n_verificados = 0
    for onde, aba, campos in alvos:
        base = por_aba.get(aba) if aba in (por_aba or {}) else None
        for campo, n in campos:
            n_verificados += 1
            if (base is not None and n in base) or n in todas:
                continue
            orfaos.append({"onde": onde, "campo": campo.lstrip("."), "valor": n, "aba": aba})
    return {"orfaos": orfaos, "n_verificados": n_verificados}


def digitados_de_doc(doc, payload: dict) -> dict:  # noqa: ANN001
    abas_rows = {}
    for aba in doc.sheet_names():
        try:
            abas_rows[aba] = doc.sheet_rows(aba)
        except Exception:  # noqa: BLE001
            abas_rows[aba] = []
    return auditar_digitados(abas_rows, payload)
