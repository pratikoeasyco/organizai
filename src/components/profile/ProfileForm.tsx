"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { FormAlert } from "@/components/auth/FormAlert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { BRAND_PALETTE } from "@/lib/utils/colors";
import {
  changePasswordAction,
  logoutAction,
  updateProfileAction,
} from "@/server/actions/auth";
import type { ActionState } from "@/server/actions/types";
import type { SessionUser } from "@/lib/auth/session";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfileForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [profileState, setProfileState] = useState<ActionState>({ ok: false });
  const [profileBusy, setProfileBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<ActionState>({ ok: false });
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileState({ ok: false });

    const formData = new FormData();
    formData.set("name", name);
    formData.set("jobTitle", jobTitle);
    formData.set("avatarColor", avatarColor);

    const result = await updateProfileAction({ ok: false }, formData);
    setProfileBusy(false);
    setProfileState(result);

    if (result.ok) {
      toast.success("Alterações salvas.");
      router.refresh();
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordState({ ok: false });

    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);

    const result = await changePasswordAction({ ok: false }, formData);
    setPasswordBusy(false);
    setPasswordState(result);

    if (result.ok) {
      toast.success("Senha atualizada.");
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="mt-7 space-y-4">
      <Section
        title="Informações pessoais"
        description="Como você aparece para os outros membros das suas empresas."
      >
        <form onSubmit={saveProfile} className="space-y-5" noValidate>
          {profileState.error && <FormAlert>{profileState.error}</FormAlert>}

          <div className="flex items-center gap-4">
            <Avatar name={name || user.name} color={avatarColor} size="lg" />
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink">{name || user.name}</p>
              <p className="text-[12.5px] text-ink-muted">{user.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={profileState.fieldErrors?.name}
              maxLength={80}
              required
            />
            <Input
              label="Cargo (opcional)"
              placeholder="Ex.: Gerente de projetos"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              error={profileState.fieldErrors?.jobTitle}
              maxLength={80}
            />
          </div>

          <Input
            label="E-mail"
            value={user.email}
            disabled
            hint="O e-mail de acesso não pode ser alterado nesta versão."
          />

          <ColorPicker
            label="Cor do seu avatar"
            value={avatarColor}
            onChange={setAvatarColor}
            palette={BRAND_PALETTE}
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={profileBusy}
              disabled={name.trim().length < 2}
            >
              Salvar alterações
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Senha" description="Escolha uma senha forte e que você não usa em outros serviços.">
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          {passwordState.error && <FormAlert>{passwordState.error}</FormAlert>}
          {passwordState.ok && <FormAlert tone="success">Senha atualizada com sucesso.</FormAlert>}

          <PasswordInput
            label="Senha atual"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            error={passwordState.fieldErrors?.currentPassword}
            autoComplete="current-password"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput
              label="Nova senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={passwordState.fieldErrors?.password}
              autoComplete="new-password"
              required
            />
            <PasswordInput
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={passwordState.fieldErrors?.confirmPassword}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={passwordBusy}
              disabled={!currentPassword || password.length < 8}
            >
              Alterar senha
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Sessão" description="Encerra o acesso neste dispositivo.">
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" leftIcon={<LogOut className="size-4" />}>
            Sair da conta
          </Button>
        </form>
      </Section>
    </div>
  );
}
