// Read-model ÚNICO das telas C.6 Insumos e D.5 Insumos (v53 · cláusulas 6.2 + 8.8).
// 30 insumos de faturamento direto × todas as fontes de índice (118) + parâmetros do
// reequilíbrio + série IPCA (cenários do Mecanismo 1). O MOTOR de cálculo (excedente,
// repasse, potencial, presets, M1) vive aqui como funções puras — as duas telas e os
// probes de paridade consomem o MESMO código, reproduzindo ao centavo as views do
// Prompt_Devs_C06_D05_Insumos.md §4 e a lógica dos mockups C06/D05 (fonte da UX).
// Números-âncora (§9): FD 96.818.470,96 · 30 acima do IPCA · repasse real 10.246,94 ·
// potencial 977.825,00 · M1 proposta 25.217.803,73.

import { getSupabase } from "./client";
import type { Database } from "./database.types";

function untypedTable(name: keyof Database["public"]["Tables"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getSupabase() as any).from(name);
}

const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

/** Uma fonte de índice de um insumo (linha do seletor). */
export type FonteInsumo = {
  /** id estável da opção ('pav', 'cap', 'anp', 'sinapi_3045'…). */
  id: string;
  /** SINAPI | DNIT | ANP | SBC | EMOP | SCO. */
  fonte: string;
  /** Rótulo do seletor ('DNIT·Pavim.', 'SINAPI CAP 30/45'…). */
  rotulo: string;
  codigo: string | null;
  /** 'indice' (DNIT · número-índice) | 'preco' (R$ absoluto). */
  tipo: "indice" | "preco";
  valorOs: number | null;
  valorAtual: number | null;
  /** Δ% da fonte no período (fração). */
  delta: number | null;
  /** Excedente sobre o IPCA (fração) = delta − ipca_periodo. */
  excedente: number | null;
  recomendada: boolean;
};

/** Um insumo de faturamento direto com todas as suas fontes. */
export type InsumoFd = {
  ordemAbc: number;
  nome: string;
  unidade: string;
  classe: "A" | "B" | "C";
  categoria: string | null;
  ordemPq: number | null;
  qtdPq: number;
  precoUnitBdi: number;
  valorContratoBdi: number;
  qtdMedida: number;
  valorMedidoBdi: number;
  /** id da fonte ★ (default do seletor). */
  fonteRecomendada: string | null;
  opcoes: FonteInsumo[];
};

export type CenarioM1 = {
  id: string; // 'cpus' | 'proposta' | 'assinatura'
  nome: string; // 'Nov/2024' …
  desc: string;
  mes: string; // '2024-11'
  i0: number;
};

export type InsumosReeq = {
  /** IPCA do período (fração) — linha divisória da cláusula 8.8. */
  ipcaPeriodo: number;
  dataOs: string | null;
  dataVerificacao: string | null;
  dataAssinatura: string | null;
  dataProposta: string | null;
  dataReajusteAniversario: string | null;
  dataVerificacaoReeq: string | null;
  contratoCheioBdi: number;
  medidoAcumulado: number;
  /** Saldo a executar do M1 = contrato cheio − medido (⚠️ não usar base de medição). */
  saldoAExecutar: number;
  reajusteAcumulado: number | null;
  /** IPCA número-índice atual (mai/26 · dez/93=100). */
  ipcaAtual: number;
  cenarioM1Ativo: string;
};

export type InsumosFd = {
  insumos: InsumoFd[];
  reeq: InsumosReeq;
  serieIpca: Array<{ mes: string; indice: number }>;
  cenariosM1: CenarioM1[];
  /** Σ valor de contrato dos 30 (= PQ · gate "✓ bate com a PQ"). */
  totalFdBdi: number;
  totalMedidoBdi: number;
};

/** Carrega o modelo único das telas C.6/D.5. null se a obra não tem o v53 normalizado. */
export async function getInsumosFd(contractId: string): Promise<InsumosFd | null> {
  const [insRes, fontesRes, reeqRes, serieRes] = await Promise.all([
    untypedTable("obra_insumos_fd")
      .select("*")
      .eq("contrato_id", contractId)
      .order("ordem_abc", { ascending: true }),
    untypedTable("obra_insumos_fd_fontes")
      .select("*")
      .eq("contrato_id", contractId)
      .order("insumo_ordem", { ascending: true })
      .order("ordem_opcao", { ascending: true }),
    untypedTable("obra_insumos_reeq").select("*").eq("contrato_id", contractId).maybeSingle(),
    untypedTable("obra_ipca_serie")
      .select("*")
      .eq("contrato_id", contractId)
      .order("mes", { ascending: true }),
  ]);
  // Falha de leitura não pode virar "não normalizado" silencioso — falhe alto (erro = milhões).
  for (const r of [insRes, fontesRes, reeqRes, serieRes]) {
    if (r.error) throw new Error(r.error.message);
  }
  const insRows = (insRes.data ?? []) as Array<Record<string, unknown>>;
  const reeqRow = reeqRes.data as Record<string, unknown> | null;
  if (insRows.length === 0 || !reeqRow) return null;

  const ipca = num(reeqRow.ipca_periodo) ?? 0;
  const fontesPorInsumo = new Map<number, FonteInsumo[]>();
  for (const f of (fontesRes.data ?? []) as Array<Record<string, unknown>>) {
    const ordem = Number(f.insumo_ordem);
    const delta = num(f.delta_pct);
    const lista = fontesPorInsumo.get(ordem) ?? [];
    lista.push({
      id: String(f.fonte_id),
      fonte: String(f.fonte),
      rotulo: String(f.rotulo),
      codigo: (f.codigo as string | null) ?? null,
      tipo: f.tipo === "indice" ? "indice" : "preco",
      valorOs: num(f.valor_os),
      valorAtual: num(f.valor_atual),
      delta,
      excedente: delta != null ? delta - ipca : null,
      recomendada: f.is_recomendada === true,
    });
    fontesPorInsumo.set(ordem, lista);
  }

  const insumos: InsumoFd[] = insRows.map((r) => ({
    ordemAbc: Number(r.ordem_abc),
    nome: String(r.nome),
    unidade: String(r.unidade),
    classe: (String(r.classe) as "A" | "B" | "C") ?? "C",
    categoria: (r.categoria as string | null) ?? null,
    ordemPq: num(r.ordem_pq),
    qtdPq: num(r.qtd_pq) ?? 0,
    precoUnitBdi: num(r.preco_unit_bdi) ?? 0,
    valorContratoBdi: num(r.valor_contrato_bdi) ?? 0,
    qtdMedida: num(r.qtd_medida) ?? 0,
    valorMedidoBdi: num(r.valor_medido_bdi) ?? 0,
    fonteRecomendada: (r.fonte_recomendada as string | null) ?? null,
    opcoes: fontesPorInsumo.get(Number(r.ordem_abc)) ?? [],
  }));

  const cenariosM1: CenarioM1[] = [];
  const serieIpca: Array<{ mes: string; indice: number }> = [];
  for (const s of (serieRes.data ?? []) as Array<Record<string, unknown>>) {
    serieIpca.push({ mes: String(s.mes), indice: num(s.indice) ?? 0 });
    if (s.cenario_id) {
      cenariosM1.push({
        id: String(s.cenario_id),
        nome: String(s.cenario_nome ?? s.cenario_id),
        desc: String(s.cenario_desc ?? ""),
        mes: String(s.mes),
        i0: num(s.indice) ?? 0,
      });
    }
  }

  return {
    insumos,
    reeq: {
      ipcaPeriodo: ipca,
      dataOs: (reeqRow.data_os as string | null) ?? null,
      dataVerificacao: (reeqRow.data_verificacao as string | null) ?? null,
      dataAssinatura: (reeqRow.data_assinatura as string | null) ?? null,
      dataProposta: (reeqRow.data_proposta as string | null) ?? null,
      dataReajusteAniversario: (reeqRow.data_reajuste_aniversario as string | null) ?? null,
      dataVerificacaoReeq: (reeqRow.data_verificacao_reeq as string | null) ?? null,
      contratoCheioBdi: num(reeqRow.contrato_cheio_bdi) ?? 0,
      medidoAcumulado: num(reeqRow.medido_acumulado) ?? 0,
      saldoAExecutar: num(reeqRow.saldo_a_executar) ?? 0,
      reajusteAcumulado: num(reeqRow.reajuste_acumulado),
      ipcaAtual: num(reeqRow.ipca_atual) ?? 0,
      cenarioM1Ativo: String(reeqRow.cenario_m1_ativo ?? "proposta"),
    },
    serieIpca,
    cenariosM1,
    totalFdBdi: insumos.reduce((s, i) => s + i.valorContratoBdi, 0),
    totalMedidoBdi: insumos.reduce((s, i) => s + i.valorMedidoBdi, 0),
  };
}

// ────────────────────────────── MOTOR (funções puras · espelho dos mockups) ──────────────────────

/** Seleção de fonte por insumo: ordemAbc → fonte_id. */
export type SelecaoFontes = Record<number, string>;

/** Limiar do excedente que aciona repasse (mockup C06: exc > 0,0001). */
export const LIMIAR_EXCEDENTE = 1e-4;

export type PresetId = "mercado" | "dnit" | "rec" | "melhor" | "pior";

/** Seleção default: fonte recomendada (★) de cada insumo. */
export function selecaoRecomendada(insumos: InsumoFd[]): SelecaoFontes {
  const sel: SelecaoFontes = {};
  for (const i of insumos) {
    sel[i.ordemAbc] =
      i.fonteRecomendada ?? i.opcoes.find((o) => o.recomendada)?.id ?? i.opcoes[0]?.id ?? "";
  }
  return sel;
}

/** Fonte selecionada de um insumo (null se seleção inválida). */
export function fonteSelecionada(insumo: InsumoFd, sel: SelecaoFontes): FonteInsumo | null {
  return insumo.opcoes.find((o) => o.id === sel[insumo.ordemAbc]) ?? null;
}

/** Aplica um preset — regras EXATAS dos mockups (applyPreset):
 *  mercado = 1ª fonte com rótulo iniciando em SINAPI › SBC › EMOP › SCO › ANP (senão recomendada);
 *  dnit    = 1ª fonte com rótulo iniciando em "DNIT" (senão recomendada — diesel não tem DNIT);
 *  melhor/pior = maior/menor Δ% do insumo; rec = recomendada. */
export function aplicarPreset(insumos: InsumoFd[], preset: PresetId): SelecaoFontes {
  const sel: SelecaoFontes = {};
  for (const x of insumos) {
    let escolhida: FonteInsumo | undefined;
    if (preset === "rec") {
      escolhida = x.opcoes.find((o) => o.recomendada);
    } else if (preset === "mercado") {
      for (const pref of ["SINAPI", "SBC", "EMOP", "SCO", "ANP"]) {
        escolhida = x.opcoes.find((o) => o.rotulo.startsWith(pref));
        if (escolhida) break;
      }
      escolhida = escolhida ?? x.opcoes.find((o) => o.recomendada);
    } else if (preset === "dnit") {
      escolhida =
        x.opcoes.find((o) => o.rotulo.startsWith("DNIT")) ?? x.opcoes.find((o) => o.recomendada);
    } else if (preset === "melhor") {
      for (const o of x.opcoes) {
        if (o.delta != null && (escolhida == null || o.delta > (escolhida.delta ?? -Infinity)))
          escolhida = o;
      }
    } else if (preset === "pior") {
      for (const o of x.opcoes) {
        if (o.delta != null && (escolhida == null || o.delta < (escolhida.delta ?? Infinity)))
          escolhida = o;
      }
    }
    sel[x.ordemAbc] = (escolhida ?? x.opcoes[0])?.id ?? "";
  }
  return sel;
}

export type TotaisInsumos = {
  /** nº de insumos cuja fonte selecionada excede o IPCA. */
  acimaDoIpca: number;
  /** Σ excedente × valor medido (só quem tem medição) — vai para a D.0. */
  repasseReal: number;
  /** Σ excedente × valor de contrato (o "e se tudo medido"). */
  potencial: number;
};

/** Totais dos cards (updateTotals do mockup) para uma seleção de fontes. */
export function totaisDe(insumos: InsumoFd[], sel: SelecaoFontes): TotaisInsumos {
  let acimaDoIpca = 0;
  let repasseReal = 0;
  let potencial = 0;
  for (const x of insumos) {
    const o = fonteSelecionada(x, sel);
    if (!o || o.excedente == null) continue;
    if (o.excedente > LIMIAR_EXCEDENTE) {
      acimaDoIpca++;
      if (x.valorMedidoBdi) repasseReal += o.excedente * x.valorMedidoBdi;
      if (x.valorContratoBdi) potencial += o.excedente * x.valorContratoBdi;
    }
  }
  return { acimaDoIpca, repasseReal, potencial };
}

/** Repasse/potencial de UM insumo na seleção atual (linha da tabela). */
export function linhaCalc(insumo: InsumoFd, sel: SelecaoFontes) {
  const o = fonteSelecionada(insumo, sel);
  const exc = o?.excedente ?? null;
  const potencial = exc != null && exc > LIMIAR_EXCEDENTE ? exc * insumo.valorContratoBdi : 0;
  const repasseReal =
    exc != null && exc > LIMIAR_EXCEDENTE && insumo.valorMedidoBdi > 0
      ? exc * insumo.valorMedidoBdi
      : insumo.valorMedidoBdi > 0
        ? 0
        : null;
  return { fonte: o, delta: o?.delta ?? null, excedente: exc, potencial, repasseReal };
}

/** M1 — variação e reajuste de um cenário: R = [(I − I₀) × P] / I₀. */
export function m1Calc(reeq: InsumosReeq, cenario: CenarioM1) {
  const variacao = (reeq.ipcaAtual - cenario.i0) / cenario.i0;
  return { variacao, reajuste: variacao * reeq.saldoAExecutar };
}
