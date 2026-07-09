"""B2 (motor-hardening) · serialização de ingested_ranges. Prova: (1) build() grava `_ingestao`;
(2) ranges_persistidos lê de volta; (3) o gate CLI/auditoria credita o `_ingestao` serializado e dá
EXATAMENTE a mesma cobertura que o runtime (que passa builder.ingested_ranges) — sem super-contar."""
from __future__ import annotations

from agents.extracao.cobertura import auditar_cobertura, ranges_do_envelope, ranges_persistidos
from agents.extracao.envelope import EnvelopeBuilder


def run() -> None:
    # 1) round-trip: track_ingestao → build() grava _ingestao (header + range, inclusive)
    b = EnvelopeBuilder()
    b.track_ingestao("Aba1", header_row=1, de=2, ate=10)
    p = b.build()
    assert p.get("_ingestao", {}).get("Aba1") == list(range(1, 11)), p.get("_ingestao")

    # 2) ranges_persistidos reconstrói o set
    rp = ranges_persistidos(p)
    assert rp == {"Aba1": set(range(1, 11))}, rp

    # 3) grid com dado em L1..L10, SEM fonte declarada (ranges_do_envelope vazio): sem crédito = 10
    #    órfãs numéricas; com o _ingestao creditado = 0. É o que matava o "14.881" do verify standalone.
    grid = {"Aba1": [[f"v{i}", 100 + i] for i in range(1, 11)]}
    assert ranges_do_envelope(p) == {}, "payload sintético não deve ter fonte"
    sem = auditar_cobertura(grid, {})
    assert sem["total_numericas"] == 10, sem
    com = auditar_cobertura(grid, {a: set(l) for a, l in rp.items()})
    assert com["total_numericas"] == 0, com

    # 4) serializado (CLI) == runtime (extra_ranges=builder.ingested_ranges): cobertura idêntica
    runtime = auditar_cobertura(grid, {a: set(l) for a, l in b.ingested_ranges.items()})
    assert runtime["total_numericas"] == com["total_numericas"] == 0

    # 5) sem ingestão, build() NÃO grava chave (não polui envelopes sem planilha)
    assert "_ingestao" not in EnvelopeBuilder().build()

    print("PASS B2 · _ingestao round-trip · gate CLI credita == runtime (0 órfã c/ crédito vs 10 sem)")


if __name__ == "__main__":
    run()
