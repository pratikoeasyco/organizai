"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Mail } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/FormAlert";
import { forgotPasswordAction } from "@/server/actions/auth";
import { IDLE } from "@/server/actions/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
      Enviar link de redefinição
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, IDLE);
  const resetPath = state.data?.resetPath as string | null | undefined;

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight text-ink">Recuperar senha</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Informe seu e-mail e geraremos um link para você criar uma nova senha.
      </p>

      {state.ok ? (
        <div className="mt-7 space-y-4">
          <FormAlert tone="success">
            Se existir uma conta com esse e-mail, o link de redefinição foi gerado.
          </FormAlert>

          {resetPath ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-brand-700">
                Link de redefinição
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-800">
                O envio por e-mail ainda não está configurado nesta instalação, então o link
                aparece aqui.
              </p>
              <Link
                href={resetPath}
                className="mt-3 inline-flex h-9 items-center rounded-md bg-brand-600 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-700"
              >
                Definir nova senha
              </Link>
            </div>
          ) : null}

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-sm text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Voltar para o login
          </Link>
        </div>
      ) : (
        <>
          <form action={formAction} className="mt-7 space-y-4" noValidate>
            {state.error && <FormAlert>{state.error}</FormAlert>}

            <Input
              name="email"
              type="email"
              label="E-mail"
              placeholder="voce@empresa.com"
              autoComplete="email"
              leftIcon={<Mail />}
              error={state.fieldErrors?.email}
              required
              data-autofocus
            />

            <SubmitButton />
          </form>

          <p className="mt-6 text-center text-[13.5px] text-ink-muted">
            Lembrou a senha?{" "}
            <Link
              href="/login"
              className="rounded-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              Entrar
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
