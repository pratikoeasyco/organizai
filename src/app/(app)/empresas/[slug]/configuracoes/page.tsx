import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { CompanySettings } from "@/components/companies/CompanySettings";
import { requireUser } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { getCompanyBySlug, listMembers } from "@/server/services/companies";
import { listProjects } from "@/server/services/projects";
import { hasRole } from "@/types/domain";

export const metadata: Metadata = { title: "Configurações da empresa" };

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  try {
    const company = await getCompanyBySlug(user.id, slug);

    // A autorização real acontece nas actions; aqui evitamos exibir a tela.
    if (!hasRole(company.role, "ADMIN")) notFound();

    const [members, projects] = await Promise.all([
      listMembers(user.id, company.id),
      listProjects(user.id, company.id),
    ]);

    return (
      <PageContainer className="max-w-4xl">
        <PageHeader
          title="Configurações da empresa"
          description={`Gerencie os dados, colaboradores e permissões de ${company.name}.`}
        />
        <CompanySettings
          company={company}
          members={members}
          projects={projects}
          currentUserId={user.id}
        />
      </PageContainer>
    );
  } catch (error) {
    if (error instanceof AppError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }
}
