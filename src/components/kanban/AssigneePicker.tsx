"use client";

import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { getFirstName } from "@/lib/utils/format";
import type { BoardUser } from "@/types/domain";

export interface AssigneePickerProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  members: BoardUser[];
  /** Marca quem é você na lista, para achar rápido. */
  currentUserId?: string;
  label?: string;
}

/**
 * Escolhe o responsável. Usa avatar em vez de só o nome porque, no quadro, é
 * pelo avatar que a pessoa é reconhecida depois.
 */
export function AssigneePicker({
  value,
  onChange,
  members,
  currentUserId,
  label = "Responsável",
}: AssigneePickerProps) {
  const selected = members.find((member) => member.id === value) ?? null;

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>

      <Dropdown
        align="start"
        width={244}
        trigger={({ ref, onClick, open, ...aria }) => (
          <button
            ref={ref}
            onClick={onClick}
            {...aria}
            type="button"
            data-open={open}
            className={cn(
              "flex h-9.5 w-full items-center gap-2 rounded-md border bg-surface px-2.5 text-left text-sm",
              "transition-[border-color,box-shadow] duration-150",
              "focus:outline-none focus:ring-3 focus:ring-brand-600/12",
              open ? "border-brand-600 ring-3 ring-brand-600/12" : "border-line hover:border-line-strong",
            )}
          >
            {selected ? (
              <>
                <Avatar name={selected.name} color={selected.avatarColor} size="xs" />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {selected.name}
                  {selected.id === currentUserId && (
                    <span className="text-ink-faint"> (você)</span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-faint">
                  <UserRound className="size-3" />
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-faint">Ninguém</span>
              </>
            )}
          </button>
        )}
      >
        {({ close }) => (
          <>
            <DropdownItem
              icon={<UserRound />}
              active={value === null}
              onSelect={() => {
                close();
                onChange(null);
              }}
            >
              Ninguém
            </DropdownItem>

            <DropdownSeparator />

            <div className="max-h-56 overflow-y-auto scrollbar-slim">
              {members.map((member) => (
                <DropdownItem
                  key={member.id}
                  active={value === member.id}
                  icon={<Avatar name={member.name} color={member.avatarColor} size="xs" />}
                  onSelect={() => {
                    close();
                    onChange(member.id);
                  }}
                >
                  {member.id === currentUserId
                    ? `${getFirstName(member.name)} (você)`
                    : member.name}
                </DropdownItem>
              ))}
            </div>
          </>
        )}
      </Dropdown>
    </div>
  );
}
