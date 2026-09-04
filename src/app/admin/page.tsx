import Link from "next/link";
import {
  Building2,
  CalendarClock,
  FolderKanban,
  KeyRound,
  ListChecks,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getOverview } from "@/server/services/admin";

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const stats = await getOverview();

  return (
    <PageContainer>
      <PageHeader
        title="Visão geral da plataforma"
        description="Números de toda a instalação, somando todas as empresas."
      />

      <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contas" value={stats.users} icon={<Users />} tone="brand" />
        <StatCard
          label="Administradores"
          value={stats.admins}
          icon={<ShieldCheck />}
          tone="warning"
          hint="Com acesso a este painel"
        />
        <StatCard label="Empresas ativas" value={stats.companies} icon={<Building2 />} />
        <StatCard label="Projetos ativos" value={stats.projects} icon={<FolderKanban />} />
        <StatCard label="Tarefas" value={stats.tasks} icon={<ListChecks />} />
        <StatCard label="Compromissos" value={stats.events} icon={<CalendarClock />} />
        <StatCard
          label="Sessões abertas"
          value={stats.activeSessions}
          icon={<KeyRound />}
          hint="Logins válidos agora"
        />
        <StatCard
          label="Novas contas"
          value={stats.signupsLast7Days}
          icon={<UserPlus />}
          tone="positive"
          hint="Últimos 7 dias"
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/admin/usuarios"
          className="card-surface flex items-start gap-3.5 p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Users className="size-4.5" />
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">Gerenciar usuários</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">
              Editar dados, promover a administrador, encerrar sessões e excluir contas.
            </span>
          </span>
        </Link>

        <Link
          href="/admin/empresas"
          className="card-surface flex items-start gap-3.5 p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
            <Building2 className="size-4.5" />
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">Ver empresas</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">
              Todas as empresas da plataforma, com proprietário, membros e projetos.
            </span>
          </span>
        </Link>
      </section>

      <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-[12.5px] leading-relaxed text-ink-muted">
        <strong className="font-medium text-ink">Sobre privacidade:</strong> este painel mostra
        apenas metadados — nomes, contagens e datas. O conteúdo das tarefas e dos comentários
        continua visível somente para quem é membro da empresa, inclusive para administradores da
        plataforma.
      </p>
    </PageContainer>
  );
}
