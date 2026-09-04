"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Estado persistido no navegador. Inicia sempre com o valor padrão e só lê o
 * armazenamento após a montagem — evita divergência de hidratação.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // armazenamento indisponível (janela privada, cookies bloqueados)
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // segue apenas em memória
      }
    },
    [key],
  );

  return [value, update, hydrated] as const;
}
