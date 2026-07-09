import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppShell,
  I,
  PeriodoPicker,
  type PeriodoOpcao,
  Sidebar,
  Topbar,
  type NavItem,
} from "@/components/ds";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useObras } from "@/lib/hooks/useObras";
import { getVisaoGeral } from "@/lib/mocks/obras";
import type { Obra } from "@/lib/supabase/obras";
import { useAuth, useCurrentUser } from "@/contexts/UserContext";
import { EmConstrucao } from "@/components/EmConstrucao";
import { TopbarSearch } from "@/components/TopbarSearch/TopbarSearch";
import "./_app.css";

export const Route = createFileRoute("/_app")({
  // Guard de autenticação: o AppRoot bloqueia o shell até haver sessão (redireciona
  // pra /login se não logado). Tudo sob /_app é área protegida.
  component: AppRoot,
  // Qualquer rota de módulo ainda não implementada joga notFound() no loader (obra real fora
  // do mock, ou fatia de mock ausente). Em vez do 404 fullscreen do root, renderiza "Em
  // construção" DENTRO do AppShell (sidebar preservada) — não quebra a navegação.
  notFoundComponent: () => <EmConstrucao />,
});

/**
 * Guard de sessão do app. Enquanto a sessão é restaurada (loading) mostra um
 * splash; sem sessão redireciona pro /login (preservando o destino em ?redirect);
 * com sessão renderiza o AppLayout (que então pode usar useCurrentUser com
 * segurança — o usuário está garantido).
 */
function AppRoot() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (status === "unauthenticated") {
      void navigate({ to: "/login", search: { redirect: location.pathname }, replace: true });
    }
  }, [status, navigate, location.pathname]);

  if (status === "loading") return <AuthSplash />;
  if (status === "unauthenticated") return null;
  return <AppLayout />;
}

function AuthSplash() {
  return (
    <div className="auth-splash">
      <div className="auth-splash-mark">{I.shield({ size: 24 })}</div>
      <div className="auth-splash-bar" aria-hidden />
      <span className="auth-splash-txt">Carregando…</span>
    </div>
  );
}

/**
 * Marca recursivamente os items que dependem de um contractId como `disabled`.
 * Aplicado quando o usuário não tem obra ativa — preserva a estrutura visual
 * da Sidebar mas impede navegação pra rotas órfãs (`/contracts//pre/revisao`).
 *
 * Heurística: item depende de contractId se tem `params.contractId` (definido
 * por buildNavItems pra todas as sub-rotas de obra) OU se algum filho depende.
 */
function disableContractItems(items: NavItem[]): NavItem[] {
  return items.map((item) => {
    const dependsOnContract = !!item.params && "contractId" in item.params;
    const children = item.children ? disableContractItems(item.children) : undefined;
    const childrenAllDisabled =
      children && children.length > 0 ? children.every((c) => c.disabled) : false;
    const next: NavItem = { ...item };
    if (children) next.children = children;
    if (dependsOnContract || childrenAllDisabled) {
      next.disabled = true;
      next.disabledHint = "Selecione uma obra primeiro";
    }
    return next;
  });
}

/**
 * Telas ainda NÃO migradas pro dado real normalizado (mock/scaffold ou aguardando backend) →
 * na Sidebar ficam apagadas (opacity 0.4) e não-clicáveis, sinalizando "em construção" sem sumir
 * do mapa. Quando a tela for reconstruída com dado real, é só tirar o id daqui.
 */
const NAO_PRONTAS = new Set<string>([
  "m1-2",
  "m1-3",
  "m1-4", // Pré-Contrato 1.2 Bases · 1.3 Diagnóstico · 1.4 Transpasse
  "m2-1-8", // 2.1.8 Vistoria por Imagem
  "m2-1-9", // 2.1.9 Controle Documental
  "m-contabil", // Contábil · AGM
  "m4", // Check-list da Obra (aguardando agentes setoriais)
  "m5-1",
  "m5-2",
  "m5-3", // Finalização 5.1 Lições · 5.2 Pleitos · 5.3 Judicial
]);
function marcarNaoProntas(items: NavItem[]): NavItem[] {
  return items.map((item) => {
    const next: NavItem = { ...item };
    if (item.children) next.children = marcarNaoProntas(item.children);
    if (NAO_PRONTAS.has(item.id)) {
      next.disabled = true;
      next.disabledHint = "Em construção — ainda não disponível";
    }
    return next;
  });
}

/**
 * Constrói os itens da Sidebar refletindo o diagrama de arquitetura:
 * Dashboard + 5 módulos por contrato + Configurações.
 *
 * Quando o usuário está em uma rota com `$contractId`, os links usam aquele id.
 * Sem obra ativa, `disableContractItems` marca os items dependentes como
 * `disabled` — visualmente cinzas e não-navegáveis.
 */
function buildNavItems(contractId: string): NavItem[] {
  const c = { contractId };
  return [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "home",
      to: "/contracts/$contractId/dashboard",
      params: c,
    },
    {
      id: "chat-ia",
      label: "Chat · Adm Contratual IA",
      icon: "chat",
      to: "/contracts/$contractId/chat",
      params: c,
      key: true,
    },
    {
      id: "m1",
      label: "Pré-Contrato",
      icon: "doc",
      children: [
        {
          id: "m1-1",
          label: "1.1 Revisão Documental",
          to: "/contracts/$contractId/pre/revisao",
          params: c,
        },
        {
          id: "m1-2",
          label: "1.2 Bases do Negócio",
          to: "/contracts/$contractId/pre/bases",
          params: c,
        },
        {
          id: "m1-3",
          label: "1.3 Diagnóstico do Contrato",
          to: "/contracts/$contractId/pre/diagnostico",
          params: c,
        },
        {
          id: "m1-4",
          label: "1.4 Transpasse e Docs",
          to: "/contracts/$contractId/pre/transpasse",
          params: c,
        },
      ],
    },
    {
      id: "m2",
      label: "Gestão Contratual",
      icon: "wallet",
      children: [
        {
          id: "m2-1-1",
          label: "2.1.1 Síntese do Contrato",
          to: "/contracts/$contractId",
          params: c,
        },
        {
          id: "m2-1-2",
          label: "2.1.2 RMA Mensal",
          to: "/contracts/$contractId/rma",
          params: c,
          key: true,
          // /rma redireciona pra /rma/visao-geral (e tem 11 sub-abas internas)
          // matchPrefix acende o item em qualquer sub-rota /rma/*
          matchPrefix: true,
        },
        { id: "m2-1-3", label: "2.1.3 Timeline", to: "/contracts/$contractId/timeline", params: c },
        {
          id: "m2-1-4",
          label: "2.1.4 Mapa / Retigráfico",
          to: "/contracts/$contractId/mapa",
          params: c,
        },
        {
          id: "m2-1-5",
          label: "2.1.5 Melhorias Documentais",
          to: "/contracts/$contractId/melhorias-doc",
          params: c,
        },
        {
          id: "m2-1-6",
          label: "2.1.6 Condutas e Documentos",
          to: "/contracts/$contractId/condutas",
          params: c,
        },
        {
          id: "m2-1-7",
          label: "2.1.7 Plano de Ação",
          to: "/contracts/$contractId/plano-acao",
          params: c,
        },
        {
          id: "m2-1-8",
          label: "2.1.8 Vistoria por Imagem",
          to: "/contracts/$contractId/vistoria-imagem",
          params: c,
        },
        {
          id: "m2-1-9",
          label: "2.1.9 Controle Documental",
          to: "/contracts/$contractId/controle-documental",
          params: c,
          // 4 abas internas (areas, documentos, operacao) · acende em qualquer
          // sub-rota.
          matchPrefix: true,
        },
        {
          id: "m2-2",
          label: "2.2 Biblioteca de Documentos",
          to: "/contracts/$contractId/biblioteca",
          params: c,
        },
      ],
    },
    {
      id: "m-contabil",
      label: "Contábil · AGM",
      icon: "wallet",
      to: "/contracts/$contractId/contabil",
      params: c,
      // /contabil tem 4 abas internas · matchPrefix acende o item em qualquer
      // sub-rota (/contabil, /contabil/capitulo, /contabil/pericial, /contabil/operacao).
      matchPrefix: true,
    },
    {
      id: "m3",
      label: "Desequilíbrio",
      icon: "trending",
      children: [
        {
          id: "m3-0",
          label: "Visão Geral",
          to: "/contracts/$contractId/desequilibrio",
          params: c,
        },
        {
          id: "m3-1",
          label: "3.1 Indiretos",
          to: "/contracts/$contractId/desequilibrio/indiretos",
          params: c,
        },
        { id: "m3-2", label: "3.2 BDI", to: "/contracts/$contractId/desequilibrio/bdi", params: c },
        {
          id: "m3-3",
          label: "3.3 Encargos Sociais",
          to: "/contracts/$contractId/desequilibrio/encargos",
          params: c,
        },
        {
          id: "m3-4",
          label: "3.4 Valor Agregado",
          to: "/contracts/$contractId/desequilibrio/valor-agregado",
          params: c,
        },
        {
          id: "m3-7",
          label: "3.7 Preço de Insumos",
          to: "/contracts/$contractId/desequilibrio/insumos",
          params: c,
        },
        {
          id: "m3-8",
          label: "3.8 Análises Pontuais",
          to: "/contracts/$contractId/desequilibrio/pontuais",
          params: c,
        },
        {
          id: "m3-10",
          label: "3.10 Gerador de Claim",
          to: "/contracts/$contractId/desequilibrio/gerador-claim",
          params: c,
          key: true,
        },
      ],
    },
    {
      id: "m4",
      label: "Check-list da Obra",
      icon: "check",
      to: "/contracts/$contractId/checklist",
      params: c,
    },
    {
      id: "m5",
      label: "Finalização",
      icon: "flag",
      children: [
        {
          id: "m5-1",
          label: "5.1 Lições Aprendidas",
          to: "/contracts/$contractId/finalizacao/licoes",
          params: c,
        },
        {
          id: "m5-2",
          label: "5.2 Negociação de Pleitos",
          to: "/contracts/$contractId/finalizacao/pleitos",
          params: c,
        },
        {
          id: "m5-3",
          label: "5.3 Judicial / Arbitral",
          to: "/contracts/$contractId/finalizacao/judicial",
          params: c,
        },
      ],
    },
  ];
}

function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, can } = useCurrentUser();
  const { logout } = useAuth();

  // Pega o contractId da URL · "" quando o usuário não tem obra ativa.
  // Sem obra: items da sidebar dependentes de contractId ficam disabled.
  const urlParams = useParams({ strict: false }) as { contractId?: string };
  const { data: obras } = useObras();
  const activeContractId = urlParams.contractId ?? obras?.[0]?.id ?? "";
  const hasObraAtiva = activeContractId !== "";

  const rawItems = buildNavItems(activeContractId);
  const items = marcarNaoProntas(hasObraAtiva ? rawItems : disableContractItems(rawItems));

  // Item "Administração" (gestão de usuários) só aparece pro master.
  const footerItems: NavItem[] = [
    ...(can("viewAdmin")
      ? [
          {
            id: "admin",
            label: "Administração",
            icon: "shield" as const,
            to: "/admin",
            matchPrefix: true,
          },
        ]
      : []),
    {
      id: "settings",
      label: "Configurações",
      icon: "settings",
      to: "/settings",
    },
  ];

  return (
    <AppShell
      isMobile={isMobile}
      sidebar={
        <Sidebar
          brand={<ContractPicker activeContractId={activeContractId} />}
          items={items}
          footerItems={footerItems}
          user={{ name: user.name, subtitle: user.subtitle, initials: user.initials }}
          onLogout={() => void logout()}
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      }
      topbar={
        <Topbar
          isMobile={isMobile}
          onOpenSidebar={() => setMobileOpen(true)}
          search={
            <TopbarSearch obras={obras} navItems={items} activeContractId={activeContractId} />
          }
          actions={<ContractPeriodoPicker contractId={activeContractId} />}
        />
      }
    >
      {/* Transição entre rotas = View Transition NATIVO do browser
          (defaultViewTransition no router) — cross-fade do conteúdo antigo→novo,
          sem remontar a árvore e SEM frame em branco. Layouts compartilhados
          (ex.: header+abas do RMA) PERSISTEM entre sub-rotas; só o conteúdo que
          muda faz o cross-fade. Substituiu o antigo RouteTransition keyed-by-path,
          que remontava tudo e piscava (fade a partir de opacity:0). */}
      <Outlet />
    </AppShell>
  );
}

// ── ContractPicker ───────────────────────────────────────────────────
// Seletor da obra ativa, no topo da Sidebar. Puxa a lista do Supabase via
// useObras(). Ao escolher uma nova obra preserva a sub-rota atual (ex.:
// /pre/revisao) se houver, senão vai pra Síntese.

/** Iniciais da obra pro avatar (2 primeiros alfanuméricos). Ex.: "BR-101…" → "BR". */
function obraInitials(name: string): string {
  const clean = (name ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return clean.slice(0, 2).toUpperCase() || "?";
}

/** Texto de localização "Cidade / UF" a partir da obra (vazio se faltar). */
function obraLocal(o: Obra): string {
  return [o.cidade, o.uf].filter(Boolean).join(" / ");
}

function ContractPicker({ activeContractId }: { activeContractId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const { can } = useCurrentUser();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: obras } = useObras();

  // useMemo: ref estável entre renders — senão a busca seria zerada a cada tecla
  // (o efeito "ao abrir" depende de `lista` e re-rodaria em todo render).
  const lista = useMemo(() => obras ?? [], [obras]);
  const current = lista.find((o) => o.id === activeContractId);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? lista.filter((o) =>
        [o.nome_interno, o.cidade, o.uf, o.contratante]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : lista;

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Ao abrir: limpa a busca, foca o campo e destaca a obra ativa.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const ativo = lista.findIndex((o) => o.id === activeContractId);
    setActiveIdx(ativo >= 0 ? ativo : 0);
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, lista, activeContractId]);

  // Ao digitar na busca, volta o destaque pro topo da lista filtrada.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Mantém o item destacado (teclado) visível dentro da lista rolável.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current
      .querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  function pick(o: Obra) {
    setOpen(false);
    // Preserva a sub-rota atual quando trocamos só o contractId.
    const m = location.pathname.match(/^\/contracts\/[^/]+(\/.*)?$/);
    if (m) {
      const rest = m[1] ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- destino dinâmico com sub-rota arbitrária
      navigate({ to: `/contracts/${o.id}${rest}` as any });
    } else {
      navigate({ to: "/contracts/$contractId", params: { contractId: o.id } });
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[activeIdx];
      if (o) pick(o);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const currentMeta = current ? obraLocal(current) : "";

  return (
    <div className="cp" ref={ref}>
      <div className="cp-heading">Obras</div>
      <button
        type="button"
        className="cp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cp-avatar" aria-hidden>
          {obraInitials(current?.nome_interno ?? "?")}
        </span>
        <span className="cp-text">
          <span className="cp-current">{current?.nome_interno ?? "Selecionar obra"}</span>
          {currentMeta ? <span className="cp-trigger-meta">{currentMeta}</span> : null}
        </span>
        <span className={`cp-caret ${open ? "open" : ""}`}>{I.chevDown({ size: 16 })}</span>
      </button>

      {open ? (
        <div className="cp-menu" role="dialog" aria-label="Selecionar obra">
          <div className="cp-search">
            <span className="cp-search-icon" aria-hidden>
              {I.search({ size: 16 })}
            </span>
            <input
              ref={inputRef}
              type="text"
              className="cp-search-input"
              placeholder="Buscar obra, cidade, contratante…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Buscar obra"
            />
            {query ? (
              <button
                type="button"
                className="cp-search-clear"
                aria-label="Limpar busca"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                {I.close({ size: 14 })}
              </button>
            ) : null}
          </div>

          <div className="cp-sec">
            {q
              ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`
              : `${lista.length} ${lista.length === 1 ? "obra" : "obras"}`}
          </div>

          <div className="cp-list" ref={listRef} role="listbox" aria-label="Obras disponíveis">
            {filtered.length === 0 ? (
              <div className="cp-empty">
                <span className="cp-empty-txt">
                  {lista.length === 0 ? "Nenhuma obra cadastrada" : "Nenhuma obra encontrada"}
                </span>
                {q ? (
                  <button
                    type="button"
                    className="cp-empty-clear"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                  >
                    Limpar busca
                  </button>
                ) : null}
              </div>
            ) : (
              filtered.map((o, idx) => {
                const isActive = o.id === activeContractId;
                const local = obraLocal(o);
                const meta = [local, o.contratante].filter(Boolean).join(" · ");
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    data-idx={idx}
                    aria-selected={isActive}
                    className={cn("cp-option", isActive && "active", idx === activeIdx && "hi")}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="cp-avatar" aria-hidden>
                      {obraInitials(o.nome_interno)}
                    </span>
                    <span className="cp-option-text">
                      <span className="cp-option-name">{o.nome_interno}</span>
                      {meta ? <span className="cp-option-meta">{meta}</span> : null}
                    </span>
                    {isActive ? (
                      <span className="cp-check" aria-hidden>
                        {I.check({ size: 16 })}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="cp-divider" />

          {/* Cadastrar obra só pra quem pode (admin/master) — regular não vê. */}
          {can("registerObras") ? (
            <Link to="/contracts/new" className="cp-foot" onClick={() => setOpen(false)}>
              <span className="cp-foot-ic" aria-hidden>
                {I.plus({ size: 15 })}
              </span>
              <span className="cp-foot-txt">Cadastrar nova obra</span>
              {I.chevRight({ size: 13 })}
            </Link>
          ) : null}
          <Link to="/contracts" className="cp-foot" onClick={() => setOpen(false)}>
            <span className="cp-foot-ic" aria-hidden>
              {I.map({ size: 15 })}
            </span>
            <span className="cp-foot-txt">Ver todas as obras</span>
            {I.chevRight({ size: 13 })}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ── ContractPeriodoPicker ────────────────────────────────────────────
// Mostra o seletor de mês/ano apenas quando há um contractId na URL.
// Lê os BMs disponíveis do mock e atualiza ?bm=BM-XX na URL ao escolher
// um novo período. Pages com `validateSearch({ bm })` reagem
// automaticamente · pages sem esse search ignoram o param sem quebrar.

function ContractPeriodoPicker({ contractId }: { contractId?: string }) {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- search é dinâmico (cada rota define seu próprio).
  const search = useSearch({ strict: false }) as any;

  if (!contractId) return null;
  const visao = getVisaoGeral(contractId);
  if (!visao || visao.bms.length === 0) return null;

  const opcoes: PeriodoOpcao[] = visao.bms
    .map((b) => ({ id: b.numero, ano: b.ano, mes: b.mes }))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);

  const bmAtivo = typeof search?.bm === "string" ? search.bm : visao.bmCorrente;

  function escolher(opcao: PeriodoOpcao) {
    // Preserva o pathname atual; só atualiza o search ?bm=.
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, bm: opcao.id }),
      replace: false,
    });
  }

  return <PeriodoPicker opcoes={opcoes} valor={bmAtivo} onChange={escolher} />;
}
