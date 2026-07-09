"""Runner · orquestra a extração de um documento com fidelidade máxima.

1. Monta um PLANO de fatias (whole | por sheet | por janela de linhas | por
   páginas) a partir das dimensões REAIS do doc — evita estourar o contexto de
   ENTRADA em planilhas/PDFs enormes.
2. Para cada fatia, o modelo lê e ANEXA ao mesmo `EnvelopeBuilder` (a saída fica
   bounded por chamada → resolve a causa-raiz do erro de tamanho).
3. `sanity_check` determinístico + `verifier` (config) conferem o resultado.
4. Qualquer erro/soma que não bate/não-finalizado/ilegível → `needs_review`
   (nunca um `extracted` silenciosamente errado).
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from config import (
    EXTRACTOR_CONCURRENCY,
    EXTRACTOR_MAX_SLICES,
    EXTRACTOR_MAX_TURNS,
    EXTRACTOR_RENAME_BACKSTOP,
    EXTRACTOR_RECONCILE,
    EXTRACTOR_VERIFY,
    PDF_PAGES_PER_SLICE,
    PDF_WHOLE_MAX_PAGES,
    XLSX_SHEETS_PER_SLICE,
    XLSX_WHOLE_MAX_SHEETS,
)

from .envelope import EnvelopeBuilder, is_critical, validate_envelope
from .extractor import extract_into
from .reconcile import diff_envelopes
from .sanity import sanity_check


@dataclass
class ExtractionResult:
    payload: dict
    doc_type: str
    critical: bool = False
    field_confidence: dict = field(default_factory=dict)
    discrepancies: list = field(default_factory=list)
    verifier_findings: list = field(default_factory=list)
    needs_review: bool = False
    review_reasons: list[str] = field(default_factory=list)
    # Tag de ORIGEM dos reasons (cobertura-fonte/digitado/sanity/schema/…), SÓ p/ o painel distinguir
    # "review por perda de dado" de "review por defeito de arquivo". needs_review NUNCA deriva disto.
    review_kinds: set[str] = field(default_factory=set)
    # [(agent_name, pass_no, usage, cost, latency_ms)] para agent_runs
    runs: list[tuple[str, int, Any, Any, int]] = field(default_factory=list)


def plan_scopes(doc) -> list[dict]:  # noqa: ANN001
    """Decide as fatias a partir das dimensões reais (não do mapa, que subestima)."""
    ext = doc.ext
    if ext == "pdf":
        pages = None
        try:
            pages = len(doc.pdf().pages)
        except Exception:  # noqa: BLE001
            try:  # 2ª fonte: PyMuPDF (não engole o doc inteiro só porque o pypdf falhou)
                pages = doc.fitz().page_count
            except Exception:  # noqa: BLE001
                return [{"kind": "whole"}]
        if pages <= PDF_WHOLE_MAX_PAGES:
            return [{"kind": "whole"}]
        scopes = []
        de = 1
        while de <= pages:
            ate = min(pages, de + PDF_PAGES_PER_SLICE - 1)
            scopes.append({"kind": "pages", "de": de, "ate": ate})
            de = ate + 1
        return scopes

    if ext in ("xlsx", "xlsm", "xls"):
        # Planilha = ingestão determinística (`ingerir_planilha` lê células em código);
        # o modelo só AMOSTRA estrutura — não relê linha a linha. Por isso poucas abas
        # cabem numa passada. MAS workbook multi-aba (80+) estourava o teto de turnos
        # numa chamada só → fatia em GRUPOS de abas (builder compartilhado acumula).
        try:
            names = doc.sheet_names()
        except Exception:  # noqa: BLE001
            return [{"kind": "whole"}]
        if len(names) <= XLSX_WHOLE_MAX_SHEETS:
            return [{"kind": "whole"}]
        return [{"kind": "sheets", "sheets": names[i:i + XLSX_SHEETS_PER_SLICE]}
                for i in range(0, len(names), XLSX_SHEETS_PER_SLICE)]

    return [{"kind": "whole"}]


async def _extract_scopes(
    builder: EnvelopeBuilder,
    doc,
    doc_type: str,
    context_md: str,
    structure: dict | None,
    scopes: list[dict],
    *,
    pass_no: int,
) -> list[tuple[Any, int]]:
    """Roda TODAS as fatias no MESMO `builder` com concorrência limitada (semáforo + asyncio.gather).

    SEGURO p/ paralelizar — a base do raciocínio:
    - As tools de montagem (submit_tools) são corrotinas SÍNCRONAS (sem `await` no corpo) → sob asyncio
      (single-thread cooperativo) cada chamada é ATÔMICA → não há corrida de budget/append (sem Lock).
    - A ÚNICA fonte de não-determinismo é a ORDEM das seções (insertion-order sob gather = ordem de
      CONCLUSÃO). Resolvida gravando `scope_order` = índice-da-fatia em cada seção e ordenando por
      (scope_order, seq) no build() → envelope byte-idêntico ao sequencial (provado em
      test_runner_concorrencia.py).
    - C1: NENHUMA fatia finaliza (is_last=False) — o runner finaliza após o gather, deterministicamente
      (finalizar na fatia, sob gather, seria corrida).

    EXTRACTOR_CONCURRENCY=1 reproduz exatamente o caminho sequencial legado. Retorna [(PassResult,
    latency_ms)] na ORDEM das fatias (gather preserva a ordem dos argumentos)."""
    sem = asyncio.Semaphore(max(1, EXTRACTOR_CONCURRENCY))

    async def _one(i: int, scope: dict) -> tuple[Any, int]:
        async with sem:
            t0 = time.monotonic()
            pr = await extract_into(
                builder, doc, doc_type, context_md, structure or {},
                scope=scope, pass_no=pass_no, is_last=False, scope_order=i,
            )
            return pr, int((time.monotonic() - t0) * 1000)

    return await asyncio.gather(*[_one(i, s) for i, s in enumerate(scopes)])


async def run_extraction(
    doc,
    doc_type: str,
    context_md: str,
    structure: dict | None,
) -> ExtractionResult:
    from .doc_schemas import is_domain_critical

    critical = is_critical(doc_type, doc.filename) or is_domain_critical(doc_type, doc.filename)
    res = ExtractionResult(payload={}, doc_type=doc_type, critical=critical)
    builder = EnvelopeBuilder()

    scopes = plan_scopes(doc)
    truncated_plan = False
    if len(scopes) > EXTRACTOR_MAX_SLICES:
        scopes = scopes[:EXTRACTOR_MAX_SLICES]
        truncated_plan = True

    turns_hit = False
    # C2/C3: as fatias rodam concorrentes (EXTRACTOR_CONCURRENCY) no MESMO builder. is_last=False em
    # todas → o runner finaliza após o gather, deterministicamente (vide _extract_scopes p/ a prova
    # de segurança). EXTRACTOR_CONCURRENCY=1 = sequencial legado, byte-idêntico.
    for pr, ms in await _extract_scopes(
        builder, doc, doc_type, context_md, structure, scopes, pass_no=1
    ):
        # Fatia que bateu (quase) no teto de turnos pode ter parado no meio (sub-extração).
        if pr.num_turns and pr.num_turns >= EXTRACTOR_MAX_TURNS - 2:
            turns_hit = True
        res.runs.append(("extractor", 1, pr.usage, pr.cost, ms))

    res.payload = builder.build()
    builder.finalized = builder.has_data()  # C1: runner finaliza (não o modelo); has_data ⇒ produziu envelope

    # ── Conferências (nunca um 'extracted' errado) ─────────────────────
    reasons: list[str] = []
    findings: list = []
    confidences: list[float] = []

    # Motivos forçados pelas tools (ex.: fórmula sem valor em cache na ingestão).
    if builder.force_review:
        reasons.extend(builder.force_review)

    # ── BACKSTOP DETERMINÍSTICO (fidelidade) — fecha o gap das MATRIZES ANÔNIMAS que o modelo pula ──
    # Lê EM CÓDIGO os blocos FONTE órfãos que o gate aponta (ex.: C.14 L200-222) e os anexa ao builder,
    # sem o modelo e sem transcrever número. Endurecido contra cobertura-teatro (colunas reais + título
    # com código + guard de tabularidade + região-a-região). Re-build → o gate ABAIXO roda PÓS-backstop.
    if getattr(doc, "ext", None) in ("xlsx", "xlsm", "xls") and not builder.is_empty():
        try:
            from .backstop import ingerir_orfas_fonte

            ingeridos = ingerir_orfas_fonte(builder, doc)
        except Exception as e:  # noqa: BLE001 — o backstop nunca pode derrubar a extração
            ingeridos = []
            reasons.append(f"backstop de cobertura falhou ao rodar ({type(e).__name__}: {e}) — revisar")
        # Fase 2a · rename SEGURO (modelo nomeia colunas das matrizes do backstop · título intacto →
        # captura-only). Best-effort: falha de API → mantém colunas genéricas (nunca derruba a extração).
        if ingeridos and EXTRACTOR_RENAME_BACKSTOP:
            try:
                from .rename_backstop import renomear_backstop_colunas

                await renomear_backstop_colunas(builder, doc, ingeridos)
            except Exception:  # noqa: BLE001
                pass
        if ingeridos:
            res.payload = builder.build()
            res.payload.setdefault("alertas_extracao", []).append(
                f"backstop: {len(ingeridos)} bloco(s) não-rotulado(s) auto-ingerido(s) em código "
                f"(cobertura determinística · sem o modelo) → "
                + "; ".join(f"'{a}' L{de}-L{ate} ({n}ln)" for a, de, ate, n in ingeridos[:8]))

    # ── GATE DE COBERTURA célula-a-célula (xlsx) — "100% extraído" verificável ──
    # Toda célula com dado tem que estar coberta por região declarada (ingestões rastreadas ∪
    # fontes das seções). Órfã NUMÉRICA ⇒ needs_review com as regiões; só-texto ⇒ alerta.
    if getattr(doc, "ext", None) in ("xlsx", "xlsm", "xls") and not builder.is_empty():
        try:
            from .cobertura import cobertura_de_doc, resumo_cobertura

            cov = cobertura_de_doc(doc, res.payload, extra_ranges=builder.ingested_ranges)
            # Só órfã-FONTE (total_numericas) força review. Órfã-DERIVADA (rodapé TOTAL/DIFERENÇA/ACUM
            # recomposto pelo motor) NÃO derruba uma extração fiel — vira alerta (transparência).
            if cov["total_numericas"] > 0 or cov["abas_sem_regiao"]:
                msg = (f"cobertura: {cov['total_numericas']} célula(s) numérica(s) de FONTE fora do "
                       f"envelope ({len(cov['abas_sem_regiao'])} aba(s) sem nenhuma região) → "
                       f"{resumo_cobertura(cov)}")
                reasons.append(msg)
                res.payload.setdefault("alertas_extracao", []).append(msg)
            elif cov["total_orfas"] > 0:
                res.payload.setdefault("alertas_extracao", []).append(
                    f"cobertura: {cov['total_orfas']} célula(s) de TEXTO fora do envelope "
                    f"(rótulos/banners) → {resumo_cobertura(cov, max_abas=3)}")
            if cov.get("total_numericas_derivadas", 0) > 0:
                res.payload.setdefault("alertas_extracao", []).append(
                    f"cobertura: {cov['total_numericas_derivadas']} célula(s) numérica(s) DERIVADAS "
                    f"(TOTAL/DIFERENÇA/ACUM · recompostas pelo motor) fora do envelope — não força review")
            if cov.get("total_numericas_zero", 0) > 0:
                res.payload.setdefault("alertas_extracao", []).append(
                    f"cobertura: {cov['total_numericas_zero']} célula(s) numérica(s) ZERO (template "
                    f"honest-zero §5.6 · matriz pré-execução sem evento/execução) fora do envelope — "
                    f"não força review (todo o conteúdo é 0, nada se perde)")
        except Exception as e:  # noqa: BLE001 — o gate nunca pode derrubar a extração inteira
            reasons.append(f"gate de cobertura falhou ao rodar ({type(e).__name__}: {e}) — revisar")

        # ── GATE DOS DIGITADOS — todo número transcrito pelo modelo (chave_valor/totais/
        # identificação) tem que EXISTIR em alguma célula da planilha. Órfão = digitado
        # errado/arredondado/computado ⇒ needs_review apontando seção+campo.
        try:
            from .cobertura import digitados_de_doc

            dig = digitados_de_doc(doc, res.payload)
            if dig["orfaos"]:
                exemplos = "; ".join(
                    f"{o['onde']}.{o['campo']}={o['valor']}" for o in dig["orfaos"][:8])
                if len(dig["orfaos"]) > 8:
                    exemplos += f" … +{len(dig['orfaos']) - 8}"
                msg = (f"digitados: {len(dig['orfaos'])} de {dig['n_verificados']} número(s) "
                       f"transcritos NÃO existem em célula nenhuma (arredondado/computado?) → {exemplos}")
                reasons.append(msg)
                res.payload.setdefault("alertas_extracao", []).append(msg)
        except Exception as e:  # noqa: BLE001
            reasons.append(f"gate de digitados falhou ao rodar ({type(e).__name__}: {e}) — revisar")

    # ── Reconciliação por DUPLA-PASSADA (docs críticos · base de pleito) ──
    # Roda a extração de novo num builder independente e exige concordância. Nos
    # caminhos determinísticos (planilha/tabela) as 2 passadas batem por construção
    # → confirmação barata; onde o modelo lê valor (visão) a divergência vira revisão.
    if critical and EXTRACTOR_RECONCILE and not builder.is_empty():
        try:
            builder2 = EnvelopeBuilder()
            # 2ª passada: mesma concorrência da 1ª (builder2 independente · idem _extract_scopes).
            for pr, ms in await _extract_scopes(
                builder2, doc, doc_type, context_md, structure, scopes, pass_no=2
            ):
                res.runs.append(("extractor", 2, pr.usage, pr.cost, ms))
            payload2 = builder2.build()
            builder2.finalized = builder2.has_data()
            if builder2.is_empty():
                # Pass1 tinha dado e pass2 veio vazia → extração instável, não é "concordam".
                reasons.append("reconciliação: 2ª passada veio vazia (extração instável) — revisar")
                confidences.append(0.3)
                diffs = []
                res.discrepancies = []
            else:
                diffs = diff_envelopes(res.payload, payload2)
                res.discrepancies = diffs
            # Só divergência de NÚCLEO (item/custo) vira needs_review. Borda (%/total/zero)
            # entra como `info` — não reprova o doc por variação estrutural/de formato.
            core = [d for d in diffs if d.get("core", True)]
            edge = [d for d in diffs if not d.get("core", True)]
            if core:
                reasons.append(
                    f"reconciliação (doc crítico): {len(core)} divergência(s) de NÚCLEO entre as duas passadas — revisar"
                )
            findings += [
                {
                    "severity": "error" if d.get("core", True) else "info",
                    "message": f"divergência em {d['field']}: {d['valueA']!r} vs {d['valueB']!r}",
                    "field": d["field"],
                    "source": "reconciler",
                }
                for d in (core + edge)[:10]
            ]
            if core:
                confidences.append(max(0.0, 1.0 - 0.1 * len(core)))
            elif edge:
                confidences.append(0.9)  # só borda divergiu → confiança boa, não reprova
            else:
                confidences.append(0.99)
        except Exception as e:  # noqa: BLE001 — 2ª passada é rede extra, não derruba a 1ª
            findings.append(
                {"severity": "info", "message": f"reconciliação falhou: {type(e).__name__}: {e}", "source": "reconciler"}
            )
    elif critical and not EXTRACTOR_RECONCILE:
        # Reconciliação desligada de PROPÓSITO (passada única). O doc NÃO é reprovado só
        # por isso — a QA de passada única já é forte (sanity total↔TOTAL, audit_ingested,
        # guard de coluna deslocada, detecção de garbled, e o verifier). Registra só como
        # info (transparência de que não houve dupla-passada).
        findings.append(
            {
                "severity": "info",
                "message": "extração em passada única (reconciliação desligada)",
                "source": "reconciler",
            }
        )

    if truncated_plan:
        reasons.append(f"plano de fatias excedeu {EXTRACTOR_MAX_SLICES} — doc muito grande, revisar cobertura")

    if turns_hit:
        reasons.append(f"uma fatia atingiu o teto de {EXTRACTOR_MAX_TURNS} turnos — possível extração parcial, revisar cobertura")

    if builder.is_empty():
        reasons.append("nenhum dado extraído (envelope vazio)")

    if not builder.finalized:
        reasons.append("extração não finalizada pelo modelo (pode estar incompleta)")

    schema_errs = validate_envelope(res.payload)
    if schema_errs:
        reasons.append("envelope inválido: " + "; ".join(schema_errs[:3]))
        findings += [{"severity": "error", "message": e, "source": "schema"} for e in schema_errs[:10]]

    sc = sanity_check(res.payload, critical=critical)
    findings += sc.findings
    if sc.failed:
        reasons.append("sanity_check reprovou (soma/datas/faixas/tabela vazia)")

    # ── Verifier (config-gated · saída pequena, seguro) ────────────────
    # Pula se o doc JÁ vai pra revisão (reasons preenchido) — não gasta a chamada
    # extra do verifier num doc que já está reprovado (short-circuit de custo).
    if EXTRACTOR_VERIFY and not builder.is_empty() and not reasons:
        try:
            from .verifier import verify

            tv = time.monotonic()
            v = await verify(doc, doc_type, res.payload)
            res.runs.append(("verifier", 1, v.usage, v.cost, int((time.monotonic() - tv) * 1000)))
            findings += [{**f, "source": f.get("source", "verifier")} for f in v.findings if isinstance(f, dict)]
            if v.confidence is not None:
                confidences.append(float(v.confidence))
            if v.needs_review:
                reasons.append("verifier sinalizou revisão")
            # QA que NÃO concluiu (sem structured) num doc crítico não pode dar
            # falsa confiança de 'verificado' → manda pra revisão.
            if critical and not v.concluded:
                reasons.append("verificação não concluída em doc crítico — conferir manualmente")
        except Exception as e:  # noqa: BLE001 — verifier é rede extra, não bloqueia
            findings.append({"severity": "info", "message": f"verifier falhou: {type(e).__name__}: {e}", "source": "verifier"})
            if critical:
                reasons.append("verificação falhou em doc crítico — conferir manualmente")

    # Confiança global = a MENOR entre reconciler e verifier (o elo mais fraco manda).
    if confidences:
        res.field_confidence = {"overall": round(min(confidences), 4)}

    res.verifier_findings = findings
    res.review_reasons = reasons
    res.needs_review = bool(reasons)  # SOBERANO: qualquer reason → review. NUNCA derivar de review_kinds.
    res.review_kinds = _classificar_review_kinds(reasons)
    return res


def _classificar_review_kinds(reasons: list[str]) -> set[str]:
    """Tag de ORIGEM de cada reason — APENAS p/ o painel separar 'perda de dado-fonte' de 'defeito de
    arquivo'. INVARIANTE DURO: needs_review é soberano (bool(reasons)); esta função NUNCA pode
    realimentá-lo (seria a alavanca exata p/ afrouxar o gate). Travado por test_runner_review_kinds."""
    kinds: set[str] = set()
    for r in reasons:
        rl = str(r).lower()
        if "cobertura:" in rl:
            kinds.add("cobertura-fonte")
        elif "digitado" in rl:
            kinds.add("digitado")
        elif "sanity" in rl:
            kinds.add("sanity")
        elif "envelope inválido" in rl:
            kinds.add("schema")
        elif "envelope vazio" in rl or "nenhum dado" in rl:
            kinds.add("vazio")
        elif "não finalizada" in rl or "parcial" in rl or "teto de" in rl or "excedeu" in rl:
            kinds.add("parcial")
        elif "verifi" in rl:
            kinds.add("verifier")
        else:
            kinds.add("outro")
    return kinds
