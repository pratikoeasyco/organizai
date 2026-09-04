const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "12 set" ou "12 set 2024" quando o ano é diferente do atual. */
export function formatShortDate(value: Date | string | number): string {
  const d = toDate(value);
  const now = new Date();
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "12/09/2026" */
export function formatDate(value: Date | string | number): string {
  const d = toDate(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

const WEEKDAYS_LONG = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "sexta-feira, 4 de setembro de 2026" */
export function formatFullDate(value: Date | string | number): string {
  const d = toDate(value);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "4 de setembro" */
export function formatDayMonth(value: Date | string | number): string {
  const d = toDate(value);
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

/** "14:30" no fuso local. */
export function formatTime(value: Date | string | number): string {
  const d = toDate(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "14:30 – 15:30" a partir do início e da duração em minutos. */
export function formatTimeRange(
  start: Date | string | number,
  durationMinutes: number | null | undefined,
): string {
  const from = toDate(start);
  if (!durationMinutes) return formatTime(from);
  return `${formatTime(from)} – ${formatTime(new Date(from.getTime() + durationMinutes * 60000))}`;
}

/** "1 h 30 min" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/** Formato aceito por <input type="time"> */
export function toTimeInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? "" : formatTime(d);
}

/** Formato aceito por <input type="date"> */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 d", ou data curta. */
export function formatRelative(value: Date | string | number): string {
  const d = toDate(value);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} d`;

  return formatShortDate(d);
}

export type DueStatus = "overdue" | "today" | "soon" | "future" | "none";

export function getDueStatus(value: Date | string | null | undefined): DueStatus {
  if (!value) return "none";
  const due = startOfDay(toDate(value));
  const today = startOfDay(new Date());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 2) return "soon";
  return "future";
}

export function formatDueLabel(value: Date | string): string {
  const status = getDueStatus(value);
  if (status === "today") return "Hoje";
  const due = startOfDay(toDate(value));
  const today = startOfDay(new Date());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";
  return formatShortDate(value);
}

/** "João Silva" -> "JS" */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** "1 tarefa" / "3 tarefas" */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
