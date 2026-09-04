"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useMounted } from "@/hooks/useMounted";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
}

/** Complementa o rótulo acessível — nunca é a única fonte da informação. */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useMounted();

  function show() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: side === "top" ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }, 320);
  }

  function hide() {
    window.clearTimeout(timer.current);
    setCoords(null);
  }

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {mounted &&
        coords &&
        createPortal(
          <span
            role="tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              transform: `translate(-50%, ${side === "top" ? "-100%" : "0"})`,
            }}
            className="pointer-events-none fixed z-200 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11.5px] font-medium text-white shadow-md animate-fade-in"
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
