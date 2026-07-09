// Componente compartilhado da tela "Condutas Sugeridas e Geração de Documentos".
// Renderizado tanto pela aba do RMA (/rma/condutas) quanto pela rota top-level
// (/contracts/$id/condutas) acessível via Sidebar (2.1.6).
//
// Recebe contract + visaoGeral + bm via props · sem hooks de Route.

import { FarolCard, I } from "@/components/ds";
import type { IconName } from "@/components/ds";
import type {
  BmSnapshot,
  Conduta,
  CondutaCategoria,
  CondutasBM,
  DocGerado,
  DocTipoTag,
  VisaoGeralData,
} from "@/lib/mocks/obras";
import { getBm } from "@/lib/mocks/obras";
import "./CondutasView.css";

const FAROL_COLOR = {
  critico: "var(--danger)",
  risco: "var(--warning)",
  observacao: "var(--info)",
  conforme: "var(--success)",
} as const;

const DOC_TIPO_COLOR: Record<DocTipoTag, string> = {
  CARTA: "var(--danger)",
  ATA: "var(--info)",
  PARECER: "var(--brand)",
  PPN: "var(--warning)",
  "TAKE-OFF": "var(--success)",
  MEMORANDO: "var(--text-3)",
};

export function CondutasView({ visao, bmId }: { visao: VisaoGeralData; bmId?: string }) {
  const bm = getBm(visao, bmId);
  const c = bm.condutas;

  return (
    <main className="cnd-main">
      <CondHeader bm={bm} />
      <KpisRow c={c} bm={bm} />
      <PrioridadesBox texto={c.prioridadesTexto} />

      <header className="cnd-section-title-row">
        <h3 className="cnd-section-title">Condutas por Categoria</h3>
        <div className="cnd-section-sub">
          clique em "Gerar" pra emitir o documento via Adm Contratual IA
        </div>
      </header>

      {/* Primeiras 2 categorias full-width (Cartas + Take-offs) */}
      {c.categorias.slice(0, 2).map((cat) => (
        <CategoriaCard key={cat.id} cat={cat} />
      ))}

      {/* Restantes em grid 2 cols com Docs à direita */}
      <div className="cnd-grid">
        <div className="cnd-col-esq">
          {c.categorias.slice(2).map((cat) => (
            <CategoriaCard key={cat.id} cat={cat} />
          ))}
        </div>
        <div className="cnd-col-dir">
          <DocsGeradosCard docs={c.documentosGerados} totalBiblioteca={c.totalNaBiblioteca} />
        </div>
      </div>
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function CondHeader({ bm }: { bm: BmSnapshot }) {
  return (
    <header className="cnd-head">
      <div>
        <h2 className="cnd-titulo">
          RMA · Condutas Sugeridas e Geração de Documentos · {bm.numero}
        </h2>
        <p className="cnd-sub">
          Adm Contratual IA · entregáveis sugeridos a partir do estado atual do contrato · lista
          aberta · 1 clique pra gerar
        </p>
      </div>
    </header>
  );
}

// ── 4 KPIs (3 escuros + 1 vermelho de ação) ─────────────────────────

function KpisRow({ c, bm }: { c: CondutasBM; bm: BmSnapshot }) {
  return (
    <div className="cnd-kpis">
      <FarolCard
        label={`CONDUTAS SUGERIDAS PARA O ${bm.numero}`}
        icon="note"
        value={`${c.totalAcoes} ações`}
        info={c.totalAcoesNota}
        accent="ink"
      />
      <FarolCard
        label="PRIORIDADES DA SEMANA"
        icon="fire"
        value={c.prioridadesLabel}
        info={c.prioridadesNota}
        accent="ink"
      />
      <FarolCard
        label="DOCUMENTOS GERADOS NO MÊS"
        icon="doc"
        value={c.docsGerados}
        info={c.docsGeradosNota}
        accent="ink"
      />
      <article className="cnd-kpi-acao">
        <div className="cnd-kpi-label">GERAR EM LOTE</div>
        <div className="cnd-kpi-valor-acao">{c.loteLabel}</div>
        <button type="button" className="cnd-acao-btn">
          {I.fire({ size: 12 })} 1 clique
        </button>
      </article>
    </div>
  );
}

// ── Banner amarelo de prioridades ───────────────────────────────────

function PrioridadesBox({ texto }: { texto: string }) {
  return (
    <aside className="cnd-prioridades">
      <div className="cnd-prioridades-head">
        {I.fire({ size: 14 })} PRIORIDADES DESTA SEMANA · ADM CONTRATUAL IA
      </div>
      <p className="cnd-prioridades-texto">
        <FormattedText text={texto} />
      </p>
    </aside>
  );
}

// ── Categoria de condutas ───────────────────────────────────────────

function CategoriaCard({ cat }: { cat: CondutaCategoria }) {
  const IconFn = I[cat.iconKey as IconName] ?? I.note;
  return (
    <section className="cnd-categoria">
      <header className="cnd-categoria-head">
        <h3 className="cnd-categoria-titulo">
          <span className="cnd-categoria-icon">{IconFn({ size: 14 })}</span>
          {cat.titulo}
          <span className="cnd-categoria-count">· {cat.itens.length} sugestões</span>
        </h3>
        <div className="cnd-categoria-sub">{cat.sub}</div>
      </header>
      <div className="cnd-itens">
        {cat.itens.map((c) => (
          <CondutaItem key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}

function CondutaItem({ c }: { c: Conduta }) {
  return (
    <article className="cnd-item">
      <span
        className="cnd-item-dot"
        style={{ background: FAROL_COLOR[c.prioridade] }}
        aria-hidden
      />
      <div className="cnd-item-body">
        <div className="cnd-item-titulo">
          {c.titulo}
          {c.badgeUrgente && <span className="cnd-item-urgente">URGENTE</span>}
        </div>
        <div className="cnd-item-desc">
          <FormattedText text={c.descricao} />
        </div>
      </div>
      <button type="button" className="cnd-item-btn">
        {c.acaoLabel}
      </button>
    </article>
  );
}

// ── Documentos gerados no mês ───────────────────────────────────────

function DocsGeradosCard({
  docs,
  totalBiblioteca,
}: {
  docs: DocGerado[];
  totalBiblioteca: number;
}) {
  return (
    <section className="cnd-docs">
      <header className="cnd-docs-head">
        <h3 className="cnd-docs-titulo">
          <span className="cnd-docs-icon">{I.doc({ size: 14 })}</span>
          Documentos Gerados no Mês
        </h3>
        <div className="cnd-docs-sub">
          Histórico recente · arquivado na Biblioteca · pesquisável
        </div>
      </header>
      <div className="cnd-docs-tabela" role="table">
        <div className="cnd-docs-tabela-head" role="row">
          <div role="columnheader">Data</div>
          <div role="columnheader">Documento</div>
          <div role="columnheader">Tipo</div>
        </div>
        {docs.map((d) => (
          <div key={d.id} className="cnd-docs-row" role="row">
            <div role="cell" className="cnd-docs-data">
              {d.data}
            </div>
            <div role="cell" className="cnd-docs-nome">
              {d.documento}
            </div>
            <div role="cell">
              <span
                className="cnd-docs-tipo"
                style={{
                  background: `color-mix(in srgb, ${DOC_TIPO_COLOR[d.tipo]} 13%, transparent)`,
                  color: DOC_TIPO_COLOR[d.tipo],
                }}
              >
                {d.tipo}
              </span>
            </div>
          </div>
        ))}
      </div>
      <a className="cnd-docs-link" href="#biblioteca">
        Ver na Biblioteca ({totalBiblioteca})
      </a>
    </section>
  );
}

// ── Helper ──────────────────────────────────────────────────────────

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
