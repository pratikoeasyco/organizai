"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Mail } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/FormAlert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { loginAction } from "@/server/actions/auth";
import { IDLE } from "@/server/actions/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      fullWidth
      loading={pending}
      rightIcon={<ArrowRight className="size-4" />}
    >
      Entrar
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, IDLE);

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight text-ink">Entrar na sua conta</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Bem-vindo de volta. Continue de onde parou.
      </p>

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

        <div>
          <PasswordInput
            name="password"
            label="Senha"
            placeholder="Sua senha"
            autoComplete="current-password"
            error={state.fieldErrors?.password}
            required
          />
          <div className="mt-2 flex justify-end">
            <Link
              href="/recuperar-senha"
              className="rounded-sm text-[12.5px] font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              Esqueceu a senha?
            </Link>
          </div>
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-muted">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="rounded-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Criar conta gratuitamente
        </Link>
      </p>
    </div>
  );
}
