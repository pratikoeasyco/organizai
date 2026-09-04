"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { CheckCircle2, Layers, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format";
import { withAlpha } from "@/lib/utils/colors";
import type { ProjectSummary } from "@/server/services/projects";

export interface ProjectCardProps {
  project: ProjectSummary;
  /** Mostra o nome da empresa (usado no dashboard, que mistura empresas). */
  showCompany?: boolean;
  menu?: React.ReactNode;
}

export function ProjectCard({ project, showCompany, menu }: ProjectCardProps) {
  const progress =
    project.taskCount > 0 ? Math.round((project.doneCount / project.taskCount) * 100) : 0;

  return (
    <div className="group relative">
      <Link
        href={`/projetos/${project.id}`}
        className={cn(
          "card-surface flex h-full flex-col p-4 transition-[border-color,box-shadow,transform] duration-150",
          "hover:-translate-y-px hover:border-line-strong hover:shadow-md",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            style={{ backgroundColor: withAlpha(project.color, 0.12), color: project.color }}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[16px]"
          >
            {project.icon ?? <Layers className="size-4.5" />}
          </span>

          <div className="min-w-0 flex-1 pr-6">
            <h3 className="truncate text-[14.5px] font-semibold leading-tight text-ink">
              {project.name}
            </h3>
            <p className="mt-1 truncate text-[12.5px] leading-tight text-ink-muted">
              {showCompany ? project.companyName : project.description || "Sem descrição"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1" />

        <div className="mt-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-ink-muted">
              {project.taskCount === 1 ? "1 tarefa" : `${project.taskCount} tarefas`}
              {project.columnCount > 0 && (
                <span className="text-ink-faint">
                  {" · "}
                  {project.columnCount === 1 ? "1 coluna" : `${project.columnCount} colunas`}
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-ink-soft">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {progress}%
            </span>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso de ${project.name}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%`, backgroundColor: project.color }}
            />
          </div>

          <p className="text-[11.5px] text-ink-faint">
            Atualizado {formatRelative(project.updatedAt)}
          </p>
        </div>
      </Link>

      {menu && (
        <div className="absolute right-2.5 top-3.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {menu}
        </div>
      )}
    </div>
  );
}

export const ProjectCardMenuButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function ProjectCardMenuButton(props, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Ações do projeto"
      className="rounded-sm bg-surface/90 p-1.5 text-ink-faint backdrop-blur-sm transition-colors hover:bg-surface-sunken hover:text-ink"
      {...props}
    >
      <MoreHorizontal className="size-4" />
    </button>
  );
});
