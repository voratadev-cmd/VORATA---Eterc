# Imagem do agente (FastAPI + jobs de mapeamento/extração).
# ─────────────────────────────────────────────────────────────────────
# O claude-agent-sdk (Python) é um WRAPPER da Claude Code CLI (Node) — então a
# imagem precisa de Python + Node + a CLI, além do tesseract (OCR de PDF
# escaneado). Em produção roda em modo API (ANTHROPIC_API_KEY setado).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NODE_MAJOR=20

# Deps de sistema: OCR (tesseract + traineddata pt), Node (p/ a Claude Code CLI), certs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg tesseract-ocr tesseract-ocr-por \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update && apt-get install -y --no-install-recommends nodejs \
 && npm install -g @anthropic-ai/claude-code \
 && apt-get purge -y curl gnupg && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Não-root com HOME gravável (a CLI grava config em ~/.claude). Cria ~/.claude com dono `agent`
# para que um volume Docker montado ali (persistência do `claude login`) herde a permissão certa.
RUN useradd -m -u 10001 agent \
 && mkdir -p /home/agent/.claude \
 && chown -R agent:agent /app /home/agent/.claude
USER agent
ENV HOME=/home/agent

EXPOSE 8000
# Default = API do chat. Os workers (mapper/extractor) sobrescrevem o run_command
# no deploy.do.yml com `python -m agents.<fase>.job`.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
