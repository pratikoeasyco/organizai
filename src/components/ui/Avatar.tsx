"use client";

import { cn } from "@/lib/utils/cn";
import { getInitials } from "@/lib/utils/format";
import { readableTextOn } from "@/lib/utils/colors";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6.5 text-[10px]",
  md: "size-8 text-[11px]",
  lg: "size-11 text-sm",
};

export interface AvatarProps {
  name: string;
  color?: string;
  size?: AvatarSize;
  className?: string;
  title?: string;
}

export function Avatar({ name, color = "#2563EB", size = "md", className, title }: AvatarProps) {
  return (
    <span
      title={title ?? name}
      aria-label={name}
      role="img"
      style={{ backgroundColor: color, color: readableTextOn(color) }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase tracking-tight ring-2 ring-white",
        SIZES[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}

export interface AvatarGroupProps {
  people: { id: string; name: string; avatarColor: string }[];
  max?: number;
  size?: AvatarSize;
}

export function AvatarGroup({ people, max = 4, size = "sm" }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className="flex -space-x-1.5">
      {visible.map((person) => (
        <Avatar key={person.id} name={person.name} color={person.avatarColor} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted ring-2 ring-white",
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
