import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "brand" | "positive" | "warning" | "neutral";
  hint?: string;
}

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  positive: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  neutral: "bg-surface-sunken text-ink-muted",
} as const;

export function StatCard({ label, value, icon, tone = "neutral", hint }: StatCardProps) {
  return (
    <div className="card-surface flex items-center gap-3.5 p-4">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4.5",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[22px] font-semibold leading-none tracking-tight text-ink">{value}</p>
        <p className="mt-1.5 truncate text-[12.5px] text-ink-muted">{label}</p>
        {hint && <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">{hint}</p>}
      </div>
    </div>
  );
}
