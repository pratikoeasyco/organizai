# public/

Arquivos servidos diretamente na raiz do site. `public/brand/logo.png` fica
disponível em `http://localhost:3000/brand/logo.png`.

> Nunca coloque aqui nada sigiloso: **tudo neste diretório é público**, sem
> autenticação, e indexável.

---

## Trocar a marca

Substitua os dois arquivos abaixo **mantendo exatamente estes nomes**. Não é
preciso mexer em código — o app já aponta para eles.

| Arquivo              | Tamanho sugerido      | Onde aparece                                            |
| -------------------- | --------------------- | ------------------------------------------------------- |
| `brand/logo.png`     | horizontal, ~1650×320 | Sidebar aberta, telas de login e cadastro               |
| `brand/favicon.png`  | quadrado, 512×512     | Aba do navegador, sidebar recolhida, topo no celular    |

Depois de trocar, dê **Ctrl+Shift+R** no navegador. Favicon fica em cache de
forma agressiva e às vezes só atualiza reabrindo a aba.

### Detalhes que costumam dar problema

**Exporte sem margem em volta — este é o mais importante.** O app dimensiona a
imagem pela altura do *arquivo*, não pela altura da *arte*. Se o PNG tiver 60%
de margem vazia, a logo aparece com menos da metade do tamanho pretendido e não
há ajuste de CSS que resolva sem cortar. Aperte o recorte até a arte encostar
nas bordas.

**Fundo transparente, arte escura.** O app tem fundo branco. Uma logo branca
sobre transparente fica invisível. Se a sua marca é clara, exporte com o fundo
sólido dela.

**Maiúsculas contam.** No Windows `Logo.png` e `logo.png` são a mesma coisa; no
servidor de produção (Linux) não são. Use tudo minúsculo.

**Exporte grande.** O `logo.png` é exibido com 32px de altura, mas o arquivo
deve ter ~320px para não serrilhar em telas Retina. O favicon precisa de 512px
por causa do PWA e do ícone de tela de início — 48px fica borrado.

**Mudou a proporção?** Se a nova logo não for ~5,2:1, atualize `wordmarkAspect`
em [`src/lib/brand.ts`](../src/lib/brand.ts) com a largura e a altura reais. Isso
só evita o layout "pular" durante o carregamento; o tamanho em si é automático.

### Arquivos `-original`

`logo-original.png` e `favicon-original.png` são as versões exatamente como
você as enviou, guardadas antes de aparar as margens. Não são usados pelo app —
existem só para você poder voltar atrás. Pode apagar quando não precisar mais.

**Se a sua marca for só um símbolo quadrado**, sem o nome escrito junto, abra
[`src/lib/brand.ts`](../src/lib/brand.ts) e deixe `wordmark: null`. O app volta
a desenhar o símbolo seguido do nome em texto, na tipografia do produto — fica
melhor do que espremer um símbolo quadrado num espaço horizontal.

**Se nada aparecer**, o app não quebra: ele volta sozinho para a marca padrão
desenhada em código. Isso é sinal de nome de arquivo errado.

---

## Slots opcionais

Ainda não existem. Se você criar com estes nomes exatos, é só registrá-los em
`src/lib/brand.ts` e no `metadata` de `src/app/layout.tsx`.

| Arquivo                | Tamanho       | Para quê                                        |
| ---------------------- | ------------- | ----------------------------------------------- |
| `favicon.ico`          | 16/32/48      | Navegadores antigos que pedem `/favicon.ico`    |
| `brand/apple-icon.png` | 180×180       | Ícone ao salvar na tela de início do iPhone     |
| `brand/og-image.png`   | 1200×630      | Prévia ao compartilhar o link (WhatsApp, etc.)  |

> `favicon.ico` vai na raiz de `public/`, não em `brand/` — o navegador pede
> esse caminho fixo por conta própria, sem ninguém declarar.

---

## Quando o PWA entrar

O passo seguinte planejado (app instalável no celular) vai pedir mais dois
ícones aqui: `brand/icon-192.png` e `brand/icon-512.png`, mais um
`manifest.webmanifest`. Se você já for exportar a marca, sair com esses dois
tamanhos agora poupa uma volta.
