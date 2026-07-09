import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  I,
  Input,
  PageHeader,
  Segmented,
} from "@/components/ds";
import { AdminGuard } from "@/components/AdminGuard";
import { useCurrentUser } from "@/contexts/UserContext";
import type { User, UserRole } from "@/lib/auth/types";
import { ROLE_LABEL } from "@/lib/auth/types";
import { MOCK_USERS } from "@/lib/mocks/users";
import "./admin.css";

export const Route = createFileRoute("/_app/admin/users")({
  component: () => (
    <AdminGuard>
      <UsersPage />
    </AdminGuard>
  ),
  head: () => ({ meta: [{ title: "Usuários — Admin" }] }),
});

type RoleFilter = "all" | UserRole;

const ROLE_TONE: Record<UserRole, "info" | "neutral" | "success" | "warning"> = {
  master: "warning",
  admin: "info",
  regular: "neutral",
};

function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const { user: currentUser } = useCurrentUser();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_USERS.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.subtitle.toLowerCase().includes(q)
      );
    });
  }, [search, roleFilter]);

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      label: "Usuário",
      width: "minmax(220px, 2fr)",
      render: (row) => (
        <div className="adm-user-row">
          <div className="adm-user-avatar">{row.initials}</div>
          <div className="adm-user-meta">
            <span className="adm-user-name">
              {row.name}
              {row.id === currentUser.id && <Badge tone="info">VOCÊ</Badge>}
            </span>
            <span className="adm-user-email">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "minmax(160px, 1fr)",
      render: (row) => <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABEL[row.role]}</Badge>,
    },
    {
      key: "subtitle",
      label: "Função / Obra",
      width: "minmax(220px, 1.5fr)",
      render: (row) => (
        <span style={{ fontSize: "var(--fs-13)", color: "var(--text-2)" }}>{row.subtitle}</span>
      ),
    },
    {
      key: "lastSeen",
      label: "Última atividade",
      width: "160px",
      render: (row) =>
        row.lastSeenISO ? (
          <span style={{ fontSize: "var(--fs-13)", color: "var(--text-2)" }}>
            {formatDate(row.lastSeenISO)}
          </span>
        ) : (
          <span style={{ fontSize: "var(--fs-12)", color: "var(--text-4)" }}>nunca acessou</span>
        ),
    },
    {
      key: "ativo",
      label: "Status",
      width: "110px",
      render: (row) =>
        row.ativo ? <Badge tone="success">Ativo</Badge> : <Badge tone="danger">Desativado</Badge>,
    },
    {
      key: "actions",
      label: "",
      width: "180px",
      align: "right",
      render: () => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <Button size="sm" variant="outline" disabled title="CRUD completo em onda futura">
            Editar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle={`${MOCK_USERS.length} usuários · ${MOCK_USERS.filter((u) => u.ativo).length} ativos`}
        actions={
          <Button variant="primary" size="md" disabled title="Modal de convite em onda futura">
            <I.plus size={14} /> Convidar usuário
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="adm-toolbar">
        <div className="adm-toolbar-search">
          <Input
            placeholder="Buscar por nome, e-mail ou função..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Segmented<RoleFilter>
          value={roleFilter}
          onChange={setRoleFilter}
          items={[
            { value: "all", label: "Todos" },
            { value: "master", label: "Master" },
            { value: "admin", label: "Admin" },
            { value: "regular", label: "Usuário" },
          ]}
        />
        <span className="adm-toolbar-count">
          {filtered.length} de {MOCK_USERS.length}
        </span>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(row) => row.id}
          emptyText="Nenhum usuário corresponde ao filtro."
        />
      </Card>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
