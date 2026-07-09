"""Onda C (motor-hardening) · prova de BYTE-IDENTIDADE da paralelização das fatias.

O ganho da Onda C (extração 2h→~15min) vem de rodar as fatias de UM documento concorrentes
(`EXTRACTOR_CONCURRENCY` · asyncio.gather) sobre o MESMO `EnvelopeBuilder`. Este teste é a régua de
laboratório que garante que paralelizar NÃO corrompe o envelope: troca a chamada cara do LLM por um
fake determinístico (linhas fixas) com `await` ENTRE os `open_secao` — forçando o interleaving real
das corrotinas sob gather. Aí prova as duas pontas:

  1. INTERLEAVING ACONTECEU — sob concorrência a ordem de INSERÇÃO das seções (por _seq) fica
     embaralhada vs. a ordem das fatias (senão o teste seria vacuamente verde).
  2. BYTE-IDÊNTICO MESMO ASSIM — apesar do embaralhamento, `build()` (que ordena por (scope,seq))
     produz JSON idêntico ao sequencial (EXTRACTOR_CONCURRENCY=1), repetível N vezes.

Se alguém remover o sort de `build()` ou o threading de `scope_order`, (2) quebra na hora.
O fake é SÓ de teste — produção sempre usa o extrator real (LLM). Nada de mock entra no produto.
"""
from __future__ import annotations

import asyncio
import json

from agents.extracao import runner as R
from agents.extracao.envelope import EnvelopeBuilder
from agents.extracao.extractor import PassResult

# 5 fatias, cada uma abre 2 seções → 10 seções no total. Interleavam sob gather.
_SCOPES = [{"kind": "sheet", "name": f"S{i}"} for i in range(5)]


def _rows(i: int, sec: int) -> list[dict]:
    # Linhas DETERMINÍSTICAS (nada de LLM) — o conteúdo não muda entre passadas.
    return [{"item": f"i{i}s{sec}r{r}", "valor": i * 100 + sec * 10 + r} for r in range(3)]


async def _fake_extract_into(
    builder, doc, doc_type, context_md, structure,  # noqa: ANN001
    *, scope=None, pass_no=1, is_last=True, scope_order=0,
):
    """Substituto do extrator: enche o builder com seções/linhas conhecidas. Os `await sleep(0)`
    entre os opens cedem o loop → as 5 corrotinas do gather se intercalam (ordem de conclusão != ordem
    das fatias). `scope_order` é repassado fielmente, como o extrator real faz via submit_tools."""
    i = scope_order
    if i == 0:
        # O FRAME (tipo/identificação) é estabelecido por uma passada só — como na extração real.
        builder.set_documento(tipo_documento="Planilha", identificacao={"obra": "BR-101", "bm": 5})
    await asyncio.sleep(0)
    builder.open_secao(f"sec_{i}_a", f"Seção {i} A", "tabela", f"sheet S{i} A",
                       colunas=["item", "valor"], scope_order=i)
    builder.append_linhas(f"sec_{i}_a", _rows(i, 0))
    builder.track_ingestao(f"S{i}", 1, 2, 4)  # exercita _ingestao (chaves ordenadas no build)
    await asyncio.sleep(0)
    builder.open_secao(f"sec_{i}_b", f"Seção {i} B", "tabela", f"sheet S{i} B",
                       colunas=["item", "valor"], scope_order=i)
    builder.append_linhas(f"sec_{i}_b", _rows(i, 1))
    await asyncio.sleep(0)
    return PassResult(usage=None, cost=None, num_turns=1)


def _insertion_scopes(builder: EnvelopeBuilder) -> list[int]:
    """A ordem em que as seções foram INSERIDAS (por _seq) — sob gather interleavado != ordem das fatias."""
    return [s["_scope"] for s in sorted(builder._secoes.values(), key=lambda s: s["_seq"])]


def _build(concurrency: int, capture: list | None = None) -> str:
    R.EXTRACTOR_CONCURRENCY = concurrency
    builder = EnvelopeBuilder()
    asyncio.run(R._extract_scopes(builder, None, "Planilha", "", {}, _SCOPES, pass_no=1))
    if capture is not None:
        capture.append(_insertion_scopes(builder))
    return json.dumps(builder.build(), ensure_ascii=False, sort_keys=False)


def run() -> None:
    orig_fn, orig_conc = R.extract_into, R.EXTRACTOR_CONCURRENCY
    R.extract_into = _fake_extract_into
    try:
        seq_ins: list = []
        seq = _build(1, seq_ins)  # caminho legado sequencial
        seq_order = seq_ins[0]
        assert seq_order == [0, 0, 1, 1, 2, 2, 3, 3, 4, 4], \
            f"sequencial deveria inserir na ordem das fatias, veio {seq_order}"

        # Paraleliza N vezes — todo build tem que bater byte-a-byte com o sequencial.
        interleaved = False
        for _ in range(8):
            par_ins: list = []
            par = _build(8, par_ins)
            assert par == seq, "envelope PARALELO != SEQUENCIAL (paralelização corrompeu a ordem/dado)"
            if par_ins[0] != seq_order:
                interleaved = True  # confirma que a concorrência realmente embaralhou a inserção

        assert interleaved, \
            "concorrência não interleavou nenhuma vez — teste vacuamente verde (revisar o fake)"
    finally:
        R.extract_into, R.EXTRACTOR_CONCURRENCY = orig_fn, orig_conc

    print("PASS concorrência · interleaving real + build() byte-idêntico ao sequencial (8×) · _ingestao ordenado")


if __name__ == "__main__":
    run()
