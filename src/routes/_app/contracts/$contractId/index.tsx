// C.1 Síntese do Contrato (entry point · M2.1.1) — identidade do contrato. Os KPIs financeiros + as
// tabelas (premissas, equipe, trechos, BDI) vêm REAIS do banco (curva/indiretos/prazo + obra_secoes
// via useSinteseContrato). O resíduo legal que não está no workbook (CNPJs, regime, foro, datas OS,
// reajuste, consórcio, admin contratual, links) fica "a cadastrar/editar" (amarelo) — convenção do
// próprio mockup ("campos em amarelo = a cadastrar/editar"). Dado é fato estático, não métrica.

import { createFileRoute } from "@tanstack/react-router";
import { Badge, Button, Card, EmptyState, FarolCard, I, Skeleton } from "@/components/ds";
import { useSinteseContrato } from "@/lib/hooks/useSinteseContrato";
import { useFaturamentoCurva } from "@/lib/hooks/useFaturamentoCurva";
import { useIndiretos } from "@/lib/hooks/useIndiretos";
import { usePrazoBm } from "@/lib/hooks/usePrazoBm";
import "./sintese.css";

export const Route = createFileRoute("/_app/contracts/$contractId/")({
  component: SintesePage,
  head: () => ({ meta: [{ title: "Síntese do Contrato — Adm Contratual IA" }] }),
});

// ── Formatadores ──────────────────────────────────────────────────────────────────────────────
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMi = (v: number | null) =>
  v != null
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
    : "—";
const fmtBRLcheio = (v: number | null) =>
  v != null ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : "—";
const fmtPct = (v: number | null, d = 2) =>
  v != null
    ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`
    : "—";
const fmtMesAno = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [y, m] = iso.split("-").map(Number);
  return m ? `${MESES[m - 1]}/${String(y).slice(2)}` : null;
};
const fmtDataBR = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : null;
};

// "a cadastrar/editar" — campo do PDF do contrato que não está no workbook (amarelo, convenção mockup).
function Cad() {
  return <span className="sin-cad">a cadastrar</span>;
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="sin-kv">
      <span className="sin-k">{k}</span>
      <span className="sin-v">{v == null || v === "" ? <Cad /> : v}</span>
    </div>
  );
}

function SintesePage() {
  const { contractId } = Route.useParams();
  const { data: sintese, isLoading: l1, isError: e1 } = useSinteseContrato(contractId);
  const { data: curva } = useFaturamentoCurva(contractId);
  const { data: indiretos } = useIndiretos(contractId);
  const { data: prazoBridge } = usePrazoBm(contractId);

  if (l1) {
    return (
      <main className="sin-main">
        <Skeleton style={{ height: 96 }} />
        <div className="sin-kpibar">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 104 }} />
          ))}
        </div>
        <Skeleton style={{ height: 280 }} />
      </main>
    );
  }
  if (e1 || !sintese) {
    return (
      <main className="sin-main">
        <Card>
          <EmptyState
            framed
            icon={I.doc({ size: 40 })}
            title={e1 ? "Não foi possível carregar a síntese" : "Síntese ainda não normalizada"}
            text={
              e1
                ? "Erro ao ler os dados normalizados desta obra. Tente recarregar."
                : "Esta obra não tem as seções do contrato (C.1) normalizadas no banco ainda."
            }
            action={
              e1 ? (
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Tentar novamente
                </Button>
              ) : undefined
            }
          />
        </Card>
      </main>
    );
  }

  const id = sintese.identidade;
  // Painéis cadastrais (legais / prazos): label do contrato → valor. il()/pz() devolvem null quando
  // ausente ou "(a cadastrar)" → KV/Fact pintam o amarelo "a cadastrar".
  const idl = sintese.identificacaoLegal;
  const prz = sintese.prazosContratuais;
  const il = (k: string) => idl?.[k] ?? null;
  const pz = (k: string) => prz?.[k] ?? null;
  const prazo = prazoBridge?.prazo ?? null;
  const pv = curva?.custoTotal ?? id?.valor ?? null;
  const custoDireto = indiretos?.custoDireto ?? null;
  const custoIndireto = pv != null && custoDireto != null ? pv - custoDireto : null;
  const bdiPct =
    custoDireto && custoDireto > 0 && custoIndireto != null
      ? (custoIndireto / custoDireto) * 100
      : null;
  const pctDiretoPV = pv && custoDireto != null ? (custoDireto / pv) * 100 : null;
  const pctIndiretoPV = pv && custoIndireto != null ? (custoIndireto / pv) * 100 : null;
  const prazoMeses = prazo
    ? Math.round(prazo.prazoContratualDias / 30.4)
    : (id?.prazoMeses ?? null);
  const inicio = fmtMesAno(prazo?.inicioISO);
  const fim = fmtMesAno(prazo?.fimContratualISO);
  const fin = sintese.financeiro;
  // faturamento médio = PV inicial ÷ prazo (spec C.1 · 39.766.038/18 = 2.209.224)
  const fatMedioMensal =
    (fin?.pvInicialRs ?? pv) != null && prazoMeses ? (fin?.pvInicialRs ?? pv)! / prazoMeses : null;
  // resumo curto do reajuste p/ o card ("+7,21% (PSP reajustada 09/08/2025) — …" → "reajuste +7,21%")
  const reajusteResumo = fin?.reajustesAplicados
    ? `reajuste ${fin.reajustesAplicados.split(" ")[0]}`
    : null;
  const est = sintese.estaqueamento;
  const trechoLinha =
    est?.kmInicial != null && est?.kmFinal != null
      ? `BR-101/RJ · km ${est.kmInicial.toLocaleString("pt-BR")} a ${est.kmFinal.toLocaleString("pt-BR")} · Macaé/RJ`
      : null;

  return (
    <main className="sin-main">
      {/* ── Hero ── */}
      <header className="sin-head">
        <div className="sin-head-top">
          <span className="sin-eyebrow">C.1 · Síntese do Contrato</span>
          <Badge tone="info">Identidade do contrato</Badge>
        </div>
        <h1 className="sin-titulo">{il("Nome do Negócio") ?? id?.objeto ?? "Contrato"}</h1>
        <p className="sin-sub">
          Identidade do contrato sempre acessível. Dados estáveis (mudam só com
          aditivo/reajuste/equipe). Campos <span className="sin-cad-inline">em amarelo</span> = a
          cadastrar/editar.
        </p>
      </header>

      {/* ── KPI bar ── */}
      <div className="sin-kpibar">
        <FarolCard
          label="VALOR INICIAL (PV)"
          icon="wallet"
          value={fmtBRLcheio(fin?.pvInicialRs ?? pv)}
          info="preço global de venda"
          accent="neutral"
        />
        <FarolCard
          label="VALOR ATUALIZADO"
          icon="trending"
          value={fmtBRLcheio(fin?.valorAtualizadoRs)}
          info={reajusteResumo ?? "reajuste aplicado"}
          accent="neutral"
        />
        <FarolCard
          label="ORÇAMENTO INTERNO (CUSTO)"
          icon="tag"
          value={fmtBRLcheio(fin?.orcamentoInternoRs)}
          info={
            fin?.margemPct != null
              ? `margem ${fmtPct(fin.margemPct, 2)} s/ valor atual`
              : "custo total"
          }
          accent="neutral"
        />
        <FarolCard
          label="BDI"
          icon="trending"
          value={fmtPct(fin?.bdiPct ?? bdiPct)}
          info={fin?.ciRs != null ? `CI ${fmtMi(fin.ciRs)}` : "sobre custo direto"}
          accent="neutral"
        />
        <FarolCard
          label="FATURAM. MÉDIO/MÊS"
          icon="wallet"
          value={fmtBRLcheio(fatMedioMensal)}
          info={prazoMeses != null ? `estimado em ${prazoMeses} meses` : "estimado"}
          accent="neutral"
        />
        <FarolCard
          label="PRAZO"
          icon="clock"
          value={prazoMeses != null ? `${prazoMeses} meses` : "—"}
          info={inicio && fim ? `${inicio} → ${fim}` : "—"}
          accent="neutral"
        />
      </div>

      {/* ── Identificação | Prazos e marcos ── */}
      <div className="sin-grid2">
        <Card className="sin-panel">
          <h3 className="sin-panel-t">{I.doc({ size: 15 })} Identificação</h3>
          <KV k="Objeto" v={il("Objeto")} />
          <KV k="Nº do Contrato" v={il("Nº do Contrato")} />
          <KV k="Processo administrativo" v={il("Nº do Processo Administrativo")} />
          <KV k="Regime de execução" v={il("Regime de Execução")} />
          <KV k="Licitação vinculada" v={il("Licitação Vinculada")} />
          <KV k="Contratante" v={il("Contratante") ?? id?.contratante} />
          <KV k="CNPJ Contratante" v={il("CNPJ Contratante")} />
          <KV k="Contratada" v={il("Contratada")} />
          <KV k="CNPJ Contratada" v={il("CNPJ Contratada")} />
          <KV k="Consórcio" v={il("Consórcio")} />
          <KV k="Subcontratação" v={il("Subcontratação permitida")} />
          <KV k="Foro" v={il("Foro Contratual")} />
        </Card>

        <Card className="sin-panel">
          <h3 className="sin-panel-t">{I.calendar({ size: 15 })} Prazos e marcos</h3>
          <KV k="OS original" v={pz("OS Original")} />
          <KV k="OS real" v={pz("OS Real")} />
          <KV
            k="Prazo de execução"
            v={prazoMeses != null ? `${prazoMeses} meses` : pz("Prazo de Execução")}
          />
          <KV k="Início" v={inicio ?? pz("Início da Execução")} />
          <KV k="Término previsto" v={fim ?? pz("Término Previsto")} />
          <KV
            k="Término contratual"
            v={pz("Término Contratual") ?? fmtDataBR(prazo?.fimContratualISO)}
          />
          <KV k="Aceitação provisória (TAP)" v={pz("Aceitação Provisória (TAP)")} />
          <KV k="Aceitação definitiva (TAD)" v={pz("Aceitação Definitiva (TAD)")} />
          <KV k="Período chuvoso (baseline)" v={pz("Período Chuvoso (baseline)")} />
        </Card>
      </div>

      {/* ── Econômico-financeiro ── */}
      <Card className="sin-panel">
        <h3 className="sin-panel-t">{I.wallet({ size: 15 })} Econômico-financeiro</h3>
        <div className="sin-econ">
          <KV k="Valor total atualizado" v={fmtBRLcheio(pv)} />
          <KV k="Data-base do orçamento" v={fmtDataBR(sintese.dataBaseOrcamento)} />
          <KV
            k="Aniversário de reajuste"
            v={fin?.aniversarioReajuste ?? pz("Aniversário de Reajuste")}
          />
          <KV k="Índices de reajuste" v={fin?.indicesReajuste ?? pz("Índices de Reajuste")} />
          <KV
            k="Reajustes aplicados"
            v={fin?.reajustesAplicados ?? <span className="sin-muted">Ainda não há</span>}
          />
          <KV
            k="Reequilíbrios aplicados"
            v={fin?.reequilibriosAplicados ?? <span className="sin-muted">Ainda não há</span>}
          />
          <KV k="Aditivos" v={fin?.aditivos ?? <span className="sin-muted">Ainda não há</span>} />
          <KV k="Faturamento médio mensal" v={fmtBRLcheio(fatMedioMensal)} />
        </div>
      </Card>

      {/* ── Premissas por frente ── */}
      <Section titulo="Premissas de orçamento — por frente">
        <div className="sin-tabela sin-tabela-prem" role="table">
          <div className="sin-th" role="row">
            <span role="columnheader">Frente / disciplina</span>
            <span className="r" role="columnheader">
              Valor contratado
            </span>
            <span className="r" role="columnheader">
              % do PV
            </span>
          </div>
          {sintese.premissas.map((p) => (
            <div className="sin-tr" role="row" key={p.frente}>
              <span className="sin-forte" role="cell">
                {p.frente}
              </span>
              <span className="r tabular" role="cell">
                {fmtBRLcheio(p.valor)}
              </span>
              <span className="sin-pctcell" role="cell">
                <span
                  className="sin-bar"
                  style={{ width: `${Math.min(100, p.pctPV ?? 0)}%` }}
                  aria-hidden
                />
                <span className="tabular">{fmtPct(p.pctPV, 1)}</span>
              </span>
            </div>
          ))}
          <div className="sin-tr sin-tr-total" role="row">
            <span className="sin-forte" role="cell">
              TOTAL (frentes principais)
            </span>
            <span className="r tabular" role="cell">
              {fmtBRLcheio(sintese.premissasTotal)}
            </span>
            <span className="r tabular" role="cell">
              {pv ? fmtPct((sintese.premissasTotal / pv) * 100, 1) : "—"}
            </span>
          </div>
        </div>
      </Section>

      {/* ── Equipe e contatos ── */}
      <Section titulo="Equipe e contatos">
        <div className="sin-tabela sin-tabela-eq" role="table">
          <div className="sin-th" role="row">
            <span role="columnheader">Função</span>
            <span role="columnheader">Nome</span>
            <span role="columnheader">Documento / contato</span>
          </div>
          {sintese.equipe.map((m, i) => (
            <div className="sin-tr" role="row" key={`${m.nome}-${i}`}>
              <span role="cell">{m.funcao}</span>
              <span className="sin-forte" role="cell">
                {m.nome}
              </span>
              <span role="cell">{m.documento ?? m.designacao ?? "—"}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Trechos × valor ── */}
      <Section
        titulo="Segmentação física por edificação (preço de venda)"
        sub={
          est
            ? `km ${est.kmInicial?.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} a ${est.kmFinal?.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} · extensão ${est.extensaoKm?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km · ${est.nSegmentos} segmentos`
            : undefined
        }
      >
        <div className="sin-tabela sin-tabela-tr" role="table">
          <div className="sin-th" role="row">
            <span role="columnheader">Edificação / frente</span>
            <span role="columnheader">km</span>
            <span className="r" role="columnheader">
              Valor
            </span>
          </div>
          {sintese.trechos.map((t, i) => (
            <div className="sin-tr" role="row" key={`${t.trecho}-${i}`}>
              <span className="sin-forte" role="cell">
                {t.trecho}
              </span>
              <span className="tabular" role="cell">
                {t.km ?? "—"}
              </span>
              <span className="r tabular" role="cell">
                {fmtBRLcheio(t.valor)}
              </span>
            </div>
          ))}
          <div className="sin-tr sin-tr-total" role="row">
            <span className="sin-forte" role="cell">
              TOTAL
            </span>
            <span role="cell" />
            <span className="r tabular" role="cell">
              {fmtBRLcheio(sintese.trechosTotal)}
            </span>
          </div>
        </div>
      </Section>

      {/* ── Orçamento interno por grupo de custo ── */}
      {sintese.orcamentoGrupos.itens.length > 0 ? (
        <Section
          titulo="Orçamento interno por grupo de custo"
          sub={`${sintese.orcamentoGrupos.itens.length} grupos · visão de custo interno (≠ preço de venda)`}
        >
          <div className="sin-tabela sin-tabela-prem" role="table">
            <div className="sin-th" role="row">
              <span role="columnheader">Grupo de custo</span>
              <span className="r" role="columnheader">
                Valor
              </span>
              <span className="r" role="columnheader">
                % do total
              </span>
            </div>
            {[...sintese.orcamentoGrupos.itens]
              .sort((a, b) => (b.valorRs ?? 0) - (a.valorRs ?? 0))
              .map((g) => (
                <div className="sin-tr" role="row" key={g.grupo}>
                  <span className="sin-forte" role="cell">
                    {g.grupo}
                  </span>
                  <span className="r tabular" role="cell">
                    {fmtBRLcheio(g.valorRs)}
                  </span>
                  <span className="sin-pctcell" role="cell">
                    <span
                      className="sin-bar"
                      style={{ width: `${Math.min(100, (g.pct ?? 0) * 100)}%` }}
                      aria-hidden
                    />
                    <span className="tabular">{fmtPct((g.pct ?? 0) * 100, 1)}</span>
                  </span>
                </div>
              ))}
            <div className="sin-tr sin-tr-total" role="row">
              <span className="sin-forte" role="cell">
                TOTAL
              </span>
              <span className="r tabular" role="cell">
                {fmtBRLcheio(sintese.orcamentoGrupos.totalRs)}
              </span>
              <span role="cell" />
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── Documentos-chave ── */}
      <Section titulo="Documentos-chave">
        <div className="sin-docs">
          <DocChip ok label={sintese.documentos?.contratoInterno ?? "Contrato"} />
          <DocChip label="Anexos do contrato" valor={sintese.documentos?.anexos} />
          <DocChip label="Proposta" valor={sintese.documentos?.proposta} />
        </div>
      </Section>

      {/* ── Leitura da Síntese (IA) ── */}
      <Card className="sin-ia">
        <div className="sin-ia-tag">
          {I.star({ size: 12 })} IA · Adm Contratual · Leitura da Síntese
        </div>
        <p className="sin-ia-text">
          Contrato de <strong>{fmtMi(pv)}</strong> (BDI <strong>{fmtPct(bdiPct)}</strong>),{" "}
          {prazoMeses != null ? `${prazoMeses} meses` : "—"}
          {inicio && fim ? ` (${inicio} → ${fim})` : ""}. Custo direto{" "}
          <strong>{fmtMi(custoDireto)}</strong> ({fmtPct(pctDiretoPV, 1)} do PV) e custo
          indireto/BDI <strong>{fmtMi(custoIndireto)}</strong> ({fmtPct(pctIndiretoPV, 1)} do PV).
        </p>
        {sintese.premissas.length > 0 ? (
          <p className="sin-ia-text">
            As frentes de maior peso:{" "}
            {[...sintese.premissas]
              .sort((a, b) => (b.pctPV ?? 0) - (a.pctPV ?? 0))
              .slice(0, 3)
              .map((p) => `${p.frente} (${fmtPct(p.pctPV, 1)})`)
              .join(", ")}
            . O instrumento contratual está cadastrado (CNPJs, regime, foro CAM-CCBC, OS{" "}
            {pz("OS Real") ? "real 09/03/26 com +66 dias" : "real"}, término contratual 05/01/30);
            pendem apenas a administração contratual e os links dos documentos.
          </p>
        ) : null}
      </Card>
    </main>
  );
}

function Fact({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div className="sin-fact">
      <span className="sin-fact-l">{l}</span>
      <span className="sin-fact-v">{v == null || v === "" ? <Cad /> : v}</span>
    </div>
  );
}
function Section({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sin-section">
      <div className="sin-section-h">
        <h3 className="sin-section-t">{titulo}</h3>
        {sub ? <span className="sin-section-sub">{sub}</span> : null}
      </div>
      {children}
    </section>
  );
}
function DocChip({ label, ok, valor }: { label: string; ok?: boolean; valor?: string | null }) {
  const disponivel = ok || !!valor;
  return (
    <span className={`sin-doc-chip${disponivel ? "" : " sin-doc-chip-cad"}`}>
      {I.doc({ size: 13 })} {label}
      {disponivel ? null : <span className="sin-doc-cad"> · a cadastrar</span>}
    </span>
  );
}
