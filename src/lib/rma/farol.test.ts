// Golden das RÉGUAS OFICIAIS de farol (pessoa de domínio, 03/jun/2026). Trava os limites de cada
// indicador por VALOR — um erro de transcrição aqui pintaria milhões de farol errado.

import { test, expect } from "bun:test";
import {
  classificarPorRegra,
  FAROL_REGRAS,
  farolOverridesDe,
  mesclarRegras,
  type FarolLevel,
} from "./farol";

// [indicador, [[valor, nível esperado], ...]] — cobre os 4 níveis + as fronteiras (inclusivas).
const CASOS: Array<[string, Array<[number, FarolLevel]>]> = [
  // 1 · desvio faturamento (maior=melhor, ≥-1/-5/-10) — adiantado é Conforme
  [
    "faturamento_desvio_acumulado",
    [
      [7, "conforme"],
      [0, "conforme"],
      [-1, "conforme"],
      [-3, "observacao"],
      [-5, "observacao"],
      [-8, "risco"],
      [-10, "risco"],
      [-10.1, "critico"],
    ],
  ],
  // 2 · recursos vs faturamento (menor=melhor, ≤0/5/10): fat. cai ≤ recurso = bom
  [
    "recursos_vs_faturamento",
    [
      [-3, "conforme"],
      [0, "conforme"],
      [3, "observacao"],
      [5, "observacao"],
      [8, "risco"],
      [10, "risco"],
      [11, "critico"],
    ],
  ],
  // 3 · produtividade CPI (maior=melhor, ≥1,0/0,9/0,8)
  [
    "produtividade_cpi",
    [
      [1.1, "conforme"],
      [1.0, "conforme"],
      [0.95, "observacao"],
      [0.9, "observacao"],
      [0.85, "risco"],
      [0.8, "risco"],
      [0.79, "critico"],
    ],
  ],
  // 4 · atraso físico pp (maior=melhor, ≥-2/-5/-10)
  [
    "prazo_atraso_fisico",
    [
      [0, "conforme"],
      [-2, "conforme"],
      [-3, "observacao"],
      [-7, "risco"],
      [-11, "critico"],
    ],
  ],
  // 5 · prorrogação % (menor=melhor, ≤1/3/8)
  [
    "prazo_prorrogacao",
    [
      [0.5, "conforme"],
      [1, "conforme"],
      [2, "observacao"],
      [3, "observacao"],
      [5, "risco"],
      [8, "risco"],
      [9, "critico"],
    ],
  ],
  // 6 · tendência de término — GATILHO (sem Observação): dentro=Conforme; até 8%=Risco; +=Crítico
  [
    "prazo_tendencia_termino",
    [
      [-2, "conforme"],
      [0, "conforme"],
      [0.1, "risco"],
      [8, "risco"],
      [8.1, "critico"],
    ],
  ],
  // 7 · insumos vs índice pp (menor=melhor, ≤2/5/10) — abaixo do índice é Conforme
  [
    "insumos_vs_indice",
    [
      [-1, "conforme"],
      [2, "conforme"],
      [4, "observacao"],
      [8, "risco"],
      [12, "critico"],
    ],
  ],
  // 8 · desequilíbrio acumulado % (menor=melhor, ≤1/5/10)
  [
    "desequilibrio_acumulado",
    [
      [0.5, "conforme"],
      [1, "conforme"],
      [3, "observacao"],
      [8, "risco"],
      [12, "critico"],
    ],
  ],
  // 9 · gap capacidade−liberação pp (menor=melhor, ≤2/5/10)
  [
    "capacidade_gap",
    [
      [2, "conforme"],
      [4, "observacao"],
      [8, "risco"],
      [12, "critico"],
    ],
  ],
];

for (const [indicador, casos] of CASOS) {
  test(`régua oficial · ${indicador}`, () => {
    for (const [valor, esperado] of casos) {
      expect(classificarPorRegra(indicador, valor)).toBe(esperado);
    }
  });
}

test("valor ausente / indicador desconhecido → null", () => {
  expect(classificarPorRegra("faturamento_desvio_acumulado", null)).toBeNull();
  expect(classificarPorRegra("faturamento_desvio_acumulado", undefined)).toBeNull();
  expect(classificarPorRegra("indicador_inexistente", 5)).toBeNull();
});

// ── Régua configurável por obra (obras.farol_regras · overrides parciais) ────

test("mesclarRegras · override parcial muda só os cortes informados", () => {
  const regras = mesclarRegras({ faturamento_desvio_acumulado: { risco: -20 } });
  // corte de risco movido: -15 (crítico na régua oficial) vira risco
  expect(classificarPorRegra("faturamento_desvio_acumulado", -15, regras)).toBe("risco");
  expect(classificarPorRegra("faturamento_desvio_acumulado", -25, regras)).toBe("critico");
  // cortes não informados preservados (conforme -1 / observação -5)
  expect(classificarPorRegra("faturamento_desvio_acumulado", -0.5, regras)).toBe("conforme");
  expect(classificarPorRegra("faturamento_desvio_acumulado", -3, regras)).toBe("observacao");
  // outros indicadores intactos
  expect(classificarPorRegra("capacidade_gap", 12, regras)).toBe("critico");
});

test("mesclarRegras · jsonb malformado não corrompe a régua oficial", () => {
  expect(mesclarRegras(null)).toBe(FAROL_REGRAS);
  expect(mesclarRegras(undefined)).toBe(FAROL_REGRAS);
  // chave desconhecida ignorada · corte não-numérico ignorado
  const regras = mesclarRegras({
    indicador_inexistente: { risco: 1 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    produtividade_cpi: { risco: "abc" as any, conforme: Number.NaN },
  });
  expect(classificarPorRegra("produtividade_cpi", 0.95, regras)).toBe("observacao");
  expect(classificarPorRegra("produtividade_cpi", 0.85, regras)).toBe("risco");
  expect(classificarPorRegra("produtividade_cpi", 1.0, regras)).toBe("conforme");
});

test("farolOverridesDe · valida o jsonb cru", () => {
  expect(farolOverridesDe(null)).toBeNull();
  expect(farolOverridesDe("texto")).toBeNull();
  expect(farolOverridesDe([1, 2])).toBeNull();
  expect(farolOverridesDe({ produtividade_cpi: { risco: 0.7 } })).toEqual({
    produtividade_cpi: { risco: 0.7 },
  });
});
