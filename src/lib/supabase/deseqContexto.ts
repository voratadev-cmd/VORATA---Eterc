// Contexto compartilhado das telas do M3 (Camada C) · centraliza o que os 7 hooks useXView repetiam:
// o painel D.0 (getDesequilibrio) + o denominador OFICIAL do farol acumulado (obras.valor_contratual
// ?? custo_total da curva = PV) + nome da obra. Cada hook só acrescenta a leitura da SUA fonte (getX)
// e o valor da SUA categoria (categoriaRs("D.x")). Mantém o paralelismo: getX roda em paralelo a este.

import { type Desequilibrio, getDesequilibrio } from "./desequilibrio";
import { getFaturamentoCurva } from "./faturamentoCurva";
import { getObraById } from "./obras";

export type DeseqContexto = {
  /** Painel D.0 cru (null se M3 não rodou). */
  deseq: Desequilibrio | null;
  /** nome_interno da obra. */
  nome: string | null;
  /** Σ do desequilíbrio (D.0) — denominador do "% do total". */
  totalDesequilibrio: number | null;
  /** Valor contratado (PV) — denominador do farol acumulado. */
  valorContratado: number | null;
  /** Procedência do denominador — para rotular com honestidade. */
  valorContratadoFonte: "obra" | "faturamento" | null;
  /** valor_rs da categoria `tela` (D.x) no painel D.0. null se a categoria não existe / não apurada. */
  categoriaRs: (tela: string) => number | null;
  /** true se a categoria `tela` existe no D.0 (mesmo com valor_rs null — ex.: D.8 pleito a abrir). */
  temCategoria: (tela: string) => boolean;
};

/** Lê o contexto de desequilíbrio (D.0 + obra + curva) de uma obra. Sempre resolve (não null) —
 *  cada campo é null quando a fonte respectiva não existe. */
export async function getDeseqContexto(contractId: string): Promise<DeseqContexto> {
  const [deseq, obra, curva] = await Promise.all([
    getDesequilibrio(contractId),
    getObraById(contractId),
    getFaturamentoCurva(contractId),
  ]);

  const valorManual = obra?.valor_contratual != null ? Number(obra.valor_contratual) : null;
  const valorPV = curva?.custoTotal != null ? Number(curva.custoTotal) : null;

  return {
    deseq,
    nome: obra?.nome_interno ?? null,
    totalDesequilibrio: deseq?.totalRs ?? null,
    valorContratado: valorManual ?? valorPV,
    valorContratadoFonte: valorManual != null ? "obra" : valorPV != null ? "faturamento" : null,
    categoriaRs: (tela) => deseq?.categorias.find((c) => c.tela === tela)?.valorRs ?? null,
    temCategoria: (tela) => deseq?.categorias.some((c) => c.tela === tela) ?? false,
  };
}
