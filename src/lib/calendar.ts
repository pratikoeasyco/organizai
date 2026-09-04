import type { TaskLike } from "@/types/domain";

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addMonths(date: Date, amount: number): Date {
  // Fixa o dia 1 antes de somar: senão 31/01 + 1 mês vira 03/03.
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/** Chave estável de dia no fuso local — não usar toISOString, que é UTC. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export interface CalendarDay {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

/**
 * Grade do mês completa: sempre começa no domingo e termina no sábado, para
 * as semanas ficarem alinhadas. Inclui os dias vizinhos que completam a borda.
 */
export function buildMonthGrid(month: Date, today = new Date()): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const days: CalendarDay[] = [];
  const cursor = new Date(start);

  // 6 semanas cobrem qualquer mês; manter fixo evita a grade "pular" de altura.
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(cursor);
    days.push({
      date,
      key: dayKey(date),
      inMonth: date.getMonth() === month.getMonth(),
      isToday: isSameDay(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/** Agrupa por dia, colocando os itens com hora marcada antes dos do dia inteiro. */
export function groupTasksByDay<T extends TaskLike>(tasks: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = dayKey(new Date(task.dueDate));
    const bucket = map.get(key);
    if (bucket) bucket.push(task);
    else map.set(key, [task]);
  }

  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      if (a.hasTime !== b.hasTime) return a.hasTime ? -1 : 1;
      if (a.hasTime && b.hasTime) {
        return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
      }
      return a.title.localeCompare(b.title, "pt-BR");
    });
  }

  return map;
}

/**
 * Mantém a hora do compromisso ao mudar o dia — arrastar a reunião de terça
 * para quarta não pode zerar o horário dela.
 */
export function moveToDay(original: Date, targetDay: Date, keepTime: boolean): Date {
  const next = new Date(targetDay);
  if (keepTime) {
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  } else {
    next.setHours(12, 0, 0, 0);
  }
  return next;
}

/** Valor para <input type="datetime-local"> / date, sempre em hora local. */
export function toLocalDateInput(date: Date): string {
  return dayKey(date);
}

/** "14:30" — hora local, formato aceito por <input type="time">. */
export function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Monta o ISO de um dia + hora interpretando ambos no fuso local. Usado no
 * update otimista, para o card não "pular" de dia antes da resposta do servidor.
 */
export function isoForDayAndTime(key: string, time: string | null): string {
  const [y, m, d] = key.split("-").map(Number);
  const [hh, mm] = time ? time.split(":").map(Number) : [12, 0];
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}
