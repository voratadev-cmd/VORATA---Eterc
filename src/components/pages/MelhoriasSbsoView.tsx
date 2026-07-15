// C.15 Melhorias Documentais — DIALETO SBSO ("arrumar a própria casa" · corte BM04).
// Painel (4 KPIs + farol geral) → Desvios do Previsto (8 cards CFF×RDO×PDOT) → Defasagem de
// Faturamento por disciplina (9 + TOTAL, conserva com o C.3) → Achados/Melhorias/Síntese
// (texto estruturado da fonte, parseado por marcadores ①②/✗/✓/• — sem reescrever conteúdo).
import { Fragment, useState } from "react";
import { ClipboardList, FileText, Files, Gauge } from "lucide-react";
import { Badge, Card, Segmented } from "@/components/ds";
import type { MelhoriasSbso } from "@/lib/supabase/melhoriasSbso";
import "./MelhoriasSbsoView.css";

const fmtBRL0 = (v: number | null) =>
  v != null ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : "—";
const fmtPct1 = (fr: number | null) =>
  fr != null
    ? `${(fr * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "—";

function sevTone(s: string | null): "danger" | "warning" | "info" {
  const t = (s ?? "").toLowerCase();
  if (t.includes("crít") || t.includes("crit")) return "danger";
  if (t.includes("risco")) return "warning";
  return "info";
}
// "● RISCO — documentação a reforçar" → tone canônico + texto sem o glifo
function farolGeral(raw: string | null): { tone: "danger" | "warning" | "info"; label: string } {
  const s = (raw ?? "").replace(/^[●○◐•]\s*/u, "");
  return { tone: sevTone(s), label: s || "—" };
}

// Parser leve do texto estruturado (só CLASSIFICA linhas; conteúdo é literal da fonte).
type LinhaRica =
  | { t: "secao"; txt: string }
  | { t: "doc"; txt: string; farol: string | null }
  | { t: "label"; txt: string; ok: boolean }
  | { t: "bullet"; txt: string; ok: boolean }
  | { t: "p"; txt: string };
function parseAchados(texto: string): LinhaRica[] {
  const out: LinhaRica[] = [];
  for (const raw of texto.split("\n")) {
    const l = raw.trim();
    if (!l || /^C\.15 — MELHORIAS/i.test(l)) continue;
    if (/^[①②③]/.test(l) || /^SÍNTESE/i.test(l)) out.push({ t: "secao", txt: l });
    else if (/^[✗✓]/.test(l) && l.endsWith(":"))
      out.push({ t: "label", txt: l.slice(1).trim(), ok: l.startsWith("✓") });
    else if (/^•/.test(l)) out.push({ t: "bullet", txt: l.slice(1).trim(), ok: false });
    else if (/^✓/.test(l)) out.push({ t: "bullet", txt: l.slice(1).trim(), ok: true });
    else if (/—/.test(l) && /[●○]/.test(l)) {
      const m = l.match(/[●○]\s*(.+)$/u);
      out.push({ t: "doc", txt: l.replace(/·?\s*[●○].*$/u, "").trim(), farol: m?.[1] ?? null });
    } else out.push({ t: "p", txt: l });
  }
  return out;
}

export function MelhoriasSbsoView({ d }: { d: MelhoriasSbso }) {
  const fg = farolGeral(d.painel.farolGeral);
  // filtro por severidade dos Desvios (coleção 5+ itens · regra do CLAUDE.md)
  const [sev, setSev] = useState<"todos" | "danger" | "warning">("todos");
  const desviosVisiveis =
    sev === "todos" ? d.desvios : d.desvios.filter((x) => sevTone(x.severidade) === sev);
  const nCriticos = d.desvios.filter((x) => sevTone(x.severidade) === "danger").length;
  const [rdosValor, ...rdosSub] = (d.painel.rdos ?? "—").split("·");
  const [defValor, ...defSub] = (d.painel.defasagem ?? "—").split("·");
  const [atasValor, ...atasSub] = (d.painel.atas ?? "—").split("—");
  const cards = [
    {
      ic: <FileText size={15} aria-hidden />,
      label: "RDOs analisados",
      valor: rdosValor.trim(),
      sub: rdosSub.join("·").trim() || "varredura completa",
    },
    {
      ic: <Files size={15} aria-hidden />,
      label: "Atas / registros formais",
      valor: atasValor.trim(),
      sub: atasSub.join("—").trim() || "—",
    },
    {
      ic: <Gauge size={15} aria-hidden />,
      label: "Defasagem de faturamento",
      valor: defValor.trim(),
      sub: defSub.join("·").trim() || "—",
    },
    {
      ic: <ClipboardList size={15} aria-hidden />,
      label: "Farol geral",
      valor: fg.label.split("—")[0].trim(),
      sub: fg.label.split("—").slice(1).join("—").trim() || "documentação",
      tone: fg.tone,
    },
  ];
  const achados = d.achadosTexto ? parseAchados(d.achadosTexto) : [];
  return (
    <main className="c15s-main">
      <header className="c15s-head">
        <div>
          <h1 className="c15s-titulo">Melhorias Documentais · C.15</h1>
          <p className="c15s-sub">
            tela interna da ETERC — arrumar a própria casa · varredura CFF × RDO × PDOT · corte{" "}
            <b>BM04 (30/06/2026)</b>
          </p>
        </div>
        <Badge tone={fg.tone}>{fg.label.split("—")[0].trim()}</Badge>
      </header>

      <div className="c15s-cards">
        {cards.map((k) => (
          <article key={k.label} className="c15s-card">
            <div className="c15s-card-top">
              <span className="c15s-card-chip">{k.ic}</span>
              <span className="c15s-card-label">{k.label}</span>
            </div>
            <div className={`c15s-card-valor ${k.tone === "danger" ? "c15s-neg" : ""}`}>
              {k.valor}
            </div>
            <div className="c15s-card-sub">{k.sub}</div>
          </article>
        ))}
      </div>

      <section className="c15s-secao">
        <div className="c15s-secao-h">
          <h3 className="c15s-secao-t">Desvios do Previsto — varredura CFF × RDO × PDOT</h3>
          <span className="c15s-secao-sub">
            mostrando {desviosVisiveis.length} de {d.desvios.length} · {nCriticos} críticos
          </span>
          <div className="c15s-filtro">
            <Segmented<"todos" | "danger" | "warning">
              value={sev}
              onChange={setSev}
              aria-label="Filtrar desvios por severidade"
              items={[
                { value: "todos", label: `Todos · ${d.desvios.length}` },
                { value: "danger", label: `Críticos · ${nCriticos}` },
                { value: "warning", label: `Riscos · ${d.desvios.length - nCriticos}` },
              ]}
            />
          </div>
        </div>
        <div className="c15s-desvios">
          {desviosVisiveis.map((x) => (
            <Card key={x.item} className="c15s-desvio">
              <div className="c15s-desvio-top">
                <Badge tone={sevTone(x.severidade)}>{x.severidade ?? "—"}</Badge>
                <span className="c15s-desvio-item">{x.item}</span>
                {x.fonte ? <span className="c15s-fonte">{x.fonte}</span> : null}
              </div>
              <dl className="c15s-desvio-kv">
                <div>
                  <dt>Previsto</dt>
                  <dd>{x.previsto ?? "—"}</dd>
                </div>
                <div>
                  <dt>Real / medido</dt>
                  <dd>{x.real ?? "—"}</dd>
                </div>
                <div>
                  <dt>Justificativa</dt>
                  <dd>{x.justificativa ?? "—"}</dd>
                </div>
              </dl>
              {x.acao ? (
                <p className="c15s-acao">
                  <b>Ação:</b> {x.acao}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="c15s-secao">
        <div className="c15s-secao-h">
          <h3 className="c15s-secao-t">Defasagem de Faturamento por Disciplina</h3>
          <span className="c15s-secao-sub">
            previsto acumulado jun × medido · mesma base do C.3
          </span>
        </div>
        <div className="c15s-tab-wrap">
          <table className="c15s-tab">
            <thead>
              <tr>
                <th>Item</th>
                <th>Frente / serviço</th>
                <th className="r">Previsto acum. jun</th>
                <th className="r">Medido</th>
                <th className="r">Defasagem</th>
                <th className="r">% med.</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {d.defasagem.map((r) => (
                <tr key={r.item}>
                  <td className="tabular">{r.item}</td>
                  <td className="c15s-forte">{r.frente}</td>
                  <td className="r tabular">{fmtBRL0(r.previstoRs)}</td>
                  <td className="r tabular">{fmtBRL0(r.medidoRs)}</td>
                  <td className={`r tabular ${(r.defasagemRs ?? 0) > 0 ? "c15s-neg" : ""}`}>
                    {fmtBRL0(r.defasagemRs)}
                  </td>
                  <td className="r tabular">{fmtPct1(r.pctMed)}</td>
                  <td className="c15s-sit">{r.situacao ?? "—"}</td>
                </tr>
              ))}
              <tr className="c15s-total">
                <td />
                <td>TOTAL</td>
                <td className="r tabular">{fmtBRL0(d.defasagemTot.previstoRs)}</td>
                <td className="r tabular">{fmtBRL0(d.defasagemTot.medidoRs)}</td>
                <td className="r tabular c15s-neg">{fmtBRL0(d.defasagemTot.defasagemRs)}</td>
                <td className="r tabular">{fmtPct1(d.defasagemTot.pctMed)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {achados.length ? (
        <section className="c15s-secao">
          <div className="c15s-secao-h">
            <h3 className="c15s-secao-t">Achados, melhorias recomendadas e síntese</h3>
            <span className="c15s-secao-sub">transcrição literal da análise — fonte C.15</span>
          </div>
          <Card className="c15s-rico">
            {achados.map((l, i) => (
              <Fragment key={i}>
                {l.t === "secao" ? <h4 className="c15s-rico-secao">{l.txt}</h4> : null}
                {l.t === "doc" ? (
                  <div className="c15s-rico-doc">
                    <span>{l.txt}</span>
                    {l.farol ? <Badge tone={sevTone(l.farol)}>{l.farol}</Badge> : null}
                  </div>
                ) : null}
                {l.t === "label" ? (
                  <div className={`c15s-rico-label ${l.ok ? "ok" : "no"}`}>{l.txt}</div>
                ) : null}
                {l.t === "bullet" ? (
                  <div className={`c15s-rico-bullet ${l.ok ? "ok" : ""}`}>
                    <span aria-hidden>{l.ok ? "✓" : "•"}</span>
                    {l.txt}
                  </div>
                ) : null}
                {l.t === "p" ? <p className="c15s-rico-p">{l.txt}</p> : null}
              </Fragment>
            ))}
          </Card>
        </section>
      ) : null}
    </main>
  );
}
