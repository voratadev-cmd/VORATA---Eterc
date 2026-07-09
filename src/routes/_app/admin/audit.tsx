import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Badge,
  Card,
  DataTable,
  type DataTableColumn,
  I,
  Input,
  PageHeader,
  Select,
} from "@/components/ds";
import { AdminGuard } from "@/components/AdminGuard";
import {
  ACTION_LABEL,
  ENTITY_LABEL,
  type AuditAction,
  type AuditEntry,
  getAuditFilters,
  getAuditOrdered,
} from "@/lib/mocks/audit";
import "./admin.css";

export const Route = createFileRoute("/_app/admin/audit")({
  component: () => (
    <AdminGuard>
      <AuditPage />
    </AdminGuard>
  ),
  head: () => ({ meta: [{ title: "Auditoria — Admin" }] }),
});

const ACTION_TONE: Record<AuditAction, "success" | "info" | "warning" | "danger" | "neutral"> = {
  create: "success",
  update: "info",
  delete: "danger",
  approve: "success",
  reject: "warning",
  generate: "info",
  login: "neutral",
  logout: "neutral",
  export: "info",
  share: "info",
};

function AuditPage() {
  const allRows = useMemo(() => getAuditOrdered(), []);
  const filters = useMemo(() => getAuditFilters(), []);

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (userFilter !== "all" && r.userName !== userFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.entityLabel.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q)
      );
    });
  }, [allRows, search, userFilter, actionFilter]);

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: "when",
      label: "Quando",
      width: "150px",
      render: (row) => (
        <div>
          <div
            style={{
              fontSize: "var(--fs-13)",
              color: "var(--text-2)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatDateTime(row.timestampISO)}
          </div>
        </div>
      ),
    },
    {
      key: "user",
      label: "Quem",
      width: "minmax(180px, 1fr)",
      render: (row) => (
        <span className="adm-audit-user">
          <span className="adm-audit-user-avatar">{initialsFromName(row.userName)}</span>
          <span style={{ fontSize: "var(--fs-13)", color: "var(--text)" }}>{row.userName}</span>
        </span>
      ),
    },
    {
      key: "action",
      label: "Ação",
      width: "120px",
      render: (row) => <Badge tone={ACTION_TONE[row.action]}>{ACTION_LABEL[row.action]}</Badge>,
    },
    {
      key: "entity",
      label: "Tipo",
      width: "120px",
      render: (row) => (
        <span
          style={{ fontSize: "var(--fs-12)", color: "var(--text-3)", textTransform: "uppercase" }}
        >
          {ENTITY_LABEL[row.entityType]}
        </span>
      ),
    },
    {
      key: "description",
      label: "Descrição",
      width: "minmax(280px, 2fr)",
      render: (row) => (
        <div>
          <div className="adm-audit-desc">{row.description}</div>
          {row.meta && <div className="adm-audit-meta">{row.meta}</div>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle={`${allRows.length} ações sensíveis registradas nos últimos 30 dias.`}
      />

      {/* Toolbar */}
      <div className="adm-toolbar">
        <div className="adm-toolbar-search">
          <Input
            placeholder="Buscar por descrição, entidade ou usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select<string>
          value={userFilter}
          onChange={setUserFilter}
          items={[
            { value: "all", label: "Todos usuários" },
            ...filters.users.map((u) => ({ value: u, label: u })),
          ]}
        />
        <Select<string>
          value={actionFilter}
          onChange={setActionFilter}
          items={[
            { value: "all", label: "Todas ações" },
            ...filters.actions.map((a) => ({ value: a, label: ACTION_LABEL[a] })),
          ]}
        />
        <span className="adm-toolbar-count">
          {filtered.length} de {allRows.length}
        </span>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(row) => row.id}
          emptyText="Nenhuma ação corresponde aos filtros."
        />
      </Card>
    </>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} · ${time}`;
}

function initialsFromName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}
