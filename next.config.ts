import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera um servidor autocontido em .next/standalone: a imagem Docker fica com
  // o mínimo necessário para rodar, sem o node_modules inteiro.
  output: "standalone",
  // Pacotes que o bundler NÃO deve empacotar: usam módulos nativos do Node
  // (http, https, fs) e quebram ao passar pelo webpack. `web-push` chega aqui
  // pela cadeia https-proxy-agent -> agent-base.
  serverExternalPackages: ["@prisma/client", "prisma", "web-push"],
  eslint: {
    // O lint roda como passo separado (`npm run lint`), não bloqueia o build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
