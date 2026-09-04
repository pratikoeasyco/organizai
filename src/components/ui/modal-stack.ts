/**
 * Pilha de overlays abertos.
 *
 * Sem isso, um modal aberto sobre outro (confirmar exclusão dentro do painel
 * do dia, por exemplo) faria o Esc fechar os dois de uma vez: os dois ouvem
 * `keydown` no document, e `stopPropagation` não impede outros ouvintes no
 * mesmo elemento. Com a pilha, só o overlay do topo reage.
 */
const stack: string[] = [];

export function pushOverlay(id: string): void {
  stack.push(id);
}

export function popOverlay(id: string): void {
  const index = stack.lastIndexOf(id);
  if (index >= 0) stack.splice(index, 1);
}

/** true quando este overlay é o mais alto — o único que deve reagir ao Esc. */
export function isTopOverlay(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

/** true quando existe qualquer overlay aberto acima do painel. */
export function hasOpenOverlay(): boolean {
  return stack.length > 0;
}
