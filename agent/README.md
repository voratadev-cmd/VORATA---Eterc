# Adm Contratual IA · Agent Runner (FastAPI + claude-agent-sdk)

Backend Python dos agentes Claude do produto. Hospeda dois fluxos:

1. **Chat/insights** "Adm Contratual IA" — API FastAPI, streaming via Realtime.
2. **Mapeamento de documentos (Fase 1)** — job que lê os brutos em
   `obra_arquivos` (status `raw`) e gera o "texto-mapa" de cada um
   (`agents/mapeamento/`). Roda a mesma fila/RPC/tabelas do pipeline.

Ambos usam **`claude-agent-sdk`** → no dev, **OAuth do Claude Code CLI**
(assinatura · custo zero). Por que aqui e não no `worker/` TS: o
`claude-agent-sdk` (único caminho OAuth) exige `zod@4`, e o worker é `zod@3` —
o agente Python roda OAuth sem esse conflito. Segue o `GUIA-AGENTE-VPS.md`.

> **Fase atual:** estrutura/scaffold pronta pra rodar local. A persona/regras reais
> do agente entram numa fase seguinte (`agents/adm_contratual/persona.py` é stub).

## Stack

- **FastAPI** (HTTP) + **uvicorn**
- **claude-agent-sdk** (Python) → Claude
- **Supabase** (service_role escreve; front lê via anon + Realtime)

## Auth do Claude — o interruptor

- **Dev local:** deixe `ANTHROPIC_API_KEY` **vazio** → o SDK usa o **OAuth do Claude Code CLI**
  (você já está logado · custo zero de token via assinatura).
- **Produção (VPS):** defina `ANTHROPIC_API_KEY` → usa a **API** (paga por token, sancionado
  pra uso comercial, escala). Único interruptor: setou a key = modo API.

## Rodar local (passo a passo)

```bash
cd agent

# 1) Python 3.11+ (o SDK exige 3.10+; o macOS vem com 3.9 — use pyenv/brew)
python3.11 -m venv venv && source venv/bin/activate

# 2) Dependências
pip install -r requirements.txt

# 3) Claude Code CLI logado (modo OAuth dev · custo zero)
#    Se ainda não tem: instale o Claude Code e rode `claude login`.
claude -p "responda: ok"        # teste — deve responder sem API key

# 4) Config
cp .env.example .env
#    edite agent/.env:
#    - SUPABASE_SERVICE_KEY = a "Secret key" (sb_secret_...) do painel Supabase
#    - VPS_SECRET = um segredo forte qualquer
#    - ANTHROPIC_API_KEY = DEIXE VAZIO no dev (usa OAuth)

# 5) Aplicar a migration do chat (uma vez) · usa o runner do worker:
#    (do repo root)
cd ../worker && SUPABASE_DB_URL='postgresql://postgres.SUPABASE_REF_ETERC_AQUI:<SENHA>@aws-1-us-east-1.pooler.supabase.com:5432/postgres' \
  node scripts/apply-migration.mjs ../supabase/migrations/20260601000002_adm_chat.sql
cd ../agent

# 6) Subir o servidor
uvicorn main:app --reload --port 8000
```

Teste:

```bash
curl http://localhost:8000/api/health
# → {"status":"ok","claude_auth":"oauth_cli","model":"claude-sonnet-4-5"}

curl -X POST http://localhost:8000/api/agents/adm/ask \
  -H "Authorization: Bearer <VPS_SECRET>" -H "Content-Type: application/json" \
  -d '{"visitor_id":"teste","message":"Olá, o que você faz?"}'
# → {conversation_id, message_id, status:"processing"}
# A resposta aparece nas linhas de adm_messages (streaming via UPDATE).
```

## Estrutura

```
agent/
├── config.py                 # .env → variáveis + assert_ready()
├── main.py                   # FastAPI + CORS + /api/health + include_router
├── api/auth.py               # verify_vps_secret (Bearer)
├── services/supabase_client.py   # client service_role + helpers
├── parsers/                  # amostragem de documentos (sampler)
│   └── sampler.py            # PDF/XLSX/DOCX/CSV/MD → amostra cabeça/meio/cauda
├── services/queue.py         # fila (RPC lease) + persist contexto + Storage
├── agents/adm_contratual/    # chat/insights
│   ├── schemas.py · persona.py · agent.py · service.py · router.py
└── agents/mapeamento/        # MAPEAMENTO (Fase 1)
    ├── persona.py            # system prompt do Mapper (genérico)
    ├── mapper.py             # amostra → Claude (OAuth) → texto-mapa
    └── job.py                # drena a fila obra_arquivos · `python -m agents.mapeamento.job`
```

## Mapeamento de documentos (Fase 1)

Lê cada bruto da obra, gera o texto-mapa (o que é · onde estão os dados ·
padrões · anomalias · sugestão de extração) e grava em
`obra_arquivo_contextos` com `status='mapped'` (pausa pro gate humano na
tela `/contracts/$id/mapeamento`). NÃO extrai dados — só descreve.

```bash
cd agent && source venv/bin/activate

# pré-requisito (uma vez): grants de service_role nas tabelas de extração
#   supabase/migrations/20260601000004_extraction_grants.sql

python -m agents.mapeamento.job --once     # drena a fila e sai (dev)
python -m agents.mapeamento.job            # loop contínuo (worker)
```

Processa **um por um** (sequencial). Planilhas grandes (2000+ linhas) são
amostradas (cabeçalho + início + fim + dimensões totais), nunca jogadas
inteiras no prompt. Arquivos > `MAX_FILE_MB` vão pra `needs_review`.

## Endpoints

- `GET  /api/health` — status + modo de auth
- `POST /api/agents/adm/ask` — pergunta (Bearer VPS_SECRET) · resposta via Realtime

## Próximos passos

1. **Regras reais** do agente (persona.py) + `build_data_context()` puxando a obra do Supabase.
2. **Front:** botão de chat que chama `/ask` e escuta `adm_messages` via Realtime.
3. **VPS (depois):** Droplet + systemd + nginx + certbot (ver `GUIA-AGENTE-VPS.md` §12).
   Em prod, setar `ANTHROPIC_API_KEY` (modo API).
