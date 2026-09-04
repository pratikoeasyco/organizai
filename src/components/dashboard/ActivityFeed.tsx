import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelative } from "@/lib/utils/format";
import { Activity } from "lucide-react";
import type { ActivityEntry } from "@/server/services/activity";

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Activity />}
        title="Nenhuma atividade ainda"
        description="Assim que você criar projetos e mover tarefas, o histórico aparece aqui."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
          <Avatar
            name={entry.actor.name}
            color={entry.actor.avatarColor}
            size="sm"
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug text-ink-soft">
              <span className="font-medium text-ink">{entry.actor.name}</span> {entry.message}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
              <span>{formatRelative(entry.createdAt)}</span>
              {entry.project && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/projetos/${entry.project.id}`}
                    className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink-soft"
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: entry.project.color }}
                      className="size-1.5 rounded-full"
                    />
                    {entry.project.name}
                  </Link>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
