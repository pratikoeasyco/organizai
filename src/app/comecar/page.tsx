import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { requireUser } from "@/lib/auth/guards";
import { listCompanies } from "@/server/services/companies";

export const metadata: Metadata = { title: "Vamos começar" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const companies = await listCompanies(user.id);

  // Quem já tem empresa não precisa passar pelo onboarding.
  if (companies.length > 0) redirect("/dashboard");

  return <OnboardingWizard userName={user.name} />;
}
