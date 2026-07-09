// 5.7 Biblioteca de Documentos — arquivo completo do contrato.
// Filtros funcionais na sidebar esquerda · busca local · paginação client-side.
// Toggle Lista/Cards · grid responsivo.

import { useMemo, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FarolCard, I } from "@/components/ds";
import { getContract } from "@/lib/mocks/contracts";
import {
  type BibliotecaData,
  type DocBibSetor,
  type DocBibStatus,
  type DocBibTipo,
  type DocumentoBiblioteca,
  getObra,
} from "@/lib/mocks/obras";
import "./biblioteca.css";

export const Route = createFileRoute("/_app/contracts/$contractId/biblioteca")({
  component: BibliotecaAba,
  loader: ({ params }) => {
    const contract = getContract(params.contractId);
    if (!contract) throw notFound();
    const obra = getObra(params.contractId);
    if (!obra || !obra.biblioteca) throw notFound();
    return { contract, dados: obra.biblioteca };
  },
  head: () => ({ meta: [{ title: "Biblioteca de Documentos — RDM IA" }] }),
});

// ── Mapas visuais por tipo / status / setor ──────────────────────────

const TIPO_LABEL: Record<DocBibTipo, string> = {
  rdo: "RDOs",
  ata: "Atas de reunião",
  carta: "Cartas",
  boletim: "Boletins de Medição",
  projeto: "Projetos / revisões",
  cronograma: "Cronogramas",
  memorando: "Memorandos",
  rnc: "RNCs",
  ppn: "PPNs",
  sit: "SITs",
  tac: "TACs",
  parecer: "Pareceres / análises",
  foto: "Fotos / mídia",
};

const TIPO_LABEL_SINGULAR: Record<DocBibTipo, string> = {
  rdo: "RDO",
  ata: "Ata",
  carta: "Carta",
  boletim: "Boletim",
  projeto: "Projeto",
  cronograma: "Cronograma",
  memorando: "Memorando",
  rnc: "RNC",
  ppn: "PPN",
  sit: "SIT",
  tac: "TAC",
  parecer: "Parecer",
  foto: "Mídia",
};

const TIPO_COR: Record<DocBibTipo, string> = {
  rdo: "var(--info)",
  ata: "#2a5fb8",
  carta: "var(--danger)",
  boletim: "var(--brand-600)",
  projeto: "#1e6f4f",
  cronograma: "var(--warning)",
  memorando: "var(--text-3)",
  rnc: "var(--danger)",
  ppn: "var(--warning)",
  sit: "var(--info)",
  tac: "var(--brand)",
  parecer: "var(--brand)",
  foto: "var(--text-3)",
};

const TIPO_ICON_KEY: Record<
  DocBibTipo,
  | "doc"
  | "note"
  | "edit"
  | "tag"
  | "pkg"
  | "calendar"
  | "check"
  | "trash"
  | "wallet"
  | "users"
  | "book"
> = {
  rdo: "doc",
  ata: "note",
  carta: "edit",
  boletim: "tag",
  projeto: "pkg",
  cronograma: "calendar",
  memorando: "doc",
  rnc: "trash",
  ppn: "wallet",
  sit: "check",
  tac: "users",
  parecer: "book",
  foto: "pkg",
};

const STATUS_LABEL: Record<DocBibStatus, string> = {
  vinculada: "VINCULADA",
  arquivo: "ARQUIVO",
  "rascunho-ia": "RASCUNHO IA",
  urgente: "URGENTE",
  publicada: "PUBLICADA",
};

const STATUS_COR: Record<DocBibStatus, string> = {
  vinculada: "var(--danger)",
  arquivo: "var(--info)",
  "rascunho-ia": "var(--warning)",
  urgente: "var(--danger)",
  publicada: "var(--success)",
};

const SETOR_LABEL: Record<DocBibSetor, string> = {
  mobilizacao: "Mobilização",
  engenharia: "Engenharia",
  planejamento: "Planejamento",
  medicao: "Medição",
  producao: "Produção",
  "qualidade-seguranca": "Qualidade/Segurança",
};

const TIPOS_ORDEM: DocBibTipo[] = [
  "rdo",
  "ata",
  "carta",
  "boletim",
  "projeto",
  "cronograma",
  "memorando",
  "rnc",
  "ppn",
  "sit",
  "tac",
  "parecer",
  "foto",
];

const SETORES_ORDEM: DocBibSetor[] = [
  "mobilizacao",
  "engenharia",
  "planejamento",
  "medicao",
  "producao",
  "qualidade-seguranca",
];

const ITEMS_PER_PAGE = 8;

function BibliotecaAba() {
  const { contract, dados } = Route.useLoaderData();

  // State local
  const [tipoFiltro, setTipoFiltro] = useState<DocBibTipo | "todos">("todos");
  const [setorFiltro, setSetorFiltro] = useState<DocBibSetor | "todos">("todos");
  const [busca, setBusca] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [view, setView] = useState<"cards" | "lista">("cards");

  // Aplica filtros
  const docsFiltrados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return dados.documentos
      .filter((d) => {
        if (tipoFiltro !== "todos" && d.tipo !== tipoFiltro) return false;
        if (setorFiltro !== "todos" && d.setor !== setorFiltro) return false;
        if (buscaLower) {
          const haystack =
            `${d.codigo} ${d.descricao} ${d.autor} ${d.destinatario ?? ""}`.toLowerCase();
          if (!haystack.includes(buscaLower)) return false;
        }
        return true;
      })
      .sort((a, b) => b.dataISO.localeCompare(a.dataISO));
  }, [dados.documentos, tipoFiltro, setorFiltro, busca]);

  const docsVisiveis = docsFiltrados.slice(0, page * ITEMS_PER_PAGE);
  const totalRestantes = docsFiltrados.length - docsVisiveis.length;
  const proximaCarga = Math.min(ITEMS_PER_PAGE, totalRestantes);

  // Reset page quando filtros mudam
  const resetPage = () => setPage(1);

  return (
    <main className="bib-main">
      <BibHeader contractName={contract.nome} />
      <SearchBar
        busca={busca}
        onBuscaChange={(v) => {
          setBusca(v);
          resetPage();
        }}
        totalPaginasOCR={dados.totalPaginasOCR}
      />
      <KpisRow d={dados} />

      <div className="bib-layout">
        <Sidebar
          dados={dados}
          tipoFiltro={tipoFiltro}
          setorFiltro={setorFiltro}
          onTipoChange={(t) => {
            setTipoFiltro(t);
            resetPage();
          }}
          onSetorChange={(s) => {
            setSetorFiltro(s);
            resetPage();
          }}
        />

        <div className="bib-content">
          <ResultsHeader
            tipoFiltro={tipoFiltro}
            setorFiltro={setorFiltro}
            totalFiltrados={docsFiltrados.length}
            view={view}
            onViewChange={setView}
          />

          {docsVisiveis.length === 0 ? (
            <EmptyState />
          ) : view === "cards" ? (
            <CardsGrid docs={docsVisiveis} />
          ) : (
            <ListaView docs={docsVisiveis} />
          )}

          {totalRestantes > 0 && (
            <button
              type="button"
              className="bib-carregar-mais"
              onClick={() => setPage((p) => p + 1)}
            >
              ↓ Carregar próximos {proximaCarga} documentos ({totalRestantes} restantes)
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function BibHeader({ contractName }: { contractName: string }) {
  return (
    <header className="bib-head">
      <div>
        <h2 className="bib-titulo">Biblioteca de Documentos · {contractName}</h2>
        <p className="bib-sub">
          Arquivo completo de tudo produzido no contrato · pesquisável · indexado por OCR ·
          organizado por data, tipo, setor e evento
        </p>
      </div>
      <div className="bib-head-actions">
        <button type="button" className="bib-btn bib-btn-ghost">
          {I.plus({ size: 14 })} Upload
        </button>
        <button type="button" className="bib-btn bib-btn-ink">
          {I.fire({ size: 14 })} Gerar novo doc
        </button>
      </div>
    </header>
  );
}

// ── Search bar ───────────────────────────────────────────────────────

function SearchBar({
  busca,
  onBuscaChange,
  totalPaginasOCR,
}: {
  busca: string;
  onBuscaChange: (v: string) => void;
  totalPaginasOCR: number;
}) {
  return (
    <div className="bib-search">
      <span className="bib-search-icon">{I.search({ size: 16 })}</span>
      <input
        type="text"
        className="bib-search-input"
        placeholder={`Buscar por nome, conteúdo, número, autor... (busca full-text indexada · ${totalPaginasOCR.toLocaleString("pt-BR")} páginas OCR)`}
        value={busca}
        onChange={(e) => onBuscaChange(e.target.value)}
      />
      <button type="button" className="bib-btn-avancado">
        Avançado ▾
      </button>
      <button type="button" className="bib-btn-buscar">
        Buscar
      </button>
    </div>
  );
}

// ── 5 KPIs ───────────────────────────────────────────────────────────

function KpisRow({ d }: { d: BibliotecaData }) {
  return (
    <div className="bib-kpis">
      <FarolCard
        label="DOCUMENTOS"
        icon="doc"
        value={d.totalDocumentos}
        info={d.totalDocumentosNota}
        accent="neutral"
      />
      <FarolCard
        label="PÁGINAS COM OCR"
        icon="book"
        value={d.totalPaginasOCR.toLocaleString("pt-BR")}
        info={d.paginasOCRNota}
        accent="neutral"
      />
      <FarolCard
        label="ÚLTIMA ATUALIZAÇÃO"
        icon="clock"
        value={d.ultimaAtualizacaoLabel}
        info={d.ultimaAtualizacaoNota}
        accent="neutral"
      />
      <FarolCard
        label="GERADOS PELA IA"
        icon="fire"
        value={d.geradosPelaIA}
        info={d.geradosPelaIANota}
        accent="brand"
      />
      <FarolCard
        label="VINCULADOS A PLEITO"
        icon="link"
        value={d.vinculadosAPleito}
        info={d.vinculadosNota}
        accent="danger"
      />
    </div>
  );
}

// ── Sidebar de filtros ───────────────────────────────────────────────

function Sidebar({
  dados,
  tipoFiltro,
  setorFiltro,
  onTipoChange,
  onSetorChange,
}: {
  dados: BibliotecaData;
  tipoFiltro: DocBibTipo | "todos";
  setorFiltro: DocBibSetor | "todos";
  onTipoChange: (t: DocBibTipo | "todos") => void;
  onSetorChange: (s: DocBibSetor | "todos") => void;
}) {
  return (
    <aside className="bib-sidebar">
      {/* FILTROS principais (dropdowns visuais) */}
      <div className="bib-side-section">
        <div className="bib-side-title">FILTROS</div>
        <ul className="bib-side-list">
          <li className="bib-side-item-static">
            <span className="bib-side-icon">{I.calendar({ size: 12 })}</span>
            Período: contrato inteiro ▾
          </li>
          <li className="bib-side-item-static">
            <span className="bib-side-icon">{I.user({ size: 12 })}</span>
            Autor: todos ▾
          </li>
          <li className="bib-side-item-static">
            <span className="bib-side-icon">{I.link({ size: 12 })}</span>
            Vinculado a evento ▾
          </li>
        </ul>
      </div>

      {/* TIPO DE DOCUMENTO */}
      <div className="bib-side-section">
        <div className="bib-side-title">TIPO DE DOCUMENTO</div>
        <ul className="bib-side-list">
          <li>
            <button
              type="button"
              className={`bib-side-btn ${tipoFiltro === "todos" ? "bib-side-btn-on" : ""}`}
              onClick={() => onTipoChange("todos")}
            >
              <span className="bib-side-icon">{I.book({ size: 12 })}</span>
              <span className="bib-side-label">Todos os tipos</span>
              <span className="bib-side-count">{dados.totalDocumentos}</span>
            </button>
          </li>
          {TIPOS_ORDEM.map((t) => {
            const count = dados.contadoresPorTipo[t];
            const IconFn = I[TIPO_ICON_KEY[t]];
            return (
              <li key={t}>
                <button
                  type="button"
                  className={`bib-side-btn ${tipoFiltro === t ? "bib-side-btn-on" : ""}`}
                  onClick={() => onTipoChange(t)}
                  disabled={count === 0}
                >
                  <span className="bib-side-icon" style={{ color: TIPO_COR[t] }}>
                    {IconFn({ size: 12 })}
                  </span>
                  <span className="bib-side-label">{TIPO_LABEL[t]}</span>
                  <span className="bib-side-count">{count > 0 ? count : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* SETOR */}
      <div className="bib-side-section">
        <div className="bib-side-title">SETOR (M4)</div>
        <ul className="bib-side-list">
          <li>
            <button
              type="button"
              className={`bib-side-btn ${setorFiltro === "todos" ? "bib-side-btn-on" : ""}`}
              onClick={() => onSetorChange("todos")}
            >
              <span className="bib-side-label">Todos os setores</span>
            </button>
          </li>
          {SETORES_ORDEM.map((s) => (
            <li key={s}>
              <button
                type="button"
                className={`bib-side-btn ${setorFiltro === s ? "bib-side-btn-on" : ""}`}
                onClick={() => onSetorChange(s)}
              >
                <span className="bib-side-label">{SETOR_LABEL[s]}</span>
                <span className="bib-side-count">{dados.contadoresPorSetor[s]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* FAVORITOS */}
      {dados.favoritos.length > 0 && (
        <div className="bib-side-section">
          <div className="bib-side-title">FAVORITOS / PINS</div>
          <ul className="bib-side-list">
            {dados.favoritos.map((f) => (
              <li key={f.id} className="bib-side-fav">
                <span className="bib-side-icon" style={{ color: "var(--warning)" }}>
                  {I.star({ size: 12 })}
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

// ── Results header ───────────────────────────────────────────────────

function ResultsHeader({
  tipoFiltro,
  setorFiltro,
  totalFiltrados,
  view,
  onViewChange,
}: {
  tipoFiltro: DocBibTipo | "todos";
  setorFiltro: DocBibSetor | "todos";
  totalFiltrados: number;
  view: "cards" | "lista";
  onViewChange: (v: "cards" | "lista") => void;
}) {
  const tituloLabel = tipoFiltro === "todos" ? "Todos os documentos" : TIPO_LABEL[tipoFiltro];
  const setorTag = setorFiltro !== "todos" ? ` · setor ${SETOR_LABEL[setorFiltro]}` : "";
  return (
    <div className="bib-results-head">
      <div className="bib-results-title">
        {tipoFiltro !== "todos" && (
          <span className="bib-results-tipo-icon" style={{ color: TIPO_COR[tipoFiltro] }}>
            {I[TIPO_ICON_KEY[tipoFiltro]]({ size: 14 })}
          </span>
        )}
        <span className="bib-results-label">
          {tituloLabel} · {totalFiltrados} {totalFiltrados === 1 ? "documento" : "documentos"}
          {setorTag}
        </span>
        <span className="bib-results-ordem">· ordenado por data ▾</span>
      </div>
      <div className="bib-view-toggle">
        <button
          type="button"
          className={`bib-view-btn ${view === "lista" ? "bib-view-btn-on" : ""}`}
          onClick={() => onViewChange("lista")}
        >
          Lista ▾
        </button>
        <button
          type="button"
          className={`bib-view-btn ${view === "cards" ? "bib-view-btn-on" : ""}`}
          onClick={() => onViewChange("cards")}
        >
          Cards
        </button>
      </div>
    </div>
  );
}

// ── Cards grid ───────────────────────────────────────────────────────

function CardsGrid({ docs }: { docs: DocumentoBiblioteca[] }) {
  return (
    <div className="bib-cards">
      {docs.map((d) => (
        <DocCard key={d.id} d={d} />
      ))}
    </div>
  );
}

function DocCard({ d }: { d: DocumentoBiblioteca }) {
  const IconFn = I[TIPO_ICON_KEY[d.tipo]];
  return (
    <article className="bib-card">
      <header className="bib-card-head">
        <div className="bib-card-titulo-area">
          <span className="bib-card-tipo-icon" style={{ background: TIPO_COR[d.tipo] }}>
            {IconFn({ size: 14 })}
          </span>
          <div>
            <div className="bib-card-titulo">
              {TIPO_LABEL_SINGULAR[d.tipo]} {d.codigo}
            </div>
            <div className="bib-card-tipo-label" style={{ color: TIPO_COR[d.tipo] }}>
              {TIPO_LABEL_SINGULAR[d.tipo].toUpperCase()}
            </div>
          </div>
        </div>
        <span
          className="bib-card-status"
          style={{
            background: `color-mix(in srgb, ${STATUS_COR[d.status]} 13%, transparent)`,
            color: STATUS_COR[d.status],
          }}
        >
          {STATUS_LABEL[d.status]}
        </span>
      </header>

      <p className="bib-card-desc">{d.descricao}</p>

      <div className="bib-card-meta">
        <div>
          <span className="bib-meta-label">Data:</span> {formatBRDate(d.dataISO)}
        </div>
        <div>
          <span className="bib-meta-label">Páginas:</span> {d.paginas}
        </div>
        <div>
          <span className="bib-meta-label">Autor:</span> {d.autor}
        </div>
        {d.destinatario && (
          <div>
            <span className="bib-meta-label">Destinatário:</span> {d.destinatario}
          </div>
        )}
      </div>

      {(d.pleitoId || d.geradoIA) && (
        <footer className="bib-card-footer">
          {d.pleitoId && (
            <span className="bib-card-pleito">
              {I.link({ size: 11 })} Pleito {d.pleitoId}
              {d.pleitoDocsNoDossie !== undefined && ` · ${d.pleitoDocsNoDossie} docs no dossiê`}
              {d.forcaProbatoria !== undefined && (
                <span className="bib-card-stars">
                  {" "}
                  {"★".repeat(d.forcaProbatoria) + "☆".repeat(5 - d.forcaProbatoria)}
                </span>
              )}
            </span>
          )}
          {d.geradoIA && !d.pleitoId && (
            <span className="bib-card-ia">{I.fire({ size: 11 })} gerada pela IA</span>
          )}
          {d.geradoIA && d.pleitoId && <span className="bib-card-ia-tag">· gerada pela IA</span>}
        </footer>
      )}
    </article>
  );
}

// ── Lista view ───────────────────────────────────────────────────────

function ListaView({ docs }: { docs: DocumentoBiblioteca[] }) {
  return (
    <div className="bib-lista" role="table">
      <div className="bib-lista-head" role="row">
        <div role="columnheader">Código</div>
        <div role="columnheader">Tipo</div>
        <div role="columnheader">Descrição</div>
        <div role="columnheader">Data</div>
        <div role="columnheader">Autor</div>
        <div role="columnheader">Status</div>
      </div>
      {docs.map((d) => {
        const IconFn = I[TIPO_ICON_KEY[d.tipo]];
        return (
          <div key={d.id} className="bib-lista-row" role="row">
            <div role="cell" className="bib-lista-codigo">
              {d.codigo}
            </div>
            <div role="cell">
              <span className="bib-lista-tipo">
                <span style={{ color: TIPO_COR[d.tipo] }}>{IconFn({ size: 12 })}</span>
                {TIPO_LABEL_SINGULAR[d.tipo]}
              </span>
            </div>
            <div role="cell" className="bib-lista-desc">
              {d.descricao}
            </div>
            <div role="cell" className="bib-lista-data">
              {formatBRDate(d.dataISO)}
            </div>
            <div role="cell" className="bib-lista-autor">
              {d.autor}
            </div>
            <div role="cell">
              <span
                className="bib-card-status"
                style={{
                  background: `color-mix(in srgb, ${STATUS_COR[d.status]} 13%, transparent)`,
                  color: STATUS_COR[d.status],
                }}
              >
                {STATUS_LABEL[d.status]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bib-empty">
      {I.search({ size: 32 })}
      <p>Nenhum documento corresponde aos filtros aplicados.</p>
      <p className="bib-empty-sub">Tente afrouxar os filtros ou usar busca semântica abaixo.</p>
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────

function formatBRDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
