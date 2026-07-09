import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge, Card, CardHeader, CardSub, CardTitle, I, PageHeader } from "@/components/ds";
import { AdminGuard } from "@/components/AdminGuard";
import { MOCK_USERS } from "@/lib/mocks/users";
import { getAuditOrdered } from "@/lib/mocks/audit";
import { ROLE_LABEL } from "@/lib/auth/types";
import "./admin.css";

export const Route = createFileRoute("/_app/admin/")({
  component: () => (
    <AdminGuard>
      <AdminIndexPage />
    </AdminGuard>
  ),
  head: () => ({ meta: [{ title: "Administração — RDM IA" }] }),
});

function AdminIndexPage() {
  const totalUsers = MOCK_USERS.length;
  const activeUsers = MOCK_USERS.filter((u) => u.ativo).length;
  const inactiveUsers = totalUsers - activeUsers;

  const audit = getAuditOrdered();
  const today = "2026-05-25";
  const totalToday = audit.filter((a) => a.timestampISO.startsWith(today)).length;
  const total7d = audit.filter((a) => a.timestampISO >= "2026-05-18").length;

  // Distribuição por role
  const byRole = MOCK_USERS.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Administração"
        subtitle="Gestão de usuários, auditoria e configurações globais do produto."
        actions={<Badge tone="warning">MASTER ONLY</Badge>}
      />

      {/* KPIs */}
      <div className="adm-kpis">
        <div className="adm-kpi">
          <span className="adm-kpi-label">USUÁRIOS</span>
          <span className="adm-kpi-value">{totalUsers}</span>
          <span className="adm-kpi-sub">
            {activeUsers} ativos · {inactiveUsers} desativado{inactiveUsers === 1 ? "" : "s"}
          </span>
        </div>
        <div className="adm-kpi">
          <span className="adm-kpi-label">AÇÕES HOJE</span>
          <span className="adm-kpi-value">{totalToday}</span>
          <span className="adm-kpi-sub">25/05/2026</span>
        </div>
        <div className="adm-kpi">
          <span className="adm-kpi-label">AÇÕES · 7 DIAS</span>
          <span className="adm-kpi-value">{total7d}</span>
          <span className="adm-kpi-sub">desde 18/05/2026</span>
        </div>
        <div className="adm-kpi">
          <span className="adm-kpi-label">ROLES</span>
          <span className="adm-kpi-value">{Object.keys(byRole).length}</span>
          <span className="adm-kpi-sub">
            {Object.entries(byRole)
              .map(([r, c]) => `${ROLE_LABEL[r as keyof typeof ROLE_LABEL]}: ${c}`)
              .join(" · ")}
          </span>
        </div>
      </div>

      {/* Atalhos */}
      <div className="adm-cards">
        <Card>
          <CardHeader>
            <CardTitle>
              <I.users size={18} /> Usuários
            </CardTitle>
            <Link to="/admin/users" className="card-link">
              Gerenciar →
            </Link>
          </CardHeader>
          <CardSub>
            Listar, criar, editar e atribuir roles. {totalUsers} usuários cadastrados.
          </CardSub>
          <ul className="adm-shortcut-list">
            <li>
              <I.check size={14} /> Atribuir papel master / admin / usuário
            </li>
            <li>
              <I.check size={14} /> Desativar usuário (sem perder histórico de ações)
            </li>
            <li>
              <I.check size={14} /> Convidar novo membro por e-mail
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <I.shield size={18} /> Auditoria
            </CardTitle>
            <Link to="/admin/audit" className="card-link">
              Ver log completo →
            </Link>
          </CardHeader>
          <CardSub>
            Histórico de ações sensíveis no produto. {audit.length} registros nos últimos 30 dias.
          </CardSub>
          <ul className="adm-shortcut-list">
            <li>
              <I.check size={14} /> Aprovações de BM e claims
            </li>
            <li>
              <I.check size={14} /> Criação / desativação de usuários
            </li>
            <li>
              <I.check size={14} /> Geração de cartas, pleitos e relatórios
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
