"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Crown,
  LayoutGrid,
  Pencil,
  Search,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormAlert } from "@/components/auth/FormAlert";
import { useToast } from "@/components/ui/Toast";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import {
  ProjectAccessPicker,
  type AssignableRole,
  type ProjectAccessMap,
} from "@/components/companies/ProjectAccessPicker";
import { readableTextOn, withAlpha } from "@/lib/utils/colors";
import { formatDate } from "@/lib/utils/format";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/types/domain";
import {
  addMemberAction,
  deleteCompanyAction,
  removeMemberAction,
  setMemberProjectsAction,
  updateMemberRoleAction,
} from "@/server/actions/companies";
import type { CompanyDetail, MemberEntry } from "@/server/services/companies";
import type { ProjectSummary } from "@/server/services/projects";

const ASSIGNABLE_ROLES: AssignableRole[] = ["ADMIN", "MEMBER", "VIEWER"];

type Tab = "geral" | "colaboradores";

export interface CompanySettingsProps {
  company: CompanyDetail;
  members: MemberEntry[];
  projects: ProjectSummary[];
  currentUserId: string;
}

export function CompanySettings({
  company,
  members,
  projects,
  currentUserId,
}: CompanySettingsProps) {
  const [tab, setTab] = useState<Tab>("geral");

  const tabs: { id: Tab; label: string; icon: typeof Settings; count?: number }[] = [
    { id: "geral", label: "Geral", icon: Settings },
    { id: "colaboradores", label: "Colaboradores", icon: Users, count: members.length },
  ];

  return (
    <div className="mt-7">
      <div
        role="tablist"
        aria-label="Seções das configurações"
        className="inline-flex rounded-lg border border-line bg-surface p-1"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" />
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px]",
                    active ? "bg-brand-600 text-white" : "bg-surface-sunken text-ink-muted",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "geral" ? (
          <GeneralTab company={company} currentUserId={currentUserId} />
        ) : (
          <CollaboratorsTab
            company={company}
            members={members}
            projects={projects}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function GeneralTab({
  company,
  currentUserId,
}: {
  company: CompanyDetail;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const isOwner = company.ownerId === currentUserId;

  async function handleDeleteCompany() {
    const result = await deleteCompanyAction(company.id);
    if (result.ok) {
      toast.success("Empresa excluída.");
      router.push("/empresas");
    } else {
      toast.error(result.error ?? "Não foi possível excluir a empresa.");
    }
  }

  return (
    <div className="space-y-4">
      <section className="card-surface p-5">
        <h2 className="text-[15px] font-semibold text-ink">Identidade</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Nome, cor e ícone exibidos em toda a plataforma.
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              aria-hidden="true"
              style={{ backgroundColor: company.color, color: readableTextOn(company.color) }}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl text-[19px] font-semibold uppercase"
            >
              {company.logoEmoji ?? company.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-ink">{company.name}</p>
              <p className="truncate text-[12.5px] text-ink-muted">
                /empresas/{company.slug} · criada em {formatDate(company.createdAt)}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            leftIcon={<Pencil className="size-4" />}
            onClick={() => setEditOpen(true)}
          >
            Editar
          </Button>
        </div>
      </section>

      {isOwner && (
        <section className="rounded-lg border border-red-200 bg-red-50/40 p-5">
          <h2 className="text-[15px] font-semibold text-red-700">Zona de risco</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            Excluir a empresa remove permanentemente todos os projetos, tarefas e compromissos.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>
            Excluir empresa
          </Button>
        </section>
      )}

      <CompanyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        company={{
          id: company.id,
          name: company.name,
          color: company.color,
          logoEmoji: company.logoEmoji,
        }}
        navigateOnCreate={false}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmName("");
        }}
        onConfirm={handleDeleteCompany}
        title="Excluir esta empresa?"
        description={
          <div className="space-y-3">
            <p>
              Todos os projetos, tarefas, compromissos e comentários de{" "}
              <strong className="font-medium text-ink">{company.name}</strong> serão removidos
              permanentemente. Essa ação não poderá ser desfeita.
            </p>
            <Input
              label={`Digite "${company.name}" para confirmar`}
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              autoComplete="off"
            />
          </div>
        }
        confirmLabel="Excluir empresa"
        confirmDisabled={confirmName.trim() !== company.name}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function CollaboratorsTab({
  company,
  members,
  projects,
  currentUserId,
}: {
  company: CompanyDetail;
  members: MemberEntry[];
  projects: ProjectSummary[];
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<MemberEntry | null>(null);
  const [removing, setRemoving] = useState<MemberEntry | null>(null);

  const visible = members.filter((member) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return (
      member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term)
    );
  });

  async function handleRemove() {
    if (!removing) return;
    const result = await removeMemberAction(company.id, removing.userId);
    if (result.ok) {
      toast.success("Colaborador removido.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Não foi possível remover.");
    }
    setRemoving(null);
  }

  return (
    <div className="space-y-4">
      <section className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Colaboradores</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Quem tem acesso e a quais projetos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {members.length > 4 && (
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar colaboradores"
                leftIcon={<Search />}
                wrapClassName="w-44"
              />
            )}
            <Button
              variant="primary"
              leftIcon={<UserPlus className="size-4" />}
              onClick={() => setInviteOpen(true)}
            >
              Adicionar
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            compact
            icon={<Users />}
            title="Ninguém encontrado"
            description={`Nada corresponde a "${query}".`}
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                isSelf={member.userId === currentUserId}
                onEdit={() => setEditing(member)}
                onRemove={() => setRemoving(member)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card-surface p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Building2 className="size-4 text-ink-muted" />
          Como funcionam as permissões
        </h2>
        <dl className="mt-3 space-y-2">
          {(["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const).map((role) => (
            <div key={role} className="flex gap-3 text-[12.5px] leading-relaxed">
              <dt className="w-[118px] shrink-0 font-medium text-ink-soft">
                {ROLE_LABEL[role]}
              </dt>
              <dd className="text-ink-muted">{ROLE_DESCRIPTION[role]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-muted">
          <strong className="font-medium text-ink">Proprietário e administrador</strong> enxergam
          todos os projetos da empresa.{" "}
          <strong className="font-medium text-ink">Membro e visualizador</strong> só entram nos
          projetos em que forem incluídos — e o papel pode ser diferente em cada um.
        </p>
      </section>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        company={company}
        projects={projects}
        onDone={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />

      {editing && (
        <EditMemberModal
          member={editing}
          company={company}
          projects={projects}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={handleRemove}
        title="Remover este colaborador?"
        description={
          <>
            <strong className="font-medium text-ink">{removing?.name}</strong> perderá o acesso a
            esta empresa e a todos os projetos dela. As tarefas criadas por essa pessoa
            permanecem.
          </>
        }
        confirmLabel="Remover colaborador"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function MemberRow({
  member,
  isSelf,
  onEdit,
  onRemove,
}: {
  member: MemberEntry;
  isSelf: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar name={member.name} color={member.avatarColor} size="lg" />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-ink">
          <span className="truncate">{member.name}</span>
          {isSelf && <span className="text-[11.5px] font-normal text-ink-faint">(você)</span>}
          {member.isOwner ? (
            <Badge color="#F59E0B" icon={<Crown />}>
              {ROLE_LABEL.OWNER}
            </Badge>
          ) : (
            <Badge color={member.role === "ADMIN" ? "#2563EB" : undefined}>
              {ROLE_LABEL[member.role]}
            </Badge>
          )}
        </p>
        <p className="truncate text-[12px] text-ink-muted">
          {member.email}
          {member.jobTitle && ` · ${member.jobTitle}`}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {member.projects.length === 0 ? (
            <span className="text-[11.5px] text-amber-700">
              Sem acesso a nenhum projeto
            </span>
          ) : member.projects[0].inherited ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-faint">
              <LayoutGrid className="size-3" />
              Todos os projetos ({member.projects.length})
            </span>
          ) : (
            member.projects.map((project) => (
              <span
                key={project.projectId}
                style={{
                  backgroundColor: withAlpha(project.color, 0.12),
                  color: project.color,
                }}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                title={`${project.name} — ${ROLE_LABEL[project.role]}`}
              >
                {project.icon ?? null}
                {project.name}
                <span className="opacity-70">· {ROLE_LABEL[project.role]}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {!member.isOwner && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Pencil className="size-3.5" />}
            onClick={onEdit}
          >
            Editar acesso
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Remover ${member.name}`}
            onClick={onRemove}
            className="hover:text-red-600"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

function InviteModal({
  open,
  onClose,
  company,
  projects,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  company: CompanyDetail;
  projects: ProjectSummary[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("MEMBER");
  const [access, setAccess] = useState<ProjectAccessMap>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCompanyAdmin = role === "ADMIN";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.set("companyId", company.id);
    formData.set("email", email);
    formData.set("role", role);
    formData.set(
      "projects",
      JSON.stringify(
        isCompanyAdmin
          ? []
          : Object.entries(access).map(([projectId, r]) => ({ projectId, role: r })),
      ),
    );

    const result = await addMemberAction({ ok: false }, formData);
    setBusy(false);

    if (result.ok) {
      toast.success("Colaborador adicionado.");
      setEmail("");
      setRole("MEMBER");
      setAccess({});
      onDone();
    } else {
      setError(result.error ?? "Não foi possível adicionar.");
    }
  }

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title="Adicionar colaborador"
      description={`Defina o papel na empresa e a quais projetos de ${company.name} a pessoa terá acesso.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="invite-form"
            variant="primary"
            loading={busy}
            disabled={email.trim().length === 0}
          >
            Adicionar colaborador
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <FormAlert>{error}</FormAlert>}

        <Input
          label="E-mail da pessoa"
          type="email"
          placeholder="pessoa@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint="A pessoa precisa já ter uma conta no Organizaí."
          required
          data-autofocus
        />

        <SelectField
          label="Papel na empresa"
          value={role}
          onChange={(next) => setRole(next as AssignableRole)}
          options={ASSIGNABLE_ROLES.map((option) => ({
            value: option,
            label: ROLE_LABEL[option],
            description: ROLE_DESCRIPTION[option],
          }))}
        />

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Acesso aos projetos</p>
          <ProjectAccessPicker
            projects={projects}
            value={access}
            onChange={setAccess}
            disabled={isCompanyAdmin}
          />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function EditMemberModal({
  member,
  company,
  projects,
  onClose,
  onDone,
}: {
  member: MemberEntry;
  company: CompanyDetail;
  projects: ProjectSummary[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState<AssignableRole>(member.role as AssignableRole);
  const [access, setAccess] = useState<ProjectAccessMap>(() =>
    Object.fromEntries(
      member.projects
        .filter((p) => !p.inherited)
        .map((p) => [p.projectId, p.role as AssignableRole]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCompanyAdmin = role === "ADMIN";

  async function handleSave() {
    setBusy(true);
    setError(null);

    if (role !== member.role) {
      const result = await updateMemberRoleAction(company.id, member.userId, role);
      if (!result.ok) {
        setBusy(false);
        setError(result.error ?? "Não foi possível alterar o papel.");
        return;
      }
    }

    // Admin herda acesso a tudo; gravar projetos aqui seria contraditório.
    if (!isCompanyAdmin) {
      const result = await setMemberProjectsAction(
        company.id,
        member.userId,
        Object.entries(access).map(([projectId, r]) => ({ projectId, role: r })),
      );
      if (!result.ok) {
        setBusy(false);
        setError(result.error ?? "Não foi possível salvar o acesso aos projetos.");
        return;
      }
    }

    setBusy(false);
    toast.success("Acesso atualizado.");
    onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={`Acesso de ${member.name}`}
      description="Vale imediatamente. A pessoa perde ou ganha os quadros na próxima navegação."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={handleSave}>
            Salvar acesso
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}

        <div className="flex items-center gap-3">
          <Avatar name={member.name} color={member.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-ink">{member.name}</p>
            <p className="truncate text-[12.5px] text-ink-muted">{member.email}</p>
          </div>
        </div>

        <SelectField
          label="Papel na empresa"
          value={role}
          onChange={(next) => setRole(next as AssignableRole)}
          options={ASSIGNABLE_ROLES.map((option) => ({
            value: option,
            label: ROLE_LABEL[option],
            description: ROLE_DESCRIPTION[option],
          }))}
        />

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Acesso aos projetos</p>
          <ProjectAccessPicker
            projects={projects}
            value={access}
            onChange={setAccess}
            disabled={isCompanyAdmin}
          />
        </div>
      </div>
    </Modal>
  );
}
