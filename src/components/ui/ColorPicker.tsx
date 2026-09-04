"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { readableTextOn } from "@/lib/utils/colors";

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  palette: readonly string[];
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, palette, label, className }: ColorPickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-[13px] font-medium text-ink-soft">{label}</p>}
      <div role="radiogroup" aria-label={label ?? "Cor"} className="flex flex-wrap gap-1.5">
        {palette.map((color) => {
          const selected = color.toUpperCase() === value.toUpperCase();
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Cor ${color}`}
              onClick={() => onChange(color)}
              style={{ backgroundColor: color }}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-transform duration-150",
                "hover:scale-110",
                selected && "ring-2 ring-brand-600 ring-offset-2",
              )}
            >
              {selected && (
                <Check className="size-3.5" style={{ color: readableTextOn(color) }} strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EMOJI_OPTIONS = [
  "🚀", "🎯", "💡", "📊", "🎨", "💼", "🛠", "📣",
  "🧩", "📌", "🔥", "⭐", "📝", "💰", "🌱", "🧪",
];

export interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string | null) => void;
  label?: string;
}

export function EmojiPicker({ value, onChange, label }: EmojiPickerProps) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-[13px] font-medium text-ink-soft">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            "flex h-8 items-center rounded-md border px-2.5 text-[12px] font-medium transition-colors",
            value === null
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-line text-ink-muted hover:bg-surface-sunken",
          )}
        >
          Nenhum
        </button>
        {EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            aria-pressed={value === emoji}
            aria-label={`Ícone ${emoji}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border text-[15px] transition-colors",
              value === emoji
                ? "border-brand-600 bg-brand-50"
                : "border-line hover:bg-surface-sunken",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
