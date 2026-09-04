import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ToastProvider } from "@/components/ui/Toast";
import { brand } from "@/lib/brand";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Organizaí — Organize. Simplifique. Faça acontecer.",
    template: "%s · Organizaí",
  },
  description:
    "Organize empresas, projetos e tarefas em quadros Kanban totalmente personalizáveis.",
  // Os arquivos ficam em public/brand/ — trocar a marca é substituir o arquivo,
  // sem mexer aqui. Veja public/README.md.
  icons: {
    icon: [{ url: brand.favicon, type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
