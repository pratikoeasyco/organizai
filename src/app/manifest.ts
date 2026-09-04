import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA — é o que torna o app instalável na tela de início.
 * Servido pelo Next em /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Organizaí — Organize. Simplifique. Faça acontecer.",
    short_name: "Organizaí",
    description:
      "Organize empresas, projetos e tarefas em quadros Kanban totalmente personalizáveis.",
    start_url: "/dashboard",
    scope: "/",
    // `standalone` abre sem barra de endereço, como um app de verdade — e no
    // iOS é condição para o Web Push funcionar.
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Empresas", url: "/empresas" },
    ],
  };
}
