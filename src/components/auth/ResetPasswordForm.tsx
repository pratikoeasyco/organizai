"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/auth/FormAlert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { resetPasswordAction } from "@/server/actions/auth";
import { IDLE } from "@/server/actions/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
      Salvar nova senha
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, IDLE);

  if (!token) {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Link inválido</h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Este link de redefinição não é válido. Solicite um novo.
        </p>
        <Link
          href="/recuperar-senha"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-700"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (state.ok) {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Senha atualizada</h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Sua senha foi alterada e todas as sessões anteriores foram encerradas.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-[14px] font-medium text-white transition-colors hover:bg-brand-700"
        >
          Entrar com a nova senha
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight text-ink">Definir nova senha</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Escolha uma senha nova para sua conta.
      </p>

      <form action={formAction} className="mt-7 space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        {state.error && <FormAlert>{state.error}</FormAlert>}

        <PasswordInput
          name="password"
          label="Nova senha"
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          required
          data-autofocus
        />

        <PasswordInput
          name="confirmPassword"
          label="Confirmar nova senha"
          placeholder="Repita a senha"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
          required
        />

        <SubmitButton />
      </form>
    </div>
  );
}
