"""Carrega .env em variáveis · falha cedo no boot se faltar o essencial."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

# ── Supabase ───────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# ── Auth front → agente ────────────────────────────────────────────
VPS_SECRET = os.getenv("VPS_SECRET", "")

# ── Auth do Claude ─────────────────────────────────────────────────
# Único interruptor: se ANTHROPIC_API_KEY existe → API (prod). Senão →
# OAuth do Claude Code CLI (dev local, assinatura Max). O claude-agent-sdk
# lê ANTHROPIC_API_KEY do ambiente automaticamente.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_AUTH_MODE = "api_key" if ANTHROPIC_API_KEY else "oauth_cli"

# Modelo PADRÃO de todas as fases com LLM (mapeamento, extração, verifier, reconciler,
# IA do adm_contratual). Opus 4.8 SEMPRE — é o mais capaz e no OAuth (dev) o custo é zero;
# em prod o ganho de precisão vale o custo ("erro nos valores custa milhões"). Todos os
# *_MODEL abaixo cascateiam deste. Override por env var só se houver razão explícita.
AGENT_MODEL = os.getenv("AGENT_MODEL", "claude-opus-4-8")

# ── Mapeador de documentos (worker/job) ────────────────────────────
# O mapeador lê os brutos em obra_arquivos (status='raw') e gera o
# "texto-mapa" de cada um, persistindo em obra_arquivo_contextos.
RMA_BUCKET = os.getenv("RMA_BUCKET", "rma-docs")
# Modelo do mapeamento · herda AGENT_MODEL (Opus 4.8 por padrão).
MAPPER_MODEL = os.getenv("MAPPER_MODEL", AGENT_MODEL)
# Lease da fila (min) · precisa bater com a janela da RPC acquire_arquivo_lease.
LEASE_TIMEOUT_MIN = int(os.getenv("LEASE_TIMEOUT_MIN", "10"))
# Intervalo de polling quando a fila está vazia (s).
POLL_INTERVAL_SEC = float(os.getenv("POLL_INTERVAL_SEC", "3"))
# CHAT (Adm Contratual IA) · teto de timeout por resposta (s) — sem isso, uma chamada Claude
# travada deixa a mensagem presa em "thinking" pra sempre.
CHAT_TIMEOUT_SEC = float(os.getenv("CHAT_TIMEOUT_SEC", "180"))
# Teto de /ask simultâneos (cada um sobe um subprocesso Node pesado) — protege o Droplet de OOM.
CHAT_MAX_CONCURRENCY = int(os.getenv("CHAT_MAX_CONCURRENCY", "2"))
# Teto de tamanho do arquivo (MB) · acima disso vai pra needs_review.
MAX_FILE_MB = float(os.getenv("MAX_FILE_MB", "40"))
# Teto de caracteres das amostras injetadas no prompt (bound de contexto).
MAX_SAMPLE_CHARS = int(os.getenv("MAX_SAMPLE_CHARS", "16000"))
# Teto MAIOR p/ workbook-motor (planilha multi-aba com índice): com auth=oauth_cli o custo de
# token é ZERO (assinatura) e o Opus tem 200K de contexto — então cabe o Guia/MAPA inteiro + o
# inventário das N abas, sem o gargalo dos 16K. Só vale pro caminho XLSX multi-aba (>6 sheets).
MAX_SAMPLE_CHARS_WORKBOOK = int(os.getenv("MAX_SAMPLE_CHARS_WORKBOOK", "60000"))
# A RPC usa `attempts < 3` fixo · espelhamos pra logs/relatório.
MAX_ATTEMPTS = int(os.getenv("MAX_ATTEMPTS", "3"))

# ── Extrator (Fase 2) ──────────────────────────────────────────────
# Herda o modelo do mapper (Opus 4.8 por padrão). A extração é a fase de maior risco
# numérico — Opus é o piso.
EXTRACTOR_MODEL = os.getenv("EXTRACTOR_MODEL", MAPPER_MODEL)
RECONCILER_MODEL = os.getenv("RECONCILER_MODEL", EXTRACTOR_MODEL)
VERIFIER_MODEL = os.getenv("VERIFIER_MODEL", EXTRACTOR_MODEL)
# Turnos máximos por CHAMADA de extração. Alto de propósito: o envelope é montado
# por muitas tool-calls (anexar_linhas em lotes) → muitos turnos é o normal agora.
EXTRACTOR_MAX_TURNS = int(os.getenv("EXTRACTOR_MAX_TURNS", "220"))
# Teto de linhas por leitura de range XLSX (a tool corta acima disso).
XLSX_RANGE_MAX_ROWS = int(os.getenv("XLSX_RANGE_MAX_ROWS", "500"))
# Teto de linhas por chamada de `ingerir_planilha` (ingestão determinística · lê
# células em código). Alto: a ingestão não gasta tokens de saída por linha. Acima
# disso a tool corta e pede pra continuar a partir da próxima linha.
INGEST_MAX_ROWS = int(os.getenv("INGEST_MAX_ROWS", "50000"))
# Teto TOTAL de linhas por documento — só uma REDE DE SEGURANÇA contra blob absurdo
# (fail-loud em vez de OOM), bem alto pra não limitar uso normal. Ajuste se precisar.
INGEST_MAX_TOTAL_ROWS = int(os.getenv("INGEST_MAX_TOTAL_ROWS", "1000000"))
# Verifier (QA · relê o doc e confere o envelope). Custa +1 chamada por doc.
EXTRACTOR_VERIFY = os.getenv("EXTRACTOR_VERIFY", "1").strip().lower() not in ("0", "false", "no", "off")
# Reconciliação por DUPLA-PASSADA em docs CRÍTICOS (BM/Medição/Cronograma): roda a
# extração 2x e exige que concordem. DESLIGADA por padrão — é REDUNDANTE nos caminhos
# DETERMINÍSTICOS (planilha/find_tables: o valor vem do código, não do modelo, então a 2ª
# passada só repete) e a variação de orquestração do modelo entre passadas gerava falso
# 'divergência de núcleo' → needs_review à toa. A QA de passada única (sanity total↔TOTAL,
# audit_ingested, guard de coluna deslocada, garbled) + o verifier já é forte. Religue com
# EXTRACTOR_RECONCILE=1 se for ler PDF ESCANEADO por VISÃO (aí a 2ª passada pega misread real).
EXTRACTOR_RECONCILE = os.getenv("EXTRACTOR_RECONCILE", "0").strip().lower() not in ("0", "false", "no", "off")
# ── Plano de fatiamento (evita estourar contexto de ENTRADA em docs enormes) ──
# PDF até N páginas → 1 chamada; acima, fatia por faixas de páginas.
PDF_WHOLE_MAX_PAGES = int(os.getenv("PDF_WHOLE_MAX_PAGES", "30"))
PDF_PAGES_PER_SLICE = int(os.getenv("PDF_PAGES_PER_SLICE", "10"))
# Planilha até N células (Σ linhas×colunas) → 1 chamada; acima, fatia por sheet.
XLSX_WHOLE_MAX_CELLS = int(os.getenv("XLSX_WHOLE_MAX_CELLS", "4000"))
# Workbook multi-aba: até N abas → 1 chamada; acima, fatia em GRUPOS de abas (a aritmética
# de 81 abas numa chamada só encostava no teto de turnos e derrubava p/ needs_review).
XLSX_WHOLE_MAX_SHEETS = int(os.getenv("XLSX_WHOLE_MAX_SHEETS", "16"))
XLSX_SHEETS_PER_SLICE = int(os.getenv("XLSX_SHEETS_PER_SLICE", "8"))
# Sheet com mais que N células → fatia em janelas de linhas (≈ N células/janela).
SHEET_SLICE_CELLS = int(os.getenv("SHEET_SLICE_CELLS", "12000"))
# Teto de fatias por documento (guarda contra explosão · acima → needs_review).
EXTRACTOR_MAX_SLICES = int(os.getenv("EXTRACTOR_MAX_SLICES", "60"))
# Concorrência das fatias de UM documento (asyncio.gather + semáforo). 1 = sequencial (caminho
# legado, byte-idêntico ao paralelo — provado por agents/extracao/test_runner_concorrencia.py).
# >1 paraleliza as chamadas do extrator → ganho de wall-clock em docs com muitas fatias (2h→~15min).
# É SEGURO: as tools de montagem (submit_tools) são corrotinas síncronas (atômicas sob asyncio) e a
# ordem das seções é reconstruída por (scope_order, seq) no build(). Subir se a cota da API permitir.
EXTRACTOR_CONCURRENCY = int(os.getenv("EXTRACTOR_CONCURRENCY", "4"))
# Fase 2a · após o backstop auto-ingerir uma matriz anônima, um passe do modelo dá NOMES DE COLUNA
# reais (só p/ auditoria/legibilidade — nunca valores, nunca título → seção segue captura-only). 1
# query LLM por bloco auto-ingerido; falha → mantém genérico. =0 desliga (extração determinística pura).
EXTRACTOR_RENAME_BACKSTOP = os.getenv("EXTRACTOR_RENAME_BACKSTOP", "1").strip().lower() not in ("0", "false", "no", "off")
# Escala de rasterização do PDF p/ visão (2.0 ≈ 144dpi · bom p/ tabela).
PDF_RASTER_SCALE = float(os.getenv("PDF_RASTER_SCALE", "2.0"))
# Idioma do OCR (tesseract). Precisa do traineddata correspondente no host.
OCR_LANG = os.getenv("OCR_LANG", "por")

# ── Servidor ───────────────────────────────────────────────────────
CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",") if o.strip()
]
PORT = int(os.getenv("PORT", "8000"))


def assert_ready() -> None:
    """Valida o mínimo pra subir. Chamado no startup do main.py."""
    missing = [
        name
        for name, val in (
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY),
            ("VPS_SECRET", VPS_SECRET),
        )
        if not val
    ]
    if missing:
        raise RuntimeError(
            f"Config incompleta · defina no agent/.env: {', '.join(missing)} "
            f"(veja agent/.env.example)"
        )
