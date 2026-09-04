/**
 * Identidade visual da marca em um único lugar.
 *
 * Para trocar o logo, o caminho normal é **substituir os arquivos** em
 * `public/brand/` mantendo os mesmos nomes — nada aqui precisa mudar.
 * Este arquivo só é editado para usar nomes/formatos diferentes.
 *
 * Veja `public/README.md` para as dimensões esperadas de cada arquivo.
 */
export const brand = {
  /** Nome usado em rótulos de acessibilidade e no texto de fallback. */
  name: "Organizaí",

  /**
   * Ícone quadrado. Vai para a aba do navegador, a sidebar recolhida e o topo
   * no mobile — lugares onde só cabe um símbolo.
   */
  mark: "/brand/favicon.png",

  /**
   * Logo horizontal completo (símbolo + nome já desenhados juntos). Aparece na
   * sidebar expandida e nas telas de login/cadastro.
   *
   * Se a sua marca for só um símbolo quadrado, sem o nome escrito, defina
   * `wordmark: null` — aí o app desenha o símbolo seguido do nome em texto,
   * usando a tipografia do produto.
   */
  wordmark: "/brand/logo.png" as string | null,

  /**
   * Proporção do wordmark (5,22:1). Serve para o navegador reservar o espaço
   * certo antes de a imagem carregar, evitando o layout "pular".
   *
   * Se trocar por uma imagem de proporção diferente, atualize aqui — e exporte
   * **sem margem vazia em volta**: a margem é o que faz a logo parecer pequena,
   * porque o app dimensiona pela altura do arquivo, não pela da arte.
   */
  wordmarkAspect: { width: 1649, height: 316 },

  /** Favicon declarado no <head>. */
  favicon: "/brand/favicon.png",
} as const;
