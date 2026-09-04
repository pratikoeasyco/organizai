/** Paletas usadas nos seletores de cor de empresas, projetos, colunas e etiquetas. */

export const BRAND_PALETTE = [
  "#2563EB", // azul royal (padrão)
  "#0EA5E9", // azul céu
  "#06B6D4", // ciano
  "#10B981", // esmeralda
  "#84CC16", // lima
  "#F59E0B", // âmbar
  "#F97316", // laranja
  "#EF4444", // vermelho
  "#EC4899", // rosa
  "#A855F7", // roxo
  "#6366F1", // índigo
  "#64748B", // slate
] as const;

export const COLUMN_PALETTE = [
  "#94A3B8", // neutro (padrão)
  "#2563EB",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
] as const;

export const LABEL_PALETTE = BRAND_PALETTE;

export const DEFAULT_BRAND_COLOR = "#2563EB";
export const DEFAULT_COLUMN_COLOR = "#94A3B8";

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}

export function normalizeHex(value: string, fallback = DEFAULT_BRAND_COLOR): string {
  return isValidHex(value) ? value.toUpperCase() : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = normalizeHex(hex).slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Cor com alpha para fundos suaves, ex.: `withAlpha("#2563EB", 0.1)`. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Escolhe texto claro ou escuro conforme a luminância do fundo — garante
 * contraste sem depender de cores fixas.
 */
export function readableTextOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}

/** Cor determinística a partir de um texto — usada em avatares gerados. */
export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return BRAND_PALETTE[Math.abs(hash) % BRAND_PALETTE.length];
}
