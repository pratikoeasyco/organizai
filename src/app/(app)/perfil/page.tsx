import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Seu perfil"
        description="Atualize suas informações pessoais e a senha de acesso."
      />
      <ProfileForm user={user} />
    </PageContainer>
  );
}
