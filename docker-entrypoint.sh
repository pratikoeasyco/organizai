#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Aplica o schema ao banco antes de subir o servidor.
#
# `migrate deploy` só executa migrações já versionadas — nunca apaga dados e
# nunca inventa alteração. É o comando correto para produção; `db push`, que
# usamos em desenvolvimento, pode descartar coluna sem avisar.
# ---------------------------------------------------------------------------

# Caminho direto para o CLI instalado no estágio `prismacli` do Dockerfile.
# `npx prisma` não serve aqui: procuraria o pacote no node_modules da aplicação,
# que contém apenas o Prisma Client gerado — não o CLI nem as dependências dele.
PRISMA_CLI="/app/prisma-cli/node_modules/prisma/build/index.js"

echo "[organizai] aplicando migrações..."
if ! node "$PRISMA_CLI" migrate deploy --schema=/app/prisma/schema.prisma; then
  echo "[organizai] ERRO: não foi possível aplicar as migrações."
  echo "[organizai] Verifique a DATABASE_URL e se o PostgreSQL está acessível"
  echo "[organizai] a partir deste container (host, porta, usuário e senha)."
  exit 1
fi

# Cria a conta de administrador na primeira subida. Se já existir, não faz nada
# e não sobrescreve a senha.
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[organizai] garantindo a conta de administrador..."
  node --experimental-strip-types prisma/create-admin.ts || \
    echo "[organizai] aviso: não foi possível criar/verificar o admin."
fi

echo "[organizai] iniciando servidor na porta ${PORT:-3000}..."
exec "$@"
