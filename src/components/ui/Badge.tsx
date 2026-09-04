import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { withAlpha } from "@/lib/utils/colors";

export interface BadgeProps {
  children: ReactNode;
  /** Cor livre (etiquetas, colunas). Quando ausente, usa o tom neutro. */
  color?: string;
  icon?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

export function Badge({ children, color, icon, className, size = "sm" }: BadgeProps) {
  const style = color
    ? { backgroundColor: withAlpha(color, 0.11), color, borderColor: withAlpha(color, 0.22) }
    : undefined;

  return (
    <span
      style={style}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
        !color && "border-line bg-surface-sunken text-ink-muted",
        "[&>svg]:size-3 [&>svg]:shrink-0",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
    />
  );
}
