import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/auth/session";

const HIGHLIGHTS = [
  "Várias empresas em uma única conta",
  "Quadros Kanban com colunas do seu jeito",
  "Tarefas com prazo, prioridade e checklist",
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Quem já está autenticado não vê as telas de login/cadastro.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface">
      <div className="pointer-events-none absolute inset-0 auth-grid" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/login" className="rounded-md">
          <Logo />
        </Link>
        <p className="hidden text-[13px] text-ink-muted sm:block">
          Organize. Simplifique. Faça acontecer.
        </p>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-14 pt-4 sm:px-8">
        <div className="w-full max-w-[400px]">
          {children}

          <ul className="mt-10 space-y-2.5 border-t border-line pt-7">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[13px] text-ink-muted">
                <CheckCircle2 className="size-4 shrink-0 text-brand-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
