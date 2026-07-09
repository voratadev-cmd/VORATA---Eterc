import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  FarolCard,
  I,
  IconButton,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ds";
import { useDeleteObra, useObras } from "@/lib/hooks/useObras";
import { formatBRLAbbreviated } from "@/lib/mocks/contracts";
import { MODALIDADE_LABEL, type Modalidade } from "@/lib/schemas/contract";
import type { Obra } from "@/lib/supabase/obras";
import "./index.css";

export const Route = createFileRoute("/_app/contracts/")({
  component: ContractsListPage,
  head: () => ({ meta: [{ title: "Obras — RDM IA" }] }),
});

/** Quantidade de obras por página · grid 3 colunas × 3 linhas. */
const PAGE_SIZE = 9;

type SortKey = "recent" | "name" | "value-desc";

const SORT_ITEMS: Array<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Mais recentes" },
  { value: "name", label: "Nome (A → Z)" },
  { value: "value-desc", label: "Maior valor" },
];

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Filtro client-side · combina nome interno + contratante + localização (cidade + UF). */
function matchesQuery(obra: Obra, q: string): boolean {
  if (!q) return true;
  const needle = normalize(q);
  const haystack = normalize(
    [obra.nome_interno, obra.contratante ?? "", obra.cidade ?? "", obra.uf ?? ""].join(" "),
  );
  return haystack.includes(needle);
}

function ContractsListPage() {
  const navigate = useNavigate();
  const { data: obras, isLoading, error } = useObras();
  const deleteMutation = useDeleteObra();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);

  /** Obra alvo do modal de exclusão (null quando fechado). */
  const [obraToDelete, setObraToDelete] = useState<Obra | null>(null);

  function confirmDelete() {
    if (!obraToDelete) return;
    const nome = obraToDelete.nome_interno;
    deleteMutation.mutate(obraToDelete.id, {
      onSuccess: () => {
        toast.success(`Obra "${nome}" excluída`);
        setObraToDelete(null);
      },
      onError: (err) => {
        toast.error(`Falha ao excluir: ${err.message}`);
      },
    });
  }

  // Debounce 300ms · evita re-filtrar a cada tecla.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  // Sempre que mudar a busca ou ordenação, volta pra página 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sort]);

  const total = obras?.length ?? 0;
  const totalValor = useMemo(
    () => (obras ?? []).reduce((s, o) => s + (o.valor_contratual ?? 0), 0),
    [obras],
  );
  const obrasComValor = useMemo(
    () => (obras ?? []).filter((o) => o.valor_contratual !== null).length,
    [obras],
  );

  // Filtro + ordenação client-side.
  const filteredSorted = useMemo(() => {
    const base = (obras ?? []).filter((o) => matchesQuery(o, debouncedQuery));
    const sorted = [...base];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => normalize(a.nome_interno).localeCompare(normalize(b.nome_interno)));
        break;
      case "value-desc":
        sorted.sort((a, b) => (b.valor_contratual ?? 0) - (a.valor_contratual ?? 0));
        break;
      case "recent":
      default:
        sorted.sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return tb - ta;
        });
        break;
    }
    return sorted;
  }, [obras, debouncedQuery, sort]);

  const filteredCount = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const visible = filteredSorted.slice(startIdx, startIdx + PAGE_SIZE);

  // ── Estado: erro ────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <PageHeader title="Obras" subtitle="Falha ao carregar a lista." />
        <EmptyState
          framed
          icon={I.close({ size: 44 })}
          title="Não foi possível carregar as obras"
          text={error.message}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          }
        />
      </>
    );
  }

  // ── Estado: carregando ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <PageHeader title="Obras" subtitle="Carregando obras cadastradas..." />
        <div className="ctr-page-kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="ctr-skeleton-kpi" />
          ))}
        </div>
        <div className="ctr-toolbar">
          <Skeleton className="ctr-skeleton-toolbar" />
        </div>
        <div className="ctr-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="ctr-skeleton-card" />
          ))}
        </div>
      </>
    );
  }

  // ── Estado: nenhuma obra cadastrada ─────────────────────────────────
  if (total === 0) {
    return (
      <>
        <PageHeader title="Obras" subtitle="Nenhuma obra cadastrada — comece criando uma." />
        <EmptyState
          framed
          icon={I.doc({ size: 44 })}
          title="Nenhuma obra cadastrada"
          text="Cadastre a primeira obra para começar. Os indicadores (farol, faturamento, desequilíbrio) ficarão disponíveis assim que os documentos do BM forem processados pelo pipeline."
          hint="Aguardando primeira obra"
          action={
            <Button size="md" onClick={() => navigate({ to: "/contracts/new" })}>
              {I.plus({ size: 16 })} Cadastrar nova obra
            </Button>
          }
        />
      </>
    );
  }

  // ── Estado: lista com obras (com ou sem busca) ──────────────────────
  return (
    <>
      <PageHeader
        title="Obras"
        subtitle={`${total} obra${total === 1 ? "" : "s"} sob administração.`}
        actions={
          <Button size="sm" onClick={() => navigate({ to: "/contracts/new" })}>
            {I.plus({ size: 14 })} Nova obra
          </Button>
        }
      />

      <div className="ctr-page-kpis">
        <FarolCard
          label="OBRAS CADASTRADAS"
          icon="doc"
          value={String(total)}
          info="Carteira atual"
          accent="neutral"
        />
        <FarolCard
          label="VALOR ADMINISTRADO"
          icon="wallet"
          value={`R$ ${formatBRLAbbreviated(totalValor, false)}`}
          info={`${obrasComValor} de ${total} com valor definido`}
          accent="neutral"
        />
        <FarolCard
          label="FAROL · ANÁLISES"
          icon="bell"
          value="—"
          info="Aguardando processamento do pipeline"
          accent="neutral"
        />
        <FarolCard
          label="DESEQUILÍBRIO"
          icon="trending"
          value="—"
          info="Calculado após processamento do M3"
          accent="neutral"
        />
      </div>

      {/* Toolbar · busca + ordenação + contador */}
      <div className="ctr-toolbar">
        <label className={`ctr-search ${query ? "has-value" : ""}`}>
          <span className="ctr-search-icon" aria-hidden>
            {I.search({ size: 16 })}
          </span>
          <input
            type="search"
            className="ctr-search-input"
            placeholder="Buscar por nome, contratante ou cidade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar obras"
          />
          {query && (
            <button
              type="button"
              className="ctr-search-clear"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
            >
              {I.close({ size: 14 })}
            </button>
          )}
        </label>

        <div className="ctr-toolbar-right">
          <span className="ctr-sort-label">Ordenar por</span>
          <Select<SortKey>
            value={sort}
            onChange={setSort}
            items={SORT_ITEMS}
            size="sm"
            align="end"
            popoverMinWidth={180}
            aria-label="Ordenar obras"
          />
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="ctr-results-bar">
        {debouncedQuery ? (
          <>
            <span className="ctr-results-count">
              <strong>{filteredCount}</strong>{" "}
              {filteredCount === 1 ? "obra encontrada" : "obras encontradas"} para{" "}
              <strong>"{debouncedQuery}"</strong>
            </span>
            <button type="button" className="ctr-results-clear" onClick={() => setQuery("")}>
              Limpar busca
            </button>
          </>
        ) : (
          <span className="ctr-results-count">
            Mostrando{" "}
            <strong>
              {filteredCount === 0 ? 0 : startIdx + 1}–
              {Math.min(startIdx + PAGE_SIZE, filteredCount)}
            </strong>{" "}
            de <strong>{filteredCount}</strong> {filteredCount === 1 ? "obra" : "obras"}
          </span>
        )}
      </div>

      {/* Grid de cards · ou empty filtrado */}
      {filteredCount === 0 ? (
        <div className="ctr-empty-filtered">
          <div className="ctr-empty-filtered-icon" aria-hidden>
            {I.search({ size: 28 })}
          </div>
          <div className="ctr-empty-filtered-title">Nenhuma obra encontrada</div>
          <div className="ctr-empty-filtered-text">
            Não achamos nenhuma obra correspondendo a <strong>"{debouncedQuery}"</strong>.
            <br />
            Tente outro termo ou limpe a busca.
          </div>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Limpar busca
          </Button>
        </div>
      ) : (
        <div className="ctr-grid">
          {visible.map((obra) => (
            <ObraCard
              key={obra.id}
              obra={obra}
              query={debouncedQuery}
              onDelete={() => setObraToDelete(obra)}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {filteredCount > PAGE_SIZE && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onChange={(p) => {
            setPage(p);
            // Scroll suave pro topo da grid · UX em listas longas.
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* Modal · confirmação de exclusão */}
      <Modal
        open={obraToDelete !== null}
        onClose={() => !deleteMutation.isPending && setObraToDelete(null)}
        title="Excluir obra?"
        subtitle={obraToDelete?.nome_interno}
        closeOnBackdrop={!deleteMutation.isPending}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setObraToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </>
        }
      >
        <p className="ctr-modal-text">
          Esta ação <strong>não pode ser desfeita</strong>. Todos os documentos, contextos de
          mapeamento e dados extraídos da obra serão removidos permanentemente.
        </p>
      </Modal>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Card de obra · destaca match na busca via <mark>
// ────────────────────────────────────────────────────────────────────

function ObraCard({ obra, query, onDelete }: { obra: Obra; query: string; onDelete: () => void }) {
  const localizacao = [obra.cidade, obra.uf].filter(Boolean).join(" / ");
  const valorLabel =
    obra.valor_contratual !== null ? formatBRLAbbreviated(obra.valor_contratual) : "—";
  const modalidadeLabel =
    obra.modalidade && obra.modalidade in MODALIDADE_LABEL
      ? MODALIDADE_LABEL[obra.modalidade as Modalidade]
      : (obra.modalidade ?? "—");

  function handleDeleteClick(e: React.MouseEvent) {
    // Evita navegar pro detalhe da obra · o card inteiro é um <Link>.
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  }

  return (
    <Link
      to="/contracts/$contractId/mapeamento"
      params={{ contractId: obra.id }}
      className="ctr-card ctr-card-novo"
    >
      <div className="ctr-card-head">
        <div className="ctr-card-titulo">
          <Highlight text={obra.nome_interno} query={query} />
        </div>
        <div className="ctr-card-head-right">
          <Badge tone="info">Cadastrada</Badge>
          <IconButton
            aria-label={`Excluir obra ${obra.nome_interno}`}
            size="sm"
            variant="ghost"
            className="ctr-card-delete"
            onClick={handleDeleteClick}
          >
            {I.trash({ size: 14 })}
          </IconButton>
        </div>
      </div>
      <div className="ctr-card-meta">
        {localizacao ? <Highlight text={localizacao} query={query} /> : "Localização não informada"}
        {obra.contratante ? (
          <>
            {" · "}
            <Highlight text={obra.contratante} query={query} />
          </>
        ) : null}
      </div>

      <div className="ctr-card-kpis">
        <div className="ctr-kpi">
          <div className="ctr-kpi-label">Valor</div>
          <div className="ctr-kpi-value">{valorLabel}</div>
        </div>
        <div className="ctr-kpi">
          <div className="ctr-kpi-label">Modalidade</div>
          <div className="ctr-kpi-value-text">{modalidadeLabel}</div>
        </div>
        <div className="ctr-kpi">
          <div className="ctr-kpi-label">Início</div>
          <div className="ctr-kpi-value-text">
            {obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString("pt-BR") : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Highlight do termo da busca dentro de um texto · case + accent insensitive. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);
  const idx = normalizedText.indexOf(normalizedQuery);
  if (idx < 0) return <>{text}</>;
  // Recupera o trecho original usando os mesmos offsets — funciona pra ASCII
  // e pra strings sem expansão NFD (raro em PT-BR de obras).
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + normalizedQuery.length);
  const after = text.slice(idx + normalizedQuery.length);
  return (
    <>
      {before}
      <mark className="ctr-mark">{match}</mark>
      {after}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Paginação · setas + números + reticências
// ────────────────────────────────────────────────────────────────────

function buildPageWindow(current: number, total: number): Array<number | "…"> {
  // Mostra: 1 … prev current next … total. Ajusta nos extremos.
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) result.push("…");
  for (let i = start; i <= end; i++) result.push(i);
  if (end < total - 1) result.push("…");
  result.push(total);
  return result;
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const windowed = buildPageWindow(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav className="ctr-pagination" aria-label="Paginação de obras">
      <div className="ctr-pagination-status">
        Página <strong>{page}</strong> de <strong>{totalPages}</strong>
      </div>

      <div className="ctr-pagination-controls">
        <IconButton
          aria-label="Página anterior"
          variant="outline"
          size="sm"
          disabled={!canPrev}
          onClick={() => canPrev && onChange(page - 1)}
        >
          {I.arrowLeft({ size: 14 })}
        </IconButton>

        <div className="ctr-pagination-numbers">
          {windowed.map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="ctr-pagination-gap" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`ctr-pagination-num ${p === page ? "active" : ""}`}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Ir para a página ${p}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <IconButton
          aria-label="Próxima página"
          variant="outline"
          size="sm"
          disabled={!canNext}
          onClick={() => canNext && onChange(page + 1)}
        >
          {I.arrowRight({ size: 14 })}
        </IconButton>
      </div>
    </nav>
  );
}
