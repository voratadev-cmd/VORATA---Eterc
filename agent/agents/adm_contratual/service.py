"""Orquestração on-demand do chat + streaming via UPDATEs no Supabase.

Fluxo (guia §4): insere msg do user → insere placeholder do agente →
dispara background → retorna na hora. O background streama e vai dando
UPDATE no `content`; o front escuta via Supabase Realtime.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import threading
import time
from typing import Optional

from fastapi import HTTPException

from agents.adm_contratual.agent import stream_response
from agents.adm_contratual.contexto import build_data_context
from agents.adm_contratual.persona import ADM_SYSTEM_PROMPT
from agents.adm_contratual.validador import _flatten_numeros, validar_ancoragem
from config import CHAT_MAX_CONCURRENCY, CHAT_TIMEOUT_SEC
from services.supabase_client import supabase

CONVERSATIONS = "adm_conversations"
MESSAGES = "adm_messages"

# Teto de /ask simultâneos (process-wide). Cada resposta sobe um subprocesso Node pesado; sem teto,
# alguns chats simultâneos estouram a RAM do Droplet. threading (não asyncio) porque cada background
# roda no seu próprio event-loop/thread (não há um loop comum p/ um asyncio.Semaphore coordenar).
_CHAT_SEM = threading.BoundedSemaphore(CHAT_MAX_CONCURRENCY)

# ── Insights (painel "Dados-chave") · derivados dos RETORNOS das tools (nunca do texto do modelo) ──
_FAROL_TOM = {"conforme": "success", "observacao": "info", "observação": "info",
              "risco": "warning", "critico": "danger", "crítico": "danger"}


def _farol_to_tom(farol) -> str:  # noqa: ANN001
    """Farol ('● Crítico'/'critico'/…) → tom do DS (1:1 com InsightTom da UI). Default neutral."""
    s = str(farol or "").lower()
    for nivel, tom in _FAROL_TOM.items():
        if nivel in s:
            return tom
    return "neutral"


def _mi(v) -> str:  # noqa: ANN001
    """R$ legível p/ o chip: 'mi' acima de 1 milhão, 'mil' acima de 1 mil, cheio abaixo."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    if abs(f) >= 1e6:
        s = f"R$ {f / 1e6:,.1f} mi"
    elif abs(f) >= 1e3:
        s = f"R$ {f / 1e3:,.0f} mil"
    else:
        s = f"R$ {f:,.0f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _frac_pct(v) -> str:  # noqa: ANN001
    try:
        return f"{float(v) * 100:.0f}%"
    except (TypeError, ValueError):
        return str(v)


def _payload_insights(p: dict) -> list[dict]:
    """Insights {label, valor, tom} detectados pela FORMA do payload da tool — NÃO pelo nome (o
    pareamento por ordem é frágil com tools do harness, ex.: ToolSearch, cujo result não vem como
    ToolResultBlock). O VALOR vem do retorno CONSERVADO da tool, nunca do texto do modelo. Cada
    payload casa só o seu domínio (chaves distintas)."""
    if not isinstance(p, dict) or p.get("disponivel") is False or p.get("encontrado") is False:
        return []
    o: list[dict] = []
    tom = _farol_to_tom(p.get("farol"))
    if p.get("realizado_acumulado_rs") is not None:  # faturamento
        o.append({"label": "Real acumulado", "valor": _mi(p["realizado_acumulado_rs"]), "tom": tom})
        d = p.get("desvio_acumulado_frac", p.get("desvio_faturamento_pp"))
        if d is not None:
            o.append(
                {"label": "Desvio acum.", "valor": _frac_pct(d) if abs(float(d)) <= 2 else f"{d} pp", "tom": tom}
            )
    if p.get("total_rs") is not None and "n_categorias" in p:  # desequilíbrio (D.0)
        o.append({"label": "Desequilíbrio total", "valor": _mi(p["total_rs"]), "tom": "warning"})
    if p.get("soma_impedido_rs") is not None:  # mapa de liberação
        o.append({"label": "Impedido", "valor": _mi(p["soma_impedido_rs"]), "tom": "warning"})
    if p.get("maior_gap_rs") is not None and "curva_mais_baixa" in p:  # curvas
        o.append(
            {"label": f"Gargalo · {p.get('curva_mais_baixa', '')}".strip(" ·"),
             "valor": _mi(p["maior_gap_rs"]), "tom": "warning"}
        )
    if p.get("impedido_total_rs") is not None:  # chuvas
        o.append({"label": "Impedido (chuva/sinistro)", "valor": _mi(p["impedido_total_rs"]), "tom": "warning"})
    if p.get("aderencia_hh_pct") is not None:  # produtividade econômica
        o.append({"label": "Aderência HH", "valor": f"{p['aderencia_hh_pct']}%", "tom": "neutral"})
    if p.get("valor_orcado_total_rs") is not None:  # insumos
        o.append({"label": "Insumos (orçado)", "valor": _mi(p["valor_orcado_total_rs"]), "tom": "neutral"})
    if p.get("markup_total") is not None:  # BDI
        o.append({"label": "Markup BDI", "valor": _mi(p["markup_total"]), "tom": "neutral"})
    cats = p.get("categorias")  # recursos (MOD)
    mod = cats.get("MOD") if isinstance(cats, dict) else None
    if isinstance(mod, dict) and mod.get("contratadoRs") is not None:
        o.append({"label": "MOD contratado", "valor": _mi(mod["contratadoRs"]), "tom": "neutral"})
    if p.get("consolidado_label"):  # panorama
        suf = " (parcial)" if p.get("consolidado_status") == "parcial" else ""
        o.append(
            {"label": "Situação geral", "valor": str(p["consolidado_label"]) + suf,
             "tom": _farol_to_tom(p.get("consolidado"))}
        )
    # ── tools de cobertura (condutas/plano/detalhe D.x/pontuais/excedente) — chips do painel ──
    if p.get("n_condutas") is not None:  # condutas (C.11)
        nu = int(p.get("n_urgentes") or 0)
        o.append({"label": "Condutas", "valor": f"{int(p['n_condutas'])}" + (f" · {nu} urgentes" if nu else ""),
                  "tom": "warning" if nu else "neutral"})
    rsmo = p.get("resumo")  # plano de ação (C.12)
    if isinstance(rsmo, dict) and rsmo.get("atrasadas") is not None:
        atr = int(rsmo.get("atrasadas") or 0)
        o.append({"label": "Plano de ação",
                  "valor": f"{int(rsmo.get('total') or 0)} ações" + (f" · {atr} atrasadas" if atr else ""),
                  "tom": _farol_to_tom(rsmo.get("farol_label") or rsmo.get("farol_nivel"))})
    if p.get("desequilibrio_total") is not None and p.get("adm_local_cheio") is not None:  # D.1 detalhe
        o.append({"label": "Indiretos · extensão (D.1)", "valor": _mi(p["desequilibrio_total"]), "tom": "warning"})
    if p.get("desequilibrio_total_rs") is not None and p.get("pv_rs") is not None:  # D.2 BDI deseq
        o.append({"label": "Deseq. BDI (D.2)", "valor": _mi(p["desequilibrio_total_rs"]),
                  "tom": _farol_to_tom(p.get("farol"))})
    tot_va = p.get("total")  # D.4 valor agregado
    if isinstance(tot_va, dict) and tot_va.get("perda_rs") is not None:
        o.append({"label": "Perda VA (D.4)", "valor": _mi(tot_va["perda_rs"]),
                  "tom": _farol_to_tom(p.get("farol_total") or tot_va.get("farol"))})
    par = p.get("params")  # D.6 pontuais
    if p.get("n_eventos") is not None and isinstance(par, dict) and par.get("pendente_total_rs") is not None:
        o.append({"label": "Pontuais · pendente (D.6)", "valor": _mi(par["pendente_total_rs"]), "tom": "warning"})
    if p.get("total_delta_rs") is not None:  # D.5 excedente de insumos (cl. 8.8)
        o.append({"label": "Excedente insumos (8.8)", "valor": _mi(p["total_delta_rs"]),
                  "tom": _farol_to_tom(p.get("farol"))})
    if p.get("baseFolhaRs") is not None and p.get("n_rubricas") is not None:  # D.3 encargos
        o.append({"label": "Base folha (encargos)", "valor": _mi(p["baseFolhaRs"]), "tom": "neutral"})
    return o


# ── conversa / mensagens ───────────────────────────────────────────
def _get_or_create_conversation(visitor_id: str, conversation_id: Optional[str], obra_id) -> dict:
    if conversation_id:
        r = supabase.table(CONVERSATIONS).select("*").eq("id", conversation_id).limit(1).execute()
        if r.data:
            conv = r.data[0]
            # Não pertence a quem pediu → 403 (antes criava conversa nova em silêncio).
            if conv.get("visitor_id") != visitor_id:
                raise HTTPException(status_code=403, detail="Conversa não pertence a este solicitante")
            return conv
        # conversation_id inexistente → cria nova (tolerante).
    ins = supabase.table(CONVERSATIONS).insert({"visitor_id": visitor_id, "obra_id": obra_id}).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Falha ao criar conversa")
    return ins.data[0]


def _get_history(conversation_id: str, limit: int = 20) -> list[dict]:
    r = (
        supabase.table(MESSAGES)
        .select("id, role, content, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return r.data or []


def _insert_message(conv_id: str, role: str, content: str = "", streaming: bool = False, metadata=None) -> dict:
    return (
        supabase.table(MESSAGES)
        .insert(
            {
                "conversation_id": conv_id,
                "role": role,
                "content": content,
                "streaming": streaming,
                "metadata": metadata or {},
            }
        )
        .execute()
        .data[0]
    )


def _update_message(msg_id: str, **fields) -> None:
    supabase.table(MESSAGES).update(fields).eq("id", msg_id).execute()


def reap_stuck_messages() -> int:
    """Mensagens órfãs em streaming=True (deploy/restart/OOM/timeout com chat em voo) → marca
    'error', pra UI não ficar em "pensando" pra sempre. Chamado no startup da api (instância única:
    no boot, qualquer streaming=True é de um processo anterior que já morreu)."""
    try:
        r = (
            supabase.table(MESSAGES)
            .update(
                {
                    "streaming": False,
                    "content": "Resposta interrompida (reinício do serviço). Reenvie a pergunta.",
                    "metadata": {"status": "error"},
                }
            )
            .eq("streaming", True)
            .execute()
        )
        return len(r.data or [])
    except Exception:  # noqa: BLE001 — reaper best-effort, nunca derruba o startup
        return 0


# ── entry point (chamado pelo router) ──────────────────────────────
async def ask(visitor_id: str, message: str, background_tasks, conversation_id=None, obra_id=None) -> dict:
    conv = _get_or_create_conversation(visitor_id, conversation_id, obra_id)
    _insert_message(conv["id"], "user", message)
    placeholder = _insert_message(conv["id"], "ai", "", streaming=True, metadata={"status": "thinking"})
    background_tasks.add_task(_run_in_background, conv["id"], message, placeholder["id"], obra_id)
    return {"conversation_id": conv["id"], "message_id": placeholder["id"], "status": "processing"}


# ── background (sync → abre event loop próprio · guia §14) ──────────
def _run_in_background(conv_id: str, message: str, msg_id: str, obra_id) -> None:
    # Teto de concorrência: espera uma vaga até CHAT_TIMEOUT_SEC; sem vaga, devolve "ocupado"
    # em vez de subir mais um subprocesso e arriscar OOM.
    if not _CHAT_SEM.acquire(timeout=CHAT_TIMEOUT_SEC):
        _update_message(
            msg_id,
            content="O assistente está ocupado no momento — reenvie a pergunta em alguns instantes.",
            streaming=False,
            metadata={"status": "error"},
        )
        return
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run(conv_id, message, msg_id, obra_id))
        finally:
            loop.close()
    finally:
        _CHAT_SEM.release()


async def _run(conv_id: str, message: str, msg_id: str, obra_id) -> None:
    acc = ""
    trace_parts: list[str] = []  # raciocínio + tools usadas → vira o "thinking" da UI
    tools_usadas: list[str] = []
    insights: list[dict] = []
    payloads: list[dict] = []  # JSONs que as tools devolveram → âncora do gate + fatos_hash
    err: str | None = None
    t0 = time.monotonic()
    try:
        # Contexto/histórico DENTRO do try: se a leitura do Supabase falhar, vira status='error'
        # (antes ficavam fora do try → a exceção era engolida e a msg ficava presa em "thinking").
        data_context = build_data_context(obra_id)
        # replace (não .format) — dado real da obra pode conter `{` `}`.
        system_prompt = ADM_SYSTEM_PROMPT.replace("«DATA_CONTEXT»", data_context)
        history = _get_history(conv_id)
        hist_txt = "\n".join(f'{m["role"]}: {m["content"]}' for m in history if m["id"] != msg_id)
        user_prompt = (f"Histórico:\n{hist_txt}\n\n" if hist_txt else "") + f"Pergunta atual: {message}"
        # NÃO dá return/break dentro do async for (gotcha do SDK: abandona o gerador a meio).
        # Timeout duro: uma chamada Claude travada (rede estanca no meio do stream) não pode
        # pendurar a mensagem pra sempre nem segurar a vaga do semáforo.
        async with asyncio.timeout(CHAT_TIMEOUT_SEC):
            async for ev in stream_response(user_prompt, system_prompt, obra_id):
                if ev["type"] == "text":
                    acc += ev["content"]
                    _update_message(
                        msg_id, content=acc, streaming=True,
                        metadata={"status": "streaming", "thinking_trace": " ".join(trace_parts)[:1200]},
                    )
                elif ev["type"] in ("thinking", "tool_use"):
                    trace_parts.append(ev["content"])
                    if ev["type"] == "tool_use":
                        nome = ev["content"].replace("Usando:", "").strip()
                        if nome and nome not in tools_usadas:
                            tools_usadas.append(nome)
                    _update_message(
                        msg_id, content=acc, streaming=True,
                        metadata={"status": "thinking", "thinking_trace": " ".join(trace_parts)[:1200]},
                    )
                elif ev["type"] == "tool_result":
                    # o JSON que a tool DEVOLVEU → insights (pela FORMA do payload) + âncora do gate.
                    try:
                        payload = json.loads(ev["content"])
                    except (ValueError, TypeError):
                        payload = None
                    if isinstance(payload, dict):
                        payloads.append(payload)
                        insights.extend(_payload_insights(payload))
                elif ev["type"] == "error":
                    err = ev["content"]
    except (asyncio.TimeoutError, TimeoutError):
        err = "tempo esgotado — a consulta demorou demais. Reenvie a pergunta."
    except Exception as e:  # noqa: BLE001
        err = f"interno: {str(e)[:500]}"

    if err:
        _update_message(msg_id, content=f"Erro: {err}", streaming=False, metadata={"status": "error"})
        return

    # GATE DE ANCORAGEM (honestidade): todo R$/% da resposta tem que existir nos RETORNOS das tools.
    # Âncora expandida com ×100/÷100 — a fonte mistura fração e % (card guarda -0.5, a IA diz -50%),
    # senão o gate viraria falso-positivo. Observabilidade (não bloqueia): grava ancorado/suspeitos.
    base = _flatten_numeros({"p": payloads}) if payloads else []
    # Expande a âncora p/ cobrir as várias formas que o modelo escreve o MESMO valor: % (×/÷100) e
    # abreviação em milhão/mil ("R$ 20,52M" / "R$ 41 mil" do número cheio 20.522.771 / 41.045.543).
    # Sem isso o gate falso-positiva números legítimos só pela notação.
    anchors = list(base)
    for f in (100.0, 0.01, 1e6, 1e-6, 1e3, 1e-3):
        anchors += [n * f for n in base if n]
    # ABS também: o modelo larga o sinal (escreve "54%" pro desvio −54,19%; "−54%" e "54%" são o MESMO
    # fato). Sem o abs, o gate falso-positivava % legítimos só pela ausência do sinal.
    anchors += [abs(n) for n in anchors]
    val = validar_ancoragem(acc, {"_": anchors}) if payloads else {"ancorado": True, "suspeitos": []}

    vistos: set[str] = set()  # dedupe de insights por label (mantém o 1º)
    ins_final: list[dict] = []
    for i in insights:
        if i["label"] not in vistos:
            vistos.add(i["label"])
            ins_final.append(i)

    fatos_hash = hashlib.sha256(
        json.dumps(payloads, sort_keys=True, ensure_ascii=False, default=str).encode()
    ).hexdigest()[:16]

    _update_message(
        msg_id,
        content=acc.strip() or "(sem resposta)",
        streaming=False,
        metadata={
            "status": "done",
            "thinking_trace": " ".join(trace_parts)[:1200],
            "tools_usadas": tools_usadas,
            "insights": ins_final[:8],
            "ancorado": val["ancorado"],
            "suspeitos": val["suspeitos"][:6],
            "duration_ms": int((time.monotonic() - t0) * 1000),
            "fatos_hash": fatos_hash,
        },
    )
