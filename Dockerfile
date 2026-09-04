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

# O build não acessa o banco, mas o Prisma exige a variável presente.
ENV DATABASE_URL="file:/tmp/build.db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build


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

# Prisma: schema, migrações e o CLI, para aplicar o schema ao subir.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# O script que cria o administrador importa a função de hash do código-fonte.
# Copiar só este arquivo evita duplicar a lógica de senha em dois lugares, que
# um dia divergiriam.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/auth/password.ts ./src/lib/auth/password.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Onde o banco SQLite vive. Precisa ser um volume persistente no Easypanel,
# senão os dados somem a cada novo deploy.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
