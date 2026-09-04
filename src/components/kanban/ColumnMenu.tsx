"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react";

import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { COLUMN_PALETTE } from "@/lib/utils/colors";
import type { BoardColumnData } from "@/types/domain";

export interface ColumnMenuProps {
  column: BoardColumnData;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onChangeColor: (color: string) => void;
}

export function ColumnMenu({
  column,
  onRename,
  onDuplicate,
  onDelete,
  onChangeColor,
}: ColumnMenuProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [color, setColor] = useState(column.color);

  return (
    <>
      <Dropdown
        trigger={({ ref, onClick, open, ...aria }) => (
          <button
            ref={ref}
            onClick={onClick}
            {...aria}
            data-open={open}
            aria-label={`Ações da coluna ${column.name}`}
            className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <DropdownItem
              icon={<Pencil />}
              onSelect={() => {
                close();
                onRename();
              }}
            >
              Renomear
            </DropdownItem>
            <DropdownItem
              icon={<Palette />}
              onSelect={() => {
                close();
                setColor(column.color);
                setColorOpen(true);
              }}
            >
              Alterar cor
            </DropdownItem>
            <DropdownItem
              icon={<Copy />}
              onSelect={() => {
                close();
                onDuplicate();
              }}
            >
              Duplicar
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={<Trash2 />}
              tone="danger"
              onSelect={() => {
                close();
                onDelete();
              }}
            >
              Excluir coluna
            </DropdownItem>
          </>
        )}
      </Dropdown>

      <Modal
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        size="sm"
        title="Cor da coluna"
        description={`Escolha a cor de destaque de "${column.name}".`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setColorOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onChangeColor(color);
                setColorOpen(false);
              }}
            >
              Aplicar cor
            </Button>
          </>
        }
      >
        <ColorPicker value={color} onChange={setColor} palette={COLUMN_PALETTE} />
      </Modal>
    </>
  );
}
