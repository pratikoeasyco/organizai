"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils/cn";

const CONTROL_BASE =
  "w-full rounded-md border bg-surface text-sm text-ink placeholder:text-ink-faint " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-600/12 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted";

function stateClass(invalid?: boolean) {
  return invalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/12"
    : "border-line hover:border-line-strong";
}

// ---------------------------------------------------------------------------

interface LabelWrapProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}

export function FieldWrap({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: LabelWrapProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-[13px] font-medium text-ink-soft"
        >
          {label}
          {required && (
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12.5px] font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12.5px] text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  wrapClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, wrapClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldWrap
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      htmlFor={inputId}
      className={wrapClassName}
    >
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint [&>svg]:size-4">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            CONTROL_BASE,
            stateClass(Boolean(error)),
            "h-9.5 px-3",
            leftIcon ? "pl-9.5" : undefined,
            rightSlot ? "pr-10" : undefined,
            className,
          )}
          {...props}
        />
        {rightSlot && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    </FieldWrap>
  );
});

// ---------------------------------------------------------------------------

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, wrapClassName, id, rows = 4, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <FieldWrap
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      htmlFor={textareaId}
      className={wrapClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className={cn(
          CONTROL_BASE,
          stateClass(Boolean(error)),
          "resize-y px-3 py-2.5 leading-relaxed",
          className,
        )}
        {...props}
      />
    </FieldWrap>
  );
});

// ---------------------------------------------------------------------------

// O antigo `Select` baseado em <select> nativo foi removido: a lista era
// desenhada pelo sistema operacional e destoava de todo o resto da interface.
// Use `SelectField` (components/ui/SelectField.tsx).
