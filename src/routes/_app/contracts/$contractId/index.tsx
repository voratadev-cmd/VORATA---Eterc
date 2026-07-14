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
import { useObra } from "@/lib/hooks/useObra";
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
  const { data: obra } = useObra(contractId);

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
  // Busca por rótulo: exata primeiro, depois normalizada por inclusão (a captura pode grafar o
  // rótulo com pequenas variações entre obras — "OS Original" × "Data da Ordem de Serviço").
  const kvPick = (m: Record<string, string | null> | null, ...keys: string[]): string | null => {
    if (!m) return null;
    for (const k of keys) if (m[k] != null) return m[k];
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const entries = Object.entries(m);
    for (const k of keys) {
      const hit = entries.find(([kk, vv]) => vv != null && norm(kk).includes(norm(k)));
      if (hit) return hit[1];
    }
    return null;
  };
  const il = (...k: string[]) => kvPick(idl, ...k);
  const pz = (...k: string[]) => kvPick(prz, ...k);
  const prazo = prazoBridge?.prazo ?? null;
  const pv = curva?.custoTotal ?? id?.valor ?? null;
  const custoDireto = indiretos?.custoDireto ?? null;
  const custoIndireto = pv != null && custoDireto != null ? pv - custoDireto : null;
  // BDI derivado é FALLBACK — o oficial vem do Painel 3 (fin.bdiPct). Derivar do pv da CURVA
  // (total do CFF, +R$ 10.000) dava 22,43% onde o contrato declara 22,40% (spec v3 A.3).
  const bdiPct =
    custoDireto && custoDireto > 0 && custoIndireto != null
      ? (custoIndireto / custoDireto) * 100
      : null;
  const prazoMeses = prazo
    ? Math.round(prazo.prazoContratualDias / 30.4)
    : (id?.prazoMeses ?? null);
  // Datas de nível CONTRATO por precedência (spec v3 A.2): premissas oficiais declaradas
  // (obras.premissas.datas_oficiais) → obras row → cronograma (bridge). O cronograma é a curva
  // planejada (CFF) — mostrava 01/10→31/03 onde o contrato diz OS 22/09.
  const premissasObra = (
    obra as {
      premissas?: { datas_oficiais?: { termino_execucao?: string; tap?: string; tad?: string } };
    } | null
  )?.premissas;
  const inicioISO = obra?.data_inicio ?? prazo?.inicioISO ?? null;
  const terminoISO =
    premissasObra?.datas_oficiais?.termino_execucao ??
    obra?.data_termino ??
    prazo?.fimContratualISO ??
    null;
  const inicio = fmtMesAno(inicioISO);
  const fim = fmtMesAno(terminoISO);
  const fin = sintese.financeiro;
  // faturamento médio = PV inicial ÷ prazo (spec C.1 · 39.766.038/18 = 2.209.224)
  const fatMedioMensal =
    (fin?.pvInicialRs ?? pv) != null && prazoMeses ? (fin?.pvInicialRs ?? pv)! / prazoMeses : null;
  // resumo curto do reajuste p/ o card ("+7,21% (PSP reajustada 09/08/2025) — …" → "reajuste +7,21%")
  const reajusteResumo = fin?.reajustesAplicados
    ? `reajuste ${fin.reajustesAplicados.split(" ")[0]}`
    : null;
  // Bases da leitura IA (spec v3 A.3): % sobre o PV OFICIAL; CI do Painel 3 (não pv−CD, que herda
  // o +10k do CFF); atualizado com a ressalva de revalidação contra a PSP reajustada.
  const pvOficial = fin?.pvInicialRs ?? pv;
  const custoIndiretoIa = fin?.ciRs ?? custoIndireto;
  const pctDiretoPV = pvOficial && custoDireto != null ? (custoDireto / pvOficial) * 100 : null;
  const pctIndiretoPV =
    pvOficial && custoIndiretoIa != null ? (custoIndiretoIa / pvOficial) * 100 : null;
  const reajusteToken = fin?.reajustesAplicados
    ? `${fin.reajustesAplicados.split(" ")[0]} — revalidar contra a PSP reajustada`
    : null;
  const est = sintese.estaqueamento;
  const trechoLinha =
    est?.kmInicial != null && est?.kmFinal != null
      ? `BR-101/RJ · km ${est.kmInicial.toLocaleString("pt-BR")} a ${est.kmFinal.toLocaleString("pt-BR")} · Macaé/RJ`
      : null;
  // Segmentação: % da fonte quando existe; delta vs PSQ só quando a quebra vem do CFF e diverge
  // do PV (spec v3 A.1/G.1: exibir o total do CFF SEMPRE com a nota da divergência +R$ 10.000).
  const temPctSeg = sintese.trechos.some((t) => t.pct != null);
  const deltaCffPsq =
    fin?.pvInicialRs != null &&
    sintese.trechosTotal > 0 &&
    Math.abs(sintese.trechosTotal - fin.pvInicialRs) > 0.5
      ? sintese.trechosTotal - fin.pvInicialRs
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
          {/* Nível CONTRATO: OS/término/TAP/TAD por precedência oficial (spec v3 A.2/Parte C) —
              premissas declaradas → obras row → Painel 2 da fonte → cronograma. */}
          <KV
            k="OS original / Início autorizado"
            v={pz("OS Original", "Data da Ordem de Serviço") ?? fmtDataBR(obra?.data_inicio)}
          />
          <KV
            k="Prazo de execução"
            v={pz("Prazo de Execução") ?? (prazoMeses != null ? `${prazoMeses} meses` : null)}
          />
          <KV k="Início" v={inicio ?? pz("Início da Execução")} />
          <KV k="Término previsto (execução)" v={fmtDataBR(terminoISO) ?? pz("Término Previsto")} />
          <KV k="Término contratual" v={fmtDataBR(terminoISO) ?? pz("Término Contratual")} />
          <KV
            k="Aceitação provisória (TAP)"
            v={
              fmtDataBR(premissasObra?.datas_oficiais?.tap) ??
              pz("Aceitação Provisória (TAP)", "Recebimento Provisório")
            }
          />
          <KV
            k="Aceitação definitiva (TAD)"
            v={
              fmtDataBR(premissasObra?.datas_oficiais?.tad) ??
              pz("Aceitação Definitiva (TAD)", "Recebimento Definitivo")
            }
          />
          <KV k="Período chuvoso (baseline)" v={pz("Período Chuvoso (baseline)")} />
        </Card>
      </div>

      {/* ── Econômico-financeiro ── */}
      <Card className="sin-panel">
        <h3 className="sin-panel-t">{I.wallet({ size: 15 })} Econômico-financeiro</h3>
        <div className="sin-econ">
          {/* PV oficial (PSQ), não o total do CFF — e o rótulo deixou de ecoar o card "VALOR
              ATUALIZADO" do topo (spec v3 A.1: são conceitos diferentes na mesma casa). */}
          <KV k="Valor total do contrato (PV)" v={fmtBRLcheio(fin?.pvInicialRs ?? pv)} />
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
      {/* SBSO não tem o "Painel 5" tabular — a equipe vem do KV "Painel Administração Contratual"
          (spec v3 Parte F); obras com o Painel 5 seguem na tabela de 3 colunas. */}
      <Section titulo="Equipe e contatos">
        <div className="sin-tabela sin-tabela-eq" role="table">
          <div className="sin-th" role="row">
            <span role="columnheader">Função</span>
            <span role="columnheader">Nome</span>
            <span role="columnheader">Documento / contato</span>
          </div>
          {sintese.equipe.length > 0
            ? sintese.equipe.map((m, i) => (
                <div className="sin-tr" role="row" key={`${m.nome}-${i}`}>
                  <span role="cell">{m.funcao}</span>
                  <span className="sin-forte" role="cell">
                    {m.nome}
                  </span>
                  <span role="cell">{m.documento ?? m.designacao ?? "—"}</span>
                </div>
              ))
            : sintese.equipeContatos.map((m) => (
                <div className="sin-tr" role="row" key={m.funcao}>
                  <span role="cell">{m.funcao}</span>
                  <span className="sin-forte" role="cell">
                    {m.nome}
                  </span>
                  <span role="cell">—</span>
                </div>
              ))}
          {sintese.equipe.length === 0 && sintese.equipeContatos.length === 0 ? (
            <div className="sin-tr" role="row">
              <span role="cell">
                <Cad />
              </span>
              <span role="cell" />
              <span role="cell" />
            </div>
          ) : null}
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
            {/* Coluna do meio: km nas obras lineares (BR-101) · % da quebra nas de edificação
                (SBSO tem a coluna na fonte — spec v3 Parte G.1). */}
            <span className={temPctSeg ? "r" : ""} role="columnheader">
              {temPctSeg ? "% do total" : "km"}
            </span>
            <span className="r" role="columnheader">
              Valor
            </span>
          </div>
          {sintese.trechos.map((t, i) => (
            <div className="sin-tr" role="row" key={`${t.trecho}-${i}`}>
              <span className="sin-forte" role="cell">
                {t.trecho}
              </span>
              <span className={`tabular${temPctSeg ? " r" : ""}`} role="cell">
                {temPctSeg ? fmtPct(t.pct, 2) : (t.km ?? "—")}
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
            <span className={temPctSeg ? "r tabular" : ""} role="cell">
              {temPctSeg ? "100,00%" : ""}
            </span>
            <span className="r tabular" role="cell">
              {fmtBRLcheio(sintese.trechosTotal)}
            </span>
          </div>
        </div>
        {deltaCffPsq != null ? (
          <p className="sin-nota">
            Total desta quebra = <strong>{fmtBRLcheio(sintese.trechosTotal)}</strong> — baseline do
            CFF aprovado ({deltaCffPsq > 0 ? "+" : "−"}
            {fmtBRLcheio(Math.abs(deltaCffPsq))} vs a PSQ contratual de{" "}
            {fmtBRLcheio(fin?.pvInicialRs ?? null)}, divergência documental em reconciliação).
          </p>
        ) : null}
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

      {/* ── Área / escopo físico (existe na fonte SBSO — spec v3 Parte G.3) ── */}
      {sintese.areaEscopo ? (
        <Card className="sin-panel">
          <h3 className="sin-panel-t">{I.map({ size: 15 })} Área / escopo físico</h3>
          <KV k="Área construída — TPS" v={sintese.areaEscopo.area} />
          <KV k="Edificações do escopo" v={sintese.areaEscopo.edificacoes} />
          <KV k="Natureza do escopo" v={sintese.areaEscopo.natureza} />
        </Card>
      ) : null}

      {/* ── Documentos-chave ── */}
      {/* Fonte em LISTA (SBSO · 10 documentos da aba) tem precedência; formato KV (Painel 6) segue
          nos chips de link (spec v3 Parte G.2). */}
      <Section titulo="Documentos-chave">
        {sintese.documentosLista.length > 0 ? (
          <div className="sin-docs">
            {sintese.documentosLista.map((d) => (
              <DocChip key={d} ok label={d} />
            ))}
          </div>
        ) : (
          <div className="sin-docs">
            <DocChip ok label={sintese.documentos?.contratoInterno ?? "Contrato"} />
            <DocChip label="Anexos do contrato" valor={sintese.documentos?.anexos} />
            <DocChip label="Proposta" valor={sintese.documentos?.proposta} />
          </div>
        )}
      </Section>

      {/* ── Leitura da Síntese (IA) ── */}
      {/* Template da spec v3 A.3: PV oficial (não o CFF), BDI do Painel 3 (22,40% — derivar do
          CFF dava o 22,43% errado), CD/CI com % sobre o PV. Sem literais de outra obra. */}
      <Card className="sin-ia">
        <div className="sin-ia-tag">
          {I.star({ size: 12 })} IA · Adm Contratual · Leitura da Síntese
        </div>
        <p className="sin-ia-text">
          Contrato <strong>{fmtMi(pvOficial)}</strong> (PV)
          {fin?.valorAtualizadoRs != null ? (
            <>
              , atualizado <strong>{fmtMi(fin.valorAtualizadoRs)}</strong>
              {reajusteToken ? ` (${reajusteToken})` : ""}
            </>
          ) : null}
          . BDI <strong>{fmtPct(fin?.bdiPct ?? bdiPct)}</strong>. Custo direto{" "}
          <strong>{fmtMi(custoDireto)}</strong> ({fmtPct(pctDiretoPV, 1)} do PV), custo indireto/BDI{" "}
          <strong>{fmtMi(custoIndiretoIa)}</strong> ({fmtPct(pctIndiretoPV, 1)} do PV).{" "}
          {prazoMeses != null ? `${prazoMeses} meses` : "—"}
          {inicio && fim ? ` (${inicio} → ${fim})` : ""}.
        </p>
        {sintese.premissas.length > 0 ? (
          <p className="sin-ia-text">
            As frentes de maior peso:{" "}
            {[...sintese.premissas]
              .sort((a, b) => (b.pctPV ?? 0) - (a.pctPV ?? 0))
              .slice(0, 3)
              .map((p) => `${p.frente} (${fmtPct(p.pctPV, 1)})`)
              .join(", ")}
            .
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
