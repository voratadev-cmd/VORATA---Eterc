"""Validação da Onda C (concorrência das fatias) contra o DOC REAL (workbook BR-101).

Dois modos:
  --plan                 → só carrega o doc LOCAL e imprime o plano de fatias (GRÁTIS, sem LLM).
                           Diz o fator de paralelismo (1 fatia = concorrência não ajuda).
  --run --conc N         → roda run_extraction de verdade (LLM) com EXTRACTOR_CONCURRENCY=N,
                           cronometra, e confere gates + valores-âncora. Contexto (mapa) vem do DB.

Uso (de agent/, venv ativa, PYTHONPATH=.):
  python -m scripts.validate_onda_c --plan
  python -m scripts.validate_onda_c --run --conc 4
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time

LOCAL_XLSX = "/Users/mateusmilagre/Downloads/BR-101_Macae_Histogramas_BDI_Prazos_45.xlsx"
NOME_HINT = "BR-101"  # casa nome_original no DB via ilike


def _p(m=""):
    print(m, flush=True)


def _load_local_doc():
    from agents.extracao.doc_tools import DocContext
    import os
    with open(LOCAL_XLSX, "rb") as f:
        data = f.read()
    return DocContext(os.path.basename(LOCAL_XLSX), data), data


def cmd_plan():
    from agents.extracao.runner import plan_scopes
    doc, data = _load_local_doc()
    _p(f"=== {LOCAL_XLSX.split('/')[-1]} · {len(data)/1024:.0f} KB · ext={doc.ext} ===")
    scopes = plan_scopes(doc)
    _p(f"\nPLANO: {len(scopes)} fatia(s)")
    from collections import Counter
    kinds = Counter(s.get("kind") for s in scopes)
    for k, n in kinds.items():
        _p(f"  · kind={k}: {n}")
    for i, s in enumerate(scopes):
        det = {k: v for k, v in s.items() if k != "kind"}
        _p(f"  [{i:2d}] {s.get('kind'):12s} {det}")
    _p(f"\n→ concorrência ÚTIL até {len(scopes)} fatias. Com EXTRACTOR_CONCURRENCY=4, "
       f"~{(len(scopes)+3)//4} ondas (vs {len(scopes)} sequenciais).")
    doc.close()


async def cmd_run(conc: int, preflight: bool = False):
    import config
    config.EXTRACTOR_CONCURRENCY = conc
    # runner já importou o nome — repatch no módulo do runner também
    from agents.extracao import runner as R
    R.EXTRACTOR_CONCURRENCY = conc

    from services.supabase_client import supabase
    from services.queue import load_latest_contexto
    from agents.extracao.doc_tools import DocContext

    rows = supabase.table("obra_arquivos").select("*").ilike("nome_original", f"%{NOME_HINT}%").execute().data
    if not rows:
        _p(f"✗ nenhum obra_arquivos com nome_original ~ '{NOME_HINT}'. Abortando.")
        return
    row = rows[0]
    nome = row["nome_original"]
    ctx = load_latest_contexto(row["id"]) or {}
    doc_type = ctx.get("doc_type") or row.get("doc_type") or "Documento"
    _p(f"=== RUN · {nome} · doc_type={doc_type} · conc={conc} ===")
    _p(f"  contexto: context_md={len(ctx.get('context_md') or '')} chars · "
       f"structure keys={list((ctx.get('structure') or {}).keys())[:8]}")
    if preflight:
        _p("\n✓ PREFLIGHT OK — DB respondeu, arquivo + contexto carregam. Pronto p/ --run.")
        return

    with open(LOCAL_XLSX, "rb") as f:
        data = f.read()
    doc = DocContext(nome, data)

    from agents.extracao.runner import run_extraction
    t0 = time.monotonic()
    res = await run_extraction(doc, doc_type, ctx.get("context_md") or "", ctx.get("structure") or {})
    dt = time.monotonic() - t0

    secoes = res.payload.get("secoes", [])
    _p(f"\n--- RESULTADO ({dt:.1f}s = {dt/60:.1f} min) ---")
    _p(f"  needs_review = {res.needs_review}")
    _p(f"  review_reasons ({len(res.review_reasons)}):")
    for r in res.review_reasons[:12]:
        _p(f"    · {r}")
    _p(f"  seções: {len(secoes)} · passadas(runs): {len(res.runs)}")
    for s in secoes:
        n = len(s.get("linhas", [])) if isinstance(s.get("linhas"), list) else "-"
        _p(f"    · {str(s.get('titulo'))[:48]:48s} [{s.get('tipo')}] linhas={n}")

    # Âncora: o PV total do BR-101 ≈ 611.357.315 (triangulado em 3 fontes no chat-adm).
    blob = repr(res.payload)
    for anchor in ("611357315", "611.357.315", "611357314"):
        if anchor in blob.replace(",", "").replace(" ", ""):
            _p(f"  ✓ âncora PV intacta no envelope: {anchor}")
            break
    else:
        _p("  ⚠ âncora PV 611.357.315 NÃO localizada por string crua (pode estar em outra escala/agregação)")

    # ── VALIDAÇÃO DO BACKSTOP (Fase 1 · fidelidade) ──────────────────────────────
    _p("\n--- BACKSTOP determinístico (matrizes anônimas) ---")
    alertas = res.payload.get("alertas_extracao", [])
    bs_alerta = [a for a in alertas if a.startswith("backstop:")]
    bs_secoes = [s for s in secoes if "não-rotulado" in (s.get("titulo") or "")]
    _p(f"  alerta: {(bs_alerta[0][:200] if bs_alerta else '(nenhum bloco auto-ingerido)')}")
    _p(f"  seções backstop no envelope: {len(bs_secoes)}")
    for s in bs_secoes[:12]:
        _p(f"    · {str(s.get('titulo'))[:58]} ({len(s.get('linhas', []))} linhas)")
    # ANTI-TEATRO: sobrevivem ao capturar_secoes (= persistiriam no banco)?
    try:
        from agents.normalizacao.resolvers import capturar_secoes
        cap = capturar_secoes(secoes)
        cap_bs = [c for c in cap if "não-rotulado" in c["titulo"]]
        codigos = sorted({c["codigo"] for c in cap_bs if c.get("codigo")})
        _p(f"  ✓ sobrevivem ao capturar_secoes: {len(cap_bs)}/{len(bs_secoes)} (codigos={codigos}) — persistiriam no banco")
        c14 = [c for c in cap_bs if c.get("codigo") == "C.14"]
        c14_tem_ancora = any("3595996" in repr(c["dados"]).replace(".", "").replace(",", "") for c in c14)
        _p(f"  ✓ C.14 matrizes capturadas: {len(c14)} · valor-âncora 3.595.996 presente: {c14_tem_ancora}")
    except Exception as e:  # noqa: BLE001
        _p(f"  ⚠ capturar_secoes falhou: {type(e).__name__}: {e}")
    # FONTE órfãs PÓS-backstop (deve cair perto de 0; eram ~1336 antes do honest-zero+backstop)
    try:
        from agents.extracao.cobertura import cobertura_de_doc
        cov = cobertura_de_doc(doc, res.payload)
        _p(f"  FONTE órfãs pós-backstop: {cov['total_numericas']} numéricas (eram ~1336) · "
           f"zero(alerta): {cov.get('total_numericas_zero')} · derivadas(alerta): {cov.get('total_numericas_derivadas')}")
    except Exception as e:  # noqa: BLE001
        _p(f"  ⚠ gate pós-backstop falhou: {type(e).__name__}: {e}")
    doc.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--preflight", action="store_true")
    ap.add_argument("--conc", type=int, default=4)
    a = ap.parse_args()
    if a.plan:
        cmd_plan()
    elif a.preflight:
        asyncio.run(cmd_run(a.conc, preflight=True))
    elif a.run:
        asyncio.run(cmd_run(a.conc))
    else:
        ap.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
