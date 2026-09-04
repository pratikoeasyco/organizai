/**
 * Tipos de domínio compartilhados entre servidor e cliente.
 * O SQLite não suporta enums no Prisma, então os "enums" vivem aqui e são
 * validados por Zod na fronteira do servidor.
 */

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

/** Hierarquia de permissão: valores maiores incluem os menores. */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  VIEWER: "Visualizador",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  OWNER: "Controle total da empresa, incluindo exclusão e transferência.",
  ADMIN: "Gerencia projetos, membros e configurações da empresa.",
  MEMBER: "Cria e edita projetos, colunas e tarefas.",
  VIEWER: "Apenas visualiza. Não pode alterar nada.",
};

export function hasRole(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

// ---------------------------------------------------------------------------
// Prioridade
// ---------------------------------------------------------------------------

/**
 * Três níveis de propósito: mais que isso e as pessoas param de escolher com
 * critério. "Baixa" é o padrão — toda tarefa nasce com um nível definido, então
 * não existe estado "sem prioridade" redundante com o nível mais baixo.
 */
export const PRIORITIES = ["LOW", "MEDIUM", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEFAULT_PRIORITY: Priority = "LOW";

export const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    /** Frase curta usada no seletor do modal de criação. */
    hint: string;
    dot: string;
    text: string;
    bg: string;
    /** Borda do card no quadro — o sinal de prioridade à distância. */
    cardBorder: string;
    /** Borda do card quando ele está selecionado no seletor. */
    pickerBorder: string;
    rank: number;
  }
> = {
  LOW: {
    label: "Baixa",
    hint: "Pode esperar",
    dot: "#94A3B8",
    text: "text-ink-muted",
    bg: "bg-surface-sunken",
    cardBorder: "border-line hover:border-line-strong",
    pickerBorder: "border-slate-400 bg-slate-50",
    rank: 1,
  },
  MEDIUM: {
    label: "Moderada",
    hint: "Precisa de atenção",
    dot: "#2563EB",
    text: "text-brand-700",
    bg: "bg-brand-50",
    cardBorder: "border-brand-300 hover:border-brand-400",
    pickerBorder: "border-brand-600 bg-brand-50",
    rank: 2,
  },
  URGENT: {
    label: "Urgente",
    hint: "Resolver primeiro",
    dot: "#DC2626",
    text: "text-red-700",
    bg: "bg-red-50",
    cardBorder: "border-red-400 hover:border-red-500",
    pickerBorder: "border-red-500 bg-red-50",
    rank: 3,
  },
};

// ---------------------------------------------------------------------------
// Atividade
// ---------------------------------------------------------------------------

export const ACTIVITY_TYPES = [
  "company.created",
  "company.updated",
  "project.created",
  "project.updated",
  "project.archived",
  "column.created",
  "column.updated",
  "column.deleted",
  "column.reordered",
  "task.created",
  "task.updated",
  "task.moved",
  "task.archived",
  "task.deleted",
  "task.commented",
  "member.added",
  "member.updated",
  "member.removed",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Formas serializadas usadas pelo quadro no cliente
// ---------------------------------------------------------------------------

export interface BoardUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

/**
 * Campos comuns ao card do quadro e ao compromisso do calendário. Filtros,
 * agrupamento por dia e chips operam sobre esta forma, servindo aos dois.
 */
export interface TaskLike {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  /** true = compromisso com hora marcada; false = prazo do dia inteiro. */
  hasTime: boolean;
  durationMinutes: number | null;
  assignee: BoardUser | null;
  labels: BoardLabel[];
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Card do quadro. Nunca aparece no calendário. */
export interface BoardTask extends TaskLike {
  columnId: string;
  position: number;
  /** Quem moveu o card por último — exibido no rodapé do card. */
  lastMovedBy: { id: string; name: string; avatarColor: string } | null;
  lastMovedAt: string | null;
}

/**
 * Compromisso do calendário. Nunca aparece no quadro: não tem coluna nem
 * posição, e a conclusão é explícita (`completedAt`) em vez de posicional.
 */
export interface CalendarEvent extends TaskLike {
  completedAt: string | null;
  /** Minutos de antecedência do lembrete; null = não lembrar. */
  reminderMinutes: number | null;
}

export interface BoardColumnData {
  id: string;
  name: string;
  color: string;
  position: number;
  tasks: BoardTask[];
}

export interface BoardData {
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
    companyId: string;
    companyName: string;
    companySlug: string;
  };
  role: Role;
  /** Quem está usando — permite pré-selecionar "eu" ao criar. */
  currentUserId: string;
  /** Este usuário silenciou as notificações deste projeto. */
  muted: boolean;
  columns: BoardColumnData[];
  /** Compromissos do calendário — conjunto separado das tarefas do quadro. */
  events: CalendarEvent[];
  labels: BoardLabel[];
  members: BoardUser[];
}

export const TASK_KINDS = ["TASK", "EVENT"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Detalhe completo aberto no painel lateral — serve tarefa e compromisso. */
export interface TaskDetail extends TaskLike {
  projectId: string;
  kind: TaskKind;
  columnId: string | null;
  completedAt: string | null;
  createdBy: BoardUser;
  archivedAt: string | null;
  checklist: { id: string; content: string; done: boolean; position: number }[];
  comments: {
    id: string;
    body: string;
    createdAt: string;
    author: BoardUser;
  }[];
  attachments: {
    id: string;
    name: string;
    url: string;
    createdAt: string;
  }[];
  activity: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actor: { id: string; name: string; avatarColor: string };
  }[];
}
