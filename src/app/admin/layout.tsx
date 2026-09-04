import { AdminShell } from "@/components/admin/AdminShell";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Administração" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Barreira principal: quem não é admin recebe 404 e nem descobre o painel.
  const user = await requirePlatformAdmin();

  return <AdminShell user={user}>{children}</AdminShell>;
}
