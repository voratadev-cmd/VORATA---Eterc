// Adapter Plano de Ação (C.12) → RelatorioDados. Mapeia o read-model REAL da aba (getPlanoAcao ·
// obra_secoes C.12) para os DADOS do relatório — garante paridade com a tela (mesmos números: contagens
// GRAVADAS no Resumo, farol oficial da aba, mesmo quadro de tarefas 5W2H). A IA só escreve a narrativa
// ancorada nestes números. Sem curva natural → grafico = null. null = obra sem C.12 normalizada.

import { getPlanoAcao, type PlanoTarefa } from "@/lib/supabase/planoAcao";
import type { RelatorioDados, RelatorioFarol } from "@/lib/relatorio/schema";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
}
function fmtPct(v: number | null): string {
  // pctConcluidas vem 0..1 (igual à tela); exibe como inteiro %.
  return v != null ? `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—";
}
// Realce de linha ATRASADA — espelha prazoAtrasada da PlanoAcaoView (prazo vencido vs hoje; concluída
// nunca atrasa). Usado só pra marcar a coluna de desvio do detalhamento.
function prazoAtrasada(prazo: string | null, status: string | null): boolean {
  if (!prazo || /conclu/i.test(status ?? "")) return false;
  const d = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d < hoje;
}

/** DADOS reais da aba Plano de Ação (C.12) p/ o relatório (null = obra sem C.12 normalizada). */
export async function dadosPlanoAcao(contractId: string): Promise<RelatorioDados | null> {
  const plano = await getPlanoAcao(contractId);
  if (!plano || (!plano.resumo && plano.tarefas.length === 0)) return null;

  const { tarefas, resumo } = plano;
  // Farol OFICIAL da aba — gravado no Resumo C.12 (mesmo Badge da tela). Sem resumo → observação neutra.
  const farol: RelatorioFarol = resumo?.farolNivel ?? "observacao";

  // KPIs de cabeçalho — os mesmos contadores que a aba destaca (foco: atrasadas/vencendo/críticas +
  // andamento). Hints com o farol/critério e o % concluído, espelhando o subtítulo da tela.
  const indicadores = resumo
    ? [
        {
          label: "Tarefas atrasadas",
          valor: String(resumo.atrasadas),
          hint:
            resumo.criticasAtrasadas > 0
              ? `${resumo.criticasAtrasadas} crítica(s) atrasada(s)`
              : `${resumo.total} ação(ões) no total`,
        },
        {
          label: "Vencendo < 7 dias",
          valor: String(resumo.vencendo),
          hint: resumo.slaMedioDias != null ? `SLA médio ${resumo.slaMedioDias} dias` : "follow-up",
        },
        {
          label: "Em andamento",
          valor: String(resumo.emAndamento),
          hint: `${resumo.aFazer} a fazer`,
        },
        {
          label: "Concluídas",
          valor: `${resumo.concluidas} · ${fmtPct(resumo.pctConcluidas)}`,
          hint: resumo.farolCriterio ?? `farol ${resumo.farolLabel}`,
        },
        {
          label: "Total de ações",
          valor: String(resumo.total),
          hint: `${resumo.emAndamento + resumo.aFazer} em aberto`,
        },
        // Rastreabilidade C.11 → C.12: quantas tarefas nasceram de uma conduta sugerida. Pula
        // (null) quando o Resumo não grava o vínculo — PENDENTE ≠ 0.
        ...(resumo.vinculadasAC11 != null
          ? [
              {
                label: "Vinculadas a C.11",
                valor: String(resumo.vinculadasAC11),
                hint: "tarefas originadas de condutas (C.11)",
              },
            ]
          : []),
      ]
    : [{ label: "Tarefas no quadro", valor: String(tarefas.length), hint: "Resumo C.12 pendente" }];

  // Sem curva natural na aba (tarefas 5W2H, não série temporal).
  const grafico = null;

  // Detalhamento: o Quadro de tarefas (5W2H) — a tabela natural da aba. Coluna "Prazo" é a de desvio
  // (linhas atrasadas marcadas em vermelho na tela). null se não houver tarefas.
  const detalhamento = tarefas.length
    ? {
        titulo: "Quadro de tarefas (5W2H)",
        colunas: [
          "ID",
          "Tarefa",
          "Responsável",
          "Prazo",
          "Urgência",
          "Status",
          "Frente/Trecho",
          "Esforço",
        ],
        linhas: tarefas.map((t: PlanoTarefa) => [
          t.id || "—",
          t.titulo || "—",
          t.responsavel ?? "—",
          t.prazo
            ? fmtDate(t.prazo) + (prazoAtrasada(t.prazo, t.status) ? " (atrasada)" : "")
            : (t.prazoTexto ?? "—"),
          t.urgencia ?? "—",
          t.status ?? "—",
          t.frenteTrecho ?? "—",
          t.esforco ?? "—",
        ]),
        colDesvio: 3,
      }
    : null;

  return { titulo: "Plano de Ação", farol, indicadores, grafico, detalhamento };
}
