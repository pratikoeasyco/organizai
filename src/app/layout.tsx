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
    icon: [
      { url: brand.favicon, type: "image/png", sizes: "48x48" },
      { url: brand.appIcon192, type: "image/png", sizes: "192x192" },
      { url: brand.appIcon512, type: "image/png", sizes: "512x512" },
    ],
    // Sem isto, o iPhone usa uma captura da página como ícone do app instalado:
    // o Safari não lê os ícones do manifesto para a tela de início.
    apple: [{ url: brand.appleIcon, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Organizaí",
    statusBarStyle: "default",
  },
  other: {
    // O Next 15 traduz `appleWebApp.capable` para <meta name="mobile-web-app-capable">,
    // que é o nome padronizado — mas o Safari do iPhone só obedece à versão com
    // prefixo. Sem esta linha, o app instalado na tela de início abre COM a
    // barra do Safari, parecendo site em vez de aplicativo.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Ocupa a tela inteira sob o entalhe e o indicador de início do iPhone. Quem
  // encosta nessas bordas (a barra inferior) compensa com env(safe-area-inset-*).
  viewportFit: "cover",
  // Sem `maximumScale`: travar o zoom deixaria o app inutilizável para quem
  // enxerga pouco, e o que se ganharia é apenas cosmético.
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
