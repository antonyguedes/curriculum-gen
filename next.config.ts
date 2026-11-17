import type { NextConfig } from "next";

const config: NextConfig = {
  // Permite builds de verificação em outra pasta sem atrapalhar um `next dev` rodando.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pacotes que leem arquivos próprios em runtime (fontes AFM do pdfkit, worker do pdf.js).
  serverExternalPackages: ["pdfkit", "unpdf", "mammoth", "docx"],
};

export default config;
