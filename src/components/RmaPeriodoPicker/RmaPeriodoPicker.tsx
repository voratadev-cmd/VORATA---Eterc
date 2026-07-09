// RmaPeriodoPicker — seletor de período (BM) no header do RMA. Default "Obra inteira" (= sem ?bm =
// corte no último mês medido = comportamento de hoje). Escolher um BM grava ?bm="YYYY-MM"; escolher o
// ÚLTIMO BM medido limpa o ?bm (volta pra Obra inteira, evitando divergência de número). Opções = só
// os meses MEDIDOS da curva real. Em abas que ainda não respondem ao corte, vem `disabled` (mostra o
// estado atual + tooltip honesto). Reusa o DS PeriodoPicker. Sem faturamento medido → não renderiza.
import { useNavigate } from "@tanstack/react-router";
import { PeriodoPicker, type PeriodoOpcao } from "@/components/ds";
import { useFaturamentoCurva } from "@/lib/hooks/useFaturamentoCurva";
import { bmId, useRmaCorte } from "@/lib/hooks/useRmaCorte";

const TOOLTIP_DISABLED =
  "Esta aba mostra a obra inteira — o filtro por BM vale em Faturamento, Recursos e Indicadores";

export function RmaPeriodoPicker({
  contractId,
  disabled,
}: {
  contractId: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const corte = useRmaCorte();
  const { data: curva } = useFaturamentoCurva(contractId);

  // Opções = meses MEDIDOS (realizado) da curva real — o que faz sentido "rebobinar".
  const opcoes: PeriodoOpcao[] = (curva?.meses ?? [])
    .filter((m) => m.tipoProjecao === "realizado" || (m.realRs != null && m.realRs > 0))
    .map((m) => ({ id: bmId({ ano: m.ano, mes: m.mes }), ano: m.ano, mes: m.mes }))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);

  if (opcoes.length === 0) return null; // obra sem faturamento medido → nada a filtrar

  const ultimo = opcoes[opcoes.length - 1];
  const corteValido = corte != null && opcoes.some((o) => o.id === bmId(corte));
  // Aba não-aware (disabled) OU ?bm inválido/fora da lista (link velho, edição manual) → exibe
  // "Obra inteira" (honesto: a aba mostra a obra inteira). NÃO limpamos o ?bm — a seleção volta ao
  // reabrir Faturamento/Recursos.
  const mostrandoTudo = disabled || !corteValido;
  const valor = !mostrandoTudo && corte ? bmId(corte) : ultimo.id;

  function setBm(bm: string | undefined) {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, bm }),
      replace: false,
    });
  }

  return (
    <PeriodoPicker
      label="Período"
      opcoes={opcoes}
      valor={valor}
      allLabel="Obra inteira"
      allActive={mostrandoTudo}
      onAll={() => setBm(undefined)}
      // cada mês (INCLUSIVE o último) é selecionável como BM próprio; "Obra inteira" só pelo botão
      // (allLabel/onAll) — assim dá pra ver "apenas o último mês" sem cair no acumulado da obra toda.
      onChange={(o) => setBm(o.id)}
      disabled={disabled}
      title={disabled ? TOOLTIP_DISABLED : undefined}
    />
  );
}
