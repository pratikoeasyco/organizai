"use client";

import { Check, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { withAlpha } from "@/lib/utils/colors";
import { ROLE_LABEL, type Role } from "@/types/domain";
import type { ProjectSummary } from "@/server/services/projects";

export type AssignableRole = Exclude<Role, "OWNER">;
export type ProjectAccessMap = Record<string, AssignableRole>;

const PROJECT_ROLES: { id: AssignableRole; label: string; hint: string }[] = [
  { id: "ADMIN", label: "Admin", hint: "Configura o projeto" },
  { id: "MEMBER", label: "Membro", hint: "Cria e edita tarefas" },
  { id: "VIEWER", label: "Leitura", hint: "Só visualiza" },
];

export interface ProjectAccessPickerProps {
  projects: ProjectSummary[];
  value: ProjectAccessMap;
  onChange: (next: ProjectAccessMap) => void;
  /** Admin da empresa acessa tudo; o seletor vira apenas informativo. */
  disabled?: boolean;
}

/**
 * Escolhe em quais projetos a pessoa entra e com qual papel em cada um.
 * Marcar o projeto define "Membro" por padrão — a escolha mais comum.
 */
export function ProjectAccessPicker({
  projects,
  value,
  onChange,
  disabled,
}: ProjectAccessPickerProps) {
  function toggle(projectId: string) {
    const next = { ...value };
    if (next[projectId]) delete next[projectId];
    else next[projectId] = "MEMBER";
    onChange(next);
  }

  function setRole(projectId: string, role: AssignableRole) {
    onChange({ ...value, [projectId]: role });
  }

  const selectedCount = Object.keys(value).length;

  if (projects.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3.5 py-4 text-center text-[12.5px] leading-relaxed text-ink-muted">
        Esta empresa ainda não tem projetos. Você pode dar acesso depois de criar o primeiro.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", disabled && "pointer-events-none opacity-55")}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-muted">
          {disabled
            ? "Administradores da empresa acessam todos os projetos."
            : selectedCount === 0
              ? "Nenhum projeto selecionado — a pessoa entra na empresa sem ver nenhum quadro."
              : `${selectedCount} de ${projects.length} ${projects.length === 1 ? "projeto" : "projetos"}`}
        </p>

        {!disabled && projects.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onChange(
                selectedCount === projects.length
                  ? {}
                  : Object.fromEntries(
                      projects.map((p) => [p.id, value[p.id] ?? "MEMBER"]),
                    ),
              )
            }
            className="rounded-sm text-[12px] font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            {selectedCount === projects.length ? "Limpar seleção" : "Selecionar todos"}
          </button>
        )}
      </div>

      <ul className="max-h-64 space-y-1.5 overflow-y-auto scrollbar-slim">
        {projects.map((project) => {
          const selected = disabled || Boolean(value[project.id]);
          const role = value[project.id] ?? "MEMBER";

          return (
            <li
              key={project.id}
              className={cn(
                "flex flex-wrap items-center gap-2.5 rounded-lg border p-2.5 transition-colors",
                selected ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-surface-muted",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(project.id)}
                aria-pressed={selected}
                aria-label={`${selected ? "Remover" : "Dar"} acesso ao projeto ${project.name}`}
                className={cn(
                  "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                  selected
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line-strong text-transparent hover:border-brand-500",
                )}
              >
                <Check className="size-3" strokeWidth={3.5} />
              </button>

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
                <span className="block truncate text-[13px] font-medium text-ink">
                  {project.name}
                </span>
                <span className="block truncate text-[11.5px] text-ink-faint">
                  {project.taskCount === 1 ? "1 tarefa" : `${project.taskCount} tarefas`}
                </span>
              </span>

              {selected && (
                <span
                  role="radiogroup"
                  aria-label={`Papel em ${project.name}`}
                  className="flex shrink-0 rounded-md border border-line bg-surface p-0.5"
                >
                  {PROJECT_ROLES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={role === option.id}
                      title={option.hint}
                      disabled={disabled}
                      onClick={() => setRole(project.id, option.id)}
                      className={cn(
                        "rounded-sm px-2 py-1 text-[11.5px] font-medium transition-colors",
                        role === option.id
                          ? "bg-brand-600 text-white"
                          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {!disabled && selectedCount > 0 && (
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          {ROLE_LABEL.VIEWER} não altera nada; {ROLE_LABEL.MEMBER} cria e edita tarefas;{" "}
          {ROLE_LABEL.ADMIN} também configura colunas e o projeto.
        </p>
      )}
    </div>
  );
}
