"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ColorPicker, EmojiPicker } from "@/components/ui/ColorPicker";
import { FormAlert } from "@/components/auth/FormAlert";
import { useToast } from "@/components/ui/Toast";
import { BRAND_PALETTE, DEFAULT_BRAND_COLOR } from "@/lib/utils/colors";
import { createProjectAction, updateProjectAction } from "@/server/actions/projects";
import type { ActionState } from "@/server/actions/types";

const TEMPLATES = [
  { id: "basic", label: "Essencial", description: "A fazer · Fazendo · Concluído" },
  {
    id: "kanban",
    label: "Fluxo completo",
    description: "Backlog · Planejamento · Em andamento · Em revisão · Concluído",
  },
  {
    id: "content",
    label: "Conteúdo",
    description: "Ideias · Produção · Revisão · Aprovado · Publicado",
  },
  { id: "empty", label: "Em branco", description: "Você cria as colunas do zero" },
] as const;

export interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  project?: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
  };
  navigateOnCreate?: boolean;
}

export function ProjectFormModal({
  open,
  onClose,
  companyId,
  project,
  navigateOnCreate = true,
}: ProjectFormModalProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(project);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_BRAND_COLOR);
  const [icon, setIcon] = useState<string | null>(null);
  const [template, setTemplate] = useState<string>("basic");
  const [state, setState] = useState<ActionState>({ ok: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setColor(project?.color ?? DEFAULT_BRAND_COLOR);
    setIcon(project?.icon ?? null);
    setTemplate("basic");
    setState({ ok: false });
  }, [open, project]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setState({ ok: false });

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("color", color);
    formData.set("icon", icon ?? "");

    try {
      if (isEdit && project) {
        formData.set("projectId", project.id);
        const result = await updateProjectAction({ ok: false }, formData);
        if (!result.ok) {
          setState(result);
          return;
        }
        toast.success("Projeto atualizado.");
        router.refresh();
        onClose();
      } else {
        formData.set("companyId", companyId);
        formData.set("template", template);
        const result = await createProjectAction({ ok: false }, formData);
        if (!result.ok) {
          setState(result);
          return;
        }
        const data = result.data as { id: string; name: string };
        toast.success("Projeto criado com sucesso.", `${data.name} está pronto.`);
        onClose();
        if (navigateOnCreate) router.push(`/projetos/${data.id}`);
        else router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      title={isEdit ? "Editar projeto" : "Novo projeto"}
      description={
        isEdit
          ? "Ajuste as informações e a identidade visual do projeto."
          : "Dê um nome ao projeto e escolha por onde começar."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="project-form"
            variant="primary"
            loading={busy}
            disabled={name.trim().length < 2}
          >
            {isEdit ? "Salvar alterações" : "Criar projeto"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {state.error && <FormAlert>{state.error}</FormAlert>}

        <Input
          label="Nome do projeto"
          placeholder="Ex.: Marketing"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={state.fieldErrors?.name}
          maxLength={60}
          required
          data-autofocus
        />

        <Textarea
          label="Descrição (opcional)"
          placeholder="Do que trata este projeto?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={state.fieldErrors?.description}
          maxLength={400}
          rows={3}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <ColorPicker label="Cor" value={color} onChange={setColor} palette={BRAND_PALETTE} />
          <EmojiPicker label="Ícone (opcional)" value={icon} onChange={setIcon} />
        </div>

        {!isEdit && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">
              Estrutura inicial
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map((option) => {
                const selected = template === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTemplate(option.id)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-brand-600 bg-brand-50"
                        : "border-line hover:border-line-strong hover:bg-surface-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-brand-600 bg-brand-600" : "border-line-strong",
                      )}
                    >
                      {selected && <Check className="size-2.5 text-white" strokeWidth={3.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
