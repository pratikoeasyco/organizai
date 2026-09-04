"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[organizai] erro na renderização:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <AlertTriangle className="size-5.5" />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-ink">
        Algo deu errado
      </h1>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-muted">
        Não conseguimos carregar esta tela. Tente novamente — se o problema continuar, volte ao
        dashboard.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button variant="primary" onClick={reset}>
          Tentar novamente
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex h-9.5 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
        >
          Ir para o dashboard
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-[11.5px] text-ink-faint">Código do erro: {error.digest}</p>
      )}
    </div>
  );
}
