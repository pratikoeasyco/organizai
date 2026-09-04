"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { ColorPicker, EmojiPicker } from "@/components/ui/ColorPicker";
import { FormAlert } from "@/components/auth/FormAlert";
import { useToast } from "@/components/ui/Toast";
import { BRAND_PALETTE, DEFAULT_BRAND_COLOR } from "@/lib/utils/colors";
import { getFirstName } from "@/lib/utils/format";
import { createCompanyAction } from "@/server/actions/companies";
import { createProjectAction } from "@/server/actions/projects";

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
] as const;

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2" role="status" aria-label={`Etapa ${step} de 2`}>
      {[1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            index === step ? "w-6 bg-brand-600" : "w-1.5 bg-line-strong",
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [companyColor, setCompanyColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [companyEmoji, setCompanyEmoji] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [template, setTemplate] = useState<string>("basic");

  async function submitCompany() {
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", companyName.trim());
    formData.set("color", companyColor);
    formData.set("logoEmoji", companyEmoji ?? "");

    const result = await createCompanyAction({ ok: false }, formData);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Não foi possível criar a empresa.");
      return;
    }

    setCompanyId((result.data as { id: string }).id);
    setProjectColor(companyColor);
    setStep(2);
  }

  async function submitProject() {
    if (!companyId) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("name", projectName.trim());
    formData.set("description", projectDescription);
    formData.set("color", projectColor);
    formData.set("template", template);

    const result = await createProjectAction({ ok: false }, formData);

    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? "Não foi possível criar o projeto.");
      return;
    }

    toast.success("Tudo pronto!", "Seu primeiro quadro foi criado.");
    router.push(`/projetos/${(result.data as { id: string }).id}`);
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface">
      <div className="pointer-events-none absolute inset-0 auth-grid" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <StepDots step={step} />
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:px-8">
        <div className="w-full max-w-[460px]">
          {step === 1 ? (
            <>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Building2 className="size-5" />
              </span>
              <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-ink">
                Olá, {getFirstName(userName)} <span aria-hidden="true">👋</span>
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                Vamos criar sua primeira empresa. Ela funciona como um ambiente independente,
                com seus próprios projetos e membros.
              </p>

              <div className="mt-7 space-y-5">
                {error && <FormAlert>{error}</FormAlert>}

                <Input
                  label="Nome da empresa"
                  placeholder="Ex.: Acme"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && companyName.trim().length >= 2) {
                      void submitCompany();
                    }
                  }}
                  maxLength={60}
                  required
                  data-autofocus
                />

                <ColorPicker
                  label="Cor da empresa"
                  value={companyColor}
                  onChange={setCompanyColor}
                  palette={BRAND_PALETTE}
                />

                <EmojiPicker
                  label="Ícone (opcional)"
                  value={companyEmoji}
                  onChange={setCompanyEmoji}
                />

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={busy}
                  disabled={companyName.trim().length < 2}
                  onClick={() => void submitCompany()}
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Continuar
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <LayoutGrid className="size-5" />
              </span>
              <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-ink">
                Crie seu primeiro projeto
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                Cada projeto tem seu próprio quadro. Escolha uma estrutura inicial — você pode
                mudar as colunas quando quiser.
              </p>

              <div className="mt-7 space-y-5">
                {error && <FormAlert>{error}</FormAlert>}

                <Input
                  label="Nome do projeto"
                  placeholder="Ex.: Marketing"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  maxLength={60}
                  required
                  data-autofocus
                />

                <Textarea
                  label="Descrição (opcional)"
                  placeholder="Do que trata este projeto?"
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  maxLength={400}
                  rows={2}
                />

                <ColorPicker
                  label="Cor do projeto"
                  value={projectColor}
                  onChange={setProjectColor}
                  palette={BRAND_PALETTE}
                />

                <fieldset>
                  <legend className="mb-2 text-[13px] font-medium text-ink-soft">
                    Estrutura inicial
                  </legend>
                  <div className="space-y-2">
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
                            "flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
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
                            {selected && (
                              <Check className="size-2.5 text-white" strokeWidth={3.5} />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium text-ink">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">
                              {option.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={busy}
                  disabled={projectName.trim().length < 2}
                  onClick={() => void submitProject()}
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Criar projeto e abrir quadro
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
