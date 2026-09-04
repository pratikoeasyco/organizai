"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { FormAlert } from "@/components/auth/FormAlert";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { BRAND_PALETTE } from "@/lib/utils/colors";
import { formatDate, pluralize } from "@/lib/utils/format";
import {
  deleteUserAction,
  revokeSessionsAction,
  setPlatformAdminAction,
  updateUserAction,
} from "@/server/actions/admin";
import type { ActionState } from "@/server/actions/types";
import type { AdminUserRow } from "@/server/services/admin";

const TH = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint";
const TD = "px-4 py-3 align-middle text-[13px] text-ink-soft";

export interface AdminUsersViewProps {
  users: AdminUserRow[];
  currentUserId: string;
  initialQuery: string;
}

export function AdminUsersView({ users, currentUserId, initialQuery }: AdminUsersViewProps) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState(initialQuery);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [demoting, setDemoting] = useState<AdminUserRow | null>(null);
  // Promover e encerrar sessões não apagam nada, mas são de um clique só e
  // mexem na conta de outra pessoa — confirmam também.
  const [promoting, setPromoting] = useState<AdminUserRow | null>(null);
  const [revoking, setRevoking] = useState<AdminUserRow | null>(null);

  // Busca no servidor, com debounce: a lista pode crescer muito.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query === initialQuery) return;
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      router.replace(`/admin/usuarios${params}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, initialQuery, router]);

  async function toggleAdmin(user: AdminUserRow, next: boolean) {
    const result = await setPlatformAdminAction(user.id, next);
    if (result.ok) {
      toast.success(
        next ? `${user.name} agora é administrador.` : `${user.name} não é mais administrador.`,
      );
      router.refresh();
    } else {
      toast.error(result.error ?? "Não foi possível alterar o acesso.");
    }
    setDemoting(null);
    setPromoting(null);
  }

  async function handleRevoke(user: AdminUserRow) {
    const result = await revokeSessionsAction(user.id);
    if (result.ok) {
      const count = (result.data as { count: number } | undefined)?.count ?? 0;
      toast.success(
        count > 0
          ? `${pluralize(count, "sessão encerrada", "sessões encerradas")}.`
          : "Não havia sessões abertas.",
        count > 0 ? `${user.name} precisará entrar novamente.` : undefined,
      );
      router.refresh();
    } else {
      toast.error(result.error ?? "Não foi possível encerrar as sessões.");
    }
    setRevoking(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteUserAction(deleting.id);
    if (result.ok) {
      toast.success("Conta excluída.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Não foi possível excluir a conta.");
    }
    setDeleting(null);
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          aria-label="Buscar usuários"
          leftIcon={<Search />}
          wrapClassName="w-full sm:w-72"
        />
        <span className="shrink-0 text-[12.5px] text-ink-muted">
          {pluralize(users.length, "conta", "contas")}
        </span>
      </div>

      {users.length === 0 ? (
        <div className="card-surface mt-4">
          <EmptyState
            icon={<Users />}
            title="Nenhuma conta encontrada"
            description={
              query
                ? `Nada corresponde a "${query}".`
                : "Ainda não há contas cadastradas na plataforma."
            }
          />
        </div>
      ) : (
        // A tabela é larga: rola dentro do próprio container em telas menores,
        // sem empurrar a página inteira para o lado.
        <div className="card-surface mt-4 overflow-x-auto scrollbar-slim">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-muted">
                <th scope="col" className={TH}>
                  Nome
                </th>
                <th scope="col" className={TH}>
                  E-mail
                </th>
                <th scope="col" className={TH}>
                  Cargo
                </th>
                <th scope="col" className={TH}>
                  Empresas
                </th>
                <th scope="col" className={TH}>
                  Cadastro
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const online = user.activeSessions > 0;

                return (
                  <tr key={user.id} className="transition-colors hover:bg-surface-muted">
                    <td className={cn(TD, "min-w-[220px]")}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.name} color={user.avatarColor} size="md" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                            <span className="truncate">{user.name}</span>
                            {isSelf && (
                              <span className="shrink-0 text-[11px] font-normal text-ink-faint">
                                (você)
                              </span>
                            )}
                          </p>
                          {user.isPlatformAdmin && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700">
                              <ShieldCheck className="size-3" />
                              Administrador
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className={TD}>
                      <span className="block max-w-[240px] truncate">{user.email}</span>
                    </td>

                    <td className={TD}>
                      {user.jobTitle ? (
                        <span className="block max-w-[160px] truncate">{user.jobTitle}</span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>

                    <td className={cn(TD, "whitespace-nowrap")}>
                      {user.companyCount === 0 ? (
                        <span className="text-ink-faint">Nenhuma</span>
                      ) : (
                        <>
                          {user.companyCount}
                          {user.ownedCompanyCount > 0 && (
                            <span className="text-ink-faint">
                              {" "}
                              ({user.ownedCompanyCount} própria
                              {user.ownedCompanyCount > 1 ? "s" : ""})
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                      {formatDate(user.createdAt)}
                    </td>

                    <td className={cn(TD, "whitespace-nowrap")}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[12px] font-medium",
                          online ? "text-emerald-700" : "text-ink-muted",
                        )}
                        title={
                          online
                            ? `${pluralize(user.activeSessions, "sessão aberta", "sessões abertas")}`
                            : "Sem sessão aberta"
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 rounded-full",
                            online ? "bg-emerald-500" : "bg-slate-300",
                          )}
                        />
                        {online ? "Conectado" : "Offline"}
                      </span>
                    </td>

                    <td className={cn(TD, "whitespace-nowrap text-right")}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<Pencil className="size-3.5" />}
                          onClick={() => setEditing(user)}
                        >
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isSelf}
                          title={
                            isSelf ? "Você não pode excluir a própria conta" : "Excluir conta"
                          }
                          leftIcon={<Trash2 className="size-3.5" />}
                          onClick={() => setDeleting(user)}
                          className={cn(
                            !isSelf &&
                              "text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                          )}
                        >
                          Excluir
                        </Button>

                        {/* Ações menos frequentes ficam no menu, para a linha
                            não virar uma fileira de botões. */}
                        <Dropdown
                          width={222}
                          trigger={({ ref, onClick, open, ...aria }) => (
                            <Button
                              ref={ref}
                              onClick={onClick}
                              {...aria}
                              data-open={open}
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Mais ações para ${user.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          )}
                        >
                          {({ close }) => (
                            <>
                              {user.isPlatformAdmin ? (
                                <DropdownItem
                                  icon={<ShieldOff />}
                                  disabled={isSelf}
                                  onSelect={() => {
                                    close();
                                    setDemoting(user);
                                  }}
                                >
                                  {isSelf ? "Você não pode se rebaixar" : "Remover admin"}
                                </DropdownItem>
                              ) : (
                                <DropdownItem
                                  icon={<ShieldCheck />}
                                  onSelect={() => {
                                    close();
                                    setPromoting(user);
                                  }}
                                >
                                  Tornar administrador
                                </DropdownItem>
                              )}

                              <DropdownItem
                                icon={<KeyRound />}
                                disabled={user.activeSessions === 0}
                                onSelect={() => {
                                  close();
                                  setRevoking(user);
                                }}
                              >
                                Encerrar sessões
                              </DropdownItem>
                            </>
                          )}
                        </Dropdown>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(promoting)}
        onClose={() => setPromoting(null)}
        onConfirm={() => (promoting ? toggleAdmin(promoting, true) : Promise.resolve())}
        tone="primary"
        title="Tornar administrador da plataforma?"
        description={
          <>
            <strong className="font-medium text-ink">{promoting?.name}</strong> passará a ver
            todas as contas e todas as empresas da plataforma, e poderá editar e excluir
            usuários. Conceda apenas a quem você confia para operar o sistema.
          </>
        }
        confirmLabel="Tornar administrador"
      />

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={() => (revoking ? handleRevoke(revoking) : Promise.resolve())}
        tone="primary"
        title="Encerrar as sessões desta conta?"
        description={
          <>
            <strong className="font-medium text-ink">{revoking?.name}</strong> será desconectado
            de todos os dispositivos e precisará entrar de novo. Nenhum dado é perdido.
          </>
        }
        confirmLabel="Encerrar sessões"
      />

      <ConfirmDialog
        open={Boolean(demoting)}
        onClose={() => setDemoting(null)}
        onConfirm={() => (demoting ? toggleAdmin(demoting, false) : Promise.resolve())}
        title="Remover acesso de administrador?"
        description={
          <>
            <strong className="font-medium text-ink">{demoting?.name}</strong> perderá o acesso ao
            painel de administração. A conta continua existindo normalmente.
          </>
        }
        confirmLabel="Remover acesso"
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Excluir esta conta?"
        description={
          <>
            A conta de <strong className="font-medium text-ink">{deleting?.name}</strong> será
            removida permanentemente, junto com seus comentários e vínculos com empresas. Essa
            ação não poderá ser desfeita.
          </>
        }
        confirmLabel="Excluir conta"
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [state, setState] = useState<ActionState>({ ok: false });
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setState({ ok: false });

    const formData = new FormData();
    formData.set("userId", user.id);
    formData.set("name", name);
    formData.set("email", email);
    formData.set("jobTitle", jobTitle);
    formData.set("avatarColor", avatarColor);

    const result = await updateUserAction({ ok: false }, formData);
    setBusy(false);

    if (result.ok) {
      toast.success("Dados atualizados.");
      onSaved();
    } else {
      setState(result);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Editar usuário"
      description="As alterações valem para a conta imediatamente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="admin-user-form"
            variant="primary"
            loading={busy}
            disabled={name.trim().length < 2 || email.trim().length === 0}
          >
            Salvar alterações
          </Button>
        </>
      }
    >
      <form id="admin-user-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {state.error && <FormAlert>{state.error}</FormAlert>}

        <div className="flex items-center gap-3.5">
          <Avatar name={name || user.name} color={avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-ink">{name || user.name}</p>
            <p className="text-[12px] text-ink-muted">
              {pluralize(user.companyCount, "empresa", "empresas")} · desde{" "}
              {formatDate(user.createdAt)}
            </p>
          </div>
        </div>

        <Input
          label="Nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={state.fieldErrors?.name}
          maxLength={80}
          required
          data-autofocus
        />

        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={state.fieldErrors?.email}
          hint="Trocar o e-mail muda também o login desta pessoa."
          maxLength={160}
          required
        />

        <Input
          label="Cargo (opcional)"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          error={state.fieldErrors?.jobTitle}
          maxLength={80}
        />

        <ColorPicker
          label="Cor do avatar"
          value={avatarColor}
          onChange={setAvatarColor}
          palette={BRAND_PALETTE}
        />

        <p className="rounded-md border border-line bg-surface-muted p-3 text-[12px] leading-relaxed text-ink-muted">
          Senhas não aparecem nem podem ser lidas aqui — são guardadas apenas como hash. Para
          devolver o acesso a alguém, peça que use &ldquo;Esqueceu a senha?&rdquo; na tela de
          login.
        </p>
      </form>
    </Modal>
  );
}
