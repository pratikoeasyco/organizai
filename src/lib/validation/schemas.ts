import { z } from "zod";

import { PRIORITIES, ROLES } from "@/types/domain";

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
  .transform((v) => v.toUpperCase());

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => v.trim())
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

const cuid = z.string().min(1, "Identificador inválido.").max(64);

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .min(1, "Informe seu e-mail.")
  .max(160, "E-mail muito longo.")
  .email("E-mail inválido.")
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128, "A senha é muito longa.");

export const nameSchema = z
  .string()
  .min(2, "Informe seu nome.")
  .max(80, "Nome muito longo.")
  .transform((v) => v.trim().replace(/\s+/g, " "));

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Link inválido."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: nameSchema,
  jobTitle: optionalText(80),
  avatarColor: hex,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

export const companyNameSchema = z
  .string()
  .min(2, "Informe o nome da empresa.")
  .max(60, "Nome muito longo.")
  .transform((v) => v.trim().replace(/\s+/g, " "));

export const slugSchema = z
  .string()
  .max(48, "Identificador muito longo.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use apenas letras minúsculas, números e hifens.",
  );

export const createCompanySchema = z.object({
  name: companyNameSchema,
  slug: slugSchema.optional().or(z.literal("")),
  color: hex.default("#2563EB"),
  logoEmoji: optionalText(8),
});

export const updateCompanySchema = z.object({
  companyId: cuid,
  name: companyNameSchema,
  color: hex,
  logoEmoji: optionalText(8),
});

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

export const roleSchema = z.enum(ROLES);

/** Papel dentro de um projeto — nunca OWNER, que é só da empresa. */
export const projectAccessSchema = z.object({
  projectId: cuid,
  role: roleSchema.exclude(["OWNER"]),
});

export const addMemberSchema = z.object({
  companyId: cuid,
  email: emailSchema,
  role: roleSchema.exclude(["OWNER"]),
  projects: z.array(projectAccessSchema).max(200).default([]),
});

export const updateMemberSchema = z.object({
  companyId: cuid,
  userId: cuid,
  role: roleSchema.exclude(["OWNER"]),
});

export const setMemberProjectsSchema = z.object({
  companyId: cuid,
  userId: cuid,
  projects: z.array(projectAccessSchema).max(200),
});

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  companyId: cuid,
  name: z
    .string()
    .min(2, "Informe o nome do projeto.")
    .max(60, "Nome muito longo.")
    .transform((v) => v.trim().replace(/\s+/g, " ")),
  description: optionalText(400),
  color: hex.default("#2563EB"),
  icon: optionalText(8),
  template: z.enum(["basic", "kanban", "content", "empty"]).default("basic"),
});

export const updateProjectSchema = z.object({
  projectId: cuid,
  name: z
    .string()
    .min(2, "Informe o nome do projeto.")
    .max(60, "Nome muito longo.")
    .transform((v) => v.trim().replace(/\s+/g, " ")),
  description: optionalText(400),
  color: hex,
  icon: optionalText(8),
});

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

export const createColumnSchema = z.object({
  projectId: cuid,
  name: z
    .string()
    .min(1, "Informe o nome da coluna.")
    .max(40, "Nome muito longo.")
    .transform((v) => v.trim()),
  color: hex.default("#94A3B8"),
});

export const updateColumnSchema = z.object({
  name: z
    .string()
    .min(1, "Informe o nome da coluna.")
    .max(40, "Nome muito longo.")
    .transform((v) => v.trim())
    .optional(),
  color: hex.optional(),
});

export const reorderColumnsSchema = z.object({
  projectId: cuid,
  columnIds: z.array(cuid).min(1),
});

/** `strategy`: para onde vão as tarefas ao excluir a coluna. */
export const deleteColumnSchema = z.object({
  strategy: z.enum(["move", "archive", "delete"]),
  targetColumnId: cuid.optional().nullable(),
});

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export const prioritySchema = z.enum(PRIORITIES);

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/**
 * `new Date("2026-09-12")` é interpretado como UTC pelo JavaScript, o que
 * exibe 11/09 em qualquer fuso negativo (o Brasil inteiro). Por isso datas sem
 * hora viram meio-dia local: o dia fica correto na exibição e imune a horário
 * de verão. Datas com hora são montadas no fuso local do usuário.
 */
function parseLocalDate(value: string): Date | null {
  const withTime = DATE_TIME.exec(value);
  if (withTime) {
    const [, y, m, d, hh, mm] = withTime;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0, 0);
  }

  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Data opcional. Distingue os dois casos que antes se confundiam:
 * string vazia = "sem prazo" (válido); string ilegível = erro.
 *
 * Antes, qualquer texto que não fosse data virava `null` e o prazo era apagado
 * em silêncio — um erro de digitação removia a data sem o usuário perceber.
 */
const dateOrNull = z
  .string()
  .trim()
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value.length === 0) return null;

    const parsed = parseLocalDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inválida." });
      return z.NEVER;
    }
    return parsed;
  });

/** Reunião de 15 minutos a 12 horas; fora disso é erro de digitação. */
const durationOrNull = z
  .number()
  .int()
  .min(5, "Duração mínima de 5 minutos.")
  .max(720, "Duração máxima de 12 horas.")
  .nullable();

/**
 * Antecedência do lembrete, em minutos. Até uma semana — mais que isso o aviso
 * chega tão cedo que vira ruído. `null` significa "não lembrar".
 */
const reminderOrNull = z
  .number()
  .int()
  .min(0, "Antecedência inválida.")
  .max(10080, "Antecedência máxima de 7 dias.")
  .nullable();

export const createTaskSchema = z.object({
  columnId: cuid,
  title: z
    .string()
    .min(1, "Informe o título da tarefa.")
    .max(200, "Título muito longo.")
    .transform((v) => v.trim()),
  description: optionalText(5000),
  priority: prioritySchema.default("LOW"),
  dueDate: dateOrNull.optional(),
  hasTime: z.boolean().default(false),
  durationMinutes: durationOrNull.optional(),
  assigneeId: cuid.nullable().optional(),
  position: z.enum(["top", "bottom"]).default("bottom"),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, "O título não pode ficar vazio.")
    .max(200, "Título muito longo.")
    .transform((v) => v.trim())
    .optional(),
  description: optionalText(5000),
  priority: prioritySchema.optional(),
  dueDate: dateOrNull.optional(),
  hasTime: z.boolean().optional(),
  durationMinutes: durationOrNull.optional(),
  assigneeId: cuid.nullable().optional(),
  labelIds: z.array(cuid).max(20).optional(),
  archived: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Compromissos do calendário
// ---------------------------------------------------------------------------

/** Diferente da tarefa, o compromisso exige data — sem ela não há calendário. */
const requiredDate = z
  .string()
  .trim()
  .min(1, "Informe a data do compromisso.")
  .transform((v) => parseLocalDate(v))
  .refine((v): v is Date => v !== null && !Number.isNaN(v.getTime()), "Data inválida.");

export const createEventSchema = z.object({
  projectId: cuid,
  title: z
    .string()
    .min(1, "Informe o título do compromisso.")
    .max(200, "Título muito longo.")
    .transform((v) => v.trim()),
  description: optionalText(5000),
  priority: prioritySchema.default("LOW"),
  dueDate: requiredDate,
  hasTime: z.boolean().default(false),
  durationMinutes: durationOrNull.optional(),
  assigneeId: cuid.nullable().optional(),
  reminderMinutes: reminderOrNull.optional(),
});

export const updateEventSchema = z.object({
  title: z
    .string()
    .min(1, "O título não pode ficar vazio.")
    .max(200, "Título muito longo.")
    .transform((v) => v.trim())
    .optional(),
  description: optionalText(5000),
  priority: prioritySchema.optional(),
  dueDate: requiredDate.optional(),
  hasTime: z.boolean().optional(),
  durationMinutes: durationOrNull.optional(),
  assigneeId: cuid.nullable().optional(),
  completed: z.boolean().optional(),
  reminderMinutes: reminderOrNull.optional(),
});

export const moveTaskSchema = z.object({
  taskId: cuid,
  toColumnId: cuid,
  toIndex: z.number().int().min(0).max(10000),
  /**
   * Prioridade que o card assume por ter sido solto ali. A coluna é ordenada
   * por prioridade, então soltar entre dois urgentes significa "isto também é
   * urgente" — sem isto o card voltaria sozinho para o bloco de origem.
   * Ausente quando o arraste não muda a prioridade.
   */
  priority: z.enum(PRIORITIES).optional(),
});

// ---------------------------------------------------------------------------
// Checklist, comentários e etiquetas
// ---------------------------------------------------------------------------

export const createChecklistItemSchema = z.object({
  content: z
    .string()
    .min(1, "Informe o item.")
    .max(200, "Item muito longo.")
    .transform((v) => v.trim()),
});

export const updateChecklistItemSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(200)
    .transform((v) => v.trim())
    .optional(),
  done: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  body: z
    .string()
    .min(1, "Escreva um comentário.")
    .max(4000, "Comentário muito longo.")
    .transform((v) => v.trim()),
});

export const createLabelSchema = z.object({
  projectId: cuid,
  name: z
    .string()
    .min(1, "Informe o nome da etiqueta.")
    .max(28, "Nome muito longo.")
    .transform((v) => v.trim()),
  color: hex.default("#2563EB"),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(28).transform((v) => v.trim()).optional(),
  color: hex.optional(),
});
