"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ColorPicker, EmojiPicker } from "@/components/ui/ColorPicker";
import { FormAlert } from "@/components/auth/FormAlert";
import { useToast } from "@/components/ui/Toast";
import { BRAND_PALETTE, DEFAULT_BRAND_COLOR } from "@/lib/utils/colors";
import { slugify } from "@/lib/utils/slug";
import { createCompanyAction, updateCompanyAction } from "@/server/actions/companies";
import type { ActionState } from "@/server/actions/types";

export interface CompanyFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Quando informado, o modal edita a empresa em vez de criar. */
  company?: {
    id: string;
    name: string;
    color: string;
    logoEmoji: string | null;
  };
  /** Navega para a empresa recém-criada. Padrão: true. */
  navigateOnCreate?: boolean;
  onCreated?: (data: { id: string; slug: string; name: string }) => void;
}

const EMOJI_OPTIONS_LABEL = "Ícone (opcional)";

export function CompanyFormModal({
  open,
  onClose,
  company,
  navigateOnCreate = true,
  onCreated,
}: CompanyFormModalProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(company);

  const [name, setName] = useState(company?.name ?? "");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [color, setColor] = useState(company?.color ?? DEFAULT_BRAND_COLOR);
  const [emoji, setEmoji] = useState<string | null>(company?.logoEmoji ?? null);
  const [state, setState] = useState<ActionState>({ ok: false });
  const [busy, setBusy] = useState(false);

  // Reabrir o modal precisa recomeçar do estado limpo (ou dos dados atuais).
  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? "");
    setSlug("");
    setSlugTouched(false);
    setColor(company?.color ?? DEFAULT_BRAND_COLOR);
    setEmoji(company?.logoEmoji ?? null);
    setState({ ok: false });
  }, [open, company]);

  const previewSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setState({ ok: false });

    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", color);
    formData.set("logoEmoji", emoji ?? "");

    try {
      if (isEdit && company) {
        formData.set("companyId", company.id);
        const result = await updateCompanyAction({ ok: false }, formData);
        if (!result.ok) {
          setState(result);
          return;
        }
        toast.success("Empresa atualizada.");
        router.refresh();
        onClose();
      } else {
        formData.set("slug", previewSlug);
        const result = await createCompanyAction({ ok: false }, formData);
        if (!result.ok) {
          setState(result);
          return;
        }
        const data = result.data as { id: string; slug: string; name: string };
        toast.success("Empresa criada com sucesso.", `${data.name} está pronta para uso.`);
        onCreated?.(data);
        onClose();
        if (navigateOnCreate) router.push(`/empresas/${data.slug}`);
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
      title={isEdit ? "Editar empresa" : "Nova empresa"}
      description={
        isEdit
          ? "Atualize o nome, a cor e o ícone da empresa."
          : "Cada empresa é um ambiente independente, com seus próprios projetos."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="company-form"
            variant="primary"
            loading={busy}
            disabled={name.trim().length < 2}
          >
            {isEdit ? "Salvar alterações" : "Criar empresa"}
          </Button>
        </>
      }
    >
      <form id="company-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {state.error && <FormAlert>{state.error}</FormAlert>}

        <Input
          label="Nome da empresa"
          placeholder="Ex.: Acme"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={state.fieldErrors?.name}
          maxLength={60}
          required
          data-autofocus
        />

        {!isEdit && (
          <Input
            label="Identificador"
            value={previewSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            hint={`Endereço: /empresas/${previewSlug || "sua-empresa"}`}
            error={state.fieldErrors?.slug}
            maxLength={48}
          />
        )}

        <ColorPicker
          label="Cor da empresa"
          value={color}
          onChange={setColor}
          palette={BRAND_PALETTE}
        />

        <EmojiPicker label={EMOJI_OPTIONS_LABEL} value={emoji} onChange={setEmoji} />
      </form>
    </Modal>
  );
}
