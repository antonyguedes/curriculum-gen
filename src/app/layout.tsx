import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Backdrop } from "@/components/Backdrop";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Curriculum-Gen",
  description: "Gerador de currículos sob medida para filtros ATS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${grotesk.variable} ${jetbrains.variable}`}>
      <body className="flex h-dvh flex-col overflow-hidden antialiased">
        <Backdrop />
        {/* Só esta área rola; a página nunca passa da altura da janela. */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
