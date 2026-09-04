"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { Input, type InputProps } from "@/components/ui/Field";

export function PasswordInput(props: Omit<InputProps, "type" | "leftIcon" | "rightSlot">) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      leftIcon={<Lock />}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          className="rounded-sm p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-soft"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
