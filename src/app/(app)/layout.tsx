import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/guards";
import { listCompanies } from "@/server/services/companies";
import { listAllProjects } from "@/server/services/projects";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [companies, projects] = await Promise.all([
    listCompanies(user.id),
    listAllProjects(user.id),
  ]);

  return (
    <AppShell user={user} companies={companies} projects={projects}>
      {children}
    </AppShell>
  );
}
