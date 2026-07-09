# Deploy do Agente "Adm Contratual IA" no Droplet (VPS · DigitalOcean)

Roda o **chat** (api) + a **pipeline de extração** (mapper/extractor) num Droplet, atrás de
HTTPS automático (Caddy). Auth do Claude = sua **assinatura** (`claude login`) ou **API key**.

> Acesso ao Droplet: **SSH** (você adiciona sua chave SSH ao criar o Droplet).

## 0. Pré-requisitos

- Um **domínio/subdomínio** (ex.: `agent.seudominio.com`) — necessário pro HTTPS (o front Vercel é
  HTTPS e o navegador bloqueia chamadas HTTP/mixed-content).
- A **service role key** do Supabase (painel → Settings → API).
- Sua **chave SSH** (`~/.ssh/id_ed25519.pub`) pra adicionar ao Droplet.

## 1. Criar o Droplet (painel DO)

- Ubuntu 22.04 LTS · **2 GB+ RAM** (a extração usa PyMuPDF/pandas; o chat sozinho roda em 1 GB).
- Em "Authentication" → **SSH Key** (cole sua pública). Anote o **IP**.

## 2. DNS

- Registro **A**: `agent.seudominio.com` → **IP do Droplet**. (Espere propagar; teste `dig`.)

## 3. SSH + Docker + firewall

```bash
ssh root@SEU_IP
# Docker + plugin compose
curl -fsSL https://get.docker.com | sh
# Firewall: só SSH + HTTP + HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Trazer o código

O repo é privado. Crie uma **deploy key read-only** (recomendado) ou use um PAT:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy -N ""   # cole ~/.ssh/deploy.pub em
                                                # GitHub → repo → Settings → Deploy keys (read-only)
GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy" \
  git clone git@github.com:voratadev-cmd/Base-Repository.git
cd Base-Repository/agent
```

## 5. Configurar o .env

```bash
cp .env.vps.example .env
nano .env     # preencha SUPABASE_SERVICE_KEY, VPS_SECRET (openssl rand -hex 32),
              # CORS_ORIGINS (URL do Vercel), AGENT_DOMAIN. Auth: ver passo 7.
chmod 600 .env
```

## 6. Subir

```bash
docker compose up -d --build
docker compose logs -f api      # deve logar "Agent runner subindo ... modelo = claude-opus-4-8"
curl -s https://AGENT_DOMAIN/api/health   # {"status":"ok",...} (após o Caddy emitir o TLS)
```

## 7. Auth do Claude (escolha um)

- **(A) Assinatura (recomendado):** `.env` SEM `ANTHROPIC_API_KEY` e COM `CLAUDE_CONFIG_DIR=/home/agent/.claude` (já no exemplo — garante que o login persista no volume). Ordem correta:
  ```bash
  docker compose up -d --build             # api sobe ok; mapper/extractor vão REINICIAR em loop
                                           #   até o login (normal — só drenam fila após o login)
  docker compose exec api claude login     # autentica na sua conta; persiste no volume
  docker compose restart api mapper extractor
  ```
- **(B) API key:** preencha `ANTHROPIC_API_KEY` no `.env` e `docker compose up -d --build` (sem crash-loop).

## 8. Ligar o front (Vercel)

No projeto Vercel → Settings → Environment Variables:

- `VITE_API_URL` = `https://AGENT_DOMAIN`
- `VITE_ADM_BEARER` = o **mesmo** valor do `VPS_SECRET`
- Redeploy do front.

## 9. Atualizar (a cada push na main)

```bash
cd ~/Base-Repository && GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy" git pull
cd agent && docker compose up -d --build
```

## Operação

- Logs: `docker compose logs -f api` (ou `mapper`/`extractor`).
- Reiniciar: `docker compose restart api`.
- ⚠️ **Só 1 instância** de `mapper` e `extractor` (dois processos brigam pela fila).
- ⚠️ Backup do `claude login`: vive no volume `claude_config` (não apague).

## Segurança — VEREDITO (revisão adversarial)

**OK para PILOTO FECHADO (um cliente/usuários de confiança). NÃO para produção multi-cliente com
dado real exposto** — sem os 3 itens de go-live abaixo. Base sólida: Bearer constant-time, TLS,
CORS travado, segredos fora do git, todos os endpoints autenticados (só `/api/health` aberto).

**Gates de go-live multi-cliente (TÊM que mudar antes de expor dado real de vários clientes):**

1. **Autorização por obra (CRÍTICO · LGPD).** Hoje o `/ask` recebe `obra_id` do cliente e lê com a
   **service role** (bypassa RLS), sem checar se o solicitante tem direito àquela obra. Com o Bearer
   público, dá pra ler dados de **qualquer** obra variando o UUID (IDOR). Fix: validar o **JWT do
   Supabase Auth** do usuário + checar vínculo usuário↔obra (ou ler o contexto com o JWT do usuário,
   sujeito a RLS — não com service_role).
2. **Tirar o segredo do bundle.** `VITE_ADM_BEARER` é inlined no JS do Vercel (público). Mover
   `/ask`, `/sinteses/regerar`, `/relatorios/gerar` pra trás de uma Edge/Vercel function que injeta
   o Bearer server-side e repassa o JWT do usuário.
3. **Rate limit.** Sem limite, o Bearer público permite drenar tokens Claude (cada `/ask` roda Opus
   4.8) e DoS no Droplet. Adicionar rate-limit por IP/usuário (Caddy com plugin rate_limit ou
   `slowapi` no FastAPI) + teto de gasto na conta Anthropic.

**Pra o piloto (controlável):** `.env` `chmod 600`, firewall 22/80/443, SSH só por chave, Droplet
só seu. ⚠️ A service key é do **MESMO projeto Supabase do app real** (`SUPABASE_REF_ETERC_AQUI`) — um
RCE no agente expõe os dados de produção. Para produção, considerar projeto/keys Supabase separados.
