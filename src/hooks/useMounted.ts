"use client";

import { useEffect, useState } from "react";

/** Evita divergência de hidratação em componentes que usam portais. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
