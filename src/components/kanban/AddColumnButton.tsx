"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useBoard } from "@/components/kanban/BoardProvider";
import { COLUMN_PALETTE, DEFAULT_COLUMN_COLOR } from "@/lib/utils/colors";

export function AddColumnButton() {
  const { createColumn } = useBoard();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_COLUMN_COLOR);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setColor(DEFAULT_COLUMN_COLOR);
    setOpen(false);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const ok = await createColumn({ name: trimmed, color });
    setBusy(false);
    if (ok) reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-[292px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface/60 px-3.5 py-3 text-[13px] font-medium text-ink-muted transition-colors hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700"
      >
        <Plus className="size-4" />
        Adicionar coluna
      </button>
    );
  }

  return (
    <div className="h-fit w-[292px] shrink-0 rounded-xl border border-brand-300 bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Nova coluna</p>
        <button
          type="button"
          onClick={reset}
          aria-label="Cancelar"
          className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <input
        autoFocus
        value={name}
        maxLength={40}
        placeholder="Ex.: Em revisão"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
          if (event.key === "Escape") reset();
        }}
        aria-label="Nome da coluna"
        className="mt-2.5 w-full rounded-md border border-line px-2.5 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/12"
      />

      <div className="mt-3">
        <ColorPicker value={color} onChange={setColor} palette={COLUMN_PALETTE} label="Cor" />
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={busy}
          disabled={name.trim().length === 0}
          onClick={() => void submit()}
        >
          Criar coluna
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
