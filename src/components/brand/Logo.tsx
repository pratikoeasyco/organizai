"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/cn";
import { brand } from "@/lib/brand";

/** Símbolo desenhado em código — rede de segurança quando a imagem falha. */
function InlineMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path
        d="M9.5 12.4L12.2 15.1L18.4 8.9"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="9.5" y="18.2" width="13" height="2.6" rx="1.3" fill="white" fillOpacity="0.95" />
      <rect x="9.5" y="23" width="8" height="2.6" rx="1.3" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

/**
 * Símbolo quadrado da marca: aba do navegador, sidebar recolhida, topo mobile.
 *
 * Usa o arquivo de `public/brand/`. Se ele sumir ou o nome estiver errado
 * (maiúsculas contam em produção, mas não no Windows), cai no símbolo
 * desenhado em código em vez de exibir um ícone quebrado.
 */
export function LogoMark({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!brand.mark || failed) return <InlineMark className={className} />;

  return (
    // Imagem pequena e estática: next/image não traria ganho e exigiria
    // dimensões fixas, atrapalhando a sidebar que recolhe.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.mark}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}

/**
 * Marca completa. Com `brand.wordmark` configurado usa o logo horizontal
 * pronto; sem ele, compõe símbolo + nome em texto, que acompanha a tipografia
 * do produto e fica sempre nítido.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (brand.wordmark && showWordmark && !failed) {
    return (
      // Mesmo motivo do LogoMark.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.wordmark}
        alt={brand.name}
        width={brand.wordmarkAspect.width}
        height={brand.wordmarkAspect.height}
        onError={() => setFailed(true)}
        // h-8 é o teto útil: a sidebar aberta tem 256px e, na proporção 5,22:1,
        // 32px de altura já ocupam ~167px de largura. max-w-full protege caso
        // a marca seja trocada por uma mais larga.
        className={cn("h-8 w-auto max-w-full object-contain", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7.5" />
      {showWordmark && (
        <span className="text-[16px] font-semibold tracking-tight text-ink">
          Organiza<span className="text-brand-600">í</span>
        </span>
      )}
    </span>
  );
}
