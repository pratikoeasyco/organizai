# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Organizaí — imagem de produção
#
# Três estágios para a imagem final ficar pequena: dependências, build e
# execução. Só o resultado do build vai para a imagem que roda.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# O Prisma precisa disto no Alpine (libc compatível com o engine).
RUN apk add --no-cache libc6-compat
WORKDIR /app


# --- Dependências -----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` respeita o lockfile. O postinstall roda o prisma generate.
RUN npm ci


# --- Build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# A chave pública de push é embutida no JavaScript do navegador, então precisa
# estar disponível AGORA, no build — passar só em tempo de execução não adianta.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# O build não acessa o banco, mas o Prisma exige a variável presente e válida
# para o provider. Uma URL de faz de conta basta — nada se conecta aqui.
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build


# --- CLI do Prisma ----------------------------------------------------------
# O `migrate deploy` roda ao subir o container, então o CLI precisa estar na
# imagem final — e com as dependências dele.
#
# Copiar apenas `node_modules/prisma` do build NÃO basta: o CLI carrega
# `@prisma/config`, que exige `effect` e mais uma dúzia de pacotes instalados na
# raiz do node_modules. Faltando qualquer um, o container falha ao subir com
# "Cannot find module 'effect'".
#
# Instalar o CLI sozinho aqui traz a árvore inteira dele e nada mais, sem
# arrastar as dependências de desenvolvimento do projeto para a imagem.
FROM base AS prismacli
WORKDIR /cli
ARG PRISMA_VERSION=6.19.3
RUN npm init -y > /dev/null \
 && npm install prisma@${PRISMA_VERSION} --omit=dev --no-audit --no-fund


# --- Execução ---------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégios: se algo for comprometido, não é root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Saída standalone: servidor + apenas as dependências que ele usa.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema e migrações, lidos pelo CLI ao subir.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# O script que cria o administrador importa a função de hash do código-fonte.
# Copiar só este arquivo evita duplicar a lógica de senha em dois lugares, que
# um dia divergiriam.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/auth/password.ts ./src/lib/auth/password.ts

# Prisma Client gerado, usado pela aplicação e pelo script do administrador.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# CLI do Prisma, em diretório próprio para não colidir com o node_modules da
# aplicação. Só o entrypoint o utiliza, para aplicar as migrações.
COPY --from=prismacli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Sem volume: o banco é um PostgreSQL externo. O container é descartável e pode
# ser reconstruído a qualquer momento sem perder dado nenhum.

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
