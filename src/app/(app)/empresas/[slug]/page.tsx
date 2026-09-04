import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/PageHeader";
import { CompanyProjectsView } from "@/components/companies/CompanyProjectsView";
import { requireUser } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { getCompanyBySlug } from "@/server/services/companies";
import { listProjects } from "@/server/services/projects";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await requireUser();
  try {
    const company = await getCompanyBySlug(user.id, slug);
    return { title: company.name };
  } catch {
    return { title: "Empresa" };
  }
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();

  try {
    const company = await getCompanyBySlug(user.id, slug);
    const projects = await listProjects(user.id, company.id, { includeArchived: true });

    return (
      <PageContainer>
        <CompanyProjectsView company={company} projects={projects} />
      </PageContainer>
    );
  } catch (error) {
    // 404 também cobre empresas de terceiros — não revela que o ID existe.
    if (error instanceof AppError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }
}
