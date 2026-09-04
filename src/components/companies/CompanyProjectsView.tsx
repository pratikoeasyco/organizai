"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard, ProjectCardMenuButton } from "@/components/projects/ProjectCard";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { readableTextOn } from "@/lib/utils/colors";
import { hasRole } from "@/types/domain";
import {
  deleteProjectAction,
  setProjectArchivedAction,
} from "@/server/actions/projects";
import type { CompanyDetail } from "@/server/services/companies";
import type { ProjectSummary } from "@/server/services/projects";

type Tab = "active" | "archived";

export interface CompanyProjectsViewProps {
  company: CompanyDetail;
  projects: ProjectSummary[];
}

export function CompanyProjectsView({ company, projects }: CompanyProjectsViewProps) {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);

  const canManage = hasRole(company.role, "MEMBER");
  const canAdmin = hasRole(company.role, "ADMIN");

  const active = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  const archived = useMemo(() => projects.filter((p) => p.archivedAt), [projects]);

  const visible = useMemo(() => {
    const source = tab === "active" ? active : archived;
    const term = query.trim().toLowerCase();
    if (!term) return source;
    return source.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        (project.description ?? "").toLowerCase().includes(term),
    );
  }, [tab, active, archived, query]);

  async function handleArchive(project: ProjectSummary, archived: boolean) {
    const result = await setProjectArchivedAction(project.id, archived);
    if (result.ok) {
      toast.success(archived ? "Projeto arquivado." : "Projeto restaurado.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Não foi possível concluir a ação.");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const result = await deleteProjectAction(deleting.id);
    if (result.ok) {
      toast.success("Projeto excluído.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Não foi possível excluir o projeto.");
    }
    setDeleting(null);
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              style={{ backgroundColor: company.color, color: readableTextOn(company.color) }}
              className="flex size-9 items-center justify-center rounded-lg text-[15px] font-semibold uppercase"
            >
              {company.logoEmoji ?? company.name.slice(0, 1)}
            </span>
            {company.name}
          </span>
        }
        description="Projetos desta empresa. Cada projeto tem seu próprio quadro Kanban."
        actions={
          <>
            {canAdmin && (
              <Button
                variant="secondary"
                leftIcon={<Settings className="size-4" />}
                onClick={() => router.push(`/empresas/${company.slug}/configuracoes`)}
              >
                Configurações
              </Button>
            )}
            {canManage && (
              <Button
                variant="primary"
                leftIcon={<Plus className="size-4" />}
                onClick={() => setCreateOpen(true)}
              >
                Novo projeto
              </Button>
            )}
          </>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filtrar projetos"
          className="inline-flex rounded-md border border-line bg-surface p-0.5"
        >
          {(
            [
              { id: "active" as Tab, label: "Ativos", count: active.length },
              { id: "archived" as Tab, label: "Arquivados", count: archived.length },
            ] satisfies { id: Tab; label: string; count: number }[]
          ).map((option) => (
            <button
              key={option.id}
              role="tab"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-[13px] font-medium transition-colors",
                tab === option.id
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {option.label}
              <span className="ml-1.5 text-[11.5px] text-ink-faint">{option.count}</span>
            </button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar projetos..."
          leftIcon={<Search />}
          aria-label="Pesquisar projetos"
          wrapClassName="w-full sm:w-64"
        />
      </div>

      {visible.length === 0 ? (
        <div className="card-surface mt-4">
          <EmptyState
            icon={<FolderKanban />}
            title={
              query
                ? "Nenhum projeto encontrado"
                : tab === "archived"
                  ? "Nenhum projeto arquivado"
                  : "Este espaço ainda está vazio"
            }
            description={
              query
                ? `Nada corresponde a "${query}". Tente outro termo.`
                : tab === "archived"
                  ? "Projetos arquivados aparecem aqui e podem ser restaurados."
                  : "Crie o primeiro projeto desta empresa e monte seu quadro."
            }
            action={
              !query && tab === "active" && canManage ? (
                <Button
                  variant="primary"
                  leftIcon={<Plus className="size-4" />}
                  onClick={() => setCreateOpen(true)}
                >
                  Criar projeto
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              menu={
                canManage ? (
                  <Dropdown
                    trigger={({ ref, onClick, open, ...aria }) => (
                      <ProjectCardMenuButton
                        ref={ref}
                        onClick={onClick}
                        data-open={open}
                        {...aria}
                      />
                    )}
                  >
                    {({ close }) => (
                      <>
                        <DropdownItem
                          icon={<Pencil />}
                          onSelect={() => {
                            close();
                            setEditing(project);
                          }}
                        >
                          Editar
                        </DropdownItem>
                        {canAdmin && (
                          <DropdownItem
                            icon={project.archivedAt ? <ArchiveRestore /> : <Archive />}
                            onSelect={() => {
                              close();
                              void handleArchive(project, !project.archivedAt);
                            }}
                          >
                            {project.archivedAt ? "Restaurar" : "Arquivar"}
                          </DropdownItem>
                        )}
                        {canAdmin && (
                          <>
                            <DropdownSeparator />
                            <DropdownItem
                              icon={<Trash2 />}
                              tone="danger"
                              onSelect={() => {
                                close();
                                setDeleting(project);
                              }}
                            >
                              Excluir projeto
                            </DropdownItem>
                          </>
                        )}
                      </>
                    )}
                  </Dropdown>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <ProjectFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companyId={company.id}
      />

      {editing && (
        <ProjectFormModal
          open
          onClose={() => setEditing(null)}
          companyId={company.id}
          project={editing}
          navigateOnCreate={false}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Excluir projeto?"
        description={
          <>
            O projeto <strong className="font-medium text-ink">{deleting?.name}</strong> e todas
            as suas colunas e tarefas serão removidos permanentemente. Essa ação não poderá ser
            desfeita.
          </>
        }
        confirmLabel="Excluir projeto"
      />
    </>
  );
}
