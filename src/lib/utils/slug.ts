/** Marcas diacríticas combinantes (U+0300–U+036F), removidas após NFD. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Converte um nome em slug URL-safe: "Acme Ltda." -> "acme-ltda". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Sufixo curto para desambiguar slugs já em uso. */
export function randomSuffix(length = 4): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
