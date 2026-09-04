import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CreateEntityButtons } from "@/components/dashboard/CreateEntityButtons";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/guards";
import { listCompanies } from "@/server/services/companies";

export const metadata: Metadata = { title: "Minhas empresas" };

export default async function CompaniesPage() {
  const user = await requireUser();
  const companies = await listCompanies(user.id);

  return (
    <PageContainer>
      <PageHeader
        title="Minhas empresas"
        description="Cada empresa é um ambiente independente, com projetos e membros próprios."
        actions={companies.length > 0 ? <CreateEntityButtons companyId={null} /> : undefined}
      />

      {companies.length === 0 ? (
        <div className="card-surface mt-7">
          <EmptyState
            icon={<Building2 />}
            title="Nenhuma empresa criada"
            description="Crie sua primeira empresa para começar a organizar seus projetos."
            action={<CreateEntityButtons companyId={null} primaryOnly />}
          />
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
