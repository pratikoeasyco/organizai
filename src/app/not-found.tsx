import Link from "next/link";

import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="pointer-events-none absolute inset-0 auth-grid" aria-hidden="true" />

      <div className="relative z-10 max-w-md">
        <Logo className="mx-auto" />
        <p className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-brand-600">
          Erro 404
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-ink">
          Não encontramos esta página
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-muted">
          O endereço pode estar errado, o item pode ter sido excluído — ou você não tem acesso a
          ele.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-700"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}
