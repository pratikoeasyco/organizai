"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";
import { useMounted } from "@/hooks/useMounted";

type Align = "start" | "end";

export interface DropdownProps {
  /** Render prop do gatilho: recebe as props que devem ir no elemento clicável. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
    open: boolean;
  }) => ReactNode;
  children: (helpers: { close: () => void }) => ReactNode;
  align?: Align;
  width?: number;
  className?: string;
}

/**
 * Menu em portal com posicionamento fixo — não é cortado por containers com
 * `overflow: hidden` (colunas do quadro, sidebar).
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  width = 208,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  const close = useCallback(() => setOpen(false), []);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const gap = 6;

    let left = align === "end" ? rect.right - width : rect.left;
    left = Math.min(Math.max(left, 8), window.innerWidth - width - 8);

    // Abre para cima quando não há espaço abaixo.
    const openUpward =
      rect.bottom + gap + menuHeight > window.innerHeight - 8 && rect.top > menuHeight + gap;
    const top = openUpward ? rect.top - gap - menuHeight : rect.bottom + gap;

    setCoords({ top, left });
  }, [align, width]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((v) => !v),
        "aria-expanded": open,
        "aria-haspopup": "menu",
        open,
      })}

      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: coords.top, left: coords.left, width }}
            className={cn(
              "fixed z-150 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop animate-scale-in",
              className,
            )}
          >
            {children({ close })}
          </div>,
          document.body,
        )}
    </>
  );
}

export interface DropdownItemProps {
  onSelect?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  shortcut?: string;
  active?: boolean;
}

export function DropdownItem({
  onSelect,
  icon,
  children,
  tone = "default",
  disabled,
  shortcut,
  active,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-45",
        tone === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
        active && tone === "default" && "bg-brand-50 text-brand-700",
        "[&>svg]:size-4 [&>svg]:shrink-0",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <span className="text-[11px] text-ink-faint">{shortcut}</span>}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </p>
  );
}
