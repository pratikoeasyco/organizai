"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { FieldWrap } from "@/components/ui/Field";
import { useMounted } from "@/hooks/useMounted";
import { isTopOverlay, popOverlay, pushOverlay } from "@/components/ui/modal-stack";

export interface SelectOption {
  value: string;
  label: string;
  /** Linha secundária, útil para explicar o que a opção significa. */
  description?: string;
  /** Bolinha colorida à esquerda (colunas, projetos, prioridades). */
  color?: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  wrapClassName?: string;
  /** Menu mais estreito que o gatilho, para seletores curtos inline. */
  align?: "stretch" | "start";
  "aria-label"?: string;
}

/**
 * Seletor com a aparência do produto.
 *
 * O `<select>` nativo é desenhado pelo sistema operacional — a lista abre com
 * a fonte e o azul do Windows, sem qualquer relação com o resto da interface.
 * Aqui a lista é nossa, em portal (não é cortada por overflow) e navegável
 * pelo teclado como um listbox de verdade.
 */
export function SelectField({
  value,
  onChange,
  options,
  label,
  hint,
  error,
  placeholder = "Selecione...",
  disabled,
  required,
  wrapClassName,
  align = "stretch",
  "aria-label": ariaLabel,
}: SelectFieldProps) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const overlayId = useId();
  const mounted = useMounted();

  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const height = listRef.current?.offsetHeight ?? Math.min(options.length * 40 + 8, 280);
    const gap = 6;
    const openUpward =
      rect.bottom + gap + height > window.innerHeight - 8 && rect.top > height + gap;

    setCoords({
      top: openUpward ? rect.top - gap - height : rect.bottom + gap,
      left: rect.left,
      width: align === "stretch" ? rect.width : Math.max(rect.width, 200),
      openUpward,
    });
  }, [options.length, align]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  // Abrir posiciona o destaque na opção atual, não no topo da lista.
  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === value);
    setHighlighted(index >= 0 ? index : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    pushOverlay(overlayId);
    return () => popOverlay(overlayId);
  }, [open, overlayId]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      reposition();
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, reposition]);

  function move(delta: number) {
    setHighlighted((current) => {
      let next = current;
      // Pula as opções desabilitadas em vez de parar nelas.
      for (let i = 0; i < options.length; i += 1) {
        next = (next + delta + options.length) % options.length;
        if (!options[next].disabled) break;
      }
      return next;
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (!isTopOverlay(overlayId)) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        event.preventDefault();
        setHighlighted(options.length - 1);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const option = options[highlighted];
        if (option && !option.disabled) {
          onChange(option.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const control = (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-${highlighted}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-9.5 w-full items-center gap-2 rounded-md border bg-surface px-3 text-left text-sm",
          "transition-[border-color,box-shadow] duration-150",
          "focus:outline-none focus:ring-3 focus:ring-brand-600/12",
          "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/12"
            : "border-line hover:border-line-strong focus:border-brand-600",
          open && !error && "border-brand-600 ring-3 ring-brand-600/12",
        )}
      >
        {selected?.color && (
          <span
            aria-hidden="true"
            style={{ backgroundColor: selected.color }}
            className="size-2.5 shrink-0 rounded-full"
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected ? "text-ink" : "text-ink-faint",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ?? label}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className="fixed z-150 max-h-70 overflow-y-auto scrollbar-slim rounded-lg border border-line bg-surface p-1 shadow-pop animate-scale-in"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlighted;

              return (
                <button
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                    "disabled:pointer-events-none disabled:opacity-45",
                    isHighlighted && !isSelected && "bg-surface-sunken",
                    isSelected && "bg-brand-50",
                  )}
                >
                  {option.color && (
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: option.color }}
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    />
                  )}

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px] font-medium",
                        isSelected ? "text-brand-700" : "text-ink",
                      )}
                    >
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                        {option.description}
                      </span>
                    )}
                  </span>

                  {isSelected && (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );

  if (!label && !hint && !error) return control;

  return (
    <FieldWrap
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={wrapClassName}
    >
      {control}
    </FieldWrap>
  );
}
