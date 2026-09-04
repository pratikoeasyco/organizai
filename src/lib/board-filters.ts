import { getDueStatus } from "@/lib/utils/format";
import type { TaskLike } from "@/types/domain";
import type { BoardFilters } from "@/components/kanban/BoardToolbar";

const WEEK_MS = 7 * 86400000;

/** Regra única de filtragem — serve tarefas do quadro e compromissos. */
export function matchesFilters(task: TaskLike, filters: BoardFilters): boolean {
  const term = filters.query.trim().toLowerCase();
  if (term) {
    const haystack = `${task.title} ${task.description ?? ""} ${task.labels
      .map((label) => label.name)
      .join(" ")}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
    return false;
  }

  if (filters.assigneeIds.length > 0) {
    if (!task.assignee || !filters.assigneeIds.includes(task.assignee.id)) return false;
  }

  if (filters.labelIds.length > 0) {
    const taskLabelIds = new Set(task.labels.map((label) => label.id));
    if (!filters.labelIds.some((id) => taskLabelIds.has(id))) return false;
  }

  if (filters.due !== "any") {
    const status = getDueStatus(task.dueDate);
    if (filters.due === "none") return status === "none";
    if (filters.due === "overdue") return status === "overdue";
    if (filters.due === "today") return status === "today";
    if (filters.due === "week") {
      if (!task.dueDate) return false;
      const diff = new Date(task.dueDate).getTime() - Date.now();
      if (diff < 0 || diff > WEEK_MS) return false;
    }
  }

  return true;
}
