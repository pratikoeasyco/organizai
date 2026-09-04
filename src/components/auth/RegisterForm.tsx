"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Mail, User } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FormAlert } from "@/components/auth/FormAlert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { registerAction } from "@/server/actions/auth";
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
      Criar conta
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, IDLE);

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight text-ink">Criar sua conta</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Leva menos de um minuto. Sem cartão de crédito.
      </p>

      <form action={formAction} className="mt-7 space-y-4" noValidate>
        {state.error && <FormAlert>{state.error}</FormAlert>}

        <Input
          name="name"
          label="Seu nome"
          placeholder="Como podemos te chamar?"
          autoComplete="name"
          leftIcon={<User />}
          error={state.fieldErrors?.name}
          required
          data-autofocus
        />

        <Input
          name="email"
          type="email"
          label="E-mail"
          placeholder="voce@empresa.com"
          autoComplete="email"
          leftIcon={<Mail />}
          error={state.fieldErrors?.email}
          required
        />

        <PasswordInput
          name="password"
          label="Senha"
          placeholder="Mínimo de 8 caracteres"
          autoComplete="new-password"
          hint="Use pelo menos 8 caracteres."
          error={state.fieldErrors?.password}
          required
        />

        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-muted">
        Já tem uma conta?{" "}
        <Link
          href="/login"
          className="rounded-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
