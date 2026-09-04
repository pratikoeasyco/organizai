"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  CalendarClock,
  ChevronRight,
  LayoutGrid,
  ListChecks,
  Search,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { readableTextOn, withAlpha } from "@/lib/utils/colors";
import { formatDate, formatRelative, pluralize } from "@/lib/utils/format";
import type { AdminCompanyRow } from "@/server/services/admin";

export interface AdminCompaniesViewProps {
  companies: AdminCompanyRow[];
  initialQuery: string;
}

export function AdminCompaniesView({ companies, initialQuery }: AdminCompaniesViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query === initialQuery) return;
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      router.replace(`/admin/empresas${params}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, initialQuery, router]);

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome ou identificador..."
          aria-label="Buscar empresas"
          leftIcon={<Search />}
          wrapClassName="w-full sm:w-72"
        />
        <span className="shrink-0 text-[12.5px] text-ink-muted">
          {pluralize(companies.length, "empresa", "empresas")}
        </span>
      </div>

      {companies.length === 0 ? (
        <div className="card-surface mt-4">
          <EmptyState
            icon={<Building2 />}
            title="Nenhuma empresa encontrada"
            description={
              query
                ? `Nada corresponde a "${query}".`
                : "Ainda não há empresas criadas na plataforma."
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {companies.map((company) => {
            const open = expanded === company.id;

            return (
              <div key={company.id} className="card-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : company.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:bg-surface-muted"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      backgroundColor: company.color,
                      color: readableTextOn(company.color),
                    }}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[17px] font-semibold uppercase"
                  >
                    {company.logoEmoji ?? company.name.slice(0, 1)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-semibold text-ink">
                        {company.name}
                      </span>
                      {company.archivedAt && (
                        <Badge icon={<Archive />}>Arquivada</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                      /{company.slug} · dono:{" "}
                      {company.owner ? `${company.owner.name} (${company.owner.email})` : "—"}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-faint">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {pluralize(company.memberCount, "membro", "membros")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <LayoutGrid className="size-3" />
                        {pluralize(company.projectCount, "projeto", "projetos")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="size-3" />
                        {company.taskCount} no total
                      </span>
                      <span>criada em {formatDate(company.createdAt)}</span>
                    </span>
                  </span>

                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-ink-faint transition-transform",
                      open && "rotate-90",
                    )}
                    aria-hidden="true"
                  />
                </button>

                {open && (
                  <div className="border-t border-line bg-surface-muted px-4 py-3">
                    {company.projects.length === 0 ? (
                      <p className="py-2 text-[12.5px] text-ink-muted">
                        Esta empresa ainda não tem projetos.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {company.projects.map((project) => (
                          <li
                            key={project.id}
                            className="flex items-center gap-2.5 rounded-md bg-surface px-3 py-2"
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                backgroundColor: withAlpha(project.color, 0.13),
                                color: project.color,
                              }}
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-[13px]"
                            >
                              {project.icon ?? <LayoutGrid className="size-3.5" />}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[13px] font-medium text-ink">
                                  {project.name}
                                </span>
                                {project.archivedAt && <Badge>Arquivado</Badge>}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] text-ink-faint">
                                <span className="inline-flex items-center gap-1">
                                  <ListChecks className="size-2.5" />
                                  {pluralize(project.taskCount, "tarefa", "tarefas")}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <CalendarClock className="size-2.5" />
                                  {pluralize(
                                    project.eventCount,
                                    "compromisso",
                                    "compromissos",
                                  )}
                                </span>
                                <span>atualizado {formatRelative(project.updatedAt)}</span>
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
