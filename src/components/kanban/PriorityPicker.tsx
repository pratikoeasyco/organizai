"use client";

import { cn } from "@/lib/utils/cn";
import { PRIORITIES, PRIORITY_META, type Priority } from "@/types/domain";

export interface PriorityPickerProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  label?: string;
}

/**
 * Seletor de prioridade em três níveis. Mostra a cor que o card vai receber no
 * quadro, para a escolha não ser abstrata.
 */
export function PriorityPicker({ value, onChange, label = "Prioridade" }: PriorityPickerProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {PRIORITIES.map((priority) => {
          const meta = PRIORITY_META[priority];
          const selected = value === priority;

          return (
            <button
              key={priority}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(priority)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors",
                selected
                  ? meta.pickerBorder
                  : "border-line hover:border-line-strong hover:bg-surface-muted",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: meta.dot }}
                  className="size-2 shrink-0 rounded-full"
                />
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    selected ? meta.text : "text-ink-soft",
                  )}
                >
                  {meta.label}
                </span>
              </span>
              <span className="text-[11.5px] leading-snug text-ink-faint">{meta.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
