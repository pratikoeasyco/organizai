import { KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { AdminUsersView } from "@/components/admin/AdminUsersView";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getUserStats, listUsers } from "@/server/services/admin";
import { pluralize } from "@/lib/utils/format";

export const metadata = { title: "Usuários" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { q } = await searchParams;

  const [users, stats] = await Promise.all([listUsers(q), getUserStats()]);

  return (
    <PageContainer>
      <PageHeader
        title="Usuários"
        description="Todas as contas da plataforma. Alterações aqui valem imediatamente."
      />

      <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Contas"
          value={stats.total}
          icon={<Users />}
          tone="brand"
          hint={
            stats.withoutCompany > 0
              ? `${pluralize(stats.withoutCompany, "sem empresa", "sem empresa")}`
              : "Todas em alguma empresa"
          }
        />
        <StatCard
          label="Administradores"
          value={stats.admins}
          icon={<ShieldCheck />}
          tone="warning"
          hint="Com acesso a este painel"
        />
        <StatCard
          label="Conectados agora"
          value={stats.withOpenSession}
          icon={<KeyRound />}
          hint="Com sessão válida"
        />
        <StatCard
          label="Novas contas"
          value={stats.newLast7Days}
          icon={<UserPlus />}
          tone="positive"
          hint="Últimos 7 dias"
        />
      </section>

      <AdminUsersView users={users} currentUserId={admin.id} initialQuery={q ?? ""} />
    </PageContainer>
  );
}
