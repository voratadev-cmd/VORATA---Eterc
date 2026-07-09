"""Tools in-process MCP de ESCRITA do envelope (Fase 2).

O extrator NÃO devolve mais o envelope inteiro num único `output_format` (isso
estoura o teto de tokens de SAÍDA do modelo em docs tabulares — ver auditoria).
Em vez disso, ele MONTA o envelope incrementalmente chamando estas tools, que
acumulam num `EnvelopeBuilder`. Cada chamada tem saída pequena (um lote de
linhas), o checkpoint é natural e não há perda de contexto entre fatias.

Cada tool é uma closure sobre o builder do documento; o servidor é construído
por-documento via `build_submit_tools_server(builder)`.
"""

from __future__ import annotations

from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

from config import INGEST_MAX_ROWS, INGEST_MAX_TOTAL_ROWS

from .cells import audit_ingested, build_rows, resolve_columns
from .envelope import EnvelopeBuilder, validate_envelope

SUBMIT_TOOL_NAMES = [
    "definir_documento",
    "abrir_secao",
    "ingerir_planilha",
    "ingerir_tabela_pdf",
    "anexar_linhas",
    "definir_dados",
    "definir_conteudo",
    "anexar_alerta",
    "finalizar_extracao",
]


def _ok(s: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": s}]}


def _err(s: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": s}], "is_error": True}


# ── JSON Schemas dos inputs (objetos/arrays livres · o SDK aceita schema completo)
_FREE_OBJ = {"type": "object", "additionalProperties": True}

_S_DEFINIR_DOC = {
    "type": "object",
    "properties": {
        "tipo_documento": {"type": "string"},
        "resumo": {"type": "string"},
        "identificacao": _FREE_OBJ,
        "totais_declarados": _FREE_OBJ,
    },
    "required": ["tipo_documento"],
}
_S_ABRIR_SECAO = {
    "type": "object",
    "properties": {
        "secao_id": {"type": "string", "description": "ID curto e estável (ex.: 'itens', 'totais', sheet name). Reabrir com o mesmo ID acumula."},
        "titulo": {"type": "string"},
        "tipo": {"type": "string", "enum": ["tabela", "chave_valor", "texto"]},
        "fonte": {"type": "string"},
        "colunas": {"type": "array", "items": {"type": "string"}},
        "dados": _FREE_OBJ,
        "conteudo": {"type": "string"},
    },
    "required": ["secao_id", "titulo", "tipo", "fonte"],
}
_S_ANEXAR_LINHAS = {
    "type": "object",
    "properties": {
        "secao_id": {"type": "string"},
        "linhas": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
    },
    "required": ["secao_id", "linhas"],
}
_S_DEFINIR_DADOS = {
    "type": "object",
    "properties": {"secao_id": {"type": "string"}, "dados": _FREE_OBJ},
    "required": ["secao_id", "dados"],
}
_S_DEFINIR_CONTEUDO = {
    "type": "object",
    "properties": {"secao_id": {"type": "string"}, "conteudo": {"type": "string"}},
    "required": ["secao_id", "conteudo"],
}
_S_ALERTA = {"type": "object", "properties": {"texto": {"type": "string"}}, "required": ["texto"]}
_S_INGERIR = {
    "type": "object",
    "properties": {
        "sheet": {"type": "string", "description": "Nome da sheet (exato, como em dimensoes)."},
        "secao_id": {"type": "string", "description": "ID curto e estável da seção (ex.: a própria sheet)."},
        "titulo": {"type": "string"},
        "fonte": {"type": "string", "description": "Opcional · gerada automaticamente se omitida."},
        "linha_cabecalho": {"type": "integer", "description": "Linha (1-based) com os nomes das colunas. Omita se não houver cabeçalho (use 'colunas')."},
        "de": {"type": "integer", "description": "Primeira linha de DADOS (1-based). Padrão: linha_cabecalho+1 (ou 1)."},
        "ate": {"type": "integer", "description": "Última linha de DADOS (1-based). Padrão: última linha da sheet. EXCLUA a linha de totais."},
        "colunas": {"type": "array", "items": {"type": "string"}, "description": "Override posicional dos nomes das colunas (quando não há cabeçalho ou pra renomear)."},
        "pular_vazias": {"type": "boolean", "description": "Pula linhas totalmente vazias (padrão true)."},
        "normalizar_numeros_texto": {"type": "boolean", "description": "Converte strings numéricas BR/US em número (padrão true)."},
    },
    "required": ["sheet", "secao_id", "titulo"],
}
_S_INGERIR_PDF = {
    "type": "object",
    "properties": {
        "pagina": {"type": "integer", "description": "Página do PDF (1-based)."},
        "secao_id": {"type": "string"},
        "titulo": {"type": "string"},
        "indice_tabela": {"type": "integer", "description": "Índice da tabela na página (0-based · veja listar_tabelas_pdf). Padrão 0."},
        "linha_cabecalho": {"type": "integer", "description": "Linha (1-based) do cabeçalho DENTRO da tabela. Padrão 1."},
        "fonte": {"type": "string"},
        "colunas": {"type": "array", "items": {"type": "string"}, "description": "Override posicional dos nomes das colunas."},
        "pular_vazias": {"type": "boolean"},
        "normalizar_numeros_texto": {"type": "boolean"},
    },
    "required": ["pagina", "secao_id", "titulo"],
}


def build_submit_tools_server(builder: EnvelopeBuilder, doc=None, scope_order: int = 0):  # noqa: ANN001
    """Servidor MCP in-process com as tools de montagem amarradas a `builder`.
    `doc` (DocContext) é necessário só p/ `ingerir_planilha` (ingestão determinística).
    `scope_order` (índice da fatia) é gravado em cada seção aberta → build() ordena por ele,
    deixando o envelope DETERMINÍSTICO mesmo quando as fatias rodam em paralelo (asyncio.gather)."""

    @tool(
        "definir_documento",
        "Define o cabeçalho do envelope: tipo_documento (do texto-mapa), resumo, identificacao (objeto) e totais_declarados (os totais que o DOC declara, como número). Chame uma vez no começo; pode rechamar para complementar.",
        _S_DEFINIR_DOC,
    )
    async def definir_documento(args):  # noqa: ANN001
        builder.set_documento(
            tipo_documento=args.get("tipo_documento"),
            resumo=args.get("resumo"),
            identificacao=args.get("identificacao"),
            totais_declarados=args.get("totais_declarados"),
        )
        return _ok(f"documento definido: {builder.tipo_documento!r}")

    @tool(
        "abrir_secao",
        "Cria (ou reabre) uma seção. tipo='tabela' → passe colunas[] e depois use anexar_linhas. tipo='chave_valor' → passe dados (objeto). tipo='texto' → passe conteudo. Reabrir com o mesmo secao_id NÃO apaga linhas já anexadas.",
        _S_ABRIR_SECAO,
    )
    async def abrir_secao(args):  # noqa: ANN001
        tipo = args.get("tipo")
        if tipo not in ("tabela", "chave_valor", "texto"):
            return _err("tipo inválido (use 'tabela' | 'chave_valor' | 'texto').")
        builder.open_secao(
            args.get("secao_id"),
            args.get("titulo"),
            tipo,
            args.get("fonte"),
            colunas=args.get("colunas"),
            dados=args.get("dados"),
            conteudo=args.get("conteudo"),
            scope_order=scope_order,
        )
        return _ok(f"seção '{args.get('secao_id')}' [{tipo}] aberta")

    @tool(
        "ingerir_planilha",
        "RÁPIDO · ingere uma região tabular de uma PLANILHA lendo as células EM CÓDIGO (não transcreva linha a linha!). Você só diz a sheet, a linha do cabeçalho e o intervalo de dados; a tool monta as linhas {coluna: valor} com números/datas já normalizados e anexa à seção. Use isto para a tabela principal de XLSX/XLS (milhares de linhas em 1 chamada). Números viram número, datas viram ISO, células vazias são omitidas.",
        _S_INGERIR,
    )
    async def ingerir_planilha(args):  # noqa: ANN001
        if doc is None or getattr(doc, "ext", None) not in ("xlsx", "xlsm", "xls"):
            return _err("ingerir_planilha só vale para planilha (xlsx/xls). Use ler_* + anexar_linhas p/ outros formatos.")
        try:
            names = doc.sheet_names()
        except Exception as e:  # noqa: BLE001
            return _err(f"Planilha ilegível: {type(e).__name__}: {e}")
        sheet = args.get("sheet") or (names[0] if names else "")
        if sheet not in names:
            return _err(f"Sheet '{sheet}' não existe. Sheets: {names}")
        rows = doc.sheet_rows(sheet)
        total = len(rows)
        if total == 0:
            return _err(f"Sheet '{sheet}' está vazia.")

        hdr = args.get("linha_cabecalho")
        override = args.get("colunas")
        header_cells = None
        if not override and hdr is not None:
            h = int(hdr)
            if 1 <= h <= total:
                header_cells = rows[h - 1]
        columns = resolve_columns(header_cells, override)

        de = args.get("de")
        de = int(de) if de is not None else ((int(hdr) + 1) if hdr is not None else 1)
        de = max(1, de)
        ate = args.get("ate")
        ate = int(ate) if ate is not None else total
        ate = min(ate, total)
        if ate < de:
            return _err(f"intervalo inválido: de={de} > ate={ate} (sheet tem {total} linhas).")

        capped = min(ate, de + INGEST_MAX_ROWS - 1)

        # Teto TOTAL por documento · envelope grande demais p/ jsonb/front → fail-loud
        # (needs_review) em vez de OOM / blob inarmazenável. Planilha gigante = fatiar.
        budget = INGEST_MAX_TOTAL_ROWS - builder.count_linhas()
        budget_hit = False
        if budget <= 0:
            m = f"documento excede {INGEST_MAX_TOTAL_ROWS} linhas no total — não ingeri mais (precisa fatiar/colunar)."
            builder.flag_review(m)
            return _err(m)
        if capped - de + 1 > budget:
            capped = de + budget - 1
            budget_hit = True

        # Cobre TODAS as colunas com dado no intervalo (varre o intervalo INTEIRO):
        # não dropa coluna de dado sob cabeçalho vazio nem subdimensiona em linhas
        # mais largas lá no fim. Colunas extras (sem header) viram col_N.
        data_width = max((len(rows[i - 1]) for i in range(de, capped + 1) if i - 1 < total), default=0)
        if data_width > len(columns):
            columns = columns + [f"col_{k + 1}" for k in range(len(columns), data_width)]
        if not columns:
            return _err("não consegui inferir colunas (linhas vazias). Informe 'colunas' ou 'linha_cabecalho'.")

        data = build_rows(
            rows,
            columns,
            de,
            capped,
            skip_empty=bool(args.get("pular_vazias", True)),
            parse_text_numbers=bool(args.get("normalizar_numeros_texto", True)),
        )

        # GUARD anti-DESLOCAMENTO de coluna (caso PSQ): o modelo às vezes passa `colunas`
        # override e desalinha — a coluna A (códigos de item) recebe um nome placeholder e
        # descrição/quant./valor caem nas colunas erradas. Detecta por CONTEÚDO (robusto a
        # qualquer nome de placeholder, não só 'vazia') + força re-ingestão pelo cabeçalho real.
        if override and data:
            from .cells import detectar_deslocamento_colunas

            shift = detectar_deslocamento_colunas(columns, data)
            if shift:
                return _err(
                    f"sheet '{sheet}': mapeamento de coluna DESLOCADO — {shift}. "
                    "Re-ingira com `linha_cabecalho` apontando para a LINHA DO CABEÇALHO REAL "
                    "(NÃO passe `colunas` inventando/adivinhando nomes) — o código lê os "
                    "cabeçalhos já alinhados às colunas de dado."
                )

        fonte = args.get("fonte") or f"sheet '{sheet}' linhas {de}-{capped} de {total}"
        try:
            builder.open_secao(args.get("secao_id"), args.get("titulo"), "tabela", fonte, colunas=columns, scope_order=scope_order)
            n = builder.append_linhas(args.get("secao_id"), data)
        except (KeyError, ValueError) as e:
            return _err(str(e))
        # rastreia o intervalo REALMENTE lido em código (insumo preciso do gate de cobertura)
        builder.track_ingestao(sheet, int(hdr) if hdr is not None else None, de, capped)

        # FAIL-LOUD · fórmulas sem valor em cache vieram como célula vazia → marca
        # needs_review com os endereços (nunca anexa dado faltando em silêncio).
        warn = ""
        try:
            uncached = doc.uncached_formula_cells(sheet, de, capped)
        except Exception:  # noqa: BLE001
            uncached = []
        if uncached:
            amostra = ", ".join(uncached[:12]) + (" …" if len(uncached) > 12 else "")
            msg = (
                f"sheet '{sheet}': {len(uncached)} célula(s) de FÓRMULA sem valor em cache "
                f"({amostra}) — vieram vazias. Reabra/salve no Excel p/ gerar os valores e re-extraia."
            )
            builder.add_alerta(msg)
            builder.flag_review(msg)
            warn += f" · ⚠ {len(uncached)} fórmula(s) sem valor em cache → needs_review"

        # FAIL-LOUD · anomalia estrutural: TEXTO onde se espera número em ≥2 colunas
        # numéricas → provável cabeçalho repetido / 2ª tabela colada no intervalo.
        suspeitas = audit_ingested(columns, data)
        if suspeitas:
            exemplos = "; ".join(str(data[i]) for i in suspeitas[:3])
            if len(exemplos) > 300:
                exemplos = exemplos[:300] + "…"
            msg = (
                f"sheet '{sheet}', seção '{args.get('secao_id')}': {len(suspeitas)} linha(s) com texto onde "
                f"se espera número — possível cabeçalho repetido / 2ª tabela no intervalo. Revise o de/ate "
                f"(UMA tabela por chamada). Ex.: {exemplos}"
            )
            builder.add_alerta(msg)
            builder.flag_review(msg)
            warn += f" · ⚠ {len(suspeitas)} linha(s) estruturalmente suspeitas → needs_review"

        if budget_hit:
            warn += f" · ⚠ teto total de {INGEST_MAX_TOTAL_ROWS} linhas — parei aqui (doc → revisão)"

        restam = ate - capped
        extra = f" · RESTAM {restam} linha(s) — chame de novo com de={capped + 1}" if restam > 0 and not budget_hit else ""
        return _ok(
            f"ingerido · seção '{args.get('secao_id')}' +{len(data)} linha(s) "
            f"(células lidas {de}-{capped}, {len(columns)} colunas) · total na seção: {n}{extra}{warn}"
        )

    @tool(
        "ingerir_tabela_pdf",
        "RÁPIDO · ingere uma TABELA DE TEXTO de uma página de PDF lendo a grade EM CÓDIGO (PyMuPDF) — não transcreva por visão. Use listar_tabelas_pdf antes pra ver os índices. Números/datas normalizados como na planilha. Tabela que cruza páginas: use a MESMA secao_id em chamadas por página.",
        _S_INGERIR_PDF,
    )
    async def ingerir_tabela_pdf(args):  # noqa: ANN001
        if doc is None or getattr(doc, "ext", None) != "pdf":
            return _err("ingerir_tabela_pdf só vale para PDF. Use ingerir_planilha (xlsx) ou anexar_linhas.")
        p = max(1, int(args.get("pagina", 1)))
        try:
            tables = doc.pdf_table_rows(p)
        except Exception as e:  # noqa: BLE001
            return _err(str(e))
        if not tables:
            return _err(f"página {p}: nenhuma tabela de texto detectada — use ler_pdf_pagina_imagem (visão) + anexar_linhas.")
        idx = int(args.get("indice_tabela", 0) or 0)
        if idx < 0 or idx >= len(tables):
            return _err(f"indice_tabela {idx} inválido — a página {p} tem {len(tables)} tabela(s) (0..{len(tables) - 1}).")
        rows = tables[idx]
        total = len(rows)
        if total == 0:
            return _err("tabela vazia.")

        hdr = args.get("linha_cabecalho", 1)
        override = args.get("colunas")
        de = (int(hdr) + 1) if hdr is not None else 1
        de = max(1, de)
        ate = total

        # Tabela que cruza páginas: na CONTINUAÇÃO (seção já aberta) REUSA as colunas
        # canônicas da 1ª página e mapeia as células POSICIONALMENTE. O find_tables nas
        # páginas seguintes costuma mesclar o cabeçalho repetido com a 1ª linha de dados
        # (ex.: 'EDT 1.6', 'Dias C 3o2rr...') — usar isso como colunas corromperia as chaves.
        canonicas = None if override else builder.get_colunas(args.get("secao_id"))
        if canonicas:
            columns = list(canonicas)
        else:
            header_cells = None
            if not override and hdr is not None:
                h = int(hdr)
                if 1 <= h <= total:
                    header_cells = rows[h - 1]
            columns = resolve_columns(header_cells, override)

        budget = INGEST_MAX_TOTAL_ROWS - builder.count_linhas()
        if budget <= 0:
            m = f"documento excede {INGEST_MAX_TOTAL_ROWS} linhas no total — não ingeri mais."
            builder.flag_review(m)
            return _err(m)
        capped = min(ate, de + budget - 1)

        data_width = max((len(rows[i - 1]) for i in range(de, capped + 1) if i - 1 < total), default=0)
        if canonicas and data_width != len(columns):
            # Continuação multipágina com largura DIFERENTE da 1ª página = grade torta nesta
            # página (find_tables mesclou/perdeu coluna). Mapear posicionalmente desliza
            # valores pra chave errada → SEMPRE sinaliza (vale p/ MAIS e p/ MENOS colunas).
            msg = (
                f"PDF pág {p}, seção '{args.get('secao_id')}': grade com {data_width} colunas vs "
                f"{len(columns)} canônicas da 1ª página — provável coluna mesclada/perdida nesta "
                "página. Mapeei posicionalmente; os valores podem ter deslizado — reveja por visão."
            )
            builder.add_alerta(msg)
            builder.flag_review(msg)
        if data_width > len(columns):
            columns = columns + [f"col_{k + 1}" for k in range(len(columns), data_width)]
        if not columns:
            return _err("não consegui inferir colunas da tabela. Informe 'colunas' ou 'linha_cabecalho'.")

        data = build_rows(
            rows, columns, de, capped,
            skip_empty=bool(args.get("pular_vazias", True)),
            parse_text_numbers=bool(args.get("normalizar_numeros_texto", True)),
        )
        fonte = args.get("fonte") or (
            f"PDF · tabela multipágina (esta fatia: pág {p}, linhas {de}-{capped})"
            if canonicas
            else f"PDF pág {p} · tabela #{idx} (linhas {de}-{capped} de {total})"
        )
        try:
            builder.open_secao(args.get("secao_id"), args.get("titulo"), "tabela", fonte, colunas=columns, scope_order=scope_order)
            n = builder.append_linhas(args.get("secao_id"), data)
        except (KeyError, ValueError) as e:
            return _err(str(e))

        warn = ""
        suspeitas = audit_ingested(columns, data)
        if suspeitas:
            exemplos = "; ".join(str(data[i]) for i in suspeitas[:3])[:300]
            msg = (
                f"PDF pág {p} tabela #{idx}, seção '{args.get('secao_id')}': {len(suspeitas)} linha(s) com texto "
                f"onde se espera número — possível cabeçalho repetido / 2ª tabela / grade mal detectada. Revise. Ex.: {exemplos}"
            )
            builder.add_alerta(msg)
            builder.flag_review(msg)
            warn = f" · ⚠ {len(suspeitas)} linha(s) suspeitas → needs_review"
        return _ok(
            f"ingerido (PDF) · seção '{args.get('secao_id')}' +{len(data)} linha(s) "
            f"(pág {p} tabela #{idx}, {len(columns)} colunas) · total na seção: {n}{warn}"
        )

    @tool(
        "anexar_linhas",
        "Anexa um LOTE de linhas a uma seção 'tabela'. linhas = array de OBJETOS {coluna: valor}. Números como número (1.234,56 → 1234.56). Chame quantas vezes precisar (lotes de ~30-50 linhas). Para tabela de PDF prefira ingerir_tabela_pdf; use anexar_linhas só quando ler por VISÃO (página escaneada).",
        _S_ANEXAR_LINHAS,
    )
    async def anexar_linhas(args):  # noqa: ANN001
        try:
            n = builder.append_linhas(args.get("secao_id"), args.get("linhas"))
        except (KeyError, ValueError) as e:
            return _err(str(e))
        return _ok(f"ok · seção '{args.get('secao_id')}' agora tem {n} linha(s)")

    @tool("definir_dados", "Define/mescla os pares campo:valor de uma seção 'chave_valor'.", _S_DEFINIR_DADOS)
    async def definir_dados(args):  # noqa: ANN001
        try:
            n = builder.set_dados(args.get("secao_id"), args.get("dados"))
        except (KeyError, ValueError) as e:
            return _err(str(e))
        return _ok(f"ok · {n} campo(s) na seção '{args.get('secao_id')}'")

    @tool("definir_conteudo", "Define/acrescenta a transcrição literal de uma seção 'texto'.", _S_DEFINIR_CONTEUDO)
    async def definir_conteudo(args):  # noqa: ANN001
        try:
            builder.set_conteudo(args.get("secao_id"), args.get("conteudo"))
        except (KeyError, ValueError) as e:
            return _err(str(e))
        return _ok("ok")

    @tool("anexar_alerta", "Registra uma ambiguidade/ilegibilidade/ausência/valor duvidoso para o revisor humano.", _S_ALERTA)
    async def anexar_alerta(args):  # noqa: ANN001
        n = builder.add_alerta(args.get("texto"))
        return _ok(f"alerta registrado ({n} no total)")

    @tool(
        "finalizar_extracao",
        "Chame por ÚLTIMO, depois de ler o doc INTEIRO e anexar TUDO. Valida o envelope montado e o marca como completo. Se voltar erros, corrija e chame de novo.",
        {"type": "object", "properties": {}},
    )
    async def finalizar_extracao(args):  # noqa: ANN001
        payload = builder.build()
        errs = validate_envelope(payload)
        if errs:
            builder.finalized = False
            return _err(
                "envelope ainda inválido — corrija e chame finalizar_extracao de novo:\n- "
                + "\n- ".join(errs)
            )
        if not builder.has_data():
            return _err(
                "nenhum dado REAL foi anexado (0 linhas e nenhuma seção com dados/conteúdo). "
                "Leia o documento pelas tools e anexe os dados antes de finalizar."
            )
        builder.finalized = True
        return _ok(
            f"finalizado · {len(builder._secoes)} seção(ões), {builder.count_linhas()} linha(s), "
            f"{len(builder.alertas)} alerta(s)."
        )

    server = create_sdk_mcp_server(
        "envelope",
        "1.0.0",
        tools=[
            definir_documento,
            abrir_secao,
            ingerir_planilha,
            ingerir_tabela_pdf,
            anexar_linhas,
            definir_dados,
            definir_conteudo,
            anexar_alerta,
            finalizar_extracao,
        ],
    )
    return server
