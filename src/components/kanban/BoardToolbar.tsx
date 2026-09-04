"use client";

import { useEffect, useState } from "react";
import { Filter, Search, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { PRIORITIES, PRIORITY_META, type BoardLabel, type BoardUser, type Priority } from "@/types/domain";

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";

export interface BoardFilters {
  query: string;
  assigneeIds: string[];
  priorities: Priority[];
  labelIds: string[];
  due: DueFilter;
}

export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  assigneeIds: [],
  priorities: [],
  labelIds: [],
  due: "any",
};

export function countActiveFilters(filters: BoardFilters): number {
  return (
    filters.assigneeIds.length +
    filters.priorities.length +
    filters.labelIds.length +
    (filters.due === "any" ? 0 : 1)
  );
}

const DUE_OPTIONS: { id: DueFilter; label: string }[] = [
  { id: "any", label: "Qualquer prazo" },
  { id: "overdue", label: "Atrasadas" },
  { id: "today", label: "Vencem hoje" },
  { id: "week", label: "Próximos 7 dias" },
  { id: "none", label: "Sem prazo" },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-sunken",
        checked && "text-ink",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-3.5 shrink-0 accent-[#2563EB]"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </label>
  );
}

export interface BoardToolbarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  members: BoardUser[];
  labels: BoardLabel[];
  resultCount: number;
  totalCount: number;
}

export function BoardToolbar({
  filters,
  onChange,
  members,
  labels,
  resultCount,
  totalCount,
}: BoardToolbarProps) {
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const activeCount = countActiveFilters(filters);

  // Debounce da pesquisa: evita refiltrar a cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (queryDraft !== filters.query) onChange({ ...filters, query: queryDraft });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [queryDraft, filters, onChange]);

  useEffect(() => {
    if (filters.query === "" && queryDraft !== "") setQueryDraft("");
    // Só reage à limpeza externa dos filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={queryDraft}
        onChange={(event) => setQueryDraft(event.target.value)}
        placeholder="Pesquisar tarefas..."
        aria-label="Pesquisar tarefas"
        leftIcon={<Search />}
        wrapClassName="w-full sm:w-60"
        rightSlot={
          queryDraft ? (
            <button
              type="button"
              onClick={() => setQueryDraft("")}
              aria-label="Limpar pesquisa"
              className="rounded-sm p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-soft"
            >
              <X className="size-3.5" />
            </button>
          ) : undefined
        }
      />

      <Dropdown
        width={248}
        trigger={({ ref, onClick, open, ...aria }) => (
          <Button
            ref={ref}
            onClick={onClick}
            {...aria}
            variant={activeCount > 0 || open ? "subtle" : "secondary"}
            leftIcon={<Filter className="size-4" />}
          >
            Filtros
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        )}
      >
        {() => (
          <div className="max-h-[70dvh] overflow-y-auto scrollbar-slim">
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Prioridade
            </p>
            {PRIORITIES.map((priority) => (
              <CheckRow
                key={priority}
                checked={filters.priorities.includes(priority)}
                onChange={() =>
                  onChange({ ...filters, priorities: toggle(filters.priorities, priority) })
                }
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: PRIORITY_META[priority].dot }}
                  className="size-2 shrink-0 rounded-full"
                />
                <span className="truncate">{PRIORITY_META[priority].label}</span>
              </CheckRow>
            ))}

            <div className="my-1 h-px bg-line" />
            <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Responsável
            </p>
            {members.length === 0 && (
              <p className="px-2.5 py-1.5 text-[12.5px] text-ink-faint">Nenhum membro.</p>
            )}
            {members.map((member) => (
              <CheckRow
                key={member.id}
                checked={filters.assigneeIds.includes(member.id)}
                onChange={() =>
                  onChange({ ...filters, assigneeIds: toggle(filters.assigneeIds, member.id) })
                }
              >
                <Avatar name={member.name} color={member.avatarColor} size="xs" />
                <span className="truncate">{member.name}</span>
              </CheckRow>
            ))}

            {labels.length > 0 && (
              <>
                <div className="my-1 h-px bg-line" />
                <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Etiquetas
                </p>
                {labels.map((label) => (
                  <CheckRow
                    key={label.id}
                    checked={filters.labelIds.includes(label.id)}
                    onChange={() =>
                      onChange({ ...filters, labelIds: toggle(filters.labelIds, label.id) })
                    }
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: label.color }}
                      className="size-2 shrink-0 rounded-full"
                    />
                    <span className="truncate">{label.name}</span>
                  </CheckRow>
                ))}
              </>
            )}

            <div className="my-1 h-px bg-line" />
            <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Prazo
            </p>
            {DUE_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-sunken"
              >
                <input
                  type="radio"
                  name="due-filter"
                  checked={filters.due === option.id}
                  onChange={() => onChange({ ...filters, due: option.id })}
                  className="size-3.5 shrink-0 accent-[#2563EB]"
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}

            {activeCount > 0 && (
              <>
                <div className="my-1 h-px bg-line" />
                <button
                  type="button"
                  onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
                  className="w-full rounded-sm px-2.5 py-2 text-left text-[13px] font-medium text-brand-600 transition-colors hover:bg-brand-50"
                >
                  Limpar filtros
                </button>
              </>
            )}
          </div>
        )}
      </Dropdown>

      {(activeCount > 0 || filters.query) && (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-ink-muted">
            {resultCount} de {totalCount} tarefas
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQueryDraft("");
              onChange(EMPTY_FILTERS);
            }}
          >
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
